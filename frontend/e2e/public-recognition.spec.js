import { expect, test } from '@playwright/test';

test('MVP waits until its portrait enters the viewport', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto('/');
  await expect(page.getByText('Đang tải ghi nhận mùa giải…', { exact: true })).toHaveCount(0);
  const mvp = page.locator('.public-archive-section').nth(1).locator('.public-featured-frame');
  await expect(mvp).toHaveClass(/is-pending/);
  await expect(mvp.locator('.public-recognition-portrait')).toHaveCSS('opacity', '0');
  await page.evaluate(() => document.querySelectorAll('.public-archive-section')[1]?.scrollIntoView({ block: 'start' }));
  const visibleMvp = page.locator('.public-archive-section').nth(1).locator('.public-featured-frame');
  await expect(visibleMvp).toHaveClass(/is-ready/);
  await expect(visibleMvp.locator('.public-recognition-portrait')).toHaveCSS('opacity', '1');
});

test('portrait stays hidden while quotation marks open, then appears', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    window.publicQuoteStartOpacities = [];
    document.addEventListener('animationstart', (event) => {
      if (!event.animationName.startsWith('publicQuoteOpen')) return;
      const portrait = event.target.parentElement.querySelector('.public-recognition-portrait');
      window.publicQuoteStartOpacities.push(getComputedStyle(portrait).opacity);
    });
  });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.publicQuoteStartOpacities.length)).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => window.publicQuoteStartOpacities.every((opacity) => opacity === '0'))).toBe(true);
  const frame = page.locator('.public-featured-frame.is-ready').first();
  await expect(frame.locator('.public-recognition-portrait')).toHaveCSS('opacity', '1');
  const geometry = await frame.evaluate((element) => {
    const left = element.querySelector('.is-opening').getBoundingClientRect();
    const right = element.querySelector('.is-closing').getBoundingClientRect();
    const portrait = element.querySelector('.public-recognition-portrait').getBoundingClientRect();
    return { leftClear: left.right <= portrait.left + 1, rightClear: right.left >= portrait.right - 1, ratio: left.width / left.height };
  });
  expect(geometry.leftClear).toBe(true);
  expect(geometry.rightClear).toBe(true);
  expect(geometry.ratio).toBeCloseTo(100 / 175, 2);
});

test('reduced motion shows the portrait and open marks immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const frame = page.locator('.public-featured-frame.is-ready').first();
  await expect(frame.locator('.public-recognition-portrait')).toHaveCSS('opacity', '1');
  await expect(frame.locator('.is-opening')).toHaveCSS('transform', 'none');
  await expect(frame.locator('.is-closing')).toHaveCSS('transform', 'none');
});

test('team members and MVP score use separate minimal rows', async ({ page }) => {
  const responsePromise = page.waitForResponse((response) => response.url().includes('/api/competition/public/spotlight'));
  await page.goto('/');
  const response = await responsePromise;
  if (!response.ok()) {
    await expect(page.getByRole('alert')).toContainText('Chưa tải được ghi nhận');
    return;
  }
  test.skip(!response.headers()['content-type']?.includes('application/json'), 'Real spotlight API requires the backend or E2E_BASE_URL pointing at the dev server.');
  const data = await response.json();
  await expect(page.locator('.public-archive-section')).toHaveCount(2);
  for (const [type, record, label] of [['champion', data.championTeam, 'Đội nhóm'], ['mvp', data.mvp, 'Cá nhân']]) {
    const section = page.locator('.public-archive-section').filter({ has: page.getByRole('heading', { level: 2, name: new RegExp(label) }) });
    await expect(section.getByRole('figure')).toHaveCount(1);
    if (!record) {
      await expect(section).toContainText('Chưa có ghi nhận được công bố.');
      await expect(section.locator('details')).toHaveCount(0);
      continue;
    }
    const name = type === 'mvp' ? record.name : record.teamName;
    const link = section.locator('.public-archive-name');
    await expect(link).toContainText(name);
    await expect(link).toHaveAttribute('href', type === 'mvp' ? `/users/${record.userId}` : new RegExp(`seasonId=${data.season.id}(?:&|$)`));
    const state = data.provenance?.[type]?.state;
    const status = state === 'official' ? (type === 'mvp' ? 'MVP đã xác nhận' : 'Kết quả đã chốt') : state === 'projected' ? (type === 'mvp' ? 'Ứng viên · chưa xác nhận' : 'Đang dẫn đầu · chưa chốt') : 'Chưa có ghi nhận';
    await expect(section).toContainText(status);
    await expect(section.locator('details, summary')).toHaveCount(0);
    if (type === 'mvp') {
      await expect(section.locator('.public-archive-inline-score strong')).toHaveText(Number(record.score).toLocaleString('vi-VN'));
    } else {
      await expect(section.getByText('Điểm mùa giải', { exact: true })).toHaveCount(0);
      const members = (record.members || []).filter((member) => member.name);
      const list = section.getByRole('list', { name: 'Thành viên đội nhóm' });
      if (members.length) {
        await expect(list.getByRole('listitem')).toHaveCount(members.length);
        for (const member of members) await expect(list).toContainText(member.name);
      } else await expect(list).toContainText('Chưa có danh sách thành viên được công bố.');
    }
  }
});

