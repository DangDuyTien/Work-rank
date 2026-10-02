'use strict';

const { Op, fn, col, literal } = require('sequelize');
const { ActivityEvent, SystemSetting, sequelize } = require('../models');

const SETTING_KEY = 'activity_tracking';

/**
 * Returns system-wide activity tracking flags.
 */
async function getTrackingSettings() {
  const row = await SystemSetting.findOne({ where: { settingKey: SETTING_KEY } });
  if (!row || !row.settingValue) {
    return {
      mouseTrackingEnabled: true,
      keyboardTrackingEnabled: true,
    };
  }

  const val = typeof row.settingValue === 'string' ? JSON.parse(row.settingValue) : row.settingValue;
  return {
    mouseTrackingEnabled: val.mouse_tracking_enabled !== false,
    keyboardTrackingEnabled: val.keyboard_tracking_enabled !== false,
  };
}

/**
 * Updates system-wide activity tracking flags (Admin only).
 */
async function updateTrackingSettings({ mouseTrackingEnabled, keyboardTrackingEnabled }) {
  const current = await getTrackingSettings();
  const nextValue = {
    mouse_tracking_enabled: mouseTrackingEnabled !== undefined ? Boolean(mouseTrackingEnabled) : current.mouseTrackingEnabled,
    keyboard_tracking_enabled: keyboardTrackingEnabled !== undefined ? Boolean(keyboardTrackingEnabled) : current.keyboardTrackingEnabled,
  };

  const [row] = await SystemSetting.findOrCreate({
    where: { settingKey: SETTING_KEY },
    defaults: {
      settingKey: SETTING_KEY,
      settingValue: nextValue,
      description: 'Cấu hình bật/tắt ghi nhận telemetry Activity Tracking (Chuột & Bàn phím)',
    },
  });

  await row.update({ settingValue: nextValue });

  return {
    mouseTrackingEnabled: nextValue.mouse_tracking_enabled,
    keyboardTrackingEnabled: nextValue.keyboard_tracking_enabled,
  };
}

/**
 * Sanitizes metadata to ensure zero storage of raw typed text, form values or passwords.
 */
