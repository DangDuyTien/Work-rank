'use strict';

const { Op } = require('sequelize');
const {
  Team,
  YouTubeChannel,
  YouTubeVideo,
  YouTubeChannelMetric,
  YouTubeVideoMetric,
  TeamYouTubeSummary,
  sequelize,
} = require('../../models');

let socketService = null;
try {
  socketService = require('../socket.service');
} catch {
  // Graceful fallback if socket service is structured differently
}

/**
 * YouTube Aggregation & Read Model Service
 */

/**
 * Aggregate YouTube summary for a single team.
 */
async function aggregateTeamYouTubeSummary(teamId, options = {}) {
  const team = await Team.findByPk(teamId, { transaction: options.transaction });
  if (!team) {
    await TeamYouTubeSummary.destroy({ where: { teamId }, transaction: options.transaction });
    return null;
  }


  const channels = await YouTubeChannel.findAll({
    where: { teamId, status: 'ACTIVE' },
    transaction: options.transaction,
  });

  const channelsCount = channels.length;
  if (channelsCount === 0) {
    // If team has no channels, create or update zeroed summary
    const [summary] = await TeamYouTubeSummary.findOrCreate({
      where: { teamId },
      defaults: {
        teamId,
        channelsCount: 0,
        videosCount: 0,
        totalViews: 0,
        totalSubscribers: 0,
        viewsToday: 0,
        views7d: 0,
        views30d: 0,
        subscribersToday: 0,
        subscriberGrowth7d: 0,
        subscriberGrowth30d: 0,
        viewsGrowth30dPct: 0.0,
        subGrowth30dPct: 0.0,
        topVideoId: null,
        topVideoTitle: null,
        topVideoViews: 0,
        rankByViews: 0,
        rankBySubs: 0,
        rankByGrowth: 0,
        freshnessStatus: 'FRESH',
        lastSyncedAt: null,
      },
      transaction: options.transaction,
    });

    return summary.update(
      {
        channelsCount: 0,
        videosCount: 0,
        totalViews: 0,
        totalSubscribers: 0,
        viewsToday: 0,
        views7d: 0,
        views30d: 0,
        subscribersToday: 0,
        subscriberGrowth7d: 0,
        subscriberGrowth30d: 0,
        viewsGrowth30dPct: 0.0,
        subGrowth30dPct: 0.0,
        topVideoId: null,
        topVideoTitle: null,
        topVideoViews: 0,
      },
      options,
    );
  }

  const channelIds = channels.map((c) => c.id);
  const now = new Date();
  const tToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const t7d = new Date(now.getTime() - 7 * 86400000);
  const t30d = new Date(now.getTime() - 30 * 86400000);

  let totalViews = 0;
  let totalSubscribers = 0;
  let viewsToday = 0;
  let views7d = 0;
  let views30d = 0;
  let subscribersToday = 0;
  let subscriberGrowth7d = 0;
  let subscriberGrowth30d = 0;
  let lastSyncedAt = null;
  let hasSyncError = false;

  for (const channel of channels) {
    if (channel.lastSyncedAt && (!lastSyncedAt || new Date(channel.lastSyncedAt) > new Date(lastSyncedAt))) {
      lastSyncedAt = channel.lastSyncedAt;
    }
    if (channel.lastSyncError) {
      hasSyncError = true;
    }

    // Latest metric
    const latest = await YouTubeChannelMetric.findOne({
      where: { channelId: channel.id },
      order: [['capturedAt', 'DESC']],
      transaction: options.transaction,
    });

    if (latest) {
      totalViews += Number(latest.views || 0);
      totalSubscribers += Number(latest.subscribers || 0);

      // Start of today snapshot
      const todayMetric = await YouTubeChannelMetric.findOne({
        where: {
          channelId: channel.id,
          capturedAt: { [Op.lte]: tToday },
        },
        order: [['capturedAt', 'DESC']],
        transaction: options.transaction,
      });
      if (todayMetric) {
        viewsToday += Math.max(0, Number(latest.views) - Number(todayMetric.views));
        subscribersToday += Number(latest.subscribers) - Number(todayMetric.subscribers);
      }

      // 7 days ago metric
      const metric7d = await YouTubeChannelMetric.findOne({
        where: {
          channelId: channel.id,
          capturedAt: { [Op.lte]: t7d },
        },
        order: [['capturedAt', 'DESC']],
        transaction: options.transaction,
      });
      if (metric7d) {
        views7d += Math.max(0, Number(latest.views) - Number(metric7d.views));
        subscriberGrowth7d += Number(latest.subscribers) - Number(metric7d.subscribers);
      } else {
        views7d += Number(latest.views);
        subscriberGrowth7d += Number(latest.subscribers);
      }

      // 30 days ago metric
      const metric30d = await YouTubeChannelMetric.findOne({
        where: {
          channelId: channel.id,
          capturedAt: { [Op.lte]: t30d },
        },
        order: [['capturedAt', 'DESC']],
        transaction: options.transaction,
      });
      if (metric30d) {
        views30d += Math.max(0, Number(latest.views) - Number(metric30d.views));
        subscriberGrowth30d += Number(latest.subscribers) - Number(metric30d.subscribers);
      } else {
        views30d += Number(latest.views);
        subscriberGrowth30d += Number(latest.subscribers);
      }
    }
  }

  // Count videos
  const videosCount = await YouTubeVideo.count({
    where: { channelId: { [Op.in]: channelIds }, status: 'ACTIVE' },
    transaction: options.transaction,
  });

  // Calculate percentage growths safely (clamped to DECIMAL(6, 2) limit [-9999.99, 9999.99])
  const baselineViews30d = Math.max(0, totalViews - views30d);
  const rawViewsGrowth = baselineViews30d > 0 ? (views30d / baselineViews30d) * 100 : (totalViews > 0 ? 100.0 : 0.0);
  const viewsGrowth30dPct = Number(Math.min(9999.99, Math.max(-9999.99, rawViewsGrowth)).toFixed(2));

  const baselineSubs30d = Math.max(0, totalSubscribers - subscriberGrowth30d);
  const rawSubGrowth = baselineSubs30d > 0 ? (subscriberGrowth30d / baselineSubs30d) * 100 : (totalSubscribers > 0 ? 100.0 : 0.0);
  const subGrowth30dPct = Number(Math.min(9999.99, Math.max(-9999.99, rawSubGrowth)).toFixed(2));

  // Top Video across team channels
  const topVideoRecord = await YouTubeVideo.findAll({
    where: { channelId: { [Op.in]: channelIds }, status: 'ACTIVE' },
    include: [
      {
        model: YouTubeVideoMetric,
        as: 'metrics',
        limit: 1,
        order: [['capturedAt', 'DESC']],
      },
    ],
    transaction: options.transaction,
  });

  let topVideoId = null;
  let topVideoTitle = null;
  let topVideoViews = 0;

  for (const v of topVideoRecord) {
    const vViews = v.metrics && v.metrics.length > 0 ? Number(v.metrics[0].views) : 0;
    if (vViews >= topVideoViews) {
      topVideoViews = vViews;
      topVideoId = v.id;
      topVideoTitle = v.title;
    }
  }

  // Freshness status calculation
  let freshnessStatus = 'FRESH';
  if (hasSyncError) {
    freshnessStatus = 'FAILED';
  } else if (!lastSyncedAt || now.getTime() - new Date(lastSyncedAt).getTime() > 2 * 3600000) {
    freshnessStatus = 'STALE';
  }

  const [summary] = await TeamYouTubeSummary.findOrCreate({
    where: { teamId },
    defaults: {
      teamId,
      channelsCount,
      videosCount,
      totalViews,
      totalSubscribers,
      viewsToday,
      views7d,
      views30d,
      subscribersToday,
      subscriberGrowth7d,
      subscriberGrowth30d,
      viewsGrowth30dPct,
      subGrowth30dPct,
      topVideoId,
      topVideoTitle,
      topVideoViews,
      freshnessStatus,
      lastSyncedAt,
    },
    transaction: options.transaction,
  });

  await summary.update(
    {
      channelsCount,
      videosCount,
      totalViews,
      totalSubscribers,
      viewsToday,
      views7d,
      views30d,
      subscribersToday,
      subscriberGrowth7d,
      subscriberGrowth30d,
      viewsGrowth30dPct,
      subGrowth30dPct,
      topVideoId,
      topVideoTitle,
      topVideoViews,
      freshnessStatus,
      lastSyncedAt,
    },
    options,
  );

  return summary;
}

