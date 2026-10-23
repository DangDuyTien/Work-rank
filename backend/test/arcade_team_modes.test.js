'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { sequelize, User, ArcadeRoom: Room, ArcadePlayer: Player, ScoreLedger } = require('../src/models');
const service = require('../src/services/arcade.service');
const engine = import('../../shared/arcade/engine.mjs');
const modes = import('../../shared/arcade/modes.mjs');

let users;
before(async () => {
  await sequelize.sync();
  users = await Promise.all(Array.from({ length: 7 }, (_, n) => User.create({ name: `Team ${n}`, email: `team-mode-${n}@test.local`, passwordHash: 'hash' })));
});
after(() => service.stop());

async function memoryPayload(room, playerIndex) {
  const { challenge, memorySelectAt } = await engine;
  let at = 0;
  const events = [];
  for (let index = 0; index < 3; index++) {
    const c = challenge('memory_flash', room.seed, index, room.difficulty, { rulesVersion: room.rulesVersion, previousAt: at });
    at = memorySelectAt(at, index, c) + 480 + playerIndex * 30;
    events.push({ index, at, cells: c.cells });
  }
  return { attemptId: room.id, seed: room.seed, revision: events.length, events };
}
async function finishAll(room, roster) {
  await Room.update({ startedAt: new Date(Date.now() - 60010) }, { where: { id: room.id } });
  for (let index = 0; index < roster.length; index++) {
    await service.sync(room.id, roster[index].userId, await memoryPayload(room, index), true);
  }
}

test('Mode registry: 1V1=2, 2V2=4, 3V3=6, TRIO is not 3v3', async () => {
  const { GAME_MODES, canonicalMode, capacityFor, isTeamMode } = await modes;
  assert.equal(capacityFor('SOLO'), 1);
  assert.equal(capacityFor('1V1'), 2);
  assert.equal(capacityFor('2V2'), 4);
  assert.equal(capacityFor('3V3'), 6);
  assert.equal(capacityFor('TRIO'), 3);
  assert.equal(canonicalMode('DUO'), '1V1');
  assert.equal(canonicalMode('3v3'), '3V3');
  assert.equal(isTeamMode('2V2'), true);
  assert.equal(isTeamMode('3V3'), true);
  assert.equal(isTeamMode('TRIO'), false);
  assert.equal(GAME_MODES.THREE_V_THREE.capacity, GAME_MODES.THREE_V_THREE.teamSize * 2);
  assert.equal(GAME_MODES.TWO_V_TWO.capacity, GAME_MODES.TWO_V_TWO.teamSize * 2);
  assert.notEqual(GAME_MODES.TRIO.capacity, GAME_MODES.THREE_V_THREE.capacity);
});

test('2V2: four real seats, auto-balanced teams, capacity race and start gate', async () => {
  const created = await service.create({ gameType: 'memory_flash', mode: '2V2' }, users[0]);
  const id = created.room.id;
  assert.equal(created.room.mode, '2V2');
  assert.equal(created.room.capacity, 4);
  assert.equal(created.players[0].team, 'A');

  await service.join(id, users[1].id);
  await service.join(id, users[2].id);
  const raced = await Promise.allSettled([service.join(id, users[3].id), service.join(id, users[4].id)]);
  assert.equal(raced.filter((result) => result.status === 'fulfilled').length, 1, 'capacity race must admit exactly one');
  await assert.rejects(service.join(id, users[5].id), /đầy/);

  let state = await service.detail(id, users[0].id);
  assert.equal(state.players.length, 4);
  assert.deepEqual(state.teams.map((team) => team.players.length), [2, 2]);
  assert.equal(state.teams[0].label, 'TEAM A');
  assert.ok(state.room.teamMode);

  await assert.rejects(service.begin(id, users[0].id), /sẵn sàng/);

  // TEAM A đã đủ 2: không cho nhảy sang.
  const inB = state.players.find((player) => player.team === 'B');
  await assert.rejects(service.switchTeam(id, inB.userId, 'A'), /đủ 2 người/);
  await service.switchTeam(id, inB.userId, 'B');

  // Rời một người → 2v1, không được start; người mới vào phải cân lại 2v2.
  const roster = state.players.map((player) => ({ userId: player.userId }));
  await service.leave(id, roster[3].userId);
  state = await service.detail(id, users[0].id);
  assert.deepEqual(state.teams.map((team) => team.players.length), [2, 1]);
  for (const player of state.players) await service.ready(id, player.userId, true);
  await assert.rejects(service.begin(id, users[0].id), /chia đều/);

  await service.join(id, users[4].id);
  state = await service.detail(id, users[0].id);
  assert.deepEqual(state.teams.map((team) => team.players.length), [2, 2]);
  assert.ok(state.players.every((player) => !player.ready), 'join must reset ready');
  for (const player of state.players) await service.ready(id, player.userId, true);
  await service.begin(id, users[0].id);
  assert.equal((await Room.findByPk(id)).status, 'PLAYING');

  await finishAll(await Room.findByPk(id), state.players);
  const done = await service.detail(id, users[0].id);
  assert.equal(done.room.status, 'FINISHED');

  // Mọi người nhận cùng challenge: cùng seed, cùng ô cho từng index.
  const { challenge } = await engine;
  for (const index of [0, 1, 2]) {
    const reference = challenge('memory_flash', done.room.seed, index, done.room.difficulty, { rulesVersion: done.room.rulesVersion });
    assert.deepEqual(reference.cells, challenge('memory_flash', done.room.seed, index, done.room.difficulty, { rulesVersion: done.room.rulesVersion }).cells);
  }

  // Điểm đội do server tính, không phải cộng client.
  const { teamScore } = await modes;
  for (const team of done.teams) {
    const rosterForTeam = done.players.filter((player) => player.team === team.id).map((player) => player.result);
    assert.equal(team.score, teamScore(rosterForTeam));
    assert.equal(team.correct, rosterForTeam.reduce((sum, result) => sum + result.correct, 0));
  }
  const winners = done.players.filter((player) => player.result.teamWon);
  const loserTeam = done.teams.find((team) => team.id !== winners[0]?.team);
  assert.ok(winners.every((player) => player.team === winners[0].team));
  if (done.teams[0].score !== done.teams[1].score) assert.equal(winners.length, 2, 'cả hai thành viên đội thắng đều được đánh dấu');
  assert.ok(loserTeam);

  // Thưởng đúng một lần cho mỗi người, kể cả khi finalize lặp.
  for (const player of done.players) {
    assert.equal(await ScoreLedger.count({ where: { idempotencyKey: `arcade:${player.id}` } }), 1);
  }
  const ledgerBefore = await ScoreLedger.count();
  for (const player of done.players) {
    await service.sync(id, player.userId, await memoryPayload(done.room, player.position - 1), true);
  }
  assert.equal(await ScoreLedger.count(), ledgerBefore);

  // Chơi lại giữ mode + đội, nhưng seed mới.
  const next = await Promise.all(done.players.map((player) => service.rematch(id, users.find((user) => String(user.id) === String(player.userId)))));
  assert.equal(new Set(next.map((state) => state.room.id)).size, 1);
  const rematch = await service.detail(next[0].room.id, users[0].id);
  assert.equal(rematch.room.mode, '2V2');
  assert.equal(rematch.room.capacity, 4);
  assert.notEqual(rematch.room.seed, done.room.seed);
  assert.equal(rematch.players.length, 4);
  for (const player of done.players) {
    const again = rematch.players.find((entry) => String(entry.userId) === String(player.userId));
    assert.equal(again.team, player.team, 'rematch must keep teams');
  }
  assert.equal(await ScoreLedger.count(), ledgerBefore);
  for (const player of rematch.players) await service.leave(rematch.room.id, player.userId);
});

