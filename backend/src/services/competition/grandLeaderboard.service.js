'use strict';

/**
 * grandLeaderboard.service.js
 *
 * Grand Standings, Timeline, and Team Journey read model.
 * Provides aggregated rankings, tie-break resolution, and historical timeline.
 */

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const {
  GrandChampionship,
  GrandFrozenResult,
  GrandPointsLedger,
  Season,
  SeasonFrozenResult,
  SeasonTeamMember,
  Team,
  User,
  UserProfilePreference,
} = require('../../models');

/**
 * Fetch current Grand Standings with tie-breaking.
 *
 * @param {number} grandId
 * @param {object} [options]
 * @param {boolean} [options.ignoreFrozen]
 * @returns {Promise<object>}
 */
async function getGrandStandings(grandId, options = {}) {
  const transaction = options.transaction;
  const grand = await GrandChampionship.findByPk(grandId, { transaction });
  if (!grand) throw new Error(`Grand Championship #${grandId} not found`);

  // If finalized and frozen, return frozen results directly
  if (!options.ignoreFrozen && (grand.status === 'FINISHED' || grand.status === 'ARCHIVED')) {
    const frozen = await GrandFrozenResult.findOne({ where: { grandChampionshipId: grandId }, transaction });
    if (frozen) {
      return {
        grandId,
        isFrozen: true,
        championTeamId: frozen.championTeamId,
        frozenAt: frozen.frozenAt,
        standings: frozen.finalStandings,
      };
    }
  }

  // Live Aggregation from GrandPointsLedger
  const ledgerRows = await GrandPointsLedger.findAll({
    where: { grandChampionshipId: grandId },
    include: [{ model: Team, as: 'team' }],
    order: [['created_at', 'ASC']],
    transaction,
  });

  // Aggregate by Team
  const teamAggMap = new Map();

  for (const row of ledgerRows) {
    const tid = Number(row.teamId);
    if (!teamAggMap.has(tid)) {
      teamAggMap.set(tid, {
        teamId: tid,
        teamName: row.team?.name || `Team #${tid}`,
        grandPoints: 0,
        seasonWins: 0,
        podiumCount: 0,
        completedSeasonsSet: new Set(),
        earliestAwardTime: row.createdAt,
      });
    }

    const agg = teamAggMap.get(tid);
    agg.grandPoints += row.grandPointsAwarded;

    if (!row.isReversal) {
      if (row.rankPosition === 1) agg.seasonWins += 1;
      if (row.rankPosition >= 1 && row.rankPosition <= 3) agg.podiumCount += 1;
      agg.completedSeasonsSet.add(Number(row.seasonId));
    }
  }

  // Build sorted array
  const rawList = Array.from(teamAggMap.values()).map((item) => ({
    teamId: item.teamId,
    teamName: item.teamName,
    grandPoints: item.grandPoints,
    seasonWins: item.seasonWins,
    podiumCount: item.podiumCount,
    completedSeasons: item.completedSeasonsSet.size,
    earliestAwardTime: item.earliestAwardTime,
  }));

  // Apply tie-break logic
  const tiebreakOrder = grand.tiebreakConfig || ['grand_points', 'season_wins', 'podium_count', 'earliest_award'];

  rawList.sort((a, b) => {
    for (const criterion of tiebreakOrder) {
      if (criterion === 'grand_points' && a.grandPoints !== b.grandPoints) {
        return b.grandPoints - a.grandPoints;
      }
      if (criterion === 'season_wins' && a.seasonWins !== b.seasonWins) {
        return b.seasonWins - a.seasonWins;
      }
      if (criterion === 'podium_count' && a.podiumCount !== b.podiumCount) {
        return b.podiumCount - a.podiumCount;
      }
      if (criterion === 'earliest_award' && a.earliestAwardTime && b.earliestAwardTime) {
        return new Date(a.earliestAwardTime) - new Date(b.earliestAwardTime);
      }
    }
    return a.teamId - b.teamId;
  });

  const standings = rawList.map((item, idx) => ({
    rank: idx + 1,
    ...item,
  }));

  return {
    grandId,
    isFrozen: false,
    standings,
  };
}

/**
 * Fetch all Seasons linked to Grand Championship for Year Timeline.
 */
async function getGrandTimeline(grandId) {
  const seasons = await Season.findAll({
    where: { grandChampionshipId: grandId },
    include: [{ model: SeasonFrozenResult, as: 'frozenResult' }],
    order: [['start_at', 'ASC']],
  });

  return seasons.map((s) => {
    const winnerRank = s.frozenResult?.finalRankings?.[0] || null;
    return {
      seasonId: s.id,
      name: s.name,
      slug: s.slug,
      seasonType: s.seasonType,
      status: s.status,
      startAt: s.startAt,
      endAt: s.endAt,
      winner: winnerRank ? { teamId: winnerRank.teamId, teamName: winnerRank.teamName, score: winnerRank.score } : null,
      grandPointsDistribution: s.grandPointsDistribution,
    };
  });
}

