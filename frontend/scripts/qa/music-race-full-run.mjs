/**
 * Full-song QA run: types every line as soon as it becomes active, so the song
 * should never stop. Verifies the result screen and the server submission.
 *
 *   node scripts/qa/music-race-full-run.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const APP = 'http://localhost:5173';
const token = fs.readFileSync('/tmp/wr-token.txt', 'utf8').trim();
const email = fs.readFileSync('/tmp/wr-email.txt', 'utf8').trim();
const QA_USER = {
  id: 11001,
  name: 'QA Music',
  email,
  role: 'user',
  status: 'active',
  jobTitle: 'Editor',
  department: 'Media & Content',
  teamId: null,
  avatarData: null,
};

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await context.newPage();
page.on('pageerror', (error) => console.log('  [pageerror]', error.message.slice(0, 200)));
page.on('response', (response) => {
  if (response.status() >= 400 && response.url().includes('/api/')) console.log('  [http]', response.status(), response.url());
});

await page.route('**/api/auth/me', (route) => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ user: QA_USER }),
}));

await page.goto(APP, { waitUntil: 'domcontentloaded' });
await page.evaluate(([t, e, id]) => {
  localStorage.setItem('token', t);
  localStorage.setItem('workrank_active_user_id', String(id));
  localStorage.setItem('workrank_user_email', e);
}, [token, email, QA_USER.id]);

await page.goto(`${APP}/games/typing/music`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.music-song-card');
// Song 1: 10 lines, ~61s, first line at 5s.
await page.locator('.music-song-card').first().click();
await page.waitForSelector('.music-ready-card');
await page.getByRole('button', { name: /BẮT ĐẦU/ }).click();
await page.waitForSelector('.music-run');
await page.locator('.music-native-input').click();

const started = Date.now();
let typedLines = -1;
let pauses = 0;

while (Date.now() - started < 90000) {
  const state = await page.evaluate(() => {
    const audio = document.querySelector('audio');
    const current = document.querySelector('.music-lyric--current');
    const text = current ? [...current.querySelectorAll('.music-glyph')].map((n) => n.textContent).join('') : '';
    return {
      paused: audio ? audio.paused : null,
      time: audio ? audio.currentTime : 0,
      text,
      pauseCall: Boolean(document.querySelector('.music-pause-call')),
      result: Boolean(document.querySelector('.music-result')),
      done: audio ? audio.ended : false,
    };
  });
  if (state.result) break;
  if (state.pauseCall) pauses += 1;
  if (state.text && state.text !== 'Hết bài' && typedLines !== state.time) {
    // Fill the whole line; the engine completes it and the next line is a new element.
    const input = page.locator('.music-native-input');
    await input.fill(state.text).catch(() => {});
    typedLines = state.time;
    console.log(`  t=${state.time.toFixed(1)}s line="${state.text.slice(0, 28)}" paused=${state.paused}`);
  }
  if (state.done) break;
  await page.waitForTimeout(220);
}

console.log('  loop ended at', ((Date.now() - started) / 1000).toFixed(1), 's; waiting for result');
await page.waitForSelector('.music-result', { timeout: 25000 });
await page.waitForTimeout(1500);
const result = await page.evaluate(() => ({
  heading: document.querySelector('.music-result h2')?.innerText,
  grid: [...document.querySelectorAll('.music-result-grid > div')].map((d) => `${d.querySelector('dt')?.innerText}: ${d.querySelector('dd')?.innerText}`),
  achievements: [...document.querySelectorAll('.music-achievement')].map((a) => `${a.dataset.earned === 'true' ? '★' : '☆'} ${a.querySelector('b')?.innerText}`),
  note: document.querySelector('.music-result-note')?.innerText,
}));
console.log(JSON.stringify(result, null, 1));
await page.screenshot({ path: '/tmp/music-07-result.png' });
await browser.close();
console.log('done');
