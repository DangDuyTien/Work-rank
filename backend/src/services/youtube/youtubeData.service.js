'use strict';

const { Op } = require('sequelize');
const {
  YouTubeChannel,
  YouTubeVideo,
  YouTubeChannelMetric,
  YouTubeVideoMetric,
  Team,
  sequelize,
} = require('../../models');

/**
 * YouTube Data Service
 * Handles persistence and queries for channels, videos, and metrics snapshots.
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
  return YouTubeChannel.findByPk(id, {
    include: [
      { model: Team, as: 'team', attributes: ['id', 'name', 'description'] },
    ],
    ...options,
  });
}

async function getChannelByExternalId(channelId, options = {}) {
  return YouTubeChannel.findOne({
    where: { channelId },
    include: [
      { model: Team, as: 'team', attributes: ['id', 'name', 'description'] },
    ],
    ...options,
  });
}

async function listChannels(filters = {}, options = {}) {
  const where = {};
  if (filters.teamId) {
    where.teamId = filters.teamId;
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

  return YouTubeChannel.findAll({
    where,
    include: [
      { model: Team, as: 'team', attributes: ['id', 'name', 'description'] },
    ],
    order: [['createdAt', 'DESC']],
    ...options,
  });
}

// ================= VIDEO MANAGEMENT =================

async function upsertVideo(data, options = {}) {
  const {
    channelId,
    videoId,
    title,
    description = null,
    publishedAt,
    thumbnailUrl = null,
    durationSeconds = 0,
    status = 'ACTIVE',
  } = data;

  if (!channelId || !videoId || !title || !publishedAt) {
    throw new Error('channelId, videoId, title, and publishedAt are required to upsert a video');
  }

  const existing = await YouTubeVideo.findOne({
    where: { videoId },
    transaction: options.transaction,
  });

  if (existing) {
    return existing.update(
      {
        channelId,
        title,
        description: description !== undefined ? description : existing.description,
        publishedAt: new Date(publishedAt),
        thumbnailUrl: thumbnailUrl !== undefined ? thumbnailUrl : existing.thumbnailUrl,
        durationSeconds: durationSeconds !== undefined ? durationSeconds : existing.durationSeconds,
        status: status || existing.status,
      },
      options,
    );
  }

  return YouTubeVideo.create(
    {
      channelId,
      videoId,
      title,
      description,
      publishedAt: new Date(publishedAt),
      thumbnailUrl,
      durationSeconds,
      status,
    },
    options,
  );
}

async function getVideoById(id, options = {}) {
  return YouTubeVideo.findByPk(id, {
    include: [
      {
        model: YouTubeChannel,
        as: 'channel',
        include: [{ model: Team, as: 'team', attributes: ['id', 'name'] }],
      },
    ],
    ...options,
  });
}

async function getVideoByExternalId(videoId, options = {}) {
  return YouTubeVideo.findOne({
    where: { videoId },
    include: [
      {
        model: YouTubeChannel,
        as: 'channel',
        include: [{ model: Team, as: 'team', attributes: ['id', 'name'] }],
      },
    ],
    ...options,
  });
}

async function listVideos(filters = {}, options = {}) {
  const where = {};
  if (filters.channelId) {
    where.channelId = filters.channelId;
  }
  if (filters.status) {
    where.status = filters.status;
  }

  const channelWhere = {};
  if (filters.teamId) {
    channelWhere.teamId = filters.teamId;
  }

  return YouTubeVideo.findAll({
    where,
    include: [
      {
        model: YouTubeChannel,
        as: 'channel',
        where: Object.keys(channelWhere).length > 0 ? channelWhere : undefined,
        include: [{ model: Team, as: 'team', attributes: ['id', 'name'] }],
      },
    ],
    order: [['publishedAt', 'DESC']],
    limit: filters.limit ? Number(filters.limit) : 50,
    offset: filters.offset ? Number(filters.offset) : 0,
    ...options,
  });
}

// ================= METRICS SNAPSHOTS =================

async function recordChannelMetricSnapshot(params, options = {}) {
  const {
    channelId,
    views = 0,
    subscribers = 0,
    videosCount = 0,
    watchTimeHours = 0,
    engagementRate = 0,
    capturedAt = new Date(),
  } = params;

  if (!channelId) {
    throw new Error('channelId is required to record channel metric snapshot');
  }

  const snapshotTime = new Date(capturedAt);

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
        views: Number(views),
        subscribers: Number(subscribers),
        videosCount: Number(videosCount),
        watchTimeHours: Number(watchTimeHours),
        engagementRate: Number(engagementRate),
        capturedAt: snapshotTime,
      },
      options,
    );
  }

  return YouTubeChannelMetric.create(
    {
      channelId,
      capturedAt: snapshotTime,
      views: Number(views),
      subscribers: Number(subscribers),
      videosCount: Number(videosCount),
      watchTimeHours: Number(watchTimeHours),
      engagementRate: Number(engagementRate),
    },
    options,
  );
}

async function recordVideoMetricSnapshot(params, options = {}) {
  const {
    videoId,
    views = 0,
    likes = 0,
    comments = 0,
    watchTimeHours = 0,
    engagementRate = 0,
    capturedAt = new Date(),
  } = params;

  if (!videoId) {
    throw new Error('videoId is required to record video metric snapshot');
  }

  const snapshotTime = new Date(capturedAt);
  const windowStart = new Date(snapshotTime.getTime() - 2.5 * 60 * 1000);
  const windowEnd = new Date(snapshotTime.getTime() + 2.5 * 60 * 1000);

  const existing = await YouTubeVideoMetric.findOne({
    where: {
      videoId,
      capturedAt: {
        [Op.between]: [windowStart, windowEnd],
      },
    },
    transaction: options.transaction,
  });

  if (existing) {
    return existing.update(
      {
        views: Number(views),
        likes: Number(likes),
        comments: Number(comments),
        watchTimeHours: Number(watchTimeHours),
        engagementRate: Number(engagementRate),
        capturedAt: snapshotTime,
      },
      options,
    );
  }

  return YouTubeVideoMetric.create(
    {
      videoId,
      capturedAt: snapshotTime,
      views: Number(views),
      likes: Number(likes),
      comments: Number(comments),
      watchTimeHours: Number(watchTimeHours),
      engagementRate: Number(engagementRate),
    },
    options,
  );
}

/**
 * Fetch top videos across the company or for a specific team/channel
 */
