'use strict';

const { Op } = require('sequelize');
const {
  YouTubeChannel,
  YouTubeChannelMetric,
  Team,
  sequelize,
} = require('../../models');

/**
 * YouTube Data Service
 * Handles persistence and queries for channels and channel metrics snapshots.
 */

// ================= CHANNEL MANAGEMENT =================

async function createChannel(data, options = {}) {
  const {
    channelId,
    title,
    customUrl = null,
    thumbnailUrl = null,
    description = null,
    teamId = null,
    status = 'ACTIVE',
  } = data;

  if (!channelId || !title) {
    throw new Error('channelId and title are required to register a YouTube channel');
  }

  if (teamId) {
    const team = await Team.findByPk(teamId, { transaction: options.transaction });
    if (!team) {
      throw new Error(`Team with id ${teamId} not found`);
    }
  }

  return YouTubeChannel.create(
    {
      channelId,
      title,
      customUrl,
      thumbnailUrl,
      description,
      teamId: teamId || null,
      status,
      syncStatus: 'IDLE',
    },
    options,
  );
}

async function updateChannel(id, updates, options = {}) {
  const channel = await YouTubeChannel.findByPk(id, { transaction: options.transaction });
  if (!channel) {
    throw new Error(`YouTubeChannel with id ${id} not found`);
  }

  if (updates.teamId !== undefined && updates.teamId !== null) {
    const team = await Team.findByPk(updates.teamId, { transaction: options.transaction });
    if (!team) {
      throw new Error(`Team with id ${updates.teamId} not found`);
    }
  }

  return channel.update(updates, options);
}

async function linkChannelToTeam(channelIdentifier, teamId, options = {}) {
  let channel;
  if (typeof channelIdentifier === 'number' || !isNaN(Number(channelIdentifier))) {
    channel = await YouTubeChannel.findByPk(Number(channelIdentifier), { transaction: options.transaction });
  }
  if (!channel) {
    channel = await YouTubeChannel.findOne({ where: { channelId: String(channelIdentifier) }, transaction: options.transaction });
  }

  if (!channel) {
    throw new Error(`YouTube channel '${channelIdentifier}' not found`);
  }

  if (teamId) {
    const team = await Team.findByPk(teamId, { transaction: options.transaction });
    if (!team) {
      throw new Error(`Team with id ${teamId} not found`);
    }
  }

  channel.teamId = teamId ? Number(teamId) : null;
  await channel.save(options);
  return channel;
}

async function unlinkChannel(channelIdentifier, options = {}) {
  return linkChannelToTeam(channelIdentifier, null, options);
}

/**
 * Canonical helper to calculate percentage growth safely against a baseline.
 * NEVER assumes previous = 0 means 100% growth!
 */
function calculateGrowth(current, baseline) {
  if (baseline === null || baseline === undefined || Number(baseline) <= 0) {
    return {
      growthPercent: null,
      growthStatus: 'INSUFFICIENT_DATA',
      growthContext: 'NO_VALID_BASELINE',
    };
  }
  const cur = Number(current || 0);
  const base = Number(baseline);
  const diff = cur - base;
  const rawPercent = (diff / base) * 100;

  // Filter out anomalous baseline jumps (> 5000% indicating dummy placeholder baseline transition)
  if (rawPercent > 5000.0) {
    return {
      growthPercent: null,
      growthStatus: 'INSUFFICIENT_DATA',
      growthContext: 'ANOMALOUS_BASELINE',
    };
  }

  // Clamped safe float rounded to 1 decimal place (max 999.9%, min -100.0%)
  const growthPercent = Number(Math.min(999.9, Math.max(-100.0, rawPercent)).toFixed(1));
  return {
    growthPercent,
    growthStatus: 'AVAILABLE',
    growthContext: 'VALID',
  };
}

/**
 * Resolves the baseline metric and computes growth for a YouTube channel over a lookback date.
 * Handles the 4 canonical cases:
 * - Case 1: Channel added in current period, 1 snapshot -> INSUFFICIENT_DATA, null growth
 * - Case 1 (later) / Case 3: Channel added in current period, 2+ snapshots -> Baseline is onboarding snapshot (SINCE_ONBOARDING)
 * - Case 2: Channel existed prior to lookback date -> Baseline is snapshot on/before lookback date (e.g. 30D)
 * - Case 4: No snapshots or baseline <= 0 -> INSUFFICIENT_DATA, null growth
 */
