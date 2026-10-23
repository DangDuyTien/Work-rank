/**
 * Mobile + performance QA for Đua Gõ Theo Nhạc.
 * Checks: no horizontal overflow, lyric visible without scrolling, tap target
 * works, and the frame budget during playback.
 *
 *   node scripts/qa/music-race-mobile.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const APP = 'http://localhost:5173';
const token = fs.readFileSync('/tmp/wr-token.txt', 'utf8').trim();
const email = fs.readFileSync('/tmp/wr-email.txt', 'utf8').trim();
const QA_USER = {
  id: 11001, name: 'QA Music', email, role: 'user', status: 'active',
  jobTitle: 'Editor', department: 'Media & Content', teamId: null, avatarData: null,
};

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
const page = await context.newPage();
page.on('pageerror', (error) => console.log('  [pageerror]', error.message.slice(0, 200)));
await page.route('**/api/auth/me', (route) => route.fulfill({
  status: 200, contentType: 'application/json', body: JSON.stringify({ user: QA_USER }),
}));

await page.goto(APP, { waitUntil: 'domcontentloaded' });
await page.evaluate(([t, e, id]) => {
  localStorage.setItem('token', t);
  localStorage.setItem('workrank_active_user_id', String(id));
  localStorage.setItem('workrank_user_email', e);
}, [token, email, QA_USER.id]);

await page.goto(`${APP}/games/typing/music`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.music-song-card');
const overflow = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
}));
console.log('✓ picker overflow:', JSON.stringify(overflow));
await page.screenshot({ path: '/tmp/music-m1-picker.png', fullPage: false });

await page.locator('.music-song-card').first().tap();
await page.waitForSelector('.music-ready-card');
await page.screenshot({ path: '/tmp/music-m2-ready.png' });
await page.getByRole('button', { name: /BẮT ĐẦU/ }).tap();
await page.waitForSelector('.music-run');
await page.waitForTimeout(1500);

const layout = await page.evaluate(() => {
  const sing = document.querySelector('.music-sing-area')?.getBoundingClientRect();
  const hud = document.querySelector('.music-hud')?.getBoundingClientRect();
  const stage = document.querySelector('.music-stage')?.getBoundingClientRect();
  return {
    viewportH: window.innerHeight,
    hudTop: Math.round(hud?.top || 0),
    stageH: Math.round(stage?.height || 0),
    singTop: Math.round(sing?.top || 0),
    singBottom: Math.round(sing?.bottom || 0),
    lyricVisible: sing ? sing.top < window.innerHeight - 80 : false,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
});
console.log('✓ play layout:', JSON.stringify(layout));

await page.locator('.music-native-input').tap();
const line = await page.evaluate(() => document.querySelector('.music-lyric--current')?.textContent || '');
await page.keyboard.type(line.slice(0, 6), { delay: 30 });
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/music-m3-playing.png' });

const fps = await page.evaluate(() => new Promise((resolve) => {
  const times = [];
  let last = performance.now();
  let frames = 0;
  const tick = (now) => {
    times.push(now - last);
    last = now;
    frames += 1;
    if (frames < 180) requestAnimationFrame(tick);
    else {
      const sorted = times.slice(1).sort((a, b) => a - b);
      resolve({
        avgMs: Math.round((sorted.reduce((s, v) => s + v, 0) / sorted.length) * 10) / 10,
        p95Ms: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 10) / 10,
        longFrames: sorted.filter((v) => v > 33).length,
      });
    }
  };
  requestAnimationFrame(tick);
}));
console.log('✓ frame timing during playback:', JSON.stringify(fps));

const typedState = await page.evaluate(() => ({
  inputValue: document.querySelector('.music-native-input')?.value,
  correctGlyphs: document.querySelectorAll('.music-glyph.is-correct').length,
  fontSize: getComputedStyle(document.querySelector('.music-native-input')).fontSize,
}));
console.log('✓ input state:', JSON.stringify(typedState));

await browser.close();
console.log('done');
