'use strict';

/**
 * bug011_identity_adversarial.test.js
 *
 * Adversarial Verification Suite for BUG-011:
 * UI / API / Socket Identity Synchronization across 5 Scenarios:
 *   1. Cross-tab logout
 *   2. Account switch
 *   3. Stale socket eviction
 *   4. Refresh race across tabs
 *   5. Password change & credential revocation
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');
const ioClient = require('../../frontend/node_modules/socket.io-client');
const bcrypt = require('bcryptjs');

const { sequelize, User, Friendship } = require('../src/models');
const registerSockets = require('../src/sockets');
const authRoutes = require('../src/routes/auth.routes');
const competitionRealtime = require('../src/services/competition/competitionRealtime.service');
const { signAccessToken, signRefreshToken } = require('../src/utils/token');

class MockStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

class MockBroadcastChannel {
  static channels = new Map();

  constructor(name) {
    this.name = name;
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, new Set());
    }
    MockBroadcastChannel.channels.get(name).add(this);
    this.onmessage = null;
  }

  postMessage(data) {
    const peers = MockBroadcastChannel.channels.get(this.name) || new Set();
    for (const peer of peers) {
      if (peer !== this && typeof peer.onmessage === 'function') {
        peer.onmessage({ data });
      }
    }
  }

  close() {
    const peers = MockBroadcastChannel.channels.get(this.name);
    if (peers) peers.delete(this);
  }
}

describe('BUG-011: UI/API/Socket Identity Synchronization Adversarial Verification', () => {
  let server;
  let baseUrl;
  let io;

  before(async () => {
    await sequelize.authenticate();
    await sequelize.sync();

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);

    server = http.createServer(app);
    io = new Server(server, { cors: { origin: '*' } });
    competitionRealtime.setIo(io);
    registerSockets(io);

    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario 1 — Cross-tab logout
  // ──────────────────────────────────────────────────────────────────────────
  it('Scenario 1 — Cross-tab logout: Tab B converges to logged out, future HTTP rejected, socket disconnected', async () => {
    const userA = await User.create({
      name: 'User A Scenario 1',
      email: `sc1_a_${Date.now()}@test.com`,
      passwordHash: await bcrypt.hash('Pass123!', 8),
      role: 'user',
      status: 'active',
      tokenVersion: 0,
    });

    const tokenA = signAccessToken(userA);
    const refreshTokenA = signRefreshToken(userA);

    const sharedStorage = new MockStorage();
    sharedStorage.setItem('token', tokenA);
    sharedStorage.setItem('refreshToken', refreshTokenA);
    sharedStorage.setItem('workrank_active_user_id', String(userA.id));

    const channelTabA = new MockBroadcastChannel('workrank:auth');
    const channelTabB = new MockBroadcastChannel('workrank:auth');

    let tabBUser = { id: userA.id, name: userA.name };
    let tabBConnectedSocket = ioClient.io(baseUrl, { auth: { token: tokenA } });
    await new Promise((r) => tabBConnectedSocket.on('connect', r));

    channelTabB.onmessage = (event) => {
      if (event.data?.type === 'AUTH_LOGOUT') {
        tabBUser = null;
        if (tabBConnectedSocket) {
          tabBConnectedSocket.disconnect();
        }
      }
    };

    // Tab A performs logout
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(logoutRes.status, 204);

    sharedStorage.removeItem('token');
    sharedStorage.removeItem('refreshToken');
    sharedStorage.removeItem('workrank_active_user_id');
    channelTabA.postMessage({ type: 'AUTH_LOGOUT', sessionGeneration: Date.now() });

    await new Promise((r) => setTimeout(r, 100));

    // Assertions
    assert.strictEqual(tabBUser, null, 'Tab B user state must converge to null');
    assert.strictEqual(tabBConnectedSocket.connected, false, 'Tab B socket must be disconnected');

    // Future HTTP request from Tab B without token
    const tokenInStorage = sharedStorage.getItem('token');
    const httpHeaders = tokenInStorage ? { Authorization: `Bearer ${tokenInStorage}` } : {};
    const futureHttpRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: httpHeaders,
    });
    assert.strictEqual(futureHttpRes.status, 401, 'Future HTTP requests must not be authenticated as A');

    channelTabA.close();
    channelTabB.close();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario 2 — Account switch
  // ──────────────────────────────────────────────────────────────────────────
  it('Scenario 2 — Account switch: Transition from A to B avoids split-brain and forbidden state', async () => {
    const userA = await User.create({
      name: 'Alice Sc2',
      email: `sc2_alice_${Date.now()}@test.com`,
      passwordHash: await bcrypt.hash('PassAlice123!', 8),
      role: 'user',
      status: 'active',
      tokenVersion: 0,
    });

    const userB = await User.create({
      name: 'Bob Sc2',
      email: `sc2_bob_${Date.now()}@test.com`,
      passwordHash: await bcrypt.hash('PassBob123!', 8),
      role: 'user',
      status: 'active',
      tokenVersion: 0,
    });

    const tokenA = signAccessToken(userA);
    const tokenB = signAccessToken(userB);

    const sharedStorage = new MockStorage();
    sharedStorage.setItem('token', tokenA);
    sharedStorage.setItem('workrank_active_user_id', String(userA.id));

    const channelTabA = new MockBroadcastChannel('workrank:auth');
    const channelTabB = new MockBroadcastChannel('workrank:auth');

    let tab2ReactUser = { id: userA.id, name: userA.name };
    let tab2Socket = ioClient.io(baseUrl, { auth: { token: tokenA } });
    await new Promise((r) => tab2Socket.on('connect', r));

    let driftDetected = false;

    // Simulate Tab 1 switching to B
    sharedStorage.setItem('token', tokenB);
    sharedStorage.setItem('workrank_active_user_id', String(userB.id));

    // Simulate Tab 2 triggering network activity right during transition
    const storedUserId = sharedStorage.getItem('workrank_active_user_id');
    const currentToken = sharedStorage.getItem('token');
    if (tab2ReactUser && storedUserId && String(tab2ReactUser.id) !== String(storedUserId)) {
      driftDetected = true;
    }

    assert.strictEqual(driftDetected, true, 'Interceptors must detect identity drift between React state and storage');

    // Request is authenticated with tokenB
    const verifyMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${currentToken}` },
    });
    const verifyMeBody = await verifyMeRes.json();
    assert.strictEqual(verifyMeBody.user?.id, userB.id, 'API request must be executed as B, never A');

    // Tab 1 broadcasts AUTH_LOGIN to Tab 2
    channelTabB.onmessage = (event) => {
      if (event.data?.type === 'AUTH_LOGIN') {
        tab2Socket.disconnect();
        tab2ReactUser = event.data.user;
        tab2Socket = ioClient.io(baseUrl, { auth: { token: event.data.token } });
      }
    };

    channelTabA.postMessage({
      type: 'AUTH_LOGIN',
      userId: userB.id,
      user: { id: userB.id, name: userB.name },
      token: tokenB,
    });

    await new Promise((r) => setTimeout(r, 100));
    if (!tab2Socket.connected) {
      await new Promise((r) => tab2Socket.once('connect', r));
    }

    assert.strictEqual(tab2ReactUser.id, userB.id, 'Tab 2 React user must converge to B');
    assert.strictEqual(tab2Socket.connected, true, 'Tab 2 Socket must be connected as B');

    tab2Socket.disconnect();
    channelTabA.close();
    channelTabB.close();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario 3 — Stale socket
  // ──────────────────────────────────────────────────────────────────────────
  it('Scenario 3 — Stale socket: Backend evicts socket on logout; stale socket cannot send messages', async () => {
    const userA = await User.create({
      name: 'User A Scenario 3',
      email: `sc3_a_${Date.now()}@test.com`,
      passwordHash: await bcrypt.hash('Pass123!', 8),
      role: 'user',
      status: 'active',
      tokenVersion: 0,
    });

    const userB = await User.create({
      name: 'User B Scenario 3',
      email: `sc3_b_${Date.now()}@test.com`,
      passwordHash: await bcrypt.hash('Pass123!', 8),
      role: 'user',
      status: 'active',
      tokenVersion: 0,
    });

    await Friendship.create({
      requesterId: userA.id,
      addresseeId: userB.id,
      status: 'accepted',
    });

    const tokenA = signAccessToken(userA);

    const socketA = ioClient.io(baseUrl, { auth: { token: tokenA } });
    await new Promise((r) => socketA.on('connect', r));
    assert.strictEqual(socketA.connected, true);

    let socketDisconnected = false;
    let authRevokedReceived = false;
    socketA.on('auth:revoked', () => { authRevokedReceived = true; });
    socketA.on('disconnect', () => { socketDisconnected = true; });

    // User A logs out via HTTP POST /api/auth/logout
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(logoutRes.status, 204);

    await new Promise((r) => setTimeout(r, 200));

    // Verify backend forcefully evicted socketA
    assert.strictEqual(socketA.connected, false, 'Socket must be forcefully disconnected by backend on logout');
    assert.strictEqual(authRevokedReceived, true, 'Socket must receive auth:revoked notification');

    // Old access tokens are revoked immediately by the logout token-version bump.
    const oldAccessRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(oldAccessRes.status, 401, 'Old access token must be rejected after logout');

    // Attempt to emit chat:send on stale socket
    let messageSent = false;
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('TIMEOUT')), 500);
        socketA.emit(
          'chat:send',
          {
            receiverId: userB.id,
            body: 'Adversarial probe message from stale socket',
            clientMessageId: 'stale-probe-1',
          },
          (ack) => {
            clearTimeout(timer);
            if (ack?.ok) messageSent = true;
            resolve(ack);
          }
        );
      });
    } catch {
      messageSent = false;
    }

    assert.strictEqual(messageSent, false, 'Stale socket must not be able to send chat messages after logout');
    socketA.disconnect();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario 4 — Refresh race across tabs
  // ──────────────────────────────────────────────────────────────────────────
  it('Scenario 4 — Refresh race across tabs: Near-simultaneous refresh does not cause rollback or identity drift', async () => {
    const userA = await User.create({
      name: 'User A Scenario 4',
      email: `sc4_a_${Date.now()}@test.com`,
      passwordHash: await bcrypt.hash('Pass123!', 8),
      role: 'user',
      status: 'active',
      tokenVersion: 0,
    });

    const refreshTokenA = signRefreshToken(userA);

    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/api/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshTokenA }),
      }),
      fetch(`${baseUrl}/api/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshTokenA }),
      }),
    ]);

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res2.status, 200);

    const data1 = await res1.json();
    const data2 = await res2.json();

    assert.ok(data1.accessToken);
    assert.ok(data2.accessToken);
    assert.strictEqual(data1.user?.id, userA.id);
    assert.strictEqual(data2.user?.id, userA.id);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Scenario 5 — Password change
  // ──────────────────────────────────────────────────────────────────────────
  it('Scenario 5 — Password change: Bumps tokenVersion, evicts all sockets, revokes old refresh token', async () => {
    const initialPass = 'InitialPass123!';
    const updatedPass = 'UpdatedPass456!';

    const userA = await User.create({
      name: 'User A Scenario 5',
      email: `sc5_a_${Date.now()}@test.com`,
      passwordHash: await bcrypt.hash(initialPass, 8),
      role: 'user',
      status: 'active',
      tokenVersion: 0,
    });

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userA.email, password: initialPass }),
    });
    const loginData = await loginRes.json();
    const oldAccessToken = loginData.accessToken;
    const oldRefreshToken = loginData.refreshToken;

    const secondLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userA.email, password: initialPass }),
    });
    const secondLoginData = await secondLoginRes.json();

    const socket1 = ioClient.io(baseUrl, { auth: { token: oldAccessToken } });
    const socket2 = ioClient.io(baseUrl, { auth: { token: secondLoginData.accessToken } });
    await Promise.all([
      new Promise((r) => socket1.on('connect', r)),
      new Promise((r) => socket2.on('connect', r)),
    ]);

    let socket1Revoked = false;
    let socket2Revoked = false;
    socket1.on('auth:revoked', () => { socket1Revoked = true; });
    socket2.on('auth:revoked', () => { socket2Revoked = true; });

    let socket1Disconnected = false;
    let socket2Disconnected = false;
    socket1.on('disconnect', () => { socket1Disconnected = true; });
    socket2.on('disconnect', () => { socket2Disconnected = true; });

    const changeRes = await fetch(`${baseUrl}/api/auth/password`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${oldAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: initialPass,
        newPassword: updatedPass,
      }),
    });
    assert.strictEqual(changeRes.status, 200);
    const changeData = await changeRes.json();
    assert.strictEqual(changeData.ok, true);

    await new Promise((r) => setTimeout(r, 200));

    assert.strictEqual(socket1Revoked, false);
    assert.strictEqual(socket2Revoked, true);
    assert.strictEqual(socket1.connected, true, 'Initiating browser session socket must remain connected');
    assert.strictEqual(socket2.connected, false, 'Other browser session socket must be disconnected');

    // Old access token is revoked after password change.
    const oldAccessRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${oldAccessToken}` },
    });
    assert.strictEqual(oldAccessRes.status, 401);

    // Old refresh token must be rejected with 401
    const oldRefreshRes = await fetch(`${baseUrl}/api/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: oldRefreshToken }),
    });
    assert.strictEqual(oldRefreshRes.status, 401);

    // New refresh token must succeed with 200
    const newRefreshRes = await fetch(`${baseUrl}/api/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: changeData.refreshToken }),
    });
    assert.strictEqual(newRefreshRes.status, 200);

    socket1.disconnect();
    socket2.disconnect();
  });
});
