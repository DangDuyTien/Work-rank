const crypto = require('crypto');
const { Op } = require('sequelize');
const { User, UserProfilePreference, Friendship, CompetitionUserSummary, ScoreLedger, CompetitionEvent } = require('../models');
const { resolveUserPresence } = require('./userPresence.service');
const presence = require('./presence.service');
const cache = require('./cache.service');

const MAX_LEVEL = 200;

function levelThreshold(level) {
  const n = Math.min(MAX_LEVEL, Math.max(0, Number(level || 0)));
  return Math.round(110 * Math.pow(n, 2.3));
}

function levelFromScore(score) {
  const safeScore = Math.max(0, Number(score || 0));
  for (let level = MAX_LEVEL; level >= 0; level -= 1) {
    if (safeScore >= levelThreshold(level)) return level;
  }
  return 0;
}

function normalizeRange(range) {
  if (range === 'daily') return 'today';
  if (range === 'weekly') return 'week';
  if (range === 'monthly') return 'month';
  if (range === 'yearly') return 'year';
  return range || 'today';
}

function cacheKey(prefix, payload) {
  const hash = crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex');
  return `workrank:${prefix}:${hash}`;
}

function normalizeFeaturedBadges(value) {
  if (Array.isArray(value)) return value.map((label) => String(label || '').trim()).filter(Boolean);
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((label) => String(label || '').trim()).filter(Boolean);
    } catch {
      return [];
    }
  }
  return [];
}

async function overview(options = {}) {
  const range = normalizeRange(options.range || 'today');
  const teamId = options.teamId ? Number(options.teamId) : null;
  return cache.rememberJson(cacheKey('dashboard-overview', { range, teamId }), 5, () => (
    overviewUncached({ range, teamId })
  ));
}

async function overviewUncached({ range = 'today', teamId } = {}) {
  const onlineIds = presence.activeUserIds();
  let activeUsersNow = 0;
  if (onlineIds.length > 0) {
    activeUsersNow = await User.count({
      where: {
        id: { [Op.in]: onlineIds },
        status: 'active',
        ...(teamId ? { teamId } : {}),
      },
    });
  }

  return {
    range: normalizeRange(range),
    activeUsersNow,
    totalActiveSecondsToday: 0,
    totalActiveSeconds: 0,
    totalIdleSeconds: 0,
    totalKeystrokes: 0,
    totalMouseClicks: 0,
    totalSessions: 0,
    averageFocusScore: 100,
    idleRatio: 0,
    suspiciousEventsToday: 0,
  };
}

async function acceptedFriendUserIds(currentUserId) {
  const rows = await Friendship.findAll({
    where: {
      status: 'accepted',
      [Op.or]: [{ requesterId: currentUserId }, { addresseeId: currentUserId }],
    },
    attributes: ['requesterId', 'addresseeId'],
    raw: true,
  });

  const ids = new Set([String(currentUserId)]);
  for (const row of rows) {
    ids.add(String(row.requesterId) === String(currentUserId) ? String(row.addresseeId) : String(row.requesterId));
  }
  return Array.from(ids);
}

function mapLeaderboardUser(user, index) {
  const plain = user.toJSON ? user.toJSON() : user;
  const summary = plain.competitionSummary || {};
  const pref = plain.UserProfilePreference || plain.userProfilePreference || {};
  const score = Number(summary.currentSeasonScore || summary.grandPoints || 0);
  const userPresence = resolveUserPresence(plain.id);
  const featuredBadges = normalizeFeaturedBadges(pref.featuredBadges || pref.featuredBadgesJson || pref.featured_badges_json);

  return {
    id: plain.id,
    user_id: plain.id,
    userId: plain.id,
    name: plain.name,
    email: plain.email,
    role: plain.role,
    jobTitle: plain.jobTitle || 'Nhân viên',
    department: plain.department || 'Media & Content',
    teamId: plain.teamId,
    isVerified: Boolean(plain.isVerified),
    verified: Boolean(plain.isVerified),
    isDev: Boolean(plain.isDev),
    avatarData: pref.avatarData || null,
    userAvatar: pref.avatarData || null,
    featuredBadges,
    accountStatus: plain.status || 'active',
    score,
    level: levelFromScore(score),
    rankPosition: index + 1,
    presence: userPresence,
    presenceStatus: userPresence,
  };
}

async function leaderboard(options = {}) {
  const cachePayload = {
    range: normalizeRange(options.range || 'today'),
    teamId: options.teamId ? Number(options.teamId) : null,
    limit: Number(options.limit || 20),
    page: Number(options.page || 1),
    search: String(options.search || '').trim(),
    currentUserId: options.withCurrentUserRank ? Number(options.currentUserId || 0) : 0,
    userIds: Array.isArray(options.userIds) ? options.userIds.map(String).sort() : [],
  };
  return cache.rememberJson(cacheKey('leaderboard', cachePayload), 5, () => leaderboardUncached(options));
}

async function leaderboardUncached({ range = 'today', teamId, limit = 20, page = 1, search = '', currentUserId, withCurrentUserRank = false, userIds } = {}) {
  const normalizedRange = normalizeRange(range);
  const safeLimit = Math.min(100, Math.max(1, Number(limit || 20)));
  const safePage = Math.min(1000000, Math.max(1, Number(page || 1)));
  const cleanSearch = String(search || '').trim();

  const where = { status: 'active' };
  if (teamId) where.teamId = teamId;
  if (Array.isArray(userIds) && userIds.length > 0) where.id = { [Op.in]: userIds };
  if (cleanSearch) {
    where[Op.or] = [
      { name: { [Op.like]: `%${cleanSearch}%` } },
      { email: { [Op.like]: `%${cleanSearch}%` } },
    ];
  }

  const allUsers = await User.findAll({
    where,
    include: [
      { model: CompetitionUserSummary, as: 'competitionSummary', required: false },
      { model: UserProfilePreference, required: false },
    ],
  });

  // Sort by score DESC
  const rankedAll = allUsers
    .map((u, i) => mapLeaderboardUser(u, i))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((item, idx) => ({ ...item, rankPosition: idx + 1 }));

  const totalRanked = rankedAll.length;
  const offset = (safePage - 1) * safeLimit;
  const data = rankedAll.slice(offset, offset + safeLimit);

  let currentUserRank = null;
  if (withCurrentUserRank && currentUserId) {
    currentUserRank = rankedAll.find((u) => String(u.id) === String(currentUserId)) || null;
  }

  if (!withCurrentUserRank) return data;

  return {
    data,
    currentUserRank,
    totalRanked,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.max(1, Math.ceil(totalRanked / safeLimit)),
    range: normalizedRange,
  };
}

async function friendsLeaderboard({ range = 'today', limit = 50, page = 1, search = '', currentUserId } = {}) {
  const userIds = await acceptedFriendUserIds(currentUserId);
  return leaderboard({
    range,
    limit,
    page,
    search,
    currentUserId,
    withCurrentUserRank: true,
    userIds,
  });
}

async function heatmap({ days = 365, teamId } = {}) {
  const safeDays = Math.min(365, Math.max(1, Number(days || 365)));
  const data = [];
  for (let i = safeDays - 1; i >= 0; i -= 1) {
    const current = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const date = current.toISOString().slice(0, 10);
    data.push({ date, count: 0, level: 0 });
  }
  return data;
}

module.exports = { overview, leaderboard, friendsLeaderboard, heatmap, normalizeRange };
