import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * QA thật cho Game Center + Xưởng Vẽ:
 * - menu dọc, active state, 5 game
 * - Việt hóa (quét token Latin còn sót, bỏ qua tiếng Việt có dấu)
 * - vẽ thật: bút/màu/cỡ cọ/tẩy/undo/redo/nháp
 * - đăng tranh + thư viện (mock tầng storage vì máy local không có S3)
 * - toạ độ canvas không bị decoration làm lệch
 * - desktop 1440/1024, mobile 430/390
 */

const web = process.env.QA_WEB || 'http://127.0.0.1:5277';
const api = process.env.QA_API || 'http://127.0.0.1:5001';
const out = path.resolve(process.env.QA_OUT || '../docs/audit/2026-10-22/game-center-2d');
const EMAIL = process.env.QA_EMAIL || 'qa-ui-20261022@workrank.test';
const PASSWORD = process.env.QA_PASSWORD || 'QaUiTest123!';

await fs.mkdir(out, { recursive: true });

// Từ tiếng Anh cấm xuất hiện trên UI Game Center (theo yêu cầu Việt hóa).
const FORBIDDEN = [
  'typing', 'battle', 'computer', 'rush', 'direction', 'memory', 'flash', 'drawing',
  'play', 'again', 'ready', 'waiting', 'start', 'game', 'center', 'leaderboard',
  'score', 'time', 'combo', 'accuracy', 'result', 'winner', 'rank', 'best', 'personal',
  'room', 'create', 'join', 'leave', 'brush', 'eraser', 'color', 'size', 'undo', 'redo',
  'clear', 'save', 'draft', 'publish', 'gallery', 'creative', 'corner', 'solo', 'duo',
  'trio', 'team', 'mode', 'player', 'lobby', 'submit', 'cancel', 'close', 'next',
  'previous', 'loading', 'error', 'success', 'view', 'back',
];

const browser = await chromium.launch({ headless: true });
const report = { checks: [], errors: [], shots: [], english: [], startedAt: new Date().toISOString() };

function pass(name, evidence = '') {
  report.checks.push({ name, status: 'PASS', evidence });
  console.log('PASS', name, evidence ? `· ${evidence}` : '');
}

function fail(name, evidence = '') {
  report.checks.push({ name, status: 'FAIL', evidence });
  console.log('FAIL', name, evidence ? `· ${evidence}` : '');
}

