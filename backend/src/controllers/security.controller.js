const securityService = require('../services/security.service');

async function listDevices(req, res) {
  const devices = await securityService.listDevices({
    userId: req.query.userId ? Number(req.query.userId) : undefined,
    includeRevoked: req.query.includeRevoked === 'true',
  });
  res.json({ data: devices });
}

async function revokeDevice(req, res) {
  const device = await securityService.revokeDevice(req.params.id);
  res.json({ device });
}

async function restoreDevice(req, res) {
  const device = await securityService.restoreDevice(req.params.id);
  res.json({ device });
}

async function anomalies(req, res) {
  const days = Math.min(30, Math.max(1, Number(req.query.days || 1)));
  res.json(await securityService.anomalySummary(days));
}

async function baseline(req, res) {
  const days = Math.min(30, Math.max(1, Number(req.query.days || 7)));
  res.json(await securityService.userBaseline(req.params.userId, days));
}

module.exports = { listDevices, revokeDevice, restoreDevice, anomalies, baseline };
