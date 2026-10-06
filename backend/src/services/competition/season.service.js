'use strict';

/**
 * season.service.js
 *
 * Season Domain Service:
 *   - Lifecycle State Machine: DRAFT → SCHEDULED → ACTIVE ⇄ PAUSED → CALCULATING → FINISHED → ARCHIVED
 *   - Team & Membership Snapshotting
 *   - Season Leaderboard Aggregation & Freeze
 *   - Audit Logging
 */

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const {
  Season,
  SeasonTeam,
  SeasonTeamMember,
  SeasonFrozenResult,
  RuleSet,
  RuleSetVersion,
  Team,
  User,
  UserProfilePreference,
  ScoreLedger,
  CompetitionAuditLog,
} = require('../../models');
const competitionRealtime = require('./competitionRealtime.service');

// ─── State Machine Transitions ────────────────────────────────────────────────

const VALID_TRANSITIONS = {
  DRAFT: ['SCHEDULED', 'ACTIVE', 'ARCHIVED'],
  SCHEDULED: ['ACTIVE', 'DRAFT', 'ARCHIVED'],
  ACTIVE: ['PAUSED', 'CALCULATING', 'FINISHED'],
  PAUSED: ['ACTIVE', 'CALCULATING', 'FINISHED'],
  CALCULATING: ['FINISHED', 'ACTIVE'], // can revert if recalculation needed
  FINISHED: ['ARCHIVED'],
  ARCHIVED: [],
};

function validateTransition(currentStatus, targetStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    throw new Error(`Invalid season transition: cannot transition from ${currentStatus} to ${targetStatus}`);
  }
}

// ─── Audit Logger Helper ──────────────────────────────────────────────────────

async function logAudit({ actorId, action, entityType, entityId, beforeState, afterState, reason, transaction }) {
  await CompetitionAuditLog.create(
    {
      actorId: actorId ?? null,
      action,
      entityType,
      entityId: String(entityId),
      beforeState: beforeState ?? null,
      afterState: afterState ?? null,
      reason: reason ?? null,
    },
    { transaction },
  );
}

// ─── CRUD & Lifecycle ─────────────────────────────────────────────────────────

async function createSeason(data, actorId) {
  const {
    name,
    slug,
    description,
    seasonType = 'MONTHLY',
    startAt,
    endAt,
    gracePeriodHours = 2,
    timezone = 'Asia/Ho_Chi_Minh',
    activeRuleSetId,
    activeRuleVersionId,
    grandPointsDistribution,
    config,
  } = data;

  if (!name || !slug || !startAt || !endAt) {
    throw new Error('Season requires name, slug, startAt, and endAt');
  }

  if (new Date(startAt) >= new Date(endAt)) {
    throw new Error('Season startAt must be before endAt');
  }

  return sequelize.transaction(async (t) => {
    const season = await Season.create(
      {
        name,
        slug,
        description,
        seasonType,
        status: 'DRAFT',
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        gracePeriodHours,
        timezone,
        activeRuleSetId: activeRuleSetId ?? null,
        activeRuleVersionId: activeRuleVersionId ?? null,
        grandPointsDistribution: grandPointsDistribution ?? null,
        config: config ?? null,
        createdBy: actorId ?? null,
      },
      { transaction: t },
    );

    await logAudit({
      actorId,
      action: 'SEASON_CREATED',
      entityType: 'SEASON',
      entityId: season.id,
      afterState: season.toJSON(),
      transaction: t,
    });

    return season;
  });
}

async function updateSeasonStatus(seasonId, targetStatus, actorId, reason) {
  const updatedSeason = await sequelize.transaction(async (t) => {
    const season = await Season.findByPk(seasonId, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!season) throw new Error(`Season #${seasonId} not found`);

    validateTransition(season.status, targetStatus);
    const beforeState = season.toJSON();

    season.status = targetStatus;
    await season.save({ transaction: t });

    // If transitioning to FINISHED, calculate and freeze final rankings
    if (targetStatus === 'FINISHED') {
      await freezeSeasonResult(seasonId, t);
    }

    await logAudit({
      actorId,
      action: `SEASON_STATUS_${targetStatus}`,
      entityType: 'SEASON',
      entityId: season.id,
      beforeState,
      afterState: season.toJSON(),
      reason,
      transaction: t,
    });

    return season;
  });

  // After transaction commits: Automatically settle Grand Points if Season is FINISHED
  if (targetStatus === 'FINISHED') {
    try {
      const grandPointsService = require('./grandPoints.service');
      await grandPointsService.settleSeasonGrandPoints(seasonId, actorId);
    } catch (err) {
      console.warn('[SeasonService] Automatic Grand Points settlement warning:', err.message);
    }

    try {
      const recognitionService = require('../recognition.service');
      await recognitionService.syncSeasonChampionRecognitions(seasonId, actorId);
    } catch (err) {
      console.warn('[SeasonService] Recognition sync warning:', err.message);
    }
  }

  // Phase 6 — Update Season Leaderboard Projection
  try {
    const projector = require('./competitionReadModel.projector');
    await projector.projectSeasonLeaderboard(seasonId);
    competitionRealtime.emitLeaderboardUpdated({ seasonId });
  } catch (err) {
    console.warn('[SeasonService] Projection update warning:', err.message);
  }

  return updatedSeason;
}

