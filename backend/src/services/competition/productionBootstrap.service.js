'use strict';

/**
 * productionBootstrap.service.js
 *
 * Production Bootstrap & Real Data Activation Service for WorkRank V3.3.
 * Idempotently initializes real company teams, verified users, standard published rule sets,
 * active Grand Championship 2026, and initial Season 1 without injecting fake score records.
 */

const bcrypt = require('bcryptjs');
const sequelize = require('../../config/database');
const {
  User,
  Team,
  RuleSet,
  RuleSetVersion,
  GrandChampionship,
  Season,
  SeasonTeam,
  SeasonTeamMember,
  CompetitionAuditLog,
} = require('../../models');

const projector = require('./competitionReadModel.projector');

const STANDARD_PRODUCTION_AST = [
  {
    name: 'Production Video Approval Standard Award',
    description: 'Awards +120 Individual XP to Creator upon video task approval',
    condition_ast: { op: 'EQ', field: 'event.event_type', value: 'VIDEO_APPROVED' },
    action_ast: { type: 'ADD', value: 120 },
    effect_type: 'INDIVIDUAL_XP',
    target: 'ACTOR',
  },
  {
    name: 'Production Video Approval Team Boost',
    description: 'Awards +60 Team XP to creator team upon video task approval',
    condition_ast: { op: 'EQ', field: 'event.event_type', value: 'VIDEO_APPROVED' },
    action_ast: { type: 'ADD', value: 60, target: 'TEAM' },
    effect_type: 'TEAM_SCORE',
    target: 'TEAM',
  },
  {
    name: 'YouTube Milestone Sync Award',
    description: 'Awards +250 Individual XP when YouTube view milestone is reached',
    condition_ast: { op: 'EQ', field: 'event.event_type', value: 'YOUTUBE_MILESTONE_REACHED' },
    action_ast: { type: 'ADD', value: 250 },
    effect_type: 'INDIVIDUAL_XP',
    target: 'ACTOR',
  },
  {
    name: 'YouTube Milestone Team Boost',
    description: 'Awards +150 Team XP when YouTube view milestone is reached',
    condition_ast: { op: 'EQ', field: 'event.event_type', value: 'YOUTUBE_MILESTONE_REACHED' },
    action_ast: { type: 'ADD', value: 150, target: 'TEAM' },
    effect_type: 'TEAM_SCORE',
    target: 'TEAM',
  },
  {
    name: 'Community Peer Kudos Recognition',
    description: 'Awards +30 Individual XP to recipient when peer kudos is granted',
    condition_ast: { op: 'EQ', field: 'event.event_type', value: 'COMMUNITY_KUDOS_SENT' },
    action_ast: { type: 'ADD', value: 30 },
    effect_type: 'INDIVIDUAL_XP',
    target: 'CUSTOM_FIELD',
    target_field: 'payload.targetUserId',
  },
  {
    name: 'Video Creation 5-Streak Bonus',
    description: 'Awards +100 XP streak bonus on every 5 approved video tasks',
    condition_ast: { op: 'EQ', field: 'event.event_type', value: 'VIDEO_APPROVED' },
    action_ast: { type: 'ADD', value: 0 },
    effect_type: 'INDIVIDUAL_XP',
    state_mutation: {
      key: 'video_approved_streak',
      field: 'count',
      threshold: 5,
      reset_on_threshold: true,
      on_threshold_action: { type: 'ADD', value: 100 },
      on_threshold_effect: 'STREAK_BONUS',
      entity_type: 'user',
    },
  },
];

/**
 * Executes full idempotent bootstrap for production/staging environments.
 *
 * @param {object} [options]
 * @returns {Promise<object>} Bootstrap summary manifest
 */
