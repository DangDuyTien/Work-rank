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

const mockStats = {
  bestWpm: 92,
  bestAccuracy: 98,
  totalWordsTyped: 3420,
  matchesCount: 28,
  winsCount: 19,
  totalWorkRankPointsEarned: 450,
};

const mockChallenges = [
  {
    id: 1,
    title: 'Thư Thái Sau Giờ Làm',
    category: 'Đời sống',
    difficulty: 'Dễ',
    language: 'VI',
    content: 'chữa lành tâm hồn bằng một chén trà ấm và gác lại mọi lo toan công việc sau giờ hành chính để tận hưởng cuộc sống bình yên bên gia đình người thân',
  },
];

const mock2v2Players = [
  {
    userId: 10,
    seatIndex: 0,
    team: 'A',
    isReady: true,
    status: 'TYPING',
    typedChars: 120,
    wpm: 84,
    accuracy: 98,
    progressPct: 65,
    user: mockUser,
  },
  {
    userId: 11,
    seatIndex: 1,
    team: 'A',
    isReady: true,
    status: 'TYPING',
    typedChars: 95,
    wpm: 72,
    accuracy: 96,
    progressPct: 52,
    user: { id: 11, name: 'Nguyễn Hoài Nam', jobTitle: 'Content Creator' },
  },
  {
    userId: 12,
    seatIndex: 2,
    team: 'B',
    isReady: true,
    status: 'TYPING',
    typedChars: 110,
    wpm: 78,
    accuracy: 97,
    progressPct: 60,
    user: { id: 12, name: 'Lê Minh Trang', jobTitle: 'Video Editor' },
  },
  {
    userId: 13,
    seatIndex: 3,
    team: 'B',
    isReady: true,
    status: 'TYPING',
    typedChars: 70,
    wpm: 60,
    accuracy: 94,
    progressPct: 38,
    user: { id: 13, name: 'Phạm Quốc Bảo', jobTitle: 'Junior Developer' },
  },
];

const mock3v3Players = [
  ...mock2v2Players,
  {
    userId: 14,
    seatIndex: 4,
    team: 'A',
    isReady: true,
    status: 'TYPING',
    typedChars: 85,
    wpm: 68,
    accuracy: 95,
    progressPct: 46,
    user: { id: 14, name: 'Vũ Hải Đăng', jobTitle: 'Graphic Designer' },
  },
  {
    userId: 15,
    seatIndex: 5,
    team: 'B',
    isReady: true,
    status: 'TYPING',
    typedChars: 90,
    wpm: 70,
    accuracy: 96,
    progressPct: 49,
    user: { id: 15, name: 'Hoàng Yến Nhi', jobTitle: 'Copywriter' },
  },
];