async function resolveChannelBaseline(channelId, lookbackDate, options = {}) {
  // 1. Get latest metric (or use provided)
  const latestMetric = options.latestMetric || await YouTubeChannelMetric.findOne({
    where: { channelId },
    order: [['capturedAt', 'DESC']],
    transaction: options.transaction,
  });

  if (!latestMetric) {
    return {
      latestMetric: null,
      baselineMetric: null,
      currentViews: 0,
      baselineViews: null,
      baselineAt: null,
      viewsDelta: 0,
      viewsGrowthPct: null,
      growthPercent: null,
      growthStatus: 'INSUFFICIENT_DATA',
      growthContext: 'NO_VALID_BASELINE',
      currentSubscribers: 0,
      baselineSubscribers: null,
      baselineSubsAt: null,
      subDelta: 0,
      subGrowthPct: null,
      subGrowthPercent: null,
      subGrowthStatus: 'INSUFFICIENT_DATA',
      hasValidBaseline: false,
      hasElapsedMeasurement: false,
    };
  }

  const currentViews = Number(latestMetric.views || 0);
  const currentSubscribers = Number(latestMetric.subscribers || 0);

  // Helper to detect dummy mock snapshots (exact signature views=1000, subs=100 created when API key was absent)
  const isDummyMock = (metric) => {
    if (!metric) return false;
    return Number(metric.views) === 1000 && Number(metric.subscribers) === 100 && currentViews >= 50000;
  };

  // 2. Query for snapshot <= lookbackDate
  let priorMetric = await YouTubeChannelMetric.findOne({
    where: {
      channelId,
      capturedAt: { [Op.lte]: lookbackDate },
    },
    order: [['capturedAt', 'DESC']],
    transaction: options.transaction,
  });

  if (isDummyMock(priorMetric)) {
    const realPrior = await YouTubeChannelMetric.findOne({
      where: {
        channelId,
        capturedAt: { [Op.lte]: lookbackDate },
        views: { [Op.gt]: 1000 },
      },
      order: [['capturedAt', 'DESC']],
      transaction: options.transaction,
    });
    priorMetric = realPrior || null;
  }

  let baselineMetric = null;
  let hasElapsedMeasurement = false;
  let growthContext = options.period ? options.period.toUpperCase() : '30D';

  if (priorMetric) {
    // Case 2: Existed before / at lookback date
    baselineMetric = priorMetric;
    hasElapsedMeasurement = true;
  } else {
    // Channel onboarded after lookbackDate (Case 1 / Case 3)
    // Find the earliest / onboarding snapshot
    let earliestMetric = await YouTubeChannelMetric.findOne({
      where: { channelId },
      order: [['capturedAt', 'ASC']],
      transaction: options.transaction,
    });

    if (isDummyMock(earliestMetric)) {
      const realEarliest = await YouTubeChannelMetric.findOne({
        where: {
          channelId,
          views: { [Op.gt]: 1000 },
        },
        order: [['capturedAt', 'ASC']],
        transaction: options.transaction,
      });
      if (realEarliest) {
        earliestMetric = realEarliest;
      }
    }

    if (earliestMetric) {
      baselineMetric = earliestMetric;
      growthContext = 'SINCE_ONBOARDING';

      // Check if there is an elapsed measurement between onboarding and latest
      const isSameSnapshot = earliestMetric.id === latestMetric.id ||
        new Date(earliestMetric.capturedAt).getTime() === new Date(latestMetric.capturedAt).getTime();

      if (!isSameSnapshot && new Date(earliestMetric.capturedAt).getTime() < new Date(latestMetric.capturedAt).getTime()) {
        hasElapsedMeasurement = true;
      } else {
        // Only 1 snapshot exists (just onboarded)
        hasElapsedMeasurement = false;
      }
    }
  }

  // 3. Compute Views Growth
  let viewsGrowthPct = null;
  let viewsGrowthStatus = 'INSUFFICIENT_DATA';
  let viewsDelta = 0;
  const baselineViews = baselineMetric ? Number(baselineMetric.views || 0) : null;

  if (hasElapsedMeasurement && baselineViews !== null && baselineViews > 0) {
    viewsDelta = Math.max(0, currentViews - baselineViews);
    const growthRes = calculateGrowth(currentViews, baselineViews);
    viewsGrowthPct = growthRes.growthPercent;
    viewsGrowthStatus = growthRes.growthStatus;
    if (viewsGrowthStatus === 'INSUFFICIENT_DATA') {
      viewsDelta = 0;
    }
  } else if (!hasElapsedMeasurement) {
    viewsDelta = 0;
    viewsGrowthPct = null;
    viewsGrowthStatus = 'INSUFFICIENT_DATA';
    if (baselineViews === null || baselineViews <= 0) {
      growthContext = 'NO_VALID_BASELINE';
    }
  } else {
    // baselineViews <= 0
    viewsDelta = 0;
    viewsGrowthPct = null;
    viewsGrowthStatus = 'INSUFFICIENT_DATA';
    growthContext = 'NO_VALID_BASELINE';
  }

  // 4. Compute Subscribers Growth
  let subGrowthPct = null;
  let subGrowthStatus = 'INSUFFICIENT_DATA';
  let subDelta = 0;
  const baselineSubscribers = baselineMetric ? Number(baselineMetric.subscribers || 0) : null;

  if (hasElapsedMeasurement && baselineSubscribers !== null && baselineSubscribers > 0) {
    subDelta = currentSubscribers - baselineSubscribers;
    const subRes = calculateGrowth(currentSubscribers, baselineSubscribers);
    subGrowthPct = subRes.growthPercent;
    subGrowthStatus = subRes.growthStatus;
    if (subGrowthStatus === 'INSUFFICIENT_DATA') {
      subDelta = 0;
    }
  } else if (!hasElapsedMeasurement) {
    subDelta = 0;
    subGrowthPct = null;
    subGrowthStatus = 'INSUFFICIENT_DATA';
  } else {
    subDelta = 0;
    subGrowthPct = null;
    subGrowthStatus = 'INSUFFICIENT_DATA';
  }

  return {
    latestMetric,
    baselineMetric,
    currentViews,
    baselineViews,
    baselineAt: baselineMetric ? baselineMetric.capturedAt : null,
    viewsDelta,
    viewsGrowthPct,
    growthPercent: viewsGrowthPct,
    growthStatus: viewsGrowthStatus,
    growthContext,
    currentSubscribers,
    baselineSubscribers,
    baselineSubsAt: baselineMetric ? baselineMetric.capturedAt : null,
    subDelta,
    subGrowthPct,
    subGrowthPercent: subGrowthPct,
    subGrowthStatus,
    hasValidBaseline: viewsGrowthStatus === 'AVAILABLE',
    hasElapsedMeasurement,
  };
}

