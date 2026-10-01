'use strict';

const { Op } = require('sequelize');
const {
  Team,
  YouTubeChannel,
  YouTubeChannelMetric,
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

  // Calculate percentage growths safely (clamped to DECIMAL(10,4) limit [-999999.9999, 999999.9999])
  const baselineViews30d = Math.max(0, totalViews - views30d);
  const rawViewsGrowth = baselineViews30d > 0 ? (views30d / baselineViews30d) * 100 : (totalViews > 0 ? 100.0 : 0.0);
  const viewsGrowth30dPct = Number(Math.min(999999.9999, Math.max(-999999.9999, rawViewsGrowth)).toFixed(4));

  const baselineSubs30d = Math.max(0, totalSubscribers - subscriberGrowth30d);
  const rawSubGrowth = baselineSubs30d > 0 ? (subscriberGrowth30d / baselineSubs30d) * 100 : (totalSubscribers > 0 ? 100.0 : 0.0);
  const subGrowth30dPct = Number(Math.min(999999.9999, Math.max(-999999.9999, rawSubGrowth)).toFixed(4));

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
      freshnessStatus,
      lastSyncedAt,
    },
    transaction: options.transaction,
  });

  await summary.update(
    {
      channelsCount,
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
 * Aggregates across ALL active channels in the system (both team-assigned and unassigned).
 */
async function getCompanyYouTubeOverview() {
  const summaries = await TeamYouTubeSummary.findAll({
    include: [{ model: Team, as: 'team', attributes: ['id', 'name', 'description'] }],
  });

  const allChannels = await YouTubeChannel.findAll({
    where: { status: 'ACTIVE' },
    include: [
      {
        model: YouTubeChannelMetric,
        as: 'metrics',
        limit: 1,
        order: [['capturedAt', 'DESC']],
      },
    ],
  });

  const now = new Date();
  const t30d = new Date(now.getTime() - 30 * 86400000);

  let totalViews = 0;
  let totalSubscribers = 0;
  let totalChannels = allChannels.length;
  let unassignedChannelsCount = 0;
  let unassignedViews = 0;
  let unassignedSubscribers = 0;
  let companyViews30d = 0;
  let latestSync = null;
  let hasStale = false;
  let hasFailed = false;

  for (const channel of allChannels) {
    const isUnassigned = !channel.teamId;
    if (isUnassigned) unassignedChannelsCount++;

    if (channel.lastSyncedAt && (!latestSync || new Date(channel.lastSyncedAt) > new Date(latestSync))) {
      latestSync = channel.lastSyncedAt;
    }
    if (channel.syncStatus === 'ERROR' || channel.lastSyncError) {
      hasFailed = true;
    } else if (!channel.lastSyncedAt || (now.getTime() - new Date(channel.lastSyncedAt).getTime() > 2 * 3600000)) {
      hasStale = true;
    }

    const latestMetric = channel.metrics && channel.metrics.length > 0 ? channel.metrics[0] : null;
    if (latestMetric) {
      const cViews = Number(latestMetric.views || 0);
      const cSubs = Number(latestMetric.subscribers || 0);

      totalViews += cViews;
      totalSubscribers += cSubs;

      if (isUnassigned) {
        unassignedViews += cViews;
        unassignedSubscribers += cSubs;
      }

      // Calculate 30d views delta for this channel
      const metric30d = await YouTubeChannelMetric.findOne({
        where: {
          channelId: channel.id,
          capturedAt: { [Op.lte]: t30d },
        },
        order: [['capturedAt', 'DESC']],
      });
      if (metric30d) {
        companyViews30d += Math.max(0, cViews - Number(metric30d.views));
      } else {
        companyViews30d += cViews;
      }
    }
  }

  // Company 30D views growth percentage
  const baselineViews30d = Math.max(0, totalViews - companyViews30d);
  const rawViewsGrowth = baselineViews30d > 0
    ? (companyViews30d / baselineViews30d) * 100
    : (totalViews > 0 ? 100.0 : 0.0);
  const viewsGrowth30dPct = Number(Math.min(999999.9999, Math.max(-999999.9999, rawViewsGrowth)).toFixed(2));

  // Company freshness status: FRESH if any channel synced within last 2h, STALE if no recent sync
  let freshnessStatus = 'FRESH';
  if (hasFailed && !latestSync) {
    freshnessStatus = 'FAILED';
  } else if (!latestSync || (Date.now() - new Date(latestSync).getTime() > 2 * 3600000)) {
    freshnessStatus = 'STALE';
  }

  // Top Teams by Views
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

  // Top Teams by Growth
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
      totalChannels,
      totalTeams: summaries.length,
      unassignedChannelsCount,
      unassignedViews,
      unassignedSubscribers,
      viewsGrowth30dPct,
      freshnessStatus,
      lastSyncedAt: latestSync,
    },
    topTeamsByViews,
    topTeamsByGrowth,
    unassignedSummary: {
      totalChannels: unassignedChannelsCount,
      totalViews: unassignedViews,
      totalSubscribers: unassignedSubscribers,
    },
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
      };
    }),
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
      totalViews: Number(dataA.summary.totalViews),
      totalSubscribers: Number(dataA.summary.totalSubscribers),
      views7d: Number(dataA.summary.views7d),
      views30d: Number(dataA.summary.views30d),
      subscriberGrowth30d: Number(dataA.summary.subscriberGrowth30d),
      viewsGrowth30dPct: Number(dataA.summary.viewsGrowth30dPct),
      subGrowth30dPct: Number(dataA.summary.subGrowth30dPct),
      rankByViews: dataA.summary.rankByViews,
    },
    teamB: {
      id: dataB.team.id,
      name: dataB.team.name,
      channelsCount: Number(dataB.summary.channelsCount),
      totalViews: Number(dataB.summary.totalViews),
      totalSubscribers: Number(dataB.summary.totalSubscribers),
      views7d: Number(dataB.summary.views7d),
      views30d: Number(dataB.summary.views30d),
      subscriberGrowth30d: Number(dataB.summary.subscriberGrowth30d),
      viewsGrowth30dPct: Number(dataB.summary.viewsGrowth30dPct),
      subGrowth30dPct: Number(dataB.summary.subGrowth30dPct),
      rankByViews: dataB.summary.rankByViews,
    },
  };
}



