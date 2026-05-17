const crypto = require('crypto');
const { Op, QueryTypes } = require('sequelize');
const { sequelize, User, DailyStat, ActivityEvent, UserProfilePreference, Friendship, UserMinuteStat } = require('../models');
const fraudDetection = require('./fraudDetection.service');
const { resolveUserPresence } = require('./userPresence.service');
const desktopStatus = require('./desktopStatus.service');
const presence = require('./presence.service');
const simulationPresence = require('./simulationPresence.service');
const cache = require('./cache.service');

function today() {
  return new Date().toISOString().slice(0, 10);
}

function rangeDates(range = 'today') {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);

  if (range === 'week' || range === 'weekly') {
    const day = start.getUTCDay() || 7;
    start.setUTCDate(start.getUTCDate() - day + 1);
  } else if (range === 'month' || range === 'monthly') {
    start.setUTCDate(1);
  } else if (range === 'year' || range === 'yearly') {
    start.setUTCMonth(0, 1);
  }

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function normalizeRange(range) {
  if (range === 'daily') return 'today';
  if (range === 'weekly') return 'week';
  if (range === 'monthly') return 'month';
  if (range === 'yearly') return 'year';
  return range || 'today';
}

function statWhereForRange(range) {
  const normalized = normalizeRange(range);
  const dates = rangeDates(normalized);
  if (normalized === 'today') return { statDate: dates.end };
  return { statDate: { [Op.gte]: dates.start, [Op.lte]: dates.end } };
}

function cacheKey(prefix, payload) {
  const hash = crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex');
  return `workrank:${prefix}:${hash}`;
}

function userInclude(teamId, options = {}) {
  const where = { status: 'active' };
  if (teamId) where.teamId = teamId;
  if (Array.isArray(options.userIds) && options.userIds.length > 0) where.id = { [Op.in]: options.userIds };
  const include = options.withProfile
    ? [{ model: UserProfilePreference, attributes: ['avatarData'], required: false }]
    : [];
  return { model: User, attributes: ['id', 'name', 'email', 'role', 'teamId', 'isVerified', 'status'], where, include };
}

function aggregateRows(rows) {
  return rows.reduce((acc, row) => {
    acc.activeSeconds += Number(row.activeSeconds || 0);
    acc.idleSeconds += Number(row.idleSeconds || 0);
    acc.keystrokeCount += Number(row.keystrokeCount || 0);
    acc.mouseClickCount += Number(row.mouseClickCount || 0);
    acc.sessionCount += Number(row.sessionCount || 0);
    return acc;
  }, { activeSeconds: 0, idleSeconds: 0, keystrokeCount: 0, mouseClickCount: 0, sessionCount: 0 });
}

function isMissingTableError(error) {
  return error?.parent?.code === 'ER_NO_SUCH_TABLE'
    || error?.original?.code === 'ER_NO_SUCH_TABLE'
    || /doesn't exist|no such table/i.test(String(error?.message || ''));
}

async function recentActivityUserIds({ activeSince, teamId, teamInclude }) {
  try {
    const rows = await UserMinuteStat.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('UserMinuteStat.user_id')), 'userId']],
      where: { bucketStartAt: { [Op.gte]: activeSince } },
      include: teamInclude,
      raw: true,
    });
    return rows.map((row) => String(row.userId || row.user_id)).filter(Boolean);
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    console.warn('user_minute_stats table missing; falling back to activity_events for active users ids.');
    const trustedWhere = {
      eventTime: { [Op.gte]: activeSince },
      suspicionScore: { [Op.lt]: fraudDetection.LIMITS.highSuspicionThreshold },
    };
    const rows = await ActivityEvent.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('ActivityEvent.user_id')), 'userId']],
      where: trustedWhere,
      include: teamId ? [{ model: User, attributes: [], where: { teamId } }] : [],
      raw: true,
    });
    return rows.map((row) => String(row.userId || row.user_id)).filter(Boolean);
  }
}