/**
 * Fetch a Team's historical journey in this Grand Championship.
 */
async function getTeamJourney(grandId, teamId) {
  const records = await GrandPointsLedger.findAll({
    where: { grandChampionshipId: grandId, teamId },
    include: [{ model: Season, as: 'season' }],
    order: [['created_at', 'ASC']],
  });

  const totalPoints = records.reduce((sum, r) => sum + r.grandPointsAwarded, 0);
  const wins = records.filter((r) => r.rankPosition === 1 && !r.isReversal).length;
  const podiums = records.filter((r) => r.rankPosition >= 1 && r.rankPosition <= 3 && !r.isReversal).length;

  return {
    grandId,
    teamId,
    totalGrandPoints: totalPoints,
    wins,
    podiums,
    history: records.map((r) => ({
      id: r.id,
      seasonId: r.seasonId,
      seasonName: r.season?.name || `Season #${r.seasonId}`,
      rankPosition: r.rankPosition,
      grandPointsAwarded: r.grandPointsAwarded,
      reason: r.reason,
      createdAt: r.createdAt,
    })),
  };
}

/**
 * Fetch individual Grand Standings across all seasons in this Grand Championship.
 */
async function getGrandIndividualStandings(grandId, options = {}) {
  const transaction = options.transaction;
  const grand = await GrandChampionship.findByPk(grandId, { transaction });
  if (!grand) throw new Error(`Grand Championship #${grandId} not found`);

  const { teamId, search, page = 1, limit = 50 } = options;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));

  // 1. Check if frozen
  if (!options.ignoreFrozen && (grand.status === 'FINISHED' || grand.status === 'ARCHIVED')) {
    const frozen = await GrandFrozenResult.findOne({ where: { grandChampionshipId: grandId }, transaction });
    if (frozen && frozen.metadata?.finalIndividualStandings) {
      let frozenList = frozen.metadata.finalIndividualStandings;
      if (teamId) {
        frozenList = frozenList.filter((r) => Number(r.teamId) === Number(teamId));
      }
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        frozenList = frozenList.filter((r) => r.userName?.toLowerCase().includes(q));
      }
      const total = frozenList.length;
      const offset = (pageNum - 1) * limitNum;
      const paginated = frozenList.slice(offset, offset + limitNum);

      return {
        grandId: Number(grandId),
        scope: 'individual',
        isFrozen: true,
        championIndividualId: frozen.metadata?.championIndividualId || null,
        grandIndividualChampion: frozen.metadata?.individualChampion || frozenList[0] || null,
        totalIndividuals: total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        standings: paginated,
      };
    }
  }

  // 2. Find all linked seasons
  const seasons = await Season.findAll({
    where: { grandChampionshipId: grandId },
    attributes: ['id', 'status'],
    transaction,
  });

  const seasonIds = seasons.map((s) => s.id);
  if (seasonIds.length === 0) {
    return {
      grandId: Number(grandId),
      scope: 'individual',
      isFrozen: false,
      grandIndividualChampion: null,
      totalIndividuals: 0,
      page: pageNum,
      limit: limitNum,
      totalPages: 1,
      standings: [],
    };
  }

  // 3. Aggregate individual points from ScoreLedger across all linked seasons
  const { ScoreLedger, User, SeasonIndividualLeaderboardProjection } = require('../../models');
  const individualAggs = await ScoreLedger.findAll({
    attributes: [
      'user_id',
      [sequelize.fn('SUM', sequelize.col('points_delta')), 'totalGrandPoints'],
      [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('event_id'))), 'eventsCount'],
      [sequelize.fn('MAX', sequelize.col('created_at')), 'lastScoredAt'],
    ],
    where: {
      seasonId: { [Op.in]: seasonIds },
      userId: { [Op.ne]: null },
    },
    group: ['user_id'],
    raw: true,
    transaction,
  });

  const scoreMap = new Map();
  for (const row of individualAggs) {
    scoreMap.set(Number(row.user_id), {
      totalGrandPoints: Number(row.totalGrandPoints || 0),
      eventsCount: Number(row.eventsCount || 0),
      lastScoredAt: row.lastScoredAt,
    });
  }

  // Calculate season wins and podiums for each user from individual projections
  const projectionWins = await SeasonIndividualLeaderboardProjection.findAll({
    where: {
      seasonId: { [Op.in]: seasonIds },
      rank: { [Op.lte]: 3 },
    },
    raw: true,
    transaction,
  });

  const winsMap = new Map();
  const podiumsMap = new Map();
  for (const p of projectionWins) {
    const uid = Number(p.user_id);
    if (p.rank === 1) {
      winsMap.set(uid, (winsMap.get(uid) || 0) + 1);
    }
    podiumsMap.set(uid, (podiumsMap.get(uid) || 0) + 1);
  }

  // Fetch season members for linked seasons
  const seasonMembers = await SeasonTeamMember.findAll({
    where: { seasonId: { [Op.in]: seasonIds } },
    transaction,
  });
  const memberUserIds = new Set(seasonMembers.map((sm) => Number(sm.userId)));

  let targetUserIds = new Set([...scoreMap.keys(), ...memberUserIds]);
  if (targetUserIds.size === 0) {
    const allUsers = await User.findAll({
      where: { status: { [Op.ne]: 'inactive' } },
      attributes: ['id'],
      transaction,
    });
    for (const u of allUsers) targetUserIds.add(Number(u.id));
  }

  const userIdsArray = Array.from(targetUserIds);
  const users = await User.findAll({
    where: { id: { [Op.in]: userIdsArray.length > 0 ? userIdsArray : [0] } },
    attributes: ['id', 'name', 'email', 'jobTitle', 'department', 'isVerified', 'isDev', 'teamId', 'createdAt'],
    include: [
      { model: Team, attributes: ['id', 'name'] },
      { model: UserProfilePreference, attributes: ['avatarData', 'featuredBadges'], required: false },
    ],
    transaction,
  });

  const rawList = users.map((u) => {
    const uid = Number(u.id);
    const agg = scoreMap.get(uid) || { totalGrandPoints: 0, eventsCount: 0, lastScoredAt: null };
    const grandPoints = Number(agg.totalGrandPoints || 0);
    const pref = u.UserProfilePreference || u.userProfilePreference;
    return {
      userId: uid,
      userName: u.name || `User #${uid}`,
      userEmail: u.email || null,
      jobTitle: u.jobTitle || 'Nhân viên',
      department: u.department || 'Media & Content',
      isVerified: Boolean(u.isVerified),
      isDev: Boolean(u.isDev),
      userAvatar: pref?.avatarData || null,
      avatarData: pref?.avatarData || null,
      featuredBadges: Array.isArray(pref?.featuredBadges) ? pref.featuredBadges : [],
      teamId: u.teamId || null,
      teamName: u.Team?.name || null,
      teamColor: u.Team?.color || '#0284c7',
      grandPoints,
      score: grandPoints,
      totalScore: grandPoints,
      seasonWins: winsMap.get(uid) || 0,
      podiumCount: podiumsMap.get(uid) || 0,
      eventsCount: Number(agg.eventsCount || 0),
      lastScoredAt: agg.lastScoredAt || null,
      createdAt: u.createdAt || null,
    };
  });

  // Sort: grandPoints DESC, seasonWins DESC, podiumCount DESC, (if scored) lastScoredAt ASC, createdAt ASC, userId ASC
  rawList.sort((a, b) => {
    if (b.grandPoints !== a.grandPoints) return b.grandPoints - a.grandPoints;
    if (b.seasonWins !== a.seasonWins) return b.seasonWins - a.seasonWins;
    if (b.podiumCount !== a.podiumCount) return b.podiumCount - a.podiumCount;
    if (a.grandPoints > 0 && b.grandPoints > 0 && a.lastScoredAt && b.lastScoredAt) {
      const diff = new Date(a.lastScoredAt).getTime() - new Date(b.lastScoredAt).getTime();
      if (diff !== 0) return diff;
    }
    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (aCreated !== bCreated) return aCreated - bCreated;
    return Number(a.userId) - Number(b.userId);
  });

  const overallRanked = rawList.map((item, idx) => ({
    rank: idx + 1,
    overallRank: idx + 1,
    ...item,
  }));

  const champion = overallRanked.length > 0 ? overallRanked[0] : null;

  // Apply filtering
  let filtered = overallRanked;
  if (teamId) {
    const tidNum = Number(teamId);
    filtered = filtered.filter((item) => Number(item.teamId) === tidNum);
    filtered = filtered.map((item, idx) => ({
      ...item,
      teamRank: idx + 1,
    }));
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter((item) => item.userName.toLowerCase().includes(q));
  }

  const total = filtered.length;
  const offset = (pageNum - 1) * limitNum;
  const paginated = filtered.slice(offset, offset + limitNum);

  return {
    grandId: Number(grandId),
    scope: 'individual',
    isFrozen: false,
    championIndividualId: champion?.userId || null,
    grandIndividualChampion: champion,
    totalIndividuals: total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1,
    standings: paginated,
  };
}

module.exports = {
  getGrandStandings,
  getGrandIndividualStandings,
  getGrandTimeline,
  getTeamJourney,
};
