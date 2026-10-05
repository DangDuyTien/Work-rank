import { expect, test } from '@playwright/test';

const eventId = 'c0ffee00-0000-4000-8000-000000000041';
const event = { eventId, eventType: 'video_approved', sourceModule: 'production', actorId: 8, status: 'FAILED', occurredAt: '2026-10-01T12:00:00Z' };
const trace = {
  ...event, aggregateType: 'VIDEO', aggregateId: 101, actor: { id: 8, name: 'Member 8' }, team: { id: 2, name: 'Team 2' },
  processing: { status: 'FAILED', attemptCount: 2, lastError: 'Connection unavailable' },
  ruleEvaluation: { ruleVersion: { ruleSetName: 'Production', versionNumber: 3 }, totalEffects: 1, totalPointsAwarded: -5 },
  ledgerEntries: [{ id: 12, targetType: 'USER', targetId: 8, effectType: 'INDIVIDUAL_XP', pointsDelta: -5, reason: 'Điều chỉnh' }],
  payload: { videoId: 101, title: 'Approved video' }, projections: [{ id: 2, title: 'Video approval' }],
};

async function mockOperations(page, traceStatus = 200) {
  const retries = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('token', 'operations-test-token'));
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    let json = { data: [] };
    if (pathname === '/api/auth/me') json = { user: { id: 1, name: 'Admin', email: 'admin@example.test', role: 'admin' } };
    if (pathname === '/api/friends/requests') json = { incoming: [], outgoing: [] };
    if (pathname === '/api/chats/unread-counts') json = { data: {} };
    if (pathname === '/api/competition/admin/integration/health') json = { outbox: { failedCount: 1 } };
    if (pathname === '/api/youtube/admin/health') json = { status: 'HEALTHY' };
    if (pathname === '/api/competition/admin/projections/status') json = {};
    if (pathname === '/api/competition/admin/audit-logs') json = { logs: [] };
    if (pathname === '/api/competition/admin/integration/events') json = { events: [event], totalEvents: 1 };
    if (pathname === `/api/competition/events/${eventId}/trace`) {
      await route.fulfill({ status: traceStatus, json: traceStatus === 200 ? trace : { error: 'Không được xem truy vết' } });
      return;
    }
    if (pathname === `/api/competition/admin/events/${eventId}/retry`) {
      retries.push(request.postDataJSON());
      json = { success: true };
    }
    await route.fulfill({ json });
  });
  return { retries, errors };
}

test('operations preserves event trace and retries using the canonical event ID', async ({ page }, testInfo) => {
  const { retries, errors } = await mockOperations(page);
  await page.goto('/admin/operations?tab=events');
  await expect(page.getByRole('cell').getByText('video_approved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Truy vết sự kiện ${eventId}` }).click();
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Truy vết sự kiện', exact: true }) });
  await expect(dialog.getByText('Approved video', { exact: false })).toBeVisible();
  await expect(dialog.getByText('Production (v3)', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('row').filter({ hasText: 'Điều chỉnh' }).getByRole('cell').nth(2)).toHaveText('-5');
  expect(await dialog.evaluate((element) => !element.closest('.page-transition, .tab-transition'))).toBe(true);
  const geometry = await dialog.locator('.ui-modal-dialog').boundingBox();
  expect(geometry.y).toBeGreaterThanOrEqual(0);
  expect(geometry.y + geometry.height).toBeLessThanOrEqual(page.viewportSize().height);
  await page.screenshot({ path: testInfo.outputPath('event-trace.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();

  await page.getByRole('button', { name: 'Thử lại (Retry)', exact: true }).click();
  await expect(page.getByText(`(ID: #${eventId})`, { exact: false })).toBeVisible();
  await page.getByPlaceholder('Ghi rõ lý do thử lại (ví dụ: đã sửa lỗi kết nối YouTube API)...').fill('Đã khôi phục kết nối');
  await page.getByRole('button', { name: 'Xác Nhận Thử Lại', exact: true }).click();
  await expect.poll(() => retries.length).toBe(1);
  expect(retries[0]).toEqual({ reason: 'Đã khôi phục kết nối' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('operations trace error stays in the dialog and allows dismissal', async ({ page }) => {
  const { errors } = await mockOperations(page, 403);
  await page.goto('/admin/operations?tab=events');
  await page.getByRole('button', { name: `Truy vết sự kiện ${eventId}` }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toContainText('Không được xem truy vết');
  await expect(page).toHaveURL(/\/admin\/operations\?tab=events$/);
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(errors).toEqual([]);
});
