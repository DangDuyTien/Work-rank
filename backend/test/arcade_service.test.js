'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { sequelize, User, ArcadeRoom: Room, ArcadePlayer: Player, ScoreLedger } = require('../src/models');
const service = require('../src/services/arcade.service');
const engine = import('../../shared/arcade/engine.mjs');
let users;
before(async () => {
  await sequelize.sync();
  users = await Promise.all([0, 1, 2, 3].map((n) => User.create({ name: `Arcade ${n}`, email: `arcade-${n}@test.local`, passwordHash: 'hash' })));
});
after(() => service.stop());
test('Computer SOLO → DUO → TRIO: room flow, seeds, privacy, final flush, rewards and rankings', async (t) => {
  const { challenge } = await engine;
  for (const mode of ['SOLO', 'DUO', 'TRIO']) await t.test(mode, async () => {
    const created = await service.create({ gameType: 'computer_rush', mode }, users[0]);
    const id = created.room.id;
    if (mode === 'SOLO') {
      assert.ok(!(await service.list('computer_rush', 'DUO')).some((r) => r.id === id));
      await assert.rejects(service.join(id, users[1].id));
    } else {
      await assert.rejects(service.begin(id, users[0].id));
      for (let i = 1; i < created.room.capacity; i++) await service.join(id, users[i].id);
      await assert.rejects(service.join(id, users[3].id));
      for (let i = 0; i < created.room.capacity; i++) await service.ready(id, users[i].id, true);
      await assert.rejects(service.begin(id, users[1].id));
      await service.begin(id, users[0].id);
    }
    await assert.rejects(service.sync(id, users[0].id, { attemptId: id, seed: created.room.seed, revision: 1, events: [{ index: 0, at: 1000, value: 'x', errors: 0 }] }));
    await Room.update({ startedAt: new Date(Date.now() - 60010) }, { where: { id } });
    for (let i = 0; i < created.room.capacity; i++) {
      const events = Array.from({ length: 3 }, (_, index) => ({ index, at: (index + 1) * (1100 + i * 100), value: challenge('computer_rush', created.room.seed, index).word, errors: 0 }));
      const payload = { attemptId: id, seed: created.room.seed, revision: 3, events, score: 9999999 };
      await assert.rejects(service.sync(id, users[i].id, { ...payload, seed: 'forged' }, true));
      const result = await service.sync(id, users[i].id, payload, true);
      assert.ok(result.players[i].result.score < 9999999);
      await service.sync(id, users[i].id, payload, true);
    }
    const state = await service.detail(id, users[0].id);
    assert.equal(state.room.status, 'FINISHED');
    assert.equal(state.players.length, created.room.capacity);
    assert.equal(new Set(state.players.map((p) => p.rank)).size, created.room.capacity);
    assert.equal(state.players[1]?.events, undefined);
    for (const p of state.players) assert.equal(await ScoreLedger.count({ where: { idempotencyKey: `arcade:${p.id}` } }), 1);
    const board = await service.leaderboard('computer_rush', mode, 'all', users[0].id);
    assert.ok(board.personal); assert.equal(board.mode, mode);
    await assert.rejects(service.detail(id, users[3].id));
  });
});
test('Direction and Memory SOLO → DUO → TRIO: evidence replay, forged submissions, concurrent finalize idempotency', async (t) => {
  const { challenge, memorySelectAt } = await engine;
  for (const gameType of ['direction_rush', 'memory_flash']) for (const mode of ['SOLO', 'DUO', 'TRIO']) await t.test(`${gameType} ${mode}`, async () => {
    const created = await service.create({ gameType, mode }, users[0]);
    const { id, seed, capacity } = created.room;
    if (mode !== 'SOLO') {
      for (let i = 1; i < capacity; i++) await service.join(id, users[i].id);
      for (let i = 0; i < capacity; i++) await service.ready(id, users[i].id, true);
      await service.begin(id, users[0].id);
    }
    await Room.update({ startedAt: new Date(Date.now() - 60010) }, { where: { id } });
    for (let i = 0; i < capacity; i++) {
      let at = 0;
      const events = Array.from({ length: 3 }, (_, index) => {
        const c = challenge(gameType, seed, index);
        at = gameType === 'direction_rush' ? at + 300 + i * 30 : memorySelectAt(at, index, c) + 500 + i * 30;
        return { index, at, ...(gameType === 'direction_rush' ? { direction: c.direction } : { cells: c.cells }) };
      });
      const data = { attemptId: id, seed, revision: 3, events };
      await assert.rejects(service.sync(id, users[i].id, { ...data, events: [{ ...events[0], at: 1 }] }, true));
      const [first, duplicate] = await Promise.all([service.sync(id, users[i].id, data, true), service.sync(id, users[i].id, data, true)]);
      assert.deepEqual(first.players[i].result, duplicate.players[i].result);
      assert.equal(first.players[i].result.correct, 3);
      assert.equal(await ScoreLedger.count({ where: { idempotencyKey: `arcade:${first.players[i].id}` } }), 1);
    }
    const [a, b] = await Promise.all([service.detail(id, users[0].id), service.detail(id, users[capacity - 1].id)]);
    assert.equal(a.room.status, 'FINISHED');
    assert.deepEqual(a.players.map((p) => p.rank), b.players.map((p) => p.rank));
    assert.equal((await service.leaderboard(gameType, mode, 'today', users[0].id)).personal.correct, 3);
  });
});
test('Room lifecycle: transfer host, reset ready, last leave, disconnect expiry, reconnect heartbeat', async () => {
  const a = await service.create({ gameType: 'computer_rush', mode: 'DUO' }, users[0]);
  await service.join(a.room.id, users[1].id);
  await service.ready(a.room.id, users[1].id, true);
  await service.leave(a.room.id, users[0].id);
  let state = await service.detail(a.room.id, users[1].id);
  assert.equal(String(state.room.hostId), String(users[1].id)); assert.equal(state.players[0].ready, false);
  await Player.update({ heartbeatAt: new Date(Date.now() - 31000) }, { where: { roomId: a.room.id } });
  await service.detail(a.room.id, users[1].id);
  await service.sweep(); assert.equal((await Room.findByPk(a.room.id)).status, 'WAITING');
  await service.leave(a.room.id, users[1].id);
  assert.equal((await Room.findByPk(a.room.id)).status, 'CLOSED');
  assert.equal(await Player.count({ where: { roomId: a.room.id } }), 0);
  const b = await service.create({ gameType: 'computer_rush', mode: 'TRIO' }, users[0]);
  await Player.update({ heartbeatAt: new Date(Date.now() - 31000) }, { where: { roomId: b.room.id } });
  await service.sweep();
  assert.equal((await Room.findByPk(b.room.id)).status, 'CLOSED');
});
test('Revisions are monotonic, immutable checkpoints and offline timeout uses saved evidence', async () => {
  const { challenge } = await engine;
  const a = await service.create({ gameType: 'computer_rush', mode: 'SOLO' }, users[0]);
  await Room.update({ startedAt: new Date(Date.now() - 3000) }, { where: { id: a.room.id } });
  const payload = { attemptId: a.room.id, seed: a.room.seed, revision: 1, events: [{ index: 0, at: 1000, value: challenge('computer_rush', a.room.seed, 0).word, errors: 0 }] };
  await service.sync(a.room.id, users[0].id, payload);
  await service.sync(a.room.id, users[0].id, { ...payload, revision: 0, events: [] });
  assert.equal((await service.detail(a.room.id, users[0].id)).players[0].revision, 1);
  await assert.rejects(service.sync(a.room.id, users[0].id, { ...payload, revision: 2, events: [{ ...payload.events[0], value: 'forged' }, { index: 1, at: 2000, value: 'x', errors: 0 }] }));
  await Room.update({ startedAt: new Date(Date.now() - 71000) }, { where: { id: a.room.id } });
  await service.sweep();
  assert.equal((await service.detail(a.room.id, users[0].id)).players[0].result.correct, 1);
});
test('Quick replay keeps one shared party, new seed, same rules and prevents duplicate rewards', async () => {
  const a = await service.create({ gameType: 'memory_flash', mode: 'TRIO' }, users[0]);
  await service.join(a.room.id, users[1].id); await service.join(a.room.id, users[2].id);
  for (const u of users.slice(0, 3)) await service.ready(a.room.id, u.id, true);
  await service.begin(a.room.id, users[0].id);
  await assert.rejects(service.rematch(a.room.id, users[0]));
  await Room.update({ startedAt: new Date(Date.now() - 60010) }, { where: { id: a.room.id } });
  for (const u of users.slice(0, 3)) await service.sync(a.room.id, u.id, { attemptId: a.room.id, seed: a.room.seed, revision: 0, events: [] }, true);
  const ledgerCount = await ScoreLedger.count();
  await assert.rejects(service.rematch(a.room.id, users[3]));
  const next = await Promise.all(users.slice(0, 3).map((u) => service.rematch(a.room.id, u)));
  assert.equal(new Set(next.map((s) => s.room.id)).size, 1);
  assert.notEqual(next[0].room.seed, a.room.seed);
  assert.equal(next[0].room.mode, 'TRIO'); assert.equal(next[0].room.rulesVersion, 2);
  assert.equal(next[0].room.durationSeconds, a.room.durationSeconds);
  const state = await service.rematch(a.room.id, users[0]);
  assert.equal(state.players.length, 3); assert.ok(state.players.every((p) => !p.ready));
  assert.equal((await Room.findByPk(a.room.id)).rematchId, state.room.id);
  assert.equal(await ScoreLedger.count(), ledgerCount);
  for (const u of users.slice(0, 3)) await service.leave(state.room.id, u.id);
});
test('Result PB is server-computed, isolated by configuration, and remains stable on duplicate finalize', async () => {
  const { challenge } = await engine;
  let previous = 0;
  for (const count of [3, 4, 2]) {
    const state = await service.create({ gameType: 'computer_rush', mode: 'SOLO', difficulty: 'easy' }, users[3]);
    const { id, seed } = state.room;
    await Room.update({ startedAt: new Date(Date.now() - 60010) }, { where: { id } });
    const events = Array.from({ length: count }, (_, index) => ({ index, at: (index + 1) * 1000, value: challenge('computer_rush', seed, index, 'easy').word, errors: 0 }));
    const data = { attemptId: id, seed, revision: count, events, personalBestScore: 99999999 };
    const a = await service.sync(id, users[3].id, data, true);
    const b = await service.sync(id, users[3].id, data, true);
    const result = a.players[0].result;
    assert.deepEqual(result, b.players[0].result);
    assert.equal(result.previousBestScore, previous);
    assert.equal(result.isPersonalBest, result.score > previous);
    assert.equal(result.improvement, result.score - previous);
    previous = Math.max(previous, result.score);
    assert.equal(result.personalBestScore, previous);
    const next = await service.rematch(id, users[3]);
    assert.equal(next.room.status, 'PLAYING'); assert.equal(next.room.difficulty, 'easy');
    assert.equal((await service.rematch(id, users[3])).room.id, next.room.id);
    await service.leave(next.room.id, users[3].id);
  }
});

