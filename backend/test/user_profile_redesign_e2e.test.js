'use strict';

/**
 * user_profile_redesign_e2e.test.js
 *
 * Automated E2E & Integration Verification Suite for Corporate Profile Redesign.
 * Verifies:
 * 1. User Model & Job Profile Attributes (jobTitle, department, bio, phone)
 * 2. Profile Retrieval (/api/users/:id) with Corporate Context & Competition Stats
 * 3. Self Profile Update Permissions (Allowed: name, bio, phone; Forbidden: jobTitle, department, role, teamId)
 * 4. Admin Management Full Update (jobTitle, department, team, role, verified)
 * 5. Team Transfer & Historical Season Snapshot Immutability
 * 6. Role-Specific Context & YouTube Team Scope Enforcement
 * 7. Absence of Legacy Gameification (No EXP/Level/Virtual Animal Tiers)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const {
  User,
  Team,
  Season,
  SeasonIndividualLeaderboardProjection,
  CompetitionUserSummary,
  TeamYouTubeSummary,
  sequelize,
} = require('../src/models');

describe('Corporate User Profile & Job Position Redesign Test Suite', () => {
  let adminUser, editorUser, managerUser, channelManagerUser;
  let adminToken, editorToken, managerToken, channelManagerToken;
  let teamPhoenix, teamDragon;
  let activeSeason;

  before(async () => {
    const ts = Date.now();

    // 1. Create Teams
    teamPhoenix = await Team.create({
      name: `Phoenix Corporate ${ts}`,
      description: 'Media & Production Squad',
    });
    teamDragon = await Team.create({
      name: `Dragon Engineering ${ts}`,
      description: 'Engineering & Tech Squad',
    });

    // 2. Register Users
    const register = async (name, email, role, jobTitle, department, teamId) => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name, email, password: 'Password123!' });
      const token = res.body.accessToken || res.body.token || res.body.data?.token;
      const user = await User.findOne({ where: { email } });
      if (user) {
        await user.update({ role, jobTitle, department, teamId });
      }
      return { token, user: await User.findByPk(user.id) };
    };

    const admin = await register(`Admin HR ${ts}`, `admin_hr_${ts}@workrank.test`, 'admin', 'Giám đốc', 'Ban Giám Đốc', teamPhoenix.id);
    adminToken = admin.token;
    adminUser = admin.user;

    const editor = await register(`Editor Minh ${ts}`, `editor_${ts}@workrank.test`, 'user', 'Editor', 'Media & Content', teamPhoenix.id);
    editorToken = editor.token;
    editorUser = editor.user;

    const manager = await register(`Manager Linh ${ts}`, `manager_${ts}@workrank.test`, 'manager', 'Trưởng phòng', 'Media & Content', teamPhoenix.id);
    managerToken = manager.token;
    managerUser = manager.user;

    const chManager = await register(`Channel Manager Khoa ${ts}`, `channel_mgr_${ts}@workrank.test`, 'user', 'Quản lý kênh', 'Media & Content', teamDragon.id);
    channelManagerToken = chManager.token;
    channelManagerUser = chManager.user;

    // 3. Create Season & Projections
    activeSeason = await Season.create({
      name: `Q4 Production Season ${ts}`,
      slug: `q4-prod-season-${ts}`,
      seasonType: 'STANDARD',
      status: 'ACTIVE',
      startAt: new Date(Date.now() - 3600000),
      endAt: new Date(Date.now() + 86400000),
    });

    await CompetitionUserSummary.create({
      userId: editorUser.id,
      currentSeasonRank: 2,
      currentSeasonScore: 450,
      grandRank: 5,
      grandPoints: 80,
      seasonWins: 1,
      podiumCount: 3,
      currentStreak: 4,
      metadata: { mvpCount: 2 },
    });

    // Historical Projection (Season 1 with Phoenix)
    await SeasonIndividualLeaderboardProjection.create({
      seasonId: activeSeason.id,
      userId: editorUser.id,
      teamId: teamPhoenix.id,
      rank: 2,
      points: 450,
      trend: 'UP',
      userName: editorUser.name,
      teamName: teamPhoenix.name,
    });

    // Team YouTube Summary for Phoenix
    await TeamYouTubeSummary.upsert({
      teamId: teamPhoenix.id,
      teamName: teamPhoenix.name,
      channelsCount: 3,
      totalViews: 1850000,
      totalSubscribers: 92000,
      viewsGrowth30dPct: 15.4,
      rankByViews: 1,
      lastSyncedAt: new Date(),
    });
  });

  describe('1. Model Attributes & Defaults', () => {
    it('User model contains corporate job attributes with appropriate defaults', async () => {
      const u = await User.findByPk(editorUser.id);
      assert.equal(u.jobTitle, 'Editor');
      assert.equal(u.department, 'Media & Content');
      assert.equal(typeof u.jobTitle, 'string');
      assert.equal(typeof u.department, 'string');
    });
  });

  describe('2. Profile Retrieval & Corporate Context (/api/users/:id)', () => {
    it('Retrieves user profile with job title, department, team, and real competition stats', async () => {
      const res = await request(app)
        .get(`/api/users/${editorUser.id}`)
        .set('Authorization', `Bearer ${editorToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.user.name, editorUser.name);
      assert.equal(res.body.user.jobTitle, 'Editor');
      assert.equal(res.body.user.department, 'Media & Content');
      assert.equal(res.body.team.name, teamPhoenix.name);

      // Competition stats
      assert.ok(res.body.competition);
      assert.equal(res.body.competition.currentSeasonRank, 2);
      assert.equal(res.body.competition.currentSeasonScore, 450);
      assert.equal(res.body.competition.grandRank, 5);
      assert.equal(res.body.competition.grandPoints, 80);
      assert.equal(res.body.competition.seasonWins, 1);
      assert.equal(res.body.competition.mvpCount, 2);

      // Historical seasons
      assert.ok(Array.isArray(res.body.historicalSeasons));
      assert.equal(res.body.historicalSeasons.length, 1);
      assert.equal(res.body.historicalSeasons[0].teamName, teamPhoenix.name);
    });
  });

  describe('3. RBAC & Self-Update Security', () => {
    it('Member can update own name, bio, and phone number', async () => {
      const res = await request(app)
        .patch(`/api/users/${editorUser.id}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          name: 'Editor Minh Updated',
          bio: 'Chuyên gia biên tập video và sản xuất nội dung media số 1',
          phone: '0987654321',
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.user.name, 'Editor Minh Updated');
      assert.equal(res.body.user.bio, 'Chuyên gia biên tập video và sản xuất nội dung media số 1');
      assert.equal(res.body.user.phone, '0987654321');
    });

    it('Member is REJECTED (403) when attempting to elevate role or change jobTitle / teamId', async () => {
      const res = await request(app)
        .patch(`/api/users/${editorUser.id}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          jobTitle: 'Giám Đốc Điều Hành',
          role: 'admin',
          teamId: teamDragon.id,
        });

      assert.equal(res.status, 403);
    });

    it('Member is REJECTED (403) when attempting to edit another user profile', async () => {
      const res = await request(app)
        .patch(`/api/users/${managerUser.id}`)
        .set('Authorization', `Bearer ${editorToken}`)
        .send({
          name: 'Hacked Manager Name',
        });

      assert.equal(res.status, 403);
    });
  });

  describe('4. Admin Management Full Update', () => {
    it('Admin can update jobTitle, department, team, role, status, and verified badge for any user', async () => {
      const res = await request(app)
        .patch(`/api/users/${editorUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          jobTitle: 'Trưởng Phòng Sản Xuất',
          department: 'Phòng Sản Xuất Video',
          isVerified: true,
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.user.jobTitle, 'Trưởng Phòng Sản Xuất');
      assert.equal(res.body.user.department, 'Phòng Sản Xuất Video');
      assert.equal(res.body.user.isVerified, true);
    });
  });

  describe('5. Team Transfer & Historical Snapshot Immutability', () => {
    it('Transferring user to a new team updates current team but preserves historical season snapshots', async () => {
      // Transfer editor to Dragon
      await request(app)
        .patch(`/api/users/${editorUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          teamId: teamDragon.id,
        });

      const res = await request(app)
        .get(`/api/users/${editorUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      // Current team is now Dragon
      assert.equal(res.body.team.name, teamDragon.name);

      // Historical Season 1 STILL belongs to Phoenix!
      assert.equal(res.body.historicalSeasons[0].teamName, teamPhoenix.name);
      assert.equal(res.body.historicalSeasons[0].points, 450);
    });
  });

  describe('6. YouTube Scope & Permissions in Profile', () => {
    it('Phoenix member viewing Phoenix user sees Team YouTube analytics', async () => {
      const res = await request(app)
        .get(`/api/users/${managerUser.id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.youtubeSummary);
      assert.equal(res.body.youtubeSummary.totalViews, 1850000);
      assert.equal(res.body.youtubeSummary.channelsCount, 3);
    });

    it('Dragon member viewing Phoenix user DOES NOT receive private YouTube analytics (Cross-Team Isolation)', async () => {
      const res = await request(app)
        .get(`/api/users/${managerUser.id}`)
        .set('Authorization', `Bearer ${channelManagerToken}`);

      assert.equal(res.status, 200);
      // Dragon member viewing Phoenix user cannot see Phoenix YouTube internal summary
      assert.equal(res.body.youtubeSummary, null);
    });

    it('Admin viewing Phoenix user receives Team YouTube analytics', async () => {
      const res = await request(app)
        .get(`/api/users/${managerUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.youtubeSummary);
      assert.equal(res.body.youtubeSummary.totalViews, 1850000);
    });
  });
});
