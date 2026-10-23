'use strict';

const musicRaceService = require('../services/musicRace.service');
const { checkGameAvailability } = require('../services/gameCatalog.service');

async function guard(req, res) {
  const availability = await checkGameAvailability('typing_battle', req.user);
  if (!availability.allowed) {
    res.status(403).json(availability);
    return false;
  }
  return true;
}

async function listSongs(req, res) {
  if (!(await guard(req, res))) return;
  const songs = await musicRaceService.listSongs({ includeInactive: req.query.includeInactive === '1' && req.user?.role === 'admin' });
  res.json({ songs });
}

async function getSong(req, res) {
  if (!(await guard(req, res))) return;
  const song = await musicRaceService.getSong(req.params.songId);
  if (!song) return res.status(404).json({ message: 'Không tìm thấy bài hát' });
  res.json({ song });
}

async function publishSong(req, res) {
  const song = await musicRaceService.publishSong(req.body, req.user);
  res.status(201).json({ song });
}

async function myStats(req, res) {
  if (!(await guard(req, res))) return;
  res.json(await musicRaceService.getMyStats(req.user.id));
}

async function createAttempt(req, res) {
  if (!(await guard(req, res))) return;
  const attempt = await musicRaceService.createAttempt(req.user.id, { songId: req.body?.songId });
  res.status(201).json(attempt);
}

async function progress(req, res) {
  const attempt = await musicRaceService.progress(req.params.attemptId, req.user.id, req.body);
  res.json(attempt);
}

async function finish(req, res) {
  const result = await musicRaceService.finish(req.user.id, req.body);
  res.json({ result });
}

async function leaderboard(req, res) {
  if (!(await guard(req, res))) return;
  res.json(await musicRaceService.getLeaderboard({ limit: req.query.limit }));
}

module.exports = { listSongs, getSong, publishSong, myStats, createAttempt, progress, finish, leaderboard };