// ─── Team & Member Snapshotting ───────────────────────────────────────────────

async function addTeamToSeason(seasonId, teamId, options = {}) {
  return sequelize.transaction(async (t) => {
    const season = await Season.findByPk(seasonId, { transaction: t });
    if (!season) throw new Error(`Season #${seasonId} not found`);

    const team = await Team.findByPk(teamId, {
      include: [{ model: User }],
      transaction: t,
    });
    if (!team) throw new Error(`Team #${teamId} not found`);

    // 1. Snapshot Team
    const [seasonTeam] = await SeasonTeam.findOrCreate({
      where: { seasonId, teamId },
      defaults: {
        seasonId,
        teamId,
        teamNameSnapshot: team.name,
        teamAvatarSnapshot: options.avatar || null,
        teamColorSnapshot: options.color || '#0284c7',
        isEligible: true,
        isDisqualified: false,
        joinedAt: new Date(),
      },
      transaction: t,
    });

    // 2. Snapshot Team Members
    const members = team.Users || [];
    for (const member of members) {
      await SeasonTeamMember.findOrCreate({
        where: { seasonId, userId: member.id },
        defaults: {
          seasonId,
          teamId,
          userId: member.id,
          roleSnapshot: member.role || 'member',
          joinedAt: new Date(),
        },
        transaction: t,
      });
    }

    return seasonTeam;
  });
}

// ─── Leaderboard Calculation & Freeze ─────────────────────────────────────────

async function getSeasonLeaderboard(seasonId, options = {}) {
  const transaction = options.transaction;
  const season = await Season.findByPk(seasonId, { transaction });
  if (!season) {
    const err = new Error(`Season #${seasonId} not found`);
    err.status = 404;
    throw err;
  }

  // If already finished and frozen, return frozen result directly
  if (season.status === 'FINISHED' || season.status === 'ARCHIVED') {
    const frozen = await SeasonFrozenResult.findOne({ where: { seasonId }, transaction });
    if (frozen) {
      return {
        seasonId,
        scope: 'team',
        isFrozen: true,
        frozenAt: frozen.frozenAt,
        rankings: frozen.finalRankings,
        grandPoints: frozen.grandPointsAwarded,
      };
    }
  }

  // Live aggregation from ScoreLedger
  let seasonTeams = await SeasonTeam.findAll({
    where: { seasonId, isDisqualified: false },
    transaction,
  });

  if (seasonTeams.length === 0) {
    const allTeams = await Team.findAll({ transaction });
    seasonTeams = allTeams.map((t) => ({
      teamId: t.id,
      teamNameSnapshot: t.name,
      teamAvatarSnapshot: null,
      teamColorSnapshot: '#0284c7',
      isEligible: true,
    }));
  }

  // Map users to teamId so points from ScoreLedger are accurately attributed to teams
  const userTeamRows = await User.findAll({
    where: { teamId: { [Op.ne]: null } },
    attributes: ['id', 'teamId'],
    raw: true,
    transaction,
  });
  const userToTeam = new Map();
  for (const u of userTeamRows) {
    userToTeam.set(Number(u.id), Number(u.teamId));
  }

  const scoreLedgerRows = await ScoreLedger.findAll({
    where: {
      seasonId,
      [Op.or]: [
        { effectType: { [Op.ne]: 'INDIVIDUAL_XP' } },
        { effectType: 'TEAM_SCORE' },
      ],
    },
    attributes: ['userId', 'teamId', 'pointsDelta', 'effectType'],
    raw: true,
    transaction,
  });

  const scoreMap = new Map();
  for (const row of scoreLedgerRows) {
    if (row.effectType === 'INDIVIDUAL_XP') {
      continue;
    }
    const tId = Number(row.teamId) || (row.userId ? userToTeam.get(Number(row.userId)) : null);
    if (tId) {
      scoreMap.set(tId, (scoreMap.get(tId) || 0) + Number(row.pointsDelta || 0));
    }
  }

  // Build sorted rankings
  const rankings = seasonTeams
    .map((st) => {
      const score = scoreMap.get(Number(st.teamId)) || 0;
      return {
        teamId: st.teamId,
        teamName: st.teamNameSnapshot,
        avatar: st.teamAvatarSnapshot,
        color: st.teamColorSnapshot || '#0284c7',
        score,
        isEligible: st.isEligible !== false,
      };
    })
    .sort((a, b) => b.score - a.score || Number(a.teamId) - Number(b.teamId))
    .map((item, idx) => ({ rank: idx + 1, ...item }));

  return {
    seasonId,
    scope: 'team',
    isFrozen: false,
    rankings,
  };
}

