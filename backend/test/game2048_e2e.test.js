'use strict';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { sequelize, User, Team, Game2048Score, Game2048UserStat } = require('../src/models');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');

test('Comprehensive 2048 Game V1 E2E Test Suite', async (t) => {
  let user1, user2, user3;
  let token1, token2, token3;

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

    token1 = jwt.sign({ sub: user1.id, role: user1.role }, env.jwtSecret);
    token2 = jwt.sign({ sub: user2.id, role: user2.role }, env.jwtSecret);
    token3 = jwt.sign({ sub: user3.id, role: user3.role }, env.jwtSecret);

    assert.ok(token1, 'Token 1 generated');
    assert.ok(token2, 'Token 2 generated');
  });

  await t.test('1. Start Session: Authenticated user receives valid gameSessionId', async () => {
    const res = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${token1}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.success, 'Success should be true');
    assert.ok(res.body.data.gameSessionId, 'gameSessionId returned');
    assert.ok(res.body.data.gameSessionId.startsWith('g2048_'), 'Correct prefix');
  });

  await t.test('2. Score Submission: Valid score updates personal best and records history', async () => {
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
      });

    assert.equal(submitRes.status, 200);
    assert.equal(submitRes.body.data.score, 1200);
    assert.equal(submitRes.body.data.bestScore, 1200);
    assert.equal(submitRes.body.data.highestTile, 128);
    assert.equal(submitRes.body.data.isNewBest, true);
  });

  await t.test('3. Personal Best Preserved: Lower subsequent score does not downgrade best score', async () => {
    const sessionRes = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${token1}`);

    const sessionId = sessionRes.body.data.gameSessionId;

    const submitRes = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        score: 400,
        maxTile: 64,
        moves: 40,
        gameSessionId: sessionId,
      });

    assert.equal(submitRes.status, 200);
    assert.equal(submitRes.body.data.score, 400);
    assert.equal(submitRes.body.data.bestScore, 1200, 'Best score remains 1200');
    assert.equal(submitRes.body.data.isNewBest, false);
  });

  await t.test('4. Idempotency: Submitting the same gameSessionId multiple times does not create duplicates', async () => {
    const sessionRes = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${token1}`);

    const sessionId = sessionRes.body.data.gameSessionId;

    // First submit
    const res1 = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        score: 2500,
        maxTile: 256,
        moves: 180,
        gameSessionId: sessionId,
      });
    assert.equal(res1.status, 200);
    assert.equal(res1.body.data.alreadyProcessed, false);

    // Duplicate submit
    const res2 = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        score: 2500,
        maxTile: 256,
        moves: 180,
        gameSessionId: sessionId,
      });
    assert.equal(res2.status, 200);
    assert.equal(res2.body.data.alreadyProcessed, true);

    const scoreCount = await Game2048Score.count({ where: { gameSessionId: sessionId } });
    assert.equal(scoreCount, 1, 'Exactly 1 database row stored for this session');
  });

  await t.test('5. Anti-Cheat Validation: Rejects implausible or fake scores', async () => {
    // 5.1 Invalid max tile (not power of 2)
    const resInvalidTile = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token2}`)
      .send({
        score: 1000,
        maxTile: 123,
        moves: 50,
        gameSessionId: 'cheat_1',
      });
    assert.equal(resInvalidTile.status, 500);

    // 5.2 Negative score
    const resNegative = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token2}`)
      .send({
        score: -500,
        maxTile: 64,
        moves: 50,
        gameSessionId: 'cheat_2',
      });
    assert.equal(resNegative.status, 500);

    // 5.3 Score claimed without moves
    const resNoMoves = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token2}`)
      .send({
        score: 5000,
        maxTile: 512,
        moves: 0,
        gameSessionId: 'cheat_3',
      });
    assert.equal(resNoMoves.status, 500);

    // 5.4 Claiming 2048 tile with only 50 points (mathematically impossible)
    const resImpossibleTile = await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token2}`)
      .send({
        score: 50,
        maxTile: 2048,
        moves: 50,
        gameSessionId: 'cheat_4',
      });
    assert.equal(resImpossibleTile.status, 500);
  });

  await t.test('6. Company-wide Leaderboard & Tie-break ranking', async () => {
    // User 2 plays and scores 18,000
    const sess2 = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${token2}`);

    await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token2}`)
      .send({
        score: 18000,
        maxTile: 1024,
        moves: 850,
        gameSessionId: sess2.body.data.gameSessionId,
      });

    // User 3 plays and scores 22,000 (Takes #1)
    const sess3 = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${token3}`);

    await request(app)
      .post('/api/games/2048/submit')
      .set('Authorization', `Bearer ${token3}`)
      .send({
        score: 22000,
        maxTile: 2048,
        moves: 1100,
        gameSessionId: sess3.body.data.gameSessionId,
      });

    // Query Leaderboard
    const lbRes = await request(app)
      .get('/api/games/2048/leaderboard')
      .set('Authorization', `Bearer ${token1}`);

    assert.equal(lbRes.status, 200);
    const lb = lbRes.body.data;
    assert.ok(lb.length >= 3, 'At least 3 players on leaderboard');

    // Rank #1 must be User 3 (score 22000)
    assert.equal(lb[0].userId, user3.id);
    assert.equal(lb[0].bestScore, 22000);
    assert.equal(lb[0].rank, 1);

    // Rank #2 must be User 2 (score 18000)
    assert.equal(lb[1].userId, user2.id);
    assert.equal(lb[1].bestScore, 18000);
    assert.equal(lb[1].rank, 2);

    // Rank #3 must be User 1 (score 2500)
    assert.equal(lb[2].userId, user1.id);
    assert.equal(lb[2].bestScore, 2500);
    assert.equal(lb[2].rank, 3);

    // Check myStats for User 1
    assert.equal(lbRes.body.myStats.rank, 3);
    assert.equal(lbRes.body.myStats.bestScore, 2500);
  });

  await t.test('7. Authentication Security: Anonymous users are rejected with 401', async () => {
    const res = await request(app).get('/api/games/2048/leaderboard');
    assert.equal(res.status, 401, 'Anonymous request rejected');

    const resSubmit = await request(app)
      .post('/api/games/2048/submit')
      .send({ score: 1000, maxTile: 128, moves: 50, gameSessionId: 'anon' });
    assert.equal(resSubmit.status, 401);
  });
});
