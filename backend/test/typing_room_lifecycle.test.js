'use strict';

/**
 * typing_room_lifecycle.test.js
 *
 * Regression suite for the ghost-room remediation:
 *  - leaveRoom is transactional + idempotent (no orphan seats, single close).
 *  - Channel-leave (leaveWaitingSeat) only releases WAITING/STARTING seats and
 *    never touches an active match.
 *  - Disconnect grace window releases stale seats and is cancellable on return.
 *  - Lobby list never exposes zero-player rooms and rejects unknown statuses.
 *  - Room removal / transitions are broadcast (typing:roomRemoved, roomListChanged).
 *  - DB integrity: an ABANDONED room never keeps player rows.
 */

const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  sequelize,
  User,
  Season,
  TypingRoom,
  TypingPlayer,
} = require('../src/models');
const typingRealtime = require('../src/services/typingRealtime.service');
const typingGameService = require('../src/services/typingGame.service');

function fakeIo() {
  const global = [];
  const room = [];
  return {
    global,
    room,
    emit: (event, payload) => global.push({ event, payload }),
    to: (channel) => ({ emit: (event, payload) => room.push({ channel, event, payload }) }),
  };
}

let io;
let users = [];
let activeSeason;

before(async () => {
  await typingGameService.ensureChallengesExist();
  const ts = Date.now();
  users = [];
  for (let i = 1; i <= 4; i += 1) {
    users.push(await User.create({
      name: `Lifecycle User ${i} ${ts}`,
      email: `typing_lifecycle_${i}_${ts}@workrank.local`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'QA',
    }));
  }
  activeSeason = await Season.create({
    name: `Season Lifecycle ${ts}`,
    slug: `season-lifecycle-${ts}`,
    status: 'ACTIVE',
    startAt: new Date(Date.now() - 86400000),
    endAt: new Date(Date.now() + 86400000 * 30),
  });
});

beforeEach(async () => {
  await sequelize.query('DELETE FROM typing_match_results');
  await sequelize.query('DELETE FROM typing_players');
  await sequelize.query('DELETE FROM typing_rooms');
  io = fakeIo();
  typingRealtime.setIo(io);
});

after(async () => {
  typingRealtime.setIo(null);
  if (activeSeason) await activeSeason.destroy().catch(() => {});
});

async function makeRoom(hostIndex = 0, data = {}) {
  const detail = await typingGameService.createRoom({ mode: '1V1', ...data }, { id: users[hostIndex].id });
  return detail.room.id;
}

async function makeRoomWithPlayers(hostIndex = 0, joinerIndex = 1) {
  const roomId = await makeRoom(hostIndex);
  await typingGameService.joinRoom(roomId, users[joinerIndex].id);
  return roomId;
}

async function asPlaying(roomId) {
  await TypingRoom.update(
    { status: 'PLAYING', startedAt: new Date(Date.now() - 30000), challengeText: 'abc def ghi jkl mno pqr' },
    { where: { id: roomId } }
  );
  await TypingPlayer.update({ status: 'TYPING' }, { where: { roomId } });
}

async function waitFor(predicate, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return predicate();
}

test('leaveRoom removes only the caller seat and transfers host when needed', async () => {
  const roomId = await makeRoomWithPlayers(0, 1);
  const before1 = await TypingPlayer.count({ where: { roomId } });
  assert.equal(before1, 2);

  await typingGameService.leaveRoom(roomId, users[0].id);

  const room = await TypingRoom.findByPk(roomId);
  assert.equal(room.status, 'WAITING');
  assert.equal(Number(room.hostUserId), Number(users[1].id), 'host transferred to remaining player');
  assert.equal(await TypingPlayer.count({ where: { roomId } }), 1);
  assert.equal(io.global.filter((e) => e.event === 'typing:roomRemoved').length, 0, 'room still alive');

  await typingGameService.leaveRoom(roomId, users[1].id);
  const closed = await TypingRoom.findByPk(roomId);
  assert.equal(closed.status, 'ABANDONED');
  assert.ok(closed.finishedAt, 'ABANDONED room carries finishedAt');
  assert.equal(await TypingPlayer.count({ where: { roomId } }), 0, 'no orphan seat rows');
});

test('last player leave closes the room once and broadcasts roomRemoved exactly once', async () => {
  const roomId = await makeRoomWithPlayers(0, 1);
  await typingGameService.leaveRoom(roomId, users[0].id);

  await typingGameService.leaveRoom(roomId, users[1].id);
  await typingGameService.leaveRoom(roomId, users[1].id); // duplicate leave is a no-op

  const removed = io.global.filter((e) => e.event === 'typing:roomRemoved');
  assert.equal(removed.length, 1, 'single roomRemoved broadcast');
  assert.equal(Number(removed[0].payload.roomId), Number(roomId));
  assert.equal(await TypingPlayer.count({ where: { roomId } }), 0);
});

