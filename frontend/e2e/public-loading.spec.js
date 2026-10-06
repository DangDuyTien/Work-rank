import { expect, test } from '@playwright/test';

test('spotlight loads independently and is reused between home and login', async ({ page }) => {
  let spotlightRequests = 0;
  let releaseWeekly;
  const weeklyGate = new Promise((resolve) => { releaseWeekly = resolve; });
  await page.route('**/api/competition/public/spotlight', (route) => {
    spotlightRequests += 1;
    return route.fulfill({ json: {
      season: { id: 1, name: 'Mùa kiểm tra tải dữ liệu', startAt: '2026-01-01' },
      championTeam: { teamName: 'Đội kiểm tra', members: [] },
      archives: [],
    } });
  });
  await page.route('**/api/leaderboard/public/weekly', async (route) => {
    await weeklyGate;
    await route.fulfill({ json: { items: [] } });
  });
  await page.route('**/api/youtube/public/leaderboard', (route) => route.fulfill({ json: { items: [] } }));
  try {
    await page.goto('/');
    await expect(page.locator('#season-recognition')).toContainText('Đội kiểm tra'.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/Đ/g, 'D'));
    await expect(page.getByText('Đang tải bảng xếp hạng…', { exact: true })).toBeAttached();
  } finally {
    releaseWeekly();
  }
  await page.locator('.public-entry-button').click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('.public-auth-recognition')).toContainText('Mùa kiểm tra tải dữ liệu');
  await page.goBack();
  await expect(page.locator('#season-recognition')).toContainText('Mùa kiểm tra tải dữ liệu');
  expect(spotlightRequests).toBe(1);
});
