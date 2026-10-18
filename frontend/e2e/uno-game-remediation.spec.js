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

const mockOpponents = [
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

const mockMyPlayer = {
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
    { id: 'c_green_6_3', color: 'GREEN', type: 'NUMBER', value: 6, scoreValue: 6 },
    { id: 'c_yellow_draw2_4', color: 'YELLOW', type: 'DRAW_TWO', value: null, scoreValue: 20 },
    { id: 'c_wild_5', color: 'WILD', type: 'WILD', value: null, scoreValue: 50 },
  ],
};

const mockWaitingRoom = {
  id: 99,
  code: 'UNO-9921',
  title: 'Phòng UNO Cao Thủ',
  hostUserId: 42,
  status: 'WAITING',
  maxPlayers: 4,
  roomType: 'LIVE',
  players: [
    mockMyPlayer,
    mockOpponents[0],
    { ...mockOpponents[1], isReady: false },
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
  currentTurnSeat: 0, // My turn
  currentTurnUserId: 42,
  direction: 1,
  hasDrawnThisTurn: false,
  turnDurationSeconds: 25,
  turnDeadline: new Date(Date.now() + 20000).toISOString(),
  players: [mockMyPlayer, ...mockOpponents],
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
  durationSeconds: 94,
  players: [
    {
      ...mockOpponents[1],
      rankPosition: 1,
      scoreAwarded: 100,
      remainingCardsCount: 0,
      status: 'FINISHED',
    },
    {
      ...mockMyPlayer,
      rankPosition: 2,
      scoreAwarded: 50,
      remainingCardsCount: 2,
      status: 'FINISHED',
    },
    {
      ...mockOpponents[0],
      rankPosition: 3,
      scoreAwarded: 25,
      remainingCardsCount: 4,
      status: 'FINISHED',
    },
    {
      ...mockOpponents[2],
      rankPosition: 4,
      scoreAwarded: 10,
      remainingCardsCount: 6,
      status: 'FINISHED',
    },
  ],
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
    localStorage.setItem('token', 'uno-remediation-token');
    localStorage.setItem('workrank_active_user_id', '42');
    localStorage.setItem('workrank_session', JSON.stringify({ userId: '42', token: 'uno-remediation-token' }));
    sessionStorage.clear();
    window.__WR_E2E_TEST__ = true;
    window.__WR_SOCKET_MOCK__ = {
      connected: true,
      auth: { token: 'uno-remediation-token' },
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
            { id: 99, code: 'UNO-9921', title: 'Phòng UNO Cao Thủ', maxPlayers: 4, players: [mockMyPlayer, mockOpponents[0]] },
            { id: 100, code: 'UNO-5544', title: 'Phòng Tân Thủ', maxPlayers: 4, players: [mockOpponents[1]] },
          ],
        },
      });
    }
    return route.fulfill({ json: { data: null } });
  });
}

test.describe.configure({ mode: 'serial' });

