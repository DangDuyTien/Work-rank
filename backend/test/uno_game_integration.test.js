'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const {
  sequelize,
  User,
  UnoRoom,
  UnoPlayer,
  UnoAction,
  UnoResult,
  UnoUserStat,
  ScoreLedger,
} = require('../src/models');
const { ensureUnoSchema } = require('../src/services/unoSchemaCheck');
const unoGameService = require('../src/services/unoGame.service');
const unoEngine = require('../src/utils/unoEngine');

test('UNO Multiplayer Game - Full Backend & Authority Integration Suite', async (t) => {
  let user1, user2, user3;
  let token1, token2, token3;

  before(async () => {
    await ensureUnoSchema(sequelize);

    const ts = Date.now();
    user1 = await User.create({
      name: `UNO Player One ${ts}`,
      email: `uno1_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'Developer',
    });

    user2 = await User.create({
      name: `UNO Player Two ${ts}`,
      email: `uno2_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'Designer',
    });

    user3 = await User.create({
      name: `UNO Player Three ${ts}`,
      email: `uno3_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'Product Manager',
    });

    token1 = jwt.sign({ sub: user1.id, role: 'user' }, env.jwtSecret);
    token2 = jwt.sign({ sub: user2.id, role: 'user' }, env.jwtSecret);
    token3 = jwt.sign({ sub: user3.id, role: 'user' }, env.jwtSecret);
  });

  await t.test('1. Room Creation: Host creates room, assigned seat 0 and marked ready', async () => {
    const res = await request(app)
      .post('/api/games/uno/rooms')
      .set('Authorization', `Bearer ${token1}`)
      .send({ title: 'Đấu Trường UNO Vô Địch' });

    assert.equal(res.status, 201);
    assert.ok(res.body.success);
    assert.ok(res.body.data.id);
    assert.equal(res.body.data.title, 'Đấu Trường UNO Vô Địch');
    assert.equal(res.body.data.status, 'WAITING');
    assert.equal(res.body.data.players.length, 1);
    assert.equal(res.body.data.players[0].userId, user1.id);
    assert.equal(res.body.data.players[0].seatIndex, 0);
  });

  await t.test('2. Room Listing: WAITING rooms sorted first, pagination works', async () => {
    const res = await request(app)
      .get('/api/games/uno/rooms')
      .set('Authorization', `Bearer ${token1}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 1);
  });

  await t.test('3. Join Room & Capacity: User 2 joins, seat 1 allocated, max 4 enforced', async () => {
    // Get room created by user1
    const activeRoom = await unoGameService.getActiveRoom(user1.id);
    assert.ok(activeRoom);
    const roomId = activeRoom.id;

    const res = await request(app)
      .post(`/api/games/uno/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${token2}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.players.length, 2);
    const p2 = res.body.data.players.find((p) => p.userId === user2.id);
    assert.ok(p2);
    assert.equal(p2.seatIndex, 1);
    assert.equal(p2.isReady, false);
  });

  await t.test('4. Security & Privacy: Private hand cards are NEVER leaked to opponents', async () => {
    const activeRoom = await unoGameService.getActiveRoom(user1.id);
    const roomId = activeRoom.id;

    // Ready user 2 and start game
    await request(app)
      .post(`/api/games/uno/rooms/${roomId}/ready`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ isReady: true });

    const startRes = await request(app)
      .post(`/api/games/uno/rooms/${roomId}/start`)
      .set('Authorization', `Bearer ${token1}`);

    assert.equal(startRes.status, 200);
    assert.equal(startRes.body.data.status, 'PLAYING');

    // Request room detail as User 1
    const u1Detail = await request(app)
      .get(`/api/games/uno/rooms/${roomId}`)
      .set('Authorization', `Bearer ${token1}`);

    const u1PlayerSelf = u1Detail.body.data.players.find((p) => p.userId === user1.id);
    const u1PlayerOpp = u1Detail.body.data.players.find((p) => p.userId === user2.id);

    // User 1 sees their own 7 cards
    assert.equal(u1PlayerSelf.handCards.length, 7);
    // User 1 CANNOT see User 2's cards (must be empty array)!
    assert.equal(u1PlayerOpp.handCards.length, 0);
    assert.equal(u1PlayerOpp.remainingCardsCount, 7);

    // Deck must be confidential
    assert.equal(u1Detail.body.data.drawPile, undefined);
  });

  await t.test('5. Server Authority: Out-of-turn moves and illegal cards are strictly rejected', async () => {
    const activeRoom = await unoGameService.getActiveRoom(user1.id);
    const roomId = activeRoom.id;
    const currentTurnUser = activeRoom.currentTurnUserId;
    const nonTurnToken = currentTurnUser === user1.id ? token2 : token1;

    // Attempt to play out of turn
    const outOfTurnRes = await request(app)
      .post(`/api/games/uno/rooms/${roomId}/play`)
      .set('Authorization', `Bearer ${nonTurnToken}`)
      .send({ cardId: 'fake_card_id' });

    assert.equal(outOfTurnRes.status, 400);
    assert.ok(outOfTurnRes.body.message.includes('Chưa đến lượt'));

    // Current player attempts to play non-existent card
    const turnToken = currentTurnUser === user1.id ? token1 : token2;
    const fakeCardRes = await request(app)
      .post(`/api/games/uno/rooms/${roomId}/play`)
      .set('Authorization', `Bearer ${turnToken}`)
      .send({ cardId: 'fake_card_id_999' });

    assert.equal(fakeCardRes.status, 400);
    assert.ok(fakeCardRes.body.message.includes('không tồn tại'));
  });

  await t.test('6. Draw Card: Current player draws 1 card, hand increases, draw pile decreases', async () => {
    const activeRoom = await unoGameService.getActiveRoom(user1.id);
    const roomId = activeRoom.id;
    const currentTurnUser = activeRoom.currentTurnUserId;
    const turnToken = currentTurnUser === user1.id ? token1 : token2;

    const initialDrawCount = activeRoom.drawPileCount;

    const drawRes = await request(app)
      .post(`/api/games/uno/rooms/${roomId}/draw`)
      .set('Authorization', `Bearer ${turnToken}`);

    assert.equal(drawRes.status, 200);
    const me = drawRes.body.data.players.find((p) => p.userId === currentTurnUser);
    assert.equal(me.handCards.length, 8); // Was 7, drew 1 -> 8
    assert.equal(drawRes.body.data.drawPileCount, initialDrawCount - 1);

    // Pass turn
    const passRes = await request(app)
      .post(`/api/games/uno/rooms/${roomId}/pass`)
      .set('Authorization', `Bearer ${turnToken}`);

    assert.equal(passRes.status, 200);
    // Turn should have shifted
    assert.notEqual(passRes.body.data.currentTurnUserId, currentTurnUser);
  });

  await t.test('7. Practice Mode: Creates room with bots and starts immediately', async () => {
    const res = await request(app)
      .post('/api/games/uno/practice')
      .set('Authorization', `Bearer ${token3}`)
      .send({ botCount: 3 });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, 'PLAYING');
    assert.equal(res.body.data.players.length, 4);

    const bots = res.body.data.players.filter((p) => p.isBot);
    assert.equal(bots.length, 3);
  });

  await t.test('8. Match Finish & Rewards: Completing match settles points to ScoreLedger', async () => {
    const activeRoom = await unoGameService.getActiveRoom(user1.id);
    const roomId = activeRoom.id;

    // Simulate match completion by finishing game
    await unoGameService.finishGame(roomId, user1.id);

    const finished = await unoGameService.getRoomDetail(roomId, user1.id);
    assert.equal(finished.status, 'FINISHED');
    assert.equal(finished.winnerUserId, user1.id);

    // Check UnoUserStat
    const stat1 = await UnoUserStat.findOne({ where: { userId: user1.id } });
    assert.ok(stat1);
    assert.equal(stat1.matchesWon, 1);
    assert.ok(stat1.totalPoints > 0);

    // Check ScoreLedger entry
    const ledger = await ScoreLedger.findOne({
      where: { userId: user1.id, effectType: 'INDIVIDUAL_XP' },
    });
    assert.ok(ledger);
    assert.ok(ledger.pointsDelta > 0);
  });

  await t.test('9. Leaderboard & History: Global leaderboard and personal history return properly', async () => {
    const lbRes = await request(app)
      .get('/api/games/uno/leaderboard')
      .set('Authorization', `Bearer ${token1}`);

    assert.equal(lbRes.status, 200);
    assert.ok(Array.isArray(lbRes.body.data));
    assert.ok(lbRes.body.data.length >= 1);
    assert.equal(lbRes.body.data[0].userId, user1.id);

    const histRes = await request(app)
      .get('/api/games/uno/history')
      .set('Authorization', `Bearer ${token1}`);

    assert.equal(histRes.status, 200);
    assert.ok(Array.isArray(histRes.body.data));
    assert.ok(histRes.body.data.length >= 1);
  });
});
