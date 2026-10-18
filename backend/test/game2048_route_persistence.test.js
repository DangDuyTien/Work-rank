'use strict';

const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { Department, Team, User, GameCatalog, Game2048Score, Game2048UserStat } = require('../src/models');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');

test('BUG-008: 2048 Route Navigation & Move Persistence Test Suite', async (t) => {
  let userA, userB;
  let tokenA, tokenB;

  before(async () => {
    await Department.sync();
    await Team.sync();
    await User.sync();
    await GameCatalog.sync();
    await Game2048Score.sync();
    await Game2048UserStat.sync();

    await GameCatalog.findOrCreate({
      where: { gameKey: 'game_2048' },
      defaults: {
        gameKey: 'game_2048',
        name: '2048 Vô Địch',
        route: '/games/2048',
        status: 'AVAILABLE',
        enabled: true,
        sortOrder: 2,
      },
    });

    const ts = Date.now();
    userA = await User.create({
      name: `User 2048 Persist A ${ts}`,
      email: `user_persist_a_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'Developer',
    });

    userB = await User.create({
      name: `User 2048 Persist B ${ts}`,
      email: `user_persist_b_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'Designer',
    });

    tokenA = jwt.sign({ sub: userA.id, role: userA.role }, env.jwtSecret);
    tokenB = jwt.sign({ sub: userB.id, role: userB.role }, env.jwtSecret);
  });

  beforeEach(async () => {
    // Ensure clean state per subtest by finalizing any active sessions
    await Game2048Score.update(
      { status: 'ABANDONED' },
      { where: { userId: userA.id, status: 'ACTIVE' } }
    );
  });

  await t.test('1. Moves that do not increase score (merges vs slides) are persisted via checkpoint', async () => {
    // Start session
    const startRes = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ boardState: [{ id: 1, value: 2, row: 0, col: 0 }, { id: 2, value: 2, row: 0, col: 1 }] });

    assert.equal(startRes.status, 200);
    const sessionId = startRes.body.data.gameSessionId;
    assert.ok(sessionId, 'Valid session ID returned');

    // Initial checkpoint at 176 points, 30 moves
    const cpRes1 = await request(app)
      .post('/api/games/2048/checkpoint')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        score: 176,
        maxTile: 16,
        moves: 30,
        gameSessionId: sessionId,
        boardState: [
          { id: 1, value: 16, row: 0, col: 0 },
          { id: 3, value: 8, row: 0, col: 1 },
        ],
      });

    assert.equal(cpRes1.status, 200);
    assert.equal(cpRes1.body.data.score, 176);

    // Player makes 5 sliding moves that DO NOT increase score (score remains 176, moves increases to 35)
    const updatedBoard = [
      { id: 1, value: 16, row: 3, col: 0 },
      { id: 3, value: 8, row: 3, col: 1 },
      { id: 4, value: 2, row: 2, col: 0 },
    ];

    const cpRes2 = await request(app)
      .post('/api/games/2048/checkpoint')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        score: 176,
        maxTile: 16,
        moves: 35,
        gameSessionId: sessionId,
        boardState: updatedBoard,
      });

    assert.equal(cpRes2.status, 200);
    assert.equal(cpRes2.body.data.score, 176);

    // Verify DB updated moves to 35 and updated boardState
    const sessionInDb = await Game2048Score.findOne({
      where: { gameSessionId: sessionId, userId: userA.id },
    });

    assert.equal(sessionInDb.score, 176);
    assert.equal(sessionInDb.moves, 35);
    const parsedBoard = JSON.parse(sessionInDb.boardState);
    assert.equal(parsedBoard.length, 3);
    assert.equal(parsedBoard[2].value, 2);
  });

  await t.test('2. Audit Repro: 176 points / 30 moves -> 240 points / 45 moves preserved on SPA unmount flush', async () => {
    // Start session
    const startRes = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ boardState: [{ id: 10, value: 2, row: 0, col: 0 }] });

    const sessionId = startRes.body.data.gameSessionId;

    // Checkpoint at 176 points / 30 moves
    await request(app)
      .post('/api/games/2048/checkpoint')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        score: 176,
        maxTile: 16,
        moves: 30,
        gameSessionId: sessionId,
        boardState: [{ id: 10, value: 16, row: 0, col: 0 }],
      });

    // Player continues playing to 240 points / 45 moves
    // On SPA navigation (/games/2048 -> /dashboard), component unmount triggers flush
    const flushRes = await request(app)
      .post('/api/games/2048/checkpoint')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        score: 240,
        maxTile: 32,
        moves: 45,
        gameSessionId: sessionId,
        boardState: [
          { id: 10, value: 32, row: 0, col: 0 },
          { id: 11, value: 8, row: 0, col: 1 },
        ],
      });

    assert.equal(flushRes.status, 200);
    assert.equal(flushRes.body.data.score, 240);

    // Player navigates back to /games/2048: getActiveSession retrieves 240 points / 45 moves
    const activeRes = await request(app)
      .get('/api/games/2048/active-session')
      .set('Authorization', `Bearer ${tokenA}`);

    assert.equal(activeRes.status, 200);
    assert.ok(activeRes.body.data, 'Active session data exists');
    assert.equal(activeRes.body.data.score, 240, 'Score is 240 (NOT degraded to 176)');
    assert.equal(activeRes.body.data.moves, 45, 'Moves is 45 (NOT degraded to 30)');
    assert.equal(activeRes.body.data.maxTile, 32);
    assert.equal(activeRes.body.data.boardState.length, 2);
  });

  await t.test('3. Zero-loss on leaving page in < 25s: immediate flush retains score delta under 500', async () => {
    // User plays from 0 to 64 points in 8 seconds (< 25s periodic timer, < 500 score jump)
    const startRes = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${tokenA}`);

    const sessionId = startRes.body.data.gameSessionId;

    // Flush on exit after 8 seconds
    const exitFlush = await request(app)
      .post('/api/games/2048/checkpoint')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        score: 64,
        maxTile: 8,
        moves: 12,
        gameSessionId: sessionId,
        boardState: [{ id: 20, value: 8, row: 1, col: 1 }],
      });

    assert.equal(exitFlush.status, 200);
    assert.equal(exitFlush.body.data.score, 64);

    const checkRes = await request(app)
      .get('/api/games/2048/active-session')
      .set('Authorization', `Bearer ${tokenA}`);

    assert.equal(checkRes.body.data.score, 64);
    assert.equal(checkRes.body.data.moves, 12);
  });

  await t.test('4. Invariant: Retain BUG-001 session ownership isolation across route transitions', async () => {
    const startRes = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${tokenA}`);

    const sessionAId = startRes.body.data.gameSessionId;

    // User B attempts to hijack User A's session during route transition flush -> 403 Forbidden
    const hijackRes = await request(app)
      .post('/api/games/2048/checkpoint')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        score: 240,
        maxTile: 32,
        moves: 45,
        gameSessionId: sessionAId,
      });

    assert.equal(hijackRes.status, 403, 'User B must not be able to checkpoint User A session');

    // User B querying active-session must NOT see User A's active session
    const bActiveRes = await request(app)
      .get('/api/games/2048/active-session')
      .set('Authorization', `Bearer ${tokenB}`);

    assert.equal(bActiveRes.status, 200);
    if (bActiveRes.body.data) {
      assert.notEqual(bActiveRes.body.data.gameSessionId, sessionAId, 'User B must not see User A session');
    }
  });
});