/**
 * Recalculate YouTube summaries and rankings across all teams.
 */
async function recalculateAllTeamYouTubeSummaries(options = {}) {
  const teams = await Team.findAll({ transaction: options.transaction });

  for (const team of teams) {
    await aggregateTeamYouTubeSummary(team.id, options);
  }

  // Rank by total views
  const byViews = await TeamYouTubeSummary.findAll({
    order: [['totalViews', 'DESC'], ['id', 'ASC']],
    transaction: options.transaction,
  });
  for (let i = 0; i < byViews.length; i++) {
    byViews[i].rankByViews = i + 1;
    await byViews[i].save(options);
  }

  // Rank by total subscribers
  const bySubs = await TeamYouTubeSummary.findAll({
    order: [['totalSubscribers', 'DESC'], ['id', 'ASC']],
    transaction: options.transaction,
  });
  for (let i = 0; i < bySubs.length; i++) {
    bySubs[i].rankBySubs = i + 1;
    await bySubs[i].save(options);
  }

  // Rank by 30D growth
  const byGrowth = await TeamYouTubeSummary.findAll({
    order: [['viewsGrowth30dPct', 'DESC'], ['totalViews', 'DESC'], ['id', 'ASC']],
    transaction: options.transaction,
  });
  for (let i = 0; i < byGrowth.length; i++) {
    byGrowth[i].rankByGrowth = i + 1;
    await byGrowth[i].save(options);
  }

  return { totalTeams: teams.length, status: 'RECALCULATED' };
}

