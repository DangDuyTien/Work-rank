const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../src/app');
const env = require('../src/config/env');
const { signPayload } = require('../src/utils/crypto');
const { sequelize, ActivityEvent, DailyStat, Device, Team, User, UserMinuteStat } = require('../src/models');
const { pruneRawActivityEvents } = require('../src/services/retention.service');

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

function dateOnly(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function addDays(value, days) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
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

test('login tài khoản bị khóa trả hướng dẫn liên hệ Facebook', async () => {
  const lockedEmail = `locked-${Date.now()}@workrank.local`;
  const lockedPassword = 'Locked@123456';
  const passwordHash = await bcrypt.hash(lockedPassword, env.bcryptRounds);
  await User.create({
    name: 'Locked User',
    email: lockedEmail,
    passwordHash,
    role: 'user',
    status: 'inactive',
  });

  const res = await agent.post('/api/auth/login').send({ email: lockedEmail, password: lockedPassword });
  assert.equal(res.status, 403, res.text);
  assert.equal(res.body.message, 'Tài khoản đã bị khóa. Inbox Facebook để được mở nếu đây là lỗi.');
  assert.equal(res.body.accessToken, undefined);
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

test('activity batch bị chặn nếu session không thuộc device gửi dữ liệu', async () => {
  const token = await authToken();
  const suffix = Date.now();
  const deviceA = `session-a-${suffix}`;
  const deviceB = `session-b-${suffix}`;
  const startA = await agent.post('/api/activity/session/start')
    .set('Authorization', `Bearer ${token}`)
    .send({ deviceUuid: deviceA, deviceName: deviceA, platform: 'macos' });
  assert.equal(startA.status, 201, startA.text);
  const startB = await agent.post('/api/activity/session/start')
    .set('Authorization', `Bearer ${token}`)
    .send({ deviceUuid: deviceB, deviceName: deviceB, platform: 'macos' });
  assert.equal(startB.status, 201, startB.text);

  const payload = signedPayload(startB.body.deviceSecret, {
    deviceUuid: deviceB,
    deviceName: deviceB,
    platform: 'macos',
    deviceSecret: startB.body.deviceSecret,
    sessionId: startA.body.session.id,
    events: [{ timestamp: new Date().toISOString(), activeSeconds: 5, idleSeconds: 0, keystrokeCount: 1, mouseClickCount: 1, mouseMoveCount: 0, sequence: 1 }],
  });
  const batch = await agent.post('/api/activity/batch').set('Authorization', `Bearer ${token}`).send(payload);
  assert.equal(batch.status, 403, batch.text);
  assert.equal(batch.body.message, 'Session device mismatch');
});

test('auto-quarantine khóa device sau nhiều event nghi vấn cao', async () => {
  const token = await authToken();
  const deviceUuid = `quarantine-${Date.now()}`;
  const start = await agent.post('/api/activity/session/start')
    .set('Authorization', `Bearer ${token}`)
    .send({ deviceUuid, deviceName: deviceUuid, platform: 'macos' });
  assert.equal(start.status, 201, start.text);

  let lastBatch = null;
  for (let sequence = 1; sequence <= 10; sequence += 1) {
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
  assert.equal(lastBatch.body.quarantine.flaggedEventsInWindow, 10);

  const rejected = await agent.post('/api/activity/batch').set('Authorization', `Bearer ${token}`).send(signedPayload(start.body.deviceSecret, {
    deviceUuid,
    deviceName: deviceUuid,
    platform: 'macos',
    deviceSecret: start.body.deviceSecret,
    sessionId: start.body.session.id,
    events: [{ timestamp: new Date().toISOString(), activeSeconds: 1, idleSeconds: 0, keystrokeCount: 1, mouseClickCount: 1, mouseMoveCount: 1, sequence: 11 }],
  }));
  assert.equal(rejected.status, 403, rejected.text);
  assert.equal(rejected.body.message, 'Device revoked');
});

test('level endpoint trả đủ mốc 0-50 theo tổng gõ và click', async () => {
  const token = await authToken();
  const user = await User.findOne({ where: { email } });
  const res = await agent.get(`/api/reports/users/${user.id}/level`).set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200, res.text);
  assert.equal(res.body.data.maxLevel, 200);
  assert.equal(res.body.data.milestones.length, 201);
  assert.equal(res.body.data.milestones[0].requiredActions, 0);
  assert.equal(res.body.data.milestones[1].requiredActions, 110);
  assert.equal(res.body.data.milestones[10].requiredActions, 21948);
  assert.equal(res.body.data.milestones[20].requiredActions, 108084);
  assert.equal(res.body.data.milestones[35].requiredActions, 391516);
  assert.equal(res.body.data.milestones[70].requiredActions, 1928049);
  assert.equal(res.body.data.milestones[130].requiredActions, 8006863);
  assert.equal(res.body.data.milestones[200].requiredActions, 21565606);
  assert.ok(res.body.data.level >= 0 && res.body.data.level <= 50);
});

test('weekly/monthly report trả aggregate từ daily_stats', async () => {
  const token = await authToken();
  const suffix = Date.now();
  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const reportUser = await User.create({
    name: `Report User ${suffix}`,
    email: `report-${suffix}@workrank.local`,
    passwordHash,
    role: 'user',
    status: 'active',
  });

  const today = new Date();
  const lastMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 15));
  await DailyStat.bulkCreate([
    {
      userId: reportUser.id,
      statDate: dateOnly(today),
      totalSeconds: 3600,
      activeSeconds: 3000,
      idleSeconds: 600,
      focusScore: 82,
      keystrokeCount: 1200,
      mouseClickCount: 300,
      sessionCount: 2,
    },
    {
      userId: reportUser.id,
      statDate: dateOnly(addDays(today, -7)),
      totalSeconds: 1800,
      activeSeconds: 1500,
      idleSeconds: 300,
      focusScore: 75,
      keystrokeCount: 700,
      mouseClickCount: 150,
      sessionCount: 1,
    },
    {
      userId: reportUser.id,
      statDate: dateOnly(lastMonth),
      totalSeconds: 1200,
      activeSeconds: 900,
      idleSeconds: 300,
      focusScore: 70,
      keystrokeCount: 400,
      mouseClickCount: 100,
      sessionCount: 1,
    },
  ]);

  const weekly = await agent.get(`/api/reports/users/${reportUser.id}/weekly?limit=6`).set('Authorization', `Bearer ${token}`);
  assert.equal(weekly.status, 200, weekly.text);
  assert.equal(weekly.body.period, 'week');
  assert.ok(Array.isArray(weekly.body.data));
  assert.ok(weekly.body.data.some((row) => Number(row.totalActions || row.total_actions || 0) >= 1500));

  const monthly = await agent.get(`/api/reports/users/${reportUser.id}/monthly?limit=2`).set('Authorization', `Bearer ${token}`);
  assert.equal(monthly.status, 200, monthly.text);
  assert.equal(monthly.body.period, 'month');
  assert.ok(Array.isArray(monthly.body.data));
  assert.ok(monthly.body.data.some((row) => Number(row.totalActions || row.total_actions || 0) >= 1500));

  await DailyStat.destroy({ where: { userId: reportUser.id } });
  await reportUser.destroy();
});

test('timeline dùng user_minute_stats thay vì raw events', async () => {
  const token = await authToken();
  const suffix = Date.now();
  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const timelineUser = await User.create({
    name: `Timeline User ${suffix}`,
    email: `timeline-${suffix}@workrank.local`,
    passwordHash,
    role: 'user',
    status: 'active',
  });
  const now = new Date();
  const statDate = dateOnly(now);
  const firstBucket = new Date(`${statDate}T08:00:00.000Z`);
  const secondBucket = new Date(`${statDate}T08:12:00.000Z`);
  await UserMinuteStat.bulkCreate([
    {
      userId: timelineUser.id,
      bucketStartAt: firstBucket,
      statDate,
      activeSeconds: 50,
      idleSeconds: 10,
      totalSeconds: 60,
      focusScore: 83,
      keystrokeCount: 120,
      mouseClickCount: 30,
      mouseMoveCount: 5,
      eventCount: 2,
    },
    {
      userId: timelineUser.id,
      bucketStartAt: secondBucket,
      statDate,
      activeSeconds: 40,
      idleSeconds: 20,
      totalSeconds: 60,
      focusScore: 66,
      keystrokeCount: 80,
      mouseClickCount: 10,
      mouseMoveCount: 4,
      eventCount: 1,
    },
  ]);

  const res = await agent.get(`/api/reports/users/${timelineUser.id}/timeline?date=${statDate}&granularity=quarter&timezoneOffsetMinutes=0`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200, res.text);
  assert.equal(res.body.source, 'user_minute_stats');
  assert.equal(res.body.granularity, 'quarter');
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].minute, 480);
  assert.equal(Number(res.body.data[0].keystrokes), 200);
  assert.equal(Number(res.body.data[0].mouse_clicks), 40);
  assert.equal(Number(res.body.data[0].active_seconds), 90);

  await UserMinuteStat.destroy({ where: { userId: timelineUser.id } });
  await timelineUser.destroy();
});

