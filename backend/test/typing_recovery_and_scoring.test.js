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

function typeWithErrors(target, errorCount) {
  const characters = String(target || '').split('');
  let inserted = 0;
  for (let index = 0; index < characters.length && inserted < errorCount; index += 1) {
    if (/\s/.test(characters[index])) continue;
    characters[index] = characters[index] === 'x' ? 'y' : 'x';
    inserted += 1;
  }
  return characters.join('');
}

async function matchLedgerKey(roomId, userId) {
  const row = await TypingRoom.findByPk(roomId);
  return `typing_match:${roomId}:${new Date(row.startedAt).getTime()}:${userId}`;
}

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

    const validAcc = typingEngine.calculateAccuracy(50, 2);
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
    const startRes = await request(app)
      .post(`/api/games/typing/rooms/${roomId}/start`)
      .set('Authorization', `Bearer ${tokenAlice}`);
    const challengeText = startRes.body.room.challengeText;
    await TypingRoom.update({ startedAt: new Date(Date.now() - 25000) }, { where: { id: roomId } });

    // Count-only payloads cannot spoof authoritative input progress.
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/progress`)
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        typedChars: 42,
        errorCount: 0,
        wpm: 999,
        accuracy: 100,
        clientDurationMs: 1,
      });

    let playerAlice = await TypingPlayer.findOne({
      where: { roomId, userId: userAlice.id },
    });
    assert.equal(playerAlice.typedChars, 0, 'Server must ignore fake metric-only progress');

    const aliceText = typeWithErrors(challengeText.slice(0, 42), 2);
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/progress`)
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({ typedText: aliceText, inputRevision: 1 });

    playerAlice = await TypingPlayer.findOne({
      where: { roomId, userId: userAlice.id },
    });
    assert.equal(playerAlice.typedChars, 42, 'Alice should have 42 typed characters recorded');
    assert.equal(playerAlice.errorCount, 2, 'Server derives current errors from the submitted text');
    assert.ok(playerAlice.progressPct > 0, 'Alice should have positive progress %');

    // Simulate a stale reconnect snapshot: lower revisions cannot overwrite newer edits.
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/progress`)
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        typedText: '',
        inputRevision: 0,
      });

    playerAlice = await TypingPlayer.findOne({
      where: { roomId, userId: userAlice.id },
    });
    assert.equal(playerAlice.typedChars, 42, 'Older snapshots must not overwrite newer input');

    // A stale reconnect finish snapshot and fake one-millisecond duration are ignored;
    // final metrics use the newer server draft and server time.
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/finish`)
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        typedText: '',
        inputRevision: 0,
        clientDurationMs: 1,
      });

    playerAlice = await TypingPlayer.findOne({
      where: { roomId, userId: userAlice.id },
    });
    assert.equal(playerAlice.typedChars, 42, 'Monotonic guard in submitFinish must not overwrite 42 with 0');
    assert.equal(playerAlice.errorCount, 2);
    assert.ok(playerAlice.wpm < 100, 'Final WPM should use the 30-second server clock, not a fake client duration');
    assert.equal(playerAlice.status, 'FINISHED');

    // Finish Bob as AFK so the room timeout does not outlive this test/database.
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/finish`)
      .set('Authorization', `Bearer ${tokenBob}`)
      .send({ typedText: '', inputRevision: 1 });
    assert.equal((await TypingRoom.findByPk(roomId)).status, 'FINISHED');
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
    await TypingRoom.update({ startedAt: new Date(Date.now() - 60000) }, { where: { id: roomId } });

    // Bob sends finish with 0 chars (AFK timeout)
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/finish`)
      .set('Authorization', `Bearer ${tokenBob}`)
      .send({
        typedText: '',
        inputRevision: 1,
      });

    // Charlie finishes legitimately with full challenge text
    const finishCharlieRes = await request(app)
      .post(`/api/games/typing/rooms/${roomId}/finish`)
      .set('Authorization', `Bearer ${tokenCharlie}`)
      .send({
        typedText: typeWithErrors(startRes.body.room.challengeText.slice(0, 300), 1),
        inputRevision: 1,
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
      where: { userId: userBob.id, idempotencyKey: await matchLedgerKey(roomId, userBob.id) },
    });
    assert.equal(ledgerBob, null, 'No ScoreLedger row should be created for 0-point AFK player');

    const ledgerCharlie = await ScoreLedger.findOne({
      where: { userId: userCharlie.id, idempotencyKey: await matchLedgerKey(roomId, userCharlie.id) },
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
    await TypingRoom.update({ startedAt: new Date(Date.now() - 15000) }, { where: { id: roomId } });

    // Both players submit 0 characters
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/finish`)
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({ typedText: '', inputRevision: 1 });

    const finishRes = await request(app)
      .post(`/api/games/typing/rooms/${roomId}/finish`)
      .set('Authorization', `Bearer ${tokenBob}`)
      .send({ typedText: '', inputRevision: 1 });

    assert.equal(finishRes.status, 200);
    assert.equal(finishRes.body.room.status, 'FINISHED');
    assert.equal(finishRes.body.room.winnerUserId, null, 'Dual-AFK match must have no winner');

    const alicePlayer = await TypingPlayer.findOne({ where: { roomId, userId: userAlice.id } });
    const bobPlayer = await TypingPlayer.findOne({ where: { roomId, userId: userBob.id } });

    assert.equal(alicePlayer.scoreDelta, 0, 'Alice must receive 0 points');
    assert.equal(bobPlayer.scoreDelta, 0, 'Bob must receive 0 points');

    const ledgers = await ScoreLedger.findAll({
      where: { idempotencyKey: [await matchLedgerKey(roomId, userAlice.id), await matchLedgerKey(roomId, userBob.id)] },
    });
    assert.equal(ledgers.length, 0, 'No ScoreLedger rows should be created when both players are AFK');
  });

  await t.test('5. Simultaneous finishes settle the room and rewards exactly once', async () => {
    const beforeStats = await Promise.all([
      TypingUserStat.findOne({ where: { userId: userAlice.id } }),
      TypingUserStat.findOne({ where: { userId: userBob.id } }),
    ]);
    const beforeMatches = beforeStats.map((stat) => Number(stat?.totalMatches || 0));

    const createRes = await request(app)
      .post('/api/games/typing/rooms')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({ title: 'Concurrent Finish Room', mode: '1V1', matchType: 'RANKED', durationLimitSeconds: 120 });
    assert.equal(createRes.status, 201);
    const roomId = createRes.body.room.id;

    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${tokenBob}`);
    await Promise.all([
      request(app).post(`/api/games/typing/rooms/${roomId}/ready`).set('Authorization', `Bearer ${tokenAlice}`).send({ isReady: true }),
      request(app).post(`/api/games/typing/rooms/${roomId}/ready`).set('Authorization', `Bearer ${tokenBob}`).send({ isReady: true }),
    ]);
    const startRes = await request(app)
      .post(`/api/games/typing/rooms/${roomId}/start`)
      .set('Authorization', `Bearer ${tokenAlice}`);
    assert.equal(startRes.status, 200);
    await TypingRoom.update({ startedAt: new Date(Date.now() - 60000) }, { where: { id: roomId } });

    const challenge = startRes.body.room.challengeText;
    const [finishAlice, finishBob] = await Promise.all([
      request(app)
        .post(`/api/games/typing/rooms/${roomId}/finish`)
        .set('Authorization', `Bearer ${tokenAlice}`)
        .send({ typedText: challenge.slice(0, 120), inputRevision: 1 }),
      request(app)
        .post(`/api/games/typing/rooms/${roomId}/finish`)
        .set('Authorization', `Bearer ${tokenBob}`)
        .send({ typedText: challenge.slice(0, 120), inputRevision: 1 }),
    ]);
    assert.equal(finishAlice.status, 200);
    assert.equal(finishBob.status, 200);

    const settledRoom = await TypingRoom.findByPk(roomId);
    assert.equal(settledRoom.status, 'FINISHED');
    assert.equal(await TypingMatchResult.count({ where: { roomId } }), 1);

    const afterStats = await Promise.all([
      TypingUserStat.findOne({ where: { userId: userAlice.id } }),
      TypingUserStat.findOne({ where: { userId: userBob.id } }),
    ]);
    assert.deepEqual(afterStats.map((stat) => Number(stat.totalMatches) - beforeMatches.shift()), [1, 1]);

    for (const player of [userAlice, userBob]) {
      assert.equal(
        await ScoreLedger.count({ where: { idempotencyKey: await matchLedgerKey(roomId, player.id) } }),
        1,
        'Each player can produce at most one authoritative match ledger entry'
      );
    }
  });

  await t.test('6. Timed-out player progress is scored before the final winner is selected', async () => {
    const createRes = await request(app)
      .post('/api/games/typing/rooms')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({ title: 'Timeout Settlement Order', mode: '1V1', matchType: 'RANKED', durationLimitSeconds: 120 });
    const roomId = createRes.body.room.id;

    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${tokenBob}`);
    await Promise.all([
      request(app).post(`/api/games/typing/rooms/${roomId}/ready`).set('Authorization', `Bearer ${tokenAlice}`).send({ isReady: true }),
      request(app).post(`/api/games/typing/rooms/${roomId}/ready`).set('Authorization', `Bearer ${tokenBob}`).send({ isReady: true }),
    ]);
    const startRes = await request(app)
      .post(`/api/games/typing/rooms/${roomId}/start`)
      .set('Authorization', `Bearer ${tokenAlice}`);
    const challenge = startRes.body.room.challengeText;
    await TypingRoom.update({ startedAt: new Date(Date.now() - 60000) }, { where: { id: roomId } });

    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/finish`)
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({ typedText: challenge.slice(0, 25), inputRevision: 1 });
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/progress`)
      .set('Authorization', `Bearer ${tokenBob}`)
      .send({ typedText: challenge.slice(0, 120), inputRevision: 1 });

    const result = await typingGameService.finalizeMatch(roomId);
    assert.equal(result.room.status, 'FINISHED');
    assert.equal(Number(result.room.winnerUserId), Number(userBob.id));
    const timedOutPlayer = await TypingPlayer.findOne({ where: { roomId, userId: userBob.id } });
    assert.equal(timedOutPlayer.status, 'FINISHED');
    assert.ok(timedOutPlayer.performanceScore > 0, 'Server progress is scored before winner selection');
  });
});
