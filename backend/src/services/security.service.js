const { Op } = require('sequelize');
const { sequelize, Device, User, ActivityEvent, DailyStat } = require('../models');
const fraudDetection = require('./fraudDetection.service');

async function listDevices({ userId, includeRevoked = false } = {}) {
  const where = {};
  if (userId) where.userId = userId;
  if (!includeRevoked) where.revokedAt = null;
  return Device.findAll({
    where,
    include: [{ model: User, attributes: ['id', 'name', 'email', 'role', 'teamId'] }],
    order: [['lastSyncAt', 'DESC']],
  });
}

async function revokeDevice(deviceId) {
  const device = await Device.findByPk(deviceId);
  if (!device) {
    const error = new Error('Device not found');
    error.statusCode = 404;
    throw error;
  }
  await device.update({ revokedAt: new Date() });
  return device;
}

async function restoreDevice(deviceId) {
  const device = await Device.findByPk(deviceId);
  if (!device) {
    const error = new Error('Device not found');
    error.statusCode = 404;
    throw error;
  }
  await device.update({ revokedAt: null });
  return device;
}

async function anomalySummary(days = 1) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const highThreshold = fraudDetection.LIMITS.highSuspicionThreshold;
  const [totals, byFlag, byDevice, quarantinedDevices] = await Promise.all([
    ActivityEvent.findOne({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('ActivityEvent.id')), 'totalEvents'],
        [sequelize.fn('SUM', sequelize.literal(`CASE WHEN suspicion_score > 0 AND suspicion_score < ${highThreshold} THEN 1 ELSE 0 END`)), 'warningEvents'],
        [sequelize.fn('SUM', sequelize.literal(`CASE WHEN suspicion_score >= ${highThreshold} THEN 1 ELSE 0 END`)), 'flaggedEvents'],
        [sequelize.fn('AVG', sequelize.col('suspicion_score')), 'averageSuspicionScore'],
      ],
      where: { eventTime: { [Op.gte]: since } },
      raw: true,
    }),
    ActivityEvent.findAll({
      attributes: ['flagsJson', [sequelize.fn('COUNT', sequelize.col('ActivityEvent.id')), 'count']],
      where: { eventTime: { [Op.gte]: since }, suspicionScore: { [Op.gt]: 0 } },
      group: ['flagsJson'],
      raw: true,
    }),
    ActivityEvent.findAll({
      attributes: [
        'deviceId',
        [sequelize.fn('COUNT', sequelize.col('ActivityEvent.id')), 'eventCount'],
        [sequelize.fn('MAX', sequelize.col('suspicion_score')), 'maxSuspicionScore'],
        [sequelize.fn('SUM', sequelize.literal(`CASE WHEN suspicion_score >= ${highThreshold} THEN 1 ELSE 0 END`)), 'flaggedEvents'],
      ],
      where: { eventTime: { [Op.gte]: since } },
      include: [{ model: Device, attributes: ['id', 'deviceUuid', 'deviceName', 'platform', 'lastSyncAt', 'revokedAt'], include: [{ model: User, attributes: ['id', 'name', 'email'] }] }],
      group: ['deviceId', 'Device.id', 'Device->User.id'],
      order: [[sequelize.literal('flaggedEvents'), 'DESC'], [sequelize.literal('maxSuspicionScore'), 'DESC']],
      limit: 20,
    }),
    Device.count({ where: { revokedAt: { [Op.gte]: since } } }),
  ]);

  const flagCounts = {};
  for (const row of byFlag) {
    let flags = Array.isArray(row.flagsJson) ? row.flagsJson : [];
    if (!flags.length && typeof row.flagsJson === 'string') {
      try {
        const parsed = JSON.parse(row.flagsJson);
        flags = Array.isArray(parsed) ? parsed : [];
      } catch {
        flags = [];
      }
    }
    for (const flag of flags) flagCounts[flag] = (flagCounts[flag] || 0) + Number(row.count || 0);
  }

  return {
    windowDays: days,
    totalEvents: Number(totals?.totalEvents || 0),
    warningEvents: Number(totals?.warningEvents || 0),
    flaggedEvents: Number(totals?.flaggedEvents || 0),
    averageSuspicionScore: Math.round(Number(totals?.averageSuspicionScore || 0)),
    highSuspicionThreshold: highThreshold,
    quarantineThreshold: fraudDetection.LIMITS.quarantineHighSuspicionEvents,
    quarantineWindowMinutes: Math.round(fraudDetection.LIMITS.quarantineWindowMs / 60000),
    quarantinedDevices,
    flagCounts,
    devices: byDevice,
  };
}

