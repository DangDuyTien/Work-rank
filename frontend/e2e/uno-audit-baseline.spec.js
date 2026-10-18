import { expect, test } from '@playwright/test';

const mockUser = {
  id: 42,
  name: 'Đặng Tuấn Anh',
  email: 'tuananh@workrank.io',
  role: 'member',
  status: 'active',
  jobTitle: 'Senior Motion Designer',
  avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Tuấn%20Anh',
};

const mockPlayers = [
  {
    id: 101,
    roomId: 99,
    userId: 42,
    playerType: 'HUMAN',
    seatIndex: 0,
    remainingCardsCount: 5,
    status: 'ACTIVE',
    isReady: true,
    unoDeclared: false,
    user: mockUser,
    handCards: [
      { id: 'c_red_5_1', color: 'RED', type: 'NUMBER', value: 5, scoreValue: 5 },
      { id: 'c_blue_7_2', color: 'BLUE', type: 'NUMBER', value: 7, scoreValue: 7 },
      { id: 'c_green_skip_3', color: 'GREEN', type: 'SKIP', value: null, scoreValue: 20 },
      { id: 'c_yellow_draw2_4', color: 'YELLOW', type: 'DRAW_TWO', value: null, scoreValue: 20 },
      { id: 'c_wild_5', color: 'WILD', type: 'WILD', value: null, scoreValue: 50 },
    ],
  },
  {
    id: 102,
    roomId: 99,
    userId: null,
    playerType: 'BOT',
    isBot: true,
    botName: 'Bot Siêu Tốc',
    seatIndex: 1,
    remainingCardsCount: 4,
    status: 'ACTIVE',
    isReady: true,
    unoDeclared: false,
    handCards: [],
  },
  {
    id: 103,
    roomId: 99,
    userId: 88,
    playerType: 'HUMAN',
    seatIndex: 2,
    remainingCardsCount: 1,
    status: 'ACTIVE',
    isReady: true,
    unoDeclared: false, // Target for penalty
    user: {
      id: 88,
      name: 'Nguyễn Hoài Nam',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Nam',
      jobTitle: 'Content Creator',
    },
    handCards: [],
  },
  {
    id: 104,
    roomId: 99,
    userId: null,
    playerType: 'BOT',
    isBot: true,
    botName: 'Bot Bất Bại',
    seatIndex: 3,
    remainingCardsCount: 6,
    status: 'ACTIVE',
    isReady: true,
    unoDeclared: false,
    handCards: [],
  },
];

const mockWaitingRoom = {
  id: 99,
  code: 'UNO-9921',
  title: 'Phòng UNO Cao Thủ',
  hostUserId: 42,
  status: 'WAITING',
  maxPlayers: 4,
  roomType: 'LIVE',
  players: [
    mockPlayers[0],
    mockPlayers[1],
    { ...mockPlayers[2], isReady: false },
  ],
};

const mockPlayingRoom = {
  id: 99,
  code: 'UNO-9921',
  title: 'Phòng UNO Cao Thủ',
  hostUserId: 42,
  status: 'PLAYING',
  maxPlayers: 4,
  roomType: 'LIVE',
  activeColor: 'RED',
  topDiscardCard: { id: 'c_red_7_9', color: 'RED', type: 'NUMBER', value: 7, scoreValue: 7 },
  discardPileCount: 14,
  drawPileCount: 78,
  currentTurnSeat: 0,
  currentTurnUserId: 42,
  direction: 1,
  turnDurationSeconds: 25,
  turnDeadline: new Date(Date.now() + 20000).toISOString(),
  players: mockPlayers,
};

const mockOpponentTurnRoom = {
  ...mockPlayingRoom,
  currentTurnSeat: 1,
  currentTurnUserId: null,
};

const mockFinishedRoom = {
  ...mockPlayingRoom,
  status: 'FINISHED',
  winnerUserId: 88,
  players: mockPlayers.map((p, idx) => ({
    ...p,
    rankPosition: idx === 2 ? 1 : idx === 0 ? 2 : idx === 1 ? 3 : 4,
    scoreAwarded: idx === 2 ? 100 : idx === 0 ? 50 : idx === 1 ? 25 : 10,
    status: 'FINISHED',
  })),
};

