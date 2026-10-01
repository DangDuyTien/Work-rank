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
const samEngine = require('../src/utils/samEngine');

test('Comprehensive Sam Lốc V1 Full Vertical Slice E2E Test Suite', async (t) => {
  let hostUser, player2, player3, player4;
  let hostToken, token2, token3, token4;
  let testRoomId = null;

  before(async () => {
    await SamRoom.sync({ alter: true });
    await SamPlayer.sync({ alter: true });
    await SamAction.sync({ alter: true });
    await SamResult.sync({ alter: true });
    await SamUserStat.sync({ alter: true });

    const ts = Date.now();
    hostUser = await User.create({
      name: `Host Sâm ${ts}`,
      email: `sam_host_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Game Master',
      department: 'Phòng Media',
    });

    player2 = await User.create({
      name: `Player Hai ${ts}`,
      email: `sam_p2_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Video Editor',
      department: 'Phòng Kỹ Thuật',
    });

    player3 = await User.create({
      name: `Player Ba ${ts}`,
      email: `sam_p3_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Content Creator',
      department: 'Phòng Nội Dung',
    });

    player4 = await User.create({
      name: `Player Bốn ${ts}`,
      email: `sam_p4_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Designer',
      department: 'Phòng Thiết Kế',
    });

    hostToken = jwt.sign({ sub: hostUser.id, role: hostUser.role }, env.jwtSecret);
    token2 = jwt.sign({ sub: player2.id, role: player2.role }, env.jwtSecret);
    token3 = jwt.sign({ sub: player3.id, role: player3.role }, env.jwtSecret);
    token4 = jwt.sign({ sub: player4.id, role: player4.role }, env.jwtSecret);
  });

  after(async () => {
    if (testRoomId) {
      await SamAction.destroy({ where: { roomId: testRoomId } });
      await SamResult.destroy({ where: { roomId: testRoomId } });
      await SamPlayer.destroy({ where: { roomId: testRoomId } });
      await SamRoom.destroy({ where: { id: testRoomId } });
    }
    if (hostUser) await hostUser.destroy();
    if (player2) await player2.destroy();
    if (player3) await player3.destroy();
    if (player4) await player4.destroy();
  });

  await t.test('1. Create room and list rooms in lobby', async () => {
    const res = await request(app)
      .post('/api/games/sam/rooms')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ title: 'Bàn Đánh Sâm 3Win Media', maxPlayers: 4 });

    assert.equal(res.status, 201);
    assert.ok(res.body.room.id);
    assert.equal(res.body.room.title, 'Bàn Đánh Sâm 3Win Media');
    assert.equal(res.body.room.maxPlayers, 4);
    assert.equal(res.body.players.length, 1);
    assert.equal(res.body.players[0].userId, hostUser.id);
    assert.equal(res.body.players[0].isHost, true);

    testRoomId = res.body.room.id;

    // Check list
    const listRes = await request(app)
      .get('/api/games/sam/rooms')
      .set('Authorization', `Bearer ${token2}`);
    assert.equal(listRes.status, 200);
    const found = listRes.body.find((r) => r.id === testRoomId);
    assert.ok(found, 'Created room must appear in lobby list');
    assert.equal(found.playerCount, 1);
  });

  await t.test('2. Multiple players join room up to limit (Multiplayer)', async () => {
    // Player 2 joins
    const join2 = await request(app)
      .post(`/api/games/sam/rooms/${testRoomId}/join`)
      .set('Authorization', `Bearer ${token2}`);
    assert.equal(join2.status, 200);
    assert.equal(join2.body.players.length, 2);

    // Player 3 joins
    const join3 = await request(app)
      .post(`/api/games/sam/rooms/${testRoomId}/join`)
      .set('Authorization', `Bearer ${token3}`);
    assert.equal(join3.status, 200);
    assert.equal(join3.body.players.length, 3);

    // Check seat assignments
    const seats = join3.body.players.map((p) => p.seatIndex);
    assert.deepEqual(seats.sort(), [0, 1, 2]);
  });

  await t.test('3. Non-host cannot start match, only host can start', async () => {
    const fakeStart = await request(app)
      .post(`/api/games/sam/rooms/${testRoomId}/start`)
      .set('Authorization', `Bearer ${token2}`);
    assert.equal(fakeStart.status, 500); // Only host can start

    const realStart = await request(app)
      .post(`/api/games/sam/rooms/${testRoomId}/start`)
      .set('Authorization', `Bearer ${hostToken}`);
    assert.equal(realStart.status, 200);
    assert.equal(realStart.body.room.status, 'PLAYING');
    assert.equal(realStart.body.room.samPhase, 'SAM_DECLARING');

    // Verify all 3 players have 10 cards dealt
    const playersInRoom = await SamPlayer.findAll({ where: { roomId: testRoomId } });
    assert.equal(playersInRoom.length, 3);
    playersInRoom.forEach((p) => {
      assert.equal(p.handCards.length, 10, 'Each player must be dealt exactly 10 cards');
      assert.equal(p.remainingCardsCount, 10);
      assert.equal(p.status, 'ACTIVE');
    });
  });

  await t.test('4. Security & Privacy: Opponents cannot view private cards', async () => {
    // Host views room
    const hostView = await request(app)
      .get(`/api/games/sam/rooms/${testRoomId}`)
      .set('Authorization', `Bearer ${hostToken}`);
    assert.equal(hostView.status, 200);
    assert.equal(hostView.body.myHandCards.length, 10);

    // Host should NOT see handCards of other players
    const otherPlayers = hostView.body.players.filter((p) => p.userId !== hostUser.id);
    otherPlayers.forEach((p) => {
      assert.equal(p.handCards, undefined, 'Server must never expose opponent hand cards');
      assert.equal(p.remainingCardsCount, 10);
    });
  });

  await t.test('5. Sâm Declaration phase: Declare Sâm or Skip', async () => {
    // Player 2 declares Sam
    const decRes = await request(app)
      .post(`/api/games/sam/rooms/${testRoomId}/declare-sam`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ declare: true });
    assert.equal(decRes.status, 200);
    assert.equal(decRes.body.room.samDeclarerId, player2.id);
    assert.equal(decRes.body.room.currentTurnUserId, player2.id, 'Declarer gets first turn');
    assert.equal(decRes.body.room.samPhase, 'PLAYING');
  });

  await t.test('6. Turn validation: Server rejects move from wrong player', async () => {
    // Host tries to play when currentTurnUserId is player2
    const wrongTurn = await request(app)
      .post(`/api/games/sam/rooms/${testRoomId}/play-cards`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ cardIds: ['3S'] });
    assert.equal(wrongTurn.status, 500);
    assert.match(wrongTurn.body.message || wrongTurn.text, /Chưa đến lượt/);
  });

  await t.test('7. Card ownership validation: Rejects unowned card', async () => {
    // Player 2 attempts to play card not in hand
    const fakeCard = await request(app)
      .post(`/api/games/sam/rooms/${testRoomId}/play-cards`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ cardIds: ['NON_EXISTENT_CARD'] });
    assert.equal(fakeCard.status, 500);
    assert.match(fakeCard.body.message || fakeCard.text, /không có trên tay/);
  });

  await t.test('8. Valid play, Turn progression & Hand update', async () => {
    const p2Detail = await request(app)
      .get(`/api/games/sam/rooms/${testRoomId}`)
      .set('Authorization', `Bearer ${token2}`);

    const cardToPlay = p2Detail.body.myHandCards[0]; // Play lowest card
    assert.ok(cardToPlay);

    const playRes = await request(app)
      .post(`/api/games/sam/rooms/${testRoomId}/play-cards`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ cardIds: [cardToPlay] });

    assert.equal(playRes.status, 200);
    assert.equal(playRes.body.room.lastPlayedCards.cards[0], cardToPlay);
    assert.equal(playRes.body.myHandCards.length, 9, 'Hand must decrement to 9');
    assert.notEqual(playRes.body.room.currentTurnUserId, player2.id, 'Turn must advance');
  });

  await t.test('9. Pass Turn & Round Reset when all other players pass', async () => {
    const roomState = await request(app)
      .get(`/api/games/sam/rooms/${testRoomId}`)
      .set('Authorization', `Bearer ${hostToken}`);

    const tokenMap = {
      [hostUser.id]: hostToken,
      [player2.id]: token2,
      [player3.id]: token3,
      [player4.id]: token4,
    };

    // First opponent passes
    let currentTurnUser = roomState.body.room.currentTurnUserId;
    let currentToken = tokenMap[currentTurnUser];

    const pass1 = await request(app)
      .post(`/api/games/sam/rooms/${testRoomId}/pass`)
      .set('Authorization', `Bearer ${currentToken}`);
    assert.equal(pass1.status, 200);

    // Remaining opponent passes
    currentTurnUser = pass1.body.room.currentTurnUserId;
    currentToken = tokenMap[currentTurnUser];

    const pass2 = await request(app)
      .post(`/api/games/sam/rooms/${testRoomId}/pass`)
      .set('Authorization', `Bearer ${currentToken}`);
    assert.equal(pass2.status, 200);

    // Round should reset and player 2 wins the round to start fresh
    assert.equal(pass2.body.room.lastPlayedCards, null, 'Board clears on new round');
    assert.equal(pass2.body.room.currentTurnUserId, player2.id);
  });

  await t.test('10. Leaderboard & Personal Stats endpoints work correctly', async () => {
    const lbRes = await request(app)
      .get('/api/games/sam/leaderboard')
      .set('Authorization', `Bearer ${hostToken}`);
    assert.equal(lbRes.status, 200);
    assert.ok(Array.isArray(lbRes.body.data));

    const statsRes = await request(app)
      .get('/api/games/sam/my-stats')
      .set('Authorization', `Bearer ${hostToken}`);
    assert.equal(statsRes.status, 200);
    assert.equal(statsRes.body.userId, hostUser.id);
  });
});