async function currentPresenceUserIds(teamId) {
  const ids = Array.from(new Set([
    ...presence.activeUserIds(),
    ...simulationPresence.activeUserIds(),
    ...desktopStatus.activeUserIds(),
  ].map(String).filter(Boolean)));

  if (ids.length === 0) return [];

  const rows = await User.findAll({
    attributes: ['id'],
    where: {
      id: { [Op.in]: ids },
      status: 'active',
      ...(teamId ? { teamId } : {}),
    },
    raw: true,
  });

  return rows.map((row) => String(row.id)).filter(Boolean);
}

async function countActiveUsersNow({ activeSince, teamId, teamInclude }) {
  const ids = new Set(await recentActivityUserIds({ activeSince, teamId, teamInclude }));
  for (const userId of await currentPresenceUserIds(teamId)) ids.add(userId);
  return ids.size;
}

async function overview(options = {}) {
  const range = normalizeRange(options.range || 'today');
  const teamId = options.teamId ? Number(options.teamId) : null;
  return cache.rememberJson(cacheKey('dashboard-overview', { range, teamId }), 5, () => (
    overviewUncached({ range, teamId })
  ));
}

async function overviewUncached({ range = 'today', teamId } = {}) {
  const statDate = today();
  const dates = rangeDates(normalizeRange(range));
  const totalsRows = await sequelize.query(`
    SELECT
      COALESCE(SUM(ds.active_seconds), 0) AS activeSeconds,
      COALESCE(SUM(ds.idle_seconds), 0) AS idleSeconds,
      COALESCE(SUM(ds.keystroke_count), 0) AS keystrokeCount,
      COALESCE(SUM(ds.mouse_click_count), 0) AS mouseClickCount,
      COALESCE(SUM(ds.session_count), 0) AS sessionCount,
      COALESCE(ROUND(AVG(ds.focus_score)), 0) AS averageFocusScore
    FROM daily_stats ds
    INNER JOIN users u ON u.id = ds.user_id AND u.status = 'active'
    WHERE ds.stat_date >= :startDate
      AND ds.stat_date <= :endDate
      ${teamId ? 'AND u.team_id = :teamId' : ''}
  `, {
    replacements: {
      startDate: dates.start,
      endDate: dates.end,
      teamId: teamId ? Number(teamId) : null,
    },
    type: QueryTypes.SELECT,
  });
  const totals = totalsRows[0] || {};
  const activeSince = new Date(Date.now() - 2 * 60 * 1000);
  const teamInclude = teamId ? [{ model: User, attributes: [], where: { teamId } }] : [];
  const activeUsersNow = await countActiveUsersNow({ activeSince, teamId, teamInclude });
  const suspiciousEventsToday = await ActivityEvent.count({
    where: {
      eventTime: { [Op.gte]: new Date(`${statDate}T00:00:00.000Z`) },
      suspicionScore: { [Op.gte]: fraudDetection.LIMITS.highSuspicionThreshold },
    },
    include: teamInclude,
  });
  const activeSeconds = Number(totals.activeSeconds || 0);
  const idleSeconds = Number(totals.idleSeconds || 0);
  return {
    range: normalizeRange(range),
    activeUsersNow,
    totalActiveSecondsToday: activeSeconds,
    totalActiveSeconds: activeSeconds,
    totalIdleSeconds: idleSeconds,
    totalKeystrokes: Number(totals.keystrokeCount || 0),
    totalMouseClicks: Number(totals.mouseClickCount || 0),
    totalSessions: Number(totals.sessionCount || 0),
    averageFocusScore: Number(totals.averageFocusScore || 0),
    idleRatio: activeSeconds + idleSeconds ? idleSeconds / (activeSeconds + idleSeconds) : 0,
    suspiciousEventsToday,
  };
}

