'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const {
  Team,
  User,
  Season,
  SeasonTeam,
  SeasonTeamMember,
  ScoreLedger,
  CompetitionTeamSummary,
  SeasonLeaderboardProjection,
  SeasonIndividualLeaderboardProjection,
  GrandChampionship,
  GrandLeaderboardProjection,
  GrandIndividualLeaderboardProjection,
  GrandPointsLedger,
  SeasonFrozenResult,
} = require('../src/models');

const groupService = require('../src/services/group.service');
const seasonService = require('../src/services/competition/season.service');
const rankingService = require('../src/services/ranking/ranking.service');
const projector = require('../src/services/competition/competitionReadModel.projector');
const consistencyService = require('../src/services/competition/readModelConsistency.service');
const teamSyncService = require('../src/services/teamSync.service');

test('Team Data Consistency & Master Rename Propagation Suite', async (t) => {
  const testSuffix = Date.now();
  let adminUser;
  let testTeamAlpha;
  let testTeamBeta;
  let memberAlpha;
  let memberBeta;
  let activeSeason;
  let activeGrand;
  let finishedSeason;

  await t.test('Setup test master data, users, season and scores', async () => {
    adminUser = await User.create({
      name: `Admin Consistency ${testSuffix}`,
      email: `admin_consistency_${testSuffix}@example.com`,
      passwordHash: 'dummy_hash',
      role: 'admin',
      status: 'active',
    });

    testTeamAlpha = await Team.create({
      name: `Team 50tr ${testSuffix}`,
      description: 'Original Team 50tr',
      ownerId: adminUser.id,
      inviteCode: `WR-A${testSuffix.toString().slice(-4)}`,
    });

    testTeamBeta = await Team.create({
      name: `Team Beta ${testSuffix}`,
      description: 'Challenger Team Beta',
      ownerId: adminUser.id,
      inviteCode: `WR-B${testSuffix.toString().slice(-4)}`,
    });

    memberAlpha = await User.create({
      name: `Alpha Member ${testSuffix}`,
      email: `alpha_mem_${testSuffix}@example.com`,
      passwordHash: 'dummy_hash',
      role: 'user',
      teamId: testTeamAlpha.id,
      status: 'active',
    });

    memberBeta = await User.create({
      name: `Beta Member ${testSuffix}`,
      email: `beta_mem_${testSuffix}@example.com`,
      passwordHash: 'dummy_hash',
      role: 'user',
      teamId: testTeamBeta.id,
      status: 'active',
    });

    activeGrand = await GrandChampionship.create({
      name: `Grand Consistency ${testSuffix}`,
      slug: `grand-consistency-${testSuffix}`,
      year: 2026 + Math.floor(Math.random() * 1000),
      status: 'ACTIVE',
      startAt: new Date(Date.now() - 3600 * 1000),
      endAt: new Date(Date.now() + 86400 * 1000),
    });

    activeSeason = await Season.create({
      name: `Season Consistency ${testSuffix}`,
      slug: `season-consistency-${testSuffix}`,
      seasonType: 'MONTHLY',
      status: 'ACTIVE',
      startAt: new Date(Date.now() - 3600 * 1000),
      endAt: new Date(Date.now() + 86400 * 1000),
      grandChampionshipId: activeGrand.id,
      createdBy: adminUser.id,
    });

    await SeasonTeam.create({
      seasonId: activeSeason.id,
      teamId: testTeamAlpha.id,
      teamNameSnapshot: testTeamAlpha.name,
      teamAvatarSnapshot: null,
      teamColorSnapshot: '#0284c7',
      isEligible: true,
    });

    await SeasonTeam.create({
      seasonId: activeSeason.id,
      teamId: testTeamBeta.id,
      teamNameSnapshot: testTeamBeta.name,
      teamAvatarSnapshot: null,
      teamColorSnapshot: '#10b981',
      isEligible: true,
    });

    await SeasonTeamMember.create({
      seasonId: activeSeason.id,
      teamId: testTeamAlpha.id,
      userId: memberAlpha.id,
    });

    await SeasonTeamMember.create({
      seasonId: activeSeason.id,
      teamId: testTeamBeta.id,
      userId: memberBeta.id,
    });

    // Award 500 points to Alpha, 300 to Beta
    await ScoreLedger.create({
      id: crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID(),
      eventId: crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID(),
      idempotencyKey: `idem-alpha-${testSuffix}`,
      seasonId: activeSeason.id,
      userId: memberAlpha.id,
      teamId: testTeamAlpha.id,
      pointsDelta: 500,
      effectType: 'TEAM_SCORE',
      reason: 'Alpha high performance',
    });

    await ScoreLedger.create({
      id: crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID(),
      eventId: crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID(),
      idempotencyKey: `idem-beta-${testSuffix}`,
      seasonId: activeSeason.id,
      userId: memberBeta.id,
      teamId: testTeamBeta.id,
      pointsDelta: 300,
      effectType: 'TEAM_SCORE',
      reason: 'Beta performance',
    });

    // Run initial read model projections
    await projector.projectSeasonLeaderboard(activeSeason.id);
    await projector.projectSeasonIndividualLeaderboard(activeSeason.id);
    await projector.projectTeamSummary(testTeamAlpha.id, { seasonId: activeSeason.id, grandId: activeGrand.id });
    await projector.projectTeamSummary(testTeamBeta.id, { seasonId: activeSeason.id, grandId: activeGrand.id });
  });

  await t.test('1. Initial leaderboard displays original team name and correct score', async () => {
    const leaderboard = await seasonService.getSeasonLeaderboard(activeSeason.id);
    assert.strictEqual(leaderboard.rankings.length, 2);
    const alphaRank = leaderboard.rankings.find((r) => Number(r.teamId) === Number(testTeamAlpha.id));
    assert.ok(alphaRank);
    assert.strictEqual(alphaRank.teamName, `Team 50tr ${testSuffix}`);
    assert.strictEqual(alphaRank.score, 500);
    assert.strictEqual(alphaRank.rank, 1);

    const rankingsPayload = await rankingService.getTeamRankings({ scope: 'season', seasonId: activeSeason.id });
    const alphaItem = rankingsPayload.items.find((i) => Number(i.teamId) === Number(testTeamAlpha.id));
    assert.ok(alphaItem);
    assert.strictEqual(alphaItem.teamName, `Team 50tr ${testSuffix}`);
    assert.strictEqual(alphaItem.totalScore, 500);
  });

  await t.test('2. Renaming Team updates canonical table and automatically syncs all read models', async () => {
    const newTeamName = `Team Vô Địch 100tr ${testSuffix}`;

    // Update team name via canonical group service
    const updatedGroup = await groupService.update(adminUser, testTeamAlpha.id, {
      name: newTeamName,
      description: 'Renamed and upgraded',
    });

    assert.strictEqual(updatedGroup.name, newTeamName);

    // Verify canonical Team record
    const reloadedTeam = await Team.findByPk(testTeamAlpha.id);
    assert.strictEqual(reloadedTeam.name, newTeamName);

    // Verify active SeasonTeam snapshot is updated
    const seasonTeam = await SeasonTeam.findOne({
      where: { seasonId: activeSeason.id, teamId: testTeamAlpha.id },
    });
    assert.strictEqual(seasonTeam.teamNameSnapshot, newTeamName);

    // Verify CompetitionTeamSummary is updated
    const teamSummary = await CompetitionTeamSummary.findByPk(testTeamAlpha.id);
    assert.strictEqual(teamSummary.teamName, newTeamName);

    // Verify SeasonLeaderboardProjection is updated
    const slp = await SeasonLeaderboardProjection.findOne({
      where: { seasonId: activeSeason.id, teamId: testTeamAlpha.id },
    });
    assert.strictEqual(slp.teamName, newTeamName);

    // Verify SeasonIndividualLeaderboardProjection is updated
    const silp = await SeasonIndividualLeaderboardProjection.findOne({
      where: { seasonId: activeSeason.id, teamId: testTeamAlpha.id },
    });
    if (silp) {
      assert.strictEqual(silp.teamName, newTeamName);
    }
  });

  await t.test('3. Live Domain Queries and Ranking Service immediately return the NEW name with preserved score', async () => {
    const newTeamName = `Team Vô Địch 100tr ${testSuffix}`;

    // 1. Season domain leaderboard
    const seasonLb = await seasonService.getSeasonLeaderboard(activeSeason.id);
    const alphaRank = seasonLb.rankings.find((r) => Number(r.teamId) === Number(testTeamAlpha.id));
    assert.ok(alphaRank);
    assert.strictEqual(alphaRank.teamName, newTeamName);
    assert.strictEqual(alphaRank.score, 500);
    assert.strictEqual(alphaRank.rank, 1);

    // 2. Ranking service getTeamRankings (scope: season)
    const teamRankings = await rankingService.getTeamRankings({ scope: 'season', seasonId: activeSeason.id });
    const teamItem = teamRankings.items.find((i) => Number(i.teamId) === Number(testTeamAlpha.id));
    assert.ok(teamItem);
    assert.strictEqual(teamItem.teamName, newTeamName);
    assert.strictEqual(teamItem.totalScore, 500);
    assert.strictEqual(teamItem.rank, 1);

    // 3. Ranking service getTeamRankings (scope: all-time)
    const allTimeRankings = await rankingService.getTeamRankings({ scope: 'all-time' });
    const allTimeItem = allTimeRankings.items.find((i) => Number(i.teamId) === Number(testTeamAlpha.id));
    if (allTimeItem) {
      assert.strictEqual(allTimeItem.teamName, newTeamName);
    }

    // 4. Ranking overview
    const overview = await rankingService.getRankingOverview();
    const topTeamInOverview = overview.activeSeason?.topTeams?.find((t) => Number(t.teamId) === Number(testTeamAlpha.id));
    if (topTeamInOverview) {
      assert.strictEqual(topTeamInOverview.teamName, newTeamName);
      assert.strictEqual(topTeamInOverview.totalScore, 500);
    }
  });

  await t.test('4. Self-Healing Reconciliation tool detects and repairs manual database drift', async () => {
    // Deliberately introduce stale drift into projection
    await SeasonLeaderboardProjection.update(
      { teamName: 'Corrupted Stale Name' },
      { where: { seasonId: activeSeason.id, teamId: testTeamAlpha.id } }
    );

    // Check consistency should flag drift
    const checkBefore = await consistencyService.checkConsistency({ seasonId: activeSeason.id });
    assert.strictEqual(checkBefore.status, 'DRIFT_FOUND');
    assert.ok(checkBefore.diffs.some((d) => d.field === 'teamName'));

    // Run self-healing reconciliation
    const healReport = await consistencyService.reconcileTeamMetadata();
    assert.ok(healReport.totalTeamsChecked > 0);

    // Check consistency should now pass with zero drift
    const checkAfter = await consistencyService.checkConsistency({ seasonId: activeSeason.id });
    assert.strictEqual(checkAfter.status, 'PASS');
    assert.strictEqual(checkAfter.driftCount, 0);

    const healedSLP = await SeasonLeaderboardProjection.findOne({
      where: { seasonId: activeSeason.id, teamId: testTeamAlpha.id },
    });
    assert.strictEqual(healedSLP.teamName, `Team Vô Địch 100tr ${testSuffix}`);
  });

  await t.test('5. Historical Frozen Seasons preserve frozen snapshot without corruption', async () => {
    // Create a finished season and freeze it
    finishedSeason = await Season.create({
      name: `Historical Season ${testSuffix}`,
      slug: `historical-season-${testSuffix}`,
      seasonType: 'MONTHLY',
      status: 'FINISHED',
      startAt: new Date(Date.now() - 100000),
      endAt: new Date(Date.now() - 1000),
      createdBy: adminUser.id,
    });

    const frozenRankings = [
      {
        rank: 1,
        teamId: testTeamAlpha.id,
        teamName: 'Historical Frozen Alpha Name',
        score: 1000,
        isEligible: true,
      },
    ];

    await SeasonFrozenResult.create({
      seasonId: finishedSeason.id,
      finalRankings: frozenRankings,
      frozenAt: new Date(),
    });

    // Query finished season leaderboard
    const frozenLb = await seasonService.getSeasonLeaderboard(finishedSeason.id);
    assert.strictEqual(frozenLb.isFrozen, true);
    assert.strictEqual(frozenLb.rankings[0].teamName, 'Historical Frozen Alpha Name');

    // Run team sync again
    await teamSyncService.syncTeamAcrossReadModelsAndRealtime(testTeamAlpha.id);

    // Verify frozen snapshot was NOT mutated
    const frozenLbAfter = await seasonService.getSeasonLeaderboard(finishedSeason.id);
    assert.strictEqual(frozenLbAfter.isFrozen, true);
    assert.strictEqual(frozenLbAfter.rankings[0].teamName, 'Historical Frozen Alpha Name');
  });

  await t.test('Cleanup test records', async () => {
    if (activeSeason) {
      await SeasonFrozenResult.destroy({ where: { seasonId: [activeSeason.id, finishedSeason?.id].filter(Boolean) } });
      await SeasonLeaderboardProjection.destroy({ where: { seasonId: activeSeason.id } });
      await SeasonIndividualLeaderboardProjection.destroy({ where: { seasonId: activeSeason.id } });
      await ScoreLedger.destroy({ where: { seasonId: activeSeason.id } });
      await SeasonTeamMember.destroy({ where: { seasonId: activeSeason.id } });
      await SeasonTeam.destroy({ where: { seasonId: activeSeason.id } });
      await Season.destroy({ where: { id: [activeSeason.id, finishedSeason?.id].filter(Boolean) } });
    }
    if (testTeamAlpha || testTeamBeta) {
      await CompetitionTeamSummary.destroy({ where: { teamId: [testTeamAlpha?.id, testTeamBeta?.id].filter(Boolean) } });
    }
    if (activeGrand) {
      await GrandChampionship.destroy({ where: { id: activeGrand.id } });
    }
    if (memberAlpha || memberBeta || adminUser) {
      await User.destroy({ where: { id: [memberAlpha?.id, memberBeta?.id, adminUser?.id].filter(Boolean) } });
    }
    if (testTeamAlpha || testTeamBeta) {
      await Team.destroy({ where: { id: [testTeamAlpha?.id, testTeamBeta?.id].filter(Boolean) } });
    }
  });
});
