'use strict';

/**
 * eventContractRegistry.service.js
 *
 * Authoritative Event Contract Registry & Domain Event Validation for WorkRank V3.3.
 *
 * Defines explicit contracts for all product modules:
 *   - Production (Video / Script / Edit / QC lifecycle)
 *   - YouTube (Views / Subscribers / Performance metrics)
 *   - Community (Kudos / Posts / Challenges / Milestones)
 *
 * Guarantees:
 *   - Strict schema versioning (v1, v2)
 *   - Whitelisted required fields per aggregate
 *   - Immutable payload validation
 *   - Descriptive rejection without silent dropping
 */

const crypto = require('node:crypto');

const SUPPORTED_SCHEMA_VERSIONS = [1, 2];

const EVENT_CONTRACTS = {
  // ─── Production Lifecycle Contracts ──────────────────────────────────────────
  'production.video.approved': {
    eventType: 'VIDEO_APPROVED',
    sourceModule: 'production',
    aggregateType: 'video',
    schemaVersion: 1,
    requiredFields: ['videoId'],
    optionalFields: ['title', 'duration', 'qualityScore', 'category', 'seasonId'],
    producer: 'workrank-production',
    description: 'Triggered when a video is formally approved in the production pipeline.',
  },
  'production.video.published': {
    eventType: 'VIDEO_PUBLISHED',
    sourceModule: 'production',
    aggregateType: 'video',
    schemaVersion: 1,
    requiredFields: ['videoId', 'url'],
    optionalFields: ['title', 'platform', 'seasonId'],
    producer: 'workrank-production',
    description: 'Triggered when an approved video is published to its target distribution.',
  },
  'production.script.submitted': {
    eventType: 'SCRIPT_SUBMITTED',
    sourceModule: 'production',
    aggregateType: 'script',
    schemaVersion: 1,
    requiredFields: ['scriptId', 'title'],
    optionalFields: ['wordCount', 'seasonId'],
    producer: 'workrank-production',
    description: 'Triggered when a writer submits a script draft.',
  },
  'production.script.approved': {
    eventType: 'SCRIPT_APPROVED',
    sourceModule: 'production',
    aggregateType: 'script',
    schemaVersion: 1,
    requiredFields: ['scriptId', 'title'],
    optionalFields: ['wordCount', 'reviewerId', 'seasonId'],
    producer: 'workrank-production',
    description: 'Triggered when a lead reviewer approves a script.',
  },
  'production.edit.submitted': {
    eventType: 'EDIT_SUBMITTED',
    sourceModule: 'production',
    aggregateType: 'edit',
    schemaVersion: 1,
    requiredFields: ['editId', 'videoId'],
    optionalFields: ['cutVersion', 'seasonId'],
    producer: 'workrank-production',
    description: 'Triggered when a video editor submits a cut for review.',
  },
  'production.edit.approved': {
    eventType: 'EDIT_APPROVED',
    sourceModule: 'production',
    aggregateType: 'edit',
    schemaVersion: 1,
    requiredFields: ['editId', 'videoId'],
    optionalFields: ['cutVersion', 'reviewerId', 'seasonId'],
    producer: 'workrank-production',
    description: 'Triggered when an edit cut passes editorial review.',
  },
  'production.video.qc_passed': {
    eventType: 'VIDEO_QC_PASSED',
    sourceModule: 'production',
    aggregateType: 'video',
    schemaVersion: 1,
    requiredFields: ['videoId', 'score'],
    optionalFields: ['checklistPassed', 'seasonId'],
    producer: 'workrank-production',
    description: 'Triggered when quality control approves video technical specs.',
  },

  // ─── YouTube Metric Contracts ───────────────────────────────────────────────
  'youtube.video.published': {
    eventType: 'YOUTUBE_VIDEO_PUBLISHED',
    sourceModule: 'youtube',
    aggregateType: 'video',
    schemaVersion: 1,
    requiredFields: ['youtubeVideoId', 'channelId'],
    optionalFields: ['title', 'publishedAt', 'seasonId'],
    producer: 'workrank-youtube-adapter',
    description: 'Triggered when YouTube webhook confirms a video upload is live.',
  },
  'youtube.video.milestone': {
    eventType: 'VIDEO_VIEW_MILESTONE_REACHED',
    sourceModule: 'youtube',
    aggregateType: 'video',
    schemaVersion: 1,
    requiredFields: ['youtubeVideoId', 'views'],
    optionalFields: ['channelId', 'watchTimeHours', 'title', 'seasonId'],
    producer: 'workrank-youtube-adapter',
    description: 'Triggered when a video crosses a significant view count milestone.',
  },
  'youtube.subscriber.milestone': {
    eventType: 'SUBSCRIBER_MILESTONE_REACHED',
    sourceModule: 'youtube',
    aggregateType: 'channel',
    schemaVersion: 1,
    requiredFields: ['channelId', 'subscribers'],
    optionalFields: ['channelTitle', 'growthRate', 'seasonId'],
    producer: 'workrank-youtube-adapter',
    description: 'Triggered when a channel crosses a subscriber count tier.',
  },
  'youtube.performance.milestone': {
    eventType: 'VIDEO_PERFORMANCE_MILESTONE',
    sourceModule: 'youtube',
    aggregateType: 'video',
    schemaVersion: 1,
    requiredFields: ['youtubeVideoId', 'metricName', 'metricValue'],
    optionalFields: ['channelId', 'benchmarkRatio', 'seasonId'],
    producer: 'workrank-youtube-adapter',
    description: 'Triggered on exceptional retention or engagement rate on YouTube.',
  },

  // ─── Community Social Contracts ─────────────────────────────────────────────
  'community.kudos.sent': {
    eventType: 'KUDOS_SENT',
    sourceModule: 'community',
    aggregateType: 'kudos',
    schemaVersion: 1,
    requiredFields: ['recipientId', 'reason'],
    optionalFields: ['kudosType', 'seasonId'],
    producer: 'workrank-community',
    description: 'Triggered when a user sends a recognition badge/kudos to a peer.',
  },
  'community.kudos.received': {
    eventType: 'KUDOS_RECEIVED',
    sourceModule: 'community',
    aggregateType: 'kudos',
    schemaVersion: 1,
    requiredFields: ['senderId', 'reason'],
    optionalFields: ['kudosType', 'seasonId'],
    producer: 'workrank-community',
    description: 'Triggered when a user receives recognition from a colleague.',
  },
  'community.post.created': {
    eventType: 'TEAM_POST_CREATED',
    sourceModule: 'community',
    aggregateType: 'post',
    schemaVersion: 1,
    requiredFields: ['postId', 'topic'],
    optionalFields: ['contentLength', 'seasonId'],
    producer: 'workrank-community',
    description: 'Triggered when a member shares knowledge or a project update.',
  },
  'community.challenge.completed': {
    eventType: 'CHALLENGE_COMPLETED',
    sourceModule: 'community',
    aggregateType: 'challenge',
    schemaVersion: 1,
    requiredFields: ['challengeId', 'seasonId'],
    optionalFields: ['completionTime', 'scoreReward'],
    producer: 'workrank-community',
    description: 'Triggered when a team or member completes an active competition challenge.',
  },
  'community.milestone': {
    eventType: 'COMMUNITY_MILESTONE',
    sourceModule: 'community',
    aggregateType: 'milestone',
    schemaVersion: 1,
    requiredFields: ['milestoneType', 'level'],
    optionalFields: ['seasonId'],
    producer: 'workrank-community',
    description: 'Triggered when community engagement goals are unlocked.',
  },
};