test('Room creation keeps the host membership atomic and broadcasts authoritative list invalidation', async () => {
  const emitted = [];
  service.start({ to: (channel) => ({ emit: (event, payload) => emitted.push({ channel, event, payload }) }) });
  try {
    for (const gameType of ['computer_rush', 'direction_rush', 'memory_flash']) {
      const created = await service.create({ gameType, mode: 'DUO' }, users[0]);
      const players = await Player.findAll({ where: { roomId: created.room.id } });
      assert.equal(players.length, 1);
      assert.equal(String(players[0].userId), String(users[0].id));
      assert.equal(String(created.room.hostId), String(users[0].id));
      assert.ok(emitted.some((event) => event.event === 'arcade:roomsChanged' && event.payload.gameType === gameType));
      const listed = await service.list(gameType, 'DUO');
      assert.equal(listed.find((room) => room.id === created.room.id)?.capacity, 2);
      await service.leave(created.room.id, users[0].id);
    }
  } finally {
    service.stop();
  }
});

test('Duplicate create and join are idempotent; concurrent Trio joins cannot exceed capacity', async () => {
  const creates = await Promise.allSettled([
    service.create({ gameType: 'computer_rush', mode: 'DUO' }, users[0]),
    service.create({ gameType: 'computer_rush', mode: 'DUO' }, users[0]),
  ]);
  const created = creates.filter((result) => result.status === 'fulfilled');
  assert.equal(created.length, 1);
  assert.equal(creates.filter((result) => result.status === 'rejected').length, 1);
  const duo = created[0].value;
  await Promise.all([service.join(duo.room.id, users[1].id), service.join(duo.room.id, users[1].id)]);
  assert.equal(await Player.count({ where: { roomId: duo.room.id } }), 2);
  await service.leave(duo.room.id, users[0].id);
  await service.leave(duo.room.id, users[1].id);

  const trio = await service.create({ gameType: 'memory_flash', mode: 'TRIO' }, users[0]);
  await service.join(trio.room.id, users[1].id);
  const raced = await Promise.allSettled([
    service.join(trio.room.id, users[2].id),
    service.join(trio.room.id, users[3].id),
  ]);
  assert.equal(raced.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(raced.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(await Player.count({ where: { roomId: trio.room.id } }), 3);
  await service.leave(trio.room.id, users[0].id);
  for (const player of await Player.findAll({ where: { roomId: trio.room.id } })) await service.leave(trio.room.id, player.userId);
});

test('20 create and leave cycles per new game leave no public or membership ghosts', async () => {
  for (const gameType of ['computer_rush', 'direction_rush', 'memory_flash']) {
    for (let iteration = 0; iteration < 20; iteration++) {
      const created = await service.create({ gameType, mode: 'DUO' }, users[0]);
      assert.equal(await Player.count({ where: { roomId: created.room.id, userId: users[0].id } }), 1);
      await service.leave(created.room.id, users[0].id);
      assert.equal((await Room.findByPk(created.room.id)).status, 'CLOSED');
      assert.equal(await Player.count({ where: { roomId: created.room.id } }), 0);
      assert.ok(!(await service.list(gameType, 'DUO')).some((room) => room.id === created.room.id));
    }
  }
});
