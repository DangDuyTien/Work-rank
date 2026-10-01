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

async function getChannelById(id, options = {}) {
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
};