async function getChannelById(id, options = {}) {
  const period = options.period || '30d';
  const channel = await YouTubeChannel.findByPk(id, {
    include: [
      { model: Team, as: 'team', attributes: ['id', 'name', 'description'] },
      {
        model: YouTubeChannelMetric,
        as: 'metrics',
        limit: 1,
        order: [['capturedAt', 'DESC']],
      },
    ],
    transaction: options.transaction,
  });

  if (!channel) return null;

  let daysCount = 30;
  if (period === '7d') daysCount = 7;
  else if (period === '90d') daysCount = 90;
  else if (period === '12m') daysCount = 365;

  const startDate = new Date(Date.now() - daysCount * 86400000);
  const metrics = await YouTubeChannelMetric.findAll({
    where: {
      channelId: channel.id,
      capturedAt: { [Op.gte]: startDate },
    },
    order: [['capturedAt', 'ASC']],
    transaction: options.transaction,
  });

  const dailyMap = {};
  for (const metric of metrics) {
    const day = new Date(metric.capturedAt).toISOString().split('T')[0];
    dailyMap[day] = {
      date: day,
      views: Number(metric.views || 0),
      subscribers: Number(metric.subscribers || 0),
    };
  }
  const history = Object.values(dailyMap);

  const m = channel.metrics && channel.metrics.length > 0 ? channel.metrics[0] : null;

  const baselineInfo = await resolveChannelBaseline(channel.id, startDate, {
    latestMetric: m,
    period,
    transaction: options.transaction,
  });

  return {
    id: channel.id,
    channelId: channel.channelId,
    title: channel.title,
    customUrl: channel.customUrl,
    thumbnailUrl: channel.thumbnailUrl,
    description: channel.description,
    teamId: channel.teamId,
    team: channel.team ? { id: channel.team.id, name: channel.team.name, description: channel.team.description } : null,
    assignedUserId: channel.assignedUserId,
    status: channel.status,
    syncStatus: channel.syncStatus,
    lastSyncedAt: channel.lastSyncedAt,
    lastSyncError: channel.lastSyncError,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
    views: baselineInfo.currentViews,
    subscribers: baselineInfo.currentSubscribers,
    engagementRate: m ? Number(m.engagementRate) : 0,
    viewsGrowthPct: baselineInfo.viewsGrowthPct,
    growthPercent: baselineInfo.growthPercent,
    growthStatus: baselineInfo.growthStatus,
    growthContext: baselineInfo.growthContext,
    baselineViews: baselineInfo.baselineViews,
    baselineAt: baselineInfo.baselineAt,
    subGrowthPct: baselineInfo.subGrowthPct,
    subGrowthPercent: baselineInfo.subGrowthPercent,
    subGrowthStatus: baselineInfo.subGrowthStatus,
    baselineSubscribers: baselineInfo.baselineSubscribers,
    history,
    period,
  };
}