/**
 * Lookup contract by event name or eventType.
 *
 * @param {string} contractKeyOrType
 * @returns {object|null}
 */
function getContract(contractKeyOrType) {
  if (!contractKeyOrType || typeof contractKeyOrType !== 'string') return null;

  // Direct lookup by key (e.g. 'production.video.approved')
  if (EVENT_CONTRACTS[contractKeyOrType]) {
    return { key: contractKeyOrType, ...EVENT_CONTRACTS[contractKeyOrType] };
  }

  // Lookup by eventType (e.g. 'VIDEO_APPROVED')
  for (const [key, contract] of Object.entries(EVENT_CONTRACTS)) {
    if (contract.eventType === contractKeyOrType) {
      return { key, ...contract };
    }
  }

  return null;
}

/**
 * List all registered event contracts.
 */
function listContracts() {
  return Object.entries(EVENT_CONTRACTS).map(([key, contract]) => ({
    key,
    ...contract,
  }));
}

/**
 * Validate a domain event against the contract registry.
 *
 * @param {object} eventDescriptor
 * @returns {{ valid: boolean, errors: string[], normalized: object|null }}
 */
function validateDomainEvent(eventDescriptor) {
  const errors = [];

  if (!eventDescriptor || typeof eventDescriptor !== 'object') {
    return { valid: false, errors: ['Event descriptor must be a non-null object'], normalized: null };
  }

  const {
    contractKey,
    eventType,
    sourceModule,
    aggregateType,
    aggregateId,
    actorId,
    teamId,
    occurredAt,
    payload,
    schemaVersion = 1,
    idempotencyKey,
    correlationId,
    causationId,
  } = eventDescriptor;

  // 1. Resolve Contract
  const contract = getContract(contractKey || eventType);
  if (!contract) {
    // If not in contract registry, ensure basic eventType exists
    if (!eventType) {
      errors.push('Unknown event: contractKey or eventType is required');
    }
  }

  const effectiveEventType = contract ? contract.eventType : eventType;
  const effectiveSourceModule = sourceModule || contract?.sourceModule || 'custom';
  const effectiveAggregateType = aggregateType || contract?.aggregateType || 'entity';

  // 2. Schema Version check
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(Number(schemaVersion))) {
    errors.push(`Unsupported schema_version '${schemaVersion}'. Supported versions: ${SUPPORTED_SCHEMA_VERSIONS.join(', ')}`);
  }

  // 3. Payload validation
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    errors.push('Event payload must be a non-null object');
  } else if (contract && contract.requiredFields) {
    for (const reqField of contract.requiredFields) {
      if (payload[reqField] === undefined || payload[reqField] === null || payload[reqField] === '') {
        errors.push(`Payload missing required field '${reqField}' for event '${contract.key}'`);
      }
    }
  }

  // 4. Entity Context validation (Actor or Team is required for competition evaluation)
  if (!actorId && !teamId && (!payload || (!payload.actorId && !payload.teamId))) {
    errors.push('Event must specify at least an actorId or a teamId');
  }

  // 5. Date validation
  let parsedOccurredAt = new Date();
  if (occurredAt) {
    parsedOccurredAt = new Date(occurredAt);
    if (Number.isNaN(parsedOccurredAt.getTime())) {
      errors.push(`Invalid occurredAt date: '${occurredAt}'`);
    }
  }

  // 6. Idempotency Key resolution
  let resolvedKey = idempotencyKey;
  if (!resolvedKey) {
    const rawContent = `${effectiveEventType}:${actorId ?? 0}:${teamId ?? 0}:${JSON.stringify(payload || {})}`;
    resolvedKey = crypto.createHash('sha256').update(rawContent).digest('hex');
  }

  if (errors.length > 0) {
    return { valid: false, errors, normalized: null };
  }

  const effectiveActorId = actorId !== undefined ? actorId : (payload?.actorId ?? null);
  const effectiveTeamId = teamId !== undefined ? teamId : (payload?.teamId ?? null);

  const normalized = {
    idempotencyKey: resolvedKey,
    eventType: effectiveEventType,
    sourceModule: effectiveSourceModule,
    aggregateType: effectiveAggregateType,
    aggregateId: aggregateId ?? null,
    actorId: effectiveActorId ? Number(effectiveActorId) : null,
    teamId: effectiveTeamId ? Number(effectiveTeamId) : null,
    occurredAt: parsedOccurredAt,
    payload: payload || {},
    schemaVersion: Number(schemaVersion),
    correlationId: correlationId ?? null,
    causationId: causationId ?? null,
  };

  return { valid: true, errors: [], normalized };
}

module.exports = {
  EVENT_CONTRACTS,
  SUPPORTED_SCHEMA_VERSIONS,
  getContract,
  listContracts,
  validateDomainEvent,
};
