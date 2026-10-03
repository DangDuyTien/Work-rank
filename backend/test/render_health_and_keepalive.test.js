const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/app');
const env = require('../src/config/env');
const healthController = require('../src/controllers/health.controller');
const { User, sequelize } = require('../src/models');

describe('Render Health & Keep-Alive Probe Test Suite', () => {
  let adminUser;
  let adminToken;

  before(async () => {
    await sequelize.sync();
    adminUser = await User.create({
      username: `admin_health_${Date.now()}`,
      name: 'Admin Health Tester',
      email: `admin_health_${Date.now()}@example.com`,
      passwordHash: '$2b$12$dummyHashForTestingPurposesOnly12345678901234567890',
      role: 'admin',
      status: 'active',
    });
    adminToken = jwt.sign({ sub: adminUser.id, role: 'admin' }, env.jwtSecret, { expiresIn: '1h' });
  });

  after(async () => {
    if (adminUser) {
      await adminUser.destroy();
    }
  });

  describe('1. GET /health Probe (Ultra-lightweight Keep-Alive)', () => {
    it('returns HTTP 200 with minimal payload and no business side effects', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      assert.strictEqual(res.body.ok, true);
      assert.strictEqual(res.body.status, 'ok');
      assert.strictEqual(res.body.service, 'workrank-backend');
      assert.strictEqual(res.body.database, 'ok');
      assert.ok(typeof res.body.uptimeSeconds === 'number');
      assert.ok(res.body.timestamp);
    });

    it('sets strict anti-cache headers so proxies never serve stale responses', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      const cacheControl = res.headers['cache-control'];
      assert.ok(cacheControl, 'Cache-Control header must be present');
      assert.match(cacheControl, /no-cache/);
      assert.match(cacheControl, /no-store/);
      assert.match(cacheControl, /must-revalidate/);
      assert.strictEqual(res.headers['pragma'], 'no-cache');
    });

    it('includes standard helmet security headers', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    });

    it('works without any authentication', async () => {
      // Must not require Authorization header
      const res = await request(app)
        .get('/health')
        .expect(200);
      assert.strictEqual(res.status, 200);
    });
  });

  describe('2. GET /api/health Probe (Render Deploy Health Check)', () => {
    it('returns HTTP 200 matching /health for Render platform healthCheckPath', async () => {
      const res = await request(app)
        .get('/api/health')
        .expect(200);

      assert.strictEqual(res.body.ok, true);
      assert.strictEqual(res.body.status, 'ok');
      assert.match(res.headers['cache-control'], /no-cache/);
    });
  });

  describe('3. Orchestrator Probes (/health/live & /health/ready)', () => {
    it('GET /health/live returns HTTP 200 with process pid and uptime', async () => {
      const res = await request(app)
        .get('/health/live')
        .expect(200);

      assert.strictEqual(res.body.ok, true);
      assert.strictEqual(res.body.status, 'live');
      assert.ok(res.body.pid);
      assert.ok(typeof res.body.uptimeSeconds === 'number');
    });

    it('GET /health/ready returns HTTP 200 with database: connected', async () => {
      const res = await request(app)
        .get('/health/ready')
        .expect(200);

      assert.strictEqual(res.body.ok, true);
      assert.strictEqual(res.body.status, 'ready');
      assert.strictEqual(res.body.database, 'connected');
    });
  });

  describe('4. In-Memory Keep-Alive Tracking & Diagnostics', () => {
    it('tracks inbound health ping timestamp and count without DB queries', async () => {
      const beforeDiag = healthController.getDiagnostics();
      const initialCount = beforeDiag.healthPingCount;

      // Send 3 ping requests
      await request(app).get('/health').expect(200);
      await request(app).get('/health').expect(200);
      await request(app).get('/api/health').expect(200);

      const afterDiag = healthController.getDiagnostics();
      assert.strictEqual(afterDiag.healthPingCount, initialCount + 3);
      assert.ok(afterDiag.lastHealthPingAt);
      assert.strictEqual(afterDiag.renderService, 'ONLINE');
    });

    it('exposes keep-alive diagnostics in Admin Integration Health API', async () => {
      const res = await request(app)
        .get('/api/competition/admin/integration/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assert.strictEqual(res.body.renderService, 'ONLINE');
      assert.ok(res.body.lastHealthPingAt);
      assert.ok(typeof res.body.healthPingCount === 'number');
    });

    it('exposes keep-alive diagnostics in Admin YouTube Overview API', async () => {
      const res = await request(app)
        .get('/api/youtube/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assert.ok(res.body.diagnostics);
      assert.strictEqual(res.body.diagnostics.renderService, 'ONLINE');
      assert.ok(res.body.diagnostics.lastHealthPingAt);
      assert.ok(typeof res.body.diagnostics.healthPingCount === 'number');
    });
  });
});