/**
 * Get Company-wide YouTube Overview & Metrics
 */
async function getCompanyYouTubeOverview() {
  const summaries = await TeamYouTubeSummary.findAll({
    include: [{ model: Team, as: 'team', attributes: ['id', 'name', 'description'] }],
  });

  let totalViews = 0;
  let totalSubscribers = 0;
  let totalVideos = 0;
  let totalChannels = 0;
  let latestSync = null;
  let hasStale = false;
  let hasFailed = false;

  for (const s of summaries) {
    totalViews += Number(s.totalViews || 0);
    totalSubscribers += Number(s.totalSubscribers || 0);
    totalVideos += Number(s.videosCount || 0);
    totalChannels += Number(s.channelsCount || 0);

    if (s.lastSyncedAt && (!latestSync || new Date(s.lastSyncedAt) > new Date(latestSync))) {
      latestSync = s.lastSyncedAt;
    }
    if (s.freshnessStatus === 'STALE') hasStale = true;
    if (s.freshnessStatus === 'FAILED') hasFailed = true;
  }

  // Company freshness status
  let freshnessStatus = 'FRESH';
  if (hasFailed) freshnessStatus = 'FAILED';
  else if (hasStale || !latestSync || (Date.now() - new Date(latestSync).getTime() > 2 * 3600000)) {
    freshnessStatus = 'STALE';
  }

  // Top Teams
  const topTeamsByViews = [...summaries]
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 5)
    .map((s) => ({
      teamId: s.teamId,
      teamName: s.team ? s.team.name : `Team ${s.teamId}`,
      totalViews: Number(s.totalViews),
      totalSubscribers: Number(s.totalSubscribers),
      viewsGrowth30dPct: Number(s.viewsGrowth30dPct),
      rank: s.rankByViews,
    }));

  const topTeamsByGrowth = [...summaries]
    .sort((a, b) => b.viewsGrowth30dPct - a.viewsGrowth30dPct)
    .slice(0, 5)
    .map((s) => ({
      teamId: s.teamId,
      teamName: s.team ? s.team.name : `Team ${s.teamId}`,
      totalViews: Number(s.totalViews),
      totalSubscribers: Number(s.totalSubscribers),
      viewsGrowth30dPct: Number(s.viewsGrowth30dPct),
      rank: s.rankByGrowth,
    }));

  return {
    kpis: {
      totalViews,
      totalSubscribers,
      totalVideos,
      totalChannels,
      totalTeams: summaries.length,
      freshnessStatus,
      lastSyncedAt: latestSync,
    },
    topTeamsByViews,
    topTeamsByGrowth,
  };
}

