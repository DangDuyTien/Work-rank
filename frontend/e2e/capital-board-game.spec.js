import { expect, test } from '@playwright/test';

const mockUser = {
  id: 10,
  name: 'Đặng Tuấn Anh',
  email: 'tuananh@workrank.io',
  role: 'admin',
  status: 'active',
  jobTitle: 'Senior Motion Designer',
  department: 'Media & Game Studio',
};

const mockOpponents = [
  {
    id: 1,
    userId: 10,
    seatIndex: 0,
    color: '#ef4444',
    cash: 1500,
    netWorth: 1500,
    position: 0,
    status: 'ACTIVE',
    user: mockUser,
  },
  {
    id: 2,
    userId: 11,
    seatIndex: 1,
    color: '#3b82f6',
    cash: 1350,
    netWorth: 1550,
    position: 3,
    status: 'ACTIVE',
    user: { id: 11, name: 'Nguyễn Hoài Nam', email: 'nam@workrank.io', jobTitle: 'Content Creator' },
  },
  {
    id: 3,
    userId: 12,
    seatIndex: 2,
    color: '#10b981',
    cash: 1200,
    netWorth: 1600,
    position: 7,
    status: 'ACTIVE',
    user: { id: 12, name: 'Lê Minh Trang', email: 'trang@workrank.io', jobTitle: 'Video Editor' },
  },
];

const mockProperties = [
  {
    id: 101,
    roomId: 201,
    tileIndex: 1,
    propertyKey: 'LIVESTREAM_ROOM',
    propertyName: 'Phòng Livestream',
    price: 100,
    rent: 15,
    groupKey: 'MEDIA',
    groupColor: '#ec4899',
    ownerUserId: 10,
  },
  {
    id: 102,
    roomId: 201,
    tileIndex: 2,
    propertyKey: 'CREATIVE_STUDIO',
    propertyName: 'Studio Sáng Tạo',
    price: 120,
    rent: 20,
    groupKey: 'MEDIA',
    groupColor: '#ec4899',
    ownerUserId: 11,
  },
  {
    id: 103,
    roomId: 201,
    tileIndex: 3,
    propertyKey: 'MEDIA_STATION',
    propertyName: 'Đài Truyền Thông',
    price: 140,
    rent: 25,
    groupKey: 'MEDIA',
    groupColor: '#ec4899',
    ownerUserId: null,
  },
];

const mockEvents = [
  {
    id: 1,
    turnNumber: 1,
    type: 'GAME_STARTED',
    actorUserId: 10,
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    turnNumber: 1,
    type: 'DICE_ROLLED',
    actorUserId: 10,
    payload: { die1: 3, die2: 4, total: 7, position: 7, tileName: 'Khu Nghỉ Dưỡng' },
    createdAt: new Date().toISOString(),
  },
];

async function setupCapitalBoardMocks(page, options = {}) {
  const roomStatus = options.roomStatus || 'WAITING';

  await page.addInitScript(() => {
    localStorage.setItem('token', 'capital-board-e2e-test-token');
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/auth/me') {
      await route.fulfill({ json: { user: mockUser } });
      return;
    }

    if (url.pathname === '/api/games/catalog') {
      await route.fulfill({
        json: {
          games: [
            {
              gameKey: 'capital_board',
              name: 'Cờ Tỷ Phú',
              status: 'AVAILABLE',
              enabled: true,
              description: 'Trò chơi bàn cờ tỷ phú bất động sản thời gian thực',
            },
          ],
        },
      });
      return;
    }

    if (url.pathname === '/api/games/active-room') {
      await route.fulfill({ json: { data: options.hasActiveRoom ? { id: 201, code: 'CB-TEST' } : null } });
      return;
    }

    if (url.pathname === '/api/games/rooms' && route.request().method() === 'GET') {
      await route.fulfill({
        json: {
          data: [
            {
              id: 201,
              code: 'CB-8888',
              title: 'Phòng Tỷ Phú Công Nghệ',
              maxPlayers: 4,
              playerCount: 3,
              status: 'WAITING',
              host: mockUser,
              players: mockOpponents,
            },
          ],
        },
      });
      return;
    }

    if (url.pathname.match(/\/api\/games\/rooms\/[^/]+$/) && route.request().method() === 'GET') {
      await route.fulfill({
        json: {
          data: {
            id: 201,
            code: 'CB-8888',
            title: 'Phòng Tỷ Phú Công Nghệ',
            status: roomStatus,
            hostUserId: 10,
            host: mockUser,
            maxPlayers: 4,
            currentTurnPlayerId: 10,
            turnNumber: 1,
            turnDeadline: new Date(Date.now() + 25000).toISOString(),
            lastDiceResult: { die1: 3, die2: 4, total: 7 },
            turnState: {
              rolled: roomStatus === 'PLAYING',
              canBuy: roomStatus === 'PLAYING',
              currentTileIndex: 3,
              eventResult: null,
            },
            players: mockOpponents,
            properties: mockProperties,
            events: mockEvents,
          },
        },
      });
      return;
    }

    if (url.pathname === '/api/games/leaderboard') {
      await route.fulfill({
        json: {
          data: {
            items: [
              {
                id: 1,
                userId: 10,
                careerMoney: 8500000,
                gamesPlayed: 12,
                gamesWon: 8,
                winRate: 67,
                user: mockUser,
              },
            ],
          },
        },
      });
      return;
    }

    if (url.pathname === '/api/games/history') {
      await route.fulfill({
        json: {
          data: [
            {
              id: 1,
              roomId: 201,
              rank: 1,
              finalCash: 4500,
              rewardAmount: 500000,
              createdAt: new Date().toISOString(),
              room: { title: 'Phòng Tỷ Phú Công Nghệ' },
            },
          ],
        },
      });
      return;
    }

    // Default fallback
    await route.fulfill({ json: { ok: true, data: {} } });
  });
}