/**
 * Get YouTube Team Leaderboard (ranks all teams by YouTube aggregated metrics)
 */
async function getYouTubeTeamLeaderboard(params = {}) {
  const {
    sortBy = 'views',
    search = '',
    limit = 50,
    page = 1,
  } = params;

  let summaries = await TeamYouTubeSummary.findAll({
    include: [{ model: Team, as: 'team', attributes: ['id', 'name', 'description'] }],
  });

  if (summaries.length === 0) {
    await recalculateAllTeamYouTubeSummaries();
    summaries = await TeamYouTubeSummary.findAll({
      include: [{ model: Team, as: 'team', attributes: ['id', 'name', 'description'] }],
    });
  }

  let formatted = summaries.map((s) => ({
    teamId: s.teamId,
    teamName: s.team ? s.team.name : `Team ${s.teamId}`,
    team: s.team ? { id: s.team.id, name: s.team.name, description: s.team.description } : null,
    channelsCount: Number(s.channelsCount || 0),
    totalViews: Number(s.totalViews || 0),
    totalSubscribers: Number(s.totalSubscribers || 0),
    views30d: Number(s.views30d || 0),
    subscriberGrowth30d: Number(s.subscriberGrowth30d || 0),
    viewsGrowth30dPct: Number(s.viewsGrowth30dPct || 0),
    subGrowth30dPct: Number(s.subGrowth30dPct || 0),
    lastSyncedAt: s.lastSyncedAt,
  }));

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    formatted = formatted.filter((t) => t.teamName.toLowerCase().includes(q));
  }

  if (sortBy === 'subscribers') {
    formatted.sort((a, b) => b.totalSubscribers - a.totalSubscribers || b.totalViews - a.totalViews);
  } else if (sortBy === 'growth') {
    formatted.sort((a, b) => b.viewsGrowth30dPct - a.viewsGrowth30dPct || b.totalViews - a.totalViews);
  } else {
    formatted.sort((a, b) => b.totalViews - a.totalViews || b.totalSubscribers - a.totalSubscribers);
  }

  const ranked = formatted.map((t, idx) => ({ ...t, rank: idx + 1 }));
  const numLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const numPage = Math.max(1, Number(page) || 1);
  const offset = (numPage - 1) * numLimit;
  const paginated = ranked.slice(offset, offset + numLimit);

  return {
    items: paginated,
    teams: paginated,
    total: ranked.length,
    page: numPage,
    limit: numLimit,
    totalPages: Math.max(1, Math.ceil(ranked.length / numLimit)),
    sortBy,
  };
}

