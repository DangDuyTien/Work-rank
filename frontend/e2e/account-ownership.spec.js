import { expect, test } from '@playwright/test';

const admin = {
  id: 1,
  name: 'Admin Test',
  email: 'admin@example.test',
  role: 'admin',
  status: 'active',
};

async function mockAccountApi(page) {
  const requests = [];
  let targetUser = {
    id: 999,
    name: 'Outside First Page',
    email: 'outside@example.test',
    role: 'manager',
    status: 'inactive',
    presence: 'online',
    jobTitle: 'Editor',
    department: 'Custom Studio',
    phone: '0900000000',
    bio: 'Existing introduction',
    avatarData: null,
  };
  await page.addInitScript(() => localStorage.setItem('token', 'account-ownership-test-token'));
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const body = method === 'PATCH' ? route.request().postDataJSON() : undefined;
    requests.push({ path: url.pathname, method, body });
    let json = { data: [] };
    if (url.pathname === '/api/auth/me') json = { user: admin };
    if (url.pathname === '/api/users') json = {
      data: [{ id: 2, name: 'First Page Member', email: 'first@example.test', status: 'active' }],
      pagination: { page: 1, total: 99, totalPages: 2 },
    };
    if (url.pathname === '/api/users/999') {
      if (method === 'PATCH') {
        if (!['admin', 'manager', 'user'].includes(body.role) || !['active', 'inactive'].includes(body.status)) {
          await route.fulfill({ status: 400, json: { message: 'Invalid account role or status' } });
          return;
        }
        targetUser = { ...targetUser, ...body };
      }
      json = { user: targetUser };
    }
    if (url.pathname.includes('/recognitions')) json = { badges: {}, awards: [] };
    if (url.pathname === '/api/games/catalog') json = {
      games: [{ gameKey: 'quiz', name: 'Quiz Test', status: 'AVAILABLE', description: 'Quiz' }],
    };
    await route.fulfill({ json });
  });
  return requests;
}

test('person management opens the requested account outside the first page and clears the URL on close', async ({ page }) => {
  const requests = await mockAccountApi(page);
  await page.goto('/admin/privileges?userId=999');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Chỉnh Sửa Hồ Sơ Nhân Sự #999' })).toBeVisible();
  await expect(dialog.locator('input[type=text]').first()).toHaveValue('Outside First Page');
  await expect(dialog.getByLabel('Phân Quyền Hệ Thống')).toHaveValue('manager');
  await expect(dialog.getByLabel('Trạng Thái Tài Khoản')).toHaveValue('inactive');
  await expect(dialog.getByLabel('Phòng Ban Trực Thuộc')).toHaveValue('Custom Studio');
  expect(requests.some(({ path }) => path === '/api/users/999')).toBe(true);
  expect(await dialog.evaluate((node) => node.parentElement === document.body)).toBe(true);
  await dialog.screenshot({ path: test.info().outputPath('person-editor.png') });

  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/admin\/privileges$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Nhân sự, Chức danh & Danh hiệu Vinh danh' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto('/admin/privileges?userId=999');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/admin\/privileges$/);
});