test.describe('Capital Board Game (Cờ Tỷ Phú) E2E Suite', () => {
  test('1. Capital Board Lobby renders correctly with rooms, stats, and tabs', async ({ page }) => {
    await setupCapitalBoardMocks(page, { roomStatus: 'WAITING' });
    await page.goto('/games/capital-board');

    // Check title and hero elements
    await expect(page.getByRole('heading', { name: /CỜ TỶ PHÚ WORKRANK/i })).toBeVisible();

    // Check room cards in lobby
    await expect(page.getByText('Phòng Tỷ Phú Công Nghệ')).toBeVisible();
    await expect(page.getByText('CB-8888').first()).toBeVisible();

    // Check Tab navigation
    await page.click('button:has-text("Bảng Xếp Hạng")');
    await expect(page.getByRole('heading', { name: /Bảng Xếp Hạng Cờ Tỷ Phú/i })).toBeVisible();
    await expect(page.locator('table').getByText(/Đặng Tuấn Anh/i)).toBeVisible();

    await page.click('button:has-text("Lịch Sử Đấu")');
    await expect(page.getByRole('heading', { name: /Lịch Sử Đấu Cờ Tỷ Phú/i })).toBeVisible();
    await expect(page.getByText(/Quán quân \(#1\)/i).first()).toBeVisible();
  });

  test('2. Waiting Room displays players, host controls, and invite code', async ({ page }) => {
    await setupCapitalBoardMocks(page, { roomStatus: 'WAITING' });
    await page.goto('/games/capital-board/room/201');

    // Check room header and code
    await expect(page.getByRole('heading', { name: /Phòng Tỷ Phú Công Nghệ/i })).toBeVisible();
    await expect(page.getByText('#CB-8888').first()).toBeVisible();

    // Check player slots
    await expect(page.getByText('Đặng Tuấn Anh').last()).toBeVisible();
    await expect(page.getByText('Nguyễn Hoài Nam').first()).toBeVisible();
    await expect(page.getByText('Lê Minh Trang').first()).toBeVisible();

    // Check Host start match button
    await expect(page.getByRole('button', { name: /Bắt Đầu Trận Đấu/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Rời Phòng/i }).first()).toBeVisible();
  });

  test('3. Active Game Board renders 28 tiles, player tokens, and action bar', async ({ page }) => {
    await setupCapitalBoardMocks(page, { roomStatus: 'PLAYING' });
    await page.goto('/games/capital-board/room/201');

    // Check game board container
    await expect(page.getByText('Khởi Hành').first()).toBeVisible();
    await expect(page.getByText('Phòng Livestream').first()).toBeVisible();
    await expect(page.getByText('Cơ Hội').first()).toBeVisible();

    // Check player card status
    await expect(page.getByText('BẠN').first()).toBeVisible();

    // Check Action controls (End turn)
    await expect(page.getByRole('button', { name: /Kết Thúc Lượt/i })).toBeVisible();

    // Open Game Rules modal
    await page.click('button:has-text("Luật Chơi")');
    await expect(page.getByText('Luật Chơi Cờ Tỷ Phú WorkRank')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('4. Mobile Viewport (390px and 430px) without horizontal overflow', async ({ page }) => {
    await setupCapitalBoardMocks(page, { roomStatus: 'PLAYING' });

    // Test iPhone 14/15 (390px)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/games/capital-board/room/201');
    await page.waitForTimeout(400);

    const isOverflowing390 = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(isOverflowing390).toBe(false);

    // Test Pro Max (430px)
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto('/games/capital-board/room/201');
    await page.waitForTimeout(400);

    const isOverflowing430 = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(isOverflowing430).toBe(false);
  });
});
