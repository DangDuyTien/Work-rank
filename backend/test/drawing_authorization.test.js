'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { sequelize, User, Team, Drawing, DrawingLike } = require('../src/models');
const drawingService = require('../src/services/drawing.service');

let teamA;
let teamB;
let owner;
let sameTeam;
let foreign;
let former;
let publicDrawing;
let teamDrawing;
let privateDrawing;

before(async () => {
  if (sequelize.getDialect() === 'sqlite') await sequelize.sync();
  const suffix = Date.now();
  teamA = await Team.create({ name: `Drawing Team A ${suffix}` });
  teamB = await Team.create({ name: `Drawing Team B ${suffix}` });
  owner = await User.create({ name: 'Drawing Owner', email: `drawing-owner-${suffix}@test`, passwordHash: 'x', teamId: teamA.id, status: 'active' });
  sameTeam = await User.create({ name: 'Drawing Teammate', email: `drawing-same-${suffix}@test`, passwordHash: 'x', teamId: teamA.id, status: 'active' });
  foreign = await User.create({ name: 'Drawing Foreign', email: `drawing-foreign-${suffix}@test`, passwordHash: 'x', teamId: teamB.id, status: 'active' });
  former = await User.create({ name: 'Drawing Former', email: `drawing-former-${suffix}@test`, passwordHash: 'x', teamId: teamA.id, status: 'active' });
  publicDrawing = await Drawing.create({ userId: owner.id, title: 'Public', imageUrl: '/uploads/drawings/public.png', visibility: 'PUBLIC' });
  teamDrawing = await Drawing.create({ userId: owner.id, title: 'Team', imageUrl: '/uploads/drawings/team.png', visibility: 'TEAM' });
  privateDrawing = await Drawing.create({ userId: owner.id, title: 'Private', imageUrl: '/uploads/drawings/private.png', visibility: 'PRIVATE' });
  await former.update({ teamId: teamB.id });
});

after(async () => {
  await DrawingLike.destroy({ where: { drawingId: [publicDrawing.id, teamDrawing.id, privateDrawing.id] } }).catch(() => {});
  await Drawing.destroy({ where: { id: [publicDrawing.id, teamDrawing.id, privateDrawing.id] } }).catch(() => {});
  await User.destroy({ where: { id: [owner.id, sameTeam.id, foreign.id, former.id] } }).catch(() => {});
  await Team.destroy({ where: { id: [teamA.id, teamB.id] } }).catch(() => {});
});

test('drawing authorization enforces anonymous, owner, team, former and foreign access', async () => {
  assert.equal((await drawingService.getGallery({ visibility: 'PUBLIC' })).drawings.length, 1);
  assert.equal((await drawingService.getGallery({ visibility: 'ALL' })).drawings.length, 1);
  assert.equal((await drawingService.getGallery({ visibility: 'ALL', currentUserId: sameTeam.id, currentUserTeamId: teamA.id })).drawings.length, 2);
  assert.equal((await drawingService.getGallery({ visibility: 'ALL', currentUserId: foreign.id, currentUserTeamId: teamB.id })).drawings.length, 1);
  assert.equal((await drawingService.getGallery({ visibility: 'ALL', currentUserId: former.id, currentUserTeamId: teamB.id })).drawings.length, 1);

  // Fail-closed: thiếu tham số visibility (hoặc scope không hợp lệ) chỉ được trả PUBLIC.
  assert.equal((await drawingService.getGallery({})).drawings.length, 1);
  assert.equal((await drawingService.getGallery({ visibility: undefined })).drawings.length, 1);
  assert.equal((await drawingService.getGallery({ visibility: 'bogus' })).drawings.length, 1);
  assert.equal((await drawingService.getGallery({ visibility: 'TEAM' })).drawings.length, 1);
  assert.equal((await drawingService.getGallery({ visibility: 'TEAM', currentUserId: sameTeam.id, currentUserTeamId: teamA.id })).drawings.length, 2);
  assert.equal((await drawingService.getGallery({ visibility: 'PRIVATE' })).drawings.length, 0);

  await assert.rejects(() => drawingService.getById(privateDrawing.id), { status: 403 });
  await assert.doesNotReject(() => drawingService.getById(privateDrawing.id, { userId: owner.id, teamId: teamA.id }));
  await assert.doesNotReject(() => drawingService.getById(teamDrawing.id, { userId: sameTeam.id, teamId: teamA.id }));
  await assert.rejects(() => drawingService.getById(teamDrawing.id, { userId: foreign.id, teamId: teamB.id }), { status: 403 });
  await assert.rejects(() => drawingService.getById(teamDrawing.id, { userId: former.id, teamId: teamB.id }), { status: 403 });

  await assert.rejects(() => drawingService.toggleLike({ drawingId: privateDrawing.id, userId: foreign.id, teamId: teamB.id }), { status: 403 });
  await assert.doesNotReject(() => drawingService.toggleLike({ drawingId: teamDrawing.id, userId: sameTeam.id, teamId: teamA.id }));
  await assert.rejects(() => drawingService.toggleLike({ drawingId: teamDrawing.id, userId: foreign.id, teamId: teamB.id }), { status: 403 });
  await assert.rejects(() => drawingService.deleteDrawing({ drawingId: teamDrawing.id, userId: foreign.id }), { status: 403 });
  await assert.doesNotReject(() => drawingService.deleteDrawing({ drawingId: privateDrawing.id, userId: owner.id }));
});

test('user gallery never exposes private drawings to anonymous/foreign users', async () => {
  assert.equal((await drawingService.getUserDrawings({userId:owner.id})).drawings.length,1);
  assert.equal((await drawingService.getUserDrawings({userId:owner.id,currentUserId:foreign.id,currentUserTeamId:teamB.id})).drawings.length,1);
  assert.equal((await drawingService.getUserDrawings({userId:owner.id,currentUserId:sameTeam.id,currentUserTeamId:teamA.id})).drawings.length,2);
});
