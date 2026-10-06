'use strict';

const { Op } = require('sequelize');
const {
  Team,
  YouTubeChannel,
  YouTubeChannelMetric,
  TeamYouTubeSummary,
  User,
  CompetitionUserSummary,
  UserProfilePreference,
  sequelize,
} = require('../../models');
const { resolveChannelBaseline, calculateGrowth } = require('./youtubeData.service');

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
        viewsGrowth30dPct: null,
        subGrowth30dPct: null,
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
        viewsGrowth30dPct: null,
        subGrowth30dPct: null,
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

  let teamBaselineViews = 0;
  let teamBaselineSubs = 0;
  let teamViewsDelta = 0;
  let teamSubsDelta = 0;
  let hasAnyElapsedMeasurement = false;

  for (const channel of channels) {
    if (channel.lastSyncedAt && (!lastSyncedAt || new Date(channel.lastSyncedAt) > new Date(lastSyncedAt))) {
      lastSyncedAt = channel.lastSyncedAt;
    }
    if (channel.lastSyncError) {
      hasSyncError = true;
    }

    const baseRes = await resolveChannelBaseline(channel.id, t30d, { transaction: options.transaction });
    if (baseRes.latestMetric) {
      totalViews += baseRes.currentViews;
      totalSubscribers += baseRes.currentSubscribers;

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
        viewsToday += Math.max(0, baseRes.currentViews - Number(todayMetric.views));
        subscribersToday += (baseRes.currentSubscribers - Number(todayMetric.subscribers));
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
        views7d += Math.max(0, baseRes.currentViews - Number(metric7d.views));
        subscriberGrowth7d += (baseRes.currentSubscribers - Number(metric7d.subscribers));
      } else if (baseRes.hasElapsedMeasurement && baseRes.baselineMetric) {
        views7d += Math.max(0, baseRes.currentViews - Number(baseRes.baselineMetric.views || 0));
        subscriberGrowth7d += (baseRes.currentSubscribers - Number(baseRes.baselineMetric.subscribers || 0));
      }

      // 30 days / lookback baseline
      if (baseRes.hasElapsedMeasurement && baseRes.growthStatus === 'AVAILABLE' && baseRes.baselineViews !== null && baseRes.baselineViews > 0 && baseRes.viewsGrowthPct !== null) {
        hasAnyElapsedMeasurement = true;
        teamBaselineViews += baseRes.baselineViews;
        const cDelta = Math.max(0, baseRes.currentViews - baseRes.baselineViews);
        teamViewsDelta += cDelta;
        views30d += cDelta;
      } else if (baseRes.baselineViews !== null && baseRes.baselineViews > 0) {
        // Channel onboarded recently with 1 snapshot or insufficient data:
        // Its baseline for this period is its current views, delta is 0!
        teamBaselineViews += baseRes.currentViews;
      }

      if (baseRes.hasElapsedMeasurement && baseRes.subGrowthStatus === 'AVAILABLE' && baseRes.baselineSubscribers !== null && baseRes.baselineSubscribers > 0 && baseRes.subGrowthPct !== null) {
        teamBaselineSubs += baseRes.baselineSubscribers;
        const sDelta = (baseRes.currentSubscribers - baseRes.baselineSubscribers);
        teamSubsDelta += sDelta;
        subscriberGrowth30d += sDelta;
      } else if (baseRes.baselineSubscribers !== null && baseRes.baselineSubscribers > 0) {
        teamBaselineSubs += baseRes.currentSubscribers;
      }
    }
  }

  // Calculate percentage growths safely:
  // If no channels have had an elapsed measurement yet, or baseline <= 0 -> growth is strictly null
  let viewsGrowth30dPct = null;
  if (hasAnyElapsedMeasurement && teamBaselineViews > 0) {
    const rawViewsGrowth = (teamViewsDelta / teamBaselineViews) * 100;
    if (rawViewsGrowth <= 5000.0) {
      viewsGrowth30dPct = Number(Math.min(999.9, Math.max(-100.0, rawViewsGrowth)).toFixed(1));
    }
  }

  let subGrowth30dPct = null;
  if (hasAnyElapsedMeasurement && teamBaselineSubs > 0) {
    const rawSubGrowth = (teamSubsDelta / teamBaselineSubs) * 100;
    if (rawSubGrowth <= 5000.0) {
      subGrowth30dPct = Number(Math.min(999.9, Math.max(-100.0, rawSubGrowth)).toFixed(1));
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
  const allSummaries = await TeamYouTubeSummary.findAll({
    transaction: options.transaction,
  });
  const byGrowth = [...allSummaries].sort((a, b) => {
    const aG = a.viewsGrowth30dPct !== null && a.viewsGrowth30dPct !== undefined ? Number(a.viewsGrowth30dPct) : null;
    const bG = b.viewsGrowth30dPct !== null && b.viewsGrowth30dPct !== undefined ? Number(b.viewsGrowth30dPct) : null;
    if (aG !== null && bG !== null) {
      return bG - aG || Number(b.totalViews) - Number(a.totalViews);
    }
    if (aG !== null && bG === null) return -1;
    if (aG === null && bG !== null) return 1;
    return Number(b.totalViews) - Number(a.totalViews) || Number(a.id) - Number(b.id);
  });
  for (let i = 0; i < byGrowth.length; i++) {
    byGrowth[i].rankByGrowth = i + 1;
    await byGrowth[i].save(options);
  }

  return { totalTeams: teams.length, status: 'RECALCULATED' };
}

/**
 * Helper to compute daily aggregated history for a list of channel IDs over a period.
 * Periods supported: '7d', '30d', '90d', '12m'.
 * Avoids double-counting multiple syncs per day by taking the latest metric per day per channel.
 * Carries forward latest known metric so days without sync don't artificially drop to zero.
 */
async function getChannelsHistory(channelIds, period = '30d') {
  if (!Array.isArray(channelIds) || channelIds.length === 0) {
    return [];
  }

  const now = new Date();
  let daysCount = 30;
  if (period === '7d') daysCount = 7;
  else if (period === '90d') daysCount = 90;
  else if (period === '12m') daysCount = 365;

  const startDate = new Date(now.getTime() - daysCount * 86400000);

  const metrics = await YouTubeChannelMetric.findAll({
    where: {
      channelId: { [Op.in]: channelIds },
      capturedAt: { [Op.gte]: startDate },
    },
    order: [['capturedAt', 'ASC']],
  });

  if (metrics.length === 0) {
    const latestMetrics = await YouTubeChannelMetric.findAll({
      where: { channelId: { [Op.in]: channelIds } },
      order: [['capturedAt', 'DESC']],
      limit: channelIds.length,
    });
    if (latestMetrics.length > 0) {
      const today = now.toISOString().split('T')[0];
      const sumViews = latestMetrics.reduce((acc, m) => acc + Number(m.views || 0), 0);
      const sumSubs = latestMetrics.reduce((acc, m) => acc + Number(m.subscribers || 0), 0);
      return [{ date: today, views: sumViews, subscribers: sumSubs }];
    }
    return [];
  }

  const byDateAndChannel = {};
  const datesSet = new Set();

  for (const m of metrics) {
    const day = new Date(m.capturedAt).toISOString().split('T')[0];
    datesSet.add(day);
    if (!byDateAndChannel[day]) byDateAndChannel[day] = {};
    byDateAndChannel[day][m.channelId] = {
      views: Number(m.views || 0),
      subscribers: Number(m.subscribers || 0),
    };
  }

  const sortedDates = Array.from(datesSet).sort();
  const latestKnown = {};
  const history = [];

  for (const day of sortedDates) {
    const dayData = byDateAndChannel[day] || {};
    for (const chId of channelIds) {
      if (dayData[chId]) {
        latestKnown[chId] = dayData[chId];
      }
    }

    let dayTotalViews = 0;
    let dayTotalSubs = 0;
    for (const chId of channelIds) {
      if (latestKnown[chId]) {
        dayTotalViews += latestKnown[chId].views;
        dayTotalSubs += latestKnown[chId].subscribers;
      }
    }

    history.push({
      date: day,
      views: dayTotalViews,
      subscribers: dayTotalSubs,
    });
  }

  return history;
}

/**
 * Get Company-wide YouTube Overview & Metrics
 * Aggregates across ALL active channels in the system (both team-assigned and unassigned).
 */
async function getCompanyYouTubeOverview(options = {}) {
  const period = typeof options === 'string' ? options : (options?.period || '30d');

  const summaries = await TeamYouTubeSummary.findAll({
    include: [{ model: Team, as: 'team', attributes: ['id', 'name', 'description'] }],
  });

  const allChannels = await YouTubeChannel.findAll({
    where: { status: 'ACTIVE' },
    include: [
      {
        model: Team,
        as: 'team',
        attributes: ['id', 'name', 'description'],
      },
      {
        model: YouTubeChannelMetric,
        as: 'metrics',
        limit: 1,
        order: [['capturedAt', 'DESC']],
      },
    ],
  });

  const now = new Date();
  let daysCount = 30;
  if (period === '7d') daysCount = 7;
  else if (period === '90d') daysCount = 90;
  else if (period === '12m') daysCount = 365;

  const tPeriod = new Date(now.getTime() - daysCount * 86400000);

  let totalViews = 0;
  let totalSubscribers = 0;
  let totalChannels = allChannels.length;
  let unassignedChannelsCount = 0;
  let unassignedViews = 0;
  let unassignedSubscribers = 0;
  let companyViewsPeriodDelta = 0;
  let companySubsPeriodDelta = 0;
  let totalBaselineViews = 0;
  let totalBaselineSubs = 0;
  let hasValidBaseline = false;
  let latestSync = null;
  let hasStale = false;
  let hasFailed = false;

  const channelIds = allChannels.map((c) => c.id);

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

      const baseRes = await resolveChannelBaseline(channel.id, tPeriod, {
        latestMetric,
        period,
      });

      if (baseRes.hasElapsedMeasurement && baseRes.growthStatus === 'AVAILABLE' && baseRes.baselineViews !== null && baseRes.baselineViews > 0 && baseRes.viewsGrowthPct !== null) {
        hasValidBaseline = true;
        totalBaselineViews += baseRes.baselineViews;
        companyViewsPeriodDelta += Math.max(0, cViews - baseRes.baselineViews);
      } else if (baseRes.baselineViews !== null && baseRes.baselineViews > 0) {
        totalBaselineViews += cViews;
      }

      if (baseRes.hasElapsedMeasurement && baseRes.subGrowthStatus === 'AVAILABLE' && baseRes.baselineSubscribers !== null && baseRes.baselineSubscribers > 0 && baseRes.subGrowthPct !== null) {
        totalBaselineSubs += baseRes.baselineSubscribers;
        companySubsPeriodDelta += (cSubs - baseRes.baselineSubscribers);
      } else if (baseRes.baselineSubscribers !== null && baseRes.baselineSubscribers > 0) {
        totalBaselineSubs += cSubs;
      }
    }
  }

  // Real statistical growth percentage (null if no baseline exists)
  let viewsGrowthPct = null;
  let subGrowthPct = null;
  if (hasValidBaseline && totalBaselineViews > 0) {
    const rawGrowth = (companyViewsPeriodDelta / totalBaselineViews) * 100;
    if (rawGrowth <= 5000.0) {
      viewsGrowthPct = Number(Math.min(999.9, Math.max(-100.0, rawGrowth)).toFixed(1));
    }
  }
  if (hasValidBaseline && totalBaselineSubs > 0) {
    const rawSubGrowth = (companySubsPeriodDelta / totalBaselineSubs) * 100;
    if (rawSubGrowth <= 5000.0) {
      subGrowthPct = Number(Math.min(999.9, Math.max(-100.0, rawSubGrowth)).toFixed(1));
    }
  }

  // Company freshness status
  let freshnessStatus = 'FRESH';
  if (hasFailed && !latestSync) {
    freshnessStatus = 'FAILED';
  } else if (!latestSync || (Date.now() - new Date(latestSync).getTime() > 2 * 3600000)) {
    freshnessStatus = 'STALE';
  }

  // Company-wide time-series history
  const history = await getChannelsHistory(channelIds, period);

  // Top Teams by Views
  const topTeamsByViews = [...summaries]
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 5)
    .map((s) => ({
      teamId: s.teamId,
      teamName: s.team ? s.team.name : `Team ${s.teamId}`,
      totalViews: Number(s.totalViews),
      totalSubscribers: Number(s.totalSubscribers),
      viewsGrowth30dPct: s.viewsGrowth30dPct !== null && s.viewsGrowth30dPct !== undefined ? Number(Number(s.viewsGrowth30dPct).toFixed(1)) : null,
      rank: s.rankByViews,
    }));

  // Top Teams by Growth (teams with valid growth rank first)
  const topTeamsByGrowth = [...summaries]
    .sort((a, b) => {
      const aG = a.viewsGrowth30dPct !== null && a.viewsGrowth30dPct !== undefined ? Number(a.viewsGrowth30dPct) : null;
      const bG = b.viewsGrowth30dPct !== null && b.viewsGrowth30dPct !== undefined ? Number(b.viewsGrowth30dPct) : null;
      if (aG !== null && bG !== null) return bG - aG || Number(b.totalViews) - Number(a.totalViews);
      if (aG !== null && bG === null) return -1;
      if (aG === null && bG !== null) return 1;
      return Number(b.totalViews) - Number(a.totalViews);
    })
    .slice(0, 5)
    .map((s) => ({
      teamId: s.teamId,
      teamName: s.team ? s.team.name : `Team ${s.teamId}`,
      totalViews: Number(s.totalViews),
      totalSubscribers: Number(s.totalSubscribers),
      viewsGrowth30dPct: s.viewsGrowth30dPct !== null && s.viewsGrowth30dPct !== undefined ? Number(Number(s.viewsGrowth30dPct).toFixed(1)) : null,
      rank: s.rankByGrowth,
    }));

  // All teams formatted with rank
  const allTeams = summaries
    .map((s) => ({
      teamId: s.teamId,
      teamName: s.team ? s.team.name : `Team ${s.teamId}`,
      channelsCount: Number(s.channelsCount || 0),
      totalViews: Number(s.totalViews || 0),
      totalSubscribers: Number(s.totalSubscribers || 0),
      views30d: Number(s.views30d || 0),
      viewsGrowth30dPct: s.viewsGrowth30dPct !== null && s.viewsGrowth30dPct !== undefined ? Number(Number(s.viewsGrowth30dPct).toFixed(1)) : null,
      subGrowth30dPct: s.subGrowth30dPct !== null && s.subGrowth30dPct !== undefined ? Number(Number(s.subGrowth30dPct).toFixed(1)) : null,
      rankByViews: s.rankByViews,
      rankBySubs: s.rankBySubs,
      rankByGrowth: s.rankByGrowth,
      freshnessStatus: s.freshnessStatus,
      lastSyncedAt: s.lastSyncedAt,
    }))
    .sort((a, b) => b.totalViews - a.totalViews);

  return {
    kpis: {
      totalViews,
      totalSubscribers,
      totalChannels,
      totalTeams: summaries.length,
      unassignedChannelsCount,
      unassignedViews,
      unassignedSubscribers,
      viewsGrowthPct,
      subGrowthPct,
      viewsGrowth30dPct: viewsGrowthPct,
      freshnessStatus,
      lastSyncedAt: latestSync,
    },
    topTeamsByViews,
    topTeamsByGrowth,
    allTeams,
    unassignedSummary: {
      totalChannels: unassignedChannelsCount,
      totalViews: unassignedViews,
      totalSubscribers: unassignedSubscribers,
    },
    history,
    period,
  };
}

