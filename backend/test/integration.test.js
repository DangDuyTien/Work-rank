const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../src/app');
const env = require('../src/config/env');
const { sequelize, Team, User } = require('../src/models');

const agent = request(app);
const email = process.env.TEST_EMAIL || 'admin@workrank.local';
const password = process.env.TEST_PASSWORD || 'Admin@123456';

async function authToken() {
  const res = await agent.post('/api/auth/login').send({ email, password });
  assert.equal(res.status, 200, res.text);
  assert.ok(res.body.accessToken);
  return res.body.accessToken;
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
