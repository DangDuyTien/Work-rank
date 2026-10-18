'use strict';

/**
 * competition_worker_runtime.test.js
 *
 * Runtime lifecycle, idempotency, quarantine, and health monitoring tests for BUG-004.
 * Verifies:
 *   1. Event processed once -> exactly one effect row in score_ledger
 *   2. Replay / restart -> no duplicate effect (idempotency preserved)
 *   3. Backlog quarantine -> poison/forged events quarantined to IGNORED
 *   4. Health monitor -> reports DEGRADED when worker stopped and pending events age past threshold
 *   5. Health monitor -> reports HEALTHY when workers running and 0 pending events
 *   6. Worker lifecycle -> in-flight tracking and graceful shutdown
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

require('dotenv').config();

const sequelize = require('../src/config/database');
const { CompetitionEvent, EventOutbox, ScoreLedger } = require('../src/models');
const competitionEngineWorker = require('../src/services/competition/competitionEngine.worker');
const outboxDispatcherWorker = require('../src/workers/outboxDispatcher.worker');
const competitionIntegrationMonitor = require('../src/services/competition/competitionIntegrationMonitor.service');
const outboxService = require('../src/services/competition/outbox.service');

async function cleanTables() {
  await ScoreLedger.destroy({ where: {} }).catch(() => {});
  await CompetitionEvent.destroy({ where: {} }).catch(() => {});
  await EventOutbox.destroy({ where: {} }).catch(() => {});
}

describe('BUG-004: Competition Worker Runtime & Lifecycle', () => {
  before(async () => {
    await sequelize.authenticate();
    competitionEngineWorker.clearRules();
    // Register standard test rule for VIDEO_APPROVED
    competitionEngineWorker.registerRules('VIDEO_APPROVED', [
      {
        condition_ast: null,
        action_ast: { type: 'ADD', value: 100 },
        effect_type: 'INDIVIDUAL_XP',
      },
    ]);
  });

  after(async () => {
    await competitionEngineWorker.stop();
    await outboxDispatcherWorker.stop();
    competitionEngineWorker.clearRules();
  });

  beforeEach(async () => {
    await cleanTables();
  });

  it('1. Event processed once -> exactly one effect row in score_ledger', async () => {
    const eventId = crypto.randomUUID();
    const actorId = 42;

    await CompetitionEvent.create({
      eventId,
      idempotencyKey: `idemp-${eventId}`,
      eventType: 'VIDEO_APPROVED',
      sourceModule: 'production',
      aggregateType: 'Video',
      aggregateId: 101,
      actorId,
      teamId: 1,
      occurredAt: new Date(),
      receivedAt: new Date(),
      payload: { videoId: 101 },
      status: 'PENDING',
    });

    const processed = await competitionEngineWorker.processBatch();
    assert.equal(processed, 1, 'Should process exactly 1 event');

    const updatedEvent = await CompetitionEvent.findByPk(eventId);
    assert.equal(updatedEvent.status, 'PROCESSED');
    assert.ok(updatedEvent.processedAt);

    const ledgers = await ScoreLedger.findAll({ where: { eventId } });
    assert.equal(ledgers.length, 1, 'Should insert exactly one ledger effect');
    assert.equal(ledgers[0].userId, actorId);
    assert.equal(ledgers[0].pointsDelta, 100);
    assert.equal(ledgers[0].effectType, 'INDIVIDUAL_XP');
  });

  it('2. Worker restart / replay -> no duplicate effect (idempotency preserved)', async () => {
    const eventId = crypto.randomUUID();
    const actorId = 43;

    await CompetitionEvent.create({
      eventId,
      idempotencyKey: `idemp-${eventId}`,
      eventType: 'VIDEO_APPROVED',
      sourceModule: 'production',
      aggregateType: 'Video',
      aggregateId: 102,
      actorId,
      teamId: 1,
      occurredAt: new Date(),
      receivedAt: new Date(),
      payload: { videoId: 102 },
      status: 'PENDING',
    });

    // First process
    await competitionEngineWorker.processBatch();
    let ledgers = await ScoreLedger.findAll({ where: { eventId } });
    assert.equal(ledgers.length, 1);

    // Calling processBatch again finds 0 PENDING events
    const secondPass = await competitionEngineWorker.processBatch();
    assert.equal(secondPass, 0, 'No pending events to process');

    // Simulate replay/duplicate delivery by resetting status to PENDING
    await CompetitionEvent.update({ status: 'PENDING', processedAt: null }, { where: { eventId } });
    await competitionEngineWorker.processBatch();
    ledgers = await ScoreLedger.findAll({ where: { eventId } });
    assert.equal(ledgers.length, 1, 'No duplicate ledger entry allowed on replay');
  });

  it('3. Outbox Dispatcher dispatches to Event Store with duplicate idempotency ACK', async () => {
    const key = `outbox-key-${Date.now()}`;
    await EventOutbox.create({
      idempotencyKey: key,
      eventType: 'VIDEO_APPROVED',
      payload: {
        videoId: 999,
        sourceModule: 'production',
        actorId: 50,
        teamId: 2,
        occurredAt: new Date().toISOString(),
      },
      status: 'PENDING',
      availableAt: new Date(),
    });

    // Dispatch outbox
    const dispatched = await outboxDispatcherWorker.processBatch();
    assert.equal(dispatched, 1);

    const outboxRow = await EventOutbox.findOne({ where: { idempotencyKey: key } });
    assert.equal(outboxRow.status, 'DISPATCHED');

    const createdEvent = await CompetitionEvent.findOne({ where: { idempotencyKey: key } });
    assert.ok(createdEvent);
    assert.equal(createdEvent.eventType, 'VIDEO_APPROVED');

    // Re-dispatching same row (e.g. if status was reset) safely ACKs without throwing
    await EventOutbox.update({ status: 'PENDING' }, { where: { id: outboxRow.id } });
    await outboxDispatcherWorker.processBatch();

    const eventsCount = await CompetitionEvent.count({ where: { idempotencyKey: key } });
    assert.equal(eventsCount, 1, 'No duplicate CompetitionEvent created');
  });

  it('4. Backlog quarantine -> poison / audit forged events are quarantined to IGNORED', async () => {
    // Seed known audit-forged poison event
    const poisonKey = 'audit-20261017-forged';
    const poisonId = '737f883c-c2f3-4936-b025-875e1e0dbde3';

    await CompetitionEvent.create({
      eventId: poisonId,
      idempotencyKey: poisonKey,
      eventType: 'VIDEO_APPROVED',
      sourceModule: 'production',
      aggregateType: 'Video',
      aggregateId: 12345678,
      actorId: 35,
      teamId: null,
      occurredAt: new Date('2026-10-17T01:14:58.611Z'),
      receivedAt: new Date('2026-10-17T01:14:58.611Z'),
      payload: { videoId: 12345678, qualityScore: 100 },
      status: 'PENDING',
    });

    // Run quarantine
    const quarantined = await competitionEngineWorker.quarantineKnownPoisonEvents();
    assert.equal(quarantined, 1, 'Should quarantine 1 forged event');

    const poisonEvent = await CompetitionEvent.findByPk(poisonId);
    assert.equal(poisonEvent.status, 'IGNORED');
    assert.equal(poisonEvent.lastError, 'Quarantined: audit test event');

    // Run engine batch -> poison event should NOT be processed
    await competitionEngineWorker.processBatch();
    const ledgers = await ScoreLedger.findAll({ where: { eventId: poisonId } });
    assert.equal(ledgers.length, 0, 'Poison event must never receive score effects');
  });

  it('5. Health monitor -> reports DEGRADED when worker stopped and pending events age past threshold', async () => {
    // Ensure worker is stopped
    await competitionEngineWorker.stop();

    // Insert an aged pending event (> 60s old)
    const oldDate = new Date(Date.now() - 75 * 1000);
    await CompetitionEvent.create({
      eventId: crypto.randomUUID(),
      idempotencyKey: `old-${Date.now()}`,
      eventType: 'VIDEO_APPROVED',
      sourceModule: 'production',
      aggregateType: 'Video',
      aggregateId: 103,
      actorId: 77,
      teamId: 1,
      occurredAt: oldDate,
      receivedAt: oldDate,
      payload: { videoId: 103 },
      status: 'PENDING',
    });

    const health = await competitionIntegrationMonitor.getIntegrationHealth();
    assert.equal(health.status, 'DEGRADED', 'Health should be DEGRADED due to aged pending event');
    assert.ok(health.summary.oldestPendingAgeSeconds >= 70, 'oldestPendingAgeSeconds should be tracked');
    assert.equal(health.summary.pendingCount, 1);
    assert.equal(health.workers.competitionEngine.running, false);
  });

  it('6. Health monitor -> reports HEALTHY when workers are running and pending count is 0', async () => {
    // Start workers
    competitionEngineWorker.start();
    outboxDispatcherWorker.start();

    // All tables clean, 0 pending
    const health = await competitionIntegrationMonitor.getIntegrationHealth();
    assert.equal(health.status, 'HEALTHY');
    assert.equal(health.summary.pendingCount, 0);
    assert.equal(health.summary.oldestPendingAgeSeconds, 0);
    assert.equal(health.workers.competitionEngine.running, true);
    assert.equal(health.workers.outboxDispatcher.running, true);

    await competitionEngineWorker.stop();
    await outboxDispatcherWorker.stop();
  });

  it('7. Worker lifecycle -> stop() completes gracefully without throwing', async () => {
    competitionEngineWorker.start();
    outboxDispatcherWorker.start();

    assert.equal(competitionEngineWorker.getStatus().running, true);
    assert.equal(outboxDispatcherWorker.getStatus().running, true);

    await competitionEngineWorker.stop();
    await outboxDispatcherWorker.stop();

    assert.equal(competitionEngineWorker.getStatus().running, false);
    assert.equal(outboxDispatcherWorker.getStatus().running, false);
  });
});
