'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const { User, Team, YouTubeChannel } = require('../src/models');

describe('YouTube Permissions & Access Control Test Suite', () => {
  let adminUser;
  let memberUser;
  let adminToken;
  let memberToken;
  let testTeam;
  let testChannel;

  before(async () => {
    adminUser = await User.create({
      name: 'Perm Admin User',
      email: `perm_admin_${Date.now()}@workrank.test`,
      passwordHash: 'hash_123',
      role: 'admin',
      status: 'active',
    });
    adminToken = jwt.sign({ sub: adminUser.id, role: 'admin' }, env.jwtSecret, { expiresIn: '1h' });

    testTeam = await Team.create({
      name: `Perm Team ${Date.now()}`,
      description: 'Team for permission tests',
    });

    memberUser = await User.create({
      name: 'Perm Member User',
      email: `perm_member_${Date.now()}@workrank.test`,
      passwordHash: 'hash_123',
      role: 'user',
      status: 'active',
      teamId: testTeam.id,
    });
    memberToken = jwt.sign({ sub: memberUser.id, role: 'user' }, env.jwtSecret, { expiresIn: '1h' });

    testChannel = await YouTubeChannel.create({
      channelId: `UC_PERM_${Date.now()}`,
      title: 'Perm Test Channel',
      teamId: testTeam.id,
      status: 'ACTIVE',
    });
  });

  after(async () => {
    if (testChannel) await testChannel.destroy();
    if (adminUser) await adminUser.destroy();
    if (memberUser) await memberUser.destroy();
    if (testTeam) await testTeam.destroy();
  });

  test('Unauthenticated requests are rejected with 401 Unauthorized', async () => {
    await request(app).get('/api/youtube/overview').expect(401);
    await request(app).get('/api/youtube/my-team').expect(401);
    await request(app).get('/api/youtube/leaderboard').expect(401);
    await request(app).get(`/api/youtube/teams/${testTeam.id}`).expect(401);
    await request(app).get(`/api/youtube/channels/${testChannel.id}`).expect(401);
    await request(app).get('/api/youtube/admin/overview').expect(401);
  });

  test('Non-admin member is rejected with 403 on all Admin routes', async () => {
    await request(app)
      .get('/api/youtube/admin/overview')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);

    await request(app)
      .get('/api/youtube/admin/channels')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);

    await request(app)
      .post('/api/youtube/admin/channels')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ channelId: 'UC_TEST', title: 'Unauthorized' })
      .expect(403);

    await request(app)
      .patch(`/api/youtube/admin/channels/${testChannel.id}/link`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ teamId: testTeam.id })
      .expect(403);

    await request(app)
      .post(`/api/youtube/admin/channels/${testChannel.id}/unlink`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);

    await request(app)
      .post(`/api/youtube/admin/channels/${testChannel.id}/sync`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);

    await request(app)
      .post('/api/youtube/admin/sync-all')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);

    await request(app)
      .delete(`/api/youtube/admin/channels/${testChannel.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);

    await request(app)
      .get('/api/youtube/admin/health')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  test('Admin has full access to all Admin routes', async () => {
    const resOverview = await request(app)
      .get('/api/youtube/admin/overview')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    assert.ok(resOverview.body.kpis);
    assert.ok(resOverview.body.diagnostics);

    const resChannels = await request(app)
      .get('/api/youtube/admin/channels')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    assert.ok(Array.isArray(resChannels.body.items));

    const resHealth = await request(app)
      .get('/api/youtube/admin/health')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    assert.ok(resHealth.body.totalChannels >= 1);
  });
});