async function getSeasonIndividualLeaderboard(seasonId, options = {}) {
  const transaction = options.transaction;
  const season = await Season.findByPk(seasonId, { transaction });
  if (!season) {
    const err = new Error(`Season #${seasonId} not found`);
    err.status = 404;
    throw err;
  }

  const { teamId, search, page = 1, limit = 50 } = options;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));

  // Check if frozen
  if (season.status === 'FINISHED' || season.status === 'ARCHIVED') {
    const frozen = await SeasonFrozenResult.findOne({ where: { seasonId }, transaction });
    if (frozen && frozen.metadata?.finalIndividualRankings) {
      let frozenList = frozen.metadata.finalIndividualRankings;
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
        seasonId: Number(seasonId),
        scope: 'individual',
        isFrozen: true,
        frozenAt: frozen.frozenAt,
        seasonIndividualChampion: frozen.metadata.individualChampion || frozenList[0] || null,
        totalIndividuals: total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        rankings: paginated,
      };
    }
  }

  // 1. Get all registered members for this season
  const seasonMembers = await SeasonTeamMember.findAll({
    where: { seasonId },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'jobTitle', 'department', 'isVerified', 'isDev', 'teamId', 'createdAt'],
        include: [
          { model: UserProfilePreference, attributes: ['avatarData', 'featuredBadges'], required: false },
        ],
      },
      { model: Season, as: 'season' },
    ],
    transaction,
  });

  const memberTeamMap = new Map();
  const userMap = new Map();
  for (const sm of seasonMembers) {
    memberTeamMap.set(Number(sm.userId), Number(sm.teamId));
    if (sm.user) {
      userMap.set(Number(sm.userId), sm.user);
    }
  }

  // Also get team details
  const seasonTeams = await SeasonTeam.findAll({
    where: { seasonId },
    transaction,
  });
  const teamInfoMap = new Map();
  for (const st of seasonTeams) {
    teamInfoMap.set(Number(st.teamId), {
      name: st.teamNameSnapshot,
      avatar: st.teamAvatarSnapshot,
      color: st.teamColorSnapshot || '#0284c7',
    });
  }

  // 2. Query individual scores from ScoreLedger
  const individualScores = await ScoreLedger.findAll({
    attributes: [
      'user_id',
      [sequelize.fn('SUM', sequelize.col('points_delta')), 'totalPoints'],
      [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('event_id'))), 'eventsCount'],
      [sequelize.fn('MAX', sequelize.col('created_at')), 'lastScoredAt'],
    ],
    where: {
      seasonId,
      userId: { [Op.ne]: null },
      effectType: { [Op.ne]: 'TEAM_SCORE' },
    },
    group: ['user_id'],
    raw: true,
    transaction,
  });

  const scoreMap = new Map();
  for (const row of individualScores) {
    const uid = Number(row.user_id);
    scoreMap.set(uid, {
      points: Number(row.totalPoints || 0),
      eventsCount: Number(row.eventsCount || 0),
      lastScoredAt: row.lastScoredAt,
    });
  }

  // 3. Build complete set of all participants (from members or score ledger)
  // If no members registered yet, include all active users
  let allUserIds = new Set([...memberTeamMap.keys(), ...scoreMap.keys()]);
  if (allUserIds.size === 0) {
    const fallbackUsers = await User.findAll({
      where: {
        status: { [Op.ne]: 'inactive' },
        isSimulated: { [Op.ne]: true },
      },
      attributes: ['id', 'name', 'email', 'jobTitle', 'department', 'isVerified', 'isDev', 'teamId', 'createdAt'],
      include: [
        { model: Team, attributes: ['id', 'name'] },
        { model: UserProfilePreference, attributes: ['avatarData', 'featuredBadges'], required: false },
      ],
      transaction,
    });
    for (const u of fallbackUsers) {
      userMap.set(Number(u.id), u);
      if (u.teamId) memberTeamMap.set(Number(u.id), Number(u.teamId));
      allUserIds.add(Number(u.id));
    }
  }

  const rawList = [];

  for (const uid of allUserIds) {
    const scoreData = scoreMap.get(uid) || { points: 0, eventsCount: 0, lastScoredAt: null };
    let userObj = userMap.get(uid);
    if (!userObj) {
      userObj = await User.findByPk(uid, {
        attributes: ['id', 'name', 'email', 'jobTitle', 'department', 'isVerified', 'isDev', 'teamId', 'createdAt'],
        include: [
          { model: Team, attributes: ['id', 'name'] },
          { model: UserProfilePreference, attributes: ['avatarData', 'featuredBadges'], required: false },
        ],
        transaction,
      });
      if (userObj) userMap.set(uid, userObj);
    }

    const tid = memberTeamMap.get(uid) || userObj?.teamId || null;
    const teamInfo = tid ? teamInfoMap.get(tid) || (userObj?.Team ? { name: userObj.Team.name, avatar: null, color: '#0284c7' } : null) : null;
    const pref = userObj?.UserProfilePreference || userObj?.userProfilePreference;

    rawList.push({
      userId: uid,
      userName: userObj?.name || `User #${uid}`,
      userEmail: userObj?.email || null,
      jobTitle: userObj?.jobTitle || 'Nhân viên',
      department: userObj?.department || 'Media & Content',
      isVerified: Boolean(userObj?.isVerified),
      isDev: Boolean(userObj?.isDev),
      userAvatar: pref?.avatarData || null,
      avatarData: pref?.avatarData || null,
      featuredBadges: Array.isArray(pref?.featuredBadges) ? pref.featuredBadges : [],
      teamId: tid,
      teamName: teamInfo?.name || null,
      teamColor: teamInfo?.color || '#0284c7',
      points: scoreData.points,
      score: scoreData.points,
      totalScore: scoreData.points,
      eventsCount: scoreData.eventsCount,
      lastScoredAt: scoreData.lastScoredAt,
      createdAt: userObj?.createdAt || null,
    });
  }

  // 4. Sort strictly: points DESC, lastScoredAt ASC (if both scored > 0), createdAt ASC (account created earlier ranks higher), userId ASC
  rawList.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (a.points > 0 && b.points > 0 && a.lastScoredAt && b.lastScoredAt) {
      const timeDiff = new Date(a.lastScoredAt).getTime() - new Date(b.lastScoredAt).getTime();
      if (timeDiff !== 0) return timeDiff;
    }
    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (aCreated !== bCreated) return aCreated - bCreated;
    return Number(a.userId) - Number(b.userId);
  });

  // Assign overall rank
  const overallRanked = rawList.map((item, idx) => ({
    rank: idx + 1,
    overallRank: idx + 1,
    ...item,
  }));

  const champion = overallRanked.length > 0 ? overallRanked[0] : null;

  // 5. Apply filtering
  let filtered = overallRanked;
  if (teamId) {
    const tidNum = Number(teamId);
    filtered = filtered.filter((item) => Number(item.teamId) === tidNum);
    // Assign team rank
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
    seasonId: Number(seasonId),
    scope: 'individual',
    isFrozen: false,
    seasonIndividualChampion: champion,
    totalIndividuals: total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1,
    rankings: paginated,
  };
}

