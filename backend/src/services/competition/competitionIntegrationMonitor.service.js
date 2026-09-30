'use strict';

/**
 * competitionIntegrationMonitor.service.js
 *
 * Admin Integration Health, Diagnostics & Manual Retry Service.
 *
 * Provides operations team with visibility into:
 *   - Event throughput by source module (Production, YouTube, Community)
 *   - Status breakdowns (Pending, Processed, Failed, Ignored)
 *   - Dead-letter / Failed event inspection & retry
 *   - Audit trail for all manual interventions
 */

const { Op, fn, col } = require('sequelize');
const sequelize = require('../../config/database');
const { CompetitionEvent, CompetitionAuditLog } = require('../../models');

/**
 * Retrieve high-level integration health metrics and status counts.
 */
async function getIntegrationHealth() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // 1. Total counts by status
  const statusCounts = await CompetitionEvent.findAll({
    attributes: ['status', [fn('COUNT', col('event_id')), 'count']],
    group: ['status'],
    raw: true,
  });

  const statusMap = { PENDING: 0, PROCESSED: 0, FAILED: 0, IGNORED: 0 };
  let totalEvents = 0;
  for (const row of statusCounts) {
    statusMap[row.status] = Number(row.count);
    totalEvents += Number(row.count);
  }

  // 2. Counts by source module
  const sourceModuleCounts = await CompetitionEvent.findAll({
    attributes: ['sourceModule', [fn('COUNT', col('event_id')), 'count']],
    group: ['sourceModule'],
    raw: true,
  });

  const sourceMap = {};
  for (const row of sourceModuleCounts) {
    const src = row.sourceModule || 'unknown';
    sourceMap[src] = Number(row.count);
  }

  // 3. 24-hour volume
  const volume24h = await CompetitionEvent.count({
    where: { occurredAt: { [Op.gte]: oneDayAgo } },
  });

  // 4. Recent failed events
  const recentFailures = await CompetitionEvent.findAll({
    where: { status: 'FAILED' },
    order: [['failed_at', 'DESC'], ['occurred_at', 'DESC']],
    limit: 20,
    attributes: ['eventId', 'eventType', 'sourceModule', 'actorId', 'teamId', 'failedAt', 'attemptCount', 'lastError'],
  });

  const failureRate = totalEvents > 0 ? ((statusMap.FAILED / totalEvents) * 100).toFixed(2) : '0.00';

  return {
    status: statusMap.FAILED > 0 ? 'DEGRADED' : 'HEALTHY',
    summary: {
      totalEvents,
      volume24h,
      pendingCount: statusMap.PENDING,
      processedCount: statusMap.PROCESSED,
      failedCount: statusMap.FAILED,
      ignoredCount: statusMap.IGNORED,
      failureRate: `${failureRate}%`,
    },
    bySourceModule: sourceMap,
    recentFailures,
    checkedAt: new Date(),
  };
}

/**
 * Paginated query of integration events with filters.
 */
async function listIntegrationEvents(options = {}) {
  const page = Math.max(1, Number(options.page || 1));
  const limit = Math.min(100, Math.max(1, Number(options.limit || 50)));
  const offset = (page - 1) * limit;

  const where = {};
  if (options.sourceModule) where.sourceModule = options.sourceModule;
  if (options.status) where.status = options.status;
  if (options.eventType) where.eventType = options.eventType;
  if (options.actorId) where.actorId = options.actorId;
  if (options.teamId) where.teamId = options.teamId;

  if (options.from) {
    where.occurredAt = { ...(where.occurredAt || {}), [Op.gte]: new Date(options.from) };
  }
  if (options.to) {
    where.occurredAt = { ...(where.occurredAt || {}), [Op.lte]: new Date(options.to) };
  }

  const { rows, count } = await CompetitionEvent.findAndCountAll({
    where,
    order: [['occurred_at', 'DESC']],
    limit,
    offset,
  });

  return {
    page,
    limit,
    totalEvents: count,
    totalPages: Math.ceil(count / limit),
    events: rows,
  };
}

/**
 * Manually retry a failed or stuck event.
 *
 * @param {string} eventId UUID
 * @param {number} actorId Admin user ID performing the retry
 * @param {string} reason Required explanation
 */
async function retryFailedEvent(eventId, actorId, reason) {
  if (!reason || typeof reason !== 'string' || reason.trim() === '') {
    const err = new Error('Retry reason is required for manual event retry');
    err.status = 400;
    throw err;
  }

  const event = await CompetitionEvent.findByPk(eventId);
  if (!event) {
    const err = new Error(`CompetitionEvent #${eventId} not found`);
    err.status = 404;
    throw err;
  }

  const previousStatus = event.status;
  const previousError = event.lastError;

  return sequelize.transaction(async (t) => {
    // Reset status to PENDING for Competition Worker to pick up on next poll
    event.status = 'PENDING';
    event.lastError = null;
    await event.save({ transaction: t });

    // Record immutable audit log
    await CompetitionAuditLog.create(
      {
        actorId,
        action: 'EVENT_MANUAL_RETRY',
        entityType: 'COMPETITION_EVENT',
        entityId: String(event.eventId),
        beforeState: { status: previousStatus, lastError: previousError },
        afterState: { status: 'PENDING' },
        reason: reason.trim(),
      },
      { transaction: t },
    );

    return {
      success: true,
      eventId: event.eventId,
      status: event.status,
      message: 'Event reset to PENDING for re-evaluation',
    };
  });
}

module.exports = {
  getIntegrationHealth,
  listIntegrationEvents,
  retryFailedEvent,
};
