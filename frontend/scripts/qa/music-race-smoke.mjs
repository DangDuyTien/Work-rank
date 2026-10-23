/**
 * Live smoke test for Đua Gõ Theo Nhạc (dev stack, real browser, real audio).
 * Not part of `npm test`: it needs the dev servers and a QA account.
 *
 *   node scripts/qa/music-race-smoke.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const APP = 'http://localhost:5173';
const API = 'http://localhost:5001';
const token = fs.readFileSync('/tmp/wr-token.txt', 'utf8').trim();
const email = fs.readFileSync('/tmp/wr-email.txt', 'utf8').trim();
const QA_USER_ID = 11001;
const QA_USER = {
  id: QA_USER_ID,
  name: 'QA Music',
  email,
  role: 'user',
  status: 'active',
  jobTitle: 'Editor',
  department: 'Media & Content',
  teamId: null,
  avatarData: null,
};

const log = (...args) => console.log(...args);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await context.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error') log('  [console.error]', msg.text().slice(0, 200));
});
page.on('pageerror', (error) => log('  [pageerror]', error.message.slice(0, 300)));
page.on('response', (response) => {
  if (response.status() >= 400) log('  [http]', response.status(), response.url());
});

// QA-only shim: the dev auth limiter is shared with every other request from
// this machine, so the bootstrap call is answered locally. Every gameplay
// request below still goes to the real backend.
await page.route('**/api/auth/me', async (route) => {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: QA_USER }) });
});

await page.goto(APP, { waitUntil: 'domcontentloaded' });
await page.evaluate(([t, e, id]) => {
  localStorage.setItem('token', t);
  localStorage.setItem('workrank_active_user_id', String(id));
  localStorage.setItem('workrank_user_email', e);
}, [token, email, QA_USER_ID]);

await page.goto(`${APP}/games/typing/music`, { waitUntil: 'domcontentloaded' });
try {
  await page.waitForSelector('.music-song-card', { timeout: 20000 });
} catch (error) {
  log('  [debug] url:', page.url());
  log('  [debug] title:', await page.title());
  log('  [debug] body:', (await page.locator('body').innerText()).slice(0, 600).replace(/\n+/g, ' | '));
  await page.screenshot({ path: '/tmp/music-00-failure.png', fullPage: false });
  throw error;
}
const cards = await page.locator('.music-song-card').count();
log('✓ song cards:', cards);

await page.screenshot({ path: '/tmp/music-01-picker.png', fullPage: false });

await page.locator('.music-song-card').first().click();
await page.waitForSelector('.music-ready-card', { timeout: 8000 });
log('✓ ready screen:', (await page.locator('.music-ready-card h2').innerText()).trim());
await page.screenshot({ path: '/tmp/music-02-ready.png' });

await page.getByRole('button', { name: /BẮT ĐẦU/ }).click();
await page.waitForSelector('.music-run', { timeout: 8000 });
await page.waitForTimeout(1200);

const audioState = await page.evaluate(() => {
  const el = document.querySelector('audio') || [...document.querySelectorAll('*')].find((n) => n.tagName === 'AUDIO');
  return el ? { found: true, paused: el.paused, time: el.currentTime, duration: el.duration, volume: el.volume } : { found: false };
});
log('✓ audio element:', JSON.stringify(audioState));
await page.screenshot({ path: '/tmp/music-03-playing.png' });

// Type part of the first line and let the song reach the boundary.
const line = await page.evaluate(() => document.querySelector('.music-lyric--current')?.innerText || '');
log('✓ current line:', JSON.stringify(line.slice(0, 60)));

const input = page.locator('.music-native-input');
await input.click();
await input.type(line.slice(0, 8), { delay: 20 });
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/music-04-typing.png' });

// Song 1 first line ends at 10s; wait for the boundary pause.
await page.waitForTimeout(9500);
const paused = await page.evaluate(() => {
  const el = document.querySelector('audio');
  const call = document.querySelector('.music-pause-call');
  return { audioPaused: el ? el.paused : null, time: el ? el.currentTime : null, pauseCall: call ? call.innerText.replace(/\n/g, ' | ') : null };
});
log('✓ boundary state:', JSON.stringify(paused));
await page.screenshot({ path: '/tmp/music-05-paused.png' });

// Finish the line and confirm the music resumes.
const remaining = line.slice(8);
if (remaining) await input.type(remaining, { delay: 12 });
await page.waitForTimeout(900);
const resumed = await page.evaluate(() => {
  const el = document.querySelector('audio');
  return { audioPaused: el ? el.paused : null, time: el ? el.currentTime : null, toast: document.querySelector('.music-toast')?.innerText || null };
});
log('✓ resume state:', JSON.stringify(resumed));
await page.screenshot({ path: '/tmp/music-06-resumed.png' });

const hud = await page.evaluate(() => document.querySelector('.music-hud')?.innerText.replace(/\n/g, ' | '));
log('✓ hud:', hud);

await browser.close();
log('done');
