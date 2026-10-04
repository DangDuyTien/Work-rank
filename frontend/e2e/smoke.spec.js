import { expect, test } from '@playwright/test';

test('home page renders primary entry points', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /WorkRank/i })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /Đăng nhập|Vào Dashboard/i }).first()).toBeVisible();
  const header = page.locator('.public-editorial-header');
  await expect(header.locator('nav')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect.poll(async () => (await header.boundingBox())?.y).toBe(0);
  await expect(header.getByRole('link', { name: /Đăng nhập|Vào Dashboard/i })).toBeInViewport();
});

test('login page renders form without blank screen', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /Đăng Nhập Vào Hệ Thống/i })).toBeVisible();
  await expect(page.getByPlaceholder('Nhập email hoặc tên đăng nhập')).toBeVisible();
});

test('protected route redirects anonymous user to login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: /Đăng Nhập Vào Hệ Thống/i })).toBeVisible();
});
