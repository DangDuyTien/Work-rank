'use strict';

/**
 * competitionEventTrace.service.js
 *
 * Event-to-Score Trace & Audit Service for WorkRank V3.3.
 *
 * Provides complete end-to-end traceability for any domain event:
 *   Product Action → Domain Event → Rule Evaluation → Score Ledger → Projections
 *
 * RBAC:
 *   - Admin: Full system trace, raw payloads, error logs, and attempt counts.
 *   - Member: Scoped to own events or own team; internal stack traces sanitized.
 */

const {
  CompetitionEvent,
  ScoreLedger,
  RuleSetVersion,
  RuleSet,
  CompetitionActivityProjection,
  User,
  Team,
} = require('../../models');

/**
 * Retrieve the full chronological trace for a domain event.
 *
 * @param {string} eventId UUID
 * @param {object} requestingUser { id, role, teamId }
 * @returns {Promise<object>}
 */
async function getEventTrace(eventId, requestingUser) {
  const event = await CompetitionEvent.findByPk(eventId);
  if (!event) {
    const err = new Error(`CompetitionEvent #${eventId} not found`);
    err.status = 404;
    throw err;
  }

  const isAdmin = requestingUser.role === 'admin';
  const isActor = Number(event.actorId) === Number(requestingUser.id);
  const isSameTeam = requestingUser.teamId && Number(event.teamId) === Number(requestingUser.teamId);

  // RBAC check
  if (!isAdmin && !isActor && !isSameTeam) {
    const err = new Error('Forbidden: You can only view traces for your own or team events');
    err.status = 403;
    throw err;
  }

  // 1. Fetch Actor & Team details
  let actor = null;
  if (event.actorId) {
    actor = await User.findByPk(event.actorId, { attributes: ['id', 'name', 'email'] });
  }

  let team = null;
  if (event.teamId) {
    team = await Team.findByPk(event.teamId, { attributes: ['id', 'name'] });
  }

  // 2. Fetch ScoreLedger entries produced by this event
  const ledgerEntries = await ScoreLedger.findAll({
    where: { eventId },
    order: [['id', 'ASC']],
  });

  // 3. Fetch RuleSetVersion evaluated (if referenced in score ledger or payload)
  let ruleVersion = null;
  const ruleVersionId = ledgerEntries[0]?.ruleVersionId || event.payload?.ruleVersionId;
  if (ruleVersionId) {
    const ver = await RuleSetVersion.findByPk(ruleVersionId, {
      include: [{ model: RuleSet, as: 'ruleSet', attributes: ['id', 'name', 'code'] }],
    });
    if (ver) {
      ruleVersion = {
        id: ver.id,
        versionNumber: ver.versionNumber,
        status: ver.status,
        ruleSetName: ver.ruleSet?.name || 'Standard Rules',
        ruleSetCode: ver.ruleSet?.code || 'RULES',
      };
    }
  }

  // 4. Fetch Activity Projections generated
  const activityProjections = await CompetitionActivityProjection.findAll({
    where: {
      metadata: { eventId },
    },
  });

  // 5. Build chronological trace structure
  const rawPayload = typeof event.payload === 'string'
    ? JSON.parse(event.payload)
    : (event.payload || {});

  const totalPointsAwarded = ledgerEntries.reduce((sum, entry) => sum + (entry.pointsDelta || 0), 0);

  const trace = {
    eventId: event.eventId,
    idempotencyKey: event.idempotencyKey,
    eventType: event.eventType,
    sourceModule: event.sourceModule,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    actor: actor ? { id: actor.id, name: actor.name, email: actor.email } : null,
    team: team ? { id: team.id, name: team.name } : null,
    occurredAt: event.occurredAt,
    receivedAt: event.receivedAt,
    schemaVersion: event.schemaVersion,
    processing: {
      status: event.status,
      processedAt: event.processedAt,
      failedAt: event.failedAt,
      attemptCount: event.attemptCount,
      lastError: isAdmin ? event.lastError : (event.lastError ? 'Processing encountered an error' : null),
    },
    ruleEvaluation: {
      ruleVersion,
      matched: ledgerEntries.length > 0,
      totalEffects: ledgerEntries.length,
      totalPointsAwarded,
    },
    ledgerEntries: ledgerEntries.map((l) => ({
      id: l.id,
      targetType: l.userId ? 'USER' : 'TEAM',
      targetId: l.userId || l.teamId,
      effectType: l.effectType,
      pointsDelta: l.pointsDelta,
      delta: l.pointsDelta,
      reason: l.reason,
      createdAt: l.createdAt,
    })),
    projections: activityProjections.map((p) => ({
      id: p.id,
      activityType: p.activityType,
      title: p.title,
      occurredAt: p.occurredAt,
    })),
    payload: isAdmin ? rawPayload : {
      videoId: rawPayload.videoId,
      title: rawPayload.title,
      views: rawPayload.views,
      subscribers: rawPayload.subscribers,
      reason: rawPayload.reason,
    },
  };

  return trace;
}

module.exports = {
  getEventTrace,
};