async function getTopVideos(params = {}, options = {}) {
  const {
    teamId = null,
    channelId = null,
    timeframe = 'all', // '7d', '30d', 'season', 'year', 'all'
    limit = 20,
    page = 1,
  } = params;

  const where = { status: 'ACTIVE' };
  const channelWhere = { status: 'ACTIVE' };

  if (channelId) {
    channelWhere.id = channelId;
  }
  if (teamId) {
    channelWhere.teamId = teamId;
  }

  const now = new Date();
  if (timeframe === '7d') {
    where.publishedAt = { [Op.gte]: new Date(now.getTime() - 7 * 86400000) };
  } else if (timeframe === '30d') {
    where.publishedAt = { [Op.gte]: new Date(now.getTime() - 30 * 86400000) };
  } else if (timeframe === 'year') {
    where.publishedAt = { [Op.gte]: new Date(now.getFullYear(), 0, 1) };
  }

  const offset = (Number(page) - 1) * Number(limit);

  // Subquery to get latest views for each video
  const videos = await YouTubeVideo.findAll({
    where,
    include: [
      {
        model: YouTubeChannel,
        as: 'channel',
        where: Object.keys(channelWhere).length > 0 ? channelWhere : undefined,
        include: [{ model: Team, as: 'team', attributes: ['id', 'name'] }],
      },
      {
        model: YouTubeVideoMetric,
        as: 'metrics',
        limit: 1,
        order: [['capturedAt', 'DESC']],
      },
    ],
    limit: Number(limit),
    offset,
    ...options,
  });

  // Sort by latest views descending
  const sorted = videos.map((v) => {
    const latestMetric = v.metrics && v.metrics.length > 0 ? v.metrics[0] : null;
    return {
      id: v.id,
      videoId: v.videoId,
      title: v.title,
      description: v.description,
      publishedAt: v.publishedAt,
      thumbnailUrl: v.thumbnailUrl,
      durationSeconds: v.durationSeconds,
      channel: v.channel
        ? {
            id: v.channel.id,
            channelId: v.channel.channelId,
            title: v.channel.title,
            team: v.channel.team ? { id: v.channel.team.id, name: v.channel.team.name } : null,
          }
        : null,
      views: latestMetric ? Number(latestMetric.views) : 0,
      likes: latestMetric ? Number(latestMetric.likes) : 0,
      comments: latestMetric ? Number(latestMetric.comments) : 0,
      engagementRate: latestMetric ? Number(latestMetric.engagementRate) : 0,
      lastCapturedAt: latestMetric ? latestMetric.capturedAt : v.updatedAt,
    };
  });

  sorted.sort((a, b) => b.views - a.views);

  return sorted;
}

module.exports = {
  createChannel,
  updateChannel,
  linkChannelToTeam,
  unlinkChannel,
  getChannelById,
  getChannelByExternalId,
  listChannels,
  upsertVideo,
  getVideoById,
  getVideoByExternalId,
  listVideos,
  recordChannelMetricSnapshot,
  recordVideoMetricSnapshot,
  getTopVideos,
};
