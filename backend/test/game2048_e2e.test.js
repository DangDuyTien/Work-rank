'use strict';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { sequelize, User, Team, Game2048Score, Game2048UserStat } = require('../src/models');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');

test('Comprehensive 2048 Game Score Persistence & E2E Test Suite', async (t) => {
  let user1, user2, user3, user4;
  let token1, token2, token3, token4;

  before(async () => {
    await Game2048Score.sync();
    await Game2048UserStat.sync();

    await Game2048Score.destroy({ where: {} });
    await Game2048UserStat.destroy({ where: {} });

    const ts = Date.now();
    user1 = await User.create({
      name: `Nguyen Van A ${ts}`,
      email: `test_2048_a_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'Developer',
    });

    user2 = await User.create({
      name: `Duy Tien ${ts}`,
      email: `test_2048_b_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'Designer',
    });

    user3 = await User.create({
      name: `Tran Thi C ${ts}`,
      email: `test_2048_c_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'Manager',
    });

    user4 = await User.create({
      name: `Le Hoang D ${ts}`,
      email: `test_2048_d_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'Creator',
    });

    token1 = jwt.sign({ sub: user1.id, role: user1.role }, env.jwtSecret);
    token2 = jwt.sign({ sub: user2.id, role: user2.role }, env.jwtSecret);
    token3 = jwt.sign({ sub: user3.id, role: user3.role }, env.jwtSecret);
    token4 = jwt.sign({ sub: user4.id, role: user4.role }, env.jwtSecret);

    assert.ok(token1, 'Token 1 generated');
    assert.ok(token2, 'Token 2 generated');
    assert.ok(token3, 'Token 3 generated');
    assert.ok(token4, 'Token 4 generated');
  });

  await t.test('1. Start Session: Authenticated user receives valid gameSessionId and active record created', async () => {
    const res = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${token1}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.success, 'Success should be true');
    assert.ok(res.body.data.gameSessionId, 'gameSessionId returned');
    assert.ok(res.body.data.gameSessionId.startsWith('g2048_'), 'Correct prefix');

    const scoreRecord = await Game2048Score.findOne({
      where: { gameSessionId: res.body.data.gameSessionId },
    });
    assert.ok(scoreRecord, 'Session record created in DB');
    assert.equal(scoreRecord.status, 'ACTIVE');
  });

  await t.test('2. Score Submission on Game Over: Final score updates personal best and records history', async () => {
    const sessionRes = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${token1}`);

    const sessionId = sessionRes.body.data.gameSessionId;

    const submitRes = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        score: 1200,
        maxTile: 128,
        moves: 95,
        gameSessionId: sessionId,
        status: 'COMPLETED',
      });

    assert.equal(submitRes.status, 200);
    assert.equal(submitRes.body.data.score, 1200);
    assert.equal(submitRes.body.data.bestScore, 1200);
    assert.equal(submitRes.body.data.highestTile, 128);
    assert.equal(submitRes.body.data.isNewBest, true);
    assert.equal(submitRes.body.data.status, 'COMPLETED');
  });

  await t.test('3. REQUIRED: Exit Before Game Over persists score (Score = 500, Status = ABANDONED)', async () => {
    const sessionRes = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${token4}`);

    const sessionId = sessionRes.body.data.gameSessionId;

    // User plays, achieves score = 500, maxTile = 64, moves = 45, then clicks [Thoát] before game over
    const exitRes = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token4}`)
      .send({
        score: 500,
        maxTile: 64,
        moves: 45,
        gameSessionId: sessionId,
        status: 'ABANDONED',
      });

    assert.equal(exitRes.status, 200);
    assert.equal(exitRes.body.data.score, 500);
    assert.equal(exitRes.body.data.bestScore, 500);
    assert.equal(exitRes.body.data.highestTile, 64);
    assert.equal(exitRes.body.data.status, 'ABANDONED');

    const dbScore = await Game2048Score.findOne({ where: { gameSessionId: sessionId } });
    assert.ok(dbScore, 'DB row exists for exited session');
    assert.equal(dbScore.score, 500);
    assert.equal(dbScore.status, 'ABANDONED');
  });

  await t.test('4. REQUIRED: Exit with Score = 8,420 persists 8,420 to DB and updates career best', async () => {
    const sessionRes = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${token4}`);

    const sessionId = sessionRes.body.data.gameSessionId;

    const exitRes = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token4}`)
      .send({
        score: 8420,
        maxTile: 512,
        moves: 420,
        gameSessionId: sessionId,
        status: 'ABANDONED',
      });

    assert.equal(exitRes.status, 200);
    assert.equal(exitRes.body.data.score, 8420);
    assert.equal(exitRes.body.data.bestScore, 8420);
    assert.equal(exitRes.body.data.highestTile, 512);

    const stat = await Game2048UserStat.findOne({ where: { userId: user4.id } });
    assert.equal(stat.bestScore, 8420, 'Career best updated to 8,420 on exit');
  });

  await t.test('5. REQUIRED: Personal Best Comparison Logic: Best = 10,000, Current = 8,420 -> Best remains 10,000; Current = 12,000 -> Best = 12,000', async () => {
    // Setup initial best score of 10,000 for User 1
    const sess10k = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${token1}`);

    await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        score: 10000,
        maxTile: 1024,
        moves: 600,
        gameSessionId: sess10k.body.data.gameSessionId,
        status: 'COMPLETED',
      });

    // 5A. Play a new session, score 8,420, exit -> Best must remain 10,000
    const sess8k = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${token1}`);

    const res8k = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        score: 8420,
        maxTile: 512,
        moves: 430,
        gameSessionId: sess8k.body.data.gameSessionId,
        status: 'ABANDONED',
      });

    assert.equal(res8k.status, 200);
    assert.equal(res8k.body.data.score, 8420);
    assert.equal(res8k.body.data.bestScore, 10000, 'Best score remains 10,000');
    assert.equal(res8k.body.data.isNewBest, false);

    // 5B. Play another session, score 12,000, exit -> Best must become 12,000
    const sess12k = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${token1}`);

    const res12k = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        score: 12000,
        maxTile: 1024,
        moves: 750,
        gameSessionId: sess12k.body.data.gameSessionId,
        status: 'ABANDONED',
      });

    assert.equal(res12k.status, 200);
    assert.equal(res12k.body.data.score, 12000);
    assert.equal(res12k.body.data.bestScore, 12000, 'Best score upgraded to 12,000');
    assert.equal(res12k.body.data.isNewBest, true);
  });

  await t.test('6. Mid-game Checkpoint & Active Session Recovery', async () => {
    const sessionRes = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${token2}`);

    const sessionId = sessionRes.body.data.gameSessionId;

    // Checkpoint 1: score = 1,200
    const cpRes = await request(app)
      .post('/api/games/2048/checkpoint')
      .set('Authorization', `Bearer ${token2}`)
      .send({
        score: 1200,
        maxTile: 128,
        moves: 80,
        gameSessionId: sessionId,
        boardState: { tiles: [{ id: 1, value: 128, row: 0, col: 0 }] },
      });

    assert.equal(cpRes.status, 200);
    assert.equal(cpRes.body.data.score, 1200);
    assert.equal(cpRes.body.data.status, 'ACTIVE');

    // Fetch active session
    const activeRes = await request(app)
      .get('/api/games/2048/active-session')
      .set('Authorization', `Bearer ${token2}`);

    assert.equal(activeRes.status, 200);
    assert.ok(activeRes.body.data, 'Active session returned');
    assert.equal(activeRes.body.data.gameSessionId, sessionId);
    assert.equal(activeRes.body.data.score, 1200);
    assert.equal(activeRes.body.data.status, 'ACTIVE');
  });

  await t.test('7. Idempotency: Duplicate Exit submit does not double-count or create duplicates', async () => {
    const sessionRes = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${token3}`);

    const sessionId = sessionRes.body.data.gameSessionId;

    // First exit submit
    const res1 = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token3}`)
      .send({
        score: 3500,
        maxTile: 256,
        moves: 220,
        gameSessionId: sessionId,
        status: 'ABANDONED',
      });
    assert.equal(res1.status, 200);
    assert.equal(res1.body.data.alreadyProcessed, false);

    // Duplicate exit click
    const res2 = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token3}`)
      .send({
        score: 3500,
        maxTile: 256,
        moves: 220,
        gameSessionId: sessionId,
        status: 'ABANDONED',
      });
    assert.equal(res2.status, 200);
    assert.equal(res2.body.data.alreadyProcessed, true);

    const scoreCount = await Game2048Score.count({ where: { gameSessionId: sessionId } });
    assert.equal(scoreCount, 1, 'Exactly 1 database row stored for this session');
  });

  await t.test('8. Anti-Cheat Validation: Rejects implausible or fake scores', async () => {
    // 8.1 Invalid max tile (not power of 2)
    const resInvalidTile = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token2}`)
      .send({
        score: 1000,
        maxTile: 123,
        moves: 50,
        gameSessionId: 'cheat_1',
      });
    assert.equal(resInvalidTile.status, 400);

    // 8.2 Negative score
    const resNegative = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token2}`)
      .send({
        score: -500,
        maxTile: 64,
        moves: 50,
        gameSessionId: 'cheat_2',
      });
    assert.equal(resNegative.status, 400);

    // 8.3 Score claimed without moves
    const resNoMoves = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token2}`)
      .send({
        score: 5000,
        maxTile: 512,
        moves: 0,
        gameSessionId: 'cheat_3',
      });
    assert.equal(resNoMoves.status, 400);

    // 8.4 Claiming 2048 tile with only 50 points (mathematically impossible)
    const resImpossibleTile = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token2}`)
      .send({
        score: 50,
        maxTile: 2048,
        moves: 50,
        gameSessionId: 'cheat_4',
      });
    assert.equal(resImpossibleTile.status, 400);
  });

  await t.test('9. Company-wide Leaderboard reflects scores saved on Exit without Game Over', async () => {
    // User 3 exits at score 18,000 -> Takes higher rank immediately
    const sess3 = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${token3}`);

    await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token3}`)
      .send({
        score: 18000,
        maxTile: 1024,
        moves: 850,
        gameSessionId: sess3.body.data.gameSessionId,
        status: 'ABANDONED',
      });

    // User 2 exits at score 24,000 -> Takes #1 immediately
    const sess2 = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${token2}`);

    await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token2}`)
      .send({
        score: 24000,
        maxTile: 2048,
        moves: 1200,
        gameSessionId: sess2.body.data.gameSessionId,
        status: 'ABANDONED',
      });

    // Query Leaderboard
    const lbRes = await request(app)
      .get('/api/games/2048/leaderboard')
      .set('Authorization', `Bearer ${token1}`);

    assert.equal(lbRes.status, 200);
    const lb = lbRes.body.data;
    assert.ok(lb.length >= 4, 'All players on leaderboard');

    // Rank #1 must be User 2 (score 24000)
    assert.equal(lb[0].userId, user2.id);
    assert.equal(lb[0].bestScore, 24000);
    assert.equal(lb[0].rank, 1);

    // Rank #2 must be User 3 (score 18000)
    assert.equal(lb[1].userId, user3.id);
    assert.equal(lb[1].bestScore, 18000);
    assert.equal(lb[1].rank, 2);

    // Rank #3 must be User 1 (score 12000)
    assert.equal(lb[2].userId, user1.id);
    assert.equal(lb[2].bestScore, 12000);
    assert.equal(lb[2].rank, 3);

    // Rank #4 must be User 4 (score 8420)
    assert.equal(lb[3].userId, user4.id);
    assert.equal(lb[3].bestScore, 8420);
    assert.equal(lb[3].rank, 4);

    // Check myStats for User 1
    assert.equal(lbRes.body.myStats.rank, 3);
    assert.equal(lbRes.body.myStats.bestScore, 12000);
  });

  await t.test('10. Authentication Security: Anonymous users are rejected with 401', async () => {
    const res = await request(app).get('/api/games/2048/leaderboard');
    assert.equal(res.status, 401, 'Anonymous request rejected');

    const resSubmit = await request(app)
      .post('/api/games/2048/submit')
      .send({ score: 1000, maxTile: 128, moves: 50, gameSessionId: 'anon' });
    assert.equal(resSubmit.status, 401);
  });
});
