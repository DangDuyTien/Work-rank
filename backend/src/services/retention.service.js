const { Op } = require('sequelize');
const { ActivityEvent } = require('../models');

const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_BATCH_SIZE = 5000;
const DEFAULT_MAX_BATCHES = 20;
const DEFAULT_INTERVAL_HOURS = 24;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

let activeJob = null;

function numberSetting(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function retentionConfig(options = {}) {
  const days = numberSetting(
    options.days ?? process.env.RAW_EVENT_RETENTION_DAYS,
    DEFAULT_RETENTION_DAYS,
    { min: 0, max: 3650 },
  );
  const batchSize = numberSetting(
    options.batchSize ?? process.env.RAW_EVENT_RETENTION_BATCH_SIZE,
    DEFAULT_BATCH_SIZE,
    { min: 1, max: 50000 },
  );
  const maxBatches = numberSetting(
    options.maxBatches ?? process.env.RAW_EVENT_RETENTION_MAX_BATCHES,
    DEFAULT_MAX_BATCHES,
    { min: 1, max: 1000 },
  );
  const intervalHours = numberSetting(
    options.intervalHours ?? process.env.RAW_EVENT_RETENTION_INTERVAL_HOURS,
    DEFAULT_INTERVAL_HOURS,
    { min: 1, max: 168 },
  );
  const disabled = process.env.RAW_EVENT_RETENTION_DISABLED === 'true' || days <= 0;

  return { days, batchSize, maxBatches, intervalHours, disabled };
}

async function pruneRawActivityEvents(options = {}) {
  const config = retentionConfig(options);
  if (config.disabled) return { deleted: 0, disabled: true, days: config.days };

  const now = options.now ? new Date(options.now) : new Date();
  const cutoff = new Date(now.getTime() - config.days * ONE_DAY_MS);
  let deleted = 0;
  let batches = 0;

  for (let batch = 0; batch < config.maxBatches; batch += 1) {
    const rows = await ActivityEvent.findAll({
      attributes: ['id'],
      where: { eventTime: { [Op.lt]: cutoff } },
      order: [['eventTime', 'ASC'], ['id', 'ASC']],
      limit: config.batchSize,
      raw: true,
    });
    const ids = rows.map((row) => row.id).filter(Boolean);
    if (!ids.length) break;

    const count = await ActivityEvent.destroy({
      where: { id: { [Op.in]: ids } },
    });
    deleted += Number(count || 0);
    batches += 1;
    if (ids.length < config.batchSize) break;
  }

  return {
    deleted,
    batches,
    cutoff: cutoff.toISOString(),
    days: config.days,
    batchSize: config.batchSize,
    maxBatches: config.maxBatches,
  };
}

function startRetentionJobs(options = {}) {
  const config = retentionConfig(options);
  if (config.disabled) {
    return { enabled: false, config, stop() {} };
  }
  if (activeJob) return activeJob;

  const intervalMs = config.intervalHours * ONE_HOUR_MS;
  const timer = setInterval(() => {
    pruneRawActivityEvents(config).catch((error) => {
      console.warn('Raw activity retention failed:', error.message);
    });
  }, intervalMs);
  timer.unref?.();

  const initialTimer = setTimeout(() => {
    pruneRawActivityEvents(config).catch((error) => {
      console.warn('Initial raw activity retention failed:', error.message);
    });
  }, 60_000).unref?.();

  activeJob = {
    enabled: true,
    config,
    stop() {
      clearInterval(timer);
      clearTimeout(initialTimer);
      activeJob = null;
    },
  };
  return activeJob;
}

module.exports = { pruneRawActivityEvents, retentionConfig, startRetentionJobs };
