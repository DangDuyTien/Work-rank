'use strict';

/**
 * eventStore.service.js
 *
 * Ingest outbox rows into the canonical Event Store (competition_events).
 *
 * Guarantees:
 *   - UNIQUE(idempotency_key) at DB level → duplicate ingestion is impossible.
 *   - On UniqueConstraintError → silently ACK (do not throw, do not create duplicate).
 *   - Business payload columns are written ONCE and never updated.
 *   - Only processing metadata (status, processed_at, attempt_count, last_error) may be updated.
 */

const { UniqueConstraintError } = require('sequelize');
const { CompetitionEvent } = require('../../models');

/**
 * Ingest one outbox row into the Event Store.
 *
 * @param {import('../models/EventOutbox')} outboxRow
 * @returns {Promise<{ event: CompetitionEvent|null, isDuplicate: boolean }>}
 */
async function ingestFromOutbox(outboxRow) {
  const {
    idempotencyKey,
    eventType,
    payload,
  } = outboxRow;

  // Extract structured fields from payload if provided by the domain service.
  // Callers may embed these in payload for richer event data.
  const {
    sourceModule,
    aggregateType,
    aggregateId,
    actorId,
    teamId,
    occurredAt,
    correlationId,
    causationId,
    schemaVersion,
  } = payload;

  try {
    const event = await CompetitionEvent.create({
      idempotencyKey,
      eventType,
      sourceModule: sourceModule ?? null,
      aggregateType: aggregateType ?? null,
      aggregateId: aggregateId ?? null,
      actorId: actorId ?? null,
      teamId: teamId ?? null,
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      receivedAt: new Date(),
      payload,
      schemaVersion: schemaVersion ?? 1,
      correlationId: correlationId ?? null,
      causationId: causationId ?? null,
      status: 'PENDING',
    });

    return { event, isDuplicate: false };
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      // Outbox retry delivered same event — idempotent ACK, no second record created.
      return { event: null, isDuplicate: true };
    }
    throw err;
  }
}

/**
 * Mark a competition_event as successfully processed by the Competition Engine.
 * This is the ONLY permitted mutation on a CompetitionEvent row (processing metadata).
 *
 * @param {string} eventId UUID
 */
async function markProcessed(eventId) {
  await CompetitionEvent.update(
    {
      status: 'PROCESSED',
      processedAt: new Date(),
    },
    { where: { eventId } },
  );
}

/**
 * Mark a competition_event as failed.
 *
 * @param {string} eventId UUID
 * @param {string} errorMessage
 */
async function markFailed(eventId, errorMessage) {
  // Read current attempt_count first to avoid a lost-update on increment
  const event = await CompetitionEvent.findByPk(eventId, {
    attributes: ['eventId', 'attemptCount'],
  });
  if (!event) return;

  await CompetitionEvent.update(
    {
      status: 'FAILED',
      failedAt: new Date(),
      attemptCount: event.attemptCount + 1,
      lastError: String(errorMessage).slice(0, 2000),
    },
    { where: { eventId } },
  );
}

/**
 * Fetch a batch of PENDING events for the Competition Engine to process.
 *
 * @param {number} [batchSize=50]
 * @returns {Promise<CompetitionEvent[]>}
 */
async function fetchPendingBatch(batchSize = 50) {
  return CompetitionEvent.findAll({
    where: { status: 'PENDING' },
    order: [['received_at', 'ASC']],
    limit: batchSize,
  });
}

module.exports = { ingestFromOutbox, markProcessed, markFailed, fetchPendingBatch };