async function userBaseline(userId, days = 7) {
  const end = new Date();
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const stats = await DailyStat.findAll({
    where: { userId, statDate: { [Op.gte]: start.toISOString().slice(0, 10), [Op.lt]: end.toISOString().slice(0, 10) } },
    raw: true,
  });
  const activeDays = stats.filter((row) => Number(row.totalSeconds || 0) > 0);
  const divisor = Math.max(1, activeDays.length);
  const sum = activeDays.reduce((acc, row) => ({
    activeSeconds: acc.activeSeconds + Number(row.activeSeconds || 0),
    idleSeconds: acc.idleSeconds + Number(row.idleSeconds || 0),
    keystrokeCount: acc.keystrokeCount + Number(row.keystrokeCount || 0),
    mouseClickCount: acc.mouseClickCount + Number(row.mouseClickCount || 0),
    focusScore: acc.focusScore + Number(row.focusScore || 0),
  }), { activeSeconds: 0, idleSeconds: 0, keystrokeCount: 0, mouseClickCount: 0, focusScore: 0 });
  return {
    days,
    activeDays: activeDays.length,
    avgActiveSeconds: Math.round(sum.activeSeconds / divisor),
    avgIdleSeconds: Math.round(sum.idleSeconds / divisor),
    avgKeystrokes: Math.round(sum.keystrokeCount / divisor),
    avgMouseClicks: Math.round(sum.mouseClickCount / divisor),
    avgFocusScore: Math.round(sum.focusScore / divisor),
  };
}

function normalizeFlags(flagsJson) {
  if (Array.isArray(flagsJson)) return flagsJson;
  if (typeof flagsJson === 'string') {
    try {
      const parsed = JSON.parse(flagsJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function recentSuspiciousEvents({ days = 1, limit = 50 } = {}) {
  const safeDays = Math.min(30, Math.max(1, Number(days || 1)));
  const safeLimit = Math.min(100, Math.max(1, Number(limit || 50)));
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
  const highThreshold = fraudDetection.LIMITS.highSuspicionThreshold;
  const events = await ActivityEvent.findAll({
    where: {
      eventTime: { [Op.gte]: since },
      suspicionScore: { [Op.gt]: 0 },
    },
    include: [
      { model: User, attributes: ['id', 'name', 'email', 'teamId'] },
      { model: Device, attributes: ['id', 'deviceUuid', 'deviceName', 'platform', 'appVersion', 'revokedAt'] },
    ],
    order: [['eventTime', 'DESC']],
    limit: safeLimit,
  });

  return events.map((event) => {
    const row = event.toJSON();
    const flags = normalizeFlags(row.flagsJson);
    const highSuspicion = Number(row.suspicionScore || 0) >= highThreshold;
    return {
      id: row.id,
      eventTime: row.eventTime,
      createdAt: row.createdAt,
      userId: row.userId,
      deviceId: row.deviceId,
      sequence: row.sequence,
      signatureValid: !!row.signatureValid,
      suspicionScore: Number(row.suspicionScore || 0),
      flags,
      action: highSuspicion ? 'not_counted' : 'flagged_only',
      totals: {
        activeSeconds: Number(row.activeSeconds || 0),
        idleSeconds: Number(row.idleSeconds || 0),
        keystrokeCount: Number(row.keystrokeCount || 0),
        mouseClickCount: Number(row.mouseClickCount || 0),
        mouseMoveCount: Number(row.mouseMoveCount || 0),
      },
      user: row.User ? {
        id: row.User.id,
        name: row.User.name,
        email: row.User.email,
        teamId: row.User.teamId,
      } : null,
      device: row.Device ? {
        id: row.Device.id,
        deviceUuid: row.Device.deviceUuid,
        deviceName: row.Device.deviceName,
        platform: row.Device.platform,
        appVersion: row.Device.appVersion,
        revokedAt: row.Device.revokedAt,
      } : null,
    };
  });
}

module.exports = { listDevices, revokeDevice, restoreDevice, anomalySummary, userBaseline, recentSuspiciousEvents };