async function freezeSeasonResult(seasonId, transaction) {
  const season = await Season.findByPk(seasonId, { transaction });
  const teamLeaderboard = await getSeasonLeaderboard(seasonId, { transaction });
  const individualLeaderboard = await getSeasonIndividualLeaderboard(seasonId, { limit: 1000, transaction });

  let rawDist = season.grandPointsDistribution;
  if (typeof rawDist === 'string') {
    try {
      rawDist = JSON.parse(rawDist);
    } catch (e) {}
  }
  let distribution = [];
  if (Array.isArray(rawDist)) {
    distribution = rawDist.map((pts, idx) => ({ rank: idx + 1, points: Number(pts) }));
  } else if (Array.isArray(rawDist?.distribution)) {
    distribution = rawDist.distribution;
  } else {
    distribution = [
      { rank: 1, points: 10 },
      { rank: 2, points: 7 },
      { rank: 3, points: 5 },
      { rank: 4, points: 3 },
      { rank: 5, points: 1 },
    ];
  }

  const grandPointsAwarded = teamLeaderboard.rankings.map((r) => {
    const dist = distribution.find((d) => d.rank === r.rank);
    return {
      teamId: r.teamId,
      teamName: r.teamName,
      rank: r.rank,
      seasonScore: r.score,
      grandPoints: dist ? dist.points : 0,
    };
  });

  await SeasonFrozenResult.upsert(
    {
      seasonId,
      finalRankings: teamLeaderboard.rankings,
      grandPointsAwarded,
      metadata: {
        totalTeams: teamLeaderboard.rankings.length,
        frozenByStatus: season.status,
        finalIndividualRankings: individualLeaderboard.rankings,
        individualChampion: individualLeaderboard.seasonIndividualChampion,
      },
      frozenAt: new Date(),
    },
    { transaction },
  );

  return SeasonFrozenResult.findOne({ where: { seasonId }, transaction });
}

module.exports = {
  createSeason,
  updateSeasonStatus,
  addTeamToSeason,
  getSeasonLeaderboard,
  getSeasonIndividualLeaderboard,
  freezeSeasonResult,
  logAudit,
  validateTransition,
};
