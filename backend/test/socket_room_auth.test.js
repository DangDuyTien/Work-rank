'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  sequelize,
  User,
  TypingRoom,
  TypingPlayer,
} = require('../src/models');
const { canAccessGameRoom } = require('../src/services/gameRoomAuth.service');

describe('Socket Game Room Authorization Test Suite (Typing Battle)', () => {
  let adminUser, normalUser, otherUser;
  let waitingRoom, playingRoom;

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

    waitingRoom = await TypingRoom.create({
      code: `TY_${suffix}`,
      title: 'Phòng Typing Chờ',
      hostUserId: normalUser.id,
      status: 'WAITING',
      mode: '1V1',
    });
    await TypingPlayer.create({
      roomId: waitingRoom.id,
      userId: normalUser.id,
      seatIndex: 0,
      isReady: false,
      status: 'WAITING',
      team: 'A',
    });

    playingRoom = await TypingRoom.create({
      code: `TP_${suffix}`,
      title: 'Phòng Typing Đang Đấu',
      hostUserId: normalUser.id,
      status: 'PLAYING',
      mode: '1V1',
    });
    await TypingPlayer.create({
      roomId: playingRoom.id,
      userId: normalUser.id,
      seatIndex: 0,
      isReady: true,
      status: 'TYPING',
      team: 'A',
    });
  });

  after(async () => {
    const roomIds = [waitingRoom?.id, playingRoom?.id].filter(Boolean);
    await TypingPlayer.destroy({ where: { roomId: roomIds } });
    await TypingRoom.destroy({ where: { id: roomIds } });
    await User.destroy({ where: { id: [adminUser.id, normalUser.id, otherUser.id] } });
    await sequelize.close().catch(() => {});
  });

  it('1. Returns ROOM_NOT_FOUND when room does not exist', async () => {
    const res = await canAccessGameRoom({
      userId: normalUser.id,
      roomId: 999999999,
      gameType: 'typing',
    });
    assert.equal(res.allowed, false);
    assert.equal(res.code, 'ROOM_NOT_FOUND');
    assert.equal(res.status, 404);
  });

  it('2. Grants player access to room host / participant', async () => {
    const res = await canAccessGameRoom({
      userId: normalUser.id,
      userRole: normalUser.role,
      roomId: waitingRoom.id,
      gameType: 'typing',
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
      roomId: waitingRoom.id,
      gameType: 'typing',
    });
    assert.equal(res.allowed, false);
    assert.equal(res.status, 403);
    assert.equal(res.code, 'FORBIDDEN');
  });

  it('4. Grants spectator access to outside user when room is actively PLAYING', async () => {
    const res = await canAccessGameRoom({
      userId: otherUser.id,
      userRole: otherUser.role,
      roomId: playingRoom.id,
      gameType: 'typing',
    });
    assert.equal(res.allowed, true);
    assert.equal(res.isPlayer, false);
    assert.equal(res.isSpectator, true);
    assert.equal(res.role, 'spectator');
  });

  it('5. Allows an explicit spectator hint in a WAITING room (typing spectate route)', async () => {
    const res = await canAccessGameRoom({
      userId: otherUser.id,
      userRole: otherUser.role,
      roomId: waitingRoom.id,
      gameType: 'typing',
      clientSpectatorHint: true,
    });
    assert.equal(res.allowed, true);
    assert.equal(res.isSpectator, true);
  });

  it('6. Rejects unknown game types instead of silently allowing access', async () => {
    const res = await canAccessGameRoom({
      userId: normalUser.id,
      roomId: waitingRoom.id,
      gameType: 'retired_game',
    });
    assert.equal(res.allowed, false);
    assert.equal(res.code, 'INVALID_GAME_TYPE');
    assert.equal(res.status, 400);
  });
});
