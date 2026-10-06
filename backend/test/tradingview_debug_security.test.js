'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const { User } = require('../src/models');

describe('TradingView Debug Security Test Suite', () => {
  let adminUser, normalUser;
  let adminToken, userToken;

  before(async () => {
    const ts = Date.now();
    adminUser = await User.create({
      name: `Admin TV ${ts}`,
      email: `admin_tv_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'admin',
    });
    adminToken = jwt.sign({ sub: adminUser.id, role: 'admin' }, env.jwtSecret, { expiresIn: '1h' });

    normalUser = await User.create({
      name: `Normal TV ${ts}`,
      email: `normal_tv_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
    });
    userToken = jwt.sign({ sub: normalUser.id, role: 'user' }, env.jwtSecret, { expiresIn: '1h' });
  });

  after(async () => {
    await User.destroy({ where: { id: [adminUser.id, normalUser.id] } });
  });

  it('1. Rejects unauthenticated request to /debug/tradingview with 401', async () => {
    const res = await request(app).get('/debug/tradingview');
    assert.equal(res.status, 401);
  });

  it('2. Rejects normal user request to /debug/tradingview with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/debug/tradingview')
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(res.status, 403);
  });

  it('3. Allows admin user request to /debug/tradingview with sanitized response', async () => {
    const res = await request(app)
      .get('/debug/tradingview')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(typeof res.body.secretConfigured, 'boolean');
    assert.ok(res.body.candleCounts);
    // Ensure raw secrets or undefined sensitive keys are not leaked
    assert.equal(res.body.secret, undefined);
    assert.equal(res.body.apiKey, undefined);
  });
});
