import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const web = process.env.PM_QA_WEB || 'http://127.0.0.1:5279', api = process.env.PM_QA_API || 'http://127.0.0.1:5119';
for (const url of [web, api]) assert.equal(new URL(url).hostname, '127.0.0.1');
const output = path.resolve('../docs/audit/2026-10-30/private-media-listening'); await fs.mkdir(output, { recursive: true });
const report = { startedAt: new Date().toISOString(), checks: [], errors: [], playerMode: 'youtube' };
const pass = (name, evidence) => { report.checks.push({ name, status: 'PASS', evidence }); console.log('PASS', name, JSON.stringify(evidence || '')); };
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
async function identity(email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' });
  const login = await context.request.post(`${api}/api/auth/login`, { data: { email, password: 'PrivateMediaAudit123!' } }); assert.equal(login.status(), 200, await login.text()); const auth = await login.json();
  await context.addInitScript(({ token, refresh }) => { localStorage.setItem('token', token); localStorage.setItem('refreshToken', refresh); localStorage.setItem('workrank:private-media:room', 'shared'); }, { token: auth.accessToken, refresh: auth.refreshToken });
  const page = await context.newPage(); page.on('pageerror', (e) => report.errors.push(e.message));
  const request = async (route, data, method) => {
    const response = await context.request[method || (data === undefined ? 'get' : 'post')](`${api}/api/private-media/${route}`, { headers: { Authorization: `Bearer ${auth.accessToken}`, 'X-PM-Room': 'shared' }, ...(data === undefined ? {} : { data }) });
    assert.ok(response.ok(), `${route}: ${response.status()} ${await response.text()}`); return response.json();
  };
  return { context, page, request, userId: auth.user.id };
}
async function media(page) {
  const frame = page.frames().find((f) => f.url().includes('/embed/'));
  if (!frame) return null;
  return frame.evaluate(() => { const v = document.querySelector('video'); return v ? { currentTime: v.currentTime, duration: v.duration, paused: v.paused, muted: v.muted, volume: v.volume, readyState: v.readyState } : { noVideo: true, body: document.body.innerText.slice(0, 300) }; }).catch(() => null);
}
async function until(work, predicate, timeout = 25000) {
  const deadline = Date.now() + timeout; let value;
  while (Date.now() < deadline) { value = await work(); if (predicate(value)) return value; await new Promise((r) => setTimeout(r, 500)); }
  throw new Error(`Timeout: ${JSON.stringify(value)}`);
}
const command = (who, action, payload = {}) => who.request('commands', { commandId: crypto.randomUUID(), action, payload });
let a, b;
try {
  a = await identity('tienddph50842@gmail.com'); b = await identity('pm-listener@audit.test');
  await a.page.goto(`${web}/private/media`); await a.page.getByRole('heading', { level: 1, name: 'Điều khiển media' }).waitFor();
  await command(a, 'QUEUE_CLEAR'); await command(a, 'LOAD_VIDEO', { videoId: 'aqz-KE-bpKQ', title: 'A · Big Buck Bunny', durationSeconds: 635 });
  pass('A actual YouTube media plays', await until(() => media(a.page), (v) => v?.currentTime > 1 && !v.paused));
  await command(a, 'SEEK', { position: 90 }); await b.page.goto(`${web}/private/media`); await b.page.getByRole('heading', { level: 1, name: 'Điều khiển media' }).waitFor();
  const second = await until(() => media(b.page), (v) => v?.currentTime > 88 && !v.paused), at = await media(a.page);
  assert.ok(Math.abs(at.currentTime - second.currentTime) < 3); pass('B joins actual media near 01:30', { a: at, b: second });
  const level = async (who, n) => { const slider = who.page.getByLabel('Âm lượng của bạn', { exact: true }); await slider.focus(); await slider.press('Home'); for (let i = 0; i < n / 5; i++) await slider.press('ArrowRight'); };
  await level(a, 25); await level(b, 100); await a.page.waitForTimeout(600);
  const volumes = [await media(a.page), await media(b.page)]; assert.ok(Math.abs(volumes[0].volume - .25) < .02); assert.equal(volumes[1].volume, 1); pass('Independent A25/B100 local volume', volumes);
  await level(a, 40); await a.page.waitForTimeout(400); assert.equal((await media(b.page)).volume, 1); pass('A40 does not affect B100', await media(a.page));
  await b.page.getByRole('button', { name: 'Tắt tiếng', exact: true }).click(); await a.page.waitForTimeout(500);
  assert.equal((await media(b.page)).muted, true); assert.equal((await media(a.page)).muted, false); assert.equal((await media(a.page)).paused, false); pass('B local mute; A continues', [await media(a.page), await media(b.page)]);
  await b.page.getByRole('button', { name: 'Bật tiếng', exact: true }).click(); await b.page.waitForTimeout(300);
  assert.equal((await media(b.page)).volume, 1); assert.equal((await media(b.page)).muted, false);
  await b.page.getByRole('button', { name: 'Tắt tiếng', exact: true }).click(); pass('Unmute restores B100 locally');
  await command(a, 'PAUSE'); await until(() => Promise.all([media(a.page), media(b.page)]), (vs) => vs.every((v) => v?.paused)); pass('Shared pause A/B');
  await command(a, 'PLAY'); await until(() => Promise.all([media(a.page), media(b.page)]), (vs) => vs.every((v) => v && !v.paused));
  await command(b, 'QUEUE_ADD', { videoId: 'jNQXAC9IVRw', title: 'B · Me at the zoo' }); await command(a, 'QUEUE_ADD', { videoId: 'M7lc1UVf-VE', title: 'C · YouTube IFrame API demo' });
  const state = (await a.request('session')).session; assert.equal(state.video.title, 'A · Big Buck Bunny'); assert.deepEqual(state.queue.map((q) => q.title), ['B · Me at the zoo', 'C · YouTube IFrame API demo']);
  await b.page.getByText('C · YouTube IFrame API demo', { exact: true }).waitFor(); pass('Shared FIFO B then C appears in A/B');
  await a.page.reload(); await until(() => media(a.page), (v) => v?.volume === .4 && v.currentTime > 88 && !v.paused); assert.equal((await media(b.page)).volume, 1); pass('A refresh restores volume40 and timeline');
  await b.page.reload(); await until(() => media(b.page), (v) => v?.muted && v.currentTime > 88 && !v.paused); pass('B refresh restores local mute and timeline');
  await a.page.screenshot({ path: path.join(output, 'desktop-a.png'), fullPage: true }); await b.page.screenshot({ path: path.join(output, 'desktop-b.png'), fullPage: true });
  for (const title of ['B · Me at the zoo', 'C · YouTube IFrame API demo']) {
    const playing = await media(a.page);
    await command(a, 'SEEK', { position: Math.max(0, playing.duration - 4) }); await until(async () => (await a.request('session')).session, (s) => s.video?.title === title, 20000);
    const vs = await until(() => Promise.all([media(a.page), media(b.page)]), (vs) => vs.every((v) => v && !v.paused && v.readyState >= 3 && v.currentTime > .5 && v.currentTime < 10)); pass(`Natural ENDED advances to ${title} exactly once`, vs);
  }
  const prior = (await a.request('session')).session;
  await b.page.getByLabel('Tìm video YouTube hoặc dán link').fill('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  await b.page.locator('.pm-search__form button[type="submit"]').click();
  await until(async () => (await b.request('session')).session, (s) => s.queue.length === 1, 25000);
  const queued = (await a.request('session')).session;
  assert.equal(queued.currentQueueItemId, prior.currentQueueItemId);
  await a.page.locator('.pm-queue__row').first().waitFor(); pass('Pasted YouTube link through B UI queues without interrupting C');
  await a.page.getByRole('button', { name: 'Bài tiếp theo', exact: true }).click();
  await until(() => Promise.all([media(a.page), media(b.page)]), (vs) => vs.every((v) => v?.duration > 630 && v?.duration < 636 && v.readyState >= 3 && !v.paused && v.currentTime > .5));
  pass('Shared Next UI loads queued actual media on A/B');
  assert.equal((await a.request('session')).session.participantCount, 2); pass('Participant count remains two across refreshes');
  await command(b, 'QUEUE_ADD', { videoId: 'aqz-KE-bpKQ', title: 'Recovery track', durationSeconds: 635 });
  await command(a, 'LOAD_VIDEO', { videoId: 'xxxxxxxxxxx', title: 'Unavailable test' });
  await until(async () => (await a.request('session')).session, (s) => s.video?.title === 'Recovery track', 30000);
  await a.page.getByText('Không thể phát bài này, đã chuyển sang bài tiếp theo.', { exact: true }).waitFor();
  await until(() => Promise.all([media(a.page), media(b.page)]), (vs) => vs.every((v) => v?.readyState >= 3 && !v.paused && v.currentTime > .5));
  pass('Unavailable YouTube video skips once to queued recovery and shows toast');
  await a.page.setViewportSize({ width: 390, height: 844 }); await a.page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
  await a.page.getByLabel('Âm lượng của bạn', { exact: true }).scrollIntoViewIfNeeded();
  await a.page.screenshot({ path: path.join(output, 'mobile-controls.png'), fullPage: false });
  assert.equal(await a.page.evaluate(() => [...document.querySelectorAll('.pm-listening, .pm-inline-bar, .pm-result')].every((e) => e.getBoundingClientRect().right <= innerWidth + 1) && document.documentElement.scrollWidth <= innerWidth), true); pass('Mobile no horizontal overflow');
  await a.request(`grants/${b.userId}`, {}, 'delete');
  await b.page.waitForURL('**/dashboard');
  assert.equal(await b.page.locator('nav').getByText('Điều khiển media', { exact: true }).count(), 0);
  pass('Revoked B leaves player and loses sidebar entry immediately');
} catch (error) {
  report.errors.push(error.stack); report.checks.push({ name: 'Browser acceptance', status: 'FAIL', evidence: error.message }); console.error(error.message); process.exitCode = 1;
  for (const [i, who] of [a, b].entries()) if (who) await who.page.screenshot({ path: path.join(output, `failure-${i}.png`), fullPage: true }).catch(() => {});
} finally { report.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2)); await browser.close(); }
