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
  const [totals, byFlag, byDevice] = await Promise.all([
    ActivityEvent.findOne({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('ActivityEvent.id')), 'totalEvents'],
        [sequelize.fn('SUM', sequelize.literal(`CASE WHEN suspicion_score >= ${highThreshold} THEN 1 ELSE 0 END`)), 'flaggedEvents'],
        [sequelize.fn('AVG', sequelize.col('suspicion_score')), 'averageSuspicionScore'],
      ],
      where: { eventTime: { [Op.gte]: since } },
      raw: true,
    }),
    ActivityEvent.findAll({
      attributes: ['flagsJson', [sequelize.fn('COUNT', sequelize.col('ActivityEvent.id')), 'count']],
      where: { eventTime: { [Op.gte]: since }, suspicionScore: { [Op.gte]: highThreshold } },
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
  ]);

  const flagCounts = {};
  for (const row of byFlag) {
    const flags = Array.isArray(row.flagsJson) ? row.flagsJson : [];
    for (const flag of flags) flagCounts[flag] = (flagCounts[flag] || 0) + Number(row.count || 0);
  }

  return {
    windowDays: days,
    totalEvents: Number(totals?.totalEvents || 0),
    flaggedEvents: Number(totals?.flaggedEvents || 0),
    averageSuspicionScore: Math.round(Number(totals?.averageSuspicionScore || 0)),
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

module.exports = { listDevices, revokeDevice, restoreDevice, anomalySummary, userBaseline };
