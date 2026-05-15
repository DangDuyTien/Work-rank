const simulationService = require('../services/simulation.service');

function parseTargetCount(value) {
  const count = Number(value || 50);
  if (!Number.isFinite(count)) return 50;
  return Math.min(100, Math.max(1, Math.round(count)));
}

function parseIntervalMs(value) {
  const seconds = Number(value || 30);
  if (!Number.isFinite(seconds)) return 30_000;
  return Math.max(10, Math.round(seconds)) * 1000;
}

async function status(req, res) {
  res.json(await simulationService.getStatus());
}

async function start(req, res) {
  res.json(await simulationService.start({
    io: req.app.get('io'),
    targetCount: parseTargetCount(req.body?.targetCount),
    intervalMs: parseIntervalMs(req.body?.intervalSeconds),
  }));
}

async function stop(req, res) {
  res.json(await simulationService.stop());
}

async function tick(req, res) {
  res.json(await simulationService.manualTick({ io: req.app.get('io') }));
}

module.exports = {
  start,
  status,
  stop,
  tick,
};