async function getChannelByExternalId(channelId, options = {}) {
  const channel = await YouTubeChannel.findOne({
    where: { channelId },
    include: [
      { model: Team, as: 'team', attributes: ['id', 'name', 'description'] },
      {
        model: YouTubeChannelMetric,
        as: 'metrics',
        limit: 1,
        order: [['capturedAt', 'DESC']],
      },
    ],
    ...options,
  });

  if (!channel) return null;

  const m = channel.metrics && channel.metrics.length > 0 ? channel.metrics[0] : null;
  return {
    id: channel.id,
    channelId: channel.channelId,
    title: channel.title,
    customUrl: channel.customUrl,
    thumbnailUrl: channel.thumbnailUrl,
    description: channel.description,
    teamId: channel.teamId,
    team: channel.team ? { id: channel.team.id, name: channel.team.name, description: channel.team.description } : null,
    status: channel.status,
    syncStatus: channel.syncStatus,
    lastSyncedAt: channel.lastSyncedAt,
    lastSyncError: channel.lastSyncError,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
    views: m ? Number(m.views) : 0,
    subscribers: m ? Number(m.subscribers) : 0,
    engagementRate: m ? Number(m.engagementRate) : 0,
  };
}

async function listChannels(filters = {}, options = {}) {
  const where = {};
  if (filters.teamId === 'unassigned' || filters.unassigned === true || filters.teamId === null) {
    where.teamId = null;
  } else if (filters.teamId !== undefined && filters.teamId !== 'all') {
    where.teamId = Number(filters.teamId);
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.syncStatus) {
    where.syncStatus = filters.syncStatus;
  }
  if (filters.search) {
    where[Op.or] = [
      { title: { [Op.like]: `%${filters.search}%` } },
      { channelId: { [Op.like]: `%${filters.search}%` } },
      { customUrl: { [Op.like]: `%${filters.search}%` } },
    ];
  }

  const channels = await YouTubeChannel.findAll({
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
    order: [['createdAt', 'DESC']],
    ...options,
  });

  return channels.map((c) => {
    const m = c.metrics && c.metrics.length > 0 ? c.metrics[0] : null;
    return {
      id: c.id,
      channelId: c.channelId,
      title: c.title,
      customUrl: c.customUrl,
      thumbnailUrl: c.thumbnailUrl,
      description: c.description,
      teamId: c.teamId,
      team: c.team ? { id: c.team.id, name: c.team.name, description: c.team.description } : null,
      status: c.status,
      syncStatus: c.syncStatus,
      lastSyncedAt: c.lastSyncedAt,
      lastSyncError: c.lastSyncError,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      views: m ? Number(m.views) : 0,
      subscribers: m ? Number(m.subscribers) : 0,
      engagementRate: m ? Number(m.engagementRate) : 0,
    };
  });
}

// ================= METRICS SNAPSHOTS =================

async function recordChannelMetricSnapshot(params, options = {}) {
  const {
    channelId,
    views = 0,
    subscribers = 0,
    watchTimeHours = 0,
    engagementRate = 0,
    capturedAt = new Date(),
  } = params;

  if (!channelId) {
    throw new Error('channelId is required to record channel metric snapshot');
  }

  const snapshotTime = new Date(capturedAt);
  const safeViews = Math.max(0, Number(views) || 0);
  const safeSubscribers = Math.max(0, Number(subscribers) || 0);
  const safeWatchTime = Number(Math.min(9999999999.99, Math.max(0, Number(watchTimeHours) || 0)).toFixed(2));
  const safeEngagement = Number(Math.min(999.9999, Math.max(0, Number(engagementRate) || 0)).toFixed(4));

  // Check if snapshot already exists in the same 5-minute window for idempotency
  const windowStart = new Date(snapshotTime.getTime() - 2.5 * 60 * 1000);
  const windowEnd = new Date(snapshotTime.getTime() + 2.5 * 60 * 1000);

  const existing = await YouTubeChannelMetric.findOne({
    where: {
      channelId,
      capturedAt: {
        [Op.between]: [windowStart, windowEnd],
      },
    },
    transaction: options.transaction,
  });

  if (existing) {
    return existing.update(
      {
        views: safeViews,
        subscribers: safeSubscribers,
        watchTimeHours: safeWatchTime,
        engagementRate: safeEngagement,
        capturedAt: snapshotTime,
      },
      options,
    );
  }

  return YouTubeChannelMetric.create(
    {
      channelId,
      capturedAt: snapshotTime,
      views: safeViews,
      subscribers: safeSubscribers,
      watchTimeHours: safeWatchTime,
      engagementRate: safeEngagement,
    },
    options,
  );
}

module.exports = {
  createChannel,
  updateChannel,
  linkChannelToTeam,
  unlinkChannel,
  getChannelById,
  getChannelByExternalId,
  listChannels,
  recordChannelMetricSnapshot,
  calculateGrowth,
  resolveChannelBaseline,
};