async function shot(page, name, fullPage = false) {
  const file = path.join(out, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  report.shots.push(path.basename(file));
  console.log('SHOT', name);
}

async function login(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const response = await context.request.post(`${api}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
  if (!response.ok()) throw new Error(`login failed ${response.status()} ${await response.text()}`);
  const auth = await response.json();
  await context.addInitScript(({ access, refresh }) => {
    localStorage.setItem('token', access);
    localStorage.setItem('refreshToken', refresh);
    localStorage.setItem('workrank:app-settings:v1', JSON.stringify({ appearance: { reduceMotion: false } }));
  }, { access: auth.accessToken, refresh: auth.refreshToken });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  return { context, page, token: auth.accessToken };
}

/**
 * Chỉ bắt từ tiếng Anh thật (ranh giới Unicode), không bắt các từ Việt không dấu
 * như "nhanh", "tranh", "sai" — những từ này là tiếng Việt hợp lệ.
 */
function englishWords(text) {
  const haystack = String(text);
  const found = [];
  for (const word of FORBIDDEN) {
    const pattern = new RegExp(`(?<![\\p{L}])${word}(?![\\p{L}])`, 'iu');
    if (pattern.test(haystack)) found.push(word.toUpperCase());
  }
  return [...new Set(found)];
}

async function scanEnglish(page, label) {
  const raw = await page.locator('main, .arcade-page, .studio-page').first().innerText().catch(() => '');
  // Thương hiệu "WORK RANK ARCADE" được phép giữ nguyên.
  const text = raw.replace(/WORK\s*RANK(\s*ARCADE)?/gi, ' ');
  const leftovers = englishWords(text);
  if (leftovers.length) {
    report.english.push({ page: label, words: leftovers });
    fail(`Không còn chữ Anh trên UI · ${label}`, leftovers.join(', '));
  } else {
    pass(`Không còn chữ Anh trên UI · ${label}`);
  }
}

async function overflowCheck(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`Không tràn ngang · ${label}`, `${overflow}px`);
  else pass(`Không tràn ngang · ${label}`);
}

function svgArt(colors, label) {
  const [a, b, c] = colors;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="350" viewBox="0 0 600 350">
    <rect width="600" height="350" fill="#fffdf6"/>
    <circle cx="470" cy="80" r="46" fill="${a}"/>
    <path d="M0 300 Q150 190 300 280 T600 240 V350 H0Z" fill="${b}"/>
    <path d="M80 250 q60 -90 120 0 q60 90 120 0" stroke="${c}" stroke-width="14" fill="none" stroke-linecap="round"/>
    <text x="40" y="70" font-family="sans-serif" font-size="30" font-weight="700" fill="${c}">${label}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const GALLERY_MOCK = [
  { id: 9901, title: 'Chiều ở xưởng', imageUrl: svgArt(['#f2c14e', '#a9c9a2', '#4a2c23'], 'Xưởng'), width: 1200, height: 700, visibility: 'PUBLIC', status: 'ACTIVE', likesCount: 12, createdAt: new Date(Date.now() - 3600e3).toISOString(), hasLiked: false, author: { id: 1, name: 'Lan Nguyễn', department: 'Media & Content', isVerified: true } },
  { id: 9902, title: 'Mèo và hũ màu', imageUrl: svgArt(['#e07a5f', '#7ba17f', '#8a4530'], 'Màu'), width: 1200, height: 700, visibility: 'PUBLIC', status: 'ACTIVE', likesCount: 8, createdAt: new Date(Date.now() - 7200e3).toISOString(), hasLiked: false, author: { id: 2, name: 'Minh Trần', department: 'Editor' } },
  { id: 9903, title: 'Sân phản xạ', imageUrl: svgArt(['#8e8ec9', '#cfd3ea', '#3f4470'], 'Phản xạ'), width: 1200, height: 700, visibility: 'PUBLIC', status: 'ACTIVE', likesCount: 5, createdAt: new Date(Date.now() - 10800e3).toISOString(), hasLiked: false, author: { id: 3, name: 'Hà Lê', department: 'Media & Content' } },
  { id: 9904, title: 'QA Xưởng Vẽ 2D', imageUrl: svgArt(['#f2c14e', '#a9c9a2', '#a2553f'], 'QA 2D'), width: 1200, height: 700, visibility: 'PUBLIC', status: 'ACTIVE', likesCount: 0, createdAt: new Date().toISOString(), hasLiked: false, author: { id: 4, name: 'QA Xưởng Vẽ', department: 'Media & Content' } },
];

const GAME_ROUTES = [
  { id: 'typing_battle', route: '/games/typing/passage', label: 'Đua Gõ Chữ' },
  { id: 'computer_rush', route: '/games/typing/words', label: 'Gõ Nhanh' },
  { id: 'direction_rush', route: '/games/arcade/direction_rush', label: 'Phản Xạ Bốn Hướng' },
  { id: 'memory_flash', route: '/games/arcade/memory_flash', label: 'Trí Nhớ Nhanh' },
  { id: 'drawing', route: '/games/drawing', label: 'Xưởng Vẽ' },
];

try {
  /* ── Desktop 1440 ── */
  const { context, page } = await login({ width: 1440, height: 1000 });

  await page.goto(`${web}/games`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await shot(page, '01-game-center-1440');
  await shot(page, '01b-game-center-1440-full', true);
  // Hàng thẻ thứ hai (Trí Nhớ Nhanh + Xưởng Vẽ) nằm dưới màn hình → cuộn khung app.
  await page.evaluate(() => document.querySelector('.app-main')?.scrollTo({ top: 430, behavior: 'instant' }));
  await page.waitForTimeout(400);
  await shot(page, '01c-game-center-1440-row2');
  await page.evaluate(() => document.querySelector('.app-main')?.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(200);
  await overflowCheck(page, 'Game Center 1440');
  await scanEnglish(page, 'Game Center');

  const nav = page.locator('.workrank-desktop-sidebar .workrank-nav-item');
  const navLabels = (await nav.allTextContents()).map((text) => text.trim());
  const expectedNav = ['Đua Gõ Chữ', 'Gõ Nhanh', 'Phản Xạ Bốn Hướng', 'Trí Nhớ Nhanh', 'Xưởng Vẽ'];
  const missing = expectedNav.filter((label) => !navLabels.includes(label));
  if (missing.length) fail('Đủ 5 game trong menu dọc', `thiếu: ${missing.join(', ')}`);
  else pass('Đủ 5 game trong menu dọc', expectedNav.join(' · '));

  const legacyNames = ['Typing Battle', 'Computer Rush', 'Direction Rush', 'Memory Flash', 'Góc Sáng Tạo'];
  const legacyInNav = navLabels.filter((label) => legacyNames.some((legacy) => label.includes(legacy)));
  if (legacyInNav.length) fail('Menu dọc không còn tên cũ', legacyInNav.join(', '));
  else pass('Menu dọc không còn tên cũ');

  const cardNames = (await page.locator('.gc-card-name').allTextContents()).map((text) => text.trim());
  const expectedCards = ['ĐUA GÕ CHỮ', 'GÕ NHANH', 'PHẢN XẠ BỐN HƯỚNG', 'TRÍ NHỚ NHANH', 'XƯỞNG VẼ'];
  if (expectedCards.every((name) => cardNames.includes(name))) pass('5 thẻ game đúng tên tiếng Việt', cardNames.join(' · '));
  else fail('5 thẻ game đúng tên tiếng Việt', cardNames.join(' · '));

  /* ── Từng game: active state + ảnh ── */
  for (const [index, game] of GAME_ROUTES.entries()) {
    await page.goto(`${web}${game.route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(game.id === 'drawing' ? 1500 : 900);

    const activeItem = page.locator('.workrank-desktop-sidebar .workrank-nav-item[aria-current="page"]');
    const activeText = (await activeItem.first().textContent().catch(() => '')) || '';
    const activeCount = await activeItem.count();
    if (activeText.includes(game.label) && activeCount === 1) pass(`Menu active đúng · ${game.label}`);
    else fail(`Menu active đúng · ${game.label}`, `${activeText.trim()} (${activeCount})`);

    await shot(page, `0${index + 2}-${game.id}-1440`);
    await scanEnglish(page, game.label);
    await overflowCheck(page, `${game.label} 1440`);
  }

  /* ── Xưởng Vẽ: trạng thái thật khi chưa có kho bền vững ── */
  await page.goto(`${web}/games/drawing`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  await page.locator('.studio-savebar:not([data-state="loading"])').waitFor({ timeout: 8000 }).catch(() => {});
  const unavailableNotice = await page.getByText('Hiện chưa thể đăng tranh lên hệ thống').isVisible().catch(() => false);
  if (unavailableNotice) pass('Thông báo chưa đăng được tranh hiển thị đúng (local không có S3)');
  else fail('Thông báo chưa đăng được tranh hiển thị đúng');

  const canvas = page.locator('.drawing-canvas');
  await canvas.waitFor();

  // Xóa tranh cũ để phép thử toạ độ sạch.
  await page.locator('.studio-actions button', { hasText: 'Xóa tranh' }).click();
  await page.locator('.ui-modal-dialog').getByRole('button', { name: 'Xóa tranh', exact: true }).click();
  await page.waitForTimeout(400);

  await page.getByRole('button', { name: 'Màu Đỏ son' }).click();
  await page.getByRole('button', { name: 'Lớn, 22 pixel' }).click();
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas không có bounding box');

  const chip = (await page.locator('.studio-active__text b').textContent()) || '';
  if (chip.includes('22px') && chip.includes('CỌ VẼ')) pass('Chip dụng cụ đang dùng rõ ràng', chip);
  else fail('Chip dụng cụ đang dùng rõ ràng', chip);

  const y = box.y + box.height * 0.35;
  await page.mouse.move(box.x + box.width * 0.25, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, y, { steps: 18 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  await shot(page, '07-drawing-drawn-1440');

  const pixel = await page.evaluate(({ xRatio, yRatio }) => {
    const ctx = document.querySelector('.drawing-canvas').getContext('2d', { willReadFrequently: true });
    const data = ctx.getImageData(Math.round(1200 * xRatio), Math.round(700 * yRatio), 1, 1).data;
    return { r: data[0], g: data[1], b: data[2], a: data[3] };
  }, { xRatio: 0.4, yRatio: 0.35 });

  const nearRed = Math.abs(pixel.r - 239) < 30 && Math.abs(pixel.g - 68) < 30 && Math.abs(pixel.b - 68) < 30 && pixel.a > 200;
  if (nearRed) pass('Toạ độ pointer → canvas chính xác (đỏ son đúng chỗ)', JSON.stringify(pixel));
  else fail('Toạ độ pointer → canvas chính xác', JSON.stringify(pixel));

  await page.getByRole('button', { name: 'Tẩy', exact: true }).click();
  await page.mouse.move(box.x + box.width * 0.25, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.32, y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const erased = await page.evaluate(({ xRatio, yRatio }) => {
    const ctx = document.querySelector('.drawing-canvas').getContext('2d', { willReadFrequently: true });
    return ctx.getImageData(Math.round(1200 * xRatio), Math.round(700 * yRatio), 1, 1).data[3];
  }, { xRatio: 0.28, yRatio: 0.35 });
  if (erased < 20) pass('Tẩy xóa đúng vùng', `alpha=${erased}`);
  else fail('Tẩy xóa đúng vùng', `alpha=${erased}`);

  await page.locator('.studio-actions button', { hasText: 'Hoàn tác' }).click();
  await page.waitForTimeout(250);
  const afterUndo = await page.evaluate(({ xRatio, yRatio }) => {
    const ctx = document.querySelector('.drawing-canvas').getContext('2d', { willReadFrequently: true });
    return ctx.getImageData(Math.round(1200 * xRatio), Math.round(700 * yRatio), 1, 1).data[3];
  }, { xRatio: 0.28, yRatio: 0.35 });
  if (afterUndo > 200) pass('Hoàn tác khôi phục nét', `alpha=${afterUndo}`);
  else fail('Hoàn tác khôi phục nét', `alpha=${afterUndo}`);

  await page.locator('.studio-actions button', { hasText: 'Làm lại' }).click();
  await page.waitForTimeout(250);
  const afterRedo = await page.evaluate(({ xRatio, yRatio }) => {
    const ctx = document.querySelector('.drawing-canvas').getContext('2d', { willReadFrequently: true });
    return ctx.getImageData(Math.round(1200 * xRatio), Math.round(700 * yRatio), 1, 1).data[3];
  }, { xRatio: 0.28, yRatio: 0.35 });
  if (afterRedo < 20) pass('Làm lại áp dụng lại thao tác', `alpha=${afterRedo}`);
  else fail('Làm lại áp dụng lại thao tác', `alpha=${afterRedo}`);

  await page.locator('.studio-save-now').click();
  await page.waitForTimeout(500);
  const toast = (await page.locator('.studio-toast').textContent().catch(() => '')) || '';
  if (toast.includes('Đã lưu bản nháp trên thiết bị')) pass('Lưu nháp báo đúng nơi lưu', toast.trim());
  else fail('Lưu nháp báo đúng nơi lưu', toast || 'không thấy toast');

  /* ── Đăng tranh: mock tầng storage (máy local không có S3) ── */
  const mockDrawing = {
    id: 999001,
    title: 'QA Xưởng Vẽ 2D',
    imageUrl: svgArt(['#f2c14e', '#a9c9a2', '#a2553f'], 'QA 2D'),
    width: 1200,
    height: 700,
    visibility: 'PUBLIC',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    author: { id: 4, name: 'QA Xưởng Vẽ' },
  };

  await page.route('**/api/drawings/settings', (route) => route.fulfill({
    json: { success: true, settings: { homeVisible: true, gameEnabled: true }, publishing: { available: true, persistent: true } },
  }));
  await page.route('**/api/drawings', (route) => {
    const request = route.request();
    if (request.method() === 'POST') return route.fulfill({ json: { success: true, drawing: mockDrawing } });
    return route.fulfill({ json: { success: true, drawings: GALLERY_MOCK, pagination: { total: GALLERY_MOCK.length } } });
  });
  await page.route('**/api/drawings/999001', (route) => route.fulfill({ json: { success: true, drawing: mockDrawing } }));
  await page.route('**/api/drawings?*', (route) => route.fulfill({
    json: { success: true, drawings: GALLERY_MOCK, pagination: { total: GALLERY_MOCK.length } },
  }));

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.locator('.studio-publish-btn').click();
  await page.waitForTimeout(400);
  await page.locator('#artwork-title').fill('QA Xưởng Vẽ 2D');
  await shot(page, '08-drawing-publish-modal-1440');
  await page.getByRole('button', { name: 'Đăng tranh lên Thư viện' }).click();
  await page.waitForTimeout(1200);
  const success = (await page.locator('.publish-success-title').textContent().catch(() => '')) || '';
  if (success.includes('Đã đăng tranh')) pass('Đăng tranh thành công', success.trim());
  else fail('Đăng tranh thành công', success || 'không thấy trạng thái thành công');
  await shot(page, '09-drawing-publish-success-1440');

  await page.getByRole('button', { name: 'Xem trong Thư viện' }).click();
  await page.waitForURL('**/creative-corner');
  await page.waitForTimeout(1200);
  await page.getByRole('tab', { name: 'Mới nhất' }).click();
  await page.waitForTimeout(900);
  await shot(page, '10-gallery-1440');
  await overflowCheck(page, 'Thư viện tranh 1440');

  const galleryTitle = await page.getByText('QA Xưởng Vẽ 2D').first().isVisible().catch(() => false);
  if (galleryTitle) pass('Tranh vừa đăng xuất hiện trong Thư viện (mock storage)');
  else fail('Tranh vừa đăng xuất hiện trong Thư viện');

  /* ── Desktop 1024 ── */
  await page.unroute('**/api/drawings');
  await page.unroute('**/api/drawings/999001');
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto(`${web}/games`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await shot(page, '11-game-center-1024');
  await overflowCheck(page, 'Game Center 1024');

  await page.goto(`${web}/games/drawing`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await shot(page, '12-drawing-1024');
  await overflowCheck(page, 'Xưởng Vẽ 1024');

  /* ── Mobile 430 ── */
  const mobile430 = await login({ width: 430, height: 900 });
  await mobile430.page.goto(`${web}/games`, { waitUntil: 'networkidle' });
  await mobile430.page.waitForTimeout(700);
  await shot(mobile430.page, '13-game-center-430');
  await overflowCheck(mobile430.page, 'Game Center 430');
  await scanEnglish(mobile430.page, 'Game Center 430');

  await mobile430.page.goto(`${web}/games/drawing`, { waitUntil: 'networkidle' });
  await mobile430.page.waitForTimeout(1400);
  await mobile430.page.locator('.studio-savebar:not([data-state="loading"])').waitFor({ timeout: 8000 }).catch(() => {});
  await shot(mobile430.page, '14-drawing-430');
  await overflowCheck(mobile430.page, 'Xưởng Vẽ 430');

  const mobileCanvas = mobile430.page.locator('.drawing-canvas');
  await mobile430.page.getByRole('button', { name: 'Màu Xanh biển' }).click();
  // Click swatch có thể cuộn trang → phải lấy box SAU khi chọn màu.
  await mobileCanvas.scrollIntoViewIfNeeded();
  await mobile430.page.waitForTimeout(250);
  const mobileBox = await mobileCanvas.boundingBox();
  if (mobileBox) {
    const my = mobileBox.y + mobileBox.height * 0.5;
    const fromX = mobileBox.x + mobileBox.width * 0.3;
    const toX = mobileBox.x + mobileBox.width * 0.6;
    await mobile430.page.mouse.move(fromX, my);
    await mobile430.page.mouse.down();
    await mobile430.page.mouse.move(toX, my, { steps: 14 });
    await mobile430.page.mouse.up();
    await mobile430.page.waitForTimeout(250);
    const midX = Math.round(((fromX + toX) / 2 - mobileBox.x) / mobileBox.width * 1200);
    const midY = Math.round((my - mobileBox.y) / mobileBox.height * 700);
    const mobilePixel = await mobile430.page.evaluate(({ x, y }) => {
      const ctx = document.querySelector('.drawing-canvas').getContext('2d', { willReadFrequently: true });
      const data = ctx.getImageData(x, y, 1, 1).data;
      return { r: data[0], g: data[1], b: data[2], a: data[3], x, y };
    }, { x: midX, y: midY });
    const nearBlue = Math.abs(mobilePixel.b - 246) < 40 && mobilePixel.a > 180;
    if (nearBlue) pass('Vẽ được trên mobile, toạ độ đúng', JSON.stringify(mobilePixel));
    else fail('Vẽ được trên mobile, toạ độ đúng', JSON.stringify(mobilePixel));
    await shot(mobile430.page, '15-drawing-430-drawn');
  } else {
    fail('Vẽ được trên mobile, toạ độ đúng', 'không có canvas box');
  }

  await mobile430.page.route('**/api/drawings?*', (route) => route.fulfill({
    json: { success: true, drawings: GALLERY_MOCK, pagination: { total: GALLERY_MOCK.length } },
  }));
  await mobile430.page.goto(`${web}/creative-corner`, { waitUntil: 'networkidle' });
  await mobile430.page.waitForTimeout(1200);
  await shot(mobile430.page, '16-gallery-430');
  await overflowCheck(mobile430.page, 'Thư viện tranh 430');

  /* ── Mobile 390 ── */
  const mobile390 = await login({ width: 390, height: 844 });
  await mobile390.page.goto(`${web}/games`, { waitUntil: 'networkidle' });
  await mobile390.page.waitForTimeout(600);
  await shot(mobile390.page, '17-game-center-390');
  await overflowCheck(mobile390.page, 'Game Center 390');

  await mobile390.page.goto(`${web}/games/drawing`, { waitUntil: 'networkidle' });
  await mobile390.page.waitForTimeout(1200);
  await shot(mobile390.page, '18-drawing-390');
  await overflowCheck(mobile390.page, 'Xưởng Vẽ 390');

  await mobile390.page.goto(`${web}/dashboard`, { waitUntil: 'networkidle' });
  await mobile390.page.locator('.mobile-menu-toggle').click();
  await mobile390.page.waitForTimeout(600);
  await shot(mobile390.page, '19-mobile-nav-drawer-390');

  await context.close();
  await mobile430.context.close();
  await mobile390.context.close();
} catch (error) {
  report.errors.push(error.stack || error.message);
  console.error('QA ERROR', error);
} finally {
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(out, 'qa-report.json'), JSON.stringify(report, null, 2));
  console.log(`\nChecks: ${report.checks.filter((c) => c.status === 'PASS').length} pass / ${report.checks.filter((c) => c.status === 'FAIL').length} fail`);
  console.log(`Page errors: ${report.errors.length}`);
  await browser.close();
  if (report.checks.some((c) => c.status === 'FAIL') || report.errors.length) process.exitCode = 1;
}
