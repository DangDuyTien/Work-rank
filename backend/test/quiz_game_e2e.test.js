'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const request = require('supertest');
const { Server } = require('socket.io');
const ioClient = require('../../frontend/node_modules/socket.io-client');
const app = require('../src/app');
const { Op } = require('sequelize');
const {
  sequelize,
  User,
  QuizSet,
  QuizRoom,
  QuizPlayer,
  QuizQuestion,
  QuizAnswer,
  QuizUserStat,
} = require('../src/models');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const quizService = require('../src/services/quizGame.service');
const quizRealtime = require('../src/services/quizRealtime.service');
const registerSockets = require('../src/sockets');

test('Comprehensive Quiz Game V1 (Đoán Hình – Đoán Nhạc) E2E & Realtime Test Suite', async (t) => {
  let hostUser, player2, player3;
  let hostToken, token2, token3;
  let testRoomId = null;
  let testRoomCode = null;
  let question1Id = null;

  // Real Socket.IO Test Server
  let server;
  let serverPort;
  let socketIo;
  let hostSocket;
  let player2Socket;

  before(async () => {
    // Sync tables
    await QuizRoom.sync();
    await QuizPlayer.sync();
    await QuizQuestion.sync();
    await QuizAnswer.sync();
    await QuizUserStat.sync();

    // Create explicit test questions for this test suite
    const testQuestions = [];
    for (let i = 1; i <= 6; i++) {
      testQuestions.push({
        type: 'IMAGE',
        category: 'Công nghệ',
        question: `Test Image Question ${i}?`,
        imageUrl: `https://picsum.photos/seed/test${i}/600/400`,
        optionA: 'Đáp án A',
        optionB: 'Đáp án B',
        optionC: 'Đáp án C',
        optionD: 'Đáp án D',
        correctOption: 'A',
        timeLimit: 15,
        points: 1000,
        orderIndex: i,
        isActive: true,
      });
    }
    for (let i = 7; i <= 12; i++) {
      testQuestions.push({
        type: 'MUSIC',
        category: 'Âm nhạc',
        question: `Test Music Question ${i}?`,
        audioUrl: `https://actions.google.com/sounds/v1/science_fiction/alien_breath_${i}.ogg`,
        optionA: 'Bài hát A',
        optionB: 'Bài hát B',
        optionC: 'Bài hát C',
        optionD: 'Bài hát D',
        correctOption: 'B',
        timeLimit: 15,
        points: 1000,
        orderIndex: i,
        isActive: true,
      });
    }
    await QuizQuestion.bulkCreate(testQuestions);

    const ts = Date.now();
    hostUser = await User.create({
      name: `Quiz Host ${ts}`,
      email: `quiz_host_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Game Master',
      department: 'Phòng Giải Trí',
    });

    player2 = await User.create({
      name: `Speedy Guess ${ts}`,
      email: `speedy_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Sound Specialist',
      department: 'Phòng Âm Thanh',
    });

    player3 = await User.create({
      name: `Image Expert ${ts}`,
      email: `expert_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Visual Artist',
      department: 'Phòng Đồ Họa',
    });

    hostToken = jwt.sign({ sub: hostUser.id, role: hostUser.role }, env.jwtSecret);
    token2 = jwt.sign({ sub: player2.id, role: player2.role }, env.jwtSecret);
    token3 = jwt.sign({ sub: player3.id, role: player3.role }, env.jwtSecret);

    // Initialize real HTTP + Socket.IO server on random port
    server = http.createServer(app);
    socketIo = new Server(server, { cors: { origin: '*' } });
    registerSockets(socketIo);
    quizRealtime.setIo(socketIo);

    await new Promise((resolve) => {
      server.listen(0, () => {
        serverPort = server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    if (hostSocket && hostSocket.connected) hostSocket.disconnect();
    if (player2Socket && player2Socket.connected) player2Socket.disconnect();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    await QuizAnswer.destroy({ where: {} }).catch(() => {});
    if (testRoomId) {
      await QuizPlayer.destroy({ where: { roomId: testRoomId } }).catch(() => {});
      await QuizRoom.destroy({ where: { id: testRoomId } }).catch(() => {});
    }
    await QuizQuestion.destroy({ where: { question: { [Op.like]: 'Test % Question %' } } }).catch(() => {});
  });

  await t.test('1. Test Questions Verification: Image & Music questions exist', async () => {
    const questions = await QuizQuestion.findAll({ where: { isActive: true } });
    assert.ok(questions.length >= 10, 'Should have at least 10 test questions');
    const imageCount = questions.filter((q) => q.type === 'IMAGE').length;
    const musicCount = questions.filter((q) => q.type === 'MUSIC').length;
    assert.ok(imageCount >= 5, 'Should have at least 5 Image questions');
    assert.ok(musicCount >= 5, 'Should have at least 5 Music questions');
  });

  await t.test('2. Room Lifecycle: Create room with ALL mode', async () => {
    const res = await request(app)
      .post('/api/games/quiz/rooms')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        title: 'Thử Thách Đoán Hình Đoán Nhạc Vui Nhộn',
        mode: 'ALL',
        maxPlayers: 10,
        totalQuestions: 5,
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.data.room.id);
    assert.ok(res.body.data.room.code);
    assert.equal(res.body.data.room.title, 'Thử Thách Đoán Hình Đoán Nhạc Vui Nhộn');
    assert.equal(res.body.data.room.mode, 'ALL');
    assert.equal(res.body.data.room.status, 'WAITING');
    assert.equal(res.body.data.players.length, 1);
    assert.equal(res.body.data.players[0].userId, hostUser.id);

    testRoomId = res.body.data.room.id;
    testRoomCode = res.body.data.room.code;
  });

  await t.test('3. Room Code Resolution & Endpoint Uniformity (QZXXXX, #QZXXXX, qzxxxx, 404s)', async () => {
    // 1. GET with standard code 'QZXXXX'
    const resCode = await request(app)
      .get(`/api/games/quiz/rooms/${testRoomCode}`)
      .set('Authorization', `Bearer ${token2}`);
    assert.equal(resCode.status, 200);
    assert.equal(resCode.body.data.room.id, testRoomId);

    // 2. GET with hashtag '#QZXXXX'
    const resHash = await request(app)
      .get(`/api/games/quiz/rooms/%23${testRoomCode}`)
      .set('Authorization', `Bearer ${token2}`);
    assert.equal(resHash.status, 200);
    assert.equal(resHash.body.data.room.id, testRoomId);

    // 3. GET with lowercase 'qzxxxx'
    const resLower = await request(app)
      .get(`/api/games/quiz/rooms/${testRoomCode.toLowerCase()}`)
      .set('Authorization', `Bearer ${token2}`);
    assert.equal(resLower.status, 200);
    assert.equal(resLower.body.data.room.id, testRoomId);

    // 4. GET with non-existent code
    const resNotFoundCode = await request(app)
      .get('/api/games/quiz/rooms/QZ999999NOTFOUND')
      .set('Authorization', `Bearer ${token2}`);
    assert.equal(resNotFoundCode.status, 404);

    // 5. GET with non-existent numeric ID
    const resNotFoundId = await request(app)
      .get('/api/games/quiz/rooms/999999999')
      .set('Authorization', `Bearer ${token2}`);
    assert.equal(resNotFoundId.status, 404);

    // 6. GET with invalid random string
    const resInvalidStr = await request(app)
      .get('/api/games/quiz/rooms/invalid_room_string!')
      .set('Authorization', `Bearer ${token2}`);
    assert.equal(resInvalidStr.status, 404);
  });

  await t.test('4. Room Joining: Multiple players join room via Code and ID', async () => {
    // Player 2 joins using room code 'QZXXXX'
    const res2 = await request(app)
      .post(`/api/games/quiz/rooms/${testRoomCode}/join`)
      .set('Authorization', `Bearer ${token2}`)
      .send();

    assert.equal(res2.status, 200);
    assert.equal(res2.body.data.players.length, 2);

    // Player 3 joins using numeric testRoomId
    const res3 = await request(app)
      .post(`/api/games/quiz/rooms/${testRoomId}/join`)
      .set('Authorization', `Bearer ${token3}`)
      .send();

    assert.equal(res3.status, 200);
    assert.equal(res3.body.data.players.length, 3);

    // Duplicate join by Player 2 should be idempotent
    const resDup = await request(app)
      .post(`/api/games/quiz/rooms/${testRoomCode.toLowerCase()}/join`)
      .set('Authorization', `Bearer ${token2}`)
      .send();

    assert.equal(resDup.status, 200);
    assert.equal(resDup.body.data.players.length, 3);
  });

  await t.test('5. Security: Non-host cannot start match', async () => {
    const res = await request(app)
      .post(`/api/games/quiz/rooms/${testRoomCode}/start`)
      .set('Authorization', `Bearer ${token2}`)
      .send();

    assert.equal(res.status, 400);
    assert.match(res.body.message, /Chỉ có chủ phòng/);
  });

  await t.test('6. Host Starts Match: Random questions chosen & sanitized against data leaks', async () => {
    const res = await request(app)
      .post(`/api/games/quiz/rooms/${testRoomCode}/start`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send();

    assert.equal(res.status, 200);
    const roomState = res.body.data;
    assert.equal(roomState.room.status, 'PLAYING');
    assert.ok(roomState.currentQuestion);
    assert.ok(roomState.currentQuestion.id);

    // CRITICAL SECURITY CHECKS: correctOption, correct_option, explanation, roundResults MUST NOT be leaked during PLAYING
    assert.equal(roomState.currentQuestion.correctOption, undefined, 'Must not leak correctOption in PLAYING');
    assert.equal(roomState.currentQuestion.correct_option, undefined, 'Must not leak correct_option in PLAYING');
    assert.equal(roomState.currentQuestion.explanation, undefined, 'Must not leak explanation in PLAYING');
    assert.equal(roomState.roundResults, null, 'Must not leak roundResults in PLAYING');

    question1Id = roomState.currentQuestion.id;
  });

  await t.test('7. Answer Submission & Scoring: Fast correct vs Slow vs Wrong answers', async () => {
    // Get actual correct option from DB to test scoring
    const rawQ = await QuizQuestion.findByPk(question1Id);
    const correctOpt = rawQ.correctOption;
    const wrongOpt = correctOpt === 'A' ? 'B' : 'A';

    // Player 2 answers correctly and quickly
    const resP2 = await request(app)
      .post(`/api/games/quiz/rooms/${testRoomCode}/answer`)
      .set('Authorization', `Bearer ${token2}`)
      .send({
        questionId: question1Id,
        selectedOption: correctOpt,
      });

    assert.equal(resP2.status, 200);
    assert.equal(resP2.body.data.success, true);
    assert.equal(resP2.body.data.answer.isCorrect, true);
    assert.ok(resP2.body.data.answer.score >= 500, 'Fast correct answer should earn > 500 points');

    // Host answers with WRONG option
    const resHost = await request(app)
      .post(`/api/games/quiz/rooms/${testRoomId}/answer`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        questionId: question1Id,
        selectedOption: wrongOpt,
      });

    assert.equal(resHost.status, 200);
    assert.equal(resHost.body.data.answer.isCorrect, false);
    assert.equal(resHost.body.data.answer.score, 0);

    // Player 3 answers correctly with a deliberate slight delay
    const resP3 = await request(app)
      .post(`/api/games/quiz/rooms/${testRoomCode.toLowerCase()}/answer`)
      .set('Authorization', `Bearer ${token3}`)
      .send({
        questionId: question1Id,
        selectedOption: correctOpt,
      });

    assert.equal(resP3.status, 200);
    assert.equal(resP3.body.data.answer.isCorrect, true);
    // Earlier answer (Player 2) gets >= Player 3 score
    assert.ok(resP2.body.data.answer.score >= resP3.body.data.answer.score, 'Earlier correct answer must get more or equal points than later correct answer');
  });

  await t.test('8. Anti-Double Submit & Concurrency Hardening: Promise.all race condition protection', async () => {
    const rawQ = await QuizQuestion.findByPk(question1Id);

    // Sequential repeat submit -> idempotent 200 with alreadySubmitted = true
    const resRepeat = await request(app)
      .post(`/api/games/quiz/rooms/${testRoomCode}/answer`)
      .set('Authorization', `Bearer ${token2}`)
      .send({
        questionId: question1Id,
        selectedOption: rawQ.correctOption,
      });

    assert.equal(resRepeat.status, 200);
    assert.equal(resRepeat.body.data.alreadySubmitted, true);

    // Concurrent race condition test: 5 simultaneous HTTP requests for Player 2
    const concurrentRequests = Array.from({ length: 5 }, () =>
      request(app)
        .post(`/api/games/quiz/rooms/${testRoomCode}/answer`)
        .set('Authorization', `Bearer ${token2}`)
        .send({
          questionId: question1Id,
          selectedOption: rawQ.correctOption,
        })
    );

    const results = await Promise.all(concurrentRequests);
    for (const r of results) {
      assert.equal(r.status, 200, 'Concurrent answer requests must return 200 without throwing 500 error');
    }

    // Verify database integrity: exactly 1 QuizAnswer record for (roomId, question1Id, player2.id)
    const answerRecords = await QuizAnswer.findAll({
      where: { roomId: testRoomId, questionId: question1Id, userId: player2.id },
    });
    assert.equal(answerRecords.length, 1, 'Exactly one answer record must exist despite concurrent attempts');
  });

  await t.test('9. Reconnection State: User reconnects and gets active room with answered status', async () => {
    const resActive = await request(app)
      .get('/api/games/quiz/active-room')
      .set('Authorization', `Bearer ${token2}`)
      .send();

    assert.equal(resActive.status, 200);
    assert.ok(resActive.body.data);
    assert.equal(resActive.body.data.room.id, testRoomId);
    assert.ok(resActive.body.data.myAnswer);
    assert.ok(Array.isArray(resActive.body.data.answeredUserIds));
    assert.ok(resActive.body.data.answeredUserIds.includes(Number(player2.id)));
    assert.equal(resActive.body.data.maxPoints, 1000);
  });

  await t.test('10. Question Reveal & Progression: Reveal results & check leaderboard & fastest correct', async () => {
    await quizService.revealQuestionResult(testRoomId);

    const roomState = await quizService.getRoomState(testRoomId, hostUser.id);
    assert.equal(roomState.room.status, 'SHOWING_RESULT');
    assert.ok(roomState.currentQuestion.correctOption, 'After reveal, correctOption is visible');
    assert.ok(roomState.roundResults.length >= 3);

    // Player 2 should be ranked #1
    assert.equal(roomState.players[0].userId, player2.id);
  });

  await t.test('11. Realtime Socket.IO Integration: Two real clients receive joined, started, answered, and results', async () => {
    const socketUrl = `http://127.0.0.1:${serverPort}`;

    // 1. Connect Host Socket
    hostSocket = ioClient(socketUrl, {
      auth: { token: hostToken },
      transports: ['websocket'],
      reconnection: false,
    });

    // 2. Connect Player 2 Socket
    player2Socket = ioClient(socketUrl, {
      auth: { token: token2 },
      transports: ['websocket'],
      reconnection: false,
    });

    await Promise.all([
      new Promise((resolve) => hostSocket.on('connect', resolve)),
      new Promise((resolve) => player2Socket.on('connect', resolve)),
    ]);

    assert.ok(hostSocket.connected, 'Host socket should connect');
    assert.ok(player2Socket.connected, 'Player 2 socket should connect');

    // Create a new fresh room for realtime testing
    const rtRoomRes = await request(app)
      .post('/api/games/quiz/rooms')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        title: 'Realtime Socket.IO Live Match',
        mode: 'IMAGE',
        maxPlayers: 4,
        totalQuestions: 3,
      });
    const rtRoom = rtRoomRes.body.data.room;

    // Host joins room channel
    hostSocket.emit('quiz:joinRoom', { roomId: rtRoom.id });

    // Listen for playerJoined on hostSocket
    const joinedPromise = new Promise((resolve) => {
      hostSocket.once('quiz:playerJoined', (data) => resolve(data));
    });

    // Player 2 joins room via API then connects to socket room
    await request(app)
      .post(`/api/games/quiz/rooms/${rtRoom.id}/join`)
      .set('Authorization', `Bearer ${token2}`)
      .send();
    player2Socket.emit('quiz:joinRoom', { roomId: rtRoom.code });

    const joinedData = await joinedPromise;
    assert.ok(joinedData, 'Host must receive quiz:playerJoined event');
    assert.equal(joinedData.players.length, 2);

    // Listen for quiz:started on both sockets
    const startPromiseHost = new Promise((resolve) => hostSocket.once('quiz:started', (d) => resolve(d)));
    const startPromiseP2 = new Promise((resolve) => player2Socket.once('quiz:started', (d) => resolve(d)));

    // Host starts game
    await request(app)
      .post(`/api/games/quiz/rooms/${rtRoom.id}/start`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send();

    const [startDataHost, startDataP2] = await Promise.all([startPromiseHost, startPromiseP2]);
    assert.ok(startDataHost.question, 'Host must receive game question');
    assert.ok(startDataP2.question, 'Player 2 must receive game question');
    assert.equal(startDataHost.question.correctOption, undefined, 'Socket payload must not leak correctOption');

    const rtQuestionId = startDataHost.question.id;

    // Listen for quiz:player_answered on Host when Player 2 answers
    const answeredPromise = new Promise((resolve) => {
      hostSocket.once('quiz:player_answered', (d) => resolve(d));
    });

    await request(app)
      .post(`/api/games/quiz/rooms/${rtRoom.id}/answer`)
      .set('Authorization', `Bearer ${token2}`)
      .send({
        questionId: rtQuestionId,
        selectedOption: 'A',
      });

    const answeredData = await answeredPromise;
    assert.ok(answeredData, 'Host must receive player_answered event');
    assert.equal(Number(answeredData.userId), Number(player2.id));

    // Clean up realtime test room
    await QuizAnswer.destroy({ where: { roomId: rtRoom.id } });
    await QuizPlayer.destroy({ where: { roomId: rtRoom.id } });
    await QuizRoom.destroy({ where: { id: rtRoom.id } });
  });

  await t.test('12. Game Finish & Stats: Finish match and verify career stats', async () => {
    await quizService.finishGame(testRoomId);

    const finishedState = await quizService.getRoomState(testRoomId);
    assert.equal(finishedState.room.status, 'FINISHED');
    assert.equal(finishedState.room.winnerUserId, player2.id);

    // Check career stats
    const p2Stats = await quizService.getMyStats(player2.id);
    assert.ok(p2Stats.gamesPlayed >= 1);
    assert.ok(p2Stats.gamesWon >= 1);
    assert.ok(p2Stats.totalScore > 0);

    // Check leaderboard endpoint
    const lbRes = await request(app)
      .get('/api/games/quiz/leaderboard')
      .set('Authorization', `Bearer ${token2}`)
      .send();

    assert.equal(lbRes.status, 200);
    assert.ok(Array.isArray(lbRes.body.data));
    assert.ok(lbRes.body.data.length >= 1);
  });

  await t.test('13. Game Modes: Create and verify IMAGE and MUSIC specific mode rooms', async () => {
    // 1. Create IMAGE mode room
    const imgRes = await request(app)
      .post('/api/games/quiz/rooms')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        title: 'Phòng Thi Đoán Hình Ảnh',
        mode: 'IMAGE',
        maxPlayers: 8,
        totalQuestions: 4,
      });
    assert.equal(imgRes.status, 201);
    assert.equal(imgRes.body.data.room.mode, 'IMAGE');
    const imgRoomId = imgRes.body.data.room.id;

    // Start IMAGE room
    const imgStartRes = await request(app)
      .post(`/api/games/quiz/rooms/${imgRoomId}/start`)
      .set('Authorization', `Bearer ${hostToken}`);
    assert.equal(imgStartRes.status, 200);
    assert.equal(imgStartRes.body.data.currentQuestion.type, 'IMAGE');

    // 2. Create MUSIC mode room
    const musicRes = await request(app)
      .post('/api/games/quiz/rooms')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        title: 'Phòng Thi Đoán Giai Điệu Bài Hát',
        mode: 'MUSIC',
        maxPlayers: 8,
        totalQuestions: 4,
      });
    assert.equal(musicRes.status, 201);
    assert.equal(musicRes.body.data.room.mode, 'MUSIC');
    const musicRoomId = musicRes.body.data.room.id;

    // Start MUSIC room
    const musicStartRes = await request(app)
      .post(`/api/games/quiz/rooms/${musicRoomId}/start`)
      .set('Authorization', `Bearer ${hostToken}`);
    assert.equal(musicStartRes.status, 200);
    assert.equal(musicStartRes.body.data.currentQuestion.type, 'MUSIC');

    // Clean up
    await QuizRoom.destroy({ where: { id: [imgRoomId, musicRoomId] } });
    await QuizPlayer.destroy({ where: { roomId: [imgRoomId, musicRoomId] } });
  });

  await t.test('14. Admin Quiz Management: Role guard, Set CRUD & Question CRUD', async () => {
    const adminUser = await User.create({
      name: `Quiz Admin ${Date.now()}`,
      email: `quiz_admin_${Date.now()}@workrank.io`,
      passwordHash: 'hash',
      role: 'admin',
    });
    const adminToken = jwt.sign({ sub: adminUser.id, role: adminUser.role }, env.jwtSecret);

    // Guard test: non-admin gets 403
    const forbiddenRes = await request(app)
      .get('/api/admin/quiz/questions')
      .set('Authorization', `Bearer ${token2}`);
    assert.equal(forbiddenRes.status, 403);

    // 1. Create Quiz Set
    const setRes = await request(app)
      .post('/api/admin/quiz/sets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Bộ Câu Hỏi Công Nghệ 2026',
        description: 'Tổng hợp câu hỏi công nghệ AI, React, Node.js',
        category: 'Công nghệ',
        isActive: true,
      });
    assert.equal(setRes.status, 201);
    assert.ok(setRes.body.data.id);
    const setId = setRes.body.data.id;

    // 2. Create Question with image
    const qRes = await request(app)
      .post('/api/admin/quiz/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        quizSetId: setId,
        type: 'IMAGE',
        category: 'Công nghệ',
        question: 'Đây là logo của framework nào?',
        imageUrl: '/uploads/quiz/demo-logo.png',
        optionA: 'React',
        optionB: 'Vue',
        optionC: 'Angular',
        optionD: 'Svelte',
        correctOption: 'A',
        explanation: 'React do Meta phát triển.',
        timeLimit: 15,
        points: 1000,
      });
    assert.equal(qRes.status, 201);
    assert.ok(qRes.body.data.id);
    const createdQId = qRes.body.data.id;
    assert.equal(qRes.body.data.correctOption, 'A');

    // 3. Duplicate Question
    const dupRes = await request(app)
      .post(`/api/admin/quiz/questions/${createdQId}/duplicate`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(dupRes.status, 201);
    assert.ok(dupRes.body.data.question.includes('(Bản sao)'));
    const dupQId = dupRes.body.data.id;

    // 4. Update Question
    const updRes = await request(app)
      .put(`/api/admin/quiz/questions/${createdQId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        question: 'Đây là biểu tượng của công nghệ nào? (Đã sửa)',
        points: 1200,
      });
    assert.equal(updRes.status, 200);
    assert.equal(updRes.body.data.points, 1200);

    // 5. List Questions with filters
    const listQRes = await request(app)
      .get('/api/admin/quiz/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ quizSetId: setId });
    assert.equal(listQRes.status, 200);
    assert.equal(listQRes.body.data.length, 2);

    // 6. Delete duplicate question
    const delRes = await request(app)
      .delete(`/api/admin/quiz/questions/${dupQId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(delRes.status, 200);

    // 7. List Sets count
    const listSetsRes = await request(app)
      .get('/api/admin/quiz/sets')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(listSetsRes.status, 200);
    const foundSet = listSetsRes.body.data.find((s) => Number(s.id) === Number(setId));
    assert.ok(foundSet);
    assert.equal(foundSet.questionCount, 1);

    // Clean up created set and question
    await QuizQuestion.destroy({ where: { id: createdQId } });
    await QuizSet.destroy({ where: { id: setId } });
  });
});