async function setupUnoMocks(page, roomState) {
  await page.addInitScript(() => {
    class MockBC {
      constructor() { this.onmessage = null; }
      postMessage() {}
      close() {}
      addEventListener() {}
      removeEventListener() {}
    }
    window.BroadcastChannel = MockBC;
    localStorage.setItem('token', 'uno-audit-token');
    localStorage.setItem('workrank_active_user_id', '42');
    localStorage.setItem('workrank_session', JSON.stringify({ userId: '42', token: 'uno-audit-token' }));
    sessionStorage.clear();
    window.__WR_E2E_TEST__ = true;
    window.__WR_SOCKET_MOCK__ = {
      connected: true,
      auth: { token: 'uno-audit-token' },
      listeners: {},
      on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
      },
      off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
      },
      emit() {},
    };
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.includes('/auth/me')) {
      return route.fulfill({ json: { user: mockUser } });
    }
    if (url.pathname.includes('/games/uno/active-room')) {
      return route.fulfill({ json: { data: null } });
    }
    if (url.pathname.endsWith('/games/uno/rooms/99') || url.pathname.includes('/games/uno/rooms/99')) {
      return route.fulfill({ json: { data: roomState } });
    }
    if (url.pathname.endsWith('/games/uno/rooms') || url.pathname.includes('/games/uno/rooms')) {
      return route.fulfill({
        json: {
          data: [
            { id: 99, code: 'UNO-9921', title: 'Phòng UNO Cao Thủ', maxPlayers: 4, players: [mockPlayers[0], mockPlayers[1]] },
            { id: 100, code: 'UNO-5544', title: 'Phòng Tân Thủ', maxPlayers: 4, players: [mockPlayers[2]] },
          ],
        },
      });
    }
    return route.fulfill({ json: { data: null } });
  });
}

test.describe('UNO UI/UX Baseline Audit Captures', () => {
  test('Capture Baseline 01: Lobby', async ({ page }) => {
    await setupUnoMocks(page, null);
    await page.goto('/games/uno');
    await page.waitForSelector('text=Sảnh UNO');
    await page.screenshot({ path: '../docs/audit/2026-10-18/baseline-01-lobby.png', fullPage: true });
  });

  test('Capture Baseline 02: Waiting Room', async ({ page }) => {
    await setupUnoMocks(page, mockWaitingRoom);
    await page.goto('/games/uno/room/99');
    await page.waitForSelector('text=Phòng chờ');
    await page.screenshot({ path: '../docs/audit/2026-10-18/baseline-02-waiting-room.png', fullPage: true });
  });

  test('Capture Baseline 03: Gameplay My Turn', async ({ page }) => {
    await setupUnoMocks(page, mockPlayingRoom);
    await page.goto('/games/uno/room/99');
    await page.waitForSelector('text=LƯỢT CỦA BẠN');
    await page.screenshot({ path: '../docs/audit/2026-10-18/baseline-03-gameplay-my-turn.png', fullPage: true });
  });

  test('Capture Baseline 04: Gameplay Opponent Turn', async ({ page }) => {
    await setupUnoMocks(page, mockOpponentTurnRoom);
    await page.goto('/games/uno/room/99');
    await page.waitForSelector('text=Đang chờ');
    await page.screenshot({ path: '../docs/audit/2026-10-18/baseline-04-gameplay-opponent-turn.png', fullPage: true });
  });

  test('Capture Baseline 05: Game Finished / Results Bug', async ({ page }) => {
    await setupUnoMocks(page, mockFinishedRoom);
    await page.goto('/games/uno/room/99');
    await page.waitForSelector('text=Người thắng:');
    await page.screenshot({ path: '../docs/audit/2026-10-18/baseline-05-game-finished-results.png', fullPage: true });
  });

  test('Capture Baseline 06: Mobile Gameplay (390px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupUnoMocks(page, mockPlayingRoom);
    await page.goto('/games/uno/room/99');
    await page.waitForSelector('text=LƯỢT CỦA BẠN');
    await page.screenshot({ path: '../docs/audit/2026-10-18/baseline-06-mobile-gameplay-390px.png', fullPage: true });
  });
});