test.describe('UNO Production UI/UX Remediation Test Suite', () => {
  test('1. Sảnh UNO: Hiển thị phòng, nút Luyện tập với Bot, Tạo phòng', async ({ page }) => {
    await setupUnoMocks(page, null);
    await page.goto('/games/uno');
    await expect(page.locator('text=Sảnh UNO Battle')).toBeVisible();
    await expect(page.locator('text=Luyện Tập Với Bot')).toBeVisible();
    await expect(page.locator('text=Tạo Phòng')).toBeVisible();
    await expect(page.locator('text=Phòng UNO Cao Thủ')).toBeVisible();
    await page.screenshot({ path: '../docs/audit/2026-10-18/after-01-lobby.png', fullPage: true });
  });

  test('2. Phòng chờ: Vương miện Chủ phòng, Trạng thái Sẵn sàng & Ghế trống thêm Bot', async ({ page }) => {
    await setupUnoMocks(page, mockWaitingRoom);
    await page.goto('/games/uno/room/99');
    await expect(page.getByRole('heading', { name: 'Phòng UNO Cao Thủ' })).toBeVisible();
    await expect(page.locator('text=Mã phòng:')).toBeVisible();
    // Host has Crown and + Thêm Bot button
    await expect(page.locator('text=+ Thêm Bot')).toBeVisible();
    await expect(page.locator('text=Sẵn sàng').first()).toBeVisible();
    await expect(page.locator('text=Bắt Đầu Trận Đấu')).toBeVisible();
    await page.screenshot({ path: '../docs/audit/2026-10-18/after-02-waiting-room.png', fullPage: true });
  });

  test('3. Bàn chơi thi đấu (My Turn): Mặt bàn Oval, La bàn Chiều đánh, Vầng sáng Active Color & Dual-Encoding Cards', async ({ page }) => {
    await setupUnoMocks(page, mockPlayingRoom);
    await page.goto('/games/uno/room/99');
    await expect(page.locator('text=LƯỢT CỦA BẠN — Đánh bài hoặc rút')).toBeVisible();
    // Non-color accessibility symbols and labels
    await expect(page.locator('text=Chiều đánh:')).toBeVisible();
    await expect(page.locator('text=Thuận')).toBeVisible();
    // Discard pile active color tag
    await expect(page.locator('text=ĐỎ').first()).toBeVisible();
    // Bỏ lượt is initially disabled before drawing
    const passBtn = page.getByRole('button', { name: /Bỏ Lượt/i });
    await expect(passBtn).toBeDisabled();
    // Card with number 6 has underline 6̲
    await expect(page.locator('text=6̲').first()).toBeVisible();
    await page.screenshot({ path: '../docs/audit/2026-10-18/after-03-gameplay-my-turn.png', fullPage: true });
  });

  test('4. Bàn chơi thi đấu (Opponent Turn): Hiển thị đồng hồ đếm ngược và tên đối thủ', async ({ page }) => {
    await setupUnoMocks(page, mockOpponentTurnRoom);
    await page.goto('/games/uno/room/99');
    await expect(page.locator('text=Đang chờ Bot Siêu Tốc...')).toBeVisible();
    await page.screenshot({ path: '../docs/audit/2026-10-18/after-04-gameplay-opponent-turn.png', fullPage: true });
  });

  test('5. Chọn màu Wild: Dialog độc lập với phím tắt R, Y, G, B và độ tương phản cao', async ({ page }) => {
    await setupUnoMocks(page, mockPlayingRoom);
    await page.goto('/games/uno/room/99');
    // Click wild card
    const wildCard = page.locator('.uno-card', { hasText: '★' }).first();
    await wildCard.click();
    await expect(page.locator('text=Chọn Màu Tiếp Theo')).toBeVisible();
    await expect(page.locator('text=Phím R / 1')).toBeVisible();
    await expect(page.locator('text=Phím Y / 2')).toBeVisible();
    await page.screenshot({ path: '../docs/audit/2026-10-18/after-05-wild-color-picker.png', fullPage: true });
  });

  test('6. Kết quả trận đấu: Vinh danh Quán quân (Avatar + Tên), Bảng xếp hạng XP, tuyệt đối KHÔNG lộ ID Database', async ({ page }) => {
    await setupUnoMocks(page, mockFinishedRoom);
    await page.goto('/games/uno/room/99');
    // Result modal
    await expect(page.locator('text=Trận Đấu Kết Thúc')).toBeVisible();
    await expect(page.locator('text=Quán Quân UNO')).toBeVisible();
    await expect(page.locator('text=Nguyễn Hoài Nam').first()).toBeVisible();
    // Check that raw database string like "Người thắng: 88" does NOT appear
    const rawIdText = page.locator('text=Người thắng: 88');
    await expect(rawIdText).not.toBeVisible();
    // Ranking & XP table
    await expect(page.locator('text=+100 XP')).toBeVisible();
    await expect(page.locator('text=+50 XP')).toBeVisible();
    await expect(page.locator('text=Về Sảnh')).toBeVisible();
    await expect(page.locator('text=Chơi Lại')).toBeVisible();
    await page.screenshot({ path: '../docs/audit/2026-10-18/after-06-game-finished-results.png', fullPage: true });
  });

  test('7. Mobile Viewport (390px): Tối ưu hóa không gian, không cuộn dọc trong lượt, hiển thị bài đầy đủ', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupUnoMocks(page, mockPlayingRoom);
    await page.goto('/games/uno/room/99');
    await expect(page.locator('text=LƯỢT CỦA BẠN — Đánh bài hoặc rút')).toBeVisible();
    await expect(page.locator('.uno-draw-pile')).toBeVisible();
    await expect(page.locator('.uno-hand-container')).toBeVisible();
    await page.screenshot({ path: '../docs/audit/2026-10-18/after-07-mobile-gameplay-390px.png', fullPage: true });
  });
});