/**
 * Get full YouTube details for a specific team
 */
async function getTeamYouTubeDetails(teamId, options = {}) {
  const period = typeof options === 'string' ? options : (options?.period || '30d');
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
  const history = await getChannelsHistory(channelIds, period);

  const t30d = new Date(Date.now() - 30 * 86400000);
  const channelsWithMetrics = await Promise.all(
    channels.map(async (c) => {
      const m = c.metrics && c.metrics.length > 0 ? c.metrics[0] : null;
      const baseRes = await resolveChannelBaseline(c.id, t30d, { latestMetric: m });
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
        views: baseRes.currentViews,
        subscribers: baseRes.currentSubscribers,
        viewsGrowth30dPct: baseRes.viewsGrowthPct,
        growthPercent: baseRes.growthPercent,
        growthStatus: baseRes.growthStatus,
        growthContext: baseRes.growthContext,
      };
    })
  );

  return {
    team: { id: team.id, name: team.name, description: team.description },
    summary: summary ? {
      ...summary.toJSON(),
      viewsGrowth30dPct: summary.viewsGrowth30dPct !== null && summary.viewsGrowth30dPct !== undefined ? Number(Number(summary.viewsGrowth30dPct).toFixed(1)) : null,
      subGrowth30dPct: summary.subGrowth30dPct !== null && summary.subGrowth30dPct !== undefined ? Number(Number(summary.subGrowth30dPct).toFixed(1)) : null,
    } : null,
    channels: channelsWithMetrics,
    history,
    period,
  };
}

