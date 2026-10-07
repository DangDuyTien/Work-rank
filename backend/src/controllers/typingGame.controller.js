'use strict';

const typingGameService = require('../services/typingGame.service');
const { checkGameAvailability } = require('../services/gameCatalog.service');

async function getCatalogStatus(req, res) {
  const availability = await checkGameAvailability('typing_battle', req.user);
  res.json(availability);
}

async function listRooms(req, res) {
  const availability = await checkGameAvailability('typing_battle', req.user);
  if (!availability.allowed) {
    return res.status(403).json(availability);
  }
  const rooms = await typingGameService.listRooms(req.query);
  res.json({ rooms });
}

async function createRoom(req, res) {
  const availability = await checkGameAvailability('typing_battle', req.user);
  if (!availability.allowed) {
    return res.status(403).json(availability);
  }
  const detail = await typingGameService.createRoom(req.body, req.user);
  res.status(201).json(detail);
}

async function quickMatch(req, res) {
  const availability = await checkGameAvailability('typing_battle', req.user);
  if (!availability.allowed) {
    return res.status(403).json(availability);
  }
  const detail = await typingGameService.quickMatch(req.body, req.user);
  res.json(detail);
}

async function getRoomDetail(req, res) {
  const availability = await checkGameAvailability('typing_battle', req.user);
  if (!availability.allowed) {
    return res.status(403).json(availability);
  }
  const detail = await typingGameService.getRoomDetail(req.params.roomId, req.user?.id);
  res.json(detail);
}

async function joinRoom(req, res) {
  const availability = await checkGameAvailability('typing_battle', req.user);
  if (!availability.allowed) {
    return res.status(403).json(availability);
  }
  const detail = await typingGameService.joinRoom(req.params.roomId, req.user.id);
  res.json(detail);
}

async function switchTeam(req, res) {
  const detail = await typingGameService.switchTeam(req.params.roomId, req.user.id, req.body.team);
  res.json(detail);
}

async function leaveRoom(req, res) {
  const result = await typingGameService.leaveRoom(req.params.roomId, req.user.id);
  res.json(result);
}

async function toggleReady(req, res) {
  const detail = await typingGameService.toggleReady(req.params.roomId, req.user.id, req.body.isReady);
  res.json(detail);
}

async function startMatch(req, res) {
  const detail = await typingGameService.startMatch(req.params.roomId, req.user.id);
  res.json(detail);
}

async function resetRoom(req, res) {
  const detail = await typingGameService.resetRoom(req.params.roomId, req.user.id);
  res.json(detail);
}

async function updateProgress(req, res) {
  await typingGameService.updateProgress(req.params.roomId, req.user.id, req.body);
  res.json({ ok: true });
}

async function submitFinish(req, res) {
  const detail = await typingGameService.submitFinish(req.params.roomId, req.user.id, req.body);
  res.json(detail);
}

async function submitPractice(req, res) {
  const result = await typingGameService.submitPracticeResult(req.body, req.user);
  res.json(result);
}

async function getMyStats(req, res) {
  const stats = await typingGameService.getMyStats(req.user.id);
  res.json(stats || {});
}

async function getLeaderboard(req, res) {
  const data = await typingGameService.getTypingLeaderboard({
    limit: req.query.limit,
    currentUserId: req.user?.id,
  });
  res.json(data);
}

async function getChallenges(req, res) {
  const challenges = await typingGameService.getChallenges(req.query);
  res.json({ challenges });
}

module.exports = {
  getCatalogStatus,
  listRooms,
  createRoom,
  quickMatch,
  getRoomDetail,
  joinRoom,
  switchTeam,
  leaveRoom,
  toggleReady,
  startMatch,
  resetRoom,
  updateProgress,
  submitFinish,
  submitPractice,
  getMyStats,
  getLeaderboard,
  getChallenges,
};

