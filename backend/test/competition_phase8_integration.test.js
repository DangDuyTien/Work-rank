'use strict';

/**
 * competition_phase8_integration.test.js
 *
 * Comprehensive tests for WORKRANK V3.3 Phase 8 — Product Integration.
 *
 * Verifies:
 *   1. Event Contract Registry & Validation Layer
 *   2. Production Integration (Video, Script, Edit, QC, Publish)
 *   3. YouTube Integration Adapter (Views, Subscribers, Performance)
 *   4. Community Integration Adapter (Kudos, Posts, Challenges)
 *   5. Failure Handling, Decoupling & Idempotency
 *   6. Event Trace & Diagnostic Service (Admin vs Member RBAC)
 *   7. Admin Integration Health Monitor & Manual Retry with Audit Log
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const sequelize = require('../src/config/database');
const {
  User,
  Team,
  Season,
  RuleSet,
  RuleSetVersion,
  CompetitionEvent,
  ScoreLedger,
  CompetitionAuditLog,
  CompetitionActivityProjection,
} = require('../src/models');

const eventContractRegistry = require('../src/services/competition/eventContractRegistry.service');
const eventIngestionService = require('../src/services/competition/eventIngestion.service');
const productionIntegration = require('../src/services/competition/productionIntegration.service');
const youtubeIntegration = require('../src/services/competition/youtubeIntegration.service');
const communityIntegration = require('../src/services/competition/communityIntegration.service');
const competitionEventTrace = require('../src/services/competition/competitionEventTrace.service');
const competitionIntegrationMonitor = require('../src/services/competition/competitionIntegrationMonitor.service');
const competitionEngineWorker = require('../src/services/competition/competitionEngine.worker');

describe('Phase 8 — Product Integration & Event Tracing', () => {
  let adminUser, memberUser, otherMemberUser;
  let testTeam, otherTeam;
  let testSeason, testRuleSet, testRuleVersion;

  before(async () => {
    await sequelize.authenticate();

    // 1. Seed Teams
    [testTeam] = await Team.findOrCreate({
      where: { name: 'Integration Team Alpha' },
      defaults: { inviteCode: 'INT_ALPHA' },
    });
    [otherTeam] = await Team.findOrCreate({
      where: { name: 'Integration Team Beta' },
      defaults: { inviteCode: 'INT_BETA' },
    });

    // 2. Seed Users
    const rnd = Date.now();
    [adminUser] = await User.findOrCreate({
      where: { email: `admin_p8_${rnd}@workrank.io` },
      defaults: { name: 'Admin P8', role: 'admin', passwordHash: 'testpass', teamId: testTeam.id },
    });
    [memberUser] = await User.findOrCreate({
      where: { email: `member_p8_${rnd}@workrank.io` },
      defaults: { name: 'Member P8', role: 'user', passwordHash: 'testpass', teamId: testTeam.id },
    });
    [otherMemberUser] = await User.findOrCreate({
      where: { email: `other_p8_${rnd}@workrank.io` },
      defaults: { name: 'Other Member P8', role: 'user', passwordHash: 'testpass', teamId: otherTeam.id },
    });

    // 3. Seed Rule Set & Version for Product Events
    testRuleSet = await RuleSet.create({
      name: 'Product Integration Rules',
      code: `prod_int_rules_${rnd}`,
      description: 'Rules for production and youtube events',
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
          name: 'Video Approval XP',
          condition_ast: {
            op: 'EQ',
            field: 'event.event_type',
            value: 'VIDEO_APPROVED',
          },
          action_ast: {
            type: 'ADD',
            value: 100,
          },
          effect_type: 'INDIVIDUAL_XP',
        },
        {
          name: 'YouTube Milestone XP',
          condition_ast: {
            op: 'AND',
            conditions: [
              { op: 'EQ', field: 'event.event_type', value: 'VIDEO_VIEW_MILESTONE_REACHED' },
              { op: 'GTE', field: 'event.payload.views', value: 50000 },
            ],
          },
          action_ast: {
            type: 'ADD',
            value: 200,
          },
          effect_type: 'INDIVIDUAL_XP',
        },
        {
          name: 'Kudos Received XP',
          condition_ast: {
            op: 'EQ',
            field: 'event.event_type',
            value: 'KUDOS_RECEIVED',
          },
          action_ast: {
            type: 'ADD',
            value: 25,
          },
          effect_type: 'INDIVIDUAL_XP',
        },
      ],
    });

    // 4. Seed Season
    testSeason = await Season.create({
      name: `Season Product Integration ${rnd}`,
      slug: `season-prod-${rnd}`,
      status: 'ACTIVE',
      startAt: new Date('2026-01-01'),
      endAt: new Date('2026-12-31'),
      activeRuleSetId: testRuleSet.id,
      activeRuleVersionId: testRuleVersion.id,
      grandPointsDistribution: [100, 70, 50],
    });
  });

  describe('1. Event Contract Registry & Validation Layer', () => {
    it('Validates and normalizes valid production event', () => {
      const result = eventContractRegistry.validateDomainEvent({
        contractKey: 'production.video.approved',
        actorId: memberUser.id,
        teamId: testTeam.id,
        payload: {
          videoId: 501,
          title: 'Cinematic Teaser',
          duration: 120,
        },
      });

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.normalized.eventType, 'VIDEO_APPROVED');
      assert.strictEqual(result.normalized.sourceModule, 'production');
      assert.strictEqual(result.normalized.schemaVersion, 1);
    });

    it('Rejects event with unsupported schema version', () => {
      const result = eventContractRegistry.validateDomainEvent({
        contractKey: 'production.video.approved',
        schemaVersion: 99,
        actorId: memberUser.id,
        payload: { videoId: 501 },
      });

      assert.strictEqual(result.valid, false);
      assert.match(result.errors[0], /Unsupported schema_version '99'/);
    });

    it('Rejects event missing required contract fields', () => {
      const result = eventContractRegistry.validateDomainEvent({
        contractKey: 'production.video.published',
        actorId: memberUser.id,
        payload: { videoId: 501 }, // missing 'url'
      });

      assert.strictEqual(result.valid, false);
      assert.match(result.errors[0], /missing required field 'url'/);
    });

    it('Rejects event without entity context (missing actorId and teamId)', () => {
      const result = eventContractRegistry.validateDomainEvent({
        contractKey: 'production.video.approved',
        payload: { videoId: 501 },
      });

      assert.strictEqual(result.valid, false);
      assert.match(result.errors[0], /must specify at least an actorId or a teamId/);
    });

    it('Generates deterministic SHA-256 idempotency key when not provided', () => {
      const payload = { videoId: 999, title: 'Sample' };
      const res1 = eventContractRegistry.validateDomainEvent({
        contractKey: 'production.video.approved',
        actorId: memberUser.id,
        payload,
      });
      const res2 = eventContractRegistry.validateDomainEvent({
        contractKey: 'production.video.approved',
        actorId: memberUser.id,
        payload,
      });

      assert.strictEqual(res1.normalized.idempotencyKey, res2.normalized.idempotencyKey);
      assert.strictEqual(typeof res1.normalized.idempotencyKey, 'string');
      assert.strictEqual(res1.normalized.idempotencyKey.length, 64);
    });
  });

  describe('2. Production Workflow Integration', () => {
    it('Emits VIDEO_APPROVED and evaluates scoring through competition worker', async () => {
      const videoId = Math.floor(Math.random() * 1000000) + 10000;
      const pubRes = await productionIntegration.recordVideoApproved({
        videoId,
        title: 'Documentary Cut',
        actorId: memberUser.id,
        teamId: testTeam.id,
        seasonId: testSeason.id,
      });

      assert.strictEqual(pubRes.success, true);
      assert.strictEqual(pubRes.isDuplicate, false);
      assert.ok(pubRes.eventId);

      // Verify event stored in PENDING status
      const event = await CompetitionEvent.findByPk(pubRes.eventId);
      assert.strictEqual(event.status, 'PENDING');
      assert.strictEqual(event.sourceModule, 'production');

      // Process batch
      const processedCount = await competitionEngineWorker.processBatch();
      assert.ok(processedCount >= 1);

      // Verify event transitioned to PROCESSED
      await event.reload();
      assert.strictEqual(event.status, 'PROCESSED');

      // Verify ScoreLedger entry created (+100 XP)
      const ledgerEntry = await ScoreLedger.findOne({
        where: { eventId: pubRes.eventId },
      });
      assert.ok(ledgerEntry);
      assert.strictEqual(ledgerEntry.pointsDelta, 100);
      assert.strictEqual(ledgerEntry.effectType, 'INDIVIDUAL_XP');
      assert.strictEqual(Number(ledgerEntry.userId), Number(memberUser.id));
    });

    it('Emits SCRIPT_APPROVED, EDIT_APPROVED, and VIDEO_QC_PASSED properly', async () => {
      const scriptId = Math.floor(Math.random() * 1000000) + 20000;
      const editId = Math.floor(Math.random() * 1000000) + 30000;
      const qcVideoId = Math.floor(Math.random() * 1000000) + 40000;

      const res1 = await productionIntegration.recordScriptApproved({
        scriptId,
        title: 'Script Episode 1',
        reviewerId: adminUser.id,
        actorId: memberUser.id,
        teamId: testTeam.id,
        seasonId: testSeason.id,
      });
      assert.strictEqual(res1.success, true);

      const res2 = await productionIntegration.recordEditApproved({
        editId,
        videoId: qcVideoId,
        cutVersion: 2,
        reviewerId: adminUser.id,
        actorId: memberUser.id,
        teamId: testTeam.id,
        seasonId: testSeason.id,
      });
      assert.strictEqual(res2.success, true);

      const res3 = await productionIntegration.recordQCPassed({
        videoId: qcVideoId,
        score: 98,
        actorId: memberUser.id,
        teamId: testTeam.id,
        seasonId: testSeason.id,
      });
      assert.strictEqual(res3.success, true);
    });
  });

  describe('3. YouTube Integration Adapter', () => {
    it('Emits VIDEO_VIEW_MILESTONE_REACHED and evaluates +200 XP rule', async () => {
      const ytVideoId = `yt_view_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const channelId = `channel_yt_${Date.now()}`;

      const ytRes = await youtubeIntegration.recordViewMilestone({
        youtubeVideoId: ytVideoId,
        channelId,
        title: 'Viral Tech Review',
        views: 75000,
        actorId: memberUser.id,
        teamId: testTeam.id,
        seasonId: testSeason.id,
      });

      assert.strictEqual(ytRes.success, true);
      assert.ok(ytRes.eventId);

      // Process via worker
      await competitionEngineWorker.processBatch();

      // Verify ScoreLedger entry created (+200 XP)
      const ledgerEntry = await ScoreLedger.findOne({
        where: { eventId: ytRes.eventId },
      });
      assert.ok(ledgerEntry);
      assert.strictEqual(ledgerEntry.pointsDelta, 200);
      assert.strictEqual(ledgerEntry.effectType, 'INDIVIDUAL_XP');
    });

    it('Emits SUBSCRIBER_MILESTONE_REACHED and PERFORMANCE_MILESTONE', async () => {
      const channelId = `channel_yt_sub_${Date.now()}`;
      const perfYtId = `yt_perf_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      const subRes = await youtubeIntegration.recordSubscriberMilestone({
        channelId,
        channelTitle: 'Tech Channel',
        subscribers: 100000,
        actorId: memberUser.id,
        teamId: testTeam.id,
        seasonId: testSeason.id,
      });
      assert.strictEqual(subRes.success, true);

      const perfRes = await youtubeIntegration.recordPerformanceMilestone({
        youtubeVideoId: perfYtId,
        metricName: 'average_percentage_viewed',
        metricValue: 78,
        actorId: memberUser.id,
        teamId: testTeam.id,
        seasonId: testSeason.id,
      });
      assert.strictEqual(perfRes.success, true);
    });
  });

  describe('4. Community Integration Adapter', () => {
    it('Emits KUDOS_SENT for sender and KUDOS_RECEIVED for recipient', async () => {
      const kudosId = Math.floor(Math.random() * 1000000) + 50000;
      const kudosRes = await communityIntegration.recordKudosSent({
        kudosId,
        senderId: memberUser.id,
        recipientId: otherMemberUser.id,
        senderTeamId: testTeam.id,
        recipientTeamId: otherTeam.id,
        reason: 'Outstanding collaboration during live release!',
        seasonId: testSeason.id,
      });

      assert.strictEqual(kudosRes.sentResult.success, true);
      assert.strictEqual(kudosRes.receivedResult.success, true);

      // Process worker
      await competitionEngineWorker.processBatch();

      // Verify recipient received +25 XP from rule
      const recvLedger = await ScoreLedger.findOne({
        where: { eventId: kudosRes.receivedResult.eventId },
      });
      assert.ok(recvLedger);
      assert.strictEqual(recvLedger.pointsDelta, 25);
      assert.strictEqual(Number(recvLedger.userId), Number(otherMemberUser.id));
    });

    it('Emits TEAM_POST_CREATED and CHALLENGE_COMPLETED', async () => {
      const postId = Math.floor(Math.random() * 1000000) + 60000;
      const challengeId = Math.floor(Math.random() * 1000000) + 70000;

      const postRes = await communityIntegration.recordTeamPost({
        postId,
        topic: 'Engineering Post-Mortem',
        contentLength: 1500,
        actorId: memberUser.id,
        teamId: testTeam.id,
        seasonId: testSeason.id,
      });
      assert.strictEqual(postRes.success, true);

      const challRes = await communityIntegration.recordChallengeCompleted({
        challengeId,
        challengeName: 'First 5 Videos of the Month',
        actorId: memberUser.id,
        teamId: testTeam.id,
        seasonId: testSeason.id,
        scoreReward: 50,
      });
      assert.strictEqual(challRes.success, true);
    });
  });

  describe('5. Failure Handling, Decoupling & Idempotency', () => {
    it('Product action succeeds and records event when scoring worker is stopped', async () => {
      const offlineVideoId = Math.floor(Math.random() * 1000000) + 80000;
      // Worker is not running in loop; product event emits normally
      const res = await productionIntegration.recordVideoApproved({
        videoId: offlineVideoId,
        title: 'Offline Worker Test',
        actorId: memberUser.id,
        teamId: testTeam.id,
        seasonId: testSeason.id,
      });

      assert.strictEqual(res.success, true);
      assert.ok(res.eventId);

      const ev = await CompetitionEvent.findByPk(res.eventId);
      assert.strictEqual(ev.status, 'PENDING');
    });

    it('Retrying exact duplicate product event is 100% idempotent', async () => {
      const dupVideoId = Math.floor(Math.random() * 1000000) + 90000;
      const dupKey = `idemp_test_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      const res1 = await productionIntegration.recordVideoApproved({
        videoId: dupVideoId,
        title: 'Idempotency Test Video',
        actorId: memberUser.id,
        teamId: testTeam.id,
        seasonId: testSeason.id,
        idempotencyKey: dupKey,
      });
      assert.strictEqual(res1.isDuplicate, false);

      const res2 = await productionIntegration.recordVideoApproved({
        videoId: dupVideoId,
        title: 'Idempotency Test Video',
        actorId: memberUser.id,
        teamId: testTeam.id,
        seasonId: testSeason.id,
        idempotencyKey: dupKey,
      });
      assert.strictEqual(res2.isDuplicate, true);
      assert.strictEqual(res1.eventId, res2.eventId);

      // Score count verify
      const countBefore = await ScoreLedger.count({ where: { eventId: res1.eventId } });
      await competitionEngineWorker.processBatch();
      const countAfter = await ScoreLedger.count({ where: { eventId: res1.eventId } });
      assert.strictEqual(countAfter, 1);
    });

    it('Rejects malformed event at ingestion gateway without polluting Event Store', async () => {
      const initialCount = await CompetitionEvent.count();

      await assert.rejects(
        () => eventIngestionService.publishEvent({
          contractKey: 'production.video.approved',
          payload: null, // invalid
        }),
        /Domain Event validation failed/,
      );

      const afterCount = await CompetitionEvent.count();
      assert.strictEqual(initialCount, afterCount);
    });
  });

  describe('6. Event Trace & Audit Diagnostics', () => {
    let tracedEventId;

    before(async () => {
      const traceVideoId = Math.floor(Math.random() * 1000000) + 100000;
      const res = await productionIntegration.recordVideoApproved({
        videoId: traceVideoId,
        title: 'Traced Feature Film',
        actorId: memberUser.id,
        teamId: testTeam.id,
        seasonId: testSeason.id,
      });
      tracedEventId = res.eventId;
      await competitionEngineWorker.processBatch();
    });

    it('Returns full chronological trace for Admin user', async () => {
      const trace = await competitionEventTrace.getEventTrace(tracedEventId, adminUser);

      assert.strictEqual(trace.eventId, tracedEventId);
      assert.strictEqual(trace.eventType, 'VIDEO_APPROVED');
      assert.strictEqual(trace.sourceModule, 'production');
      assert.strictEqual(trace.processing.status, 'PROCESSED');
      assert.strictEqual(trace.ruleEvaluation.matched, true);
      assert.strictEqual(trace.ruleEvaluation.totalPointsAwarded, 100);
      assert.strictEqual(trace.ledgerEntries.length, 1);
      assert.strictEqual(trace.ledgerEntries[0].delta, 100);
    });

    it('Returns sanitized trace for Member user viewing own event', async () => {
      const trace = await competitionEventTrace.getEventTrace(tracedEventId, memberUser);

      assert.strictEqual(trace.eventId, tracedEventId);
      assert.strictEqual(Number(trace.actor.id), Number(memberUser.id));
      assert.strictEqual(trace.ruleEvaluation.totalPointsAwarded, 100);
    });

    it('Rejects Member user attempting to trace cross-team event with 403 Forbidden', async () => {
      await assert.rejects(
        () => competitionEventTrace.getEventTrace(tracedEventId, otherMemberUser),
        (err) => err.status === 403,
      );
    });
  });

  describe('7. Admin Integration Health Monitor & Manual Retry', () => {
    let failedEventId;

    before(async () => {
      // Create an intentionally failed event
      const failedEv = await CompetitionEvent.create({
        idempotencyKey: `failed_ev_${Date.now()}`,
        eventType: 'VIDEO_APPROVED',
        sourceModule: 'production',
        actorId: memberUser.id,
        teamId: testTeam.id,
        occurredAt: new Date(),
        receivedAt: new Date(),
        payload: { videoId: 9999 },
        schemaVersion: 1,
        status: 'FAILED',
        failedAt: new Date(),
        attemptCount: 3,
        lastError: 'Simulated DSL evaluator exception',
      });
      failedEventId = failedEv.eventId;
    });

    it('getIntegrationHealth returns health summary and module breakdown', async () => {
      const health = await competitionIntegrationMonitor.getIntegrationHealth();

      assert.ok(health.summary.totalEvents >= 1);
      assert.ok(health.summary.processedCount >= 1);
      assert.ok(health.bySourceModule.production >= 1);
      assert.ok(Array.isArray(health.recentFailures));
    });

    it('retryFailedEvent resets status to PENDING and logs CompetitionAuditLog', async () => {
      const reason = 'Manual retry after fixing rule condition in Phase 8';
      const retryRes = await competitionIntegrationMonitor.retryFailedEvent(failedEventId, adminUser.id, reason);

      assert.strictEqual(retryRes.success, true);
      assert.strictEqual(retryRes.status, 'PENDING');

      // Verify event reset
      const ev = await CompetitionEvent.findByPk(failedEventId);
      assert.strictEqual(ev.status, 'PENDING');
      assert.strictEqual(ev.lastError, null);

      // Verify audit log
      const audit = await CompetitionAuditLog.findOne({
        where: {
          entityId: failedEventId,
          action: 'EVENT_MANUAL_RETRY',
        },
      });
      assert.ok(audit);
      assert.strictEqual(audit.reason, reason);
      assert.strictEqual(Number(audit.actorId), Number(adminUser.id));
    });

    it('Rejects manual retry without reason', async () => {
      await assert.rejects(
        () => competitionIntegrationMonitor.retryFailedEvent(failedEventId, adminUser.id, ''),
        /Retry reason is required/,
      );
    });
  });
});