/**
 * Get Authenticated Member's Personal YouTube & Team Dashboard Data ("CỦA TÔI")
 */
async function getMyYouTubeDashboard(userId, userTeamId, options = {}) {
  const period = typeof options === 'string' ? options : (options?.period || '30d');

  // 1. User Profile & Canonical All-Time Ranking
  const user = await User.findByPk(userId, {
    attributes: ['id', 'name', 'email', 'role', 'teamId', 'jobTitle', 'department', 'isVerified', 'isDev'],
    include: [
      { model: UserProfilePreference, attributes: ['avatarData', 'featuredBadges'] },
      { model: CompetitionUserSummary, as: 'competitionSummary' },
      { model: Team, attributes: ['id', 'name'] },
    ],
  });

  let ranking = null;
  if (user) {
    const allUsers = await User.findAll({
      where: { status: { [Op.ne]: 'inactive' } },
      attributes: ['id', 'name', 'createdAt'],
      include: [
        { model: CompetitionUserSummary, as: 'competitionSummary' },
      ],
    });

    allUsers.sort((a, b) => {
      const aScore = Number(a.competitionSummary?.currentSeasonScore || 0);
      const bScore = Number(b.competitionSummary?.currentSeasonScore || 0);
      if (bScore !== aScore) return bScore - aScore;
      const aWins = Number(a.competitionSummary?.seasonWins || 0);
      const bWins = Number(b.competitionSummary?.seasonWins || 0);
      if (bWins !== aWins) return bWins - aWins;
      return Number(a.id) - Number(b.id);
    });

    const userIndex = allUsers.findIndex((u) => Number(u.id) === Number(userId));
    const leaderScore = Number(allUsers[0]?.competitionSummary?.currentSeasonScore || 0);
    const userScore = Number(user.competitionSummary?.currentSeasonScore || 0);

    ranking = {
      rank: userIndex >= 0 ? userIndex + 1 : 1,
      totalUsers: allUsers.length,
      score: userScore,
      leaderScore,
      gap: Math.max(0, leaderScore - userScore),
      trend: 'SAME',
    };
  }

  // 2. User Team Information
  let teamDetails = null;
  const effectiveTeamId = userTeamId || user?.teamId;
  if (effectiveTeamId) {
    try {
      teamDetails = await getTeamYouTubeDetails(effectiveTeamId, { period });
    } catch {
      // Graceful fallback
    }
  }

  // 3. User's Channels (Direct assigned channels + Team channels)
  const channelWhereConditions = [
    { assignedUserId: userId },
  ];
  if (effectiveTeamId) {
    channelWhereConditions.push({ teamId: effectiveTeamId });
  }

  const userChannels = await YouTubeChannel.findAll({
    where: {
      status: 'ACTIVE',
      [Op.or]: channelWhereConditions,
    },
    include: [
      { model: Team, as: 'team', attributes: ['id', 'name'] },
      {
        model: YouTubeChannelMetric,
        as: 'metrics',
        limit: 1,
        order: [['capturedAt', 'DESC']],
      },
    ],
  });

  const channelIds = userChannels.map((c) => c.id);
  const history = await getChannelsHistory(channelIds, period);

  // Compute User Channel KPIs
  let totalViews = 0;
  let totalSubscribers = 0;
  let latestSync = null;

  const formattedChannels = userChannels.map((c) => {
    const m = c.metrics && c.metrics.length > 0 ? c.metrics[0] : null;
    const views = m ? Number(m.views) : 0;
    const subs = m ? Number(m.subscribers) : 0;
    totalViews += views;
    totalSubscribers += subs;
    if (c.lastSyncedAt && (!latestSync || new Date(c.lastSyncedAt) > new Date(latestSync))) {
      latestSync = c.lastSyncedAt;
    }
    return {
      id: c.id,
      channelId: c.channelId,
      title: c.title,
      customUrl: c.customUrl,
      thumbnailUrl: c.thumbnailUrl,
      teamId: c.teamId,
      teamName: c.team ? c.team.name : 'Chưa gán đội',
      assignedUserId: c.assignedUserId,
      isDirectlyAssigned: Number(c.assignedUserId) === Number(userId),
      views,
      subscribers: subs,
      status: c.status,
      syncStatus: c.syncStatus,
      lastSyncedAt: c.lastSyncedAt,
    };
  });

  return {
    user: user ? {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      jobTitle: user.jobTitle || 'Nhân viên',
      department: user.department || 'Media & Content',
      isVerified: Boolean(user.isVerified),
      isDev: Boolean(user.isDev),
      teamId: user.teamId,
      teamName: user.Team ? user.Team.name : null,
      avatarData: user.UserProfilePreference?.avatarData || null,
    } : null,
    ranking,
    team: teamDetails ? teamDetails.team : null,
    teamSummary: teamDetails ? teamDetails.summary : null,
    teamHasChannels: Boolean(teamDetails?.channels && teamDetails.channels.length > 0),
    channels: formattedChannels,
    kpis: {
      totalViews,
      totalSubscribers,
      totalChannels: formattedChannels.length,
      lastSyncedAt: latestSync,
    },
    history,
    period,
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
      viewsGrowth30dPct: dataA.summary?.viewsGrowth30dPct !== null && dataA.summary?.viewsGrowth30dPct !== undefined ? Number(dataA.summary.viewsGrowth30dPct) : null,
      subGrowth30dPct: dataA.summary?.subGrowth30dPct !== null && dataA.summary?.subGrowth30dPct !== undefined ? Number(dataA.summary.subGrowth30dPct) : null,
      rankByViews: dataA.summary?.rankByViews,
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
      viewsGrowth30dPct: dataB.summary?.viewsGrowth30dPct !== null && dataB.summary?.viewsGrowth30dPct !== undefined ? Number(dataB.summary.viewsGrowth30dPct) : null,
      subGrowth30dPct: dataB.summary?.subGrowth30dPct !== null && dataB.summary?.subGrowth30dPct !== undefined ? Number(dataB.summary.subGrowth30dPct) : null,
      rankByViews: dataB.summary?.rankByViews,
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
    id: s.teamId,
    teamId: s.teamId,
    teamName: s.team ? s.team.name : `Team ${s.teamId}`,
    team: s.team ? { id: s.team.id, name: s.team.name, description: s.team.description } : null,
    channelsCount: Number(s.channelsCount || 0),
    totalViews: Number(s.totalViews || 0),
    totalSubscribers: Number(s.totalSubscribers || 0),
    views30d: Number(s.views30d || 0),
    subscriberGrowth30d: Number(s.subscriberGrowth30d || 0),
    viewsGrowth30dPct: s.viewsGrowth30dPct !== null && s.viewsGrowth30dPct !== undefined && Number(s.viewsGrowth30dPct) <= 999.9 ? Number(Number(s.viewsGrowth30dPct).toFixed(1)) : null,
    growthPercent: s.viewsGrowth30dPct !== null && s.viewsGrowth30dPct !== undefined && Number(s.viewsGrowth30dPct) <= 999.9 ? Number(Number(s.viewsGrowth30dPct).toFixed(1)) : null,
    growthStatus: s.viewsGrowth30dPct !== null && s.viewsGrowth30dPct !== undefined && Number(s.viewsGrowth30dPct) <= 999.9 ? 'AVAILABLE' : 'INSUFFICIENT_DATA',
    subGrowth30dPct: s.subGrowth30dPct !== null && s.subGrowth30dPct !== undefined && Number(s.subGrowth30dPct) <= 999.9 ? Number(Number(s.subGrowth30dPct).toFixed(1)) : null,
    subGrowthPercent: s.subGrowth30dPct !== null && s.subGrowth30dPct !== undefined && Number(s.subGrowth30dPct) <= 999.9 ? Number(Number(s.subGrowth30dPct).toFixed(1)) : null,
    lastSyncedAt: s.lastSyncedAt,
  }));

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    formatted = formatted.filter((t) => t.teamName.toLowerCase().includes(q));
  }

  if (sortBy === 'subscribers') {
    formatted.sort((a, b) => b.totalSubscribers - a.totalSubscribers || b.totalViews - a.totalViews);
  } else if (sortBy === 'growth') {
    formatted.sort((a, b) => {
      if (a.viewsGrowth30dPct !== null && b.viewsGrowth30dPct !== null) {
        return b.viewsGrowth30dPct - a.viewsGrowth30dPct || b.totalViews - a.totalViews;
      }
      if (a.viewsGrowth30dPct !== null && b.viewsGrowth30dPct === null) return -1;
      if (a.viewsGrowth30dPct === null && b.viewsGrowth30dPct !== null) return 1;
      return b.totalViews - a.totalViews;
    });
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

  // Compute metrics and 30d deltas for all matching channels using canonical baseline resolution
  const channelsWithMetrics = await Promise.all(
    allChannels.map(async (c) => {
      const latestMetric = c.metrics && c.metrics.length > 0 ? c.metrics[0] : null;
      const baseRes = await resolveChannelBaseline(c.id, t30d, { latestMetric });

      return {
        id: c.id,
        channelId: c.channelId,
        title: c.title,
        customUrl: c.customUrl,
        thumbnailUrl: c.thumbnailUrl,
        teamId: c.teamId,
        teamName: c.team ? c.team.name : 'Chưa gán đội',
        team: c.team ? { id: c.team.id, name: c.team.name } : null,
        assignedUserId: c.assignedUserId,
        isUnassigned: !c.teamId,
        views: baseRes.currentViews,
        totalViews: baseRes.currentViews,
        subscribers: baseRes.currentSubscribers,
        totalSubscribers: baseRes.currentSubscribers,
        views30d: baseRes.viewsDelta,
        viewsGrowth30dPct: baseRes.viewsGrowthPct,
        growthPercent: baseRes.growthPercent,
        growthStatus: baseRes.growthStatus,
        growthContext: baseRes.growthContext,
        baselineViews: baseRes.baselineViews,
        baselineAt: baseRes.baselineAt,
        subGrowth30dPct: baseRes.subGrowthPct,
        subGrowthPercent: baseRes.subGrowthPercent,
        subGrowthStatus: baseRes.subGrowthStatus,
        baselineSubscribers: baseRes.baselineSubscribers,
        baselineSubsAt: baseRes.baselineSubsAt,
        syncStatus: c.syncStatus,
        lastSyncedAt: c.lastSyncedAt,
        status: c.status,
      };
    })
  );

  // Sort channels according to sortBy (null growth always pushed to the end)
  if (sortBy === 'subscribers') {
    channelsWithMetrics.sort((a, b) => b.subscribers - a.subscribers || b.views - a.views);
  } else if (sortBy === 'growth') {
    channelsWithMetrics.sort((a, b) => {
      if (a.viewsGrowth30dPct !== null && b.viewsGrowth30dPct !== null) {
        return b.viewsGrowth30dPct - a.viewsGrowth30dPct || b.views - a.views;
      }
      if (a.viewsGrowth30dPct !== null && b.viewsGrowth30dPct === null) return -1;
      if (a.viewsGrowth30dPct === null && b.viewsGrowth30dPct !== null) return 1;
      return b.views - a.views;
    });
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
  getChannelsHistory,
  aggregateTeamYouTubeSummary,
  recalculateAllTeamYouTubeSummaries,
  getCompanyYouTubeOverview,
  getTeamYouTubeDetails,
  getMyYouTubeDashboard,
  compareTeams,
  getYouTubeTeamLeaderboard,
  getYouTubeChannelLeaderboard,
};

