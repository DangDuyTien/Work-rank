const { Op, UniqueConstraintError } = require('sequelize');
const { sequelize, Device, WorkSession, ActivityEvent, DailyStat } = require('../models');
const { calculateFocusScore } = require('../utils/score');
const { generateSecret, hashSecret } = require('../utils/crypto');
const fraudDetection = require('./fraudDetection.service');

function toDateOnly(value) {
  return value.toISOString().slice(0, 10);
}

async function findOrCreateDevice(userId, payload, options = {}) {
  const allowCreate = options.allowCreate !== false;
  const existing = await Device.findOne({ where: { userId, deviceUuid: payload.deviceUuid } });

  if (!existing && !allowCreate) {
    const error = new Error('Device not paired');
    error.statusCode = 403;
    throw error;
  }

  const secret = payload.deviceSecret || generateSecret();
  const [device, created] = existing
    ? [existing, false]
    : await Device.findOrCreate({
      where: { userId, deviceUuid: payload.deviceUuid },
      defaults: {
        userId,
        deviceUuid: payload.deviceUuid,
        deviceSecretHash: hashSecret(secret),
        deviceName: payload.deviceName || payload.deviceUuid,
        platform: payload.platform || 'macos',
        appVersion: payload.appVersion || null,
        lastSyncAt: new Date(),
      },
    });

  if (device.revokedAt) {
    const error = new Error('Device revoked');
    error.statusCode = 403;
    throw error;
  }

  const updates = { lastSyncAt: new Date(), appVersion: payload.appVersion || device.appVersion };
  if (!device.deviceSecretHash && payload.deviceSecret) updates.deviceSecretHash = hashSecret(payload.deviceSecret);
  await device.update(updates);
  return { device, deviceSecret: created ? secret : undefined };
}

