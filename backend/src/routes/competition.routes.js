'use strict';

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { auth, requireRole } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/competition.controller');

const router = express.Router();

// ─── Public routes (unauthenticated) ───────────────────────────────────────
router.get('/public/spotlight', asyncHandler(ctrl.getPublicSpotlight));
router.get('/public/seasons', asyncHandler(ctrl.getPublicSeasons));
router.get('/public/seasons/:id', asyncHandler(ctrl.getPublicSeasonDetail));

// ─── User routes (authenticated) ─────────────────────────────────────────────
router.get('/my-state', auth, asyncHandler(ctrl.getMyState));
router.get('/my-score-history', auth, asyncHandler(ctrl.getMyScoreHistory));
router.get('/seasons/active', auth, asyncHandler(ctrl.getActiveSeason));
router.get('/seasons/:id', auth, asyncHandler(ctrl.getSeasonDetail));
router.get('/seasons/:id/rules', auth, asyncHandler(ctrl.getSeasonRules));
router.get('/seasons/:id/leaderboard', auth, asyncHandler(ctrl.getSeasonLeaderboard));
router.get('/seasons/:id/individual-leaderboard', auth, asyncHandler(ctrl.getSeasonIndividualLeaderboard));
router.get('/seasons/:id/challenges', auth, asyncHandler(ctrl.getSeasonChallenges));
router.get('/grand/current', auth, asyncHandler(ctrl.getCurrentGrandChampionship));
router.get('/grand/:id/standings', auth, asyncHandler(ctrl.getGrandStandings));
router.get('/grand/:id/individual-standings', auth, asyncHandler(ctrl.getGrandIndividualStandings));
router.get('/grand/:id/timeline', auth, asyncHandler(ctrl.getGrandTimeline));
router.get('/grand/:id/teams/:teamId/journey', auth, asyncHandler(ctrl.getGrandTeamJourney));
router.get('/top-performers', auth, asyncHandler(ctrl.getTopPerformers));
router.get('/users/:id/competition-profile', auth, asyncHandler(ctrl.getUserCompetitionProfile));

// ─── Admin routes (admin role required) ──────────────────────────────────────
router.get('/admin/states', auth, requireRole('admin'), asyncHandler(ctrl.adminListStates));
router.get('/admin/states/:id', auth, requireRole('admin'), asyncHandler(ctrl.adminGetStateDetail));
router.get('/admin/score-inspect/:userId', auth, requireRole('admin'), asyncHandler(ctrl.adminScoreInspect));
router.get('/admin/seasons', auth, requireRole('admin'), asyncHandler(ctrl.adminListSeasons));
router.post('/admin/seasons', auth, requireRole('admin'), asyncHandler(ctrl.adminCreateSeason));
router.patch('/admin/seasons/:id/status', auth, requireRole('admin'), asyncHandler(ctrl.adminUpdateSeasonStatus));
router.post('/admin/seasons/:id/teams', auth, requireRole('admin'), asyncHandler(ctrl.adminAddTeamToSeason));

// Phase 4 & Phase 7 Rule Sets & Visual Rule Builder Routes
router.get('/admin/rules', auth, requireRole('admin'), asyncHandler(ctrl.adminListRuleSets));
router.get('/admin/rule-sets', auth, requireRole('admin'), asyncHandler(ctrl.adminListRuleSets));
router.post('/admin/rules', auth, requireRole('admin'), asyncHandler(ctrl.adminCreateRuleSet));
router.post('/admin/rule-sets', auth, requireRole('admin'), asyncHandler(ctrl.adminCreateRuleSet));
router.get('/admin/rules/:id', auth, requireRole('admin'), asyncHandler(ctrl.adminGetRuleSet));
router.put('/admin/rules/:id', auth, requireRole('admin'), asyncHandler(ctrl.adminUpdateRuleSet));
router.post('/admin/rules/:id/archive', auth, requireRole('admin'), asyncHandler(ctrl.adminArchiveRuleSet));
router.post('/admin/rules/:id/versions', auth, requireRole('admin'), asyncHandler(ctrl.adminCreateRuleSetVersion));
router.post('/admin/rule-sets/:id/versions', auth, requireRole('admin'), asyncHandler(ctrl.adminCreateRuleSetVersion));
router.get('/admin/rules/:id/versions/:versionId', auth, requireRole('admin'), asyncHandler(ctrl.adminGetRuleSetVersion));
router.put('/admin/rules/:id/versions/:versionId', auth, requireRole('admin'), asyncHandler(ctrl.adminUpdateDraftVersion));
router.post('/admin/rules/:id/versions/:versionId/duplicate', auth, requireRole('admin'), asyncHandler(ctrl.adminDuplicateVersion));
router.post('/admin/rules/:id/versions/:versionId/validate', auth, requireRole('admin'), asyncHandler(ctrl.adminValidateVersion));
router.post('/admin/rules/:id/versions/:versionId/publish', auth, requireRole('admin'), asyncHandler(ctrl.adminPublishRuleSetVersion));
router.post('/admin/rule-sets/versions/:versionId/publish', auth, requireRole('admin'), asyncHandler(ctrl.adminPublishRuleSetVersion));
router.post('/admin/rules/simulate', auth, requireRole('admin'), asyncHandler(ctrl.adminSimulateRule));
router.post('/admin/rules/:id/simulate', auth, requireRole('admin'), asyncHandler(ctrl.adminSimulateRule));
router.get('/admin/rules/:id/diff/:fromVersionId/:toVersionId', auth, requireRole('admin'), asyncHandler(ctrl.adminDiffVersions));

