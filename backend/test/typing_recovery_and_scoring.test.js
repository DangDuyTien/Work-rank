'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  sequelize,
  User,
  Season,
  ScoreLedger,
  TypingRoom,
  TypingPlayer,
  TypingMatchResult,
  TypingUserStat,
} = require('../src/models');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const typingEngine = require('../src/services/typingEngine');
const typingGameService = require('../src/services/typingGame.service');

test('BUG-009 & BUG-010: Typing Draft Recovery, Monotonic Progress Guard, and Scoring Integrity Suite', async (t) => {
  let userAlice, userBob, userCharlie;
  let tokenAlice, tokenBob, tokenCharlie;
  let activeSeason;

  before(async () => {
    await typingGameService.ensureChallengesExist();

    const ts = Date.now();
    userAlice = await User.create({
      name: `Alice Recovery ${ts}`,
      email: `alice_rec_${ts}@workrank.local`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Developer',
    });

    userBob = await User.create({
      name: `Bob AFK ${ts}`,
      email: `bob_afk_${ts}@workrank.local`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Editor',
    });

    userCharlie = await User.create({
      name: `Charlie Speedy ${ts}`,
      email: `charlie_spd_${ts}@workrank.local`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Content',
    });

    tokenAlice = jwt.sign({ sub: userAlice.id, role: userAlice.role }, env.jwtSecret);
    tokenBob = jwt.sign({ sub: userBob.id, role: userBob.role }, env.jwtSecret);
    tokenCharlie = jwt.sign({ sub: userCharlie.id, role: userCharlie.role }, env.jwtSecret);

    activeSeason = await Season.findOne({ where: { status: 'ACTIVE' } });
    if (!activeSeason) {
      activeSeason = await Season.create({
        name: `Season Typing Recovery ${ts}`,
        slug: `season-typing-rec-${ts}`,
        status: 'ACTIVE',
        startAt: new Date(Date.now() - 86400000),
        endAt: new Date(Date.now() + 86400000 * 30),
      });
    }
  });

  after(async () => {
    // Cleanup created test records
    await TypingPlayer.destroy({ where: { userId: [userAlice.id, userBob.id, userCharlie.id] } }).catch(() => {});
    await ScoreLedger.destroy({ where: { userId: [userAlice.id, userBob.id, userCharlie.id] } }).catch(() => {});
    await TypingUserStat.destroy({ where: { userId: [userAlice.id, userBob.id, userCharlie.id] } }).catch(() => {});
    await User.destroy({ where: { id: [userAlice.id, userBob.id, userCharlie.id] } }).catch(() => {});
  });

  await t.test('1. Typing Engine Unit: Zero-input accuracy returns 0.0%, not 100.0%', () => {
    const zeroAcc = typingEngine.calculateAccuracy(0, 0, 0);
    assert.equal(zeroAcc, 0.0, 'Accuracy for 0 typed characters must be 0.0%, never 100.0%');

    const validAcc = typingEngine.calculateAccuracy(50, 50, 2);
    assert.ok(validAcc > 90, 'Valid accuracy should be calculated correctly');

    const plausibilityZero = typingEngine.validateSubmissionPlausibility({
      challengeLength: 300,
      typedChars: 0,
      durationMs: 30000,
      errorCount: 0,
    });
    assert.equal(plausibilityZero.valid, false, 'Plausibility must reject 0 typed chars');
    assert.equal(plausibilityZero.accuracy, 0.0);

    const perfScoreZero = typingEngine.computeBasePerformanceScore({
      wpm: 0,
      accuracy: 0,
      errorCount: 0,
      completed: false,
      difficulty: 'MEDIUM',
    });
    assert.equal(perfScoreZero, 0, 'Performance score for 0 progress must be 0');

    const awardedPointsZero = typingEngine.calculateAwardedPoints({
      matchType: 'RANKED',
      mode: '1V1',
      performanceScore: 0,
      isWinner: true,
      isDraw: false,
    });
    assert.equal(awardedPointsZero.workrankPoints, 0, 'Zero performanceScore must yield 0 WorkRank points');
  });

  await t.test('2. BUG-009 Monotonic Guard: Stale or zero progress cannot overwrite existing server progress', async () => {
    // Alice creates a 1v1 match
    const createRes = await request(app)
      .post('/api/games/typing/rooms')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        title: 'Monotonic Guard Test Room',
        mode: '1V1',
        matchType: 'RANKED',
        durationLimitSeconds: 30,
      });

    assert.equal(createRes.status, 201);
    const roomId = createRes.body.room.id;

    // Bob joins
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${tokenBob}`);

    // Both ready
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/ready`)
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({ isReady: true });

    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/ready`)
      .set('Authorization', `Bearer ${tokenBob}`)
      .send({ isReady: true });

    // Start match
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/start`)
      .set('Authorization', `Bearer ${tokenAlice}`);

    // Alice types 42 characters and reports progress
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/progress`)
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        typedChars: 42,
        errorCount: 2,
        clientDurationMs: 4000,
      });

    let playerAlice = await TypingPlayer.findOne({
      where: { roomId, userId: userAlice.id },
    });
    assert.equal(playerAlice.typedChars, 42, 'Alice should have 42 typed characters recorded');
    assert.ok(playerAlice.progressPct > 0, 'Alice should have positive progress %');

    // Simulate reload: stale updateProgress sends typedChars: 0
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/progress`)
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        typedChars: 0,
        errorCount: 0,
        clientDurationMs: 5000,
      });

    playerAlice = await TypingPlayer.findOne({
      where: { roomId, userId: userAlice.id },
    });
    assert.equal(playerAlice.typedChars, 42, 'Monotonic guard must preserve 42 chars when stale 0 is sent');

    // Simulate timeout submitFinish with typedChars: 0
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/finish`)
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        typedChars: 0,
        errorCount: 0,
        clientDurationMs: 30000,
      });

    playerAlice = await TypingPlayer.findOne({
      where: { roomId, userId: userAlice.id },
    });
    assert.equal(playerAlice.typedChars, 42, 'Monotonic guard in submitFinish must not overwrite 42 with 0');
    assert.equal(playerAlice.status, 'FINISHED');
  });

  await t.test('3. BUG-010 Scoring Integrity: Player with 0 typed chars receives 0 points and is disqualified from winning', async () => {
    // Create new 1v1 match between Bob (AFK) and Charlie (Speedy)
    const createRes = await request(app)
      .post('/api/games/typing/rooms')
      .set('Authorization', `Bearer ${tokenCharlie}`)
      .send({
        title: 'AFK vs Legitimate Match',
        mode: '1V1',
        matchType: 'RANKED',
        durationLimitSeconds: 120,
      });

    assert.equal(createRes.status, 201);
    const roomId = createRes.body.room.id;

    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${tokenBob}`);

    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/ready`)
      .set('Authorization', `Bearer ${tokenCharlie}`)
      .send({ isReady: true });

    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/ready`)
      .set('Authorization', `Bearer ${tokenBob}`)
      .send({ isReady: true });

    const startRes = await request(app)
      .post(`/api/games/typing/rooms/${roomId}/start`)
      .set('Authorization', `Bearer ${tokenCharlie}`);

    const challengeLen = startRes.body.room.challengeText.length;

    // Bob sends finish with 0 chars (AFK timeout)
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/finish`)
      .set('Authorization', `Bearer ${tokenBob}`)
      .send({
        typedChars: 0,
        errorCount: 0,
        clientDurationMs: 30000,
      });

    // Charlie finishes legitimately with full challenge text
    const finishCharlieRes = await request(app)
      .post(`/api/games/typing/rooms/${roomId}/finish`)
      .set('Authorization', `Bearer ${tokenCharlie}`)
      .send({
        typedChars: challengeLen,
        errorCount: 1,
        clientDurationMs: 60000,
      });

    assert.equal(finishCharlieRes.status, 200);
    assert.equal(finishCharlieRes.body.room.status, 'FINISHED');
    assert.equal(Number(finishCharlieRes.body.room.winnerUserId), Number(userCharlie.id), 'Charlie must win');

    const playerBob = await TypingPlayer.findOne({
      where: { roomId, userId: userBob.id },
    });
    const playerCharlie = await TypingPlayer.findOne({
      where: { roomId, userId: userCharlie.id },
    });

    assert.equal(playerBob.scoreDelta, 0, 'Bob (0 chars) must receive 0 points');
    assert.equal(playerBob.performanceScore, 0, 'Bob (0 chars) must have 0 performanceScore');

    assert.ok(playerCharlie.scoreDelta > 0, 'Charlie must receive positive points');
    assert.ok(playerCharlie.performanceScore > 0, 'Charlie must receive positive performanceScore');

    // Verify ScoreLedger: Bob must NOT have a ScoreLedger row, Charlie MUST
    const ledgerBob = await ScoreLedger.findOne({
      where: { userId: userBob.id, idempotencyKey: `typing_match:${roomId}:${userBob.id}` },
    });
    assert.equal(ledgerBob, null, 'No ScoreLedger row should be created for 0-point AFK player');

    const ledgerCharlie = await ScoreLedger.findOne({
      where: { userId: userCharlie.id, idempotencyKey: `typing_match:${roomId}:${userCharlie.id}` },
    });
    assert.ok(ledgerCharlie, 'ScoreLedger row must exist for legitimate winner');
    assert.equal(ledgerCharlie.pointsDelta, playerCharlie.scoreDelta);
  });

  await t.test('4. Dual-AFK Match: Neither player types (0 chars) -> No winner and 0 points awarded', async () => {
    const createRes = await request(app)
      .post('/api/games/typing/rooms')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        title: 'Dual AFK Room',
        mode: '1V1',
        matchType: 'RANKED',
        durationLimitSeconds: 10,
      });

    const roomId = createRes.body.room.id;

    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${tokenBob}`);

    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/ready`)
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({ isReady: true });

    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/ready`)
      .set('Authorization', `Bearer ${tokenBob}`)
      .send({ isReady: true });

    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/start`)
      .set('Authorization', `Bearer ${tokenAlice}`);

    // Both players submit 0 characters
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/finish`)
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({ typedChars: 0, errorCount: 0, clientDurationMs: 10000 });

    const finishRes = await request(app)
      .post(`/api/games/typing/rooms/${roomId}/finish`)
      .set('Authorization', `Bearer ${tokenBob}`)
      .send({ typedChars: 0, errorCount: 0, clientDurationMs: 10000 });

    assert.equal(finishRes.status, 200);
    assert.equal(finishRes.body.room.status, 'FINISHED');
    assert.equal(finishRes.body.room.winnerUserId, null, 'Dual-AFK match must have no winner');

    const alicePlayer = await TypingPlayer.findOne({ where: { roomId, userId: userAlice.id } });
    const bobPlayer = await TypingPlayer.findOne({ where: { roomId, userId: userBob.id } });

    assert.equal(alicePlayer.scoreDelta, 0, 'Alice must receive 0 points');
    assert.equal(bobPlayer.scoreDelta, 0, 'Bob must receive 0 points');

    const ledgers = await ScoreLedger.findAll({
      where: { idempotencyKey: [`typing_match:${roomId}:${userAlice.id}`, `typing_match:${roomId}:${userBob.id}`] },
    });
    assert.equal(ledgers.length, 0, 'No ScoreLedger rows should be created when both players are AFK');
  });
});
