'use strict';

/**
 * kpi_results_authz.test.js
 *
 * WR-AUDIT-001: KPI result + history là dữ liệu hiệu suất cá nhân.
 * - Member: 403 cho /api/kpi/results và /api/kpi/results/history.
 * - Member: 200 cho projection /api/kpi/results/leaderboard, KHÔNG có target/actual/source/metadata.
 * - Admin: 200 cho /api/kpi/results.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const sequelize = require('../src/config/database');
const env = require('../src/config/env');
const { User, Department, Kpi, KpiPeriod, KpiResult } = require('../src/models');

describe('WR-AUDIT-001: KPI results authorization', () => {
  let adminUser;
  let memberUser;
  let otherUser;
  let adminToken;
  let memberToken;
  let department;
  let period;
  let kpi;

  before(async () => {
    await sequelize.authenticate();
    await sequelize.sync();
    const rnd = Date.now();

    department = await Department.create({
      code: `AUTHZ_KPI_${rnd}`,
      name: `Authz KPI Dept ${rnd}`,
      active: true,
    });

    [adminUser] = await User.findOrCreate({
      where: { email: `kpi_authz_admin_${rnd}@workrank.io` },
      defaults: { name: 'KPI Authz Admin', role: 'admin', passwordHash: 'testpass123', status: 'active', profileStatus: 'complete' },
    });
    [memberUser] = await User.findOrCreate({
      where: { email: `kpi_authz_member_${rnd}@workrank.io` },
      defaults: { name: 'KPI Authz Member', role: 'user', passwordHash: 'testpass123', status: 'active', profileStatus: 'complete' },
    });
    [otherUser] = await User.findOrCreate({
      where: { email: `kpi_authz_other_${rnd}@workrank.io` },
      defaults: { name: 'KPI Authz Other', role: 'user', passwordHash: 'testpass123', status: 'active', profileStatus: 'complete' },
    });

    period = await KpiPeriod.create({
      code: `AUTHZ-${rnd}`,
      name: `Authz Period ${rnd}`,
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      status: 'OPEN',
    });

    kpi = await Kpi.create({
      code: `AUTHZ_KPI_CODE_${rnd}`,
      name: `Authz KPI ${rnd}`,
      departmentId: department.id,
      unit: 'task',
      target: 100,
      periodType: 'MONTHLY',
      sourceType: 'MANUAL',
      active: true,
    });

    await KpiResult.create({
      userId: otherUser.id,
      departmentId: department.id,
      kpiId: kpi.id,
      periodId: period.id,
      targetValue: 20,
      actualValue: 15,
      status: 'IN_PROGRESS',
      source: 'MANUAL',
    });

    adminToken = jwt.sign({ sub: adminUser.id, id: adminUser.id, role: 'admin', email: adminUser.email }, env.jwtSecret, { expiresIn: '1h' });
    memberToken = jwt.sign({ sub: memberUser.id, id: memberUser.id, role: 'user', email: memberUser.email }, env.jwtSecret, { expiresIn: '1h' });
  });

  after(async () => {
    await KpiResult.destroy({ where: { kpiId: kpi.id } }).catch(() => {});
    await Kpi.destroy({ where: { id: kpi.id } }).catch(() => {});
    await KpiPeriod.destroy({ where: { id: period.id } }).catch(() => {});
    await Department.destroy({ where: { id: department.id } }).catch(() => {});
  });

  it('member bị chặn khỏi /api/kpi/results', async () => {
    const res = await request(app).get('/api/kpi/results').set('Authorization', `Bearer ${memberToken}`);
    assert.equal(res.status, 403);
  });

  it('member bị chặn khỏi /api/kpi/results/history', async () => {
    const res = await request(app).get('/api/kpi/results/history').set('Authorization', `Bearer ${memberToken}`);
    assert.equal(res.status, 403);
  });

  it('admin vẫn đọc được /api/kpi/results', async () => {
    const res = await request(app).get('/api/kpi/results').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });

  it('member đọc projection BXH nhưng không thấy target/actual/source/metadata', async () => {
    const res = await request(app)
      .get('/api/kpi/results/leaderboard')
      .query({ periodId: period.id })
      .set('Authorization', `Bearer ${memberToken}`);
    assert.equal(res.status, 200);
    const row = res.body.data.find((item) => item.userId === otherUser.id);
    assert.ok(row, 'projection phải có row của user khác để tính BXH');
    assert.equal(row.progressPct, 75);
    assert.equal(row.user.name, 'KPI Authz Other');
    assert.equal(row.targetValue, undefined);
    assert.equal(row.actualValue, undefined);
    assert.equal(row.source, undefined);
    assert.equal(row.metadata, undefined);
  });
});
