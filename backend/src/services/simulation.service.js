const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { sequelize, User, Team, Device, WorkSession, ActivityEvent, DailyStat, UserProfilePreference } = require('../models');
const { calculateFocusScore, calculateRankScore } = require('../utils/score');
const simulationPresence = require('./simulationPresence.service');

const DEFAULT_TARGET_COUNT = 50;
const DEFAULT_INTERVAL_MS = 30_000;
const MAX_TARGET_COUNT = 100;
const MIN_INTERVAL_MS = 10_000;
const STATUS_TTL_MS = 90_000;
const ONLINE_MIN_MS = 30 * 60 * 1000;
const ONLINE_MAX_MS = 60 * 60 * 1000;

const VIETNAMESE_NAMES = [
  'Nguyen Minh Anh',
  'Tran Quang Huy',
  'Le Hoang Nam',
  'Pham Gia Bao',
  'Hoang Bao Chau',
  'Dang Thanh Lam',
  'Bui Ngoc Mai',
  'Do Tuan Kiet',
  'Vu Phuong Linh',
  'Ngo Duc Anh',
  'Duong Ha My',
  'Ly Thanh Tung',
  'Trinh Khanh Vy',
  'Mai Anh Thu',
  'Cao Viet Hoang',
  'Ta Minh Quan',
  'Phan Ngoc Han',
  'Huynh Gia Huy',
  'Vo Minh Khang',
  'Dinh Bao Ngoc',
  'Lam Nhat Minh',
  'Ha Quynh Nhu',
  'Chu Thanh Dat',
  'Kieu Minh Tam',
  'Nguyen Hoang Phuc',
  'Tran Thao Nguyen',
  'Le Minh Tri',
  'Pham Tue Lam',
  'Hoang Nhat Linh',
  'Dang Quoc Bao',
  'Bui Khanh Linh',
  'Do Minh Duc',
  'Vu Gia Han',
  'Ngo Bao Tran',
  'Duong Nhat Anh',
  'Ly Hoai Nam',
  'Trinh Minh Thu',
  'Mai Quoc Viet',
  'Cao Phuong Anh',
  'Ta Gia Linh',
  'Phan Duc Minh',
  'Huynh Nhat Ha',
  'Vo Quang Minh',
  'Dinh Minh Chau',
  'Lam Bao Anh',
  'Ha Tuan Anh',
  'Chu Hoang Long',
  'Kieu Ngoc Anh',
  'Nguyen Thanh Son',
  'Tran Bao Khanh',
  'Le Gia Minh',
  'Pham Hoai An',
  'Hoang Duc Thinh',
  'Dang Minh Hieu',
  'Bui Nhat Quang',
  'Do Phuong Thao',
  'Vu Khanh An',
  'Ngo Thanh Binh',
  'Duong Gia Tue',
  'Ly Minh Khoi',
];

const AVATAR_COLORS = [
  ['#2563eb', '#06b6d4'],
  ['#059669', '#84cc16'],
  ['#dc2626', '#f97316'],
  ['#7c3aed', '#ec4899'],
  ['#0f766e', '#22c55e'],
  ['#4338ca', '#0ea5e9'],
  ['#b45309', '#facc15'],
  ['#be123c', '#fb7185'],
];

const state = {
  running: false,
  timer: null,
  io: null,
  targetCount: DEFAULT_TARGET_COUNT,
  intervalMs: DEFAULT_INTERVAL_MS,
  startedAt: null,
  lastTickAt: null,
  lastError: null,
  lastSummary: null,
  lifecycleByUser: new Map(),
  presenceByUser: new Map(),
};

function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function dateOnly(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function vietnamTimeParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(value);
  const rawHour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const weekday = parts.find((part) => part.type === 'weekday')?.value || '';
  return {
    hour: rawHour === 24 ? 0 : rawHour,
    isWeekend: weekday === 'Sat' || weekday === 'Sun',
  };
}