test('concurrent double-leave resolves idempotently', async () => {
  const roomId = await makeRoom(0);
  await Promise.all([
    typingGameService.leaveRoom(roomId, users[0].id),
    typingGameService.leaveRoom(roomId, users[0].id),
  ]);

  assert.equal(await TypingPlayer.count({ where: { roomId } }), 0);
  const room = await TypingRoom.findByPk(roomId);
  assert.equal(room.status, 'ABANDONED');
  assert.equal(io.global.filter((e) => e.event === 'typing:roomRemoved').length, 1);
});

test('leaveDuringStarting returns room to WAITING and emits startingCancelled', async () => {
  const roomId = await makeRoomWithPlayers(0, 1);
  await TypingRoom.update({ status: 'STARTING', startAt: new Date(Date.now() + 5000) }, { where: { id: roomId } });

  await typingGameService.leaveRoom(roomId, users[1].id);

  const room = await TypingRoom.findByPk(roomId);
  assert.equal(room.status, 'WAITING');
  assert.equal(room.startAt, null);
  const cancelled = io.room.filter((e) => e.event === 'typing:startingCancelled');
  assert.equal(cancelled.length, 1);
  assert.equal(cancelled[0].channel, `typing:${roomId}`);
  assert.equal(await TypingPlayer.count({ where: { roomId } }), 1);
});

test('leaveWaitingSeat releases WAITING seats but never touches a PLAYING match', async () => {
  const waitingRoom = await makeRoomWithPlayers(0, 1);
  const released = await typingGameService.leaveWaitingSeat(waitingRoom, users[1].id);
  assert.equal(released, true);
  assert.equal(await TypingPlayer.count({ where: { roomId: waitingRoom } }), 1);

  const playingRoom = await makeRoomWithPlayers(0, 1);
  await asPlaying(playingRoom);
  const releasedPlaying = await typingGameService.leaveWaitingSeat(playingRoom, users[1].id);
  assert.equal(releasedPlaying, false, 'PLAYING membership is preserved for recovery');
  assert.equal(await TypingPlayer.count({ where: { roomId: playingRoom } }), 2);

  const spectatorReject = await typingGameService.leaveWaitingSeat(playingRoom, users[3].id);
  assert.equal(spectatorReject, false, 'non-member is a no-op');
});

test('disconnected seat cleanup releases the seat after the grace window unless cancelled', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const roomId = await makeRoom(0);

  await typingGameService.scheduleDisconnectedSeatCleanup(users[0].id);
  t.mock.timers.tick(3000);
  assert.equal(await TypingPlayer.count({ where: { roomId } }), 1, 'seat kept before grace expiry');

  typingGameService.cancelDisconnectedSeatCleanup(roomId, users[0].id);
  t.mock.timers.tick(10000);
  assert.equal(await TypingPlayer.count({ where: { roomId } }), 1, 'cancelled cleanup never releases the seat');

  await typingGameService.scheduleDisconnectedSeatCleanup(users[0].id);
  t.mock.timers.tick(5000);
  t.mock.timers.reset();
  const released = await waitFor(async () => (await TypingPlayer.count({ where: { roomId } })) === 0);

  assert.equal(released, true, 'grace expiry releases the seat');
  const room = await TypingRoom.findByPk(roomId);
  assert.equal(room.status, 'ABANDONED');
  assert.equal(io.global.filter((e) => e.event === 'typing:roomRemoved').length, 1);
});

test('out-of-order disconnects: a live socket at expiry keeps the seat; a later disconnect still releases it', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const presence = require('../src/services/presence.service');
  const roomId = await makeRoom(0);

  presence.addSocket({ id: users[0].id }, 'live-socket-1');
  await typingGameService.scheduleDisconnectedSeatCleanup(users[0].id);
  t.mock.timers.tick(5000);
  t.mock.timers.reset();
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(await TypingPlayer.count({ where: { roomId } }), 1, 'a live socket at expiry keeps the seat');

  presence.removeSocket({ id: users[0].id }, 'live-socket-1');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  await typingGameService.scheduleDisconnectedSeatCleanup(users[0].id);
  t.mock.timers.tick(5000);
  t.mock.timers.reset();
  const released = await waitFor(async () => (await TypingPlayer.count({ where: { roomId } })) === 0);
  assert.equal(released, true, 'the follow-up disconnect releases the seat');
  assert.equal(io.global.filter((e) => e.event === 'typing:roomRemoved').length, 1);
});

