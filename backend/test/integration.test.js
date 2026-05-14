const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../src/app');
const env = require('../src/config/env');
const { signPayload } = require('../src/utils/crypto');
const { sequelize, User } = require('../src/models');

const agent = request(app);
const email = process.env.TEST_EMAIL || 'admin@workrank.local';
const password = process.env.TEST_PASSWORD || 'Admin@123456';

async function authToken() {
  const res = await agent.post('/api/auth/login').send({ email, password });
  assert.equal(res.status, 200, res.text);
  assert.ok(res.body.accessToken);
  return res.body.accessToken;
}

function signedPayload(secret, payload) {
  const signed = JSON.parse(JSON.stringify(payload));
  delete signed.deviceSecret;
  return { ...payload, signature: signPayload(secret, signed) };
}

test.before(async () => {
  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const [user] = await User.findOrCreate({
    where: { email },
    defaults: {
      name: 'Integration Admin',
      email,
      passwordHash,
      role: 'admin',
      status: 'active',
    },
  });
  await user.update({ passwordHash, role: 'admin', status: 'active' });
});

test.after(async () => {
  await sequelize.close();
});

test('auth/me trả user hiện tại', async () => {
  const token = await authToken();
  const res = await agent.get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200, res.text);
  assert.ok(res.body.user.email);
});

test('activity batch ký HMAC được nhận', async () => {
  const token = await authToken();
  const deviceUuid = `integration-${Date.now()}`;
  const start = await agent.post('/api/activity/session/start')
    .set('Authorization', `Bearer ${token}`)
    .send({ deviceUuid, deviceName: deviceUuid, platform: 'macos' });
  assert.equal(start.status, 201, start.text);
  const payload = signedPayload(start.body.deviceSecret, {
    deviceUuid,
    deviceName: deviceUuid,
    platform: 'macos',
    deviceSecret: start.body.deviceSecret,
    sessionId: start.body.session.id,
    events: [{ timestamp: new Date().toISOString(), activeSeconds: 5, idleSeconds: 0, keystrokeCount: 3, mouseClickCount: 1, mouseMoveCount: 5, sequence: 1 }],
  });
  const batch = await agent.post('/api/activity/batch').set('Authorization', `Bearer ${token}`).send(payload);
  assert.equal(batch.status, 201, batch.text);
  assert.equal(batch.body.signatureValid, true);
  assert.equal(batch.body.flaggedCount, 0);
});

test('activity batch từ web bị bỏ qua để tránh đếm trùng desktop', async () => {
  const token = await authToken();
  const before = await agent.get('/api/activity/me/today').set('Authorization', `Bearer ${token}`);
  assert.equal(before.status, 200, before.text);
  const beforeKeys = Number(before.body.stat?.keystrokeCount || 0);
  const deviceUuid = `web-${Date.now()}`;
  const start = await agent.post('/api/activity/session/start')
    .set('Authorization', `Bearer ${token}`)
    .send({ deviceUuid, deviceName: deviceUuid, platform: 'macos', appVersion: 'web' });
  assert.equal(start.status, 201, start.text);
  const payload = signedPayload(start.body.deviceSecret, {
    deviceUuid,
    deviceName: deviceUuid,
    platform: 'macos',
    appVersion: 'web',
    deviceSecret: start.body.deviceSecret,
    sessionId: start.body.session.id,
    events: [{ timestamp: new Date().toISOString(), activeSeconds: 5, idleSeconds: 0, keystrokeCount: 99, mouseClickCount: 99, mouseMoveCount: 0, sequence: 1 }],
  });
  const batch = await agent.post('/api/activity/batch').set('Authorization', `Bearer ${token}`).send(payload);
  assert.equal(batch.status, 202, batch.text);
  assert.equal(batch.body.ignored, true);
  await agent.post('/api/activity/session/end').set('Authorization', `Bearer ${token}`).send({ sessionId: start.body.session.id });
  const after = await agent.get('/api/activity/me/today').set('Authorization', `Bearer ${token}`);
  assert.equal(after.status, 200, after.text);
  const afterKeys = Number(after.body.stat?.keystrokeCount || 0);
  assert.equal(afterKeys, beforeKeys);
});

test('security anomalies endpoint hoạt động', async () => {
  const token = await authToken();
  const res = await agent.get('/api/security/anomalies?days=1').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200, res.text);
  assert.ok(Number.isFinite(Number(res.body.totalEvents)));
  assert.ok(res.body.flagCounts && typeof res.body.flagCounts === 'object');
});

test('security events endpoint trả danh sách event nghi vấn', async () => {
  const token = await authToken();
  const res = await agent.get('/api/security/events?days=7&limit=10').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200, res.text);
  assert.ok(Array.isArray(res.body.data));
});

test('auto-quarantine khóa device sau nhiều event nghi vấn cao', async () => {
  const token = await authToken();
  const deviceUuid = `quarantine-${Date.now()}`;
  const start = await agent.post('/api/activity/session/start')
    .set('Authorization', `Bearer ${token}`)
    .send({ deviceUuid, deviceName: deviceUuid, platform: 'macos' });
  assert.equal(start.status, 201, start.text);

  let lastBatch = null;
  for (let sequence = 1; sequence <= 5; sequence += 1) {
    const payload = signedPayload(start.body.deviceSecret, {
      deviceUuid,
      deviceName: deviceUuid,
      platform: 'macos',
      deviceSecret: start.body.deviceSecret,
      sessionId: start.body.session.id,
      events: [{
        timestamp: new Date().toISOString(),
        activeSeconds: 10,
        idleSeconds: 0,
        keystrokeCount: 0,
        mouseClickCount: 500,
        mouseMoveCount: 0,
        sequence,
      }],
    });
    lastBatch = await agent.post('/api/activity/batch').set('Authorization', `Bearer ${token}`).send(payload);
    assert.equal(lastBatch.status, 201, lastBatch.text);
    assert.equal(lastBatch.body.flaggedCount, 1);
  }

  assert.equal(lastBatch.body.quarantine.quarantined, true);
  assert.equal(lastBatch.body.quarantine.flaggedEventsInWindow, 5);

  const rejected = await agent.post('/api/activity/batch').set('Authorization', `Bearer ${token}`).send(signedPayload(start.body.deviceSecret, {
    deviceUuid,
    deviceName: deviceUuid,
    platform: 'macos',
    deviceSecret: start.body.deviceSecret,
    sessionId: start.body.session.id,
    events: [{ timestamp: new Date().toISOString(), activeSeconds: 1, idleSeconds: 0, keystrokeCount: 1, mouseClickCount: 1, mouseMoveCount: 1, sequence: 6 }],
  }));
  assert.equal(rejected.status, 403, rejected.text);
  assert.equal(rejected.body.message, 'Device revoked');
});

test('level endpoint trả đủ mốc 0-50 theo tổng gõ và click', async () => {
  const token = await authToken();
  const user = await User.findOne({ where: { email } });
  const res = await agent.get(`/api/reports/users/${user.id}/level`).set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200, res.text);
  assert.equal(res.body.data.maxLevel, 50);
  assert.equal(res.body.data.milestones.length, 51);
  assert.equal(res.body.data.milestones[0].requiredActions, 0);
  assert.equal(res.body.data.milestones[1].requiredActions, 80000);
  assert.equal(res.body.data.milestones[50].requiredActions, 10000000000);
  assert.ok(res.body.data.level >= 0 && res.body.data.level <= 50);
});