function scheduleProfile(value = new Date()) {
  const { hour, isWeekend } = vietnamTimeParts(value);
  let activeRatio = 0.18;
  let idleRatio = 0.12;
  let actionMultiplier = 1.5;

  if (hour >= 8 && hour < 11) {
    activeRatio = 0.78;
    idleRatio = 0.08;
    actionMultiplier = 2.9;
  } else if (hour >= 11 && hour < 12) {
    activeRatio = 0.62;
    idleRatio = 0.14;
    actionMultiplier = 2.2;
  } else if (hour >= 12 && hour < 13) {
    activeRatio = 0.26;
    idleRatio = 0.32;
    actionMultiplier = 0.8;
  } else if (hour >= 13 && hour < 17) {
    activeRatio = 0.84;
    idleRatio = 0.09;
    actionMultiplier = 3.1;
  } else if (hour >= 17 && hour < 19) {
    activeRatio = 0.38;
    idleRatio = 0.2;
    actionMultiplier = 1.4;
  } else if (hour >= 19 && hour < 22) {
    activeRatio = 0.44;
    idleRatio = 0.16;
    actionMultiplier = 1.7;
  } else if (hour >= 22 || hour < 6) {
    activeRatio = 0.05;
    idleRatio = 0.28;
    actionMultiplier = 0.45;
  } else if (hour >= 6 && hour < 8) {
    activeRatio = 0.16;
    idleRatio = 0.22;
    actionMultiplier = 0.8;
  }

  if (isWeekend) {
    activeRatio *= 0.42;
    actionMultiplier *= 0.72;
    idleRatio = Math.min(0.36, idleRatio + 0.06);
  }

  return {
    hour,
    isWeekend,
    activeRatio,
    idleRatio,
    actionMultiplier,
  };
}

