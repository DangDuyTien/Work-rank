'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  User,
  SamRoom,
  SamPlayer,
  QuizRoom,
  QuizPlayer,
  GameRoom,
  GamePlayer,
} = require('../src/models');
const { canAccessGameRoom } = require('../src/services/gameRoomAuth.service');

describe('Socket Game Room Authorization Test Suite', () => {
  let adminUser, normalUser, otherUser;
  let normalSamRoom, testSamRoom;
  let quizRoom;
  let capitalRoom;

  before(async () => {
    const ts = Date.now();
    adminUser = await User.create({
      name: `Admin Auth ${ts}`,
      email: `admin_auth_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'admin',
    });

    normalUser = await User.create({
      name: `Normal Auth ${ts}`,
      email: `normal_auth_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
    });

    otherUser = await User.create({
      name: `Other Auth ${ts}`,
      email: `other_auth_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
    });

    const suffix = Date.now().toString().slice(-8);

    // Normal Sam Room
    normalSamRoom = await SamRoom.create({
      code: `SA_${suffix}`,
      title: 'Phòng Sâm Thường',
      hostUserId: normalUser.id,
      status: 'WAITING',
      isTest: false,
    });
    await SamPlayer.create({
      roomId: normalSamRoom.id,
      userId: normalUser.id,
      seatIndex: 0,
      isHost: true,
      status: 'WAITING',
      handCards: [],
    });

    // Test Bot Sam Room
    testSamRoom = await SamRoom.create({
      code: `ST_${suffix}`,
      title: 'Phòng Test Bot Sâm',
      hostUserId: adminUser.id,
      status: 'WAITING',
      isTest: true,
      roomType: 'BOT_TEST',
    });

    // Quiz Room
    quizRoom = await QuizRoom.create({
      code: `QZ_${suffix}`,
      title: 'Phòng Quiz Auth',
      hostUserId: normalUser.id,
      status: 'WAITING',
    });
    await QuizPlayer.create({
      roomId: quizRoom.id,
      userId: normalUser.id,
      score: 0,
    });

    // Capital Board Room
    capitalRoom = await GameRoom.create({
      code: `CB_${suffix}`,
      title: 'Phòng Capital Auth',
      hostUserId: normalUser.id,
      status: 'WAITING',
    });
    await GamePlayer.create({
      roomId: capitalRoom.id,
      userId: normalUser.id,
      seatIndex: 0,
    });
  });

  after(async () => {
    await SamPlayer.destroy({ where: { roomId: [normalSamRoom.id, testSamRoom.id] } });
    await SamRoom.destroy({ where: { id: [normalSamRoom.id, testSamRoom.id] } });
    await QuizPlayer.destroy({ where: { roomId: quizRoom.id } });
    await QuizRoom.destroy({ where: { id: quizRoom.id } });
    await GamePlayer.destroy({ where: { roomId: capitalRoom.id } });
    await GameRoom.destroy({ where: { id: capitalRoom.id } });
    await User.destroy({ where: { id: [adminUser.id, normalUser.id, otherUser.id] } });
  });

  it('1. Returns ROOM_NOT_FOUND when room does not exist', async () => {
    const res = await canAccessGameRoom({
      userId: normalUser.id,
      roomId: 999999999,
      gameType: 'sam',
    });
    assert.equal(res.allowed, false);
    assert.equal(res.code, 'ROOM_NOT_FOUND');
    assert.equal(res.status, 404);
  });

  it('2. Grants player access to room host / participant', async () => {
    const res = await canAccessGameRoom({
      userId: normalUser.id,
      userRole: normalUser.role,
      roomId: normalSamRoom.id,
      gameType: 'sam',
    });
    assert.equal(res.allowed, true);
    assert.equal(res.isPlayer, true);
    assert.equal(res.isSpectator, false);
    assert.equal(res.role, 'player');
  });

  it('3. Rejects non-participating user in WAITING room (FORBIDDEN 403)', async () => {
    const res = await canAccessGameRoom({
      userId: otherUser.id,
      userRole: otherUser.role,
      roomId: normalSamRoom.id,
      gameType: 'sam',
    });
    assert.equal(res.allowed, false);
    assert.equal(res.status, 403);
    assert.equal(res.code, 'FORBIDDEN');
  });

  it('4. Grants spectator access to outside user ONLY when room is actively PLAYING', async () => {
    // Set room to PLAYING
    normalSamRoom.status = 'PLAYING';
    await normalSamRoom.save();

    const res = await canAccessGameRoom({
      userId: otherUser.id,
      userRole: otherUser.role,
      roomId: normalSamRoom.id,
      gameType: 'sam',
    });
    assert.equal(res.allowed, true);
    assert.equal(res.isPlayer, false);
    assert.equal(res.isSpectator, true);
    assert.equal(res.role, 'spectator');

    // Reset back
    normalSamRoom.status = 'WAITING';
    await normalSamRoom.save();
  });

  it('5. Rejects non-admin user trying to access isTest bot room (FORBIDDEN 403)', async () => {
    const res = await canAccessGameRoom({
      userId: normalUser.id,
      userRole: normalUser.role,
      roomId: testSamRoom.id,
      gameType: 'sam',
    });
    assert.equal(res.allowed, false);
    assert.equal(res.code, 'FORBIDDEN');
    assert.equal(res.status, 403);
  });

  it('6. Allows admin user to access isTest bot room', async () => {
    const res = await canAccessGameRoom({
      userId: adminUser.id,
      userRole: adminUser.role,
      roomId: testSamRoom.id,
      gameType: 'sam',
    });
    assert.equal(res.allowed, true);
  });

  it('7. Supports Quiz Room authorization: Member allowed, non-member rejected in WAITING room', async () => {
    const resMember = await canAccessGameRoom({
      userId: normalUser.id,
      roomId: quizRoom.id,
      gameType: 'quiz',
    });
    assert.equal(resMember.allowed, true);
    assert.equal(resMember.isPlayer, true);

    const resNonMember = await canAccessGameRoom({
      userId: otherUser.id,
      roomId: quizRoom.code,
      gameType: 'quiz',
    });
    assert.equal(resNonMember.allowed, false);
    assert.equal(resNonMember.status, 403);
  });

  it('8. Supports Capital Board Room authorization: Member allowed, non-member rejected in WAITING room', async () => {
    const resMember = await canAccessGameRoom({
      userId: normalUser.id,
      roomId: capitalRoom.id,
      gameType: 'capital_board',
    });
    assert.equal(resMember.allowed, true);
    assert.equal(resMember.isPlayer, true);

    const resNonMember = await canAccessGameRoom({
      userId: otherUser.id,
      roomId: capitalRoom.code,
      gameType: 'capital_board',
    });
    assert.equal(resNonMember.allowed, false);
    assert.equal(resNonMember.status, 403);
  });
});
