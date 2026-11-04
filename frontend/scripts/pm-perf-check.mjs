/**
 * PRIVATE MEDIA V2 — performance evidence.
 *
 * Measures the shipped behaviour instead of asserting it in prose:
 *   - how many YouTube iframes / socket connections exist for one session
 *   - whether chat traffic re-fetches playlists or reloads the player
 *   - long-task count while a video plays and messages arrive
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const web = process.env.PM_QA_WEB || 'http://127.0.0.1:5279';
const api = process.env.PM_QA_API || 'http://127.0.0.1:5119';
const output = path.resolve('../docs/audit/2026-11-04/perf');
await fs.mkdir(output, { recursive: true });

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 980 } });
const login = await context.request.post(`${api}/api/auth/login`, { data: { email: 'tienddph50842@gmail.com', password: 'PrivateMediaAudit123!' } });
const auth = await login.json();
await context.addInitScript(({ token, refresh }) => {
  localStorage.setItem('token', token);
  localStorage.setItem('refreshToken', refresh);
  localStorage.setItem('workrank:private-media:room', 'shared');
}, { token: auth.accessToken, refresh: auth.refreshToken });

const page = await context.newPage();
const requests = [];
const sockets = new Set();
page.on('request', (request) => {
  const url = request.url();
  requests.push({ at: Date.now(), method: request.method(), url });
  if (url.includes('/socket.io/')) sockets.add(url.split('?')[0]);
});

const command = async (action, payload = {}) => context.request.post(`${api}/api/private-media/commands`, {
  headers: { Authorization: `Bearer ${auth.accessToken}`, 'X-PM-Room': 'shared' },
  data: { commandId: crypto.randomUUID(), action, payload },
});

await page.goto(`${web}/private/media`);
await page.getByRole('heading', { level: 1, name: 'Điều khiển media' }).waitFor({ timeout: 25000 });
await command('QUEUE_CLEAR');
await command('LOAD_VIDEO', { videoId: 'aqz-KE-bpKQ', title: 'Perf · Big Buck Bunny', durationSeconds: 635 });
await page.waitForTimeout(6000);

await page.evaluate(() => {
  window.__longTasks = 0;
  window.__ltObserver = new PerformanceObserver((list) => { window.__longTasks += list.getEntries().length; });
  try { window.__ltObserver.observe({ entryTypes: ['longtask'] }); } catch { /* unsupported */ }
});

const mark = requests.length;
const beforeChat = await page.evaluate(() => document.querySelectorAll('.pm-player__canvas iframe').length);

// 15 chat messages while the video keeps playing.
for (let i = 0; i < 15; i += 1) {
  const box = page.locator('.pm-chat__form textarea');
  await box.fill(`perf message ${i} ${Date.now()}`);
  await box.press('Enter');
  await page.waitForTimeout(220);
}
await page.waitForTimeout(2500);

// Navigate away and back while measuring.
const mediaRequests = requests.slice(mark).map((request) => request.url);
const duringChat = {
  totalRequests: mediaRequests.length,
  playlistRequests: mediaRequests.filter((url) => url.includes('/api/private-media/playlists')).length,
  sessionRequests: mediaRequests.filter((url) => url.includes('/api/private-media/session') || url.includes('/api/private-media/status')).length,
  socketRequests: mediaRequests.filter((url) => url.includes('/socket.io/')).length,
  longTasks: await page.evaluate(() => window.__longTasks),
  iframes: await page.evaluate(() => document.querySelectorAll('.pm-player__canvas iframe').length),
};

await page.locator('a[href="/dashboard"]').first().click();
await page.waitForURL('**/dashboard');
await page.waitForTimeout(2500);
const onDashboard = await page.evaluate(() => {
  const host = document.querySelector('.pm-audio-host');
  const box = host?.getBoundingClientRect();
  const visible = [...document.querySelectorAll('iframe')].filter((node) => {
    const rect = node.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1 && rect.right > 0 && rect.bottom > 0;
  }).length;
  return {
    iframes: document.querySelectorAll('.pm-player__canvas iframe').length,
    audioOnly: host?.getAttribute('data-pm-player') === 'audio-only',
    offscreen: Boolean(box) && box.right <= 0,
    visibleIframes: visible,
  };
});
await page.screenshot({ path: path.join(output, 'audio-only-dashboard.png') });

await page.locator('a[href="/private/media"]').first().click();
await page.waitForURL('**/private/media');
await page.waitForTimeout(2000);

const result = {
  measuredAt: new Date().toISOString(),
  socketConnections: sockets.size,
  duringChat,
  onDashboard,
  totalRequestsWholeRun: requests.length,
  iframeBeforeChat: beforeChat,
};
await fs.writeFile(path.join(output, 'perf.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