function initials(name) {
  return String(name || 'WR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'WR';
}

function randomOnlineDurationMs() {
  return randomInt(ONLINE_MIN_MS, ONLINE_MAX_MS);
}

function randomOfflineDurationMs(profile) {
  if (profile.hour >= 22 || profile.hour < 6) return randomInt(70, 210) * 60 * 1000;
  if (profile.isWeekend) return randomInt(35, 140) * 60 * 1000;
  if (profile.hour >= 12 && profile.hour < 13) return randomInt(20, 65) * 60 * 1000;
  if (profile.activeRatio >= 0.7) return randomInt(5, 25) * 60 * 1000;
  if (profile.activeRatio >= 0.35) return randomInt(12, 45) * 60 * 1000;
  return randomInt(30, 110) * 60 * 1000;
}

function createInitialLifecycle(profile, currentTime) {
  const nowMs = currentTime.getTime();
  const startsOnline = Math.random() < clamp(profile.activeRatio + 0.08, 0.08, 0.9);
  if (startsOnline) {
    return {
      mode: 'online',
      onlineUntil: nowMs + randomOnlineDurationMs(),
      offlineUntil: null,
      changedAt: nowMs,
    };
  }
  return {
    mode: 'offline',
    onlineUntil: null,
    offlineUntil: nowMs + randomOfflineDurationMs(profile),
    changedAt: nowMs,
  };
}

function resolveLifecycle(user, profile, currentTime) {
  const userId = String(user.id);
  const nowMs = currentTime.getTime();
  const previous = state.lifecycleByUser.get(userId);
  let lifecycle = previous || createInitialLifecycle(profile, currentTime);

  if (lifecycle.mode === 'online' && nowMs >= Number(lifecycle.onlineUntil || 0)) {
    lifecycle = {
      mode: 'offline',
      onlineUntil: null,
      offlineUntil: nowMs + randomOfflineDurationMs(profile),
      changedAt: nowMs,
    };
  } else if (lifecycle.mode === 'offline' && nowMs >= Number(lifecycle.offlineUntil || 0)) {
    lifecycle = {
      mode: 'online',
      onlineUntil: nowMs + randomOnlineDurationMs(),
      offlineUntil: null,
      changedAt: nowMs,
    };
  }

  state.lifecycleByUser.set(userId, lifecycle);
  return {
    lifecycle,
    changed: !previous || previous.mode !== lifecycle.mode,
  };
}

function onlinePresenceForTick(profile) {
  const idleChance = clamp(profile.idleRatio + 0.04 + Math.random() * 0.08, 0.08, 0.42);
  return Math.random() < idleChance ? 'idle' : 'active';
}

function pruneLifecycleForUsers(users) {
  const ids = new Set(users.map((user) => String(user.id)));
  for (const userId of state.lifecycleByUser.keys()) {
    if (!ids.has(userId)) state.lifecycleByUser.delete(userId);
  }
}

function avatarData(name, index) {
  const [start, end] = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const text = initials(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="${start}"/><stop offset="100%" stop-color="${end}"/></linearGradient></defs><rect width="256" height="256" rx="48" fill="url(#g)"/><circle cx="202" cy="54" r="36" fill="rgba(255,255,255,.16)"/><text x="128" y="146" text-anchor="middle" font-family="Arial, sans-serif" font-size="74" font-weight="800" fill="#fff">${text}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

async function resolveTeamId() {
  const defaultTeam = await Team.findOne({ where: { name: 'Default Team' } });
  if (defaultTeam) return defaultTeam.id;
  const firstTeam = await Team.findOne({ order: [['id', 'ASC']] });
  return firstTeam?.id || null;
}

async function ensureSimulationUsers(targetCount = DEFAULT_TARGET_COUNT) {
  const safeCount = clamp(Number(targetCount || DEFAULT_TARGET_COUNT), 1, MAX_TARGET_COUNT);
  const teamId = await resolveTeamId();
  const passwordHash = await bcrypt.hash(process.env.SIMULATION_USER_PASSWORD || crypto.randomBytes(18).toString('hex'), env.bcryptRounds);

  for (let i = 0; i < safeCount; i += 1) {
    const name = VIETNAMESE_NAMES[i % VIETNAMESE_NAMES.length];
    const email = `worker${String(i + 1).padStart(3, '0')}@workrank.local`;
    const [user] = await User.findOrCreate({
      where: { email },
      defaults: {
        name,
        email,
        passwordHash,
        role: 'user',
        teamId,
        isVerified: i < 8,
        isSimulated: true,
        status: 'active',
      },
    });

    const updates = {};
    if (!user.isSimulated) updates.isSimulated = true;
    if (user.status !== 'active') updates.status = 'active';
    if (!user.teamId && teamId) updates.teamId = teamId;
    if (Object.keys(updates).length) await user.update(updates);

    await UserProfilePreference.findOrCreate({
      where: { userId: user.id },
      defaults: {
        userId: user.id,
        avatarData: avatarData(name, i),
        featuredBadges: ['Tập trung', 'Chăm chỉ'].slice(0, (i % 2) + 1),
      },
    });
  }

  return User.findAll({
    where: { isSimulated: true, status: 'active' },
    order: [['id', 'ASC']],
    limit: safeCount,
  });
}

async function ensureDevice(user, transaction) {
  const deviceUuid = `workrank-sim-${String(user.id).padStart(4, '0')}`;
  const [device] = await Device.findOrCreate({
    where: { userId: user.id, deviceUuid },
    defaults: {
      userId: user.id,
      deviceUuid,
      deviceName: `WorkRank Simulation ${String(user.id).padStart(4, '0')}`,
      platform: 'macos',
      appVersion: 'simulation',
      lastSyncAt: new Date(),
    },
    transaction,
  });
  return device;
}

async function ensureRunningSession(user, device, currentTime, transaction) {
  const existing = await WorkSession.findOne({
    where: { userId: user.id, deviceId: device.id, status: 'running' },
    order: [['startedAt', 'DESC']],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (existing) return { session: existing, created: false };

  const session = await WorkSession.create({
    userId: user.id,
    deviceId: device.id,
    startedAt: currentTime,
    status: 'running',
  }, { transaction });
  return { session, created: true };
}

async function endRunningSessions(userId, currentTime, transaction) {
  const sessions = await WorkSession.findAll({
    where: { userId, status: 'running' },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  for (const session of sessions) {
    const durationSeconds = Math.max(
      Number(session.durationSeconds || 0),
      Math.floor((currentTime - new Date(session.startedAt)) / 1000),
    );
    await session.update({ endedAt: currentTime, durationSeconds, status: 'ended' }, { transaction });
  }
}

function activityDelta(profile) {
  const tickSeconds = Math.max(10, Math.round(state.intervalMs / 1000));
  const activeSeconds = randomInt(Math.round(tickSeconds * 0.48), tickSeconds);
  const idleSeconds = randomInt(0, Math.round(tickSeconds * profile.idleRatio));
  const keysPerSecond = (1.2 + Math.random() * 1.8) * profile.actionMultiplier;
  const clicksPerSecond = (0.15 + Math.random() * 0.42) * profile.actionMultiplier;
  return {
    activeSeconds,
    idleSeconds,
    keystrokeCount: Math.max(0, Math.round(activeSeconds * keysPerSecond)),
    mouseClickCount: Math.max(0, Math.round(activeSeconds * clicksPerSecond)),
    mouseMoveCount: Math.max(0, Math.round(activeSeconds * randomInt(8, 22))),
  };
}

async function upsertDailyStat(user, eventTime, delta, sessionCreated, transaction) {
  const statDate = dateOnly(eventTime);
  const [stat] = await DailyStat.findOrCreate({
    where: { userId: user.id, statDate },
    defaults: { userId: user.id, statDate },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  const activeSeconds = Number(stat.activeSeconds || 0) + Number(delta.activeSeconds || 0);
  const idleSeconds = Number(stat.idleSeconds || 0) + Number(delta.idleSeconds || 0);
  const totalSeconds = activeSeconds + idleSeconds;
  const keystrokeCount = Number(stat.keystrokeCount || 0) + Number(delta.keystrokeCount || 0);
  const mouseClickCount = Number(stat.mouseClickCount || 0) + Number(delta.mouseClickCount || 0);

  await stat.update({
    activeSeconds,
    idleSeconds,
    totalSeconds,
    focusScore: calculateFocusScore(activeSeconds, idleSeconds),
    keystrokeCount,
    mouseClickCount,
    sessionCount: Number(stat.sessionCount || 0) + (sessionCreated ? 1 : 0),
  }, { transaction });

  return stat;
}

function buildActivityPayload(user, stat, event, delta) {
  const totals = {
    activeSeconds: Number(stat.activeSeconds || 0),
    idleSeconds: Number(stat.idleSeconds || 0),
    totalSeconds: Number(stat.totalSeconds || 0),
    keystrokeCount: Number(stat.keystrokeCount || 0),
    mouseClickCount: Number(stat.mouseClickCount || 0),
    focusScore: Number(stat.focusScore || 0),
  };
  totals.score = calculateRankScore(totals);

  return {
    userId: user.id,
    user_id: user.id,
    name: user.name,
    email: user.email,
    teamId: user.teamId,
    role: user.role,
    isSimulated: true,
    statDate: stat.statDate,
    presence: 'active',
    status: 'active',
    delta,
    totals,
    activeSeconds: totals.activeSeconds,
    idleSeconds: totals.idleSeconds,
    keystrokeCount: totals.keystrokeCount,
    mouseClickCount: totals.mouseClickCount,
    focusScore: totals.focusScore,
    score: totals.score,
    keystrokes: delta.keystrokeCount,
    clicks: delta.mouseClickCount,
    mouseMoves: delta.mouseMoveCount,
    lastEventAt: event.eventTime.toISOString(),
  };
}

function emitToUserScopes(eventName, user, payload) {
  if (!state.io) return;
  let target = state.io.to('dashboard').to(`user:${user.id}`);
  if (user.teamId) target = target.to(`team:${user.teamId}`);
  target.emit(eventName, payload);
}

function publishPresence(user, status) {
  const userId = String(user.id);
  if (state.presenceByUser.get(userId) === status) return;
  state.presenceByUser.set(userId, status);

  const payload = {
    userId: user.id,
    user_id: user.id,
    name: user.name,
    email: user.email,
    teamId: user.teamId,
    status,
    presence: status,
    presenceStatus: status,
    isSimulated: true,
    lastSeenAt: new Date().toISOString(),
  };
  emitToUserScopes('user:status:update', user, payload);
}

async function simulateActiveUser(user, profile, currentTime) {
  return sequelize.transaction(async (transaction) => {
    const device = await ensureDevice(user, transaction);
    const { session, created: sessionCreated } = await ensureRunningSession(user, device, currentTime, transaction);
    const delta = activityDelta(profile);
    const sequence = Number(device.lastSequence || 0) + 1;
    const event = await ActivityEvent.create({
      userId: user.id,
      deviceId: device.id,
      sessionId: session.id,
      eventTime: currentTime,
      sequence,
      signatureValid: true,
      suspicionScore: 0,
      flagsJson: ['admin_simulation'],
      metadataJson: {
        simulated: true,
        source: 'admin_simulation',
        localHour: profile.hour,
        weekend: profile.isWeekend,
      },
      ...delta,
    }, { transaction });

    await WorkSession.increment({
      activeSeconds: delta.activeSeconds,
      idleSeconds: delta.idleSeconds,
      keystrokeCount: delta.keystrokeCount,
      mouseClickCount: delta.mouseClickCount,
      mouseMoveCount: delta.mouseMoveCount,
    }, { where: { id: session.id, userId: user.id }, transaction });

    await device.update({
      lastSequence: sequence,
      lastSyncAt: currentTime,
      lastEventAt: currentTime,
      lastClickCount: delta.mouseClickCount,
      lastActiveSeconds: delta.activeSeconds,
      repeatedClickPatternCount: 0,
      clickOnlyStreakCount: 0,
    }, { transaction });

    const stat = await upsertDailyStat(user, currentTime, delta, sessionCreated, transaction);
    return { event, stat, delta };
  });
}

async function markUserOffline(user, currentTime) {
  await sequelize.transaction(async (transaction) => {
    await endRunningSessions(user.id, currentTime, transaction);
  });
  simulationPresence.setStatus(user.id, 'offline');
  publishPresence(user, 'offline');
}

async function tick(options = {}) {
  if (!state.running && !options.manual) return getStatus();

  const currentTime = new Date();
  const profile = scheduleProfile(currentTime);
  const users = await ensureSimulationUsers(state.targetCount);
  pruneLifecycleForUsers(users);
  const summary = {
    totalUsers: users.length,
    onlineUsers: 0,
    activeUsers: 0,
    idleUsers: 0,
    offlineUsers: 0,
    generatedEvents: 0,
    localHour: profile.hour,
    isWeekend: profile.isWeekend,
  };

  for (const user of users) {
    const { lifecycle, changed } = resolveLifecycle(user, profile, currentTime);
    if (lifecycle.mode === 'offline') {
      if (changed || state.presenceByUser.get(String(user.id)) !== 'offline') {
        await markUserOffline(user, currentTime);
      }
      summary.offlineUsers += 1;
      continue;
    }

    summary.onlineUsers += 1;
    const status = onlinePresenceForTick(profile);
    simulationPresence.setStatus(user.id, status, { ttlMs: STATUS_TTL_MS });
    publishPresence(user, status);

    if (status !== 'active') {
      summary.idleUsers += 1;
      continue;
    }

    const { event, stat, delta } = await simulateActiveUser(user, profile, currentTime);
    emitToUserScopes('activity:user:update', user, buildActivityPayload(user, stat, event, delta));
    summary.activeUsers += 1;
    summary.generatedEvents += 1;
  }

  state.lastTickAt = currentTime.toISOString();
  state.lastSummary = summary;
  state.lastError = null;

  if (state.io) {
    state.io.to('dashboard').emit('simulation:status', await getStatus());
    try {
      const dashboardService = require('./dashboard.service');
      state.io.to('dashboard').emit('dashboard:overview:update', await dashboardService.overview({ range: 'today' }));
    } catch (error) {
      state.lastError = error.message;
    }
  }

  return getStatus();
}

function scheduleNextTick() {
  if (state.timer) clearInterval(state.timer);
  state.timer = setInterval(() => {
    tick().catch((error) => {
      state.lastError = error.message;
      console.error('Simulation tick failed', error);
    });
  }, state.intervalMs);
}

async function start(options = {}) {
  state.io = options.io || state.io;
  state.targetCount = clamp(Number(options.targetCount || state.targetCount || DEFAULT_TARGET_COUNT), 1, MAX_TARGET_COUNT);
  state.intervalMs = Math.max(MIN_INTERVAL_MS, Number(options.intervalMs || state.intervalMs || DEFAULT_INTERVAL_MS));
  state.running = true;
  state.startedAt = state.startedAt || new Date().toISOString();
  await ensureSimulationUsers(state.targetCount);
  scheduleNextTick();
  await tick();
  return getStatus();
}

async function stop() {
  state.running = false;
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
  state.startedAt = null;

  const currentTime = new Date();
  const users = await User.findAll({ where: { isSimulated: true, status: 'active' } });
  for (const user of users) {
    await markUserOffline(user, currentTime);
  }
  simulationPresence.clear();
  state.lifecycleByUser.clear();
  state.presenceByUser.clear();
  if (state.io) state.io.to('dashboard').emit('simulation:status', await getStatus());
  return getStatus();
}

async function countSimulatedUsers() {
  return User.count({ where: { isSimulated: true } });
}

async function getStatus() {
  return {
    running: state.running,
    targetCount: state.targetCount,
    intervalSeconds: Math.round(state.intervalMs / 1000),
    startedAt: state.startedAt,
    lastTickAt: state.lastTickAt,
    lastError: state.lastError,
    lastSummary: state.lastSummary,
    simulatedUserCount: await countSimulatedUsers(),
    activePresenceCount: simulationPresence.activeCount(),
    lifecycleOnlineCount: Array.from(state.lifecycleByUser.values()).filter((item) => item.mode === 'online').length,
    lifecycleOfflineCount: Array.from(state.lifecycleByUser.values()).filter((item) => item.mode === 'offline').length,
  };
}

async function manualTick(options = {}) {
  state.io = options.io || state.io;
  await ensureSimulationUsers(state.targetCount);
  return tick({ manual: true });
}

module.exports = {
  getStatus,
  manualTick,
  start,
  stop,
};
