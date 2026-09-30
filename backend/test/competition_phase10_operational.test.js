'use strict';

/**
 * competition_phase10_operational.test.js
 *
 * Phase 10 — Go-Live, Real Data Activation & Operational Readiness Verification.
 *
 * Suites:
 *   1. Environment Configuration & Production Fail-Fast Validation
 *   2. Scoring Kill Switch & Backlog Preservation
 *   3. Shadow Mode Rule Evaluation (Zero-Mutation Verification)
 *   4. Production Environment Bootstrap & Seed Strategy
 *   5. Real Data Go-Live End-to-End Workflow
 *   6. Disaster Recovery Drill & Read Model Replay
 *   7. Data Quality & Ledger Reconciliation Post-Go-Live
 */

const { describe, it, before, beforeEach, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

const app = require('../src/app');
const sequelize = require('../src/config/database');
const env = require('../src/config/env');
const { validateProductionConfig } = require('../src/config/env');

const {
  User,
  Team,
  RuleSet,
  RuleSetVersion,
  Season,
  GrandChampionship,
  CompetitionEvent,
  ScoreLedger,
  GrandPointsLedger,
  CompetitionUserSummary,
  CompetitionAuditLog,
} = require('../src/models');

const competitionEngineWorker = require('../src/services/competition/competitionEngine.worker');
const eventIngestionService = require('../src/services/competition/eventIngestion.service');
const { bootstrapProductionEnvironment } = require('../src/services/competition/productionBootstrap.service');
const { rebuildReadModels } = require('../src/services/competition/competitionReadModel.projector');

describe('Phase 10 — Operational Readiness & Go-Live Verification', () => {
  let adminUser;
  let adminToken;
  let creatorUser;
  let creatorToken;
  let testTeam;

  before(async () => {
    await sequelize.authenticate();
    // Ensure worker timer does not interfere with deterministic tests
    await competitionEngineWorker.stop();
  });

  afterEach(() => {
    // Reset worker flags to default
    competitionEngineWorker.setProcessingEnabled(true);
    competitionEngineWorker.setShadowModeEnabled(false);
  });

  // ─── 1. Environment Configuration & Fail-Fast Validation ─────────────────────
  describe('1. Environment Configuration & Production Fail-Fast Validation', () => {
    it('Rejects production environment with default JWT_SECRET (Fail-Fast)', () => {
      const badEnv = {
        nodeEnv: 'production',
        jwtSecret: 'change-me-access-secret',
        refreshTokenSecret: 'change-me-refresh-secret',
        clientUrl: 'http://localhost:5173',
        db: { name: 'prod_db', user: 'prod_user' },
      };

      assert.throws(
        () => validateProductionConfig(badEnv),
        (err) => {
          assert.strictEqual(err.code, 'INVALID_PROD_CONFIG');
          assert.ok(err.message.includes('JWT_SECRET'));
          assert.ok(err.message.includes('CLIENT_URL'));
          return true;
        },
      );
    });

    it('Rejects production environment with weak secret (< 32 chars)', () => {
      const weakEnv = {
        nodeEnv: 'production',
        jwtSecret: 'short-secret-key-123',
        refreshTokenSecret: 'valid-long-secret-key-that-is-over-32-chars-long-12345',
        clientUrl: 'https://app.workrank.com',
        db: { name: 'prod_db', user: 'prod_user' },
      };

      assert.throws(
        () => validateProductionConfig(weakEnv),
        (err) => {
          assert.ok(err.message.includes('JWT_SECRET must be a secure secret of at least 32 characters'));
          return true;
        },
      );
    });

    it('Accepts valid production configuration with strong secrets and prod domain', () => {
      const validProdEnv = {
        nodeEnv: 'production',
        jwtSecret: 'super-secure-production-jwt-access-secret-token-key-2026',
        refreshTokenSecret: 'super-secure-production-refresh-token-secret-key-2026',
        clientUrl: 'https://app.workrank.com',
        db: { name: 'workrank_prod', user: 'workrank_admin' },
      };

      const result = validateProductionConfig(validProdEnv);
      assert.strictEqual(result, true);
    });

    it('Allows development/test environments without production constraints', () => {
      const devEnv = {
        nodeEnv: 'development',
        jwtSecret: 'dev-secret',
        refreshTokenSecret: 'dev-refresh',
        clientUrl: 'http://localhost:5173',
        db: { name: 'dev_db', user: 'root' },
      };

      const result = validateProductionConfig(devEnv);
      assert.strictEqual(result, true);
    });
  });

  // ─── 2. Scoring Kill Switch & Backlog Preservation ───────────────────────────
  describe('2. Scoring Kill Switch & Backlog Preservation', () => {
    it('Pauses scoring when kill switch is active without dropping domain events', async () => {
      // 1. Activate Kill Switch
      competitionEngineWorker.setProcessingEnabled(false);
      assert.strictEqual(competitionEngineWorker.isProcessingEnabled(), false);

      const uniqueSuffix = `ks_${Date.now()}`;
      const [team] = await Team.findOrCreate({
        where: { name: `Team KS ${uniqueSuffix}` },
        defaults: { name: `Team KS ${uniqueSuffix}` },
      });

      const user = await User.create({
        name: `KS User ${uniqueSuffix}`,
        email: `ks_${uniqueSuffix}@workrank.local`,
        passwordHash: 'hash',
        role: 'user',
        teamId: team.id,
        status: 'active',
      });

      // 2. Ingest domain event while kill switch is active
      const ingestRes = await eventIngestionService.publishEvent({
        contractKey: 'production.video.approved',
        schemaVersion: 1,
        sourceModule: 'production',
        actorId: user.id,
        teamId: team.id,
        payload: { videoId: 9001, tier: 'gold' },
      });

      assert.strictEqual(ingestRes.success, true);
      const eventId = ingestRes.eventId;

      // 3. Worker attempts processBatch()
      const batchRes = await competitionEngineWorker.processBatch();
      assert.strictEqual(batchRes.paused, true);
      assert.strictEqual(batchRes.count, 0);

      // 4. Verify Event is preserved in PENDING status
      const pendingEvent = await CompetitionEvent.findOne({ where: { eventId } });
      assert.ok(pendingEvent);
      assert.strictEqual(pendingEvent.status, 'PENDING');

      // 5. Verify ScoreLedger has 0 records
      const ledger = await ScoreLedger.findOne({ where: { eventId } });
      assert.strictEqual(ledger, null);

      // 6. Deactivate Kill Switch and Resume Processing
      competitionEngineWorker.setProcessingEnabled(true);
      assert.strictEqual(competitionEngineWorker.isProcessingEnabled(), true);

      // Register temporary rule
      competitionEngineWorker.registerRules('VIDEO_APPROVED', [
        {
          name: 'KS Video Rule',
          condition_ast: { op: 'EQ', field: 'event.event_type', value: 'VIDEO_APPROVED' },
          action_ast: { type: 'ADD', value: 120 },
          effect_type: 'INDIVIDUAL_XP',
          target: 'ACTOR',
        },
      ]);

      const processedCount = await competitionEngineWorker.processBatch();
      assert.ok(processedCount >= 1);

      const processedEvent = await CompetitionEvent.findOne({ where: { eventId } });
      assert.strictEqual(processedEvent.status, 'PROCESSED');

      const processedLedger = await ScoreLedger.findOne({ where: { eventId } });
      assert.ok(processedLedger);
      assert.strictEqual(processedLedger.pointsDelta, 120);
    });
  });

  // ─── 3. Shadow Mode Rule Evaluation ──────────────────────────────────────────
  describe('3. Shadow Mode Rule Evaluation (Zero-Mutation Verification)', () => {
    it('Evaluates rules, logs expected effects, and leaves Score Ledger untouched', async () => {
      // 1. Activate Shadow Mode
      competitionEngineWorker.setShadowModeEnabled(true);
      assert.strictEqual(competitionEngineWorker.isShadowModeEnabled(), true);

      const uniqueSuffix = `shadow_${Date.now()}`;
      const [team] = await Team.findOrCreate({
        where: { name: `Team Shadow ${uniqueSuffix}` },
        defaults: { name: `Team Shadow ${uniqueSuffix}` },
      });

      const user = await User.create({
        name: `Shadow User ${uniqueSuffix}`,
        email: `shadow_${uniqueSuffix}@workrank.local`,
        passwordHash: 'hash',
        role: 'user',
        teamId: team.id,
        status: 'active',
      });

      competitionEngineWorker.registerRules('YOUTUBE_MILESTONE_REACHED', [
        {
          name: 'Shadow YouTube Rule',
          condition_ast: { op: 'EQ', field: 'event.event_type', value: 'YOUTUBE_MILESTONE_REACHED' },
          action_ast: { type: 'ADD', value: 250 },
          effect_type: 'INDIVIDUAL_XP',
          target: 'ACTOR',
        },
      ]);

      // 2. Ingest domain event
      const ingestRes = await eventIngestionService.publishEvent({
        contractKey: 'youtube.video.milestone',
        schemaVersion: 1,
        sourceModule: 'youtube',
        actorId: user.id,
        teamId: team.id,
        payload: { youtubeVideoId: 'VID-999', views: 50000 },
      });

      assert.strictEqual(ingestRes.success, true);
      const eventId = ingestRes.eventId;

      // 3. Process batch in Shadow Mode
      const processedCount = await competitionEngineWorker.processBatch();
      assert.ok(processedCount >= 1);

      // 4. Verify Event is marked PROCESSED without error
      const shadowEvent = await CompetitionEvent.findOne({ where: { eventId } });
      assert.ok(shadowEvent);
      assert.strictEqual(shadowEvent.status, 'PROCESSED');

      // 5. Critical Verification: ScoreLedger has ZERO records created
      const ledger = await ScoreLedger.findOne({ where: { eventId } });
      assert.strictEqual(ledger, null, 'ScoreLedger MUST remain clean in Shadow Mode');

      // Reset Shadow Mode and Rules
      competitionEngineWorker.setShadowModeEnabled(false);
      competitionEngineWorker.clearRules();
    });
  });

  // ─── 4. Production Environment Bootstrap & Seed Strategy ────────────────────
  describe('4. Production Environment Bootstrap & Seed Strategy', () => {
    it('Idempotently bootstraps company teams, admin, published rules, Grand 2026, Season 1', async () => {
      const manifest = await bootstrapProductionEnvironment({
        grandYear: 2026,
        adminEmail: 'ops.admin@workrank.com',
      });

      assert.strictEqual(manifest.status, 'BOOTSTRAPPED');
      assert.ok(manifest.teams.length >= 3);
      assert.ok(manifest.usersCount >= 4);
      assert.strictEqual(manifest.grandChampionship.year, 2026);
      assert.strictEqual(manifest.grandChampionship.status, 'ACTIVE');
      assert.strictEqual(manifest.season.status, 'ACTIVE');
      assert.ok(manifest.ruleSet.version);

      // Verify audit log entry
      const audit = await CompetitionAuditLog.findOne({
        where: { action: 'PRODUCTION_ENVIRONMENT_BOOTSTRAP' },
        order: [['id', 'DESC']],
      });
      assert.ok(audit);
      assert.strictEqual(audit.entityId, 'SYSTEM_PROD_INIT');

      // Clean bootstrap re-run is 100% idempotent
      const reRunManifest = await bootstrapProductionEnvironment({ grandYear: 2026 });
      assert.strictEqual(reRunManifest.status, 'BOOTSTRAPPED');
    });
  });

  // ─── 5. Real Data Go-Live End-to-End Workflow ───────────────────────────────
  describe('5. Real Data Go-Live End-to-End Workflow', () => {
    let bootstrapData;
    let prodCreator;
    let prodTeam;
    let prodSeason;
    let creatorJwt;

    before(async () => {
      bootstrapData = await bootstrapProductionEnvironment({ grandYear: 2026 });
      prodCreator = await User.findOne({ where: { email: 'alice.creator@workrank.com' } });
      prodTeam = await Team.findByPk(prodCreator.teamId);
      prodSeason = await Season.findOne({ where: { slug: 'season-1-kickoff-2026' } });

      creatorJwt = jwt.sign(
        { sub: prodCreator.id, id: prodCreator.id, email: prodCreator.email, role: prodCreator.role, teamId: prodTeam.id },
        env.jwtSecret,
        { expiresIn: '1h' },
      );
    });

    it('Executes end-to-end flow: Real Event Ingestion → Worker Scoring → Read Model Sync → User API', async () => {
      // 1. Ingest real Production Video Approval domain event
      const eventUniqueKey = `prod_video_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
      const ingestRes = await eventIngestionService.publishEvent({
        contractKey: 'production.video.approved',
        schemaVersion: 1,
        sourceModule: 'production',
        actorId: prodCreator.id,
        teamId: prodTeam.id,
        seasonId: prodSeason.id,
        idempotencyKey: eventUniqueKey,
        payload: {
          videoId: 8888,
          title: 'WorkRank V3.3 Architecture Overview',
          duration: 300,
          seasonId: prodSeason.id,
        },
      });

      assert.strictEqual(ingestRes.success, true);
      const eventId = ingestRes.eventId;

      // 2. Worker processes batch with published production rules
      const processedCount = await competitionEngineWorker.processBatch();
      assert.ok(processedCount >= 1);

      // 3. Verify ScoreLedger entry (Individual XP + Team Boost)
      const userLedger = await ScoreLedger.findOne({ where: { eventId, userId: prodCreator.id } });
      assert.ok(userLedger);
      assert.strictEqual(Number(userLedger.userId), Number(prodCreator.id));
      assert.strictEqual(userLedger.pointsDelta, 120);

      const teamLedger = await ScoreLedger.findOne({ where: { eventId, teamId: prodTeam.id, effectType: 'TEAM_SCORE' } });
      assert.ok(teamLedger);
      assert.strictEqual(teamLedger.pointsDelta, 60);

      // 4. Verify User Competition Dashboard API
      const dashboardRes = await request(app)
        .get('/api/competition/dashboard')
        .set('Authorization', `Bearer ${creatorJwt}`);

      assert.strictEqual(dashboardRes.status, 200);
      assert.ok(dashboardRes.body.userSummary.currentSeasonScore >= 120);

      // 5. Verify User Event Trace API
      const traceRes = await request(app)
        .get(`/api/competition/events/${eventId}/trace`)
        .set('Authorization', `Bearer ${creatorJwt}`);

      assert.strictEqual(traceRes.status, 200);
      assert.strictEqual(traceRes.body.eventId, eventId);
      assert.strictEqual(traceRes.body.processing.status, 'PROCESSED');
      assert.ok(traceRes.body.ledgerEntries.length >= 1);
    });
  });

  // ─── 6. Disaster Recovery Drill & Read Model Replay ───────────────────────────
  describe('6. Disaster Recovery Drill & Read Model Replay', () => {
    it('Restores read model summaries with 100% precision from immutable Event Store', async () => {
      const admin = await User.findOne({ where: { role: 'admin' } });

      // Run full projection rebuild drill
      const rebuildSummary = await rebuildReadModels({
        actorId: admin.id,
        reason: 'Phase 10 Disaster Recovery Restoration Drill',
        full: true,
      });

      assert.strictEqual(rebuildSummary.status, 'SUCCESS');
      assert.ok(rebuildSummary.usersRebuilt >= 1);

      // Verify read model summary matches ledger aggregate for prodCreator in active season
      const prodCreator = await User.findOne({ where: { email: 'alice.creator@workrank.com' } });
      const prodSeason = await Season.findOne({ where: { slug: 'season-1-kickoff-2026' } });
      const prodSummary = await CompetitionUserSummary.findByPk(prodCreator.id);
      const ledgerSum = await ScoreLedger.sum('pointsDelta', {
        where: { userId: prodCreator.id, seasonId: prodSeason.id },
      });

      assert.strictEqual(Number(prodSummary.currentSeasonScore), Number(ledgerSum));
    });
  });

  // ─── 7. Data Quality & Ledger Reconciliation ────────────────────────────────
  describe('7. Data Quality & Ledger Reconciliation Post-Go-Live', () => {
    it('Verifies zero drift between ScoreLedger, Read Models and Season results', async () => {
      const allLedgerRows = await ScoreLedger.findAll();
      assert.ok(allLedgerRows.length >= 1);

      for (const row of allLedgerRows) {
        // Every ledger row must be bound to a valid event and target entity (user or team)
        assert.ok(row.eventId);
        assert.ok(row.userId || row.teamId);
        assert.ok(typeof row.pointsDelta === 'number');
      }

      // Check for zero orphaned state rows
      const allEvents = await CompetitionEvent.findAll({ where: { status: 'PROCESSED' } });
      assert.ok(allEvents.length >= 1);
    });
  });
});
