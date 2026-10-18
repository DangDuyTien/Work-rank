'use strict';

/**
 * productionIntegration.service.js
 *
 * Production Module Integration for WorkRank V3.3.
 *
 * Connects video production workflow actions (Scripting, Editing, QC, Publishing)
 * to the Competition Engine via domain events.
 *
 * Principle:
 *   Production actions emit domain events; they DO NOT directly modify score ledgers.
 *   Production workflows succeed independently even if the scoring worker is down.
 */

const eventIngestionService = require('./eventIngestion.service');

/**
 * Resolve and enforce authorized actor and team identity.
 * If caller is provided and is not admin, actorId cannot be spoofed.
 */
function resolveAuthorizedActor(params, options = {}) {
  const caller = options.caller;
  if (caller) {
    if (caller.role !== 'admin' && params.actorId && Number(params.actorId) !== Number(caller.id)) {
      const err = new Error(`Forbidden: User #${caller.id} cannot emit domain event for actor #${params.actorId}`);
      err.status = 403;
      throw err;
    }
    return {
      actorId: caller.role === 'admin' ? (params.actorId || caller.id) : caller.id,
      teamId: caller.role === 'admin' ? (params.teamId !== undefined ? params.teamId : caller.teamId) : (caller.teamId || null),
    };
  }
  return {
    actorId: params.actorId,
    teamId: params.teamId,
  };
}

/**
 * Record a video approved event in the production pipeline.
 */
async function recordVideoApproved(params, options = {}) {
  const { actorId, teamId } = resolveAuthorizedActor(params, options);
  const {
    videoId,
    title = 'Untitled Video',
    duration = 0,
    qualityScore = 100,
    category = 'standard',
    seasonId,
    idempotencyKey,
  } = params;

  return eventIngestionService.publishEvent(
    {
      contractKey: 'production.video.approved',
      aggregateId: videoId,
      actorId,
      teamId,
      idempotencyKey: idempotencyKey || `prod:video_approved:${videoId}`,
      payload: {
        videoId,
        title,
        duration: Number(duration),
        qualityScore: Number(qualityScore),
        category,
        seasonId: seasonId ? Number(seasonId) : null,
      },
    },
    options,
  );
}

/**
 * Record a video published event.
 */
async function recordVideoPublished(params, options = {}) {
  const { actorId, teamId } = resolveAuthorizedActor(params, options);
  const {
    videoId,
    url,
    title = 'Published Video',
    platform = 'youtube',
    seasonId,
    idempotencyKey,
  } = params;

  return eventIngestionService.publishEvent(
    {
      contractKey: 'production.video.published',
      aggregateId: videoId,
      actorId,
      teamId,
      idempotencyKey: idempotencyKey || `prod:video_published:${videoId}`,
      payload: {
        videoId,
        url,
        title,
        platform,
        seasonId: seasonId ? Number(seasonId) : null,
      },
    },
    options,
  );
}

/**
 * Record a script draft submitted by a writer.
 */
async function recordScriptSubmitted(params, options = {}) {
  const { actorId, teamId } = resolveAuthorizedActor(params, options);
  const {
    scriptId,
    title,
    wordCount = 0,
    seasonId,
    idempotencyKey,
  } = params;

  return eventIngestionService.publishEvent(
    {
      contractKey: 'production.script.submitted',
      aggregateId: scriptId,
      actorId,
      teamId,
      idempotencyKey: idempotencyKey || `prod:script_submitted:${scriptId}`,
      payload: {
        scriptId,
        title,
        wordCount: Number(wordCount),
        seasonId: seasonId ? Number(seasonId) : null,
      },
    },
    options,
  );
}

/**
 * Record a script approved by lead reviewer.
 */
async function recordScriptApproved(params, options = {}) {
  const { actorId, teamId } = resolveAuthorizedActor(params, options);
  const {
    scriptId,
    title,
    wordCount = 0,
    reviewerId,
    seasonId,
    idempotencyKey,
  } = params;

  return eventIngestionService.publishEvent(
    {
      contractKey: 'production.script.approved',
      aggregateId: scriptId,
      actorId,
      teamId,
      idempotencyKey: idempotencyKey || `prod:script_approved:${scriptId}`,
      payload: {
        scriptId,
        title,
        wordCount: Number(wordCount),
        reviewerId: reviewerId ? Number(reviewerId) : null,
        seasonId: seasonId ? Number(seasonId) : null,
      },
    },
    options,
  );
}

/**
 * Record an edit draft submitted by an editor.
 */
async function recordEditSubmitted(params, options = {}) {
  const { actorId, teamId } = resolveAuthorizedActor(params, options);
  const {
    editId,
    videoId,
    cutVersion = 1,
    seasonId,
    idempotencyKey,
  } = params;

  return eventIngestionService.publishEvent(
    {
      contractKey: 'production.edit.submitted',
      aggregateId: editId,
      actorId,
      teamId,
      idempotencyKey: idempotencyKey || `prod:edit_submitted:${editId}:v${cutVersion}`,
      payload: {
        editId,
        videoId,
        cutVersion: Number(cutVersion),
        seasonId: seasonId ? Number(seasonId) : null,
      },
    },
    options,
  );
}

/**
 * Record an edit draft approved.
 */
async function recordEditApproved(params, options = {}) {
  const { actorId, teamId } = resolveAuthorizedActor(params, options);
  const {
    editId,
    videoId,
    cutVersion = 1,
    reviewerId,
    seasonId,
    idempotencyKey,
  } = params;

  return eventIngestionService.publishEvent(
    {
      contractKey: 'production.edit.approved',
      aggregateId: editId,
      actorId,
      teamId,
      idempotencyKey: idempotencyKey || `prod:edit_approved:${editId}:v${cutVersion}`,
      payload: {
        editId,
        videoId,
        cutVersion: Number(cutVersion),
        reviewerId: reviewerId ? Number(reviewerId) : null,
        seasonId: seasonId ? Number(seasonId) : null,
      },
    },
    options,
  );
}

/**
 * Record QC inspection passed for a video.
 */
async function recordQCPassed(params, options = {}) {
  const { actorId, teamId } = resolveAuthorizedActor(params, options);
  const {
    videoId,
    score = 100,
    checklistPassed = true,
    seasonId,
    idempotencyKey,
  } = params;

  return eventIngestionService.publishEvent(
    {
      contractKey: 'production.video.qc_passed',
      aggregateId: videoId,
      actorId,
      teamId,
      idempotencyKey: idempotencyKey || `prod:qc_passed:${videoId}`,
      payload: {
        videoId,
        score: Number(score),
        checklistPassed: Boolean(checklistPassed),
        seasonId: seasonId ? Number(seasonId) : null,
      },
    },
    options,
  );
}

module.exports = {
  recordVideoApproved,
  recordVideoPublished,
  recordScriptSubmitted,
  recordScriptApproved,
  recordEditSubmitted,
  recordEditApproved,
  recordQCPassed,
};