function decorateRankedRow(row, index) {
  const userPresence = resolveUserPresence(row.id);
  return {
    ...row,
    accountStatus: row.status || 'active',
    presence: userPresence,
    presenceStatus: userPresence,
    score: row.score,
    rankPosition: Number(row.rankPosition || row.rank_position || index + 1),
  };
}

function clampPositiveInt(value, fallback, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(n)));
}

function escapeLike(value) {
  return String(value || '').replace(/[\\%_]/g, (char) => `\\${char}`);
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

function leaderboardBaseSql({ hasTeam, hasUserIds, hasSearch } = {}) {
  return `
    WITH aggregated AS (
      SELECT
        u.id AS user_id,
        u.name,
        u.email,
        u.role,
        u.team_id,
        u.is_verified,
        u.status AS account_status,
        COALESCE(SUM(ds.active_seconds), 0) AS active_seconds,
        COALESCE(SUM(ds.idle_seconds), 0) AS idle_seconds,
        COALESCE(SUM(ds.total_seconds), 0) AS total_seconds,
        COALESCE(SUM(ds.keystroke_count), 0) AS keystroke_count,
        COALESCE(SUM(ds.mouse_click_count), 0) AS mouse_click_count,
        COALESCE(SUM(ds.session_count), 0) AS session_count
      FROM daily_stats ds
      INNER JOIN users u ON u.id = ds.user_id AND u.status = 'active'
      WHERE ds.stat_date >= :startDate
        AND ds.stat_date <= :endDate
        ${hasTeam ? 'AND u.team_id = :teamId' : ''}
        ${hasUserIds ? 'AND u.id IN (:userIds)' : ''}
        ${hasSearch ? "AND (u.name LIKE :search ESCAPE '\\\\' OR u.email LIKE :search ESCAPE '\\\\')" : ''}
      GROUP BY u.id, u.name, u.email, u.role, u.team_id, u.is_verified, u.status
    ),
    focused AS (
      SELECT
        aggregated.*,
        CASE
          WHEN active_seconds + idle_seconds = 0 THEN 0
          ELSE ROUND(LEAST(100, GREATEST(0,
            (active_seconds / NULLIF(active_seconds + idle_seconds, 0)) * 60
            + (CASE WHEN active_seconds >= 3600 THEN 1 ELSE active_seconds / 3600 END) * 25
            + (CASE WHEN idle_seconds > 0 AND idle_seconds <= active_seconds * 0.25 THEN 1 ELSE 0.6 END) * 15
          )))
        END AS focus_score
      FROM aggregated
    ),
    scored AS (
      SELECT
        focused.*,
        CASE
          WHEN active_seconds = 0 AND idle_seconds = 0 AND keystroke_count + mouse_click_count = 0 THEN 0
          ELSE GREATEST(0,
            ROUND(keystroke_count + mouse_click_count)
            + ROUND(LEAST(300, (active_seconds / 60) * 2))
            + ROUND(focus_score * 0.5)
          )
        END AS score
      FROM focused
    ),
    ranked AS (
      SELECT
        scored.*,
        ROW_NUMBER() OVER (
          ORDER BY score DESC, focus_score DESC, active_seconds DESC, user_id ASC
        ) AS rank_position,
        COUNT(*) OVER () AS total_ranked
      FROM scored
    )
  `;
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

function mapLeaderboardRow(row, index) {
  return decorateRankedRow({
    id: row.user_id,
    user_id: row.user_id,
    name: row.name,
    email: row.email,
    role: row.role,
    teamId: row.team_id,
    isVerified: Boolean(row.is_verified),
    verified: Boolean(row.is_verified),
    featuredBadges: normalizeFeaturedBadges(row.featured_badges),
    accountStatus: row.account_status,
    activeSeconds: Number(row.active_seconds || 0),
    idleSeconds: Number(row.idle_seconds || 0),
    totalSeconds: Number(row.total_seconds || 0),
    keystrokeCount: Number(row.keystroke_count || 0),
    mouseClickCount: Number(row.mouse_click_count || 0),
    sessionCount: Number(row.session_count || 0),
    focusScore: Number(row.focus_score || 0),
    score: Number(row.score || 0),
    rankPosition: Number(row.rank_position || index + 1),
  }, index);
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
  const dates = rangeDates(normalizedRange);
  const safeLimit = clampPositiveInt(limit, 20, 100);
  const safePage = clampPositiveInt(page, 1, 1000000);
  const offset = (safePage - 1) * safeLimit;
  const cleanSearch = String(search || '').trim();
  const hasUserIds = Array.isArray(userIds) && userIds.length > 0;
  const baseOptions = {
    hasTeam: Boolean(teamId),
    hasUserIds,
    hasSearch: Boolean(cleanSearch),
  };
  const replacements = {
    startDate: dates.start,
    endDate: dates.end,
    limit: safeLimit,
    offset,
  };
  if (teamId) replacements.teamId = Number(teamId);
  if (hasUserIds) replacements.userIds = userIds.map((id) => Number(id)).filter(Number.isFinite);
  if (cleanSearch) replacements.search = `%${escapeLike(cleanSearch)}%`;

  const baseSql = leaderboardBaseSql(baseOptions);
  const rows = await sequelize.query(`
    ${baseSql}
    SELECT ranked.*, upp.featured_badges_json AS featured_badges
    FROM ranked
    LEFT JOIN user_profile_preferences upp ON upp.user_id = ranked.user_id
    WHERE ranked.rank_position > :offset
      AND ranked.rank_position <= (:offset + :limit)
    ORDER BY rank_position ASC
  `, {
    replacements,
    type: QueryTypes.SELECT,
  });

  const data = rows.map(mapLeaderboardRow);
  if (!withCurrentUserRank) return data;

  let currentUserRank = null;
  let currentTotalRanked = 0;
  if (currentUserId) {
    const currentRows = await sequelize.query(`
      ${baseSql}
      SELECT ranked.*, upp.featured_badges_json AS featured_badges
      FROM ranked
      LEFT JOIN user_profile_preferences upp ON upp.user_id = ranked.user_id
      WHERE ranked.user_id = :currentUserId
      LIMIT 1
    `, {
      replacements: { ...replacements, currentUserId: Number(currentUserId) },
      type: QueryTypes.SELECT,
    });
    currentTotalRanked = Number(currentRows[0]?.total_ranked || 0);
    currentUserRank = currentRows[0] ? mapLeaderboardRow(currentRows[0]) : null;
  }
  const totalRanked = Number(rows[0]?.total_ranked || currentTotalRanked || 0);

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
  const end = new Date();
  const start = new Date(Date.now() - (safeDays - 1) * 24 * 60 * 60 * 1000);
  const rows = await DailyStat.findAll({
    where: { statDate: { [Op.gte]: start.toISOString().slice(0, 10), [Op.lte]: end.toISOString().slice(0, 10) } },
    include: [userInclude(teamId)],
    raw: true,
  });
  const byDate = new Map();
  for (const row of rows) {
    const date = row.statDate;
    const current = byDate.get(date) || 0;
    byDate.set(date, current + Number(row.keystrokeCount || 0) + Number(row.mouseClickCount || 0));
  }
  const maxCount = Math.max(0, ...byDate.values());
  const data = [];
  for (let i = safeDays - 1; i >= 0; i -= 1) {
    const current = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const date = current.toISOString().slice(0, 10);
    const count = byDate.get(date) || 0;
    const level = !count || !maxCount ? 0 : Math.min(4, Math.max(1, Math.ceil((count / maxCount) * 4)));
    data.push({ date, count, level });
  }
  return data;
}

module.exports = { overview, leaderboard, friendsLeaderboard, heatmap, rangeDates, normalizeRange };
