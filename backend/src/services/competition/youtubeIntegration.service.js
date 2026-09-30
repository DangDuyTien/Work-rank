'use strict';

/**
 * youtubeIntegration.service.js
 *
 * YouTube Module Adapter for WorkRank V3.3.
 *
 * Connects YouTube analytics and webhook metrics (Views, Subs, Engagement)
 * to the Competition Engine via domain events.
 *
 * Principle:
 *   YouTube metrics emit domain events; they DO NOT directly increment XP or Grand Points.
 *   Active published Rule Versions determine score rewards based on conditions.
 */

const eventIngestionService = require('./eventIngestion.service');

/**
 * Record YouTube video live/published event.
 */
async function recordVideoPublished(params, options = {}) {
  const {
    youtubeVideoId,
    channelId,
    title = 'YouTube Video',
    publishedAt = new Date().toISOString(),
    actorId,
    teamId,
    seasonId,
    idempotencyKey,
  } = params;

  return eventIngestionService.publishEvent(
    {
      contractKey: 'youtube.video.published',
      aggregateType: 'video',
      aggregateId: null,
      actorId,
      teamId,
      idempotencyKey: idempotencyKey || `yt:published:${youtubeVideoId}`,
      payload: {
        youtubeVideoId,
        channelId,
        title,
        publishedAt,
        seasonId: seasonId ? Number(seasonId) : null,
      },
    },
    options,
  );
}

/**
 * Record YouTube video view milestone reached (e.g. 10k, 50k, 100k, 1M views).
 */
async function recordViewMilestone(params, options = {}) {
  const {
    youtubeVideoId,
    views,
    channelId,
    watchTimeHours = 0,
    title = 'Milestone Video',
    actorId,
    teamId,
    seasonId,
    idempotencyKey,
  } = params;

  return eventIngestionService.publishEvent(
    {
      contractKey: 'youtube.video.milestone',
      aggregateType: 'video',
      aggregateId: null,
      actorId,
      teamId,
      idempotencyKey: idempotencyKey || `yt:view_milestone:${youtubeVideoId}:${views}`,
      payload: {
        youtubeVideoId,
        views: Number(views),
        channelId: channelId || null,
        watchTimeHours: Number(watchTimeHours),
        title,
        seasonId: seasonId ? Number(seasonId) : null,
      },
    },
    options,
  );
}

/**
 * Record YouTube channel subscriber milestone reached.
 */
async function recordSubscriberMilestone(params, options = {}) {
  const {
    channelId,
    subscribers,
    channelTitle = 'Channel',
    growthRate = 0,
    actorId,
    teamId,
    seasonId,
    idempotencyKey,
  } = params;

  return eventIngestionService.publishEvent(
    {
      contractKey: 'youtube.subscriber.milestone',
      aggregateType: 'channel',
      aggregateId: null,
      actorId,
      teamId,
      idempotencyKey: idempotencyKey || `yt:sub_milestone:${channelId}:${subscribers}`,
      payload: {
        channelId,
        subscribers: Number(subscribers),
        channelTitle,
        growthRate: Number(growthRate),
        seasonId: seasonId ? Number(seasonId) : null,
      },
    },
    options,
  );
}

/**
 * Record YouTube performance milestone (e.g. CTR, Retention rate).
 */
async function recordPerformanceMilestone(params, options = {}) {
  const {
    youtubeVideoId,
    channelId,
    metricName,
    metricValue,
    benchmarkRatio = 1.0,
    actorId,
    teamId,
    seasonId,
    idempotencyKey,
  } = params;

  return eventIngestionService.publishEvent(
    {
      contractKey: 'youtube.performance.milestone',
      aggregateType: 'video',
      aggregateId: null,
      actorId,
      teamId,
      idempotencyKey: idempotencyKey || `yt:perf:${youtubeVideoId}:${metricName}:${metricValue}`,
      payload: {
        youtubeVideoId,
        channelId: channelId || null,
        metricName,
        metricValue: Number(metricValue),
        benchmarkRatio: Number(benchmarkRatio),
        seasonId: seasonId ? Number(seasonId) : null,
      },
    },
    options,
  );
}

module.exports = {
  recordVideoPublished,
  recordViewMilestone,
  recordSubscriberMilestone,
  recordPerformanceMilestone,
};
