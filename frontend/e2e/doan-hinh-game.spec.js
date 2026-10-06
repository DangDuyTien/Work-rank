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

const mockPlayers = [
  {
    id: 1,
    roomId: 91,
    userId: 10,
    score: 850,
    roundScore: 850,
    status: 'ACTIVE',
    user: mockUser,
  },
  {
    id: 2,
    roomId: 91,
    userId: 11,
    score: 920,
    roundScore: 920,
    status: 'ACTIVE',
    user: { id: 11, name: 'Nguyễn Hoài Nam', email: 'nam@workrank.io', jobTitle: 'Content Creator' },
  },
  {
    id: 3,
    roomId: 91,
    userId: 12,
    score: 600,
    roundScore: 600,
    status: 'ACTIVE',
    user: { id: 12, name: 'Lê Minh Trang', email: 'trang@workrank.io', jobTitle: 'Video Editor' },
  },
];

const mockImageQuestion = {
  id: 501,
  type: 'IMAGE',
  category: 'Đoán Logo & Thương Hiệu',
  question: 'Đây là logo biểu tượng của công ty công nghệ nổi tiếng nào?',
  imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
  optionA: 'Google',
  optionB: 'Microsoft',
  optionC: 'Apple',
  optionD: 'WorkRank',
  points: 1000,
  timeLimit: 10,
  correctOption: 'D',
  explanation: 'WorkRank là nền tảng quản lý năng suất & vinh danh nhân sự thế hệ mới.',
};

const mockMusicQuestion = {
  id: 502,
  type: 'MUSIC',
  category: 'Nhạc Trẻ Việt',
  question: 'Đoạn nhạc trên trích từ ca khúc nổi tiếng nào?',
  audioUrl: 'https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3',
  optionA: 'Cắt Đôi Nỗi Sầu',
  optionB: 'Nơi Này Có Anh',
  optionC: 'Bật Tình Yêu Lên',
  optionD: 'Ngày Mai Người Ta Lấy Chồng',
  points: 1000,
  timeLimit: 12,
  correctOption: 'B',
  explanation: 'Nơi Này Có Anh là bản hit đình đám của Sơn Tùng M-TP.',
};