function sanitizeMetadata(rawMeta) {
  if (!rawMeta || typeof rawMeta !== 'object') return null;

  // Never store text content, values, keys, inputs, forms
  const sanitized = {};
  if (rawMeta.target && typeof rawMeta.target === 'string') {
    sanitized.target = rawMeta.target.slice(0, 100);
  }
  if (rawMeta.tag && typeof rawMeta.tag === 'string') {
    sanitized.tag = rawMeta.tag.slice(0, 50);
  }
  if (rawMeta.route && typeof rawMeta.route === 'string') {
    sanitized.route = rawMeta.route.slice(0, 255);
  }
  if (rawMeta.event && typeof rawMeta.event === 'string') {
    sanitized.event = rawMeta.event.slice(0, 50);
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Records a batch of telemetry activity events.
 * Network-level batching only.
 * ABSOLUTELY NO anti-cheat, NO suspicious flags, NO user scoring, NO penalties.
 */
async function recordBatch(events, { userId = null } = {}) {
  if (!Array.isArray(events) || events.length === 0) {
    return { success: true, processed: 0, discarded: 0 };
  }

  // Guard max batch size to protect request memory payload
  const safeEvents = events.slice(0, 1000);
  const settings = await getTrackingSettings();

  const receivedAt = new Date();
  const recordsToInsert = [];

  for (const item of safeEvents) {
    if (!item || typeof item !== 'object') continue;

    const eventType = String(item.eventType || item.event_type || '').toUpperCase();
    if (eventType !== 'CLICK' && eventType !== 'KEYBOARD_ACTIVITY') {
      continue;
    }

    // Check system settings
    if (eventType === 'CLICK' && !settings.mouseTrackingEnabled) {
      continue;
    }
    if (eventType === 'KEYBOARD_ACTIVITY' && !settings.keyboardTrackingEnabled) {
      continue;
    }

    let occurredAt = receivedAt;
    if (item.occurredAt || item.occurred_at || item.timestamp) {
      const parsed = new Date(item.occurredAt || item.occurred_at || item.timestamp);
      if (!isNaN(parsed.getTime())) {
        occurredAt = parsed;
      }
    }

    const sessionId = item.sessionId || item.session_id ? String(item.sessionId || item.session_id).slice(0, 128) : null;
    const route = item.route ? String(item.route).slice(0, 255) : null;
    const metadata = sanitizeMetadata(item.metadata);

    recordsToInsert.push({
      userId: userId ? Number(userId) : null,
      sessionId,
      eventType,
      route,
      occurredAt,
      receivedAt,
      metadata,
    });
  }

  if (recordsToInsert.length > 0) {
    await ActivityEvent.bulkCreate(recordsToInsert);
  }

  return {
    success: true,
    processed: recordsToInsert.length,
    discarded: events.length - recordsToInsert.length,
  };
}

/**
 * Aggregates pure activity telemetry for admin inspection.
 * Ranges: 'today', '7d', '30d'.
 */
async function getAnalytics({ range = 'today' } = {}) {
  const now = new Date();
  let startDate = new Date();

  if (range === '7d') {
    startDate.setDate(now.getDate() - 7);
  } else if (range === '30d') {
    startDate.setDate(now.getDate() - 30);
  } else {
    // 'today': beginning of today
    startDate.setHours(0, 0, 0, 0);
  }

  const timeFilter = {
    occurredAt: {
      [Op.gte]: startDate,
    },
  };

  const [totalClicks, totalKeyboards, activeUsersCount, topRoutesRaw] = await Promise.all([
    ActivityEvent.count({
      where: {
        ...timeFilter,
        eventType: 'CLICK',
      },
    }),
    ActivityEvent.count({
      where: {
        ...timeFilter,
        eventType: 'KEYBOARD_ACTIVITY',
      },
    }),
    ActivityEvent.count({
      distinct: true,
      col: 'user_id',
      where: {
        ...timeFilter,
        userId: { [Op.ne]: null },
      },
    }),
    ActivityEvent.findAll({
      attributes: [
        'route',
        [fn('COUNT', col('id')), 'event_count'],
      ],
      where: {
        ...timeFilter,
        route: { [Op.ne]: null },
      },
      group: ['route'],
      order: [[literal('event_count'), 'DESC']],
      limit: 10,
      raw: true,
    }),
  ]);

  const totalActivity = totalClicks + totalKeyboards;
  const topRoutes = topRoutesRaw.map((r) => ({
    route: r.route,
    count: Number(r.event_count || 0),
  }));

  // Timeline series (hourly for today, daily for 7d/30d)
  const isHourly = range === 'today';
  const dateFormatSql = isHourly
    ? "DATE_FORMAT(occurred_at, '%Y-%m-%d %H:00')"
    : "DATE_FORMAT(occurred_at, '%Y-%m-%d')";

  const timelineRaw = await ActivityEvent.findAll({
    attributes: [
      [literal(dateFormatSql), 'period'],
      'eventType',
      [fn('COUNT', col('id')), 'count'],
    ],
    where: timeFilter,
    group: [literal(dateFormatSql), 'eventType'],
    order: [[literal('period'), 'ASC']],
    raw: true,
  });

  const timelineMap = new Map();
  for (const row of timelineRaw) {
    const period = row.period;
    if (!timelineMap.has(period)) {
      timelineMap.set(period, { period, clicks: 0, keyboard: 0, total: 0 });
    }
    const entry = timelineMap.get(period);
    const count = Number(row.count || 0);
    if (row.eventType === 'CLICK') {
      entry.clicks += count;
    } else if (row.eventType === 'KEYBOARD_ACTIVITY') {
      entry.keyboard += count;
    }
    entry.total += count;
  }

  const timeline = Array.from(timelineMap.values()).sort((a, b) => a.period.localeCompare(b.period));

  return {
    range,
    startDate,
    summary: {
      totalClicks,
      totalKeyboards,
      totalActivity,
      activeUsersCount,
    },
    topRoutes,
    timeline,
  };
}

module.exports = {
  getTrackingSettings,
  updateTrackingSettings,
  recordBatch,
  getAnalytics,
};
