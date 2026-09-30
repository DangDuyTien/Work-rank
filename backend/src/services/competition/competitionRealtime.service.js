'use strict';

/**
 * competitionRealtime.service.js
 *
 * Realtime emission helper for competition events and Phase 6 Read Model projections.
 * Safe to call even if Socket.IO is not initialized (e.g. in unit tests).
 */

let ioInstance = null;

function setIo(io) {
  ioInstance = io;
}

function getIo() {
  return ioInstance;
}

function emitScoreAwarded({ userId, teamId, pointsDelta, effectType, reason, metadata }) {
  if (!ioInstance) return;

  const payload = {
    userId,
    teamId,
    pointsDelta,
    effectType,
    reason,
    metadata,
    timestamp: new Date().toISOString(),
  };

  if (userId) {
    ioInstance.to(`user:${userId}`).emit('competition:score_awarded', payload);
  }
  if (teamId) {
    ioInstance.to(`team:${teamId}`).emit('competition:score_awarded', payload);
  }
  // Admin channel for live monitoring
  ioInstance.to('role:admin').emit('competition:admin:score_activity', payload);
}

function emitStateUpdated({ entityType, entityId, stateKey, data, version, thresholdMet }) {
  if (!ioInstance) return;

  const payload = {
    entityType,
    entityId,
    stateKey,
    data,
    version,
    thresholdMet,
    timestamp: new Date().toISOString(),
  };

  const room = entityType === 'team' ? `team:${entityId}` : `user:${entityId}`;
  ioInstance.to(room).emit('competition:state_updated', payload);
  ioInstance.to('role:admin').emit('competition:admin:state_activity', payload);
}

function emitDashboardUpdated({ userId, teamId }) {
  if (!ioInstance) return;

  const payload = {
    userId,
    teamId,
    timestamp: new Date().toISOString(),
  };

  if (userId) {
    ioInstance.to(`user:${userId}`).emit('competition:dashboard_updated', payload);
  }
  if (teamId) {
    ioInstance.to(`team:${teamId}`).emit('competition:dashboard_updated', payload);
  }
  ioInstance.to('role:admin').emit('competition:dashboard_updated', payload);
}

function emitLeaderboardUpdated({ seasonId, grandId }) {
  if (!ioInstance) return;

  const payload = {
    seasonId,
    grandId,
    timestamp: new Date().toISOString(),
  };

  if (seasonId) {
    ioInstance.to(`season:${seasonId}`).emit('competition:leaderboard_updated', payload);
  }
  if (grandId) {
    ioInstance.to(`grand:${grandId}`).emit('competition:leaderboard_updated', payload);
  }
  ioInstance.emit('competition:leaderboard_updated', payload);
}

function emitActivityCreated(activity) {
  if (!ioInstance) return;

  const payload = {
    activity,
    timestamp: new Date().toISOString(),
  };

  if (activity.actorUserId) {
    ioInstance.to(`user:${activity.actorUserId}`).emit('competition:activity_created', payload);
  }
  if (activity.teamId) {
    ioInstance.to(`team:${activity.teamId}`).emit('competition:activity_created', payload);
  }
  ioInstance.emit('competition:activity_created', payload);
}

module.exports = {
  setIo,
  getIo,
  emitScoreAwarded,
  emitStateUpdated,
  emitDashboardUpdated,
  emitLeaderboardUpdated,
  emitActivityCreated,
};
