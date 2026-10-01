'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const {
  User,
  SamRoom,
  SamPlayer,
  SamAction,
  SamResult,
  SamUserStat,
} = require('../src/models');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const samGameService = require('../src/services/samGame.service');

test('Comprehensive Sam Lốc Spectator & Admin Bot Test E2E Suite', async (t) => {
  let adminUser, memberUser, spectatorUser, player2;
  let adminToken, memberToken, spectatorToken, player2Token;
  let liveRoomId = null;
  let botRoomId = null;

  before(async () => {
    await SamRoom.sync();
    await SamPlayer.sync();
    await SamAction.sync();
    await SamResult.sync();
    await SamUserStat.sync();

    const ts = Date.now();
    adminUser = await User.create({
      name: `Admin Test ${ts}`,
      email: `admin_sam_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'admin',
      jobTitle: 'System Admin',
      department: 'Ban Quản Trị',
    });

    memberUser = await User.create({
      name: `Member Thường ${ts}`,
      email: `member_sam_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Video Editor',
      department: 'Phòng Media',
    });

    spectatorUser = await User.create({
      name: `Khán Giả ${ts}`,
      email: `spectator_sam_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Content Creator',
      department: 'Phòng Nội Dung',
    });

    player2 = await User.create({
      name: `Player Đối Thủ ${ts}`,
      email: `player2_sam_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Designer',
      department: 'Phòng Thiết Kế',
    });

    adminToken = jwt.sign({ sub: adminUser.id, role: adminUser.role }, env.jwtSecret);
    memberToken = jwt.sign({ sub: memberUser.id, role: memberUser.role }, env.jwtSecret);
    spectatorToken = jwt.sign({ sub: spectatorUser.id, role: spectatorUser.role }, env.jwtSecret);
    player2Token = jwt.sign({ sub: player2.id, role: player2.role }, env.jwtSecret);
  });

  after(async () => {
    if (liveRoomId) {
      await SamAction.destroy({ where: { roomId: liveRoomId } });
      await SamResult.destroy({ where: { roomId: liveRoomId } });
      await SamPlayer.destroy({ where: { roomId: liveRoomId } });
      await SamRoom.destroy({ where: { id: liveRoomId } });
    }
    if (botRoomId) {
      await SamAction.destroy({ where: { roomId: botRoomId } });
      await SamResult.destroy({ where: { roomId: botRoomId } });
      await SamPlayer.destroy({ where: { roomId: botRoomId } });
      await SamRoom.destroy({ where: { id: botRoomId } });
    }
    if (adminUser) await adminUser.destroy();
    if (memberUser) await memberUser.destroy();
    if (spectatorUser) await spectatorUser.destroy();
    if (player2) await player2.destroy();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. SPECTATOR MODE TESTS
  // ─────────────────────────────────────────────────────────────

  await t.test('SPECTATOR 1: Live match setup with 2 players', async () => {
    const createRes = await request(app)
      .post('/api/games/sam/rooms')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'Bàn Đánh Sâm Trực Tiếp', maxPlayers: 2 });
    assert.equal(createRes.status, 201);
    liveRoomId = createRes.body.room.id;

    // Player 2 joins
    const joinRes = await request(app)
      .post(`/api/games/sam/rooms/${liveRoomId}/join`)
      .set('Authorization', `Bearer ${player2Token}`);
    assert.equal(joinRes.status, 200);

    // Host starts match
    const startRes = await request(app)
      .post(`/api/games/sam/rooms/${liveRoomId}/start`)
      .set('Authorization', `Bearer ${memberToken}`);
    assert.equal(startRes.status, 200);
    assert.equal(startRes.body.room.status, 'PLAYING');
  });

  await t.test('SPECTATOR 2: Spectator enters match, gets sanitized state without private hands', async () => {
    const specRes = await request(app)
      .get(`/api/games/sam/rooms/${liveRoomId}`)
      .set('Authorization', `Bearer ${spectatorToken}`);

    assert.equal(specRes.status, 200);
    assert.equal(specRes.body.isSpectator, true, 'User must be identified as spectator');
    assert.deepEqual(specRes.body.myHandCards, [], 'Spectator must receive empty myHandCards');

    // Private hand security: NO opponent private cards exposed to spectator!
    assert.equal(specRes.body.players.length, 2);
    specRes.body.players.forEach((p) => {
      assert.equal(p.handCards, undefined, 'Server MUST NOT expose private cards to spectator');
      assert.equal(p.remainingCardsCount, 10, 'Card count must be visible');
    });

    // Spectator does NOT occupy player slot
    const listRes = await request(app)
      .get('/api/games/sam/rooms')
      .set('Authorization', `Bearer ${spectatorToken}`);
    assert.equal(listRes.status, 200);
    const roomInList = listRes.body.find((r) => r.id === liveRoomId);
    assert.equal(roomInList.playerCount, 2, 'Player count should remain 2');
  });

  await t.test('SPECTATOR 3: Spectator cannot play cards, pass, or declare Sam', async () => {
    // Attempt play cards
    const playAttempt = await request(app)
      .post(`/api/games/sam/rooms/${liveRoomId}/play-cards`)
      .set('Authorization', `Bearer ${spectatorToken}`)
      .send({ cardIds: ['3S'] });
    assert.equal(playAttempt.status, 500);
    assert.match(playAttempt.body.message || playAttempt.text, /không tồn tại trong phòng|Chưa đến lượt/);

    // Attempt pass
    const passAttempt = await request(app)
      .post(`/api/games/sam/rooms/${liveRoomId}/pass`)
      .set('Authorization', `Bearer ${spectatorToken}`);
    assert.equal(passAttempt.status, 500);

    // Attempt declare Sam
    const samAttempt = await request(app)
      .post(`/api/games/sam/rooms/${liveRoomId}/declare-sam`)
      .set('Authorization', `Bearer ${spectatorToken}`)
      .send({ declare: true });
    assert.equal(samAttempt.status, 500);
  });

  await t.test('SPECTATOR 4: Spectator reconnect gets public board without resetting game', async () => {
    const reconnRes = await request(app)
      .get(`/api/games/sam/rooms/${liveRoomId}`)
      .set('Authorization', `Bearer ${spectatorToken}`);

    assert.equal(reconnRes.status, 200);
    assert.equal(reconnRes.body.room.status, 'PLAYING');
    assert.equal(reconnRes.body.isSpectator, true);
    assert.deepEqual(reconnRes.body.myHandCards, []);
  });

  // ─────────────────────────────────────────────────────────────
  // 2. ADMIN BOT TEST RBAC & SECURITY TESTS
  // ─────────────────────────────────────────────────────────────

  await t.test('BOT TEST RBAC: Non-admin calling bot-room API directly gets 403 Forbidden', async () => {
    // Regular member attempts POST /api/games/sam/admin/bot-room
    const nonAdminRes1 = await request(app)
      .post('/api/games/sam/admin/bot-room')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'Hack Bot Room', playerCount: 4, botCount: 3 });
    assert.equal(nonAdminRes1.status, 403, 'Regular member must receive 403 on admin bot-room endpoint');

    // Regular member attempts POST /api/games/sam/bot-room
    const nonAdminRes2 = await request(app)
      .post('/api/games/sam/bot-room')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'Hack Bot Room' });
    assert.equal(nonAdminRes2.status, 403);

    // Regular member attempts GET /api/games/sam/admin/bot-rooms
    const nonAdminList = await request(app)
      .get('/api/games/sam/admin/bot-rooms')
      .set('Authorization', `Bearer ${memberToken}`);
    assert.equal(nonAdminList.status, 403);
  });

  await t.test('BOT TEST CREATION: Admin creates Bot Test Room (1 Human + 3 Bots)', async () => {
    const botRes = await request(app)
      .post('/api/games/sam/admin/bot-room')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Đánh Sâm — Bot Test Alpha',
        playerCount: 4,
        botCount: 3,
        difficulty: 'NORMAL',
        scenario: '1_HUMAN_3_BOTS',
      });

    assert.equal(botRes.status, 201);
    assert.ok(botRes.body.room.id);
    assert.equal(botRes.body.room.roomType, 'BOT_TEST');
    assert.equal(botRes.body.room.isTest, true);
    assert.equal(botRes.body.room.title, 'Đánh Sâm — Bot Test Alpha');
    assert.equal(botRes.body.players.length, 4);

    botRoomId = botRes.body.room.id;

    // Check player identities: Seat 0 is Admin, Seats 1, 2, 3 are Bots
    const p0 = botRes.body.players[0];
    assert.equal(p0.seatIndex, 0);
    assert.equal(p0.isHost, true);
    assert.equal(p0.isBot, false);
    assert.equal(Number(p0.userId), adminUser.id);

    const bots = botRes.body.players.slice(1);
    assert.equal(bots.length, 3);
    bots.forEach((b, idx) => {
      assert.equal(b.isBot, true);
      assert.equal(b.botId, `BOT_TEST_0${idx + 2}`);
      assert.ok(b.user.name.startsWith('BOT-'));
    });

    // Verify bots are NOT created in real users table!
    const allUsers = await User.findAll({ attributes: ['email', 'name'] });
    const botInUsers = allUsers.find((u) => u.name?.includes('BOT_TEST') || u.email?.includes('bot'));
    assert.equal(botInUsers, undefined, 'Bots must NEVER create rows in real users table');
  });

  await t.test('BOT DATA ISOLATION: Member cannot see Bot Test room in public lobby', async () => {
    const memberLobby = await request(app)
      .get('/api/games/sam/rooms')
      .set('Authorization', `Bearer ${memberToken}`);

    assert.equal(memberLobby.status, 200);
    const foundBotRoom = memberLobby.body.find((r) => r.id === botRoomId);
    assert.equal(foundBotRoom, undefined, 'Bot test room MUST NOT appear in member public room list');

    // Member direct GET room detail returns 403
    const memberGetRoom = await request(app)
      .get(`/api/games/sam/rooms/${botRoomId}`)
      .set('Authorization', `Bearer ${memberToken}`);
    assert.equal(memberGetRoom.status, 403, 'Member cannot access bot test room');
  });

  await t.test('BOT TEST CONTROLS: Admin can start match, pause, resume, fill bots, restart, debug', async () => {
    // 1. Admin starts bot test room
    const startRes = await request(app)
      .post(`/api/games/sam/admin/rooms/${botRoomId}/start`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(startRes.status, 200);
    assert.equal(startRes.body.room.status, 'PLAYING');
    assert.equal(startRes.body.room.samPhase, 'SAM_DECLARING');

    // 2. Admin inspects bot debug state
    const debugRes = await request(app)
      .get(`/api/games/sam/admin/rooms/${botRoomId}/debug`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(debugRes.status, 200);
    assert.equal(debugRes.body.players.length, 4);

    // 3. Pause
    const pauseRes = await request(app)
      .post(`/api/games/sam/admin/rooms/${botRoomId}/pause`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(pauseRes.status, 200);
    assert.equal(pauseRes.body.room.botPaused, true);

    // 4. Resume
    const resumeRes = await request(app)
      .post(`/api/games/sam/admin/rooms/${botRoomId}/resume`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(resumeRes.status, 200);
    assert.equal(resumeRes.body.room.botPaused, false);

    // 5. Restart
    const restartRes = await request(app)
      .post(`/api/games/sam/admin/rooms/${botRoomId}/restart`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(restartRes.status, 200);
    assert.equal(restartRes.body.room.status, 'PLAYING');
  });

  await t.test('BOT LEADERBOARD EXCLUSION: Bot match win does NOT pollute official leaderboard or stats', async () => {
    const initialStats = await SamUserStat.findAll();
    const initialCount = initialStats.length;

    // Simulate bot match finish in test room
    const testRoom = await SamRoom.findByPk(botRoomId, {
      include: [{ model: SamPlayer, as: 'players' }],
    });
    const botWinner = testRoom.players.find((p) => p.isBot);
    assert.ok(botWinner);

    // Restart and finish match
    await samGameService.restartBotTest(botRoomId, adminUser.id);
    await samGameService.finishMatch(botRoomId, botWinner.botId || botWinner.id);

    // Leaderboard query
    const lbRes = await request(app)
      .get('/api/games/sam/leaderboard')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(lbRes.status, 200);

    // Verify NO bot in leaderboard
    const botInLb = lbRes.body.data.find((row) => row.user?.name?.includes('BOT') || row.userId?.toString().startsWith('BOT'));
    assert.equal(botInLb, undefined, 'Leaderboard must NEVER contain bot players');

    // UserStats count must not include bots
    const afterStats = await SamUserStat.findAll();
    assert.equal(afterStats.length, initialCount, 'Bot match must not insert rows into SamUserStat');
  });
});