/**
 * Get YouTube Channel Leaderboard (ranks all active channels, assigned and unassigned)
 */
async function getYouTubeChannelLeaderboard(params = {}) {
  const {
    teamId = null,
    sortBy = 'views',
    search = '',
    limit = 50,
    page = 1,
  } = params;

  const where = { status: 'ACTIVE' };
  if (teamId === 'unassigned' || teamId === 'null') {
    where.teamId = null;
  } else if (teamId && teamId !== 'all') {
    where.teamId = Number(teamId);
  }

  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    where[Op.or] = [
      { title: { [Op.like]: q } },
      { channelId: { [Op.like]: q } },
      { customUrl: { [Op.like]: q } },
    ];
  }

  const allChannels = await YouTubeChannel.findAll({
    where,
    include: [
      { model: Team, as: 'team', attributes: ['id', 'name', 'description'] },
      {
        model: YouTubeChannelMetric,
        as: 'metrics',
        limit: 1,
        order: [['capturedAt', 'DESC']],
      },
    ],
  });

  const now = new Date();
  const t30d = new Date(now.getTime() - 30 * 86400000);

  // Compute metrics and 30d deltas for all matching channels
  const channelsWithMetrics = await Promise.all(
    allChannels.map(async (c) => {
      const latestMetric = c.metrics && c.metrics.length > 0 ? c.metrics[0] : null;
      const views = latestMetric ? Number(latestMetric.views || 0) : 0;
      const subscribers = latestMetric ? Number(latestMetric.subscribers || 0) : 0;

      // 30 days ago metric
      let views30d = 0;
      let viewsGrowth30dPct = 0;

      if (latestMetric) {
        const metric30d = await YouTubeChannelMetric.findOne({
          where: {
            channelId: c.id,
            capturedAt: { [Op.lte]: t30d },
          },
          order: [['capturedAt', 'DESC']],
        });

        if (metric30d) {
          views30d = Math.max(0, views - Number(metric30d.views || 0));
        } else {
          views30d = views;
        }

        const baseline = Math.max(0, views - views30d);
        const rawGrowth = baseline > 0 ? (views30d / baseline) * 100 : (views > 0 ? 100.0 : 0.0);
        viewsGrowth30dPct = Number(Math.min(999999.9999, Math.max(-999999.9999, rawGrowth)).toFixed(2));
      }

      return {
        id: c.id,
        channelId: c.channelId,
        title: c.title,
        customUrl: c.customUrl,
        thumbnailUrl: c.thumbnailUrl,
        teamId: c.teamId,
        teamName: c.team ? c.team.name : 'Chưa gán đội',
        team: c.team ? { id: c.team.id, name: c.team.name } : null,
        isUnassigned: !c.teamId,
        views,
        totalViews: views,
        subscribers,
        totalSubscribers: subscribers,
        views30d,
        viewsGrowth30dPct,
        syncStatus: c.syncStatus,
        lastSyncedAt: c.lastSyncedAt,
        status: c.status,
      };
    })
  );

  // Sort channels according to sortBy
  if (sortBy === 'subscribers') {
    channelsWithMetrics.sort((a, b) => b.subscribers - a.subscribers || b.views - a.views);
  } else if (sortBy === 'growth') {
    channelsWithMetrics.sort((a, b) => b.viewsGrowth30dPct - a.viewsGrowth30dPct || b.views - a.views);
  } else {
    // Default: views
    channelsWithMetrics.sort((a, b) => b.views - a.views || b.subscribers - a.subscribers);
  }

  // Assign ranked positions
  const ranked = channelsWithMetrics.map((c, idx) => ({
    ...c,
    rank: idx + 1,
  }));

  const numLimit = Math.max(1, Math.min(1000, Number(limit) || 50));
  const numPage = Math.max(1, Number(page) || 1);
  const offset = (numPage - 1) * numLimit;
  const paginated = ranked.slice(offset, offset + numLimit);

  return {
    items: paginated,
    channels: paginated,
    total: ranked.length,
    page: numPage,
    limit: numLimit,
    totalPages: Math.max(1, Math.ceil(ranked.length / numLimit)),
    sortBy,
    teamId,
  };
}

module.exports = {
  aggregateTeamYouTubeSummary,
  recalculateAllTeamYouTubeSummaries,
  getCompanyYouTubeOverview,
  getTeamYouTubeDetails,
  compareTeams,
  getYouTubeTeamLeaderboard,
  getYouTubeChannelLeaderboard,
};

