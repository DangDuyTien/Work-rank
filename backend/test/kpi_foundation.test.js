'use strict';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  sequelize,
  User,
  Department,
  Kpi,
  KpiPeriod,
  KpiResult,
  KpiEvent,
} = require('../src/models');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');

test('KPI Foundation Test Suite (Department, Definition, Period, Result, Audit, Dashboard)', async (t) => {
  let adminUser, contentUser, editUser;
  let adminToken, contentToken, editToken;
  let contentDept, editDept;
  let activePeriod;

  before(async () => {
    // Sync KPI models safely
    await Promise.all([
      Department.sync(),
      Kpi.sync(),
      KpiPeriod.sync(),
      KpiResult.sync(),
      KpiEvent.sync(),
    ]);

    // Ensure CONTENT and EDIT departments exist
    [contentDept] = await Department.findOrCreate({
      where: { code: 'CONTENT' },
      defaults: {
        name: 'Phòng Nội Dung (Content)',
        code: 'CONTENT',
        description: 'Sản xuất kịch bản, nội dung và ý tưởng sáng tạo',
        active: true,
      },
    });

    [editDept] = await Department.findOrCreate({
      where: { code: 'EDIT' },
      defaults: {
        name: 'Phòng Hậu Kỳ (Edit)',
        code: 'EDIT',
        description: 'Dựng phim, hậu kỳ video và hoàn thiện ấn phẩm số',
        active: true,
      },
    });

    // Ensure active current period exists
    const kpiService = require('../src/services/kpi.service');
    activePeriod = await kpiService.getOrCreateCurrentPeriod();

    const ts = Date.now();
    adminUser = await User.create({
      name: `KPI Admin ${ts}`,
      email: `kpi_admin_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'admin',
      jobTitle: 'Giám Đốc Vận Hành',
    });

    contentUser = await User.create({
      name: `Content Specialist ${ts}`,
      email: `content_spec_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'Content Creator',
      departmentId: contentDept.id,
      department: 'CONTENT',
    });

    editUser = await User.create({
      name: `Video Editor ${ts}`,
      email: `video_editor_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'Senior Video Editor',
      departmentId: editDept.id,
      department: 'EDIT',
    });

    adminToken = jwt.sign({ sub: adminUser.id, role: 'admin' }, env.jwtSecret);
    contentToken = jwt.sign({ sub: contentUser.id, role: 'user' }, env.jwtSecret);
    editToken = jwt.sign({ sub: editUser.id, role: 'user' }, env.jwtSecret);
  });

  await t.test('1. Departments: Get all departments returns CONTENT & EDIT', async () => {
    const res = await request(app)
      .get('/api/kpi/departments')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    const codes = res.body.data.map((d) => d.code);
    assert.ok(codes.includes('CONTENT'));
    assert.ok(codes.includes('EDIT'));
  });

  let createdKpi;
  await t.test('2. KPI Management: Admin creates a KPI definition for CONTENT', async () => {
    const res = await request(app)
      .post('/api/kpi/definitions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        departmentId: contentDept.id,
        name: 'Video Kịch Bản Hoàn Thành',
        code: `CONT_VID_${Date.now()}`,
        description: 'Số lượng kịch bản video hoàn thiện được duyệt',
        unit: 'video',
        target: 20,
        periodType: 'monthly',
        sourceType: 'manual',
        active: true,
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.data.id);
    assert.equal(res.body.data.name, 'Video Kịch Bản Hoàn Thành');
    assert.equal(Number(res.body.data.target), 20);
    createdKpi = res.body.data;
  });

  await t.test('3. KPI Management: Non-admin cannot create or update KPI definitions', async () => {
    const res = await request(app)
      .post('/api/kpi/definitions')
      .set('Authorization', `Bearer ${contentToken}`)
      .send({
        departmentId: contentDept.id,
        name: 'Hacked KPI',
        code: 'HACKED',
        target: 100,
      });

    assert.equal(res.status, 403);
  });

  await t.test('4. KPI Management: Toggle KPI active status', async () => {
    const res = await request(app)
      .patch(`/api/kpi/definitions/${createdKpi.id}/toggle`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.active, false);

    // Toggle back to active
    const res2 = await request(app)
      .patch(`/api/kpi/definitions/${createdKpi.id}/toggle`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res2.status, 200);
    assert.equal(res2.body.data.active, true);
  });

  let recordedResult;
  await t.test('5. KPI Results: Admin records actual KPI result and verifies audit trail', async () => {
    const res = await request(app)
      .post('/api/kpi/results')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: contentUser.id,
        departmentId: contentDept.id,
        kpiId: createdKpi.id,
        periodId: activePeriod.id,
        actualValue: 15,
        targetValue: 20,
        notes: 'Tiến độ tuần 3 ghi nhận 15 video',
      });

    assert.equal(res.status, 200);
    assert.ok(res.body.data.id);
    assert.equal(Number(res.body.data.actualValue), 15);
    assert.equal(Number(res.body.data.targetValue), 20);
    assert.equal(Number(res.body.data.progressPct), 75); // (15 / 20) * 100
    assert.equal(res.body.data.status, 'IN_PROGRESS');
    recordedResult = res.body.data;

    // Verify audit event was logged in KpiEvent
    const auditRes = await request(app)
      .get('/api/kpi/results/history')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ kpiId: createdKpi.id, userId: contentUser.id });

    assert.equal(auditRes.status, 200);
    assert.ok(Array.isArray(auditRes.body.data));
    assert.ok(auditRes.body.data.length >= 1);
    assert.equal(Number(auditRes.body.data[0].newValue), 15);
  });

  await t.test('6. User Dashboard: Employee retrieves assigned KPIs with progress', async () => {
    const res = await request(app)
      .get('/api/kpi/my-kpis')
      .set('Authorization', `Bearer ${contentToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.data.department);
    assert.equal(res.body.data.department.code, 'CONTENT');
    assert.ok(res.body.data.currentPeriod);
    assert.ok(Array.isArray(res.body.data.kpis));

    const myVidKpi = res.body.data.kpis.find((k) => k.kpiId === createdKpi.id);
    assert.ok(myVidKpi);
    assert.equal(Number(myVidKpi.target), 20);
    assert.equal(Number(myVidKpi.actual), 15);
    assert.equal(Number(myVidKpi.progressPct), 75);
    assert.equal(myVidKpi.status, 'IN_PROGRESS');
  });

  await t.test('7. Architecture Integrity: KPI Result does not hardcode XP or modify ScoreLedger', async () => {
    // Verify that recording a KPI does not award XP or create fake score events
    const { ScoreLedger } = require('../src/models');
    if (ScoreLedger) {
      const ledgers = await ScoreLedger.findAll({
        where: { userId: contentUser.id },
      });
      // There should be 0 score ledger entries generated by KPI
      assert.equal(ledgers.length, 0);
    }
  });

  await t.test('8. Edit User Dashboard: Editor user retrieves assigned KPIs for EDIT department', async () => {
    // Seed an Edit KPI
    const editKpi = await Kpi.create({
      departmentId: editDept.id,
      name: 'Video Edit Hoàn Chỉnh',
      code: `EDIT_VID_${Date.now()}`,
      description: 'Số video hậu kỳ hoàn tất trong tháng',
      unit: 'video',
      target: 25,
      periodType: 'monthly',
      sourceType: 'manual',
      active: true,
    });

    const res = await request(app)
      .get('/api/kpi/my-kpis')
      .set('Authorization', `Bearer ${editToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.data.department);
    assert.equal(res.body.data.department.code, 'EDIT');
    assert.ok(Array.isArray(res.body.data.kpis));
    const found = res.body.data.kpis.find((k) => k.kpiId === editKpi.id);
    assert.ok(found);
    assert.equal(Number(found.target), 25);
  });

  await t.test('9. Tracker Decommissioning: Legacy activity tracking endpoints return 404', async () => {
    const res1 = await request(app)
      .get('/api/activity/state')
      .set('Authorization', `Bearer ${contentToken}`);
    assert.equal(res1.status, 404);

    const res2 = await request(app)
      .post('/api/activity/events')
      .set('Authorization', `Bearer ${contentToken}`)
      .send({ keystrokes: 10, clicks: 5 });
    assert.equal(res2.status, 404);

    const res3 = await request(app)
      .get('/api/activity/leaderboard')
      .set('Authorization', `Bearer ${contentToken}`);
    assert.equal(res3.status, 404);
  });

  await t.test('10. Admin Department Override: Admin can query KPIs for specific department', async () => {
    const resContent = await request(app)
      .get('/api/kpi/my-kpis?departmentCode=CONTENT')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(resContent.status, 200);
    assert.equal(resContent.body.data.department.code, 'CONTENT');

    const resEdit = await request(app)
      .get('/api/kpi/my-kpis?departmentCode=EDIT')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(resEdit.status, 200);
    assert.equal(resEdit.body.data.department.code, 'EDIT');
  });
});
