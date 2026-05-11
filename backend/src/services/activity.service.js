const { Op } = require('sequelize');
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

async function startSession(userId, payload) {
  const { device, deviceSecret } = await findOrCreateDevice(userId, payload);
  const session = await WorkSession.create({ userId, deviceId: device.id, startedAt: payload.startedAt || new Date(), status: 'running' });
  return { session, deviceSecret };
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
  const [stat] = await DailyStat.findOrCreate({ where: { userId, statDate }, defaults: { userId, statDate }, transaction });
  const activeSeconds = stat.activeSeconds + delta.activeSeconds;
  const idleSeconds = stat.idleSeconds + delta.idleSeconds;
  const totalSeconds = activeSeconds + idleSeconds;
  await stat.update({
    activeSeconds,
    idleSeconds,
    totalSeconds,
    focusScore: calculateFocusScore(activeSeconds, idleSeconds),
    keystrokeCount: stat.keystrokeCount + delta.keystrokeCount,
    mouseClickCount: stat.mouseClickCount + delta.mouseClickCount,
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

async function ingestBatch(userId, payload) {
  const { device, deviceSecret } = await findOrCreateDevice(userId, payload, { allowCreate: false });
  const signature = fraudDetection.verifyBatchSignature(device, payload);
  const baseline = await getUserActivityBaseline(userId);
  let previousSequence = Number(device.lastSequence || 0);
  const events = payload.events.map((event) => {
    const sequenceCheck = fraudDetection.analyzeSequence(event, previousSequence);
    previousSequence = Math.max(previousSequence, Number(event.sequence || 0));
    return normalizeEvent(userId, device, payload, event, signature.valid, sequenceCheck, baseline);
  });
  const patternState = payload.events.reduce((state, event) => fraudDetection.nextPatternState({ ...device.toJSON(), ...state }, event), {});
  const maxSequence = events.reduce((max, event) => Math.max(max, Number(event.sequence || 0)), Number(device.lastSequence || 0));

  return sequelize.transaction(async (transaction) => {
    const created = await ActivityEvent.bulkCreate(events, { transaction });
    for (const event of events) {
      await upsertDailyStat(userId, event.eventTime, event, transaction);
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
    return {
      count: created.length,
      deviceId: device.id,
      deviceSecret,
      signatureValid: signature.valid,
      signatureFlag: signature.flag,
      flaggedCount,
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
