'use strict';

/**
 * outbox.service.js
 *
 * Transactional Outbox helper.
 *
 * Usage:
 *   await outboxService.enqueue(
 *     { domainWrite: () => Video.update(..., { transaction: t }) },
 *     { eventType: 'VIDEO_APPROVED', payload: { videoId: 42, actorId: 7 } },
 *   );
 *
 * Guarantees:
 *   - Domain write + outbox INSERT share the SAME DB transaction.
 *   - If domain write fails → outbox row is NOT created.
 *   - If server crashes after COMMIT → outbox row survives for retry.
 *   - Duplicate idempotency_key → UniqueConstraintError silently ignored.
 */

const crypto = require('node:crypto');
const { UniqueConstraintError } = require('sequelize');
const sequelize = require('../../config/database');
const { EventOutbox } = require('../../models');

/**
 * Generate a deterministic idempotency key from domain context.
 * Caller may provide their own; if not, one is generated from eventType + payload hash.
 *
 * @param {string} eventType
 * @param {object} payload
 * @param {string|undefined} suppliedKey
 * @returns {string}
 */
function resolveIdempotencyKey(eventType, payload, suppliedKey) {
  if (suppliedKey) return suppliedKey;
  const content = `${eventType}:${JSON.stringify(payload)}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Enqueue a domain event into the outbox, sharing the domain's DB transaction.
 *
 * @param {object} options
 * @param {function(import('sequelize').Transaction): Promise<any>} options.domainWrite
 *        The domain DB write (UPDATE/INSERT). Receives the transaction object.
 * @param {object} eventDescriptor
 * @param {string} eventDescriptor.eventType    e.g. 'VIDEO_APPROVED'
 * @param {object} eventDescriptor.payload      Business data — stored immutably
 * @param {string} [eventDescriptor.idempotencyKey]  Optional; auto-generated if omitted
 * @param {import('sequelize').Transaction} [existingTransaction]
 *        If the caller already owns a transaction, pass it here.
 * @returns {Promise<{ outboxRow: EventOutbox|null, domainResult: any }>}
 */
async function enqueue(options, eventDescriptor, existingTransaction = null) {
  const { domainWrite } = options;
  const { eventType, payload, idempotencyKey: suppliedKey } = eventDescriptor;

  const idempotencyKey = resolveIdempotencyKey(eventType, payload, suppliedKey);

  const run = async (t) => {
    // 1. Execute the domain write inside the shared transaction
    const domainResult = await domainWrite(t);

    // 2. Append outbox row in the same transaction
    let outboxRow = null;
    try {
      outboxRow = await EventOutbox.create(
        {
          idempotencyKey,
          eventType,
          payload,
          status: 'PENDING',
          availableAt: new Date(),
        },
        { transaction: t },
      );
    } catch (err) {
      if (err instanceof UniqueConstraintError) {
        // Already enqueued with same key — idempotent, not an error
        outboxRow = null;
      } else {
        throw err;
      }
    }

    return { outboxRow, domainResult };
  };

  if (existingTransaction) {
    return run(existingTransaction);
  }

  return sequelize.transaction(run);
}

/**
 * Fetch a batch of PENDING outbox rows ready for dispatching.
 *
 * @param {number} [batchSize=50]
 * @returns {Promise<EventOutbox[]>}
 */
async function fetchPendingBatch(batchSize = 50) {
  const { Op } = require('sequelize');
  return EventOutbox.findAll({
    where: {
      status: 'PENDING',
      availableAt: { [Op.lte]: new Date() },
    },
    order: [['available_at', 'ASC']],
    limit: batchSize,
  });
}

/**
 * Mark an outbox row as successfully dispatched.
 *
 * @param {number} outboxId
 */
async function markDispatched(outboxId) {
  await EventOutbox.update(
    { status: 'DISPATCHED', processedAt: new Date() },
    { where: { id: outboxId } },
  );
}

/**
 * Mark an outbox row as failed with an error message.
 *
 * @param {number} outboxId
 * @param {string} errorMessage
 */
async function markFailed(outboxId, errorMessage) {
  await EventOutbox.increment('attempt_count', { where: { id: outboxId } });
  await EventOutbox.update(
    { status: 'FAILED', lastError: String(errorMessage).slice(0, 2000) },
    { where: { id: outboxId } },
  );
}

module.exports = { enqueue, fetchPendingBatch, markDispatched, markFailed, resolveIdempotencyKey };
