const { Op } = require('sequelize');
const { ActivityEvent } = require('../models');

const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_BATCH_SIZE = 5000;
const DEFAULT_MAX_BATCHES = 20;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function retentionDays() {
  const days = Number(process.env.RAW_EVENT_RETENTION_DAYS || DEFAULT_RETENTION_DAYS);
  return Number.isFinite(days) ? days : DEFAULT_RETENTION_DAYS;
}

async function pruneRawActivityEvents(options = {}) {
  const days = Number(options.days ?? retentionDays());
  if (days <= 0) return { deleted: 0, disabled: true };

  const cutoff = new Date(Date.now() - days * ONE_DAY_MS);
  const batchSize = Math.max(100, Number(options.batchSize || DEFAULT_BATCH_SIZE));
  const maxBatches = Math.max(1, Number(options.maxBatches || DEFAULT_MAX_BATCHES));
  let deleted = 0;

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const count = await ActivityEvent.destroy({
      where: { eventTime: { [Op.lt]: cutoff } },
      limit: batchSize,
    });
    deleted += Number(count || 0);
    if (count < batchSize) break;
  }

  return { deleted, cutoff: cutoff.toISOString(), days };
}

function startRetentionJobs() {
  const timer = setInterval(() => {
    pruneRawActivityEvents().catch((error) => {
      console.warn('Raw activity retention failed:', error.message);
    });
  }, ONE_DAY_MS);
  timer.unref?.();

  setTimeout(() => {
    pruneRawActivityEvents().catch((error) => {
      console.warn('Initial raw activity retention failed:', error.message);
    });
  }, 60_000).unref?.();
}

module.exports = { pruneRawActivityEvents, startRetentionJobs };