test('canonical person management saves another account contact, introduction and avatar', async ({ page }) => {
  const requests = await mockAccountApi(page);
  await page.goto('/admin/privileges?userId=999');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Chỉnh Sửa Hồ Sơ Nhân Sự #999' })).toBeVisible();
  await expect(dialog.getByLabel('Số điện thoại liên hệ')).toHaveValue('0900000000');
  await expect(dialog.getByLabel('Giới thiệu / Trách nhiệm chuyên môn')).toHaveValue('Existing introduction');
  await dialog.getByLabel('Số điện thoại liên hệ').fill(' 0912345678 ');
  await dialog.getByLabel('Giới thiệu / Trách nhiệm chuyên môn').fill(' Updated responsibilities ');
  await dialog.getByLabel('Chức Danh & Bậc Huy Hiệu').fill(' Producer & Operations ');
  await dialog.getByLabel('Phòng Ban Trực Thuộc').fill(' Growth Studio ');
  await dialog.getByLabel('Phân Quyền Hệ Thống').selectOption('user');
  await dialog.getByLabel('Phân Quyền Hệ Thống').selectOption('manager');
  const layout = await dialog.evaluate((node) => {
    const role = node.querySelector('#person-edit-role').getBoundingClientRect();
    const status = node.querySelector('#person-edit-status').getBoundingClientRect();
    return { roleX: role.x, roleY: role.y, statusX: status.x, statusY: status.y, dialogWidth: node.getBoundingClientRect().width };
  });
  if (layout.dialogWidth < 420) {
    expect(layout.statusX).toBe(layout.roleX);
    expect(layout.statusY).toBeGreaterThan(layout.roleY);
  } else {
    expect(layout.statusY).toBe(layout.roleY);
    expect(layout.statusX).toBeGreaterThan(layout.roleX);
  }
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;
    const context = canvas.getContext('2d');
    context.fillStyle = '#198754';
    context.fillRect(0, 0, 20, 20);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await dialog.getByLabel('Ảnh đại diện nhân sự').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(dialog.locator('img')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  await dialog.getByRole('button', { name: 'Lưu Thay Đổi', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const saved = requests.find(({ path, method }) => path === '/api/users/999' && method === 'PATCH');
  expect(saved.body).toMatchObject({ phone: '0912345678', bio: 'Updated responsibilities', jobTitle: 'Producer & Operations', department: 'Growth Studio', role: 'manager', status: 'inactive' });
  expect(saved.body.avatarData).toMatch(/^data:image\/jpeg;base64,/);
  expect(requests.some(({ path, method }) => path === '/api/users/1' && method === 'PATCH')).toBe(false);
  await expect(page).toHaveURL(/\/admin\/privileges$/);

  await page.goto('/admin/privileges?userId=999');
  await expect(dialog.getByLabel('Số điện thoại liên hệ')).toHaveValue('0912345678');
  await expect(dialog.getByLabel('Giới thiệu / Trách nhiệm chuyên môn')).toHaveValue('Updated responsibilities');
  await expect(dialog.getByLabel('Chức Danh & Bậc Huy Hiệu')).toHaveValue('Producer & Operations');
  await expect(dialog.getByLabel('Phòng Ban Trực Thuộc')).toHaveValue('Growth Studio');
  await expect(dialog.getByLabel('Phân Quyền Hệ Thống')).toHaveValue('manager');
  await expect(dialog.getByLabel('Trạng Thái Tài Khoản')).toHaveValue('inactive');
  await expect(dialog.locator('img')).toHaveAttribute('src', saved.body.avatarData);
  await dialog.screenshot({ path: test.info().outputPath('person-editor-contact-avatar.png') });
  await dialog.getByRole('button', { name: 'Xóa ảnh đại diện', exact: true }).click();
  await dialog.getByRole('button', { name: 'Lưu Thay Đổi', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const writes = requests.filter(({ path, method }) => path === '/api/users/999' && method === 'PATCH');
  expect(writes).toHaveLength(2);
  expect(writes[1].body.avatarData).toBeNull();
});

test('settings links reach the requested section after reload and keep staff management on its canonical page', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const requests = await mockAccountApi(page);
  await page.goto('/settings?tab=profile');
  await expect(page).toHaveURL(/tab=profile#settings-profile$/);
  await expect(page.getByRole('heading', { name: 'Thông tin cá nhân & Liên hệ' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Lưu thông tin cá nhân', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quản lý hồ sơ & phân quyền nhân sự', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Quản lý vinh danh', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Lưu Thay Đổi Chức Vụ & Huy Hiệu' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xác Nhận Trao Giải' })).toHaveCount(0);

  await page.goto('/settings?tab=games');
  await expect(page).toHaveURL(/tab=games#settings-games$/);
  await expect(page.getByRole('heading', { name: 'Quản Lý Trạng Thái Trò Chơi' })).toBeInViewport();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Quản Lý Trạng Thái Trò Chơi' })).toBeInViewport();
  await page.goBack();
  await expect(page).toHaveURL(/tab=profile#settings-profile$/);
  await expect(page.getByRole('heading', { name: 'Thông tin cá nhân & Liên hệ' })).toBeInViewport();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Thông tin cá nhân & Liên hệ' })).toBeInViewport();

  expect(requests.some(({ path }) => path === '/api/games/catalog')).toBe(true);
  expect(requests.some(({ path }) => path === '/api/users')).toBe(false);
  expect(requests.some(({ path }) => path.includes('/admin') && /award|mvp|champion/i.test(path))).toBe(false);
  expect(requests.filter(({ method }) => method !== 'GET')).toEqual([]);
});
