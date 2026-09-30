'use strict';

/**
 * competition_phase7_rule_builder.test.js
 *
 * Phase 7 Backend Tests:
 *   - Normalizer: UI Model -> Canonical Safe AST
 *   - Security: Prototype pollution, depth limits, NaN/Infinity, invalid operators
 *   - Versioning: Draft lifecycle, duplication, immutability of published versions
 *   - Effective Windows: Overlap prevention
 *   - Simulator: Pure in-memory execution with ZERO database mutations
 *   - Diff: Detection of added, removed, and modified rules
 *   - RBAC & Audit Trail: Role gates & CompetitionAuditLog entries
 *
 * Run: node --test test/competition_phase7_rule_builder.test.js
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const jwt = require('jsonwebtoken');

require('dotenv').config();

const app = require('../src/app');
const sequelize = require('../src/config/database');
const {
  User,
  Team,
  Season,
  RuleSet,
  RuleSetVersion,
  ScoreLedger,
  CompetitionState,
  GrandPointsLedger,
  CompetitionAuditLog,
} = require('../src/models');

const normalizer = require('../src/services/competition/ruleBuilderNormalizer.service');
const simulator = require('../src/services/competition/ruleSimulator.service');
const differ = require('../src/services/competition/ruleDiff.service');
const ruleSetService = require('../src/services/competition/ruleSet.service');
const ruleValidator = require('../src/services/competition/ruleValidator.service');

const env = require('../src/config/env');

function generateToken(user) {
  return jwt.sign(
    { sub: user.id, id: user.id, email: user.email, role: user.role },
    env.jwtSecret,
    { expiresIn: '1h' },
  );
}

describe('Phase 7 — Visual Rule Builder & Competition Configuration', () => {
  let adminUser;
  let memberUser;
  let testRuleSet;
  let testVersionDraft;
  let testVersionPublished;

  let server;
  let baseUrl;
  let adminToken;
  let memberToken;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    [adminUser] = await User.findOrCreate({
      where: { email: 'admin_p7@workrank.test' },
      defaults: { name: 'Admin Phase 7', role: 'admin', passwordHash: 'testpass' },
    });
    adminToken = generateToken(adminUser);

    [memberUser] = await User.findOrCreate({
      where: { email: 'member_p7@workrank.test' },
      defaults: { name: 'Member Phase 7', role: 'user', passwordHash: 'testpass' },
    });
    memberToken = generateToken(memberUser);
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('1. AST Normalizer & Security Sanitization', () => {
    it('Normalizes shorthand UI field paths to canonical format', () => {
      const rawCondition = {
        op: 'GTE',
        field: 'payload.duration',
        value: 60,
      };
      const normalized = normalizer.normalizeConditionNode(rawCondition);
      assert.strictEqual(normalized.field, 'event.payload.duration');
      assert.strictEqual(normalized.op, 'GTE');
      assert.strictEqual(normalized.value, 60);
    });

    it('Rejects prototype pollution attempts in AST fields and keys', () => {
      assert.throws(
        () => {
          normalizer.normalizeConditionNode({
            op: 'EQ',
            field: '__proto__.isAdmin',
            value: true,
          });
        },
        /Security Violation/,
      );
    });

    it('Rejects condition AST depth exceeding MAX_AST_DEPTH (5)', () => {
      let nested = { op: 'EQ', field: 'event.payload.level', value: 1 };
      for (let i = 0; i < 6; i++) {
        nested = { op: 'AND', conditions: [nested] };
      }
      assert.throws(() => {
        normalizer.normalizeConditionNode(nested);
      }, /depth exceeds maximum/);
    });

    it('Rejects unknown condition operators and invalid action types', () => {
      assert.throws(() => {
        normalizer.normalizeConditionNode({ op: 'EXEC_SQL', field: 'event.payload.cmd', value: 'DROP TABLE' });
      }, /Invalid or unsupported condition operator/);

      assert.throws(() => {
        normalizer.normalizeActionNode({ type: 'EXEC_SHELL', value: 10 });
      }, /Invalid or unsupported action type/);
    });

    it('Generates human-readable rule summaries accurately', () => {
      const rule = {
        name: 'Video Bonus',
        condition_ast: {
          op: 'AND',
          conditions: [
            { op: 'EQ', field: 'event.payload.status', value: 'APPROVED' },
            { op: 'GTE', field: 'event.payload.duration', value: 60 },
          ],
        },
        action_ast: { type: 'ADD', value: 100 },
        effect_type: 'INDIVIDUAL_XP',
        multiplier: 1.5,
      };

      const summary = normalizer.generateHumanReadableSummary(rule);
      assert.ok(summary.includes('Video Bonus:'));
      assert.ok(summary.includes('APPROVED'));
      assert.ok(summary.includes('60'));
      assert.ok(summary.includes('+100 Điểm Cá Nhân'));
      assert.ok(summary.includes('x1.5'));
    });
  });

  describe('2. Rule Set & Version Lifecycle Management', () => {
    it('Creates a new Rule Set with unique code and logs audit', async () => {
      const code = `rs_p7_${Date.now()}`;
      testRuleSet = await ruleSetService.createRuleSet(
        {
          name: 'Video Production Rule Set',
          code,
          description: 'Standard rules for video evaluation',
        },
        adminUser.id,
      );

      assert.ok(testRuleSet.id);
      assert.strictEqual(testRuleSet.code, code);

      const audit = await CompetitionAuditLog.findOne({
        where: { action: 'RULE_SET_CREATED', entityId: String(testRuleSet.id) },
      });
      assert.ok(audit, 'Audit log must exist for RULE_SET_CREATED');
    });

    it('Creates DRAFT version with normalized AST', async () => {
      const ast = [
        {
          name: 'Short Video',
          condition_ast: { op: 'EQ', field: 'event.payload.category', value: 'SHORT' },
          action_ast: { type: 'ADD', value: 50 },
          effect_type: 'INDIVIDUAL_XP',
        },
      ];

      testVersionDraft = await ruleSetService.createRuleSetVersion(
        testRuleSet.id,
        {
          versionNumber: 1,
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: new Date('2026-06-30'),
          astPayload: ast,
        },
        adminUser.id,
      );

      assert.strictEqual(testVersionDraft.status, 'DRAFT');
      assert.strictEqual(testVersionDraft.versionNumber, 1);
      assert.strictEqual(testVersionDraft.astPayload.length, 1);
    });

    it('Allows updating DRAFT versions', async () => {
      const updatedAst = [
        {
          name: 'Short Video Enhanced',
          condition_ast: { op: 'EQ', field: 'event.payload.category', value: 'SHORT' },
          action_ast: { type: 'ADD', value: 75 },
          effect_type: 'INDIVIDUAL_XP',
        },
      ];

      const updated = await ruleSetService.updateDraftVersion(
        testVersionDraft.id,
        { astPayload: updatedAst },
        adminUser.id,
      );

      assert.strictEqual(updated.astPayload[0].action_ast.value, 75);
    });

    it('Publishes DRAFT version and enforces immutability', async () => {
      testVersionPublished = await ruleSetService.publishRuleSetVersion(
        testVersionDraft.id,
        adminUser.id,
        'Initial release for season 2026',
      );

      assert.strictEqual(testVersionPublished.status, 'PUBLISHED');
      assert.ok(testVersionPublished.publishedAt);

      // Attempting to edit a published version must throw
      await assert.rejects(
        async () => {
          await ruleSetService.updateDraftVersion(
            testVersionPublished.id,
            { astPayload: [] },
            adminUser.id,
          );
        },
        /Cannot edit version in PUBLISHED status/,
      );
    });

    it('Rejects new version with overlapping effective window with published version', async () => {
      await assert.rejects(
        async () => {
          await ruleSetService.publishRuleSetVersion(
            (
              await ruleSetService.createRuleSetVersion(
                testRuleSet.id,
                {
                  versionNumber: 2,
                  effectiveFrom: new Date('2026-03-01'), // overlaps with Jan-Jun 2026
                  effectiveTo: new Date('2026-08-01'),
                  astPayload: testVersionPublished.astPayload,
                },
                adminUser.id,
              )
            ).id,
            adminUser.id,
          );
        },
        /Effective window overlaps with published version #1/,
      );
    });

    it('Duplicates version into next DRAFT with incremented versionNumber', async () => {
      const dup = await ruleSetService.duplicateRuleSetVersion(testVersionPublished.id, adminUser.id);
      assert.strictEqual(dup.status, 'DRAFT');
      assert.strictEqual(dup.versionNumber, 2); // 1 (pub) + 1 = 2
      assert.strictEqual(dup.astPayload.length, 1);
    });
  });

  describe('3. Rule Simulator (In-Memory Pure Evaluation)', () => {
    it('Simulates matching event and computes effects with 0 database writes', async () => {
      const scoreCountBefore = await ScoreLedger.count();
      const stateCountBefore = await CompetitionState.count();
      const grandCountBefore = await GrandPointsLedger.count();

      const astPayload = [
        {
          name: 'Video Quality Bonus',
          condition_ast: {
            op: 'AND',
            conditions: [
              { op: 'EQ', field: 'event.event_type', value: 'VIDEO_APPROVED' },
              { op: 'GTE', field: 'event.payload.duration', value: 60 },
            ],
          },
          action_ast: { type: 'ADD', value: 120 },
          effect_type: 'INDIVIDUAL_XP',
          multiplier: 1.5,
        },
      ];

      const simResult = await ruleSetService.simulateRule(
        {
          astPayload,
          eventPayload: {
            event_type: 'VIDEO_APPROVED',
            payload: { duration: 90 },
            actor_id: memberUser.id,
          },
        },
        adminUser.id,
      );

      assert.strictEqual(simResult.success, true);
      assert.strictEqual(simResult.matchedRulesCount, 1);
      assert.strictEqual(simResult.totalUserPoints, 180); // 120 * 1.5 = 180

      // STRICT ZERO MUTATION ASSERTION
      const scoreCountAfter = await ScoreLedger.count();
      const stateCountAfter = await CompetitionState.count();
      const grandCountAfter = await GrandPointsLedger.count();

      assert.strictEqual(scoreCountAfter, scoreCountBefore, 'ScoreLedger MUST remain untouched');
      assert.strictEqual(stateCountAfter, stateCountBefore, 'CompetitionState MUST remain untouched');
      assert.strictEqual(grandCountAfter, grandCountBefore, 'GrandPointsLedger MUST remain untouched');
    });

    it('Simulates non-matching event gracefully', async () => {
      const astPayload = [
        {
          name: 'High Duration Only',
          condition_ast: { op: 'GTE', field: 'event.payload.duration', value: 300 },
          action_ast: { type: 'ADD', value: 200 },
          effect_type: 'INDIVIDUAL_XP',
        },
      ];

      const simResult = await ruleSetService.simulateRule(
        {
          astPayload,
          eventPayload: { payload: { duration: 100 } },
        },
        adminUser.id,
      );

      assert.strictEqual(simResult.matchedRulesCount, 0);
      assert.strictEqual(simResult.totalUserPoints, 0);
    });
  });

  describe('4. Rule Diff Engine', () => {
    it('Accurately detects added, removed, and modified rules between two versions', () => {
      const versionA = {
        id: 'v1',
        versionNumber: 1,
        status: 'PUBLISHED',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-06-30',
        astPayload: [
          {
            name: 'Rule 1',
            condition_ast: { op: 'EQ', field: 'event.payload.type', value: 'A' },
            action_ast: { type: 'ADD', value: 100 },
            effect_type: 'INDIVIDUAL_XP',
          },
          {
            name: 'Rule 2 (To Delete)',
            condition_ast: null,
            action_ast: { type: 'ADD', value: 50 },
            effect_type: 'INDIVIDUAL_XP',
          },
        ],
      };

      const versionB = {
        id: 'v2',
        versionNumber: 2,
        status: 'DRAFT',
        effectiveFrom: '2026-07-01',
        effectiveTo: '2026-12-31',
        astPayload: [
          {
            name: 'Rule 1',
            condition_ast: { op: 'EQ', field: 'event.payload.type', value: 'A' },
            action_ast: { type: 'ADD', value: 150 }, // modified value
            effect_type: 'INDIVIDUAL_XP',
          },
          {
            name: 'Rule 3 (New)',
            condition_ast: { op: 'GTE', field: 'event.payload.count', value: 5 },
            action_ast: { type: 'ADD', value: 300 },
            effect_type: 'TEAM_SCORE',
          },
        ],
      };

      const diff = differ.diffRuleVersions(versionA, versionB);

      assert.strictEqual(diff.hasChanges, true);
      assert.strictEqual(diff.addedCount, 1);
      assert.strictEqual(diff.removedCount, 1);
      assert.strictEqual(diff.modifiedCount, 1);
      assert.strictEqual(diff.addedRules[0].name, 'Rule 3 (New)');
      assert.strictEqual(diff.removedRules[0].name, 'Rule 2 (To Delete)');
      assert.strictEqual(diff.modifiedRules[0].name, 'Rule 1');
    });
  });

  describe('5. RBAC & Security Gates', () => {
    it('Rejects unauthenticated access with 401', async () => {
      const res = await fetch(`${baseUrl}/api/competition/admin/rules`);
      assert.strictEqual(res.status, 401);
    });

    it('Rejects regular user access with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/competition/admin/rules`, {
        headers: { Authorization: `Bearer ${memberToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    it('Allows admin access with 200 OK', async () => {
      const res = await fetch(`${baseUrl}/api/competition/admin/rules`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.ruleSets));
    });

    it('Audits all Rule Set operations in CompetitionAuditLog', async () => {
      const logs = await CompetitionAuditLog.findAll({
        where: { entityType: { [sequelize.Sequelize.Op.in]: ['RULE_SET', 'RULE_SET_VERSION', 'RULE_SIMULATOR'] } },
      });
      assert.ok(logs.length >= 3, 'Must have logged rule set creation, version creation, publish, simulation');
    });
  });
});