async function bootstrapProductionEnvironment(options = {}) {
  const currentYear = options.grandYear || new Date().getFullYear();
  const adminEmail = options.adminEmail || process.env.PROD_ADMIN_EMAIL || 'admin@workrank.com';
  const adminPassword = options.adminPassword || process.env.PROD_ADMIN_PASSWORD || 'WorkRank@Enterprise2026';

  return await sequelize.transaction(async (t) => {
    const seededTeams = [];
    const seededUsers = [];

    let defaultTeam = null;
    if (options.seedDemoUsers) {
      const teamsData = [
        { name: 'Engineering Core', description: 'Core Platform & Infrastructure Engineers', color: '#0284c7' },
        { name: 'Media & Content Creators', description: 'Video Production & Creative Media', color: '#8b5cf6' },
        { name: 'Community & Growth', description: 'User Community, Growth & Relations', color: '#10b981' },
      ];

      for (const td of teamsData) {
        const [team] = await Team.findOrCreate({
          where: { name: td.name },
          defaults: {
            name: td.name,
            description: td.description,
          },
          transaction: t,
        });
        seededTeams.push(team);
      }
      defaultTeam = seededTeams[0];
    } else {
      const existingTeams = await Team.findAll({ transaction: t });
      seededTeams.push(...existingTeams);
      defaultTeam = seededTeams[0] || null;
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    // 2. Bootstrap Company Admin (only if adminEmail specified and doesn't exist)
    let adminUser = await User.findOne({ where: { role: 'admin' }, transaction: t });
    if (!adminUser && adminEmail) {
      adminUser = await User.create({
        name: 'WorkRank System Administrator',
        email: adminEmail,
        passwordHash: passwordHash,
        role: 'admin',
        teamId: defaultTeam ? defaultTeam.id : null,
        status: 'active',
      }, { transaction: t });
    }
    if (adminUser) {
      seededUsers.push(adminUser);
    }

    // 3. Bootstrap Initial Verified Department Users (only in test environment with explicit flag)
    if (options.seedDemoUsers && seededTeams.length >= 3) {
      const initialUsersData = [
        { name: 'Alice Media Lead', email: 'alice.creator@workrank.com', role: 'user', teamIdx: 1 },
        { name: 'Bob Community Host', email: 'bob.community@workrank.com', role: 'user', teamIdx: 2 },
        { name: 'Charlie Core Dev', email: 'charlie.dev@workrank.com', role: 'user', teamIdx: 0 },
      ];

      for (const ud of initialUsersData) {
        const targetTeam = seededTeams[ud.teamIdx];
        const [u] = await User.findOrCreate({
          where: { email: ud.email },
          defaults: {
            name: ud.name,
            email: ud.email,
            passwordHash: passwordHash,
            role: ud.role,
            teamId: targetTeam.id,
            status: 'active',
          },
          transaction: t,
        });
        seededUsers.push(u);
      }
    }

    // 4. Bootstrap Standard Enterprise Rule Set & Version
    const [ruleSet] = await RuleSet.findOrCreate({
      where: { code: 'ENTERPRISE_STANDARD' },
      defaults: {
        name: 'Standard Enterprise Competition Rules',
        code: 'ENTERPRISE_STANDARD',
        description: 'Default production rule set covering Production, YouTube, and Community activities',
        createdBy: adminUser.id,
      },
      transaction: t,
    });

    let publishedVersion = await RuleSetVersion.findOne({
      where: { ruleSetId: ruleSet.id, status: 'PUBLISHED' },
      transaction: t,
    });

    if (!publishedVersion) {
      publishedVersion = await RuleSetVersion.create(
        {
          ruleSetId: ruleSet.id,
          versionNumber: 1,
          effectiveFrom: new Date(Date.UTC(currentYear, 0, 1)),
          astPayload: STANDARD_PRODUCTION_AST,
          status: 'PUBLISHED',
          createdBy: adminUser.id,
          publishedAt: new Date(),
        },
        { transaction: t },
      );
    } else {
      publishedVersion.astPayload = STANDARD_PRODUCTION_AST;
      await publishedVersion.save({ transaction: t });
    }

    // 5. Bootstrap Active Grand Championship
    const grandSlug = options.grandSlug || `grand-championship-${currentYear}`;
    const [grand] = await GrandChampionship.findOrCreate({
      where: { year: currentYear },
      defaults: {
        name: `WorkRank Grand Championship ${currentYear}`,
        slug: grandSlug,
        year: currentYear,
        startAt: new Date(Date.UTC(currentYear, 0, 1)),
        endAt: new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59)),
        status: 'ACTIVE',
        pointsConfig: {
          distribution: [
            { rank: 1, points: 10 },
            { rank: 2, points: 7 },
            { rank: 3, points: 5 },
            { rank: 4, points: 3 },
            { rank: 5, points: 1 },
          ],
        },
        tiebreakConfig: ['TOTAL_SCORE', 'SUBMISSION_COUNT', 'EARLIEST_ACHIEVED'],
        rewardsConfig: {
          championshipTrophy: `WorkRank Annual Champion ${currentYear}`,
          topDepartmentBadge: 'Golden Excellence 2026',
        },
        createdBy: adminUser.id,
      },
      transaction: t,
    });

    if (grand.status !== 'ACTIVE') {
      grand.status = 'ACTIVE';
      await grand.save({ transaction: t });
    }

    // 6. Bootstrap Initial Season (Season 1 — Kickoff)
    const seasonStart = new Date(Date.UTC(currentYear, 0, 1, 0, 0, 0));
    const seasonEnd = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59));

    const [season] = await Season.findOrCreate({
      where: { slug: `season-1-kickoff-${currentYear}` },
      defaults: {
        name: `Season 1 — Kickoff Championship ${currentYear}`,
        slug: `season-1-kickoff-${currentYear}`,
        grandChampionshipId: grand.id,
        activeRuleSetId: ruleSet.id,
        activeRuleVersionId: publishedVersion.id,
        startAt: seasonStart,
        endAt: seasonEnd,
        status: 'ACTIVE',
        grandPointsDistribution: [10, 7, 5, 3, 1],
      },
      transaction: t,
    });

    season.status = 'ACTIVE';
    season.activeRuleSetId = ruleSet.id;
    season.activeRuleVersionId = publishedVersion.id;
    season.startAt = seasonStart;
    season.endAt = seasonEnd;
    await season.save({ transaction: t });

    // 7. Snapshot Participating Teams and Members into Season
    for (const team of seededTeams) {
      await SeasonTeam.findOrCreate({
        where: { seasonId: season.id, teamId: team.id },
        defaults: {
          seasonId: season.id,
          teamId: team.id,
          teamNameSnapshot: team.name,
          teamAvatarSnapshot: null,
          teamColorSnapshot: '#0284c7',
          isEligible: true,
          isDisqualified: false,
          joinedAt: new Date(),
        },
        transaction: t,
      });
    }

    for (const user of seededUsers) {
      if (user.teamId) {
        await SeasonTeamMember.findOrCreate({
          where: { seasonId: season.id, userId: user.id },
          defaults: {
            seasonId: season.id,
            teamId: user.teamId,
            userId: user.id,
            roleSnapshot: user.role,
            joinedAt: new Date(),
          },
          transaction: t,
        });
      }
    }

    // 8. Audit Log Bootstrap
    await CompetitionAuditLog.create(
      {
        actorId: adminUser.id,
        action: 'PRODUCTION_ENVIRONMENT_BOOTSTRAP',
        entityType: 'SYSTEM',
        entityId: 'SYSTEM_PROD_INIT',
        beforeState: null,
        afterState: {
          teamsCount: seededTeams.length,
          usersCount: seededUsers.length,
          ruleSetId: ruleSet.id,
          ruleVersionId: publishedVersion.id,
          grandId: grand.id,
          seasonId: season.id,
        },
        reason: 'Phase 10 Production Go-Live Bootstrap & Operational Initialization',
      },
      { transaction: t },
    );

    return {
      status: 'BOOTSTRAPPED',
      timestamp: new Date().toISOString(),
      adminUser: { id: adminUser.id, email: adminUser.email },
      teams: seededTeams.map((tm) => ({ id: tm.id, name: tm.name })),
      usersCount: seededUsers.length,
      ruleSet: { id: ruleSet.id, name: ruleSet.name, version: publishedVersion.versionNumber, rulesCount: STANDARD_PRODUCTION_AST.length },
      grandChampionship: { id: grand.id, name: grand.name, year: grand.year, status: grand.status },
      season: { id: season.id, name: season.name, status: season.status },
      rulesAst: STANDARD_PRODUCTION_AST,
    };
  });
}

module.exports = {
  bootstrapProductionEnvironment,
  STANDARD_PRODUCTION_AST,
};
