'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { User } = require('../src/models');
const env = require('../src/config/env');
let user, token, other;
const endpoint = '/api/games/arcade';
before(async () => {
  user = await User.create({ name: 'HTTP Arcade', email: 'arcade-http@test.local', passwordHash: 'hash' });
  const stranger = await User.create({ name: 'Other Arcade', email: 'arcade-other@test.local', passwordHash: 'hash' });
  token = jwt.sign({ sub: user.id }, env.jwtSecret);
  other = jwt.sign({ sub: stranger.id }, env.jwtSecret);
});
test('Arcade HTTP auth, availability, strict modes, ownership, early finalize and idempotent leave', async () => {
  assert.equal((await request(app).get(endpoint + '/active')).status, 401);
  assert.equal((await request(app).post(endpoint + '/rooms').set('Authorization', `Bearer ${token}`).send({ gameType: 'computer_rush', mode: 'constructor' })).status, 400);
  for (const gameType of ['computer_rush', 'direction_rush', 'memory_flash']) {
    assert.equal((await request(app).post(endpoint + '/rooms').set('Authorization', `Bearer ${token}`).send({ gameType, mode: '2V2' })).status, 400);
    const response = await request(app).post(endpoint + '/rooms').set('Authorization', `Bearer ${token}`).send({ gameType, mode: 'SOLO', seed: 'client-forged', durationSeconds: 999999 });
    assert.equal(response.status, 201);
    const { room } = response.body;
    assert.notEqual(room.seed, 'client-forged'); assert.equal(room.durationSeconds, 60);
    const path = `${endpoint}/rooms/${room.id}`;
    assert.equal((await request(app).get(path).set('Authorization', `Bearer ${other}`)).status, 403);
    assert.equal((await request(app).post(path + '/join').set('Authorization', `Bearer ${other}`).send({})).status, 400);
    const early = await request(app).post(path + '/finish').set('Authorization', `Bearer ${token}`).send({ attemptId: room.id, seed: room.seed, revision: 0, events: [], score: 999999 });
    assert.equal(early.status, 400, JSON.stringify(early.body));
    assert.equal((await request(app).post(path + '/leave').set('Authorization', `Bearer ${token}`).send({})).status, 200);
    assert.equal((await request(app).post(path + '/leave').set('Authorization', `Bearer ${token}`).send({})).status, 200);
  }
  const created = await request(app).post(endpoint + '/rooms').set('Authorization', `Bearer ${token}`).send({ gameType: 'memory_flash', mode: 'DUO' });
  const leave = `${endpoint}/rooms/${created.body.room.id}/leave`;
  assert.equal((await request(app).post(leave).set('Authorization', `Bearer ${token}`).send({})).status, 200);
  assert.equal((await request(app).post(leave).set('Authorization', `Bearer ${token}`).send({})).status, 200);
  assert.equal((await request(app).get(endpoint + '/rooms?gameType=uno&mode=DUO').set('Authorization', `Bearer ${token}`)).status, 400);
});
test('Arcade migration creates indexed durable tables and is safely repeatable', async () => {
  const { Sequelize, DataTypes } = require('sequelize');
  const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  const q = db.getQueryInterface();
  const migration = require('../src/migrations/20261021100000-create-arcade-games');
  try {
    await q.createTable('users', { id: { type: DataTypes.BIGINT, primaryKey: true } });
    await migration.up(q, DataTypes); await migration.up(q, DataTypes);
    assert.ok((await q.describeTable('arcade_rooms')).seed);
    assert.ok((await q.describeTable('arcade_players')).events);
    assert.ok((await q.showIndex('arcade_players')).some((i) => i.unique && i.fields.some((f) => f.attribute === 'room_id')));
    const ux = require('../src/migrations/20261021140000-arcade-ux-rules-and-rematch');
    await ux.up(q, DataTypes); await ux.up(q, DataTypes);
    const columns = await q.describeTable('arcade_rooms');
    assert.equal(Number(columns.rules_version.defaultValue), 1);
    assert.ok(columns.rematch_id);
    await migration.down(q); await migration.up(q, DataTypes);
  } finally { await db.close(); }
});

test('Direction HTTP rejects bypassing the authoritative stumble and preserves the valid checkpoint',async()=>{
  const {ArcadeRoom,ArcadePlayer}=require('../src/models');
  const {challenge,OPPOSITE}=await import('../../shared/arcade/engine.mjs');
  const response=await request(app).post(endpoint+'/rooms').set('Authorization',`Bearer ${token}`).send({gameType:'direction_rush',mode:'SOLO'});
  assert.equal(response.status,201);const {room}=response.body;assert.equal(room.rulesVersion,3);
  await ArcadeRoom.update({startedAt:new Date(Date.now()-3000)},{where:{id:room.id}});
  const wrong={index:0,at:300,direction:OPPOSITE[challenge('direction_rush',room.seed,0).expected]};
  const send=events=>request(app).post(`${endpoint}/rooms/${room.id}/progress`).set('Authorization',`Bearer ${token}`).send({attemptId:room.id,seed:room.seed,revision:events.length,events});
  assert.equal((await send([wrong])).status,200);
  const next={index:1,at:600,direction:challenge('direction_rush',room.seed,1).expected};
  assert.equal((await send([wrong,next])).status,400);
  assert.equal((await ArcadePlayer.findOne({where:{roomId:room.id,userId:user.id}})).revision,1);
  const valid=await send([wrong,{...next,at:810}]);assert.equal(valid.status,200);assert.equal(valid.body.players[0].metrics.correct,1);
  await request(app).post(`${endpoint}/rooms/${room.id}/leave`).set('Authorization',`Bearer ${token}`).send({});
  const history=await request(app).get(endpoint+'/history?gameType=direction_rush').set('Authorization',`Bearer ${token}`);
  assert.ok(history.body.attempts.some(a=>a.roomId===room.id&&a.validatedAt&&a.rank===1));
});
