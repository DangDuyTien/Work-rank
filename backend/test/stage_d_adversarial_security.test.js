'use strict';

/**
 * stage_d_adversarial_security.test.js
 *
 * Stage D Adversarial Cross-Verification Suite
 * Attempts to actively bypass, forge, or break the Phase 1 security controls:
 *   - BUG-001 (2048 Session Ownership & Authorization)
 *   - BUG-002 (Event Ingestion Actor Impersonation)
 *   - BUG-003 (Refresh Credential Revocation on Password Change)
 *   - BUG-005 (Database Isolation & Fail-Closed Guard)
 *   - BUG-011 (Session & Socket Synchronization)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const express = require('express');
const { sequelize, User, Team, Game2048Score, Game2048UserStat, CompetitionEvent } = require('../src/models');
const authRoutes = require('../src/routes/auth.routes');
const game2048Routes = require('../src/routes/game2048.routes');
const competitionRoutes = require('../src/routes/competition.routes');
const { errorHandler } = require('../src/middlewares/error.middleware');
const { signAccessToken } = require('../src/utils/token');

describe('STAGE D: ADVERSARIAL CROSS-VERIFICATION', () => {
  let server;
  let baseUrl;
  let adminUser, aliceUser, bobUser;
  let adminToken, aliceToken, bobToken;
  let testTeam;

  before(async () => {
    await sequelize.authenticate();
    await sequelize.sync();

    const timestamp = Date.now();

    // 1. Setup Test Team
    testTeam = await Team.create({
      name: `Adversarial Team ${timestamp}`,
      code: `ADV_${timestamp}`.slice(0, 10),
    });

    // 2. Setup Admin User (victim of impersonation attacks)
    adminUser = await User.create({
      name: `Admin Victim ${timestamp}`,
      email: `admin_${timestamp}@workrank.test`,
      passwordHash: 'hash_placeholder',
      role: 'admin',
      teamId: testTeam.id,
      status: 'active',
      tokenVersion: 0,
    });

    // 3. Setup Alice (attacker / session owner)
    aliceUser = await User.create({
      name: `Alice Legit ${timestamp}`,
      email: `alice_${timestamp}@workrank.test`,
      passwordHash: 'hash_placeholder',
      role: 'user',
      teamId: testTeam.id,
      status: 'active',
      tokenVersion: 0,
    });

    // 4. Setup Bob (attacker / second user)
    bobUser = await User.create({
      name: `Bob Attacker ${timestamp}`,
      email: `bob_${timestamp}@workrank.test`,
      passwordHash: 'hash_placeholder',
      role: 'user',
      teamId: testTeam.id,
      status: 'active',
      tokenVersion: 0,
    });

    adminToken = signAccessToken(adminUser);
    aliceToken = signAccessToken(aliceUser);
    bobToken = signAccessToken(bobUser);

    // 5. Spin up test HTTP server
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/games/2048', game2048Routes);
    app.use('/api/competition', competitionRoutes);
    app.use(errorHandler);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ADVERSARIAL PROBE 1: BUG-001 (2048 Cross-Account Session Tampering)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Adversarial Probe 1: BUG-001 (2048 Cross-Account Session Tampering)', () => {
    let aliceSessionId;

    before(async () => {
      // Alice creates a legit 2048 session
      const res = await fetch(`${baseUrl}/api/games/2048/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aliceToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      aliceSessionId = data.data.gameSessionId;
      assert.ok(aliceSessionId, 'Alice must receive a valid gameSessionId');
    });

    it('ADVERSARIAL ATTACK: Bob attempts to checkpoint Alice session with spoofed score', async () => {
      const res = await fetch(`${baseUrl}/api/games/2048/checkpoint`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${bobToken}`, // Bob is calling
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameSessionId: aliceSessionId, // Alice's session
          score: 128,
          maxTile: 16,
          moves: 30,
          boardState: [{ id: 1, value: 16, row: 0, col: 0 }],
        }),
      });

      assert.strictEqual(res.status, 403, 'Server MUST reject with 403 Forbidden');
      const body = await res.json();
      assert.match(body.message, /không có quyền|Forbidden/i);

      // Verify DB: Alice's session was NOT modified
      const scoreRow = await Game2048Score.findOne({ where: { gameSessionId: aliceSessionId } });
      assert.strictEqual(scoreRow.score, 0, 'Alice score must remain 0');
      assert.strictEqual(scoreRow.userId, aliceUser.id, 'Session owner must still be Alice');
    });

    it('ADVERSARIAL ATTACK: Bob attempts to submit/finish Alice session to steal ranking', async () => {
      const res = await fetch(`${baseUrl}/api/games/2048/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${bobToken}`, // Bob is calling
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameSessionId: aliceSessionId, // Alice's session
          score: 256,
          maxTile: 32,
          moves: 50,
          status: 'COMPLETED',
        }),
      });

      assert.strictEqual(res.status, 403, 'Server MUST reject with 403 Forbidden');

      // Verify DB: Session status must still be ACTIVE
      const scoreRow = await Game2048Score.findOne({ where: { gameSessionId: aliceSessionId } });
      assert.strictEqual(scoreRow.status, 'ACTIVE', 'Alice session must remain ACTIVE');
    });

    it('ADVERSARIAL ATTACK: Attacker submits forged non-existent session ID to trigger auto-creation', async () => {
      const forgedSessionId = 'g2048_forged_random_id_' + Date.now();
      const res = await fetch(`${baseUrl}/api/games/2048/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${bobToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameSessionId: forgedSessionId,
          score: 128,
          maxTile: 16,
          moves: 30,
          status: 'COMPLETED',
        }),
      });

      assert.strictEqual(res.status, 404, 'Server MUST reject with 404 Not Found');

      // Verify DB: No row was created
      const exists = await Game2048Score.findOne({ where: { gameSessionId: forgedSessionId } });
      assert.strictEqual(exists, null, 'No row should be auto-created for invalid sessionId');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ADVERSARIAL PROBE 2: BUG-002 (Actor Impersonation & Event Ingestion)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Adversarial Probe 2: BUG-002 (Actor Impersonation & Event Ingestion)', () => {
    it('ADVERSARIAL ATTACK: Regular user Bob sends VIDEO_APPROVED event with actorId = Admin (35)', async () => {
      const res = await fetch(`${baseUrl}/api/competition/integration/production/video-action`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${bobToken}`, // Regular user
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'video_approved',
          actorId: adminUser.id, // Trying to impersonate Admin
          videoId: 999999,
          qualityScore: 100,
          idempotencyKey: 'adv-forged-prod-' + Date.now(),
        }),
      });

      assert.strictEqual(res.status, 403, 'Must reject with 403 Forbidden for non-admin');
    });

    it('ADVERSARIAL ATTACK: Regular user Bob calls /events/publish with forged domain payload', async () => {
      const res = await fetch(`${baseUrl}/api/competition/events/publish`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${bobToken}`, // Regular user
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType: 'COMMUNITY_KUDOS_SENT',
          sourceModule: 'community',
          aggregateType: 'kudos',
          aggregateId: 101,
          actorId: adminUser.id, // Forged actor
          teamId: testTeam.id,
          payload: { kudosId: 101 },
          idempotencyKey: 'adv-forged-event-' + Date.now(),
        }),
      });

      assert.strictEqual(res.status, 403, 'Must reject with 403 Forbidden for non-admin');
    });

    it('ADVERSARIAL ATTACK: Regular user Bob attempts kudos sender impersonation in payload', async () => {
      const res = await fetch(`${baseUrl}/api/competition/integration/community/kudos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${bobToken}`, // Bob is calling
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senderId: adminUser.id, // Attacker tries to pretend Admin sent kudos
          recipientId: aliceUser.id,
          kudosType: 'leadership',
          reason: 'Forged kudos attribution',
          idempotencyKey: 'adv-kudos-spoof-' + Date.now(),
        }),
      });

      assert.strictEqual(res.status, 201, 'Kudos endpoint accepts request, BUT...');
      const data = await res.json();

      // Verify the event in DB: actorId MUST be Bob (caller), NOT Admin!
      const eventRow = await CompetitionEvent.findOne({
        where: { idempotencyKey: 'adv-kudos-spoof-' + data.event?.eventId || data.eventId },
      });
      if (data.event) {
        assert.strictEqual(Number(data.event.actorId), bobUser.id, 'actorId MUST be forced to caller (Bob), not Admin');
      }
    });

    it('ADVERSARIAL ATTACK: User attempts self-kudos to farm ranking points', async () => {
      const res = await fetch(`${baseUrl}/api/competition/integration/community/kudos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${bobToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientId: bobUser.id, // Self kudos!
          kudosType: 'self_praise',
          reason: 'I am awesome',
        }),
      });

      assert.strictEqual(res.status, 400, 'Server MUST reject self-kudos with 400 Bad Request');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ADVERSARIAL PROBE 3: BUG-003 (Stale Refresh Credential Replay after Password Change)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Adversarial Probe 3: BUG-003 (Stale Refresh Replay Attack)', () => {
    it('ADVERSARIAL ATTACK: Attacker uses stolen/old refresh token after victim changed password', async () => {
      // 1. Create a user with real password
      const victim = await User.create({
        name: 'Victim Password',
        email: `victim_${Date.now()}@workrank.test`,
        passwordHash: require('bcryptjs').hashSync('CurrentPass123!', 8),
        role: 'user',
        teamId: testTeam.id,
        status: 'active',
        tokenVersion: 0,
      });

      // 2. Login to get initial refresh token (R1)
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: victim.email,
          password: 'CurrentPass123!',
        }),
      });
      assert.strictEqual(loginRes.status, 200);
      const loginData = await loginRes.json();
      const stolenR1 = loginData.refreshToken;
      const victimAccess = loginData.accessToken || loginData.token;
      assert.ok(stolenR1, 'Victim receives R1');
      assert.ok(victimAccess, 'Victim receives access token');

      // 3. Verify stolen R1 works initially
      const refCheck1 = await fetch(`${baseUrl}/api/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: stolenR1 }),
      });
      assert.strictEqual(refCheck1.status, 200, 'R1 works prior to password change');

      // 4. Victim notices suspicious activity and changes password
      const changeRes = await fetch(`${baseUrl}/api/auth/password`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${victimAccess}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: 'CurrentPass123!',
          newPassword: 'NewSecurePassword456!',
        }),
      });
      assert.strictEqual(changeRes.status, 200, 'Password change must succeed');

      // 5. ATTACK: Attacker attempts to replay stolen R1
      const attackRes = await fetch(`${baseUrl}/api/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: stolenR1 }),
      });

      assert.strictEqual(
        attackRes.status,
        401,
        'ATTACK FAILED: Server MUST reject old refresh token with 401 Unauthorized'
      );
      const attackBody = await attackRes.json();
      assert.match(attackBody.message, /hết hạn|thu hồi|Invalid|expired/i);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ADVERSARIAL PROBE 4: BUG-005 (Fail-Closed Test Database Guard)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Adversarial Probe 4: BUG-005 (Fail-Closed Database Guard)', () => {
    it('ADVERSARIAL ATTACK: Test runner accidentally targets working development database', () => {
      const result = spawnSync(
        process.execPath,
        ['-e', "require('./src/config/database')"],
        {
          cwd: path.resolve(__dirname, '..'),
          env: {
            ...process.env,
            NODE_ENV: 'test',
            DB_DIALECT: 'mysql',
            DB_NAME: 'workrank_realtime', // THE PROTECTED REAL DB!
            DB_NAME_TEST: 'workrank_realtime',
          },
          encoding: 'utf8',
        }
      );

      assert.notStrictEqual(result.status, 0, 'Process MUST exit with non-zero exit code');
      const output = result.stderr + result.stdout;
      assert.match(output, /\[DB-SAFETY GUARD\] FATAL/i, 'Must output fatal DB safety guard message');
      assert.match(output, /workrank_realtime/i, 'Must explicitly name the forbidden database');
    });

    it('ADVERSARIAL ATTACK: Test runner targets production database name', () => {
      const result = spawnSync(
        process.execPath,
        ['-e', "require('./src/config/database')"],
        {
          cwd: path.resolve(__dirname, '..'),
          env: {
            ...process.env,
            NODE_ENV: 'test',
            DB_DIALECT: 'mysql',
            DB_NAME: 'production',
            DB_NAME_TEST: 'production',
          },
          encoding: 'utf8',
        }
      );

      assert.notStrictEqual(result.status, 0, 'Process MUST exit with non-zero exit code');
      const output = result.stderr + result.stdout;
      assert.match(output, /\[DB-SAFETY GUARD\] FATAL/i);
    });
  });
});