/**
 * Get full YouTube details for a specific team
 */
async function getTeamYouTubeDetails(teamId) {
  const team = await Team.findByPk(teamId);
  if (!team) {
    throw new Error(`Team with id ${teamId} not found`);
  }

  let summary = await TeamYouTubeSummary.findOne({
    where: { teamId },
    include: [{ model: Team, as: 'team', attributes: ['id', 'name', 'description'] }],
  });

  if (!summary) {
    summary = await aggregateTeamYouTubeSummary(teamId);
  }

  const channels = await YouTubeChannel.findAll({
    where: { teamId, status: 'ACTIVE' },
    include: [
      {
        model: YouTubeChannelMetric,
        as: 'metrics',
        limit: 1,
        order: [['capturedAt', 'DESC']],
      },
    ],
  });

  const channelIds = channels.map((c) => c.id);

  // Top 10 videos
  const topVideos = await YouTubeVideo.findAll({
    where: { channelId: { [Op.in]: channelIds.length > 0 ? channelIds : [-1] }, status: 'ACTIVE' },
    include: [
      {
        model: YouTubeVideoMetric,
        as: 'metrics',
        limit: 1,
        order: [['capturedAt', 'DESC']],
      },
      {
        model: YouTubeChannel,
        as: 'channel',
        attributes: ['id', 'title', 'channelId'],
      },
    ],
  });

  const formattedVideos = topVideos
    .map((v) => {
      const metric = v.metrics && v.metrics.length > 0 ? v.metrics[0] : null;
      return {
        id: v.id,
        videoId: v.videoId,
        title: v.title,
        publishedAt: v.publishedAt,
        thumbnailUrl: v.thumbnailUrl,
        channelTitle: v.channel ? v.channel.title : '',
        views: metric ? Number(metric.views) : 0,
        likes: metric ? Number(metric.likes) : 0,
        comments: metric ? Number(metric.comments) : 0,
      };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  // 30D historical snapshots
  const t30d = new Date(Date.now() - 30 * 86400000);
  const metrics30d = await YouTubeChannelMetric.findAll({
    where: {
      channelId: { [Op.in]: channelIds.length > 0 ? channelIds : [-1] },
      capturedAt: { [Op.gte]: t30d },
    },
    order: [['capturedAt', 'ASC']],
  });

  // Group daily totals for charts
  const dailyMap = {};
  for (const m of metrics30d) {
    const day = new Date(m.capturedAt).toISOString().split('T')[0];
    if (!dailyMap[day]) {
      dailyMap[day] = { date: day, views: 0, subscribers: 0 };
    }
    dailyMap[day].views += Number(m.views);
    dailyMap[day].subscribers += Number(m.subscribers);
  }
  const history = Object.values(dailyMap);

  return {
    team: { id: team.id, name: team.name, description: team.description },
    summary,
    channels: channels.map((c) => {
      const m = c.metrics && c.metrics.length > 0 ? c.metrics[0] : null;
      return {
        id: c.id,
        channelId: c.channelId,
        title: c.title,
        customUrl: c.customUrl,
        thumbnailUrl: c.thumbnailUrl,
        status: c.status,
        syncStatus: c.syncStatus,
        lastSyncedAt: c.lastSyncedAt,
        lastSyncError: c.lastSyncError,
        views: m ? Number(m.views) : 0,
        subscribers: m ? Number(m.subscribers) : 0,
        videosCount: m ? Number(m.videosCount) : 0,
      };
    }),
    topVideos: formattedVideos,
    history,
  };
}

/**
 * Compare two teams' YouTube performance side-by-side
 */
async function compareTeams(teamIdA, teamIdB) {
  const [dataA, dataB] = await Promise.all([
    getTeamYouTubeDetails(teamIdA),
    getTeamYouTubeDetails(teamIdB),
  ]);

  return {
    teamA: {
      id: dataA.team.id,
      name: dataA.team.name,
      channelsCount: Number(dataA.summary.channelsCount),
      videosCount: Number(dataA.summary.videosCount),
      totalViews: Number(dataA.summary.totalViews),
      totalSubscribers: Number(dataA.summary.totalSubscribers),
      views7d: Number(dataA.summary.views7d),
      views30d: Number(dataA.summary.views30d),
      subscriberGrowth30d: Number(dataA.summary.subscriberGrowth30d),
      viewsGrowth30dPct: Number(dataA.summary.viewsGrowth30dPct),
      subGrowth30dPct: Number(dataA.summary.subGrowth30dPct),
      topVideoTitle: dataA.summary.topVideoTitle,
      topVideoViews: Number(dataA.summary.topVideoViews),
      rankByViews: dataA.summary.rankByViews,
    },
    teamB: {
      id: dataB.team.id,
      name: dataB.team.name,
      channelsCount: Number(dataB.summary.channelsCount),
      videosCount: Number(dataB.summary.videosCount),
      totalViews: Number(dataB.summary.totalViews),
      totalSubscribers: Number(dataB.summary.totalSubscribers),
      views7d: Number(dataB.summary.views7d),
      views30d: Number(dataB.summary.views30d),
      subscriberGrowth30d: Number(dataB.summary.subscriberGrowth30d),
      viewsGrowth30dPct: Number(dataB.summary.viewsGrowth30dPct),
      subGrowth30dPct: Number(dataB.summary.subGrowth30dPct),
      topVideoTitle: dataB.summary.topVideoTitle,
      topVideoViews: Number(dataB.summary.topVideoViews),
      rankByViews: dataB.summary.rankByViews,
    },
  };
}

/**
 * Get YouTube Team Leaderboard (paginated, sorted by metric)
 */
async function getYouTubeTeamLeaderboard(params = {}) {
  const { sortBy = 'views', limit = 50, page = 1 } = params;
  const offset = (Number(page) - 1) * Number(limit);

  let order;
  if (sortBy === 'subscribers') {
    order = [['rankBySubs', 'ASC'], ['totalSubscribers', 'DESC']];
  } else if (sortBy === 'growth') {
    order = [['rankByGrowth', 'ASC'], ['viewsGrowth30dPct', 'DESC']];
  } else {
    order = [['rankByViews', 'ASC'], ['totalViews', 'DESC']];
  }

  const { rows, count } = await TeamYouTubeSummary.findAndCountAll({
    include: [{ model: Team, as: 'team', attributes: ['id', 'name', 'description'] }],
    order,
    limit: Number(limit),
    offset,
  });

  return {
    items: rows.map((r) => ({
      id: r.id,
      teamId: r.teamId,
      teamName: r.team ? r.team.name : `Team ${r.teamId}`,
      channelsCount: r.channelsCount,
      videosCount: r.videosCount,
      totalViews: Number(r.totalViews),
      totalSubscribers: Number(r.totalSubscribers),
      viewsToday: Number(r.viewsToday),
      views7d: Number(r.views7d),
      views30d: Number(r.views30d),
      subscribersToday: Number(r.subscribersToday),
      subscriberGrowth7d: Number(r.subscriberGrowth7d),
      subscriberGrowth30d: Number(r.subscriberGrowth30d),
      viewsGrowth30dPct: Number(r.viewsGrowth30dPct),
      subGrowth30dPct: Number(r.subGrowth30dPct),
      topVideoTitle: r.topVideoTitle,
      topVideoViews: Number(r.topVideoViews),
      rank: sortBy === 'subscribers' ? r.rankBySubs : (sortBy === 'growth' ? r.rankByGrowth : r.rankByViews),
      freshnessStatus: r.freshnessStatus,
      lastSyncedAt: r.lastSyncedAt,
    })),
    total: count,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(count / Number(limit)),
    sortBy,
  };
}

module.exports = {
  aggregateTeamYouTubeSummary,
  recalculateAllTeamYouTubeSummaries,
  getCompanyYouTubeOverview,
  getTeamYouTubeDetails,
  compareTeams,
  getYouTubeTeamLeaderboard,
};