test('retention job xóa raw activity_events cũ theo batch', async () => {
  const suffix = Date.now();
  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const retentionUser = await User.create({
    name: `Retention User ${suffix}`,
    email: `retention-${suffix}@workrank.local`,
    passwordHash,
    role: 'user',
    status: 'active',
  });
  const device = await Device.create({
    userId: retentionUser.id,
    deviceUuid: `retention-device-${suffix}`,
    deviceName: `Retention Device ${suffix}`,
    platform: 'macos',
  });
  const oldA = await ActivityEvent.create({
    userId: retentionUser.id,
    deviceId: device.id,
    eventTime: addDays(new Date(), -45),
    activeSeconds: 1,
    keystrokeCount: 1,
    metadataJson: { test: 'retention-old-a' },
  });
  const oldB = await ActivityEvent.create({
    userId: retentionUser.id,
    deviceId: device.id,
    eventTime: addDays(new Date(), -40),
    activeSeconds: 1,
    mouseClickCount: 1,
    metadataJson: { test: 'retention-old-b' },
  });
  const recent = await ActivityEvent.create({
    userId: retentionUser.id,
    deviceId: device.id,
    eventTime: addDays(new Date(), -2),
    activeSeconds: 1,
    keystrokeCount: 1,
    metadataJson: { test: 'retention-recent' },
  });

  try {
    const result = await pruneRawActivityEvents({ days: 30, batchSize: 1, maxBatches: 5, now: new Date() });
    assert.equal(result.deleted, 2);
    assert.equal(result.batches, 2);

    const oldCount = await ActivityEvent.count({ where: { id: { [Op.in]: [oldA.id, oldB.id] } } });
    assert.equal(oldCount, 0);
    const recentCount = await ActivityEvent.count({ where: { id: recent.id } });
    assert.equal(recentCount, 1);
  } finally {
    await ActivityEvent.destroy({ where: { id: { [Op.in]: [oldA.id, oldB.id, recent.id].filter(Boolean) } } });
    await device.destroy();
    await retentionUser.destroy();
  }
});

