'use strict';

/**
 * eventIngestion.service.js
 *
 * Ingestion gateway for all product domain events.
 *
 * Flow:
 *   Product Action (Production / YouTube / Community)
 *     ↓
 *   validateDomainEvent(descriptor) [Contract Enforcement]
 *     ↓
 *   Transactional Outbox (EventOutbox) or Direct Event Store (CompetitionEvent)
 *     ↓
 *   Competition Worker (Async evaluation)
 *
 * Guarantees:
 *   - Strict contract validation; invalid events are rejected and logged.
 *   - Idempotent: duplicate events are safely de-duplicated at the DB level.
 *   - Resilient: Product domain writes are NOT blocked if scoring engine is down.
 */

const { UniqueConstraintError } = require('sequelize');
const sequelize = require('../../config/database');
const { CompetitionEvent, EventOutbox } = require('../../models');
const { validateDomainEvent } = require('./eventContractRegistry.service');

/**
 * Publish a domain event into the Event Store (or Transactional Outbox).
 *
 * @param {object} eventDescriptor
 * @param {object} [options]
 * @param {import('sequelize').Transaction} [options.transaction]
 * @param {boolean} [options.useOutbox=false] If true, inserts into EventOutbox instead of direct EventStore
 * @returns {Promise<{ success: boolean, eventId?: string, isDuplicate: boolean, event?: CompetitionEvent }>}
 */
async function publishEvent(eventDescriptor, options = {}) {
  // 1. Authoritative Contract Validation
  const validation = validateDomainEvent(eventDescriptor);
  if (!validation.valid) {
    const errorMsg = `Domain Event validation failed: ${validation.errors.join('; ')}`;
    console.warn('[EventIngestion] Rejected invalid event:', errorMsg, eventDescriptor);
    const err = new Error(errorMsg);
    err.status = 400;
    err.validationErrors = validation.errors;
    throw err;
  }

  const normalized = validation.normalized;
  const { transaction, useOutbox = false } = options;

  if (useOutbox) {
    // Transactional Outbox write
    try {
      const outboxRow = await EventOutbox.create(
        {
          idempotencyKey: normalized.idempotencyKey,
          eventType: normalized.eventType,
          payload: {
            ...normalized.payload,
            sourceModule: normalized.sourceModule,
            aggregateType: normalized.aggregateType,
            aggregateId: normalized.aggregateId,
            actorId: normalized.actorId,
            teamId: normalized.teamId,
            occurredAt: normalized.occurredAt.toISOString(),
            schemaVersion: normalized.schemaVersion,
            correlationId: normalized.correlationId,
            causationId: normalized.causationId,
          },
          status: 'PENDING',
          availableAt: new Date(),
        },
        { transaction },
      );
      return { success: true, isDuplicate: false, outboxId: outboxRow.id };
    } catch (err) {
      if (err instanceof UniqueConstraintError) {
        return { success: true, isDuplicate: true };
      }
      throw err;
    }
  }

  // Direct EventStore write (with DB unique idempotency guard)
  try {
    const event = await CompetitionEvent.create(
      {
        idempotencyKey: normalized.idempotencyKey,
        eventType: normalized.eventType,
        sourceModule: normalized.sourceModule,
        aggregateType: normalized.aggregateType,
        aggregateId: normalized.aggregateId,
        actorId: normalized.actorId,
        teamId: normalized.teamId,
        occurredAt: normalized.occurredAt,
        receivedAt: new Date(),
        payload: normalized.payload,
        schemaVersion: normalized.schemaVersion,
        correlationId: normalized.correlationId,
        causationId: normalized.causationId,
        status: 'PENDING',
      },
      { transaction },
    );

    return {
      success: true,
      eventId: event.eventId,
      isDuplicate: false,
      event,
    };
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      // Event already recorded with this idempotency key
      const existing = await CompetitionEvent.findOne({
        where: { idempotencyKey: normalized.idempotencyKey },
        transaction,
      });
      return {
        success: true,
        eventId: existing?.eventId,
        isDuplicate: true,
        event: existing,
      };
    }
    throw err;
  }
}

module.exports = {
  publishEvent,
};
