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

test('security anomalies endpoint hoạt động', async () => {
  const token = await authToken();
  const res = await agent.get('/api/security/anomalies?days=1').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200, res.text);
  assert.ok(Number.isFinite(Number(res.body.totalEvents)));
  assert.ok(res.body.flagCounts && typeof res.body.flagCounts === 'object');
});
