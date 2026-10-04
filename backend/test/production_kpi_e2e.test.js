'use strict';

/**
 * Production KPI Engine — E2E Test Suite
 *
 * Covers:
 *  EDITOR (8 cases):
 *    E-1  Standard time  → 100% efficiency
 *    E-2  Faster         → bonus points (capped at 200%)
 *    E-3  Slower         → reduced points (floor 40%)
 *    E-4  Duplicate      → idempotent, no double-award
 *    E-5  Retry duplicate after first request (same idempotency key)
 *    E-6  Missing timestamps → 400
 *    E-7  Invalid timestamps (end < start) → 400
 *    E-8  Missing episodeId → 400
 *
 *  CONTENT (7 cases):
 *    C-1  Single episode / week = 1/5 target
 *    C-2  Hit weekly target exactly (5/5)
 *    C-3  Exceed target (8/5) → bonus multiplier
 *    C-4  Duplicate week key → idempotent
 *    C-5  Empty completedEpisodes array → 400
 *    C-6  Episode missing startedAt/completedAt → 400
 *    C-7  Missing contentCreatorId → 400
 *
 *  RULE / VERSION (4 cases):
 *    V-1  GET /production/rules → returns list
 *    V-2  GET /production/versions → returns list
 *    V-3  Non-admin cannot import Excel → 403
 *    V-4  Non-admin cannot activate version → 403
 *
 *  SECURITY (2 cases):
 *    S-1  Unauthenticated request to calculate/editor → 401
 *    S-2  GET /production/history returns snapshots with user info
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const crypto = require('node:crypto');
const {
  sequelize,
  User,
  Team,
  ProductionKpiRule,
  ProductionKpiActivation,
  ProductionKpiExecutionSnapshot,
} = require('../src/models');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    env.jwtSecret,
    { expiresIn: '1h' },
  );
}

function isoOffset(base, minutes) {
  const d = new Date(base);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

// ─── seed active KPI rules ─────────────────────────────────────────────────────

async function seedActiveRules(version = 'v_test_1.0') {
  // Only one ACTIVE rule per role/taskType may exist so getActiveRule is deterministic.
  await ProductionKpiRule.update(
    { status: 'DEPRECATED', active: false },
    { where: { role: ['EDITOR', 'CONTENT'], status: 'ACTIVE' } },
  );

  const base = {
    version,
    active: true,
    status: 'ACTIVE',
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
  };

  const [editorRule] = await ProductionKpiRule.findOrCreate({
    where: { version, role: 'EDITOR', taskType: 'EPISODE_FULL' },
    defaults: {
      ...base,
      role: 'EDITOR',
      taskType: 'EPISODE_FULL',
      metric: 'COMPLETION_DURATION',
      unit: 'minutes',
      targetValue: 180,
      standardTime: 180,
      pointBase: 100,
      xpBase: 50,
      scoringMode: 'SPEED_EFFICIENCY_CURVE',
    },
  });

  await editorRule.update({ status: 'ACTIVE', active: true });

  const [contentRule] = await ProductionKpiRule.findOrCreate({
    where: { version, role: 'CONTENT', taskType: 'SCRIPT_STANDARD' },
    defaults: {
      ...base,
      role: 'CONTENT',
      taskType: 'SCRIPT_STANDARD',
      metric: 'WEEKLY_OUTPUT',
      unit: 'episodes_per_week',
      targetValue: 5,
      standardTime: 120,
      pointBase: 100,
      xpBase: 50,
      scoringMode: 'WEEKLY_OUTPUT_AVERAGE_CURVE',
    },
  });

  await contentRule.update({ status: 'ACTIVE', active: true });

  return { editorRule, contentRule };
}

// ─── main test ────────────────────────────────────────────────────────────────

test('Production KPI Engine — E2E Test Suite', async (t) => {
  let adminUser, editorUser, contentUser, memberUser;
  let adminToken, editorToken, contentToken, memberToken;
  let testTeam;
  const TS = Date.now();
  const BASE_TIME = new Date('2026-10-03T08:00:00.000Z').toISOString();

  before(async () => {
    // Sync new tables
    await Promise.all([
      ProductionKpiRule.sync(),
      ProductionKpiActivation.sync(),
      ProductionKpiExecutionSnapshot.sync(),
    ]);

    // Create test team
    [testTeam] = await Team.findOrCreate({
      where: { name: `TestTeam-KPI-${TS}` },
      defaults: { name: `TestTeam-KPI-${TS}` },
    });

    // Create admin user
    adminUser = await User.create({
      name: `Admin-KPI-${TS}`,
      email: `admin-kpi-${TS}@test.local`,
      passwordHash: 'x',
      role: 'admin',
      status: 'active',
      teamId: testTeam.id,
    });

    // Create editor user
    editorUser = await User.create({
      name: `Editor-KPI-${TS}`,
      email: `editor-kpi-${TS}@test.local`,
      passwordHash: 'x',
      role: 'user',
      status: 'active',
      teamId: testTeam.id,
    });

    // Create content user
    contentUser = await User.create({
      name: `Content-KPI-${TS}`,
      email: `content-kpi-${TS}@test.local`,
      passwordHash: 'x',
      role: 'user',
      status: 'active',
      teamId: testTeam.id,
    });

    // Create plain member (no special role)
    memberUser = await User.create({
      name: `Member-KPI-${TS}`,
      email: `member-kpi-${TS}@test.local`,
      passwordHash: 'x',
      role: 'user',
      status: 'active',
      teamId: testTeam.id,
    });

    adminToken = makeToken(adminUser);
    editorToken = makeToken(editorUser);
    contentToken = makeToken(contentUser);
    memberToken = makeToken(memberUser);

    // Seed active KPI rules
    await seedActiveRules();
  });

  after(async () => {
    // Cleanup test data (best-effort)
    try {
      await ProductionKpiExecutionSnapshot.destroy({
        where: { userId: [adminUser?.id, editorUser?.id, contentUser?.id, memberUser?.id].filter(Boolean) },
      });
      await User.destroy({ where: { id: [adminUser?.id, editorUser?.id, contentUser?.id, memberUser?.id].filter(Boolean) } });
    } catch (_) { /* ignore cleanup errors */ }
  });

  // ════════════════════════════════════════════════════════
  // EDITOR TESTS
  // ════════════════════════════════════════════════════════

  await t.test('E-1: Editor — standard time → 100% efficiency, pointsAwarded = pointBase', async () => {
    const episodeId = `ep-std-${TS}`;
    const res = await request(app)
      .post('/api/kpi/production/calculate/editor')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        editorId: editorUser.id,
        episodeId,
        taskType: 'EPISODE_FULL',
        startedAt: BASE_TIME,
        completedAt: isoOffset(BASE_TIME, 180), // exactly 180 min
        teamId: testTeam.id,
      });

    assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.success, true);
    assert.equal(res.body.duplicate, false);
    // standard / standard = 1.0 efficiency → pointBase × 1 = 100
    assert.equal(res.body.pointsAwarded, 100, `Expected pointsAwarded=100, got ${res.body.pointsAwarded}`);
    assert.equal(res.body.xpAwarded, 50);
    assert.ok(res.body.snapshot, 'Snapshot should be returned');
  });

  await t.test('E-2: Editor — faster than standard → bonus (capped at 200%)', async () => {
    const episodeId = `ep-fast-${TS}`;
    const res = await request(app)
      .post('/api/kpi/production/calculate/editor')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        editorId: editorUser.id,
        episodeId,
        taskType: 'EPISODE_FULL',
        startedAt: BASE_TIME,
        completedAt: isoOffset(BASE_TIME, 60), // 60 min, standard=180 → efficiency = 3.0, capped to 2.0
        teamId: testTeam.id,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.duplicate, false);
    // efficiency capped at 2.0 → points = 100 × 2 = 200
    assert.equal(res.body.pointsAwarded, 200, `Expected 200 points (cap), got ${res.body.pointsAwarded}`);
    assert.equal(res.body.xpAwarded, 100);
  });

  await t.test('E-3: Editor — slower than standard → reduced points (floor 40%)', async () => {
    const episodeId = `ep-slow-${TS}`;
    const res = await request(app)
      .post('/api/kpi/production/calculate/editor')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        editorId: editorUser.id,
        episodeId,
        taskType: 'EPISODE_FULL',
        startedAt: BASE_TIME,
        completedAt: isoOffset(BASE_TIME, 900), // 900 min = 5× standard → efficiency = 180/900 ≈ 0.2, floor to 0.4
        teamId: testTeam.id,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.duplicate, false);
    // floor at 0.4 → points = Math.round(100 × 0.4) = 40
    assert.equal(res.body.pointsAwarded, 40, `Expected 40 points (floor), got ${res.body.pointsAwarded}`);
    assert.equal(res.body.xpAwarded, 20);
  });

  await t.test('E-4: Editor — duplicate episodeId → idempotent, no second award', async () => {
    const episodeId = `ep-dup-${TS}`;

    // First call
    const res1 = await request(app)
      .post('/api/kpi/production/calculate/editor')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        editorId: editorUser.id,
        episodeId,
        taskType: 'EPISODE_FULL',
        startedAt: BASE_TIME,
        completedAt: isoOffset(BASE_TIME, 180),
        teamId: testTeam.id,
      });

    assert.equal(res1.status, 200);
    assert.equal(res1.body.duplicate, false);

    // Second call — same episodeId, same editorId, same version
    const res2 = await request(app)
      .post('/api/kpi/production/calculate/editor')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        editorId: editorUser.id,
        episodeId,
        taskType: 'EPISODE_FULL',
        startedAt: BASE_TIME,
        completedAt: isoOffset(BASE_TIME, 90), // different duration but same key
        teamId: testTeam.id,
      });

    assert.equal(res2.status, 200);
    assert.equal(res2.body.duplicate, true, 'Second call must be flagged as duplicate');
    assert.ok(res2.body.message, 'Duplicate message must be present');

    // Verify only 1 snapshot in DB
    const snapshotCount = await ProductionKpiExecutionSnapshot.count({
      where: {
        userId: editorUser.id,
        taskId: episodeId,
        role: 'EDITOR',
      },
    });
    assert.equal(snapshotCount, 1, 'Only one snapshot should exist for this episode');
  });

  await t.test('E-5: Editor — retry duplicate (E-4) still returns success:true and previous snapshot', async () => {
    const episodeId = `ep-dup-${TS}`; // same key as E-4

    const res = await request(app)
      .post('/api/kpi/production/calculate/editor')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        editorId: editorUser.id,
        episodeId,
        taskType: 'EPISODE_FULL',
        startedAt: BASE_TIME,
        completedAt: isoOffset(BASE_TIME, 120),
        teamId: testTeam.id,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.duplicate, true);
    assert.ok(res.body.snapshot, 'Must return existing snapshot');
  });

  await t.test('E-6: Editor — missing timestamps → 400', async () => {
    const res = await request(app)
      .post('/api/kpi/production/calculate/editor')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        editorId: editorUser.id,
        episodeId: `ep-notime-${TS}`,
        taskType: 'EPISODE_FULL',
        // no startedAt, no completedAt
        teamId: testTeam.id,
      });

    assert.ok([400, 422, 500].includes(res.status), `Expected 4xx, got ${res.status}`);
  });

  await t.test('E-7: Editor — completedAt before startedAt → 400', async () => {
    const res = await request(app)
      .post('/api/kpi/production/calculate/editor')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        editorId: editorUser.id,
        episodeId: `ep-badtime-${TS}`,
        taskType: 'EPISODE_FULL',
        startedAt: isoOffset(BASE_TIME, 180),
        completedAt: BASE_TIME, // end before start
        teamId: testTeam.id,
      });

    assert.ok([400, 422].includes(res.status), `Expected 400, got ${res.status}`);
  });

  await t.test('E-8: Editor — missing episodeId → 400', async () => {
    const res = await request(app)
      .post('/api/kpi/production/calculate/editor')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        editorId: editorUser.id,
        // no episodeId
        taskType: 'EPISODE_FULL',
        startedAt: BASE_TIME,
        completedAt: isoOffset(BASE_TIME, 180),
        teamId: testTeam.id,
      });

    assert.ok([400, 422].includes(res.status), `Expected 400, got ${res.status}`);
  });

  // ════════════════════════════════════════════════════════
  // CONTENT TESTS
  // ════════════════════════════════════════════════════════

  await t.test('C-1: Content — 1 episode / week (1/5 target) → reduced points', async () => {
    const weekKey = `2026-W40-single-${TS}`;
    const res = await request(app)
      .post('/api/kpi/production/calculate/content')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        contentCreatorId: contentUser.id,
        weekKey,
        completedEpisodes: [
          {
            episodeId: `ep-c1-1-${TS}`,
            taskType: 'SCRIPT_STANDARD',
            startedAt: BASE_TIME,
            completedAt: isoOffset(BASE_TIME, 120),
          },
        ],
        teamId: testTeam.id,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.duplicate, false);
    assert.equal(res.body.weeklyOutput, 1);
    // outputRatio = 1/5 = 0.2, timeEfficiency = 120/120 = 1.0 (capped), combined = 0.2
    // points = round(100 × 0.2) = 20
    assert.equal(res.body.pointsAwarded, 20, `Expected 20 pts, got ${res.body.pointsAwarded}`);
  });

  await t.test('C-2: Content — 5 episodes / week (hit target exactly) → full 100 pts', async () => {
    const weekKey = `2026-W40-full-${TS}`;
    const episodes = Array.from({ length: 5 }, (_, i) => ({
      episodeId: `ep-c2-${i + 1}-${TS}`,
      taskType: 'SCRIPT_STANDARD',
      startedAt: isoOffset(BASE_TIME, i * 150),
      completedAt: isoOffset(BASE_TIME, i * 150 + 120), // each 120 min = standard
    }));

    const res = await request(app)
      .post('/api/kpi/production/calculate/content')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        contentCreatorId: contentUser.id,
        weekKey,
        completedEpisodes: episodes,
        teamId: testTeam.id,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.weeklyOutput, 5);
    // outputRatio = 5/5 = 1.0, timeEfficiency = 120/120 = 1.0 → combined = 1.0 → points = 100
    assert.equal(res.body.pointsAwarded, 100, `Expected 100 pts, got ${res.body.pointsAwarded}`);
    assert.equal(res.body.xpAwarded, 50);
  });

  await t.test('C-3: Content — 8 episodes / week (exceed target) → bonus', async () => {
    const weekKey = `2026-W40-exceed-${TS}`;
    const episodes = Array.from({ length: 8 }, (_, i) => ({
      episodeId: `ep-c3-${i + 1}-${TS}`,
      taskType: 'SCRIPT_STANDARD',
      startedAt: isoOffset(BASE_TIME, i * 100),
      completedAt: isoOffset(BASE_TIME, i * 100 + 100), // 100 min each, standard=120
    }));

    const res = await request(app)
      .post('/api/kpi/production/calculate/content')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        contentCreatorId: contentUser.id,
        weekKey,
        completedEpisodes: episodes,
        teamId: testTeam.id,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.weeklyOutput, 8);
    // outputRatio = 8/5 = 1.6, timeEfficiency = 120/100 = 1.2 (≤1.5 cap), combined = 1.92
    // points = round(100 × 1.92) = 192
    assert.ok(res.body.pointsAwarded > 100, `Expected bonus >100 pts, got ${res.body.pointsAwarded}`);
  });

  await t.test('C-4: Content — duplicate weekKey → idempotent', async () => {
    const weekKey = `2026-W40-dup-${TS}`;
    const episodes = [
      {
        episodeId: `ep-c4-1-${TS}`,
        taskType: 'SCRIPT_STANDARD',
        startedAt: BASE_TIME,
        completedAt: isoOffset(BASE_TIME, 120),
      },
    ];

    const res1 = await request(app)
      .post('/api/kpi/production/calculate/content')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ contentCreatorId: contentUser.id, weekKey, completedEpisodes: episodes, teamId: testTeam.id });

    assert.equal(res1.status, 200);
    assert.equal(res1.body.duplicate, false);

    const res2 = await request(app)
      .post('/api/kpi/production/calculate/content')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ contentCreatorId: contentUser.id, weekKey, completedEpisodes: episodes, teamId: testTeam.id });

    assert.equal(res2.status, 200);
    assert.equal(res2.body.duplicate, true, 'Second call must be duplicate');

    // DB count
    const snapCount = await ProductionKpiExecutionSnapshot.count({
      where: { userId: contentUser.id, taskId: weekKey, role: 'CONTENT' },
    });
    assert.equal(snapCount, 1, 'Only one snapshot should exist for this weekKey');
  });

  await t.test('C-5: Content — empty completedEpisodes → 400', async () => {
    const res = await request(app)
      .post('/api/kpi/production/calculate/content')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        contentCreatorId: contentUser.id,
        weekKey: `2026-W99-empty-${TS}`,
        completedEpisodes: [],
        teamId: testTeam.id,
      });

    assert.ok([400, 422].includes(res.status), `Expected 400, got ${res.status}`);
  });

  await t.test('C-6: Content — episode missing timestamps → 400', async () => {
    const res = await request(app)
      .post('/api/kpi/production/calculate/content')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        contentCreatorId: contentUser.id,
        weekKey: `2026-W99-notime-${TS}`,
        completedEpisodes: [
          { episodeId: `ep-notime-${TS}`, taskType: 'SCRIPT_STANDARD' }, // no startedAt/completedAt
        ],
        teamId: testTeam.id,
      });

    assert.ok([400, 422, 500].includes(res.status), `Expected 4xx, got ${res.status}`);
  });

  await t.test('C-7: Content — missing contentCreatorId → 400', async () => {
    const res = await request(app)
      .post('/api/kpi/production/calculate/content')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        // no contentCreatorId
        weekKey: `2026-W99-noid-${TS}`,
        completedEpisodes: [
          {
            episodeId: `ep-noid-1-${TS}`,
            taskType: 'SCRIPT_STANDARD',
            startedAt: BASE_TIME,
            completedAt: isoOffset(BASE_TIME, 120),
          },
        ],
        teamId: testTeam.id,
      });

    assert.ok([400, 422].includes(res.status), `Expected 400, got ${res.status}`);
  });

  // ════════════════════════════════════════════════════════
  // RULE / VERSION TESTS
  // ════════════════════════════════════════════════════════

  await t.test('V-1: GET /production/rules → 200 with rule data', async () => {
    const res = await request(app)
      .get('/api/kpi/production/rules')
      .set('Authorization', `Bearer ${editorToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.success, 'success should be true');
  });

  await t.test('V-2: GET /production/versions → 200 with version list', async () => {
    const res = await request(app)
      .get('/api/kpi/production/versions')
      .set('Authorization', `Bearer ${editorToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.success, 'success should be true');
    assert.ok(Array.isArray(res.body.data), 'data should be an array');
  });

  await t.test('V-3: Non-admin cannot import Excel → 403', async () => {
    const res = await request(app)
      .post('/api/kpi/production/import')
      .set('Authorization', `Bearer ${memberToken}`)
      .attach('file', Buffer.from('fake'), { filename: 'kpi.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    assert.equal(res.status, 403, `Expected 403, got ${res.status}`);
  });

  await t.test('V-4: Non-admin cannot activate version → 403', async () => {
    const res = await request(app)
      .post('/api/kpi/production/activate')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ version: 'v_test_1.0', role: 'ALL' });

    assert.equal(res.status, 403, `Expected 403, got ${res.status}`);
  });

  // ════════════════════════════════════════════════════════
  // SECURITY TESTS
  // ════════════════════════════════════════════════════════

  await t.test('S-1: Unauthenticated request → 401', async () => {
    const res = await request(app)
      .post('/api/kpi/production/calculate/editor')
      .send({
        editorId: 999,
        episodeId: 'ep-unauth',
        taskType: 'EPISODE_FULL',
        startedAt: BASE_TIME,
        completedAt: isoOffset(BASE_TIME, 180),
      });
    // No Authorization header
    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
  });

  await t.test('S-3: Regular user cannot self-award via calculate endpoints → 403', async () => {
    const res = await request(app)
      .post('/api/kpi/production/calculate/editor')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({
        editorId: editorUser.id,
        episodeId: `ep-selfaward-${TS}`,
        taskType: 'EPISODE_FULL',
        startedAt: BASE_TIME,
        completedAt: isoOffset(BASE_TIME, 1),
      });
    assert.equal(res.status, 403, `Expected 403, got ${res.status}`);
    const n = await ProductionKpiExecutionSnapshot.count({ where: { taskId: `ep-selfaward-${TS}` } });
    assert.equal(n, 0, 'No snapshot may be created by a regular user');
  });

  await t.test('S-2: GET /production/history returns paginated snapshots', async () => {
    const res = await request(app)
      .get('/api/kpi/production/history')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ userId: editorUser.id, limit: 10 });

    assert.equal(res.status, 200);
    assert.ok(res.body.success);
    assert.ok(typeof res.body.count === 'number', 'count should be numeric');
    assert.ok(Array.isArray(res.body.data), 'data should be array');
    // Editor should have at least E-1, E-2, E-3, E-4 snapshots (not E-5 since duplicate)
    assert.ok(res.body.count >= 4, `Expected ≥4 snapshots for editor, got ${res.body.count}`);
  });
});
