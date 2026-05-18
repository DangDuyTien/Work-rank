import { expect, test } from '@playwright/test';

test('home page renders primary entry points', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /WorkRank/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /WorkRank/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Đăng nhập|Vào Dashboard/i }).first()).toBeVisible();
});

test('login page renders form without blank screen', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('form').getByRole('button', { name: /^Đăng nhập$/i })).toBeVisible();
  await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
});

test('protected route redirects anonymous user to login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('form').getByRole('button', { name: /^Đăng nhập$/i })).toBeVisible();
});