async function setupTypingBattleMocks(page, options = {}) {
  const roomStatus = options.roomStatus || 'WAITING';
  const mode = options.mode || '2V2';
  const players = options.players || (mode === '3V3' ? mock3v3Players : mock2v2Players);

  await page.addInitScript(() => {
    localStorage.setItem('token', 'typing-e2e-token');
    window.__WR_E2E_TEST__ = true;

    const listeners = {};
    window.__WR_SOCKET_MOCK__ = {
      connected: true,
      auth: { token: 'typing-e2e-token' },
      listeners,
      on: (event, callback) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
      },
      off: (event, callback) => {
        if (!listeners[event]) return;
        listeners[event] = listeners[event].filter((cb) => cb !== callback);
      },
      emit: (event, data) => {
        if (!window.__WR_SOCKET_EMITS__) window.__WR_SOCKET_EMITS__ = [];
        window.__WR_SOCKET_EMITS__.push({ event, data });
      },
      trigger: (event, data) => {
        if (listeners[event]) {
          listeners[event].forEach((cb) => cb(data));
        }
      },
    };
  });

  // Catch-all API mock router preventing auth drops
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/auth/me') {
      await route.fulfill({ json: { user: mockUser } });
      return;
    }

    if (url.pathname === '/api/games/catalog/typing_battle' || url.pathname.includes('/catalog/typing_battle')) {
      await route.fulfill({
        json: {
          game: {
            gameKey: 'typing_battle',
            name: 'WorkRank Typing Battle',
            status: 'ACTIVE',
          },
        },
      });
      return;
    }

    if (url.pathname === '/api/games/typing/status') {
      await route.fulfill({
        json: {
          status: 'ACTIVE',
          activeSeason: { id: 1, name: 'Mùa 1 - 2026' },
        },
      });
      return;
    }

    if (url.pathname === '/api/games/typing/my-stats') {
      await route.fulfill({
        json: { stats: mockStats },
      });
      return;
    }

    if (url.pathname.includes('/api/games/typing/challenges')) {
      await route.fulfill({
        json: { challenges: mockChallenges },
      });
      return;
    }

    if (url.pathname.includes('/api/games/typing/leaderboard')) {
      await route.fulfill({
        json: {
          leaderboard: [
            { userId: 10, name: 'Đặng Tuấn Anh', bestWpm: 92, bestAccuracy: 98, winsCount: 19, totalWorkRankPointsEarned: 450 },
            { userId: 11, name: 'Nguyễn Hoài Nam', bestWpm: 85, bestAccuracy: 96, winsCount: 14, totalWorkRankPointsEarned: 320 },
            { userId: 12, name: 'Lê Minh Trang', bestWpm: 80, bestAccuracy: 97, winsCount: 11, totalWorkRankPointsEarned: 280 },
          ],
        },
      });
      return;
    }

    if (options.roomId && url.pathname.includes(`/api/games/typing/rooms/${options.roomId}`)) {
      if (url.pathname.endsWith('/spectators')) {
        await route.fulfill({
          json: {
            spectatorCount: options.spectatorCount || 0,
            spectators: options.spectators || [],
          },
        });
        return;
      }

      await route.fulfill({
        json: {
          room: {
            id: Number(options.roomId),
            title: `Phòng thi đấu ${mode}`,
            mode,
            matchType: 'RANKED',
            status: roomStatus,
            hostUserId: 10,
            durationLimitSeconds: 120,
            challengeText: 'chữa lành tâm hồn bằng một chén trà ấm và gác lại mọi lo toan công việc sau giờ hành chính để tận hưởng cuộc sống bình yên bên gia đình người thân',
          },
          players,
          spectatorCount: options.spectatorCount || 0,
          spectators: options.spectators || [],
          result: options.result || (roomStatus === 'FINISHED' ? {
            winnerTeam: 'A',
            results: players.map((p, idx) => ({
              userId: p.userId,
              user: p.user,
              team: p.team,
              wpm: p.wpm || (80 - idx * 5),
              accuracy: p.accuracy || 98,
              typedChars: 140,
              scoreDelta: idx === 0 ? 30 : 15,
              isWinner: idx === 0,
            })),
          } : null),
        },
      });
      return;
    }

    if (url.pathname === '/api/games/typing/rooms') {
      if (route.request().method() === 'GET') {
        const statusParam = url.searchParams.get('status');
        if (statusParam === 'PLAYING') {
          await route.fulfill({ json: { rooms: options.liveRooms || [] } });
        } else {
          await route.fulfill({ json: { rooms: options.waitingRooms || [] } });
        }
      } else {
        await route.fulfill({
          status: 201,
          json: {
            room: {
              id: 101,
              title: 'Phòng thi đấu 2v2',
              mode,
              status: 'WAITING',
              hostUserId: 10,
              durationLimitSeconds: 120,
            },
          },
        });
      }
      return;
    }

    if (url.pathname === '/api/games/typing/active-room') {
      await route.fulfill({ json: { room: null } });
      return;
    }

    // Default safe fallback for unhandled endpoints
    await route.fulfill({ json: { data: [] } });
  });
}

