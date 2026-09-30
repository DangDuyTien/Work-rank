'use strict';

/**
 * communityIntegration.service.js
 *
 * Community Module Adapter for WorkRank V3.3.
 *
 * Connects Social & Collaboration activities (Kudos, Knowledge Sharing, Challenges)
 * to the Competition Engine via domain events.
 *
 * Principle:
 *   Community interactions emit domain events; they DO NOT directly increment leaderboards.
 *   Competition scoring is determined by active Rule Versions.
 */

const eventIngestionService = require('./eventIngestion.service');

/**
 * Record a kudos sent between teammates or peers.
 */
async function recordKudosSent(params, options = {}) {
  const {
    kudosId,
    senderId,
    recipientId,
    senderTeamId,
    recipientTeamId,
    reason = 'Great teamwork!',
    kudosType = 'appreciation',
    seasonId,
    idempotencyKey,
  } = params;

  // 1. Emit KUDOS_SENT for the sender
  const sentResult = await eventIngestionService.publishEvent(
    {
      contractKey: 'community.kudos.sent',
      aggregateType: 'kudos',
      aggregateId: kudosId ?? null,
      actorId: senderId,
      teamId: senderTeamId ?? null,
      idempotencyKey: idempotencyKey ? `${idempotencyKey}:sent` : `kudos:sent:${senderId}:${recipientId}:${Date.now()}`,
      payload: {
        kudosId: kudosId ?? null,
        recipientId: Number(recipientId),
        reason,
        kudosType,
        seasonId: seasonId ? Number(seasonId) : null,
      },
    },
    options,
  );

  // 2. Emit KUDOS_RECEIVED for the recipient
  const receivedResult = await eventIngestionService.publishEvent(
    {
      contractKey: 'community.kudos.received',
      aggregateType: 'kudos',
      aggregateId: kudosId ?? null,
      actorId: recipientId,
      teamId: recipientTeamId ?? null,
      idempotencyKey: idempotencyKey ? `${idempotencyKey}:received` : `kudos:recv:${senderId}:${recipientId}:${Date.now()}`,
      payload: {
        kudosId: kudosId ?? null,
        senderId: Number(senderId),
        reason,
        kudosType,
        seasonId: seasonId ? Number(seasonId) : null,
      },
    },
    options,
  );

  return { sentResult, receivedResult };
}

/**
 * Record a team knowledge post or update.
 */
async function recordTeamPost(params, options = {}) {
  const {
    postId,
    topic,
    contentLength = 0,
    actorId,
    teamId,
    seasonId,
    idempotencyKey,
  } = params;

  return eventIngestionService.publishEvent(
    {
      contractKey: 'community.post.created',
      aggregateType: 'post',
      aggregateId: postId,
      actorId,
      teamId,
      idempotencyKey: idempotencyKey || `community:post:${postId}`,
      payload: {
        postId,
        topic,
        contentLength: Number(contentLength),
        seasonId: seasonId ? Number(seasonId) : null,
      },
    },
    options,
  );
}

/**
 * Record challenge completion by a user or team.
 */
async function recordChallengeCompleted(params, options = {}) {
  const {
    challengeId,
    challengeName = 'Challenge',
    actorId,
    teamId,
    seasonId,
    completionTime = null,
    scoreReward = 0,
    idempotencyKey,
  } = params;

  return eventIngestionService.publishEvent(
    {
      contractKey: 'community.challenge.completed',
      aggregateType: 'challenge',
      aggregateId: challengeId,
      actorId,
      teamId,
      idempotencyKey: idempotencyKey || `challenge:${challengeId}:${actorId || teamId}`,
      payload: {
        challengeId,
        challengeName,
        completionTime,
        scoreReward: Number(scoreReward),
        seasonId: Number(seasonId),
      },
    },
    options,
  );
}

/**
 * Record community milestone unlocked.
 */
async function recordCommunityMilestone(params, options = {}) {
  const {
    milestoneType,
    level = 1,
    actorId,
    teamId,
    seasonId,
    idempotencyKey,
  } = params;

  return eventIngestionService.publishEvent(
    {
      contractKey: 'community.milestone',
      aggregateType: 'milestone',
      aggregateId: null,
      actorId,
      teamId,
      idempotencyKey: idempotencyKey || `community:milestone:${milestoneType}:${level}:${actorId || teamId}`,
      payload: {
        milestoneType,
        level: Number(level),
        seasonId: seasonId ? Number(seasonId) : null,
      },
    },
    options,
  );
}

module.exports = {
  recordKudosSent,
  recordTeamPost,
  recordChallengeCompleted,
  recordCommunityMilestone,
};
