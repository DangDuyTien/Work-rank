'use strict';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  sequelize,
  User,
  Team,
  Season,
  ScoreLedger,
  TypingRoom,
  TypingPlayer,
  TypingChallenge,
  TypingMatchResult,
  TypingUserStat,
} = require('../src/models');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');

test('Comprehensive Typing Competition Game E2E & ScoreLedger Test Suite', async (t) => {
  let user1, user2, user3, user4;
  let token1, token2, token3, token4;
  let activeSeason;

  before(async () => {
    const typingGameService = require('../src/services/typingGame.service');
    await typingGameService.ensureChallengesExist();

    const ts = Date.now();
    user1 = await User.create({
      name: `Nguyen Van A ${ts}`,
      email: `type_u1_${ts}@workrank.local`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Developer',
    });

    user2 = await User.create({
      name: `Tran Thi B ${ts}`,
      email: `type_u2_${ts}@workrank.local`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Editor',
    });

    user3 = await User.create({
      name: `Le Hoang C ${ts}`,
      email: `type_u3_${ts}@workrank.local`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Content',
    });

    user4 = await User.create({
      name: `Pham Minh D ${ts}`,
      email: `type_u4_${ts}@workrank.local`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Creator',
    });

    token1 = jwt.sign({ sub: user1.id, role: user1.role }, env.jwtSecret);
    token2 = jwt.sign({ sub: user2.id, role: user2.role }, env.jwtSecret);
    token3 = jwt.sign({ sub: user3.id, role: user3.role }, env.jwtSecret);
    token4 = jwt.sign({ sub: user4.id, role: user4.role }, env.jwtSecret);

    // Create an active season if not exists
    activeSeason = await Season.findOne({ where: { status: 'ACTIVE' } });
    if (!activeSeason) {
      activeSeason = await Season.create({
        name: `Season Typing Test ${ts}`,
        slug: `season-typing-${ts}`,
        status: 'ACTIVE',
        startAt: new Date(Date.now() - 86400000),
        endAt: new Date(Date.now() + 86400000 * 30),
      });
    }
  });

  await t.test('1. Catalog & Challenges: Endpoints return game catalog status and populated challenges', async () => {
    const statusRes = await request(app)
      .get('/api/games/typing/status')
      .set('Authorization', `Bearer ${token1}`);

    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.body.allowed, true);

    const chalRes = await request(app)
      .get('/api/games/typing/challenges')
      .set('Authorization', `Bearer ${token1}`);

    assert.equal(chalRes.status, 200);
    assert.ok(Array.isArray(chalRes.body.challenges));
    assert.ok(chalRes.body.challenges.length > 0, 'Challenges should be automatically seeded');
  });

  await t.test('2. Solo Mode: Create, auto-ready, start, progress and finish settlement', async () => {
    const createRes = await request(app)
      .post('/api/games/typing/rooms')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        title: 'Solo Typing Practice',
        mode: 'SOLO',
        matchType: 'PRACTICE',
      });

    assert.equal(createRes.status, 201);
    const roomId = createRes.body.room.id;
    assert.equal(createRes.body.room.mode, 'SOLO');

    // Start match
    const startRes = await request(app)
      .post(`/api/games/typing/rooms/${roomId}/start`)
      .set('Authorization', `Bearer ${token1}`);

    assert.equal(startRes.status, 200);
    assert.equal(startRes.body.room.status, 'PLAYING');
    assert.ok(startRes.body.room.challengeText, 'Challenge text must be present');

    // Update progress
    const textLen = startRes.body.room.challengeText.length;
    const progRes = await request(app)
      .post(`/api/games/typing/rooms/${roomId}/progress`)
      .set('Authorization', `Bearer ${token1}`)
      .send({
        typedChars: Math.floor(textLen / 2),
        errorCount: 1,
        clientDurationMs: 15000,
      });

    assert.equal(progRes.status, 200);

    // Submit finish
    const finishRes = await request(app)
      .post(`/api/games/typing/rooms/${roomId}/finish`)
      .set('Authorization', `Bearer ${token1}`)
      .send({
        typedChars: textLen,
        errorCount: 1,
        clientDurationMs: 30000,
      });

    assert.equal(finishRes.status, 200);
    assert.equal(finishRes.body.room.status, 'FINISHED');
    assert.ok(finishRes.body.players[0].wpm > 0);
  });

  await t.test('3. 1 VS 1 Ranked Match: 2 players, ready, start, finish and ScoreLedger integration', async () => {
    // Player 1 creates room
    const createRes = await request(app)
      .post('/api/games/typing/rooms')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        title: '1v1 High Speed Duel',
        mode: '1V1',
        matchType: 'RANKED',
      });

    assert.equal(createRes.status, 201);
    const roomId = createRes.body.room.id;

    // Player 2 joins room
    const joinRes = await request(app)
      .post(`/api/games/typing/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${token2}`);

    assert.equal(joinRes.status, 200);
    assert.equal(joinRes.body.players.length, 2);

    // Both players toggle ready
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/ready`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ isReady: true });

    const readyRes = await request(app)
      .post(`/api/games/typing/rooms/${roomId}/ready`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ isReady: true });

    assert.equal(readyRes.status, 200);
    assert.equal(readyRes.body.room.status, 'STARTING');

    // Start match
    const startRes = await request(app)
      .post(`/api/games/typing/rooms/${roomId}/start`)
      .set('Authorization', `Bearer ${token1}`);

    assert.equal(startRes.status, 200);
    assert.equal(startRes.body.room.status, 'PLAYING');
    const textLen = startRes.body.room.challengeText.length;

    // Player 1 finishes fast (Winner)
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/finish`)
      .set('Authorization', `Bearer ${token1}`)
      .send({
        typedChars: textLen,
        errorCount: 0,
        clientDurationMs: 25000,
      });

    // Player 2 finishes slightly later
    const finish2Res = await request(app)
      .post(`/api/games/typing/rooms/${roomId}/finish`)
      .set('Authorization', `Bearer ${token2}`)
      .send({
        typedChars: textLen,
        errorCount: 3,
        clientDurationMs: 35000,
      });

    assert.equal(finish2Res.status, 200);
    assert.equal(finish2Res.body.room.status, 'FINISHED');
    assert.equal(Number(finish2Res.body.room.winnerUserId), Number(user1.id));

    // Verify ScoreLedger entry was inserted for user1 and user2
    const ledgerUser1 = await ScoreLedger.findOne({
      where: {
        userId: user1.id,
        idempotencyKey: `typing_match:${roomId}:${user1.id}`,
      },
    });

    assert.ok(ledgerUser1, 'ScoreLedger row must exist for Winner');
    assert.ok(ledgerUser1.pointsDelta > 0, 'Winner points delta must be positive');

    // Check personal stats API
    const myStatsRes = await request(app)
      .get('/api/games/typing/my-stats')
      .set('Authorization', `Bearer ${token1}`);

    assert.equal(myStatsRes.status, 200);
    assert.equal(myStatsRes.body.winsCount, 1);
    assert.ok(myStatsRes.body.bestWpm > 0);
  });

  await t.test('4. 2 VS 2 Team Match: 4 players, switch teams, finish settlement & team scores', async () => {
    // User 1 creates 2v2 room
    const createRes = await request(app)
      .post('/api/games/typing/rooms')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        title: '2v2 Squad Clash',
        mode: '2V2',
        matchType: 'RANKED',
      });

    const roomId = createRes.body.room.id;

    // Users 2, 3, 4 join
    await request(app).post(`/api/games/typing/rooms/${roomId}/join`).set('Authorization', `Bearer ${token2}`);
    await request(app).post(`/api/games/typing/rooms/${roomId}/join`).set('Authorization', `Bearer ${token3}`);
    await request(app).post(`/api/games/typing/rooms/${roomId}/join`).set('Authorization', `Bearer ${token4}`);

    // Switch teams to make Team A (User 1, User 2) and Team B (User 3, User 4)
    await request(app).post(`/api/games/typing/rooms/${roomId}/switch-team`).set('Authorization', `Bearer ${token1}`).send({ team: 'A' });
    await request(app).post(`/api/games/typing/rooms/${roomId}/switch-team`).set('Authorization', `Bearer ${token2}`).send({ team: 'A' });
    await request(app).post(`/api/games/typing/rooms/${roomId}/switch-team`).set('Authorization', `Bearer ${token3}`).send({ team: 'B' });
    await request(app).post(`/api/games/typing/rooms/${roomId}/switch-team`).set('Authorization', `Bearer ${token4}`).send({ team: 'B' });

    // Ready up
    await request(app).post(`/api/games/typing/rooms/${roomId}/ready`).set('Authorization', `Bearer ${token1}`).send({ isReady: true });
    await request(app).post(`/api/games/typing/rooms/${roomId}/ready`).set('Authorization', `Bearer ${token2}`).send({ isReady: true });
    await request(app).post(`/api/games/typing/rooms/${roomId}/ready`).set('Authorization', `Bearer ${token3}`).send({ isReady: true });
    await request(app).post(`/api/games/typing/rooms/${roomId}/ready`).set('Authorization', `Bearer ${token4}`).send({ isReady: true });

    // Start
    const startRes = await request(app).post(`/api/games/typing/rooms/${roomId}/start`).set('Authorization', `Bearer ${token1}`);
    const textLen = startRes.body.room.challengeText.length;

    // All finish
    await request(app).post(`/api/games/typing/rooms/${roomId}/finish`).set('Authorization', `Bearer ${token1}`).send({ typedChars: textLen, errorCount: 0, clientDurationMs: 20000 });
    await request(app).post(`/api/games/typing/rooms/${roomId}/finish`).set('Authorization', `Bearer ${token2}`).send({ typedChars: textLen, errorCount: 1, clientDurationMs: 22000 });
    await request(app).post(`/api/games/typing/rooms/${roomId}/finish`).set('Authorization', `Bearer ${token3}`).send({ typedChars: textLen, errorCount: 4, clientDurationMs: 35000 });
    const finishRes = await request(app).post(`/api/games/typing/rooms/${roomId}/finish`).set('Authorization', `Bearer ${token4}`).send({ typedChars: textLen, errorCount: 5, clientDurationMs: 40000 });

    assert.equal(finishRes.status, 200);
    assert.equal(finishRes.body.room.status, 'FINISHED');
    assert.equal(finishRes.body.room.winnerTeam, 'A', 'Team A should be the winner');
  });

  await t.test('5. Leaderboard: Returns ranked list of typing warriors', async () => {
    const lbRes = await request(app)
      .get('/api/games/typing/leaderboard')
      .set('Authorization', `Bearer ${token1}`);

    assert.equal(lbRes.status, 200);
    assert.ok(Array.isArray(lbRes.body.leaderboard));
    assert.ok(lbRes.body.leaderboard.length >= 2);
    assert.ok(lbRes.body.myStats);
  });
});
