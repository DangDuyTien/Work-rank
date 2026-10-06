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
    userId: 10,
    seatIndex: 0,
    isHost: true,
    isReady: false,
    remainingCardsCount: 10,
    user: mockUser,
  },
  {
    userId: 11,
    seatIndex: 1,
    isHost: false,
    isReady: true,
    remainingCardsCount: 8,
    isBaoMot: false,
    user: { id: 11, name: 'Nguyễn Hoài Nam', jobTitle: 'Content Creator' },
  },
  {
    userId: 12,
    seatIndex: 2,
    isHost: false,
    isReady: true,
    remainingCardsCount: 1,
    isBaoMot: true,
    user: { id: 12, name: 'Lê Minh Trang', jobTitle: 'Video Editor' },
  },
  {
    userId: 13,
    seatIndex: 3,
    isHost: false,
    isReady: true,
    remainingCardsCount: 6,
    isBot: true,
    botName: 'AI Alpha (Hard)',
  },
];

async function setupSamGameMocks(page, options = {}) {
  const roomStatus = options.roomStatus || 'WAITING';
  const isPlaying = roomStatus === 'PLAYING';

  page.on('console', (msg) => console.log('BROWSER LOG:', msg.text()));

  await page.addInitScript(() => {
    localStorage.setItem('token', 'sam-e2e-test-token');
    window.__WR_E2E_TEST__ = true;

    // Setup Mock Socket on window.__WR_SOCKET_MOCK__ as test seam
    const listeners = {};
    window.__WR_SOCKET_MOCK__ = {
      connected: true,
      auth: { token: 'sam-e2e-test-token' },
      listeners,
      on: (event, callback) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
        console.log('[MOCK_SOCKET] Registered listener on: ' + event + ', total: ' + listeners[event].length);
      },
      off: (event, callback) => {
        if (!listeners[event]) return;
        listeners[event] = listeners[event].filter((cb) => cb !== callback);
        console.log('[MOCK_SOCKET] Removed listener on: ' + event + ', remaining: ' + listeners[event].length);
      },
      emit: (event, data) => {
        console.log('[MOCK_SOCKET] Emitted event: ' + event, data);
        if (!window.__WR_SOCKET_EMITS__) window.__WR_SOCKET_EMITS__ = [];
        window.__WR_SOCKET_EMITS__.push({ event, data });
      },
      trigger: (event, data) => {
        console.log('[MOCK_SOCKET] Triggering event: ' + event, data, 'count: ' + ((listeners[event] || []).length));
        if (listeners[event]) {
          listeners[event].forEach((cb) => cb(data));
        }
      },
    };
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
              gameKey: 'sam',
              name: 'Đánh Sâm Lốc',
              status: 'AVAILABLE',
              description: 'Trò chơi bài dân gian 2–4 người',
            },
          ],
        },
      });
      return;
    }

    if (url.pathname === '/api/games/sam/rooms/active') {
      await route.fulfill({ json: { room: null } });
      return;
    }

    if (url.pathname === '/api/games/sam/rooms') {
      await route.fulfill({
        json: [
          {
            id: 101,
            code: 'SAM-3W88',
            title: 'Phòng Sâm 3Win Media Pro',
            maxPlayers: 4,
            playerCount: 3,
            spectatorCount: 2,
            status: 'WAITING',
            host: mockUser,
          },
          {
            id: 102,
            code: 'SAM-9999',
            title: 'Kỳ Phùng Địch Thủ (Chung Kết)',
            maxPlayers: 4,
            playerCount: 4,
            spectatorCount: 5,
            status: 'PLAYING',
            host: { name: 'Trần Văn Hoàng' },
          },
        ],
      });
      return;
    }

    if (url.pathname.includes('/ready')) {
      await route.fulfill({
        json: {
          success: true,
          players: mockOpponents.map((p) =>
            p.userId === 10 ? { ...p, isReady: true } : p
          ),
          room: {
            id: 101,
            code: 'SAM-3W88',
            title: 'Phòng Sâm 3Win Media Pro',
            maxPlayers: 4,
            status: 'WAITING',
          },
        },
      });
      return;
    }

    if (url.pathname.includes('/leave')) {
      await route.fulfill({
        json: { success: true },
      });
      return;
    }

    if (url.pathname.includes('/play')) {
      await route.fulfill({
        json: {
          success: true,
          room: {
            id: 101,
            code: 'SAM-3W88',
            title: 'Phòng Sâm 3Win Media Pro',
            status: 'PLAYING',
            currentTurnUserId: 11,
            currentTurnSeat: 1,
            lastPlayedCards: {
              userId: 10,
              name: 'Đôi 8',
              cards: ['8S', '8D'],
            },
          },
          players: mockOpponents,
          myHandCards: ['3S', '4C', '5D', '6H', '7S', '9D', 'JS', 'QS'],
        },
      });
      return;
    }

    if (url.pathname.includes('/api/games/sam/rooms/')) {
      await route.fulfill({
        json: {
          room: {
            id: 101,
            code: 'SAM-3W88',
            title: 'Phòng Sâm 3Win Media Pro',
            maxPlayers: 4,
            status: roomStatus,
            samPhase: isPlaying ? 'PLAYING' : 'SAM_DECLARING',
            hostUserId: 10,
            currentTurnUserId: 10,
            currentTurnSeat: 0,
            roundNumber: 2,
            isTest: true,
            turnDeadline: new Date(Date.now() + 22000).toISOString(),
            lastPlayedCards: isPlaying
              ? {
                  userId: 11,
                  name: 'Đôi 7',
                  cards: ['7S', '7D'],
                }
              : null,
            passPlayerIds: [13],
          },
          players: mockOpponents,
          myHandCards: ['3S', '4C', '5D', '6H', '8S', '8D', '9D', 'JS', 'QS', '2H'],
          isSpectator: false,
          spectatorCount: 2,
        },
      });
      return;
    }

    if (url.pathname === '/api/games/sam/leaderboard') {
      await route.fulfill({
        json: {
          data: [
            {
              userId: 10,
              rank: 1,
              gamesPlayed: 28,
              gamesWon: 20,
              winRate: 71,
              totalPoints: 420,
              user: mockUser,
            },
            {
              userId: 12,
              rank: 2,
              gamesPlayed: 22,
              gamesWon: 14,
              winRate: 64,
              totalPoints: 280,
              user: { name: 'Lê Minh Trang', jobTitle: 'Video Editor' },
            },
          ],
        },
      });
      return;
    }

    if (url.pathname === '/api/games/sam/my-stats') {
      await route.fulfill({
        json: {
          totalPoints: 420,
          gamesPlayed: 28,
          gamesWon: 20,
          winRate: 71,
          maxWinStreak: 6,
        },
      });
      return;
    }

    if (url.pathname === '/api/games/sam/admin/bot-rooms') {
      await route.fulfill({ json: [] });
      return;
    }

    if (url.pathname.includes('/recognitions')) {
      await route.fulfill({ json: { badges: {}, awards: [] } });
      return;
    }

    await route.fulfill({ json: { data: [] } });
  });
}