async function findPairedDeviceForIngest(userId, payload, transaction) {
  const device = await Device.findOne({
    where: { userId, deviceUuid: payload.deviceUuid },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!device) {
    const error = new Error('Device not paired');
    error.statusCode = 403;
    throw error;
  }

  if (device.revokedAt) {
    const error = new Error('Device revoked');
    error.statusCode = 403;
    throw error;
  }

  const updates = { lastSyncAt: new Date(), appVersion: payload.appVersion || device.appVersion };
  if (!device.deviceSecretHash && payload.deviceSecret) updates.deviceSecretHash = hashSecret(payload.deviceSecret);
  await device.update(updates, { transaction });
  return device;
}

async function startSession(userId, payload) {
  const { device, deviceSecret } = await findOrCreateDevice(userId, payload);
  const endedAt = new Date();
  const runningSessions = await WorkSession.findAll({ where: { userId, deviceId: device.id, status: 'running' } });
  await Promise.all(runningSessions.map((session) => session.update({
    endedAt,
    durationSeconds: Math.max(Number(session.durationSeconds || 0), Math.floor((endedAt - session.startedAt) / 1000)),
    status: 'crashed',
  })));
  const session = await WorkSession.create({ userId, deviceId: device.id, startedAt: payload.startedAt || new Date(), status: 'running' });
  return {
    session,
    deviceSecret,
    device: { id: device.id, lastSequence: Number(device.lastSequence || 0) },
    lastSequence: Number(device.lastSequence || 0),
  };
}

async function endSession(userId, sessionId) {
  const session = await WorkSession.findOne({ where: { id: sessionId, userId } });
  if (!session) {
    const error = new Error('Session not found');
    error.statusCode = 404;
    throw error;
  }
  const endedAt = new Date();
  const durationSeconds = Math.max(0, Math.floor((endedAt - session.startedAt) / 1000));
  await session.update({ endedAt, durationSeconds, status: 'ended' });
  return session;
}

async function upsertDailyStat(userId, eventTime, delta, transaction) {
  const statDate = toDateOnly(eventTime);
  let stat = await DailyStat.findOne({
    where: { userId, statDate },
    transaction,
    lock: transaction?.LOCK.UPDATE,
  });

  if (!stat) {
    try {
      stat = await DailyStat.create({ userId, statDate }, { transaction });
    } catch (error) {
      if (!(error instanceof UniqueConstraintError || error.name === 'SequelizeUniqueConstraintError')) throw error;
      stat = await DailyStat.findOne({
        where: { userId, statDate },
        transaction,
        lock: transaction?.LOCK.UPDATE,
      });
    }
  }

  const activeSeconds = Number(stat.activeSeconds || 0) + Number(delta.activeSeconds || 0);
  const idleSeconds = Number(stat.idleSeconds || 0) + Number(delta.idleSeconds || 0);
  const totalSeconds = activeSeconds + idleSeconds;
  await stat.update({
    activeSeconds,
    idleSeconds,
    totalSeconds,
    focusScore: calculateFocusScore(activeSeconds, idleSeconds),
    keystrokeCount: Number(stat.keystrokeCount || 0) + Number(delta.keystrokeCount || 0),
    mouseClickCount: Number(stat.mouseClickCount || 0) + Number(delta.mouseClickCount || 0),
  }, { transaction });
  return stat;
}


async function getUserActivityBaseline(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const stats = await DailyStat.findAll({
    where: { userId, statDate: { [Op.gte]: start, [Op.lt]: today } },
    raw: true,
  });
  const activeDays = stats.filter((row) => Number(row.activeSeconds || 0) > 0);
  const totals = activeDays.reduce((acc, row) => ({
    activeSeconds: acc.activeSeconds + Number(row.activeSeconds || 0),
    keystrokeCount: acc.keystrokeCount + Number(row.keystrokeCount || 0),
    mouseClickCount: acc.mouseClickCount + Number(row.mouseClickCount || 0),
  }), { activeSeconds: 0, keystrokeCount: 0, mouseClickCount: 0 });
  return {
    activeDays: activeDays.length,
    avgClicksPerActiveSecond: totals.activeSeconds ? totals.mouseClickCount / totals.activeSeconds : 0,
    avgKeysPerActiveSecond: totals.activeSeconds ? totals.keystrokeCount / totals.activeSeconds : 0,
  };
}

function normalizeEvent(userId, device, payload, event, signatureValid, sequenceCheck, baseline) {
  const raw = {
    userId,
    deviceId: device.id,
    sessionId: event.sessionId || payload.sessionId || null,
    eventTime: event.timestamp ? new Date(event.timestamp) : new Date(),
    sequence: event.sequence || null,
    activeSeconds: event.activeSeconds || 0,
    idleSeconds: event.idleSeconds || 0,
    keystrokeCount: event.keystrokeCount || 0,
    mouseClickCount: event.mouseClickCount || 0,
    mouseMoveCount: event.mouseMoveCount || 0,
    metadataJson: event.metadata || null,
  };
  const analysis = fraudDetection.analyzeEvent(event, device, signatureValid, sequenceCheck, baseline);
  const trusted = fraudDetection.applyTrustPenalty(raw, analysis);
  return {
    ...trusted,
    signatureValid,
    suspicionScore: analysis.suspicionScore,
    flagsJson: analysis.flags,
  };
}

function sumDeltas(events) {
  return events.reduce((acc, event) => ({
    activeSeconds: acc.activeSeconds + Number(event.activeSeconds || 0),
    idleSeconds: acc.idleSeconds + Number(event.idleSeconds || 0),
    keystrokeCount: acc.keystrokeCount + Number(event.keystrokeCount || 0),
    mouseClickCount: acc.mouseClickCount + Number(event.mouseClickCount || 0),
    mouseMoveCount: acc.mouseMoveCount + Number(event.mouseMoveCount || 0),
  }), { activeSeconds: 0, idleSeconds: 0, keystrokeCount: 0, mouseClickCount: 0, mouseMoveCount: 0 });
}

function buildRealtimeActivityUpdate(userId, stat, events, extra = {}) {
  const delta = sumDeltas(events);
  const totals = {
    activeSeconds: Number(stat?.activeSeconds || 0),
    idleSeconds: Number(stat?.idleSeconds || 0),
    totalSeconds: Number(stat?.totalSeconds || 0),
    keystrokeCount: Number(stat?.keystrokeCount || 0),
    mouseClickCount: Number(stat?.mouseClickCount || 0),
    focusScore: Number(stat?.focusScore || 0),
  };
  const lastEventAt = events.reduce((latest, event) => {
    const value = event.eventTime ? new Date(event.eventTime).getTime() : 0;
    return value > latest ? value : latest;
  }, 0);

  return {
    userId,
    user_id: userId,
    statDate: stat?.statDate || null,
    presence: 'active',
    status: 'active',
    delta,
    totals,
    activeSeconds: totals.activeSeconds,
    idleSeconds: totals.idleSeconds,
    keystrokeCount: totals.keystrokeCount,
    mouseClickCount: totals.mouseClickCount,
    focusScore: totals.focusScore,
    score: totals.focusScore,
    keystrokes: delta.keystrokeCount,
    clicks: delta.mouseClickCount,
    mouseMoves: delta.mouseMoveCount,
    lastEventAt: lastEventAt ? new Date(lastEventAt).toISOString() : null,
    ...extra,
  };
}

async function evaluateDeviceQuarantine(device, transaction) {
  const threshold = fraudDetection.LIMITS.quarantineHighSuspicionEvents;
  const windowMs = fraudDetection.LIMITS.quarantineWindowMs;
  const since = new Date(Date.now() - windowMs);
  const highThreshold = fraudDetection.LIMITS.highSuspicionThreshold;
  const flaggedEventsInWindow = await ActivityEvent.count({
    where: {
      deviceId: device.id,
      createdAt: { [Op.gte]: since },
      suspicionScore: { [Op.gte]: highThreshold },
    },
    transaction,
  });

  if (device.revokedAt || flaggedEventsInWindow < threshold) {
    return {
      quarantined: false,
      flaggedEventsInWindow,
      threshold,
      windowMinutes: Math.round(windowMs / 60000),
    };
  }

  const revokedAt = new Date();
  await device.update({ revokedAt }, { transaction });
  return {
    quarantined: true,
    reason: 'too_many_high_suspicion_events',
    flaggedEventsInWindow,
    threshold,
    windowMinutes: Math.round(windowMs / 60000),
    revokedAt: revokedAt.toISOString(),
    deviceId: device.id,
    deviceUuid: device.deviceUuid,
    deviceName: device.deviceName,
    message: `Thiết bị bị khóa tự động vì có ${flaggedEventsInWindow} event nghi vấn cao trong ${Math.round(windowMs / 60000)} phút. Hãy kiểm tra Bảo Mật và pair lại Desktop Tracker trước khi tiếp tục.`,
  };
}

async function ingestBatch(userId, payload) {
  const baseline = await getUserActivityBaseline(userId);

  return sequelize.transaction(async (transaction) => {
    const device = await findPairedDeviceForIngest(userId, payload, transaction);
    const signature = fraudDetection.verifyBatchSignature(device, payload);
    let previousSequence = Number(device.lastSequence || 0);
    const events = payload.events.map((event) => {
      const sequenceCheck = fraudDetection.analyzeSequence(event, previousSequence);
      previousSequence = Math.max(previousSequence, Number(event.sequence || 0));
      return normalizeEvent(userId, device, payload, event, signature.valid, sequenceCheck, baseline);
    });
    const replayed = events.find((event) => Array.isArray(event.flagsJson) && event.flagsJson.includes('replayed_or_old_sequence'));
    if (replayed) {
      const error = new Error('Replayed or old sequence');
      error.statusCode = 409;
      throw error;
    }

    const patternState = payload.events.reduce((state, event) => fraudDetection.nextPatternState({ ...device.toJSON(), ...state }, event), {});
    const maxSequence = events.reduce((max, event) => Math.max(max, Number(event.sequence || 0)), Number(device.lastSequence || 0));
    let created;
    try {
      created = await ActivityEvent.bulkCreate(events, { transaction });
    } catch (error) {
      if (!(error instanceof UniqueConstraintError || error.name === 'SequelizeUniqueConstraintError')) throw error;
      const conflict = new Error('Duplicate device sequence');
      conflict.statusCode = 409;
      throw conflict;
    }

    let lastStat = null;
    for (const event of events) {
      lastStat = await upsertDailyStat(userId, event.eventTime, event, transaction);
      if (event.sessionId) {
        await WorkSession.increment({
          activeSeconds: event.activeSeconds,
          idleSeconds: event.idleSeconds,
          keystrokeCount: event.keystrokeCount,
          mouseClickCount: event.mouseClickCount,
          mouseMoveCount: event.mouseMoveCount,
        }, { where: { id: event.sessionId, userId }, transaction });
      }
    }
    await device.update({ lastSequence: maxSequence, lastSyncAt: new Date(), ...patternState }, { transaction });
    const flaggedCount = events.filter((event) => event.suspicionScore >= fraudDetection.LIMITS.highSuspicionThreshold).length;
    const quarantine = await evaluateDeviceQuarantine(device, transaction);
    return {
      count: created.length,
      deviceId: device.id,
      signatureValid: signature.valid,
      signatureFlag: signature.flag,
      flaggedCount,
      quarantine,
      realtime: buildRealtimeActivityUpdate(userId, lastStat, events, {
        deviceId: device.id,
        flaggedCount,
        signatureValid: signature.valid,
        quarantine,
      }),
    };
  });
}

async function todayStats(userId) {
  const statDate = toDateOnly(new Date());
  return DailyStat.findOne({ where: { userId, statDate } });
}

async function realtimeUsers() {
  const since = new Date(Date.now() - 5 * 60 * 1000);
  return ActivityEvent.findAll({
    attributes: ['userId', [sequelize.fn('MAX', sequelize.col('event_time')), 'lastEventAt']],
    where: { eventTime: { [Op.gte]: since }, suspicionScore: { [Op.lt]: fraudDetection.LIMITS.highSuspicionThreshold } },
    group: ['userId'],
    raw: true,
  });
}

module.exports = { startSession, endSession, ingestBatch, todayStats, realtimeUsers };
