'use strict';

/**
 * competition.controller.js
 *
 * Endpoints:
 *   GET  /api/competition/my-state           → User: own state summary
 *   GET  /api/competition/my-score-history   → User: recent score events
 *   GET  /api/competition/admin/states       → Admin: all states for a season
 *   GET  /api/competition/admin/states/:id   → Admin: single state detail
 *   GET  /api/competition/admin/score-inspect/:userId  → Admin: score ledger for user
 */

const sequelize = require('../config/database');
const { ScoreLedger, CompetitionEvent } = require('../models');
const competitionStateService = require('../services/competition/competitionState.service');
const { Op } = require('sequelize');

// ─── User endpoints ───────────────────────────────────────────────────────────

/**
 * GET /api/competition/my-state
 * Returns the current user's competition states (all state_keys for their user_id).
 */
async function getMyState(req, res) {
  const userId = req.user.id;
  const seasonId = req.query.season_id ? Number(req.query.season_id) : null;

  const { rows } = await competitionStateService.listStatesForSeason({
    seasonId,
    entityType: 'user',
  });

  // Filter to only this user's states
  const myStates = rows
    .filter((s) => Number(s.entityId) === Number(userId))
    .map((s) => ({
      stateKey: s.stateKey,
      data: s.dataJson,
      version: s.version,
      expiresAt: s.expiresAt,
      updatedAt: s.updatedAt,
      isExpired: s.expiresAt ? new Date(s.expiresAt) <= new Date() : false,
    }));

  return res.json({ states: myStates });
}

/**
 * GET /api/competition/my-score-history
 * Returns the current user's recent score ledger entries (max 50).
 */
async function getMyScoreHistory(req, res) {
  const userId = req.user.id;
  const limit = Math.min(Number(req.query.limit ?? 20), 50);

  const rows = await ScoreLedger.findAll({
    where: { userId },
    order: [['created_at', 'DESC']],
    limit,
  });

  const history = rows.map((r) => ({
    id: r.id,
    pointsDelta: r.pointsDelta,
    effectType: r.effectType,
    reason: r.reason,
    eventId: r.eventId,
    createdAt: r.createdAt,
    metadata: r.metadata,
  }));

  return res.json({ history });
}

// ─── Admin endpoints ──────────────────────────────────────────────────────────

/**
 * GET /api/competition/admin/states?season_id=&entity_type=&limit=&offset=
 * Admin: list all competition states for a season.
 */
async function adminListStates(req, res) {
  const seasonId = req.query.season_id ? Number(req.query.season_id) : null;
  const entityType = req.query.entity_type || null;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);

  const { count, rows } = await competitionStateService.listStatesForSeason({
    seasonId,
    entityType,
    limit,
    offset,
  });

  return res.json({
    total: count,
    limit,
    offset,
    states: rows.map((s) => ({
      id: s.id,
      entityType: s.entityType,
      entityId: s.entityId,
      stateKey: s.stateKey,
      data: s.dataJson,
      version: s.version,
      expiresAt: s.expiresAt,
      updatedAt: s.updatedAt,
      isExpired: s.expiresAt ? new Date(s.expiresAt) <= new Date() : false,
    })),
  });
}

/**
 * GET /api/competition/admin/states/:id
 * Admin: single state detail + related score events.
 */
async function adminGetStateDetail(req, res) {
  const { CompetitionState } = require('../models');
  const state = await CompetitionState.findByPk(req.params.id);
  if (!state) return res.status(404).json({ message: 'State not found' });

  // Find score ledger entries related to this entity
  const recentScores = await ScoreLedger.findAll({
    where: { userId: state.entityType === 'user' ? state.entityId : null },
    order: [['created_at', 'DESC']],
    limit: 20,
  });

  return res.json({
    state: {
      id: state.id,
      entityType: state.entityType,
      entityId: state.entityId,
      stateKey: state.stateKey,
      data: state.dataJson,
      version: state.version,
      expiresAt: state.expiresAt,
      updatedAt: state.updatedAt,
      createdAt: state.createdAt,
    },
    recentScores: recentScores.map((r) => ({
      pointsDelta: r.pointsDelta,
      effectType: r.effectType,
      reason: r.reason,
      eventId: r.eventId,
      createdAt: r.createdAt,
    })),
  });
}

/**
 * GET /api/competition/admin/score-inspect/:userId
 * Admin: full score ledger for a user with event details.
 */