test.describe('Sam Lốc Game UI & Motion Audit', () => {
  test('1. Lobby: renders stats, rooms, and switches tabs smoothly', async ({ page }) => {
    await setupSamGameMocks(page);
    await page.goto('/games/sam');

    // Header & Titles
    await expect(page.getByRole('heading', { level: 1, name: /Đánh Sâm Lốc/i })).toBeVisible();
    await expect(page.getByText('Tổng Điểm Sâm')).toBeVisible();
    await expect(page.getByText('420')).toBeVisible();

    // Tab 1: Lobby list
    await expect(page.getByText('Phòng Sâm 3Win Media Pro')).toBeVisible();

    // Tab 2: Leaderboard
    await page.getByRole('button', { name: 'Bảng Xếp Hạng' }).click();
    await expect(page.getByText('Đặng Tuấn Anh (Bạn)')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();

    // Tab 3: Rules
    await page.getByRole('button', { name: 'Hướng Dẫn & Luật' }).click();
    await expect(page.getByText('Quy chuẩn luật chơi Sâm Lốc WorkRank')).toBeVisible();

    // Open Rules Modal
    await page.getByRole('button', { name: /Luật chơi/i }).first().click();
    const rulesDialog = page.getByRole('dialog');
    await expect(rulesDialog).toBeVisible();
    await page.getByRole('button', { name: 'Đã hiểu' }).click();
    await expect(rulesDialog).not.toBeVisible();
  });

  test('2. Waiting Room: single Ready click creates exactly ONE mutation', async ({ page }) => {
    await setupSamGameMocks(page, { roomStatus: 'WAITING' });

    let readyRequestCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('/ready') && req.method() === 'POST') {
        readyRequestCount++;
      }
    });

    await page.goto('/games/sam/room/101');

    await expect(page.getByRole('heading', { level: 1, name: 'Phòng Sâm 3Win Media Pro' })).toBeVisible();
    await expect(page.getByText('Đặng Tuấn Anh (Bạn)')).toBeVisible();

    // Click Ready button once
    const readyBtn = page.getByRole('button', { name: /^Sẵn sàng$/i });
    await expect(readyBtn).toBeVisible();
    await readyBtn.click();

    // Verify exactly ONE REST mutation occurred
    expect(readyRequestCount).toBe(1);

    // Verify socket emits did NOT include duplicate sam:toggleReady
    const socketEmits = await page.evaluate(() => window.__WR_SOCKET_EMITS__ || []);
    const toggleReadyEmits = socketEmits.filter((e) => e.event === 'sam:toggleReady');
    expect(toggleReadyEmits.length).toBe(0);
  });

  test('3. Match Arena: renders Felt Table, Opponents, Card Fan, and Plays Combination', async ({ page }) => {
    await setupSamGameMocks(page, { roomStatus: 'PLAYING' });

    let playRequestCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('/play') && req.method() === 'POST') {
        playRequestCount++;
      }
    });

    await page.goto('/games/sam/room/101');

    // Arena elements
    const arena = page.locator('.sam-arena-shell');
    await expect(arena).toBeVisible();

    // Opponent Seats
    await expect(page.getByText('Nguyễn Hoài Nam')).toBeVisible();
    await expect(page.getByText('Lê Minh Trang')).toBeVisible();
    await expect(page.getByText('Báo 1')).toBeVisible(); // Opponent with 1 card

    // Table Felt
    await expect(page.getByText('Đôi 7')).toBeVisible();

    // Select Pair of 8 (8S + 8D)
    const card8S = page.locator('.sam-card-item', { hasText: '8' }).first();
    const card8D = page.locator('.sam-card-item', { hasText: '8' }).nth(1);
    await card8S.click();
    await card8D.click();

    // Verify combination recognized as Đôi 8
    await expect(page.getByRole('button', { name: /Đánh Đôi 8/i })).toBeVisible();

    // Click Play Cards
    await page.getByRole('button', { name: /Đánh Đôi 8/i }).click();

    // Verify single request sent
    expect(playRequestCount).toBe(1);
  });

  test('4. Socket Contract Test (Mock Boundary): event sam:gameFinished opens Result Modal over Arena without unmounting', async ({ page }) => {
    const mockResult = [
      {
        userId: 10,
        name: 'Đặng Tuấn Anh',
        isWinner: true,
        remainingCards: 0,
        scoreDelta: 60,
      },
      {
        userId: 11,
        name: 'Nguyễn Hoài Nam',
        isWinner: false,
        remainingCards: 8,
        scoreDelta: -20,
        reason: 'Thua',
      },
      {
        userId: 12,
        name: 'Lê Minh Trang',
        isWinner: false,
        remainingCards: 1,
        scoreDelta: -20,
        reason: 'Thua',
      },
      {
        userId: 13,
        name: 'AI Alpha (Hard)',
        isWinner: false,
        remainingCards: 6,
        scoreDelta: -20,
        reason: 'Thua',
      },
    ];

    await setupSamGameMocks(page, { roomStatus: 'PLAYING' });
    await page.goto('/games/sam/room/101');

    // 1. Verify arena is rendered
    const arena = page.locator('.sam-arena-shell');
    await expect(arena).toBeVisible();

    // Wait until socket listener is registered
    await page.waitForFunction(() => {
      return (
        window.__WR_SOCKET_MOCK__ &&
        window.__WR_SOCKET_MOCK__.listeners &&
        window.__WR_SOCKET_MOCK__.listeners['sam:gameFinished'] &&
        window.__WR_SOCKET_MOCK__.listeners['sam:gameFinished'].length > 0
      );
    }, { timeout: 4000 });

    // 2. Trigger real socket event sam:gameFinished on the socket listener boundary
    await page.evaluate((resultData) => {
      if (window.__WR_SOCKET_MOCK__) {
        window.__WR_SOCKET_MOCK__.trigger('sam:gameFinished', resultData);
      }
    }, { results: mockResult, winnerUserId: 10, isSamWin: false });

    // 3. Assertion (a): Arena shell is still mounted!
    await expect(arena).toBeVisible();

    // 4. Assertion (b): Result Modal appears via Portal!
    const resultModal = page.getByRole('dialog');
    await expect(resultModal).toBeVisible();

    // 5. Assertion (c): Scorecard and winner details display!
    await expect(page.getByText('Kết Thúc Ván Đấu')).toBeVisible();
    await expect(resultModal.getByText('+60')).toBeVisible();
    await expect(resultModal.getByRole('button', { name: /Chơi ván tiếp/i })).toBeVisible();
    await expect(resultModal.getByRole('button', { name: /Rời bàn/i })).toBeVisible();

    // 6. Assertion (d): No navigation away to lobby occurred (URL remains /games/sam/room/101)
    expect(page.url()).toContain('/games/sam/room/101');
  });

  test('5. Admin Bot Drawer & Listener Cleanup: opens via Portal, closes with Escape, cleans up listeners on leave', async ({ page }) => {
    await setupSamGameMocks(page, { roomStatus: 'PLAYING' });
    await page.goto('/games/sam/room/101');

    // 1. Open Admin Bot Drawer
    const botDrawerBtn = page.getByRole('button', { name: /Test Bot/i });
    await expect(botDrawerBtn).toBeVisible();
    await botDrawerBtn.click();

    // 2. Verify Drawer is opened in Portal (body child)
    const botDrawer = page.getByRole('dialog', { name: /Điều Khiển Test Bot Admin/i });
    await expect(botDrawer).toBeVisible();

    // 3. Press Escape to close
    await page.keyboard.press('Escape');
    await expect(botDrawer).not.toBeVisible();

    // 4. Verify Listener Cleanup on leaving the room
    await page.getByRole('button', { name: /Rời bàn|Rời/i }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: /Đánh Sâm Lốc/i })).toBeVisible();

    // Assert socket emitted sam:leaveRoom and gameFinished listeners were removed
    const cleanupCheck = await page.evaluate(() => {
      const emits = window.__WR_SOCKET_EMITS__ || [];
      const hasLeaveEmit = emits.some((e) => e.event === 'sam:leaveRoom');
      const gameFinishedCount = (window.__WR_SOCKET_MOCK__?.listeners?.['sam:gameFinished'] || []).length;
      return { hasLeaveEmit, gameFinishedCount };
    });

    expect(cleanupCheck.hasLeaveEmit).toBe(true);
    expect(cleanupCheck.gameFinishedCount).toBe(0);
  });

  test('6. Responsive Viewports: audits 390px, 430px, 768px, 1024px, 1280px with visible seats, cards, and action bar', async ({ page }) => {
    await setupSamGameMocks(page, { roomStatus: 'PLAYING' });

    const viewports = [
      { name: 'desktop-wide', width: 1280, height: 800 },
      { name: 'desktop-compact', width: 1024, height: 768 },
      { name: 'tablet-768', width: 768, height: 1024 },
      { name: 'mobile-430', width: 430, height: 932 },
      { name: 'mobile-390', width: 390, height: 844 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/games/sam/room/101');

      // 1. Arena shell is mounted and visible
      const arena = page.locator('.sam-arena-shell');
      await expect(arena).toBeVisible();

      // 2. Opponent seats & names are visible, not cropped
      await expect(page.getByText('Nguyễn Hoài Nam')).toBeVisible();
      await expect(page.getByText('Lê Minh Trang')).toBeVisible();

      // 3. Opponent card count or status is visible
      await expect(page.getByText('8 lá')).toBeVisible();
      await expect(page.getByText('Báo 1')).toBeVisible();

      // 4. Player hand cards are visible
      await expect(page.locator('.sam-card-item').first()).toBeVisible();

      // 5. Action bar buttons are visible and accessible
      await expect(page.getByRole('button', { name: /Đánh bài/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Bỏ lượt/i })).toBeVisible();

      // 6. No unwanted horizontal scroll
      const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(vp.width);

      // Save screenshot to /tmp/workrank-sam-final/
      await page.screenshot({ path: `/tmp/workrank-sam-final/sam-${vp.name}.png` });
    }

    // Reduced Motion Test
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.screenshot({ path: '/tmp/workrank-sam-final/sam-reduced-motion.png' });
  });
});
