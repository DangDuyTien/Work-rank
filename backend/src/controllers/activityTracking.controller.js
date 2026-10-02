'use strict';

const activityTrackingService = require('../services/activityTracking.service');

async function recordBatch(req, res) {
  const events = Array.isArray(req.body) ? req.body : (req.body?.events || []);
  const userId = req.user?.id || null;

  const result = await activityTrackingService.recordBatch(events, { userId });
  return res.json(result);
}

async function getSettings(req, res) {
  const settings = await activityTrackingService.getTrackingSettings();
  return res.json(settings);
}

async function updateSettings(req, res) {
  const updated = await activityTrackingService.updateTrackingSettings(req.body);
  return res.json(updated);
}

async function getAnalytics(req, res) {
  const range = req.query.range || 'today';
  const analytics = await activityTrackingService.getAnalytics({ range });
  return res.json(analytics);
}

module.exports = {
  recordBatch,
  getSettings,
  updateSettings,
  getAnalytics,
};