async function setupQuizMocks(page, options = {}) {
  const roomStatus = options.roomStatus || 'WAITING';
  const currentQuestion = options.currentQuestion !== undefined ? options.currentQuestion : mockImageQuestion;
  const requestCounters = options.requestCounters || {};

  await page.addInitScript(() => {
    localStorage.setItem('token', 'doan-hinh-e2e-test-token');
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (url.pathname === '/api/auth/me') {
      await route.fulfill({ json: { user: mockUser } });
      return;
    }

    if (url.pathname === '/api/games/catalog') {
      await route.fulfill({
        json: {
          games: [
            {
              gameKey: 'quiz',
              name: 'Đoán Hình & Đoán Nhạc',
              status: 'AVAILABLE',
              enabled: true,
              description: 'Thử tài nhanh tay lẹ mắt đoán hình ảnh, bài hát và câu hỏi kiến thức với đồng nghiệp',
              route: '/games/quiz',
            },
          ],
        },
      });
      return;
    }

    if (url.pathname === '/api/games/quiz/sets') {
      await route.fulfill({
        json: {
          data: [
            { id: 1, title: 'Bộ câu hỏi Đoán Logo Công Ty', category: 'Thương Hiệu' },
            { id: 2, title: 'Bộ câu hỏi Nhạc Trẻ Việt', category: 'Âm Nhạc' },
          ],
        },
      });
      return;
    }

    if (url.pathname === '/api/games/quiz/active-room') {
      await route.fulfill({
        json: {
          data: {
            room: options.hasActiveRoom ? { id: 91, code: 'QZ9999', title: 'Phòng Thử Thách Đoán Hình' } : null,
          },
        },
      });
      return;
    }

    if (url.pathname === '/api/games/quiz/rooms' && method === 'GET') {
      await route.fulfill({
        json: {
          data: [
            {
              id: 91,
              code: 'QZ9999',
              title: 'Phòng Thử Thách Đoán Hình',
              mode: 'IMAGE',
              maxPlayers: 8,
              playerCount: 3,
              status: 'WAITING',
              host: mockUser,
              players: mockPlayers,
            },
          ],
        },
      });
      return;
    }

    if (url.pathname === '/api/games/quiz/rooms' && method === 'POST') {
      requestCounters.createRoom = (requestCounters.createRoom || 0) + 1;
      if (options.delayCreate) {
        await new Promise((r) => setTimeout(r, 400));
      }
      await route.fulfill({
        json: {
          data: {
            room: {
              id: 92,
              code: 'QZ8888',
              title: 'Phòng Đấu Mới Tạo',
              mode: 'IMAGE',
              hostUserId: 10,
              host: mockUser,
              maxPlayers: 8,
              totalQuestions: 10,
              status: 'WAITING',
            },
            players: [
              { id: 1, roomId: 92, userId: 10, user: mockUser, score: 0 },
            ],
          },
        },
      });
      return;
    }

    if (url.pathname.match(/\/api\/games\/quiz\/rooms\/[^/]+$/) && method === 'GET') {
      await route.fulfill({
        json: {
          data: {
            room: {
              id: 91,
              code: 'QZ9999',
              title: 'Phòng Thử Thách Đoán Hình',
              mode: currentQuestion?.type || 'IMAGE',
              status: roomStatus,
              hostUserId: 10,
              host: mockUser,
              maxPlayers: 8,
              totalQuestions: 10,
              currentQuestionIndex: 0,
              questionStartTime: Date.now() - 2000,
              questionDurationMs: 10000,
            },
            players: mockPlayers,
            currentQuestion: roomStatus === 'PLAYING' || roomStatus === 'SHOWING_RESULT' ? currentQuestion : null,
            myAnswer: options.myAnswer || null,
            roundResults: options.roundResults || null,
          },
        },
      });
      return;
    }

    if (url.pathname.match(/\/api\/games\/quiz\/rooms\/[^/]+\/join$/) && method === 'POST') {
      await route.fulfill({
        json: {
          data: {
            room: {
              id: 91,
              code: 'QZ9999',
              title: 'Phòng Thử Thách Đoán Hình',
              mode: 'IMAGE',
              status: 'WAITING',
              hostUserId: 10,
              host: mockUser,
              maxPlayers: 8,
            },
            players: mockPlayers,
          },
        },
      });
      return;
    }

    if (url.pathname.match(/\/api\/games\/quiz\/rooms\/[^/]+\/start$/) && method === 'POST') {
      await route.fulfill({
        json: {
          data: {
            room: {
              id: 91,
              code: 'QZ9999',
              status: 'PLAYING',
              hostUserId: 10,
            },
            question: currentQuestion,
            questionIndex: 0,
            totalQuestions: 10,
          },
        },
      });
      return;
    }

    if (url.pathname.match(/\/api\/games\/quiz\/rooms\/[^/]+\/answer$/) && method === 'POST') {
      requestCounters.submitAnswer = (requestCounters.submitAnswer || 0) + 1;
      if (options.delayAnswer) {
        await new Promise((r) => setTimeout(r, 400));
      }
      await route.fulfill({
        json: {
          data: {
            answer: {
              id: 101,
              userId: 10,
              questionId: currentQuestion?.id || 501,
              selectedOption: 'D',
              isCorrect: true,
              score: 850,
              responseTimeMs: 2100,
            },
          },
        },
      });
      return;
    }

    if (url.pathname.match(/\/api\/games\/quiz\/rooms\/[^/]+\/leave$/) && method === 'POST') {
      await route.fulfill({ json: { ok: true, data: { success: true } } });
      return;
    }

    if (url.pathname === '/api/games/quiz/leaderboard') {
      await route.fulfill({
        json: {
          data: [
            { id: 1, userId: 10, user: mockUser, totalScore: 12500, gamesWon: 14, accuracy: 88 },
            { id: 2, userId: 11, user: mockPlayers[1].user, totalScore: 11200, gamesWon: 10, accuracy: 82 },
          ],
        },
      });
      return;
    }

    if (url.pathname === '/api/games/quiz/my-stats') {
      await route.fulfill({
        json: {
          data: {
            totalScore: 12500,
            gamesPlayed: 20,
            gamesWon: 14,
            correctAnswers: 160,
            totalAnswers: 180,
            accuracy: 88,
          },
        },
      });
      return;
    }

    // Default fallback
    await route.fulfill({ json: { ok: true, data: {} } });
  });
}