test.describe('WorkRank Typing Battle — Deep Team Match UX Redesign', () => {
  test('1. Hub & Practice Mode: renders header stats, duration controls, and rolling typing text stage', async ({ page }) => {
    await setupTypingBattleMocks(page);
    await page.goto('/games/typing');

    // Verify main header and stats ribbon
    await expect(page.getByRole('heading', { name: 'WorkRank Typing Battle' })).toBeVisible();
    await expect(page.getByText('Best WPM:').first()).toBeVisible();
    await expect(page.getByText('92').first()).toBeVisible();

    // Verify duration selector buttons
    await expect(page.getByRole('button', { name: /2 Phút/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /5 Phút/i })).toBeVisible();

    // Verify rolling typing arena is visible and interactive
    const arena = page.locator('.workrank-typing-text-arena');
    await expect(arena).toBeVisible();

    // Click arena and type characters
    await arena.click();
    await page.keyboard.type('chữa lành');

    // Verify virtual keyboard toggle (default ON -> toggle OFF -> toggle back ON)
    await expect(page.locator('.workrank-minimal-keyboard')).toBeVisible();
    const hideKbBtn = page.getByRole('button', { name: /Ẩn phím/i });
    await expect(hideKbBtn).toBeVisible();
    await hideKbBtn.click();
    await expect(page.locator('.workrank-minimal-keyboard')).not.toBeVisible();
    const showKbBtn = page.getByRole('button', { name: /Hiện phím/i });
    await expect(showKbBtn).toBeVisible();
    await showKbBtn.click();
    await expect(page.locator('.workrank-minimal-keyboard')).toBeVisible();
  });

  test('2. 2v2 Live Match Arena: renders Symmetrical Two-Wing Battle Arena, Tug-of-War Gauge, and Player Chips', async ({ page }) => {
    await setupTypingBattleMocks(page, {
      roomId: 201,
      mode: '2V2',
      roomStatus: 'PLAYING',
    });

    await page.goto('/games/typing/room/201');

    // 1. Verify Battle Arena Mode Header and Timer
    await expect(page.getByText('ĐẤU TRƯỜNG 2 VS 2 ĐỒNG ĐỘI')).toBeVisible();
    await expect(page.getByText('02:00').first()).toBeVisible();

    // 2. Verify Tug-of-War Aggregate Team Progress Track
    await expect(page.getByText('TIẾN ĐỘ TỔNG HỢP HAI ĐỘI')).toBeVisible();
    await expect(page.getByText('ĐỘI XANH (TEAM A)')).toBeVisible();
    await expect(page.getByText('ĐỘI CAM (TEAM B)')).toBeVisible();

    // 3. Verify Symmetrical Team Wings and VS Divider
    const teamGrid = page.locator('.workrank-team-lanes-grid');
    await expect(teamGrid).toBeVisible();
    await expect(page.locator('.workrank-team-vs-divider')).toBeVisible();

    // 4. Verify Individual Player Chips for all 4 participants
    await expect(page.getByText('Đặng Tuấn Anh (Bạn)')).toBeVisible();
    await expect(page.getByText('Nguyễn Hoài Nam')).toBeVisible();
    await expect(page.getByText('Lê Minh Trang')).toBeVisible();
    await expect(page.getByText('Phạm Quốc Bảo')).toBeVisible();

    // Verify Team Leaders have the MVP Crown 👑
    await expect(page.locator('span[title="Dẫn đầu đội"]').first()).toBeVisible();

    // 5. Verify Typing Area is prominently rendered right below the Battle Arena
    await expect(page.getByText(/Tốc độ:/i).first()).toBeVisible();
    await expect(page.getByText(/Chính xác:/i).first()).toBeVisible();
    await expect(page.getByText(/Tiến độ bài thi:/i).first()).toBeVisible();
    await expect(page.locator('.workrank-typing-text-arena')).toBeVisible();
  });

  test('3. 3v3 Live Match Arena: renders 6 player lanes (3 per team) cleanly with zero overflow', async ({ page }) => {
    await setupTypingBattleMocks(page, {
      roomId: 301,
      mode: '3V3',
      roomStatus: 'PLAYING',
    });

    await page.goto('/games/typing/room/301');

    // Verify 3v3 Header
    await expect(page.getByText('ĐẠI CHIẾN 3 VS 3 ĐỒNG ĐỘI')).toBeVisible();

    // Verify all 6 players in lanes
    await expect(page.getByText('Đặng Tuấn Anh (Bạn)')).toBeVisible();
    await expect(page.getByText('Nguyễn Hoài Nam')).toBeVisible();
    await expect(page.getByText('Vũ Hải Đăng')).toBeVisible();
    await expect(page.getByText('Lê Minh Trang')).toBeVisible();
    await expect(page.getByText('Phạm Quốc Bảo')).toBeVisible();
    await expect(page.getByText('Hoàng Yến Nhi')).toBeVisible();

    // Check zero horizontal overflow on desktop
    const isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(isOverflowing).toBe(false);
  });

  test('4. 1v1 Duel Arena: renders Head-to-Head duel cards and dynamic lead indicator', async ({ page }) => {
    const mock1v1Players = [
      {
        userId: 10,
        seatIndex: 0,
        team: 'NONE',
        isReady: true,
        status: 'TYPING',
        typedChars: 90,
        wpm: 82,
        accuracy: 98,
        progressPct: 55,
        user: mockUser,
      },
      {
        userId: 12,
        seatIndex: 1,
        team: 'NONE',
        isReady: true,
        status: 'TYPING',
        typedChars: 65,
        wpm: 70,
        accuracy: 95,
        progressPct: 40,
        user: { id: 12, name: 'Lê Minh Trang', jobTitle: 'Video Editor' },
      },
    ];

    await setupTypingBattleMocks(page, {
      roomId: 401,
      mode: '1V1',
      roomStatus: 'PLAYING',
      players: mock1v1Players,
    });

    await page.goto('/games/typing/room/401');

    await expect(page.getByText('QUYẾT ĐẤU 1 VS 1')).toBeVisible();
    await expect(page.locator('.workrank-duel-grid')).toBeVisible();
    await expect(page.getByText('Đặng Tuấn Anh (Bạn)')).toBeVisible();
    await expect(page.getByText('Lê Minh Trang')).toBeVisible();
    await expect(page.locator('.workrank-duel-vs-divider')).toBeVisible();
  });

  test('5. Finished Match Result Screen: renders Team victory, Team Summary box, MVP Spotlight, and Standings table', async ({ page }) => {
    await setupTypingBattleMocks(page, {
      roomId: 501,
      mode: '2V2',
      roomStatus: 'FINISHED',
    });

    await page.goto('/games/typing/room/501');

    // 1. Victory Banner
    await expect(page.getByText(/CHIẾN THẮNG TUYỆT ĐỐI|KẾT THÚC BÀI THI/i)).toBeVisible();

    // 2. Team Comparison Box
    await expect(page.getByText('🔵 ĐỘI XANH (TEAM A)')).toBeVisible();
    await expect(page.getByText('🟠 ĐỘI CAM (TEAM B)')).toBeVisible();

    // 3. MVP Spotlight
    await expect(page.getByText(/MVP TRẬN ĐẤU:/i)).toBeVisible();

    // 4. Standings Table with Hạng, Đội, Thành viên, WPM, XP
    await expect(page.getByRole('columnheader', { name: 'HẠNG' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'ĐỘI' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'THÀNH VIÊN' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'TỐC ĐỘ' })).toBeVisible();

    // 5. Personal Metrics 4-Box Ribbon
    await expect(page.getByText('TỐC ĐỘ GÕ')).toBeVisible();
    await expect(page.getByText('CHÍNH XÁC').first()).toBeVisible();
    await expect(page.getByText('SỐ TỪ GÕ')).toBeVisible();
    await expect(page.getByText('ĐIỂM WORKRANK').first()).toBeVisible();

    // 6. Action buttons
    await expect(page.getByRole('button', { name: /Quay lại Sảnh Đấu/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Bảng Xếp Hạng Công Ty/i })).toBeVisible();
  });

  test('6. Responsive viewports: audits mobile (390px) and tablet (768px) with zero horizontal overflow', async ({ page }) => {
    await setupTypingBattleMocks(page, {
      roomId: 601,
      mode: '2V2',
      roomStatus: 'PLAYING',
    });

    // Mobile Viewport: 390x844
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/games/typing/room/601');

    await expect(page.getByText('ĐẤU TRƯỜNG 2 VS 2 ĐỒNG ĐỘI')).toBeVisible();
    await expect(page.locator('.workrank-typing-text-arena')).toBeVisible();

    let isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(isOverflowing).toBe(false);

    // Tablet Viewport: 768x1024
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await expect(page.getByText('ĐẤU TRƯỜNG 2 VS 2 ĐỒNG ĐỘI')).toBeVisible();

    isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(isOverflowing).toBe(false);
  });

  test('7. Live Now section in Arena tab: displays active 1v1 live matches, player stats, spectator badges, and navigation', async ({ page }) => {
    const mockLiveRoom = {
      id: 701,
      title: 'Đại Chiến 1v1 Top Server',
      mode: '1V1',
      matchType: 'RANKED',
      status: 'PLAYING',
      spectatorCount: 6,
      players: [
        {
          userId: 21,
          seatIndex: 0,
          team: 'A',
          typedChars: 85,
          wpm: 88,
          accuracy: 98,
          progressPct: 62,
          user: { id: 21, name: 'Nguyễn Thành Nam', jobTitle: 'Lead Developer' },
        },
        {
          userId: 22,
          seatIndex: 1,
          team: 'B',
          typedChars: 75,
          wpm: 81,
          accuracy: 96,
          progressPct: 54,
          user: { id: 22, name: 'Trần Hải Đăng', jobTitle: 'Product Manager' },
        },
      ],
    };

    await setupTypingBattleMocks(page, {
      liveRooms: [mockLiveRoom],
    });

    await page.goto('/games/typing');

    // Switch to Arena tab
    await page.getByRole('button', { name: /Đấu Trường/i }).click();

    // Check 🔴 TRỰC TIẾP section
    await expect(page.getByText('🔴 TRỰC TIẾP')).toBeVisible();
    await expect(page.getByText('Trận Đấu Đang Diễn Ra (1)')).toBeVisible();
    await expect(page.getByText('Đại Chiến 1v1 Top Server')).toBeVisible();
    await expect(page.getByText('Nguyễn Thành Nam')).toBeVisible();
    await expect(page.getByText('Trần Hải Đăng')).toBeVisible();
    await expect(page.getByText('88 WPM')).toBeVisible();
    await expect(page.getByText('81 WPM')).toBeVisible();
    await expect(page.getByText('6 đang xem', { exact: true })).toBeVisible();

    // Spectate CTA Button
    const spectateBtn = page.getByRole('button', { name: /Xem Trực Tiếp \(6 đang xem\)/i });
    await expect(spectateBtn).toBeVisible();
  });

  test('8. Live Spectator Dual Observation View: renders dual observation streams with telemetry, audience modal, and read-only mode', async ({ page }) => {
    const mock1v1Playing = [
      {
        userId: 31,
        seatIndex: 0,
        team: 'A',
        isReady: true,
        status: 'TYPING',
        typedChars: 72,
        wpm: 85,
        accuracy: 97,
        progressPct: 55,
        errorCount: 1,
        user: { id: 31, name: 'Ngô Đức Anh', jobTitle: 'Fullstack Engineer' },
      },
      {
        userId: 32,
        seatIndex: 1,
        team: 'B',
        isReady: true,
        status: 'TYPING',
        typedChars: 68,
        wpm: 79,
        accuracy: 99,
        progressPct: 50,
        errorCount: 0,
        user: { id: 32, name: 'Bùi Phương Linh', jobTitle: 'UI Designer' },
      },
    ];

    const mockSpectators = [
      { userId: 10, name: 'Đặng Tuấn Anh', jobTitle: 'Senior Motion Designer' },
      { userId: 99, name: 'Lê Hoàng Long', jobTitle: 'Data Analyst' },
    ];

    await setupTypingBattleMocks(page, {
      roomId: 801,
      mode: '1V1',
      roomStatus: 'PLAYING',
      players: mock1v1Playing,
      spectatorCount: 2,
      spectators: mockSpectators,
    });

    await page.goto('/games/typing/spectate/801');

    // 1. Spectator Top Bar
    await expect(page.getByText('🔴 ĐANG XEM TRỰC TIẾP')).toBeVisible();
    const spectatorCountBtn = page.getByRole('button', { name: /2 người xem/i });
    await expect(spectatorCountBtn).toBeVisible();

    // 2. Spectator Dual Observation Arena
    await expect(page.getByText('QUAN SÁT TRỰC TIẾP')).toBeVisible();
    await expect(page.getByText('Ngô Đức Anh').first()).toBeVisible();
    await expect(page.getByText('Bùi Phương Linh').first()).toBeVisible();
    await expect(page.getByText(/85 WPM/).first()).toBeVisible();
    await expect(page.getByText(/79 WPM/).first()).toBeVisible();
    await expect(page.getByText(/Chế độ Khán giả \(Read-only\)/i)).toBeVisible();

    // 3. Verify user has no input element for typing in spectator mode
    const textInput = page.locator('input[type="text"]');
    await expect(textInput).toHaveCount(0);

    // 4. Click spectator count button to open spectators list modal
    await spectatorCountBtn.click();
    await expect(page.getByText('Khán Giả Đang Theo Dõi (2)')).toBeVisible();
    await expect(page.getByText('Đặng Tuấn Anh (Bạn)')).toBeVisible();
    await expect(page.getByText('Lê Hoàng Long')).toBeVisible();

    // Close modal
    await page.getByLabel('Đóng').click();
    await expect(page.getByText('Khán Giả Đang Theo Dõi (2)')).not.toBeVisible();

    // 5. Test view switcher buttons
    await page.getByRole('button', { name: /Ngô Đức Anh \(Xanh\)/i }).click();
    await expect(page.getByText('Ngô Đức Anh').first()).toBeVisible();
  });

  test('9. Spectator Match Finished View: displays winner announcement, audience count, stats comparison, and spectator exit CTAs', async ({ page }) => {
    const mock1v1Finished = [
      {
        userId: 41,
        seatIndex: 0,
        team: 'A',
        status: 'FINISHED',
        typedChars: 140,
        wpm: 92,
        accuracy: 99,
        progressPct: 100,
        user: { id: 41, name: 'Hoàng Minh Khang', jobTitle: 'Tech Lead' },
      },
      {
        userId: 42,
        seatIndex: 1,
        team: 'B',
        status: 'FINISHED',
        typedChars: 128,
        wpm: 82,
        accuracy: 96,
        progressPct: 92,
        user: { id: 42, name: 'Phan Thị Mai', jobTitle: 'QA Lead' },
      },
    ];

    const mockFinishedResult = {
      winnerUserId: 41,
      results: [
        { userId: 41, user: { id: 41, name: 'Hoàng Minh Khang' }, wpm: 92, accuracy: 99, typedChars: 140, scoreDelta: 25, isWinner: true },
        { userId: 42, user: { id: 42, name: 'Phan Thị Mai' }, wpm: 82, accuracy: 96, typedChars: 128, scoreDelta: 10, isWinner: false },
      ],
    };

    await setupTypingBattleMocks(page, {
      roomId: 901,
      mode: '1V1',
      roomStatus: 'FINISHED',
      players: mock1v1Finished,
      spectatorCount: 5,
      spectators: [{ userId: 10, name: 'Đặng Tuấn Anh', jobTitle: 'Senior Motion Designer' }],
      result: mockFinishedResult,
    });

    await page.goto('/games/typing/spectate/901');

    // 1. Winner Banner
    await expect(page.getByText(/Hoàng Minh Khang CHIẾN THẮNG!/i)).toBeVisible();
    await expect(page.getByText(/Khán giả trực tiếp/i)).toBeVisible();

    // 2. Spectators Summary Ribbon
    await expect(page.getByText('KHÁN GIẢ THEO DÕI')).toBeVisible();
    await expect(page.getByText('5 người', { exact: true })).toBeVisible();

    // 3. Spectator Action Buttons
    await expect(page.getByRole('button', { name: /Danh Sách Khán Giả \(5\)/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Quay lại Sảnh Đấu/i })).toBeVisible();
  });
});
