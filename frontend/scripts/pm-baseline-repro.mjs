import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const web = process.env.PM_QA_WEB || 'http://127.0.0.1:5279';
const api = process.env.PM_QA_API || 'http://127.0.0.1:5119';
const out = path.resolve('../docs/audit/2026-11-04/baseline');
await fs.mkdir(out, { recursive: true });

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({
  viewport: { width: 1440, height: 980 },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
});
const login = await context.request.post(`${api}/api/auth/login`, { data: { email: 'tienddph50842@gmail.com', password: 'PrivateMediaAudit123!' } });
const auth = await login.json();
await context.addInitScript(({ token, refresh }) => {
  localStorage.setItem('token', token);
  localStorage.setItem('refreshToken', refresh);
  localStorage.setItem('workrank:private-media:room', 'shared');
}, { token: auth.accessToken, refresh: auth.refreshToken });

const page = await context.newPage();
const frames = [];
page.on('framenavigated', (f) => { if (f.url().includes('/embed/')) frames.push({ at: Date.now(), url: f.url().slice(0, 90) }); });

const command = async (action, payload = {}) => {
  const r = await context.request.post(`${api}/api/private-media/commands`, {
    headers: { Authorization: `Bearer ${auth.accessToken}`, 'X-PM-Room': 'shared' },
    data: { commandId: crypto.randomUUID(), action, payload },
  });
  return r.json();
};

const media = async () => {
  const frame = page.frames().find((f) => f.url().includes('/embed/'));
  if (!frame) return { missing: true };
  return frame.evaluate(() => {
    const v = document.querySelector('video');
    if (!v) return { noVideo: true };
    return { currentTime: Number(v.currentTime.toFixed(2)), paused: v.paused, readyState: v.readyState, src: v.currentSrc?.slice(0, 60) };
  }).catch((e) => ({ error: e.message }));
};

const result = { startedAt: new Date().toISOString(), steps: [] };
try {
  await page.goto(`${web}/private/media`);
  await page.getByRole('heading', { level: 1, name: 'Điều khiển media' }).waitFor();
  await command('QUEUE_CLEAR');
  await command('LOAD_VIDEO', { videoId: 'aqz-KE-bpKQ', title: 'Baseline · Big Buck Bunny', durationSeconds: 635 });
  await page.waitForTimeout(6000);
  const before = await media();
  await page.evaluate(() => { document.querySelectorAll('iframe').forEach((f) => { if (f.src.includes('/embed/')) f.dataset.pmMark = 'baseline-iframe'; }); });
  const markerBefore = await page.evaluate(() => document.querySelectorAll('iframe[data-pm-mark="baseline-iframe"]').length);
  result.steps.push({ step: 'playing', before, markerBefore, iframeCount: await page.evaluate(() => document.querySelectorAll('iframe').length) });

  for (const route of ['/dashboard', '/leaderboard', '/games']) {
    await page.goto(`${web}${route}`);
    await page.waitForTimeout(2500);
    result.steps.push({
      step: `on ${route}`,
      iframes: await page.evaluate(() => document.querySelectorAll('iframe').length),
      marker: await page.evaluate(() => document.querySelectorAll('iframe[data-pm-mark="baseline-iframe"]').length),
    });
  }

  await page.goto(`${web}/private/media`);
  await page.getByRole('heading', { level: 1, name: 'Điều khiển media' }).waitFor();
  await page.waitForTimeout(6000);
  const after = await media();
  result.steps.push({ step: 'back on media', after, marker: await page.evaluate(() => document.querySelectorAll('iframe[data-pm-mark="baseline-iframe"]').length) });
  result.summary = {
    timeBefore: before.currentTime,
    timeAfter: after.currentTime,
    iframeNavigations: frames.length,
    resetToZero: Number(after.currentTime) < 1,
  };
  await page.screenshot({ path: path.join(out, 'after-return.png'), fullPage: true });
} catch (error) {
  result.error = error.stack;
} finally {
  result.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(out, 'repro.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}