test.describe('Đoán Hình & Đoán Nhạc Game MVP', () => {
  test('1. Game Catalog navigation to /games/quiz lobby (Strict button click)', async ({ page }) => {
    await setupQuizMocks(page);
    await page.goto('/games');

    await expect(page.getByRole('heading', { name: /Danh Mục Trò Chơi/i })).toBeVisible({ timeout: 5000 });
    const quizCard = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Đoán Hình & Đoán Nhạc' }) });
    const playBtn = quizCard.getByRole('button', { name: 'Chơi ngay' });
    await expect(playBtn).toBeVisible();
    await playBtn.click();

    await expect(page).toHaveURL(/\/games\/quiz/);
    await expect(page.getByRole('heading', { name: 'Đoán Hình & Đoán Nhạc' })).toBeVisible();
    await expect(page.locator('.quiz-game-shell').getByText('Phòng Thử Thách Đoán Hình').first()).toBeVisible();
  });

  test('2. Lobby tabs, filter by mode, and quick join by room code', async ({ page }) => {
    await setupQuizMocks(page);
    await page.goto('/games/quiz');

    // Filter by mode
    const imageFilterBtn = page.locator('button:has-text("Đoán Hình")').first();
    await expect(imageFilterBtn).toBeVisible();
    await imageFilterBtn.click();

    // Switch to Leaderboard tab
    const lbTabBtn = page.locator('button:has-text("Bảng Xếp Hạng")').first();
    await expect(lbTabBtn).toBeVisible();
    await lbTabBtn.click();
    await expect(page.locator('.quiz-game-shell').getByText('12,500').first()).toBeVisible();

    // Switch back to Rooms tab
    const roomsTabBtn = page.locator('button:has-text("Sảnh Phòng Đấu")').first();
    await roomsTabBtn.click();

    // Quick Join input
    const codeInput = page.locator('input[placeholder*="QZ"]').first();
    await expect(codeInput).toBeVisible();
    await codeInput.fill('QZ9999');
    await codeInput.press('Enter');

    await expect(page).toHaveURL(/\/games\/quiz\/room\/91/);
  });

  test('3. Create room modal with double-click submit protection', async ({ page }) => {
    const requestCounters = {};
    await setupQuizMocks(page, { delayCreate: true, requestCounters });
    await page.goto('/games/quiz');

    const openCreateBtn = page.locator('button:has-text("Tạo Phòng Chơi"), button:has-text("Tạo phòng")').first();
    await expect(openCreateBtn).toBeVisible();
    await openCreateBtn.click();

    // Modal dialog
    await expect(page.locator('text=Tạo Phòng Đấu Quiz Mới')).toBeVisible();
    const titleInput = page.locator('input[placeholder*="Nhập tên phòng"]').first();
    await titleInput.fill('Phòng Đấu Mới Tạo');

    // Select mode Đoán Hình
    const modeBtn = page.locator('button:has-text("Đoán Hình")').last();
    await modeBtn.click();

    // Fast double click on submit button
    const submitBtn = page.locator('button[type="submit"]:has-text("Tạo phòng")').last();
    await submitBtn.click({ clickCount: 2, delay: 50 });

    await expect(page).toHaveURL(/\/games\/quiz\/room\/92/);
    // Verified: exactly 1 create room request sent despite double-click
    expect(requestCounters.createRoom).toBe(1);
  });

  test('4. Waiting room displays room code, players, and host start action', async ({ page }) => {
    await setupQuizMocks(page, { roomStatus: 'WAITING' });
    await page.goto('/games/quiz/room/91');

    await expect(page.getByRole('heading', { name: 'Phòng Thử Thách Đoán Hình' })).toBeVisible();
    await expect(page.locator('.quiz-game-shell').getByText('#QZ9999').first()).toBeVisible();
    await expect(page.locator('.quiz-game-shell').getByText('Danh Sách Người Chơi').first()).toBeVisible();
    await expect(page.locator('.quiz-game-shell').getByText('Đặng Tuấn Anh').first()).toBeVisible();

    // Host button
    const startBtn = page.locator('button:has-text("BẮT ĐẦU TRẬN ĐẤU")');
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toBeEnabled();
  });

  test('5. Active gameplay with image stage, 4 option pills, and answer double-click lock', async ({ page }) => {
    const requestCounters = {};
    await setupQuizMocks(page, { roomStatus: 'PLAYING', delayAnswer: true, requestCounters });
    await page.goto('/games/quiz/room/91');

    // Question card & image box
    await expect(page.locator('text=Đây là logo biểu tượng của công ty công nghệ nổi tiếng nào?')).toBeVisible();
    await expect(page.locator('text=Đoán Logo & Thương Hiệu')).toBeVisible();
    await expect(page.locator('img[alt="Quiz visual prompt"]')).toBeVisible();

    // 4 Answer Options
    const optD = page.locator('button:has-text("WorkRank")').first();
    await expect(optD).toBeVisible();

    // Double click option D
    await optD.click({ clickCount: 2, delay: 50 });

    // Verify option is marked as selected / locked and cannot be clicked again
    await expect(page.locator('text=ĐÃ CHỌN')).toBeVisible();
    await expect(optD).toBeDisabled();

    // Verify bottom strip shows user has answered
    await expect(page.locator('text=Đã trả lời (1/3)').first()).toBeVisible();

    // Verified: only 1 submitAnswer API call sent
    expect(requestCounters.submitAnswer).toBe(1);
  });

  test('6. Active gameplay with Music stage and audio visualizer', async ({ page }) => {
    await setupQuizMocks(page, {
      roomStatus: 'PLAYING',
      currentQuestion: mockMusicQuestion,
    });
    await page.goto('/games/quiz/room/91');

    // Music stage prompt
    await expect(page.locator('text=Đoạn nhạc trên trích từ ca khúc nổi tiếng nào?')).toBeVisible();
    await expect(page.locator('text=Nhạc Trẻ Việt')).toBeVisible();
    await expect(page.locator('text=Giai Điệu Bài Hát')).toBeVisible();
    await expect(page.locator('text=Lắng nghe và chọn đáp án chính xác')).toBeVisible();

    // Answer options for music
    await expect(page.locator('button:has-text("Nơi Này Có Anh")')).toBeVisible();
  });

  test('7. Broken image fallback displays error placeholder gracefully', async ({ page }) => {
    const brokenQuestion = {
      ...mockImageQuestion,
      imageUrl: 'https://127.0.0.1:59999/non-existent-broken-image.jpg',
    };

    await setupQuizMocks(page, {
      roomStatus: 'PLAYING',
      currentQuestion: brokenQuestion,
    });
    await page.goto('/games/quiz/room/91');

    // Verify error fallback is rendered gracefully
    await expect(page.locator('text=Không thể tải hình ảnh')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Vui lòng chú ý câu hỏi và các lựa chọn đáp án')).toBeVisible();
  });

  test('8. Round result reveal modal (2-stage review)', async ({ page }) => {
    await setupQuizMocks(page, {
      roomStatus: 'SHOWING_RESULT',
      myAnswer: { isCorrect: true, score: 850, selectedOption: 'D' },
      roundResults: [
        { userId: 10, isCorrect: true, score: 850, selectedOption: 'D', responseTimeMs: 2100 },
        { userId: 11, isCorrect: true, score: 920, selectedOption: 'D', responseTimeMs: 1400 },
      ],
    });
    await page.goto('/games/quiz/room/91');

    // Stage 1 reveal: Outcome & explanation
    await expect(page.locator('text=CHÍNH XÁC!')).toBeVisible();
    await expect(page.locator('text=+850 điểm')).toBeVisible();
    await expect(page.locator('text=WorkRank là nền tảng quản lý năng suất')).toBeVisible();

    // Stage 2 transition: Mini standings
    await expect(page.locator('text=Điểm Số Vòng Này')).toBeVisible({ timeout: 4000 });
    await expect(page.locator('text=Nguyễn Hoài Nam')).toBeVisible();
  });

  test('9. Final results screen (FINISHED state) with podium, stats and replay buttons', async ({ page }) => {
    await setupQuizMocks(page, { roomStatus: 'FINISHED' });
    await page.goto('/games/quiz/room/91');

    // Top Header & Podium
    await expect(page.locator('text=KẾT QUẢ CHUNG CUỘC')).toBeVisible();
    await expect(page.locator('text=QUÁN QUÂN')).toBeVisible();
    await expect(page.locator('text=HẠNG 2')).toBeVisible();
    await expect(page.locator('text=HẠNG 3')).toBeVisible();

    // Personal Match Stats Card
    await expect(page.locator('text=THỨ HẠNG')).toBeVisible();
    await expect(page.locator('text=TỔNG ĐIỂM')).toBeVisible();
    await expect(page.locator('text=SỐ CÂU ĐÚNG')).toBeVisible();

    // Action buttons
    const playAgainBtn = page.locator('button:has-text("Chơi Lại")');
    const backToLobbyBtn = page.locator('button:has-text("Về Sảnh Chờ")');
    await expect(playAgainBtn).toBeVisible();
    await expect(backToLobbyBtn).toBeVisible();

    // Click back to lobby
    await backToLobbyBtn.click();
    await expect(page).toHaveURL(/\/games\/quiz/);
  });

  test('10. Continuous countdown timer bounds verification', async ({ page }) => {
    await setupQuizMocks(page, { roomStatus: 'PLAYING' });
    await page.goto('/games/quiz/room/91');

    // Check timer bar is visible
    const timerBar = page.locator('.quiz-game-left-col');
    await expect(timerBar).toBeVisible();

    // Verify timer does not show negative seconds
    const pageText = await page.locator('.quiz-game-shell').innerText();
    expect(pageText).not.toMatch(/-\d+s/);
  });

  test('11. Responsive viewport checks across Mobile, Tablet, and Desktop with zero horizontal overflow', async ({ page }) => {
    const viewports = [
      { name: 'Mobile 390x844', width: 390, height: 844 },
      { name: 'Mobile Max 430x932', width: 430, height: 932 },
      { name: 'Tablet 768x1024', width: 768, height: 1024 },
      { name: 'Desktop 1280x800', width: 1280, height: 800 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setupQuizMocks(page, { roomStatus: 'PLAYING' });
      await page.goto('/games/quiz/room/91');

      await expect(page.locator('text=Đây là logo biểu tượng của công ty công nghệ nổi tiếng nào?')).toBeVisible();
      await expect(page.locator('button:has-text("WorkRank")')).toBeVisible();

      // Assert zero horizontal overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll).toBe(false);
    }
  });

  test('12. Reduced motion compliance', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setupQuizMocks(page, { roomStatus: 'PLAYING' });
    await page.goto('/games/quiz/room/91');

    await expect(page.locator('text=Đây là logo biểu tượng của công ty công nghệ nổi tiếng nào?')).toBeVisible();
  });
});