test('group owner sửa, kick thành viên và xóa nhóm', async () => {
  const token = await authToken();
  const suffix = Date.now();
  const create = await agent.post('/api/groups')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Integration Group ${suffix}`, description: 'Before update' });
  assert.equal(create.status, 201, create.text);
  const groupId = create.body.data.id;

  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const member = await User.create({
    name: `Group Member ${suffix}`,
    email: `group-member-${suffix}@workrank.local`,
    passwordHash,
    role: 'user',
    status: 'active',
    teamId: groupId,
  });

  const update = await agent.patch(`/api/groups/${groupId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Integration Group Updated ${suffix}`, description: 'After update' });
  assert.equal(update.status, 200, update.text);
  assert.equal(update.body.data.name, `Integration Group Updated ${suffix}`);
  assert.ok(update.body.data.members.some((row) => String(row.id) === String(member.id)));

  const kick = await agent.post(`/api/groups/${groupId}/kick`)
    .set('Authorization', `Bearer ${token}`)
    .send({ userId: member.id });
  assert.equal(kick.status, 200, kick.text);
  assert.ok(!kick.body.data.members.some((row) => String(row.id) === String(member.id)));
  await member.reload();
  assert.equal(member.teamId, null);

  const remove = await agent.delete(`/api/groups/${groupId}`).set('Authorization', `Bearer ${token}`);
  assert.equal(remove.status, 204, remove.text);
  const deleted = await Team.findByPk(groupId);
  assert.equal(deleted, null);
  await member.destroy();
});
