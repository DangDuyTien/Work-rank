'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const env = require('../src/config/env');
const {
  User,
  SamRoom,
  SamPlayer,
  TypingRoom,
  TypingPlayer,
  TypingChallenge,
  TypingMatchResult,
  TypingUserStat,
  sequelize,
} = require('../src/models');

const samGameService = require('../src/services/samGame.service');
const typingGameService = require('../src/services/typingGame.service');
const { canAccessGameRoom } = require('../src/services/gameRoomAuth.service');

test.describe('Multiplayer Deep-Audit Test Suite: Game Sâm & Typing Battle', () => {
  let userA, userB, userC, userD, userE;

  test.before(async () => {
    // Create test users
    const timestamp = Date.now();
    userA = await User.create({
      email: `playerA_${timestamp}@test.workrank.vn`,
      passwordHash: 'dummy_hash',
      name: `Player A (Host) ${timestamp}`,
      role: 'user',
      status: 'active',
      department: 'Engineering',
      jobTitle: 'Developer',
    });

    userB = await User.create({
      email: `playerB_${timestamp}@test.workrank.vn`,
      passwordHash: 'dummy_hash',
      name: `Player B ${timestamp}`,
      role: 'user',
      status: 'active',
      department: 'Product',
      jobTitle: 'Designer',
    });

    userC = await User.create({
      email: `playerC_${timestamp}@test.workrank.vn`,
      passwordHash: 'dummy_hash',
      name: `Player C ${timestamp}`,
      role: 'user',
      status: 'active',
      department: 'Marketing',
      jobTitle: 'Marketer',
    });

    userD = await User.create({
      email: `playerD_${timestamp}@test.workrank.vn`,
      passwordHash: 'dummy_hash',
      name: `Player D ${timestamp}`,
      role: 'user',
      status: 'active',
      department: 'Sales',
      jobTitle: 'Account Exec',
    });

    userE = await User.create({
      email: `playerE_${timestamp}@test.workrank.vn`,
      passwordHash: 'dummy_hash',
      name: `Player E (Extra) ${timestamp}`,
      role: 'user',
      status: 'active',
      department: 'Operations',
      jobTitle: 'Operations',
    });

    await typingGameService.ensureChallengesExist();
  });

  test.after(async () => {
    // Cleanup created users and associated records
    const ids = [userA?.id, userB?.id, userC?.id, userD?.id, userE?.id].filter(Boolean);
    if (ids.length > 0) {
      await SamPlayer.destroy({ where: { userId: ids } }).catch(() => {});
      await TypingPlayer.destroy({ where: { userId: ids } }).catch(() => {});
      await TypingUserStat.destroy({ where: { userId: ids } }).catch(() => {});
      await User.destroy({ where: { id: ids } }).catch(() => {});
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PART 1: GAME SÂM AUDIT
  // ══════════════════════════════════════════════════════════════════════════

  test('1.1. Sâm Room Creation: Stale abandoned matches do NOT block new room creation', async () => {
    // Simulate an old stale PLAYING room where userA was active days ago
    const staleRoom = await SamRoom.create({
      code: `STL_${Date.now() % 100000}`,
      title: 'Phòng Cũ Treo',
      hostUserId: userA.id,
      status: 'PLAYING',
      samPhase: 'PLAYING',
      maxPlayers: 4,
      roundNumber: 1,
      startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      turnDeadline: new Date(Date.now() - 23 * 60 * 60 * 1000),
    });

    await SamPlayer.create({
      roomId: staleRoom.id,
      userId: userA.id,
      seatIndex: 0,
      status: 'ACTIVE',
      playerType: 'HUMAN',
      handCards: [],
    });

    // Now User A creates a new room -> must succeed and auto-heal stale room
    const created = await samGameService.createRoom(
      { title: 'Phòng Sâm Mới', maxPlayers: 4 },
      userA
    );

    assert.ok(created?.room?.id, 'New room must be created');
    assert.equal(created.room.status, 'WAITING');
    assert.equal(created.room.hostUserId, userA.id);
    assert.equal(created.players.length, 1);
    assert.equal(created.players[0].userId, userA.id);

    // Verify stale room was marked ABANDONED
    const refreshedStale = await SamRoom.findByPk(staleRoom.id);
    assert.equal(refreshedStale.status, 'ABANDONED');
  });

  test('1.2. Sâm Multi-Client Join: Multi-player seat allocation, duplicate idempotent join, capacity enforcement', async () => {
    // User A creates a 3-player room
    const created = await samGameService.createRoom(
      { title: 'Phòng Sâm 3 Người', maxPlayers: 3 },
      userA
    );
    const roomId = created.room.id;

    // Check Socket authorization guard for WAITING room
    const authA = await canAccessGameRoom({
      userId: userA.id,
      userRole: userA.role,
      roomId,
      gameType: 'sam',
      clientSpectatorHint: false,
    });
    assert.equal(authA.allowed, true, 'Host A must have socket access');
    assert.equal(authA.isSpectator, false, 'Host A is a player');

    // User B joins room
    const detailB = await samGameService.joinRoom(roomId, userB.id, userB);
    assert.equal(detailB.players.length, 2, 'Room now has 2 players');
    const playerB = detailB.players.find((p) => Number(p.userId) === Number(userB.id));
    assert.ok(playerB, 'Player B is registered');
    assert.equal(playerB.seatIndex, 1, 'Player B gets seat 1');

    // User B duplicate join -> must be idempotent without creating duplicate player record
    const dupJoinB = await samGameService.joinRoom(roomId, userB.id, userB);
    assert.equal(dupJoinB.players.length, 2, 'Duplicate join must maintain 2 players');

    // User C joins room
    const detailC = await samGameService.joinRoom(roomId, userC.id, userC);
    assert.equal(detailC.players.length, 3, 'Room now has 3 players');
    const playerC = detailC.players.find((p) => Number(p.userId) === Number(userC.id));
    assert.equal(playerC.seatIndex, 2, 'Player C gets seat 2');

    // Room is now full (3/3). User D tries to join -> Must be rejected with ConflictError
    await assert.rejects(
      async () => {
        await samGameService.joinRoom(roomId, userD.id, userD);
      },
      (err) => {
        return err.name === 'ConflictError' || err.message.includes('đã đủ người');
      },
      'Joining full room must throw ConflictError'
    );

    // Clean up
    await samGameService.leaveRoom(roomId, userA.id);
    await samGameService.leaveRoom(roomId, userB.id);
    await samGameService.leaveRoom(roomId, userC.id);
  });

  test('1.3. Sâm Practice vs Bot: non-admin member can create practice bot room and access socket', async () => {
    const practiceRoom = await samGameService.createPracticeRoom({ botCount: 3 }, userB);
    assert.ok(practiceRoom?.room?.id, 'Practice room created');
    assert.equal(practiceRoom.room.status, 'PLAYING', 'Practice bot match starts immediately');
    assert.equal(practiceRoom.room.isTest, true);
    assert.equal(practiceRoom.room.testScenario, 'PRACTICE_BOT');

    // Verify non-admin host has socket access
    const authB = await canAccessGameRoom({
      userId: userB.id,
      userRole: userB.role,
      roomId: practiceRoom.room.id,
      gameType: 'sam',
      clientSpectatorHint: false,
    });
    assert.equal(authB.allowed, true, 'Practice bot host must be permitted into socket room');

    // Clean up
    await samGameService.leaveRoom(practiceRoom.room.id, userB.id);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PART 2: TYPING BATTLE AUDIT
  // ══════════════════════════════════════════════════════════════════════════

  test('2.1. Typing Battle 1v1: End-to-end Lifecycle (Create -> Join -> Ready -> Start -> Progress -> Finish -> Settle)', async () => {
    // 1. Client A creates 1v1 Room
    const created = await typingGameService.createRoom(
      {
        title: 'Đấu Trường Đánh Máy 1v1 Audit',
        mode: '1V1',
        matchType: 'RANKED',
        durationLimitSeconds: 120,
      },
      userA
    );
    const roomId = created.room.id;
    assert.equal(created.room.status, 'WAITING');
    assert.equal(created.room.mode, '1V1');
    assert.equal(created.players.length, 1);
    assert.equal(created.players[0].userId, userA.id);

    // 2. Client B joins Room
    const detailAfterJoin = await typingGameService.joinRoom(roomId, userB.id);
    assert.equal(detailAfterJoin.players.length, 2, 'Both players registered');
    const playerB = detailAfterJoin.players.find((p) => Number(p.userId) === Number(userB.id));
    assert.ok(playerB, 'Player B is present');
    assert.equal(playerB.status, 'WAITING');

    // 3. Duplicate join from B -> idempotent
    const dupJoin = await typingGameService.joinRoom(roomId, userB.id);
    assert.equal(dupJoin.players.length, 2);

    // 4. Client C attempts to join full 1v1 room -> rejected
    await assert.rejects(
      async () => {
        await typingGameService.joinRoom(roomId, userC.id);
      },
      (err) => err.name === 'ConflictError' || err.message.includes('đã đủ người')
    );

    // 5. Socket access authorization check for both players
    const socketAuthA = await canAccessGameRoom({
      userId: userA.id,
      userRole: userA.role,
      roomId,
      gameType: 'typing',
      clientSpectatorHint: false,
    });
    const socketAuthB = await canAccessGameRoom({
      userId: userB.id,
      userRole: userB.role,
      roomId,
      gameType: 'typing',
      clientSpectatorHint: false,
    });
    assert.equal(socketAuthA.allowed, true, 'User A can connect to socket room');
    assert.equal(socketAuthB.allowed, true, 'User B can connect to socket room');
    assert.equal(socketAuthA.isSpectator, false);
    assert.equal(socketAuthB.isSpectator, false);

    // 6. Players Toggle Ready
    await typingGameService.toggleReady(roomId, userB.id, true);
    await typingGameService.toggleReady(roomId, userA.id, true);

    // 7. Start Match
    const started = await typingGameService.startMatch(roomId, userA.id, true);
    assert.equal(started.room.status, 'PLAYING');
    assert.ok(started.room.challengeText, 'Challenge text must be present');
    const challengeLen = started.room.challengeText.length;

    // 8. Submit Typing Progress
    await typingGameService.updateProgress(roomId, userA.id, {
      typedChars: Math.floor(challengeLen * 0.5),
      errorCount: 1,
      clientDurationMs: 15000,
    });
    await typingGameService.updateProgress(roomId, userB.id, {
      typedChars: Math.floor(challengeLen * 0.4),
      errorCount: 2,
      clientDurationMs: 15000,
    });

    // 9. Client A Finishes First
    const finishA = await typingGameService.submitFinish(roomId, userA.id, {
      typedChars: challengeLen,
      errorCount: 2,
      clientDurationMs: 30000,
    });

    // 10. Client B Finishes
    const finalResult = await typingGameService.submitFinish(roomId, userB.id, {
      typedChars: challengeLen,
      errorCount: 5,
      clientDurationMs: 35000,
    });

    assert.equal(finalResult.room.status, 'FINISHED');
    assert.equal(finalResult.room.winnerUserId, userA.id, 'Player A who finished with higher score/faster wins');
    assert.ok(finalResult.result, 'Match result record created');

    // 11. Host resets room for Rematch
    const reset = await typingGameService.resetRoom(roomId, userA.id);
    assert.equal(reset.room.status, 'WAITING');
    assert.equal(reset.players.length, 2);
    assert.equal(reset.players[0].status, 'WAITING');
    assert.equal(reset.players[1].status, 'WAITING');

    // Clean up
    await typingGameService.leaveRoom(roomId, userA.id);
    await typingGameService.leaveRoom(roomId, userB.id);
  });

  test('2.2. Typing Battle 2v2: Team Assignment and Automatic Balancing', async () => {
    // Client A creates 2v2 room
    const created = await typingGameService.createRoom(
      {
        title: 'Đại Chiến 2v2 Đồng Đội',
        mode: '2V2',
        matchType: 'RANKED',
      },
      userA
    );
    const roomId = created.room.id;
    assert.equal(created.players[0].team, 'A', 'Host gets Team A');

    // Client B joins -> should be assigned to Team B for balance
    const joinB = await typingGameService.joinRoom(roomId, userB.id);
    const pB = joinB.players.find((p) => Number(p.userId) === Number(userB.id));
    assert.equal(pB.team, 'B', 'Player B assigned to Team B');

    // Client C joins -> should be assigned to Team A
    const joinC = await typingGameService.joinRoom(roomId, userC.id);
    const pC = joinC.players.find((p) => Number(p.userId) === Number(userC.id));
    assert.equal(pC.team, 'A', 'Player C assigned to Team A');

    // Client D joins -> should be assigned to Team B
    const joinD = await typingGameService.joinRoom(roomId, userD.id);
    const pD = joinD.players.find((p) => Number(p.userId) === Number(userD.id));
    assert.equal(pD.team, 'B', 'Player D assigned to Team B');

    // Check team count: 2 in Team A, 2 in Team B
    const teamA = joinD.players.filter((p) => p.team === 'A');
    const teamB = joinD.players.filter((p) => p.team === 'B');
    assert.equal(teamA.length, 2, 'Team A has exactly 2 players');
    assert.equal(teamB.length, 2, 'Team B has exactly 2 players');

    // Clean up
    await typingGameService.leaveRoom(roomId, userA.id);
    await typingGameService.leaveRoom(roomId, userB.id);
    await typingGameService.leaveRoom(roomId, userC.id);
    await typingGameService.leaveRoom(roomId, userD.id);
  });

  test('2.3. Typing Practice Result: Test duration requirement (>= 120s for personal BXH)', async () => {
    // 30s test: should NOT be recorded to leaderboard
    const res30s = await typingGameService.submitPracticeResult(
      {
        durationLimitSeconds: 30,
        wpm: 85,
        accuracy: 98,
        typedChars: 200,
        errorCount: 2,
      },
      userA
    );
    assert.equal(res30s.recorded, false);
    assert.equal(res30s.reason, 'DURATION_LESS_THAN_2_MINUTES');

    // 120s (2 min) test: MUST be recorded to leaderboard & personal stats
    const res120s = await typingGameService.submitPracticeResult(
      {
        durationLimitSeconds: 120,
        wpm: 92,
        accuracy: 99,
        typedChars: 800,
        errorCount: 3,
      },
      userA
    );
    assert.equal(res120s.recorded, true);
    assert.ok(res120s.awardedXp > 0, 'XP points awarded');
    assert.equal(res120s.stats.bestWpm >= 92, true);
  });
});
