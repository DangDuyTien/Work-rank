import { expect, test } from '@playwright/test';

test('historical archives select accounts and preserve selections when editing', async ({ page }) => {
  let saved;
  await page.addInitScript(() => localStorage.setItem('token', 'archive-test-token'));
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    let json = { data: [] };
    if (url.pathname === '/api/auth/me') json = { user: { id: 1, name: 'Admin', role: 'admin', status: 'active' } };
    if (url.pathname === '/api/users') json = {
      data: [{ id: url.searchParams.get('page') === '2' ? 12 : 11,
        name: url.searchParams.get('page') === '2' ? 'Member Two' : 'Member One', jobTitle: 'Editor' }],
      pagination: { totalPages: 2 },
    };
    if (url.pathname === '/api/competition/admin/spotlight') json = {};
    if (url.pathname === '/api/competition/admin/spotlight/archives') {
      if (route.request().method() === 'POST') {
        saved = route.request().postDataJSON();
        json = { entry: saved };
      } else json = { archives: saved ? [saved] : [] };
    }
    await route.fulfill({ json });
  });
  await page.goto('/admin/competition/seasons');
  await page.getByRole('button', { name: /Vinh Danh Trang Chủ/i }).click();
  await page.getByRole('button', { name: 'Thêm Năm Mới', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Ví dụ: Team Sáng Tạo 2025').fill('Historical team');
  await dialog.getByRole('checkbox', { name: 'Member One · #11' }).check();
  await dialog.getByRole('checkbox', { name: 'Member Two · #12' }).check();
  await dialog.getByLabel('Cá nhân MVP *', { exact: true }).selectOption('12');
  await dialog.screenshot({ path: `/tmp/workrank-archive-${test.info().project.name}.png` });
  await dialog.getByRole('button', { name: 'Lưu Vinh Danh', exact: true }).click();
  await expect.poll(() => saved).toBeTruthy();
  expect(saved.championTeam.members).toEqual([{ userId: 11 }, { userId: 12 }]);
  expect(saved.mvp.userId).toBe(12);
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Sửa', exact: true }).click();
  await expect(dialog.getByRole('checkbox', { name: 'Member One · #11' })).toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: 'Member Two · #12' })).toBeChecked();
  await expect(dialog.getByLabel('Cá nhân MVP *', { exact: true })).toHaveValue('12');
});
