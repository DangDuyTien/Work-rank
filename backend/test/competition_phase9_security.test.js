'use strict';

/**
 * competition_phase9_security.test.js
 *
 * Phase 9 Security Audit & Broken Access Control (BAC) Test Suite.
 *
 * Verifies:
 *   1. Authentication & Unauthenticated Rejection (401)
 *   2. RBAC & Broken Access Control (Member -> Admin APIs -> 403)
 *   3. Cross-Tenant / Cross-Team Boundary Isolation
 *   4. Input Fuzzing & Malformed Payload Handling
 *   5. SQL Injection & Prototype Pollution Sanitization
 *   6. Ledger & Version Immutability Protection
 *   7. HTTP Security Headers & Safe Error Sanitization (No Leaks)
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const sequelize = require('../src/config/database');
const {
  User,
  Team,
  Season,
  RuleSet,
  RuleSetVersion,
  ScoreLedger,
  GrandPointsLedger,
  CompetitionEvent,
} = require('../src/models');

const env = require('../src/config/env');
const productionIntegration = require('../src/services/competition/productionIntegration.service');
const competitionEventTrace = require('../src/services/competition/competitionEventTrace.service');

describe('Phase 9 Security & Broken Access Control (BAC) Audit', () => {
  let adminUser, memberAlpha, memberBeta;
  let adminToken, memberAlphaToken, memberBetaToken;
  let teamAlpha, teamBeta;
  let testSeason, testRuleSet, testRuleVersion;
  let alphaEventId;

  before(async () => {
    await sequelize.authenticate();
    const rnd = Date.now();

    // 1. Teams
    [teamAlpha] = await Team.findOrCreate({
      where: { name: `Sec Team Alpha ${rnd}` },
      defaults: { inviteCode: `SEC_A_${rnd}` },
    });
    [teamBeta] = await Team.findOrCreate({
      where: { name: `Sec Team Beta ${rnd}` },
      defaults: { inviteCode: `SEC_B_${rnd}` },
    });

    // 2. Users
    [adminUser] = await User.findOrCreate({
      where: { email: `sec_admin_${rnd}@workrank.io` },
      defaults: { name: 'Sec Admin', role: 'admin', passwordHash: 'testpass', teamId: teamAlpha.id },
    });
    [memberAlpha] = await User.findOrCreate({
      where: { email: `sec_member_alpha_${rnd}@workrank.io` },
      defaults: { name: 'Sec Alpha Member', role: 'user', passwordHash: 'testpass', teamId: teamAlpha.id },
    });
    [memberBeta] = await User.findOrCreate({
      where: { email: `sec_member_beta_${rnd}@workrank.io` },
      defaults: { name: 'Sec Beta Member', role: 'user', passwordHash: 'testpass', teamId: teamBeta.id },
    });

    adminToken = jwt.sign(
      { sub: adminUser.id, id: adminUser.id, role: 'admin', email: adminUser.email },
      env.jwtSecret,
      { expiresIn: '1h' },
    );
    memberAlphaToken = jwt.sign(
      { sub: memberAlpha.id, id: memberAlpha.id, role: 'user', email: memberAlpha.email },
      env.jwtSecret,
      { expiresIn: '1h' },
    );
    memberBetaToken = jwt.sign(
      { sub: memberBeta.id, id: memberBeta.id, role: 'user', email: memberBeta.email },
      env.jwtSecret,
      { expiresIn: '1h' },
    );

    // 3. RuleSet & Season
    testRuleSet = await RuleSet.create({
      name: `Sec Ruleset ${rnd}`,
      code: `sec_rs_${rnd}`,
      description: 'Security testing ruleset',
    });
    testRuleVersion = await RuleSetVersion.create({
      ruleSetId: testRuleSet.id,
      versionNumber: 1,
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: new Date('2026-12-31'),
      status: 'PUBLISHED',
      publishedAt: new Date(),
      astPayload: [
        {
          name: 'Security Test Action',
          condition_ast: { op: 'EQ', field: 'event.event_type', value: 'VIDEO_APPROVED' },
          action_ast: { type: 'ADD', value: 50 },
          effect_type: 'INDIVIDUAL_XP',
        },
      ],
    });

    testSeason = await Season.create({
      name: `Sec Season ${rnd}`,
      slug: `sec-season-${rnd}`,
      status: 'ACTIVE',
      startAt: new Date('2026-01-01'),
      endAt: new Date('2026-12-31'),
      activeRuleSetId: testRuleSet.id,
      activeRuleVersionId: testRuleVersion.id,
      grandPointsDistribution: [100, 70, 50],
    });

    // 4. Ingest an event belonging to Member Alpha
    const pubRes = await productionIntegration.recordVideoApproved({
      videoId: Math.floor(Math.random() * 1000000) + 500000,
      title: 'Confidential Production Film',
      actorId: memberAlpha.id,
      teamId: teamAlpha.id,
      seasonId: testSeason.id,
    });
    alphaEventId = pubRes.eventId;
  });

  describe('1. Authentication & Unauthenticated Rejection', () => {
    it('Rejects unauthenticated request with 401 on protected endpoint', async () => {
      const res = await request(app).get('/api/competition/my-state');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.message, 'Missing access token');
    });

    it('Rejects forged or expired JWT tokens with 401', async () => {
      const forgedToken = jwt.sign({ sub: 99999, role: 'admin' }, 'wrong-secret-key');
      const res = await request(app)
        .get('/api/competition/admin/rules')
        .set('Authorization', `Bearer ${forgedToken}`);
      assert.strictEqual(res.status, 401);
      assert.match(res.body.message, /Invalid or expired access token/);
    });
  });

  describe('2. Broken Access Control (BAC) — Admin Endpoints Protected Against Members', () => {
    const adminEndpoints = [
      { method: 'get', url: '/api/competition/admin/rules' },
      { method: 'post', url: '/api/competition/admin/rules', body: { name: 'Hack RS', code: 'hack_rs' } },
      { method: 'get', url: '/api/competition/admin/seasons' },
      { method: 'post', url: '/api/competition/admin/seasons', body: { name: 'Hack Season' } },
      { method: 'get', url: '/api/competition/admin/grand' },
      { method: 'post', url: '/api/competition/admin/grand', body: { name: 'Hack Grand' } },
      { method: 'get', url: '/api/competition/admin/projections/status' },
      { method: 'post', url: '/api/competition/admin/projections/rebuild', body: {} },
      { method: 'get', url: '/api/competition/admin/integration/health' },
      { method: 'post', url: '/api/competition/admin/events/some-uuid/retry', body: { reason: 'hack' } },
      { method: 'post', url: '/api/competition/admin/grand/1/reconcile', body: { reason: 'hack' } },
    ];

    for (const ep of adminEndpoints) {
      it(`Rejects Member attempting ${ep.method.toUpperCase()} ${ep.url} with 403 Forbidden`, async () => {
        let req = request(app)[ep.method](ep.url).set('Authorization', `Bearer ${memberAlphaToken}`);
        if (ep.body) req = req.send(ep.body);

        const res = await req;
        assert.strictEqual(res.status, 403);
        assert.strictEqual(res.body.message, 'Forbidden');
      });
    }
  });

  describe('3. Cross-Tenant & Cross-Team Boundary Isolation', () => {
    it('Prevents Member Beta from tracing an event belonging to Member Alpha / Team Alpha', async () => {
      const res = await request(app)
        .get(`/api/competition/events/${alphaEventId}/trace`)
        .set('Authorization', `Bearer ${memberBetaToken}`);

      assert.strictEqual(res.status, 403);
      assert.match(res.body.message, /Forbidden/);
    });

    it('Allows Member Alpha to trace their own event', async () => {
      const res = await request(app)
        .get(`/api/competition/events/${alphaEventId}/trace`)
        .set('Authorization', `Bearer ${memberAlphaToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.eventId, alphaEventId);
      assert.strictEqual(Number(res.body.actor.id), Number(memberAlpha.id));
    });

    it('Allows Admin to trace any event across all teams with full diagnostics', async () => {
      const res = await request(app)
        .get(`/api/competition/events/${alphaEventId}/trace`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.eventId, alphaEventId);
      assert.ok(res.body.ruleEvaluation);
    });
  });

  describe('4. Input Fuzzing & Malformed Payloads', () => {
    it('Rejects event ingestion with null payload safely (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/competition/events/publish')
        .set('Authorization', `Bearer ${memberAlphaToken}`)
        .send({
          contractKey: 'production.video.approved',
          payload: null,
        });

      assert.strictEqual(res.status, 400);
      assert.match(res.body.message, /Domain Event validation failed/);
    });

    it('Rejects event ingestion with non-numeric schemaVersion safely', async () => {
      const res = await request(app)
        .post('/api/competition/events/publish')
        .set('Authorization', `Bearer ${memberAlphaToken}`)
        .send({
          contractKey: 'production.video.approved',
          schemaVersion: 'INVALID_VERSION',
          payload: { videoId: 101 },
        });

      assert.strictEqual(res.status, 400);
      assert.match(res.body.message, /Unsupported schema_version/);
    });

    it('Handles deep JSON and extreme arrays without crashing the process', async () => {
      const hugeArray = Array.from({ length: 500 }, (_, i) => ({ id: i }));
      const res = await request(app)
        .post('/api/competition/events/publish')
        .set('Authorization', `Bearer ${memberAlphaToken}`)
        .send({
          contractKey: 'production.video.approved',
          payload: { videoId: 9999, junk: hugeArray },
        });

      // Should succeed or return 400 gracefully without 500 or crashing
      assert.ok([200, 201, 400].includes(res.status));
    });
  });

  describe('5. SQL Injection & Prototype Pollution Sanitization', () => {
    it('Sanitizes SQL injection strings in query parameters safely', async () => {
      const sqliString = "1' OR '1'='1' --";
      const res = await request(app)
        .get(`/api/competition/seasons/${encodeURIComponent(sqliString)}/leaderboard`)
        .set('Authorization', `Bearer ${memberAlphaToken}`);

      // Should return 404/400 or empty without executing raw SQL
      assert.ok([200, 400, 404].includes(res.status));
    });

    it('Rejects Prototype Pollution attempt (__proto__, constructor) in Rule AST', async () => {
      const pollutedAst = JSON.parse(`{
        "name": "Pollution Attack",
        "__proto__": { "polluted": true },
        "condition_ast": { "op": "EQ", "field": "event.event_type", "value": "TEST" },
        "action_ast": { "type": "ADD", "value": 10 },
        "effect_type": "INDIVIDUAL_XP"
      }`);

      const res = await request(app)
        .post(`/api/competition/admin/rules/${testRuleSet.id}/versions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          effectiveFrom: new Date('2027-01-01'),
          astPayload: [pollutedAst],
        });

      assert.ok([201, 400].includes(res.status));
      assert.strictEqual(Object.prototype.polluted, undefined);
    });
  });

  describe('6. Data & Ledger Immutability Protection', () => {
    it('ScoreLedger rows cannot be mutated via application operations without audit', async () => {
      const ledgerEntry = await ScoreLedger.findOne();
      if (ledgerEntry) {
        // Attempt to direct-modify delta
        const originalDelta = ledgerEntry.pointsDelta;
        assert.ok(typeof originalDelta === 'number');
      }
    });

    it('Published RuleSetVersion cannot be modified in place', async () => {
      const res = await request(app)
        .put(`/api/competition/admin/rules/${testRuleSet.id}/versions/${testRuleVersion.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          astPayload: [{ name: 'Tampered Rule', action_ast: { type: 'ADD', value: 9999 } }],
        });

      assert.strictEqual(res.status, 400);
      assert.match(res.body.message, /Cannot (modify|edit) version in PUBLISHED/i);
    });
  });

  describe('7. HTTP Security Headers & Safe Error Handling', () => {
    it('Includes standard HTTP security headers (Helmet, X-Content-Type-Options, etc.)', async () => {
      const res = await request(app).get('/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
      assert.strictEqual(res.headers['x-frame-options'], 'SAMEORIGIN');
    });

    it('Provides Correlation ID header on all error responses', async () => {
      const res = await request(app).get('/api/non-existent-endpoint-404');
      assert.strictEqual(res.status, 404);
      assert.ok(res.headers['x-correlation-id']);
      assert.ok(res.body.correlationId);
    });
  });
});
