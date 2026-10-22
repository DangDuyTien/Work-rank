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