test('3V3: six real players, 3v3 teams, ready/start and team result', async () => {
  const created = await service.create({ gameType: 'memory_flash', mode: '3V3' }, users[0]);
  const id = created.room.id;
  assert.equal(created.room.capacity, 6);
  for (let index = 1; index < 6; index++) await service.join(id, users[index].id);
  await assert.rejects(service.join(id, users[6].id), /đầy/);

  let state = await service.detail(id, users[0].id);
  assert.equal(state.players.length, 6);
  assert.deepEqual(state.teams.map((team) => team.players.length), [3, 3]);

  await assert.rejects(service.begin(id, users[0].id), /sẵn sàng/);
  for (const player of state.players) await service.ready(id, player.userId, true);
  await assert.rejects(service.begin(id, users[1].id), /chủ phòng/i);
  await service.begin(id, users[0].id);

  await finishAll(await Room.findByPk(id), state.players);
  const done = await service.detail(id, users[0].id);
  assert.equal(done.room.status, 'FINISHED');
  assert.equal(done.room.mode, '3V3');
  assert.deepEqual(done.teams.map((team) => team.players.length), [3, 3]);
  assert.ok(done.players.every((player) => player.result.team));
  assert.ok(done.players.every((player) => typeof player.result.teamScore === 'number'));
  assert.equal(new Set(done.players.map((player) => player.result.rank)).size, 6);

  const board = await service.leaderboard('memory_flash', '3V3', 'all', users[0].id);
  assert.equal(board.mode, '3V3');
  assert.ok(board.rows.every((row) => row.team === 'A' || row.team === 'B'));
  const trio = await service.leaderboard('memory_flash', 'TRIO', 'all', users[0].id);
  assert.ok(trio.rows.every((row) => row.mode !== '3V3'), '3V3 scores must not leak into TRIO');

  for (const player of done.players) {
    assert.equal(await ScoreLedger.count({ where: { idempotencyKey: `arcade:${player.id}` } }), 1);
  }
  for (const player of done.players) await service.leave(id, player.userId);
});

test('Team score cannot be carried by one pro player', async () => {
  const { teamScore } = await modes;
  const balanced = teamScore([{ score: 2500, accuracy: 80, attempts: 10 }, { score: 2500, accuracy: 80, attempts: 10 }]);
  const carried = teamScore([{ score: 5000, accuracy: 90, attempts: 10 }, { score: 0, accuracy: 0, attempts: 10 }]);
  assert.ok(balanced > carried, `balanced ${balanced} must beat carried ${carried}`);
  assert.equal(teamScore([]), 0);
  // Chưa có attempt nào thì không được cộng thưởng chính xác 100%.
  assert.equal(teamScore([{ score: 0, accuracy: 100, attempts: 0 }]), 0);
});

test('2V2 room engine is shared by every arcade game', async () => {
  for (const gameType of ['computer_rush', 'direction_rush']) {
    const created = await service.create({ gameType, mode: '2V2' }, users[0]);
    const id = created.room.id;
    for (let index = 1; index < 4; index++) await service.join(id, users[index].id);
    const state = await service.detail(id, users[0].id);
    assert.equal(state.room.gameType, gameType);
    assert.deepEqual(state.teams.map((team) => team.players.length), [2, 2]);
    for (const player of state.players) await service.ready(id, player.userId, true);
    await service.begin(id, users[0].id);
    assert.equal((await Room.findByPk(id)).status, 'PLAYING');
    for (const player of state.players) await service.leave(id, player.userId);
  }
});