test('spotlight network failure allows retry and leaves auth usable', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/competition/public/spotlight', (route) => {
    requests += 1;
    return route.abort('failed');
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Chưa tải được ghi nhận');
  const beforeRetry = requests;
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect.poll(() => requests).toBeGreaterThan(beforeRetry);
  await page.getByRole('link', { name: 'Đăng nhập', exact: true }).first().click();
  await expect(page.getByRole('form', { name: 'Đăng nhập WorkRank' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Chưa tải được ghi nhận');
  await expect(page.getByRole('button', { name: 'Đăng Nhập Vào Hệ Thống' })).toBeEnabled();
});

test('register switching and password visibility preserve the form and URL', async ({ page }) => {
  await page.goto('/login?mode=register');
  await expect(page.getByLabel('Họ và tên')).toBeVisible();
  await page.getByLabel('Mật khẩu *', { exact: true }).fill('local-visibility-check');
  await page.getByRole('button', { name: 'Hiện mật khẩu', exact: true }).click();
  await expect(page.getByLabel('Mật khẩu *', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ẩn mật khẩu', exact: true }).click();
  await expect(page.getByLabel('Mật khẩu *', { exact: true })).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('form', { name: 'Đăng nhập WorkRank' })).toBeVisible();
  await expect(page.getByLabel('Họ và tên')).toHaveCount(0);
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  await expect(page).toHaveURL(/mode=register/);
  await expect(page.getByLabel('Xác nhận mật khẩu')).toBeVisible();
});

test('password help traps keyboard focus and Escape returns focus to its trigger', async ({ page }) => {
  await page.goto('/login');
  const trigger = page.getByRole('button', { name: 'Quên mật khẩu?' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Hướng Dẫn Cấp Lại Mật Khẩu' });
  const close = dialog.getByRole('button', { name: 'Đóng hướng dẫn cấp lại mật khẩu' });
  const done = dialog.getByRole('button', { name: 'Đã hiểu & Đóng' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(done).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('public pages render without horizontal overflow or runtime errors', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [name, path] of [['home', '/'], ['login', '/login'], ['register', '/login?mode=register']]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Đang tải ghi nhận mùa giải…', { exact: true })).toHaveCount(0);
    await expect(page.locator('.public-recognition-portrait canvas')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (name !== 'home') await expect(page.getByRole('button', { name: name === 'login' ? 'Đăng Nhập Vào Hệ Thống' : 'Tạo Tài Khoản Mới' })).toBeInViewport();
    const screenshot = testInfo.outputPath(`${name}.png`);
    await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' });
    await testInfo.attach(name, { path: screenshot, contentType: 'image/png' });
  }
  expect(errors).toEqual([]);
});

test('public pages also fit tablet and narrow phone widths', async ({ page }) => {
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/login', '/login?mode=register']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('Đang tải ghi nhận mùa giải…', { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  }
});