router.post('/admin/seasons/:id/challenges', auth, requireRole('admin'), asyncHandler(ctrl.adminCreateChallenge));
router.get('/admin/audit-logs', auth, requireRole('admin'), asyncHandler(ctrl.adminListAuditLogs));
// Phase 5 Admin Grand routes
router.get('/admin/grand', auth, requireRole('admin'), asyncHandler(ctrl.adminListGrandChampionships));
router.post('/admin/grand', auth, requireRole('admin'), asyncHandler(ctrl.adminCreateGrandChampionship));
router.patch('/admin/grand/:id/status', auth, requireRole('admin'), asyncHandler(ctrl.adminUpdateGrandStatus));
router.post('/admin/grand/:id/seasons/:seasonId/link', auth, requireRole('admin'), asyncHandler(ctrl.adminLinkSeasonToGrand));
router.post('/admin/grand/:id/seasons/:seasonId/settle', auth, requireRole('admin'), asyncHandler(ctrl.adminSettleSeasonGrandPoints));
router.post('/admin/grand/:id/reconcile', auth, requireRole('admin'), asyncHandler(ctrl.adminReconcileGrandPoints));

// ─── Phase 6 — Read Models & Competition Dashboard ───────────────────────────
router.get('/dashboard', auth, asyncHandler(ctrl.getCompetitionDashboard));
router.get('/teams/:teamId/summary', auth, asyncHandler(ctrl.getTeamSummary));
router.get('/activity', auth, asyncHandler(ctrl.getActivityFeed));
router.get('/company-overview', auth, asyncHandler(ctrl.getCompanyOverview));
router.get('/projections/seasons/:id/leaderboard', auth, asyncHandler(ctrl.getProjectedSeasonLeaderboard));
router.get('/projections/grand/:id/leaderboard', auth, asyncHandler(ctrl.getProjectedGrandLeaderboard));

// Phase 6 Admin Analytics & Projection Control
router.get('/admin/dashboard', auth, requireRole('admin'), asyncHandler(ctrl.adminGetCompetitionDashboard));
router.get('/admin/employee-excellence', auth, requireRole('admin'), asyncHandler(ctrl.adminGetEmployeeExcellence));
router.get('/admin/projections/status', auth, requireRole('admin'), asyncHandler(ctrl.adminGetProjectionsStatus));
router.get('/admin/projections/consistency', auth, requireRole('admin'), asyncHandler(ctrl.adminCheckProjectionsConsistency));
router.post('/admin/projections/rebuild', auth, requireRole('admin'), asyncHandler(ctrl.adminRebuildProjections));

// ─── Phase 8 — Product Integration & Event Tracing ─────────────────────────
router.get('/events/:eventId/trace', auth, asyncHandler(ctrl.getEventTrace));
router.get('/contracts', auth, asyncHandler(ctrl.listEventContracts));
router.post('/events/publish', auth, asyncHandler(ctrl.publishDomainEvent));
router.post('/integration/production/video-action', auth, asyncHandler(ctrl.triggerProductionAction));
router.post('/integration/youtube/milestone', auth, asyncHandler(ctrl.triggerYouTubeMilestone));
router.post('/integration/community/kudos', auth, asyncHandler(ctrl.triggerCommunityKudos));

router.get('/admin/integration/health', auth, requireRole('admin'), asyncHandler(ctrl.adminGetIntegrationHealth));
router.get('/admin/integration/events', auth, requireRole('admin'), asyncHandler(ctrl.adminListIntegrationEvents));
router.post('/admin/events/:eventId/retry', auth, requireRole('admin'), asyncHandler(ctrl.adminRetryIntegrationEvent));

module.exports = router;
