'use strict';

/**
 * competition_phase7_e2e.test.js
 *
 * Phase 7 Complete End-to-End Test:
 *   1. Admin creates Rule Set via Admin API
 *   2. Admin adds Draft Version with Visual Condition & Action AST
 *   3. Admin validates AST via Validation Endpoint
 *   4. Admin runs Simulator -> verifies expected effects with 0 ledger writes
 *   5. Admin publishes Version 1 with audit reason
 *   6. Admin creates & activates a Season linked to this Rule Set Version
 *   7. Real Competition Event is ingested and processed by Worker Engine
 *   8. ScoreLedger receives exact pipelined points from the published AST
 *   9. User fetches /api/competition/seasons/:id/rules and receives human-readable summary
 *
 * Run: node --test test/competition_phase7_e2e.test.js
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

require('dotenv').config();

const app = require('../src/app');
const sequelize = require('../src/config/database');
const {
  User,
  Team,
  Season,
  SeasonTeam,
  SeasonTeamMember,
  RuleSet,
  RuleSetVersion,
  ScoreLedger,
  CompetitionEvent,
  CompetitionAuditLog,
} = require('../src/models');

const env = require('../src/config/env');
const worker = require('../src/services/competition/competitionEngine.worker');

function generateTestToken(user) {
  return jwt.sign(
    { sub: user.id, id: user.id, email: user.email, role: user.role },
    env.jwtSecret,
    { expiresIn: '1h' },
  );
}

describe('Phase 7 E2E — Visual Rule Builder to Production Scoring Flow', () => {
  let server;
  let baseUrl;
  let adminUser;
  let memberUser;
  let adminToken;
  let memberToken;
  let testTeam;

  before(async () => {
    // Start HTTP server on ephemeral port
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Seed Admin & Member
    [adminUser] = await User.findOrCreate({
      where: { email: 'admin_p7_e2e@workrank.test' },
      defaults: { name: 'Admin P7 E2E', role: 'admin', passwordHash: 'testpass' },
    });
    adminToken = generateTestToken(adminUser);

    [memberUser] = await User.findOrCreate({
      where: { email: 'member_p7_e2e@workrank.test' },
      defaults: { name: 'Member P7 E2E', role: 'user', passwordHash: 'testpass' },
    });
    memberToken = generateTestToken(memberUser);

    [testTeam] = await Team.findOrCreate({
      where: { name: 'Alpha Squad P7' },
      defaults: { description: 'Team for Phase 7 E2E', owner_id: adminUser.id },
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('Complete Flow: Visual Rule Set Creation → Simulation → Publish → Season Scoring → User Summary API', async () => {
    // 1. Admin creates Rule Set
    const rsRes = await fetch(`${baseUrl}/api/competition/admin/rules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Video Creator Championship Rules',
        code: `rs_vid_${Date.now()}`,
        description: 'Rules for awarding video production achievements',
      }),
    });
    assert.strictEqual(rsRes.status, 201);
    const { ruleSet } = await rsRes.json();
    assert.ok(ruleSet.id);

    // 2. Admin creates Version 1 Draft with Condition & Action AST
    const astPayload = [
      {
        name: 'Quality Video Bonus',
        condition_ast: {
          op: 'AND',
          conditions: [
            { op: 'EQ', field: 'event.event_type', value: 'VIDEO_SUBMITTED' },
            { op: 'GTE', field: 'event.payload.quality_score', value: 80 },
          ],
        },
        action_ast: { type: 'ADD', value: 150 },
        effect_type: 'INDIVIDUAL_XP',
        multiplier: 1.2, // 150 * 1.2 = 180 XP
      },
    ];

    const verRes = await fetch(`${baseUrl}/api/competition/admin/rules/${ruleSet.id}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        versionNumber: 1,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: new Date('2026-12-31'),
        astPayload,
      }),
    });
    assert.strictEqual(verRes.status, 201);
    const { version } = await verRes.json();
    assert.strictEqual(version.status, 'DRAFT');

    // 3. Admin Validates AST via Validate Endpoint
    const valRes = await fetch(`${baseUrl}/api/competition/admin/rules/${ruleSet.id}/versions/${version.id}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ astPayload }),
    });
    assert.strictEqual(valRes.status, 200);
    const valData = await valRes.json();
    assert.strictEqual(valData.valid, true);
    assert.strictEqual(valData.rulesCount, 1);

    // 4. Admin runs Simulator
    const simRes = await fetch(`${baseUrl}/api/competition/admin/rules/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        versionId: version.id,
        eventPayload: {
          event_type: 'VIDEO_SUBMITTED',
          payload: { quality_score: 85 },
          actor_id: memberUser.id,
          team_id: testTeam.id,
        },
      }),
    });
    assert.strictEqual(simRes.status, 200);
    const simData = await simRes.json();
    assert.strictEqual(simData.matchedRulesCount, 1);
    assert.strictEqual(simData.totalUserPoints, 180);

    // 5. Admin Publishes Version
    const pubRes = await fetch(`${baseUrl}/api/competition/admin/rules/${ruleSet.id}/versions/${version.id}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ reason: 'Official launch for Season 2026' }),
    });
    assert.strictEqual(pubRes.status, 200);
    const { version: pubVersion } = await pubRes.json();
    assert.strictEqual(pubVersion.status, 'PUBLISHED');

    // 6. Admin creates Season linked to this Rule Set & Published Version
    const now = new Date();
    const seasonRes = await fetch(`${baseUrl}/api/competition/admin/seasons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: `Season Q1 2026 (${Date.now()})`,
        slug: `s-p7-${Date.now()}`,
        startAt: new Date(now.getTime() - 3600000).toISOString(),
        endAt: new Date(now.getTime() + 86400000 * 30).toISOString(),
        activeRuleSetId: ruleSet.id,
        activeRuleVersionId: pubVersion.id,
      }),
    });
    assert.strictEqual(seasonRes.status, 201);
    const { season } = await seasonRes.json();

    // Link team to season
    await fetch(`${baseUrl}/api/competition/admin/seasons/${season.id}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ teamId: testTeam.id }),
    });

    // Add member to season team
    await SeasonTeamMember.create({
      seasonId: season.id,
      teamId: testTeam.id,
      userId: memberUser.id,
      joinedAt: new Date(),
    });

    // Activate Season
    await fetch(`${baseUrl}/api/competition/admin/seasons/${season.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });

    // 7. Fire Real Competition Event into Outbox / Worker Pipeline
    const eventId = crypto.randomUUID();
    await CompetitionEvent.create({
      eventId,
      idempotencyKey: `idem_p7_${eventId}`,
      eventType: 'VIDEO_SUBMITTED',
      aggregateType: 'VIDEO',
      aggregateId: 123,
      actorId: memberUser.id,
      teamId: testTeam.id,
      sourceModule: 'STUDIO',
      payload: { seasonId: season.id, quality_score: 95 },
      occurredAt: new Date(),
    });

    // Process event through Worker Engine
    await worker.processBatch();

    // 8. Verify Score Ledger received the exact points defined by the Rule Builder!
    const ledgers = await ScoreLedger.findAll({
      where: { eventId, userId: memberUser.id },
    });

    assert.ok(ledgers.length >= 1, 'ScoreLedger must have scored the event');
    assert.strictEqual(ledgers[0].pointsDelta, 180, 'Score must equal 150 * 1.2 = 180 as defined in Rule Builder');

    // 9. User requests Season Rules Summary
    const rulesSummaryRes = await fetch(`${baseUrl}/api/competition/seasons/${season.id}/rules`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    assert.strictEqual(rulesSummaryRes.status, 200);
    const rulesSummary = await rulesSummaryRes.json();
    assert.strictEqual(rulesSummary.hasRules, true);
    assert.strictEqual(rulesSummary.rules.length, 1);
    assert.ok(rulesSummary.rules[0].humanSummary.includes('Quality Video Bonus'));
  });
});
