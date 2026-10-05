import { expect, test } from '@playwright/test';

const avatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=';

for (const path of ['/', '/login']) {
  for (const hasAvatar of [true, false]) {
    test(`anonymous ${path} keeps public MVP ${hasAvatar ? 'avatar' : 'initials'} without requesting a private gallery`, async ({ page }, testInfo) => {
      const errors = [];
      let privateGalleryRequests = 0;
      page.on('pageerror', (error) => errors.push(error.message));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.route('**/api/users/4618/gallery', (route) => {
        privateGalleryRequests += 1;
        return route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
      });
      await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 401, json: { error: 'Unauthorized' } }));
      await page.route('**/api/competition/public/spotlight', (route) => route.fulfill({
        json: {
          hasSpotlight: true,
          season: { id: 7, name: 'Mùa công khai', startAt: '2026-01-01T00:00:00.000Z' },
          championTeam: null,
          mvp: { userId: 4618, name: 'Public MVP', score: 100, ...(hasAvatar ? { avatarUrl: avatar, galleryImages: [] } : {}) },
          archives: [],
          provenance: { resultState: 'official', champion: { state: 'none' }, mvp: { state: 'official' } },
        },
      }));

      await page.goto(path);
      await expect(page.getByText('Public MVP', { exact: true })).toBeVisible();
      const portrait = page.locator('.public-recognition-portrait.is-mvp');
      await portrait.scrollIntoViewIfNeeded();
      await expect(portrait).toBeVisible();
      if (hasAvatar) {
        await expect(portrait.locator('img')).toHaveAttribute('src', avatar);
        await expect.poll(() => portrait.locator('img').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
      } else {
        await expect(portrait.locator('.public-recognition-initials')).toHaveText('PM');
      }
      await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : '/login$'}`));
      expect(privateGalleryRequests).toBe(0);
      expect(await page.evaluate(() => sessionStorage.getItem('workrank_auth_message'))).toBeNull();
      await expect(page.getByText(/Phiên đăng nhập đã hết hạn/)).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (path === '/login') {
        await page.getByPlaceholder('Nhập email hoặc tên đăng nhập').fill('anonymous@example.test');
        await expect(page.getByRole('form', { name: 'Đăng nhập WorkRank' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Đăng Nhập Vào Hệ Thống' })).toBeEnabled();
      }
      expect(errors).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath('public-mvp.png'), fullPage: true, animations: 'disabled' });
    });
  }
}
