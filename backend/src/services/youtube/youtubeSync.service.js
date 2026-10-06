'use strict';

const { YouTubeChannel, sequelize } = require('../../models');
const youtubeDataService = require('./youtubeData.service');
const youtubeAggregationService = require('./youtubeAggregation.service');
const youtubeIntegrationService = require('../competition/youtubeIntegration.service');

/**
 * YouTube Sync Service
 * Orchestrates periodic and on-demand synchronization of YouTube channels.
 */

// Simple fetch-based YouTube Data API v3 client (if API key provided)
async function fetchYouTubeApi(endpoint, params = {}) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return null; // Signals to use mock/deterministic adapter
  }

  const query = new URLSearchParams({ ...params, key: apiKey }).toString();
  const url = `https://www.googleapis.com/youtube/v3/${endpoint}?${query}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`YouTube API error ${res.status}: ${errBody}`);
    }
    return res.json();
  } catch (err) {
    console.warn(`[YouTubeSync] Live API request failed: ${err.message}`);
    throw err;
  }
}

/**
 * Sync a single YouTube Channel by DB ID or External Channel ID.
 */
async function syncChannel(channelIdentifier, options = {}) {
  let channel;
  if (typeof channelIdentifier === 'number' || !isNaN(Number(channelIdentifier))) {
    channel = await YouTubeChannel.findByPk(Number(channelIdentifier));
  }
  if (!channel) {
    channel = await YouTubeChannel.findOne({ where: { channelId: String(channelIdentifier) } });
  }

  if (!channel) {
    throw new Error(`YouTube channel '${channelIdentifier}' not found`);
  }

  channel.syncStatus = 'SYNCING';
  await channel.save();

  try {
    let channelStats = null;

    // 1. Try Live API if configured (bypassed in test environment)
    if (process.env.YOUTUBE_API_KEY && process.env.NODE_ENV !== 'test') {
      try {
        const queryParams = {
          part: 'snippet,statistics',
        };

        const rawChannelId = (channel.channelId || '').trim();
        if (rawChannelId.startsWith('@')) {
          queryParams.forHandle = rawChannelId;
        } else if (rawChannelId.startsWith('UC') || rawChannelId.length === 24) {
          queryParams.id = rawChannelId;
        } else {
          queryParams.forHandle = `@${rawChannelId.replace(/^@/, '')}`;
        }

        let apiRes = await fetchYouTubeApi('channels', queryParams);

        // Fallback to id if forHandle returned empty
        if ((!apiRes || !apiRes.items || apiRes.items.length === 0) && queryParams.forHandle) {
          apiRes = await fetchYouTubeApi('channels', {
            part: 'snippet,statistics',
            id: rawChannelId,
          });
        }

        if (apiRes && apiRes.items && apiRes.items.length > 0) {
          const item = apiRes.items[0];
          channelStats = {
            title: item.snippet.title,
            description: item.snippet.description,
            customUrl: item.snippet.customUrl,
            thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
            views: Number(item.statistics.viewCount || 0),
            subscribers: Number(item.statistics.subscriberCount || 0),
          };
        } else if (apiRes && (!apiRes.items || apiRes.items.length === 0)) {
          throw new Error(`Không tìm thấy kênh trên YouTube với Channel ID/Handle "${rawChannelId}". Vui lòng kiểm tra lại Channel ID (bắt đầu bằng UC...) hoặc Handle (@ten_kenh).`);
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'test') throw err;
      }
    }

    // 2. Test / Non-production Environment Mock Adapter (used when API key is absent during tests or local dev)
    if (!channelStats && process.env.NODE_ENV !== 'production' && !process.env.YOUTUBE_API_KEY) {
      channelStats = {
        title: channel.title,
        description: channel.description,
        customUrl: channel.customUrl,
        thumbnailUrl: channel.thumbnailUrl,
        views: 1000,
        subscribers: 100,
      };
    }

    if (!channelStats) {
      throw new Error('Chưa cấu hình biến môi trường YOUTUBE_API_KEY trên Render. Vui lòng vào Render Dashboard > Environment và thêm YOUTUBE_API_KEY.');
    }

    // 3. Persist Channel Details & Metric Snapshot inside managed transaction
    await sequelize.transaction(async (transaction) => {
      channel.title = channelStats.title || channel.title;
      if (channelStats.customUrl) channel.customUrl = channelStats.customUrl;
      if (channelStats.thumbnailUrl) channel.thumbnailUrl = channelStats.thumbnailUrl;
      channel.status = 'ACTIVE';
      channel.syncStatus = 'SUCCESS';
      channel.lastSyncedAt = new Date();
      channel.lastSyncError = null;
      await channel.save({ transaction });

      let channelEngagementRate = 0;
      if (channelStats.subscribers > 0 && channelStats.views > 0) {
        channelEngagementRate = Math.min(10.0, (channelStats.views / (channelStats.subscribers * 100)) * 100);
      }
      const safeChannelEngagementRate = Number(Math.min(999.9999, Math.max(0, channelEngagementRate)).toFixed(4));
      const safeChannelWatchTime = Number(Math.min(9999999999.99, Math.max(0, channelStats.views * 0.05)).toFixed(2));

      await youtubeDataService.recordChannelMetricSnapshot({
        channelId: channel.id,
        views: channelStats.views,
        subscribers: channelStats.subscribers,
        watchTimeHours: safeChannelWatchTime,
        engagementRate: safeChannelEngagementRate,
        capturedAt: new Date(),
      }, { transaction });

      // 4. Update Team Summary if channel is assigned
      if (channel.teamId) {
        await youtubeAggregationService.aggregateTeamYouTubeSummary(channel.teamId, { transaction });
      }
    });

    return {
      channelId: channel.id,
      externalId: channel.channelId,
      status: 'SUCCESS',
      views: channelStats.views,
      subscribers: channelStats.subscribers,
    };
  } catch (error) {
    console.error('[YouTubeSync Error caught in syncChannel]:', error);
    channel.syncStatus = 'ERROR';
    channel.lastSyncError = error.message;
    await channel.save();
    return {
      channelId: channel.id,
      externalId: channel.channelId,
      status: 'ERROR',
      error: error.message,
    };
  }
}

/**
 * Synchronize all active channels across the platform.
 */
async function syncAllChannels() {
  const channels = await YouTubeChannel.findAll({
    where: { status: 'ACTIVE' },
  });

  const results = [];
  for (const channel of channels) {
    const res = await syncChannel(channel.id);
    results.push(res);
  }

  // Recalculate company leaderboard ranks
  await youtubeAggregationService.recalculateAllTeamYouTubeSummaries();

  return {
    total: channels.length,
    success: results.filter((r) => r.status === 'SUCCESS').length,
    failed: results.filter((r) => r.status === 'ERROR').length,
    details: results,
  };
}

module.exports = {
  syncChannel,
  syncAllChannels,
};