async function adminScoreInspect(req, res) {
  const userId = Number(req.params.userId);
  const limit = Math.min(Number(req.query.limit ?? 30), 100);
  const offset = Number(req.query.offset ?? 0);

  const { count, rows } = await ScoreLedger.findAndCountAll({
    where: { userId },
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  return res.json({
    userId,
    total: count,
    totalScore: rows.reduce((sum, r) => sum + (r.pointsDelta || 0), 0),
    entries: rows.map((r) => ({
      id: r.id,
      pointsDelta: r.pointsDelta,
      effectType: r.effectType,
      reason: r.reason,
      eventId: r.eventId,
      ruleVersionId: r.ruleVersionId,
      metadata: r.metadata,
      createdAt: r.createdAt,
    })),
  });
}

// ─── Phase 4 — Season & Arena User Endpoints ─────────────────────────────────

const seasonService = require('../services/competition/season.service');
const ruleSetService = require('../services/competition/ruleSet.service');
const challengeService = require('../services/competition/challenge.service');
const { Season, SeasonTeam, SeasonTeamMember, RuleSet, RuleSetVersion, Challenge, CompetitionAuditLog } = require('../models');

/**
 * GET /api/competition/seasons/active
 * Returns the currently active season.
 */
async function getActiveSeason(req, res) {
  const activeSeason = await Season.findOne({
    where: { status: { [Op.in]: ['ACTIVE', 'PAUSED', 'SCHEDULED'] } },
    order: [['start_at', 'ASC']],
    include: [
      { model: SeasonTeam, as: 'teams' },
      { model: Challenge, as: 'challenges' },
    ],
  });

  return res.json({ season: activeSeason });
}

/**
 * GET /api/competition/seasons/:id
 * Returns season details, user's team in season, rules, and active challenges.
 */
async function getSeasonDetail(req, res) {
  const seasonId = req.params.id;
  const userId = req.user.id;

  const season = await Season.findByPk(seasonId, {
    include: [
      { model: SeasonTeam, as: 'teams' },
      { model: Challenge, as: 'challenges' },
      { model: RuleSet, as: 'ruleSet' },
      { model: RuleSetVersion, as: 'activeRuleVersion' },
    ],
  });

  if (!season) return res.status(404).json({ message: 'Season not found' });

  // Find user's team membership in this season
  const userMembership = await SeasonTeamMember.findOne({
    where: { seasonId, userId },
  });

  let myTeam = null;
  if (userMembership) {
    myTeam = season.teams?.find((t) => Number(t.teamId) === Number(userMembership.teamId)) || null;
  }

  return res.json({
    season,
    myTeam,
    myMembership: userMembership,
  });
}

/**
 * GET /api/competition/seasons/:id/leaderboard
 */
async function getSeasonLeaderboard(req, res) {
  const seasonId = req.params.id;
  const { scope = 'team', page, limit, teamId, search } = req.query;
  if (scope === 'individual') {
    const data = await seasonService.getSeasonIndividualLeaderboard(seasonId, { page, limit, teamId, search });
    return res.json(data);
  }
  const leaderboard = await seasonService.getSeasonLeaderboard(seasonId);
  return res.json(leaderboard);
}

/**
 * GET /api/competition/seasons/:id/individual-leaderboard
 */
async function getSeasonIndividualLeaderboard(req, res) {
  const seasonId = req.params.id;
  const { page, limit, teamId, search } = req.query;
  const data = await seasonService.getSeasonIndividualLeaderboard(seasonId, { page, limit, teamId, search });
  return res.json(data);
}

/**
 * GET /api/competition/seasons/:id/challenges
 */
async function getSeasonChallenges(req, res) {
  const seasonId = req.params.id;
  const challenges = await challengeService.listChallengesForSeason(seasonId);
  return res.json({ challenges });
}

// ─── Phase 4 — Admin Season Management Endpoints ─────────────────────────────

async function adminListSeasons(req, res) {
  const seasons = await Season.findAll({
    order: [['created_at', 'DESC']],
    include: [{ model: SeasonTeam, as: 'teams' }],
  });
  return res.json({ seasons });
}

async function adminCreateSeason(req, res) {
  const season = await seasonService.createSeason(req.body, req.user.id);
  return res.status(201).json({ season });
}

async function adminUpdateSeasonStatus(req, res) {
  const { status, reason } = req.body;
  if (!status) return res.status(400).json({ message: 'Status is required' });

  const season = await seasonService.updateSeasonStatus(req.params.id, status, req.user.id, reason);
  return res.json({ season });
}

async function adminAddTeamToSeason(req, res) {
  const { teamId, avatar, color } = req.body;
  if (!teamId) return res.status(400).json({ message: 'teamId is required' });

  const seasonTeam = await seasonService.addTeamToSeason(req.params.id, teamId, { avatar, color });
  return res.status(201).json({ seasonTeam });
}

// ─── Phase 7 — Rule Sets & Visual Rule Builder Endpoints ─────────────────────

async function getSeasonRules(req, res) {
  const seasonId = req.params.id;
  const summary = await ruleSetService.getSeasonRulesSummary(seasonId);
  return res.json(summary);
}

async function adminListRuleSets(req, res) {
  const ruleSets = await ruleSetService.listRuleSets(req.query);
  return res.json({ ruleSets });
}

async function adminGetRuleSet(req, res) {
  const ruleSet = await ruleSetService.getRuleSet(req.params.id);
  return res.json({ ruleSet });
}

async function adminCreateRuleSet(req, res) {
  const ruleSet = await ruleSetService.createRuleSet(req.body, req.user.id);
  return res.status(201).json({ ruleSet });
}

async function adminUpdateRuleSet(req, res) {
  const ruleSet = await ruleSetService.updateRuleSet(req.params.id, req.body, req.user.id);
  return res.json({ ruleSet });
}

async function adminArchiveRuleSet(req, res) {
  const { reason } = req.body || {};
  const result = await ruleSetService.archiveRuleSet(req.params.id, req.user.id, reason);
  return res.json(result);
}

async function adminCreateRuleSetVersion(req, res) {
  const version = await ruleSetService.createRuleSetVersion(req.params.id, req.body, req.user.id);
  return res.status(201).json({ version });
}

async function adminGetRuleSetVersion(req, res) {
  const version = await ruleSetService.getRuleSetVersion(req.params.versionId);
  return res.json({ version });
}

async function adminUpdateDraftVersion(req, res) {
  const version = await ruleSetService.updateDraftVersion(req.params.versionId, req.body, req.user.id);
  return res.json({ version });
}

async function adminDuplicateVersion(req, res) {
  const version = await ruleSetService.duplicateRuleSetVersion(req.params.versionId, req.user.id);
  return res.status(201).json({ version });
}

async function adminValidateVersion(req, res) {
  const astPayload = req.body.astPayload || req.body;
  const result = ruleSetService.validateVersionPayload(astPayload);
  return res.json(result);
}

async function adminPublishRuleSetVersion(req, res) {
  const { reason } = req.body || {};
  const version = await ruleSetService.publishRuleSetVersion(req.params.versionId, req.user.id, reason);
  return res.json({ version });
}

async function adminSimulateRule(req, res) {
  const result = await ruleSetService.simulateRule(req.body, req.user.id);
  return res.json(result);
}

async function adminDiffVersions(req, res) {
  const { fromVersionId, toVersionId } = req.params;
  const result = await ruleSetService.diffVersions(fromVersionId, toVersionId);
  return res.json(result);
}

async function adminCreateChallenge(req, res) {
  const challenge = await challengeService.createChallenge(req.params.id, req.body);
  return res.status(201).json({ challenge });
}

async function adminListAuditLogs(req, res) {
  const limit = Math.min(Number(req.query.limit ?? 50), 100);
  const logs = await CompetitionAuditLog.findAll({
    order: [['created_at', 'DESC']],
    limit,
  });
  return res.json({ logs });
}

// ─── Phase 5 — Grand Championship Endpoints ──────────────────────────────────

const grandChampionshipService = require('../services/competition/grandChampionship.service');
const grandPointsService = require('../services/competition/grandPoints.service');
const grandLeaderboardService = require('../services/competition/grandLeaderboard.service');
const { GrandChampionship } = require('../models');

async function getCurrentGrandChampionship(req, res) {
  const current = await GrandChampionship.findOne({
    where: { status: { [Op.in]: ['ACTIVE', 'SCHEDULED', 'CALCULATING', 'FINISHED'] } },
    order: [
      // Prioritize ACTIVE, then SCHEDULED, then newest
      [sequelize.literal("CASE WHEN status = 'ACTIVE' THEN 1 WHEN status = 'SCHEDULED' THEN 2 ELSE 3 END"), 'ASC'],
      ['year', 'DESC'],
    ],
  });

  return res.json({ grand: current });
}

async function getGrandStandings(req, res) {
  const grandId = req.params.id;
  const { scope = 'team', page, limit, teamId, search } = req.query;
  if (scope === 'individual') {
    const data = await grandLeaderboardService.getGrandIndividualStandings(grandId, { page, limit, teamId, search });
    return res.json(data);
  }
  const standings = await grandLeaderboardService.getGrandStandings(grandId);
  return res.json(standings);
}

async function getGrandIndividualStandings(req, res) {
  const grandId = req.params.id;
  const { page, limit, teamId, search } = req.query;
  const data = await grandLeaderboardService.getGrandIndividualStandings(grandId, { page, limit, teamId, search });
  return res.json(data);
}

async function getGrandTimeline(req, res) {
  const grandId = req.params.id;
  const timeline = await grandLeaderboardService.getGrandTimeline(grandId);
  return res.json({ timeline });
}

async function getGrandTeamJourney(req, res) {
  const { id: grandId, teamId } = req.params;
  const journey = await grandLeaderboardService.getTeamJourney(grandId, teamId);
  return res.json(journey);
}

// Admin Grand Endpoints
async function adminListGrandChampionships(req, res) {
  const grands = await GrandChampionship.findAll({
    order: [['year', 'DESC'], ['created_at', 'DESC']],
  });
  return res.json({ championships: grands });
}

async function adminCreateGrandChampionship(req, res) {
  const grand = await grandChampionshipService.createGrandChampionship(req.body, req.user.id);
  return res.status(201).json({ grand });
}

async function adminUpdateGrandStatus(req, res) {
  const { status, reason, forceOverride } = req.body;
  if (!status) return res.status(400).json({ message: 'Status is required' });

  const isOverride = Boolean(forceOverride);
  if (isOverride && (!reason || !reason.trim())) {
    return res.status(400).json({ message: 'A non-empty audit reason is mandatory when forceOverride is enabled' });
  }

  const grand = await grandChampionshipService.updateGrandStatus(
    req.params.id,
    status,
    req.user.id,
    reason,
    { forceOverride: isOverride },
  );

  return res.json({ grand });
}

async function adminLinkSeasonToGrand(req, res) {
  const { id: grandId, seasonId } = req.params;
  const season = await grandChampionshipService.linkSeasonToGrand(grandId, seasonId, req.user.id);
  return res.json({ season });
}

async function adminSettleSeasonGrandPoints(req, res) {
  const { seasonId } = req.params;
  const result = await grandPointsService.settleSeasonGrandPoints(seasonId, req.user.id);
  return res.json(result);
}

async function adminReconcileGrandPoints(req, res) {
  const { id: grandId } = req.params;
  const { seasonId, teamId, pointsAdjustment, reason } = req.body;
  const record = await grandPointsService.reconcileGrandPoints({
    grandId,
    seasonId,
    teamId,
    pointsAdjustment: Number(pointsAdjustment),
    reason,
    actorId: req.user.id,
  });
  return res.status(201).json({ record });
}

// ─── Phase 6 — Read Models & Competition Dashboard Endpoints ─────────────────

const competitionDashboardService = require('../services/competition/competitionDashboard.service');
const competitionAnalyticsService = require('../services/competition/competitionAnalytics.service');
const readModelConsistencyService = require('../services/competition/readModelConsistency.service');

/**
 * GET /api/competition/dashboard
 * User Competition Dashboard Overview (Summary, My Team, Active Season Leaders, Grand Leaders, Recent Activities)
 */
async function getCompetitionDashboard(req, res) {
  const data = await competitionDashboardService.getUserDashboard(req.user.id);
  return res.json(data);
}

/**
 * GET /api/competition/teams/:teamId/summary
 */
async function getTeamSummary(req, res) {
  const { teamId } = req.params;
  const data = await competitionDashboardService.getTeamSummary(Number(teamId));
  return res.json(data);
}

/**
 * GET /api/competition/activity
 */
async function getActivityFeed(req, res) {
  const { userId, teamId, seasonId, grandId, activityType, page, limit } = req.query;
  const data = await competitionDashboardService.getActivityFeed({
    userId: userId ? Number(userId) : undefined,
    teamId: teamId ? Number(teamId) : undefined,
    seasonId: seasonId ? Number(seasonId) : undefined,
    grandId: grandId ? Number(grandId) : undefined,
    activityType,
    page,
    limit,
  });
  return res.json(data);
}

/**
 * GET /api/competition/company-overview
 */
async function getCompanyOverview(req, res) {
  const data = await competitionDashboardService.getCompanyOverview();
  return res.json(data);
}

/**
 * GET /api/competition/projections/seasons/:id/leaderboard
 */
async function getProjectedSeasonLeaderboard(req, res) {
  const { id: seasonId } = req.params;
  const { scope = 'team', page, limit, teamId, search } = req.query;
  if (scope === 'individual') {
    const data = await competitionDashboardService.getSeasonIndividualLeaderboardProjection(seasonId, { page, limit, teamId, search });
    return res.json(data);
  }
  const data = await competitionDashboardService.getSeasonLeaderboardProjection(seasonId, { page, limit });
  return res.json(data);
}

/**
 * GET /api/competition/projections/grand/:id/leaderboard
 */
async function getProjectedGrandLeaderboard(req, res) {
  const { id: grandId } = req.params;
  const { scope = 'team', page, limit, teamId, search } = req.query;
  if (scope === 'individual') {
    const data = await competitionDashboardService.getGrandIndividualLeaderboardProjection(grandId, { page, limit, teamId, search });
    return res.json(data);
  }
  const data = await competitionDashboardService.getGrandLeaderboardProjection(grandId, { page, limit });
  return res.json(data);
}

/**
 * GET /api/competition/top-performers
 */
async function getTopPerformers(req, res) {
  const data = await competitionDashboardService.getTopPerformers(req.query);
  return res.json(data);
}

/**
 * GET /api/competition/users/:id/competition-profile
 */
async function getUserCompetitionProfile(req, res) {
  const userId = Number(req.params.id || req.user.id);
  const data = await competitionDashboardService.getEmployeeBreakdown(userId, req.query);
  return res.json(data);
}

/**
 * GET /api/competition/admin/employee-excellence
 */
async function adminGetEmployeeExcellence(req, res) {
  const { seasonId, grandId, teamId, search, page = 1, limit = 50 } = req.query;
  if (seasonId) {
    const data = await seasonService.getSeasonIndividualLeaderboard(seasonId, { teamId, search, page, limit });
    return res.json(data);
  }
  if (grandId) {
    const data = await grandLeaderboardService.getGrandIndividualStandings(grandId, { teamId, search, page, limit });
    return res.json(data);
  }
  const activeSeason = await Season.findOne({
    where: { status: { [Op.in]: ['ACTIVE', 'PAUSED'] } },
    order: [['start_at', 'DESC']],
  });
  if (activeSeason) {
    const data = await seasonService.getSeasonIndividualLeaderboard(activeSeason.id, { teamId, search, page, limit });
    return res.json(data);
  }
  return res.json({ rankings: [], totalIndividuals: 0 });
}

/**
 * GET /api/competition/admin/dashboard
 */
async function adminGetCompetitionDashboard(req, res) {
  const data = await competitionAnalyticsService.getAdminDashboard();
  return res.json(data);
}

/**
 * GET /api/competition/admin/projections/status
 */
async function adminGetProjectionsStatus(req, res) {
  const data = await competitionAnalyticsService.getProjectionStatus();
  return res.json(data);
}

/**
 * GET /api/competition/admin/projections/consistency
 */
async function adminCheckProjectionsConsistency(req, res) {
  const { seasonId, grandId, userId } = req.query;
  const data = await readModelConsistencyService.checkConsistency({
    seasonId: seasonId ? Number(seasonId) : undefined,
    grandId: grandId ? Number(grandId) : undefined,
    userId: userId ? Number(userId) : undefined,
  });
  return res.json(data);
}

/**
 * POST /api/competition/admin/projections/rebuild
 */
async function adminRebuildProjections(req, res) {
  const { reason } = req.body || {};
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Audit reason is required to trigger read model rebuild' });
  }

  const result = await competitionAnalyticsService.triggerRebuild(req.user.id, reason.trim());
  return res.json(result);
}

// ─── Phase 8 — Product Integration & Event Tracing ─────────────────────────
const eventContractRegistry = require('../services/competition/eventContractRegistry.service');
const eventIngestionService = require('../services/competition/eventIngestion.service');
const competitionEventTrace = require('../services/competition/competitionEventTrace.service');
const competitionIntegrationMonitor = require('../services/competition/competitionIntegrationMonitor.service');
const productionIntegration = require('../services/competition/productionIntegration.service');
const youtubeIntegration = require('../services/competition/youtubeIntegration.service');
const communityIntegration = require('../services/competition/communityIntegration.service');

async function listEventContracts(req, res) {
  const contracts = eventContractRegistry.listContracts();
  res.json({ contracts });
}

async function publishDomainEvent(req, res) {
  const result = await eventIngestionService.publishEvent(req.body);
  res.status(201).json(result);
}

async function getEventTrace(req, res) {
  const { eventId } = req.params;
  const trace = await competitionEventTrace.getEventTrace(eventId, req.user);
  res.json(trace);
}

async function adminGetIntegrationHealth(req, res) {
  const health = await competitionIntegrationMonitor.getIntegrationHealth();
  res.json(health);
}

async function adminListIntegrationEvents(req, res) {
  const list = await competitionIntegrationMonitor.listIntegrationEvents(req.query);
  res.json(list);
}

async function adminRetryIntegrationEvent(req, res) {
  const { eventId } = req.params;
  const { reason } = req.body;
  const result = await competitionIntegrationMonitor.retryFailedEvent(eventId, req.user.id, reason);
  res.json(result);
}

async function triggerProductionAction(req, res) {
  const { action, ...params } = req.body;
  let result;
  if (action === 'video_published') {
    result = await productionIntegration.recordVideoPublished(params);
  } else if (action === 'script_approved') {
    result = await productionIntegration.recordScriptApproved(params);
  } else if (action === 'edit_approved') {
    result = await productionIntegration.recordEditApproved(params);
  } else if (action === 'qc_passed') {
    result = await productionIntegration.recordQCPassed(params);
  } else {
    result = await productionIntegration.recordVideoApproved(params);
  }
  res.status(201).json(result);
}

async function triggerYouTubeMilestone(req, res) {
  const { type, ...params } = req.body;
  let result;
  if (type === 'subscriber') {
    result = await youtubeIntegration.recordSubscriberMilestone(params);
  } else if (type === 'performance') {
    result = await youtubeIntegration.recordPerformanceMilestone(params);
  } else {
    result = await youtubeIntegration.recordViewMilestone(params);
  }
  res.status(201).json(result);
}

async function triggerCommunityKudos(req, res) {
  const result = await communityIntegration.recordKudosSent(req.body);
  res.status(201).json(result);
}

module.exports = {
  getMyState,
  getMyScoreHistory,
  adminListStates,
  adminGetStateDetail,
  adminScoreInspect,
  // Phase 4
  getActiveSeason,
  getSeasonDetail,
  getSeasonLeaderboard,
  getSeasonIndividualLeaderboard,
  getSeasonChallenges,
  adminListSeasons,
  adminCreateSeason,
  adminUpdateSeasonStatus,
  adminAddTeamToSeason,
  adminListRuleSets,
  adminGetRuleSet,
  adminCreateRuleSet,
  adminUpdateRuleSet,
  adminArchiveRuleSet,
  adminCreateRuleSetVersion,
  adminGetRuleSetVersion,
  adminUpdateDraftVersion,
  adminDuplicateVersion,
  adminValidateVersion,
  adminPublishRuleSetVersion,
  adminSimulateRule,
  adminDiffVersions,
  getSeasonRules,
  adminCreateChallenge,
  adminListAuditLogs,
  // Phase 5
  getCurrentGrandChampionship,
  getGrandStandings,
  getGrandIndividualStandings,
  getGrandTimeline,
  getGrandTeamJourney,
  adminListGrandChampionships,
  adminCreateGrandChampionship,
  adminUpdateGrandStatus,
  adminLinkSeasonToGrand,
  adminSettleSeasonGrandPoints,
  adminReconcileGrandPoints,
  // Phase 6 & Individual Leaderboards
  getCompetitionDashboard,
  getTeamSummary,
  getActivityFeed,
  getCompanyOverview,
  getProjectedSeasonLeaderboard,
  getProjectedGrandLeaderboard,
  getTopPerformers,
  getUserCompetitionProfile,
  adminGetEmployeeExcellence,
  adminGetCompetitionDashboard,
  adminGetProjectionsStatus,
  adminCheckProjectionsConsistency,
  adminRebuildProjections,
  // Phase 8
  listEventContracts,
  publishDomainEvent,
  getEventTrace,
  adminGetIntegrationHealth,
  adminListIntegrationEvents,
  adminRetryIntegrationEvent,
  triggerProductionAction,
  triggerYouTubeMilestone,
  triggerCommunityKudos,
};
