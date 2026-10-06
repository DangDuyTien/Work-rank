'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { Op } = require('sequelize');
const {
  sequelize,
  Season,
  SeasonTeam,
  SeasonFrozenResult,
  User,
  UserRecognition,
  Team,
} = require('../src/models');

describe('Public Spotlight API Test Suite', () => {
  let testSeason;
  let testTeam;
  let testUser;
  before(async () => {
    // Clean up any stale test-generated seasons so this test runs in clean isolation
    await Season.destroy({ where: { slug: { [Op.like]: 'test-%' } } }).catch(() => {});

    // Create test user, team, and season with true historical FINISHED semantics
    testUser = await User.create({
      name: 'Nguyễn Văn Test',
      email: `test_spotlight_${Date.now()}@workrank.local`,
      passwordHash: 'hashed_pw',
      role: 'user',
      jobTitle: 'Senior Video Editor',
      department: 'Media & Production',
      isVerified: true,
      status: 'active',
    });

    testTeam = await Team.create({
      name: `Studio Champion ${Date.now()}`,
      description: 'Test Champion Team',
    });

    testSeason = await Season.create({
      name: 'Season 05 — Championship',
      slug: `test-season-05-champ-${Date.now()}`,
      seasonType: 'MONTHLY',
      status: 'FINISHED',
      startAt: new Date(Date.now() - 30 * 86400000),
      endAt: new Date(Date.now() - 1 * 86400000),
    });

    await SeasonTeam.create({
      seasonId: testSeason.id,
      teamId: testTeam.id,
      teamNameSnapshot: testTeam.name,
      teamColorSnapshot: '#0284c7',
    });

    await SeasonFrozenResult.create({
      seasonId: testSeason.id,
      finalRankings: [
        {
          teamId: testTeam.id,
          teamName: testTeam.name,
          rank: 1,
          score: 18500,
          grandPoints: 10,
        },
      ],
      metadata: {
        totalTeams: 1,
        individualChampion: {
          userId: testUser.id,
          name: testUser.name,
          score: 4250,
          rank: 1,
        },
      },
      frozenAt: new Date(),
    });

    await UserRecognition.create({
      userId: testUser.id,
      awardType: 'mvp',
      title: 'Most Valuable Player',
      seasonId: testSeason.id,
      reason: 'Đóng góp xuất sắc nhất giải đấu',
      awardedAt: new Date(),
    });
  });

  after(async () => {
    if (testSeason) {
      await SeasonFrozenResult.destroy({ where: { seasonId: testSeason.id } });
      await UserRecognition.destroy({ where: { seasonId: testSeason.id } });
      await SeasonTeam.destroy({ where: { seasonId: testSeason.id } });
      await Season.destroy({ where: { id: testSeason.id } });
    }
    if (testTeam) await Team.destroy({ where: { id: testTeam.id } });
    if (testUser) await User.destroy({ where: { id: testUser.id } });
  });

  it('GET /api/competition/public/spotlight returns latest champion team and MVP successfully without auth', async () => {
    const res = await request(app)
      .get('/api/competition/public/spotlight')
      .expect(200);

    assert.match(res.headers['cache-control'], /no-store/);
    const revalidated = await request(app)
      .get('/api/competition/public/spotlight')
      .set('If-None-Match', res.headers.etag || 'stale-spotlight-etag')
      .expect(200);
    assert.ok(revalidated.body.hasSpotlight !== undefined);

    assert.equal(res.body.hasSpotlight, true);
    assert.ok(res.body.season);
    assert.equal(res.body.season.name, testSeason.name);

    // Champion Team
    assert.ok(res.body.championTeam);
    assert.equal(res.body.championTeam.teamName, testTeam.name);
    assert.equal(res.body.championTeam.rank, 1);
    assert.equal(res.body.championTeam.seasonScore, 18500);

    // MVP
    assert.ok(res.body.mvp);
    assert.equal(res.body.mvp.name, testUser.name);
    assert.equal(res.body.mvp.jobTitle, testUser.jobTitle);
    assert.equal(res.body.mvp.isVerified, true);
  });
});
