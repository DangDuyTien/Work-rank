'use strict';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { Department, Team, User, GameCatalog, Game2048Score, Game2048UserStat } = require('../src/models');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');

test('BUG-001: 2048 Session Ownership & Authorization Test Suite', async (t) => {
  let userA, userB, userC;
  let tokenA, tokenB, tokenC;

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
      name: `User A ${ts}`,
      email: `user_a_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'Developer',
    });

    userB = await User.create({
      name: `User B ${ts}`,
      email: `user_b_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'Designer',
    });

    userC = await User.create({
      name: `User C ${ts}`,
      email: `user_c_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'Manager',
    });

    tokenA = jwt.sign({ sub: userA.id, role: userA.role }, env.jwtSecret);
    tokenB = jwt.sign({ sub: userB.id, role: userB.role }, env.jwtSecret);
    tokenC = jwt.sign({ sub: userC.id, role: userC.role }, env.jwtSecret);
  });

  await t.test('Test A: User A starts session. User B attempts POST /checkpoint with A\'s gameSessionId -> Returns 403 Forbidden', async () => {
    // 1. User A starts session
    const startRes = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ boardState: [{ id: 1, value: 2, row: 0, col: 0 }] });

    assert.equal(startRes.status, 200);
    const sessionAId = startRes.body.data.gameSessionId;
    assert.ok(sessionAId, 'Session A ID generated');

    // 2. User B attempts to checkpoint User A's session
    const cpRes = await request(app)
      .post('/api/games/2048/checkpoint')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        gameSessionId: sessionAId,
        score: 128,
        maxTile: 16,
        moves: 30,
        boardState: [{ id: 1, value: 16, row: 0, col: 0 }],
      });

    assert.equal(cpRes.status, 403, 'Must return 403 Forbidden when checkpointing another user\'s session');
    assert.match(cpRes.body.message || cpRes.body.error, /không có quyền/i);

    // 3. Verify User A's session in DB was NOT modified
    const dbRecord = await Game2048Score.findOne({ where: { gameSessionId: sessionAId } });
    assert.equal(dbRecord.userId, userA.id);
    assert.equal(dbRecord.score, 0, 'User A score must remain 0');
    assert.equal(dbRecord.moves, 0, 'User A moves must remain 0');
    assert.equal(dbRecord.status, 'ACTIVE');

    // 4. Verify User B was NOT credited with stats
    const statB = await Game2048UserStat.findOne({ where: { userId: userB.id } });
    assert.equal(statB, null, 'User B must not receive stats from User A\'s session');
  });

  await t.test('Test B: User A starts session. User B attempts POST /submit with A\'s gameSessionId -> Returns 403 Forbidden', async () => {
    // 1. User A starts session
    const startRes = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ boardState: [{ id: 1, value: 2, row: 0, col: 0 }] });

    assert.equal(startRes.status, 200);
    const sessionAId = startRes.body.data.gameSessionId;

    // 2. User B attempts to submit / finalize User A's session
    const submitRes = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        gameSessionId: sessionAId,
        score: 256,
        maxTile: 32,
        moves: 50,
        status: 'COMPLETED',
      });

    assert.equal(submitRes.status, 403, 'Must return 403 Forbidden when submitting another user\'s session');
    assert.match(submitRes.body.message || submitRes.body.error, /không có quyền/i);

    // 3. Verify User A's session in DB is still ACTIVE and belongs to User A
    const dbRecord = await Game2048Score.findOne({ where: { gameSessionId: sessionAId } });
    assert.equal(dbRecord.userId, userA.id);
    assert.equal(dbRecord.status, 'ACTIVE', 'User A session must remain ACTIVE');
  });

  await t.test('Test C: Random uninitiated gameSessionId to checkpoint/submit -> Returns 404 Not Found (no new DB record created)', async () => {
    const fakeSessionId = 'g2048_nonexistent_fake_session_' + Date.now();

    // 1. Checkpoint with fake session ID
    const cpRes = await request(app)
      .post('/api/games/2048/checkpoint')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        gameSessionId: fakeSessionId,
        score: 128,
        maxTile: 16,
        moves: 30,
      });

    assert.equal(cpRes.status, 404, 'Must return 404 Not Found for non-existent session on checkpoint');
    assert.match(cpRes.body.message || cpRes.body.error, /không tồn tại/i);

    // Verify no DB record was auto-created
    let dbCount = await Game2048Score.count({ where: { gameSessionId: fakeSessionId } });
    assert.equal(dbCount, 0, 'No Game2048Score row should be auto-created for fake session checkpoint');

    // 2. Submit with fake session ID
    const submitRes = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        gameSessionId: fakeSessionId,
        score: 128,
        maxTile: 16,
        moves: 30,
        status: 'COMPLETED',
      });

    assert.equal(submitRes.status, 404, 'Must return 404 Not Found for non-existent session on submit');
    assert.match(submitRes.body.message || submitRes.body.error, /không tồn tại/i);

    // Verify still no DB record
    dbCount = await Game2048Score.count({ where: { gameSessionId: fakeSessionId } });
    assert.equal(dbCount, 0, 'No Game2048Score row should be auto-created for fake session submit');
  });

  await t.test('Test D: User C plays and finishes -> stats increment totalGames by 1', async () => {
    // 1. User C starts session
    const startRes = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ boardState: [{ id: 1, value: 2, row: 0, col: 0 }] });

    assert.equal(startRes.status, 200);
    const sessionCId = startRes.body.data.gameSessionId;

    // 2. User C checkpoints during game
    const cpRes = await request(app)
      .post('/api/games/2048/checkpoint')
      .set('Authorization', `Bearer ${tokenC}`)
      .send({
        gameSessionId: sessionCId,
        score: 256,
        maxTile: 32,
        moves: 35,
        boardState: [{ id: 1, value: 32, row: 0, col: 0 }],
      });

    assert.equal(cpRes.status, 200);

    // Verify stats at checkpoint do NOT count as a finished game
    let statC = await Game2048UserStat.findOne({ where: { userId: userC.id } });
    assert.ok(statC, 'User stat created');
    assert.equal(statC.totalGames, 0, 'totalGames must remain 0 during active checkpoint');
    assert.equal(statC.bestScore, 256);

    // 3. User C submits final score (COMPLETED)
    const submitRes = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${tokenC}`)
      .send({
        gameSessionId: sessionCId,
        score: 512,
        maxTile: 64,
        moves: 60,
        status: 'COMPLETED',
      });

    assert.equal(submitRes.status, 200);

    // Verify stats after submit: totalGames must be exactly 1
    statC = await Game2048UserStat.findOne({ where: { userId: userC.id } });
    assert.equal(statC.totalGames, 1, 'totalGames must be exactly 1 after completing a game');
    assert.equal(statC.bestScore, 512);
    assert.equal(statC.highestTile, 64);

    // 4. Duplicate submit does not double-count
    const dupRes = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${tokenC}`)
      .send({
        gameSessionId: sessionCId,
        score: 512,
        maxTile: 64,
        moves: 60,
        status: 'COMPLETED',
      });

    assert.equal(dupRes.status, 200);
    statC = await Game2048UserStat.findOne({ where: { userId: userC.id } });
    assert.equal(statC.totalGames, 1, 'Duplicate submit must not increment totalGames');
  });
});