test('listRooms hides zero-player ghosts, rejects unknown status, and broadcasts removal', async () => {
  const liveRoom = await makeRoom(0);
  const ghostRoom = await makeRoom(1);
  await TypingPlayer.destroy({ where: { roomId: ghostRoom } });

  const listed = await typingGameService.listRooms({ status: 'WAITING' });
  const ids = listed.map((r) => Number(r.id));
  assert.ok(ids.includes(Number(liveRoom)));
  assert.ok(!ids.includes(Number(ghostRoom)), 'zero-player room never listed');
  assert.equal(Number(listed.find((r) => Number(r.id) === Number(liveRoom)).playerCount) >= 1, true, 'playerCount exposed to clients');

  const ghost = await TypingRoom.findByPk(ghostRoom);
  assert.equal(ghost.status, 'ABANDONED');
  const removedIds = io.global.filter((e) => e.event === 'typing:roomRemoved').map((e) => Number(e.payload.roomId));
  assert.ok(removedIds.includes(Number(ghostRoom)));

  const bogus = await typingGameService.listRooms({ status: 'FINISHED' });
  const bogusIds = bogus.map((r) => Number(r.id));
  assert.ok(bogusIds.includes(Number(liveRoom)), 'unknown status falls back to the listable set');
  assert.ok(!bogusIds.includes(Number(ghostRoom)));
});

test('ghost PLAYING room (crash leftover) is excluded from the live list', async () => {
  const roomId = await makeRoomWithPlayers(0, 1);
  await asPlaying(roomId);
  await TypingPlayer.destroy({ where: { roomId } });

  const live = await typingGameService.listRooms({ status: 'PLAYING' });
  assert.ok(!live.map((r) => Number(r.id)).includes(Number(roomId)));
});

test('creating a new room abandons the stale WAITING seat room and broadcasts it', async () => {
  const oldRoomId = await makeRoom(0);
  const newDetail = await typingGameService.createRoom({ mode: '1V1' }, { id: users[0].id });

  const oldRoom = await TypingRoom.findByPk(oldRoomId);
  assert.equal(oldRoom.status, 'ABANDONED');
  assert.equal(await TypingPlayer.count({ where: { roomId: oldRoomId } }), 0);
  assert.equal(await TypingPlayer.count({ where: { roomId: newDetail.room.id } }), 1);
  const removedIds = io.global.filter((e) => e.event === 'typing:roomRemoved').map((e) => Number(e.payload.roomId));
  assert.ok(removedIds.includes(Number(oldRoomId)));
});

test('startMatch announces WAITING -> PLAYING to every lobby', async () => {
  const roomId = await makeRoomWithPlayers(0, 1);
  await typingGameService.startMatch(roomId, users[0].id);

  assert.equal((await TypingRoom.findByPk(roomId)).status, 'PLAYING');
  const started = io.room.filter((e) => e.event === 'typing:started');
  assert.equal(started.length, 1);
  const listChanged = io.global.filter((e) => e.event === 'typing:roomListChanged').map((e) => Number(e.payload.roomId));
  assert.ok(listChanged.includes(Number(roomId)), 'lobby invalidation emitted on start');

  await typingGameService.finalizeMatch(roomId);
});

test('leaving during PLAYING surrenders the seat; last TYPING player finalizes the match', async () => {
  const roomId = await makeRoomWithPlayers(0, 1);
  await asPlaying(roomId);

  await typingGameService.leaveRoom(roomId, users[0].id);
  const room = await TypingRoom.findByPk(roomId);
  assert.equal(room.status, 'PLAYING', 'match continues with one surrendered player');
  const surrendered = await TypingPlayer.findOne({ where: { roomId, userId: users[0].id } });
  assert.equal(surrendered.status, 'SURRENDERED');

  await typingGameService.leaveRoom(roomId, users[1].id);
  const finished = await TypingRoom.findByPk(roomId);
  assert.equal(finished.status, 'FINISHED');
  const events = io.room.filter((e) => e.event === 'typing:matchFinished');
  assert.equal(events.length, 1);
  const removedIds = io.global.filter((e) => e.event === 'typing:roomRemoved').map((e) => Number(e.payload.roomId));
  assert.ok(removedIds.includes(Number(roomId)), 'finished room leaves the live list');
});

test('DB integrity: abandoned rooms never keep player rows after any lifecycle path', async () => {
  const a = await makeRoomWithPlayers(0, 1);
  const b = await makeRoomWithPlayers(2, 3);
  await asPlaying(b);

  await typingGameService.leaveRoom(a, users[0].id);
  await typingGameService.leaveRoom(a, users[1].id);
  await typingGameService.leaveRoom(b, users[2].id);
  await typingGameService.leaveRoom(b, users[3].id);

  const abandoned = await TypingRoom.findAll({ where: { status: 'ABANDONED' } });
  for (const room of abandoned) {
    assert.equal(await TypingPlayer.count({ where: { roomId: room.id } }), 0, `abandoned room ${room.id} kept seats`);
  }
  const players = await TypingPlayer.findAll();
  const roomIds = new Set((await TypingRoom.findAll({ attributes: ['id', 'status'] })).map((r) => Number(r.id)));
  for (const player of players) {
    assert.ok(roomIds.has(Number(player.roomId)), `orphan seat ${player.id} without room`);
  }
});
