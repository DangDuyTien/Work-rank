'use strict';

/**
 * typingRealtime.service.js
 *
 * Realtime socket manager for WorkRank Typing Battle.
 * Handles room channels, throttled progress updates, spectator tracking, and lobby broadcasts.
 */

let ioInstance = null;
const roomSpectators = new Map(); // Map<roomId, Map<socketId, { socketId, userId, name, avatar, jobTitle, department, joinedAt }>>
const progressThrottleTimers = new Map(); // Map<roomId, { timer, pendingUpdates: Map<userId, object> }>

function setIo(io) {
  ioInstance = io;
}

function getIo() {
  return ioInstance;
}

function roomChannel(roomId) {
  return `typing:${roomId}`;
}

function addSpectator(roomId, socketId, userData = {}) {
  if (!roomId || !socketId) return;
  const numId = Number(roomId);
  if (!roomSpectators.has(numId)) {
    roomSpectators.set(numId, new Map());
  }

  const specMap = roomSpectators.get(numId);
  specMap.set(socketId, {
    socketId,
    userId: userData?.id || userData?.userId || null,
    name: userData?.name || 'Khán giả',
    avatar: userData?.avatar || null,
    jobTitle: userData?.jobTitle || '',
    department: userData?.department || '',
    joinedAt: new Date(),
  });

  emitSpectatorCount(numId);
}

function removeSpectator(roomId, socketId) {
  if (!roomId || !socketId) return;
  const numId = Number(roomId);
  if (roomSpectators.has(numId)) {
    const specMap = roomSpectators.get(numId);
    specMap.delete(socketId);
    if (specMap.size === 0) {
      roomSpectators.delete(numId);
    }
  }
  emitSpectatorCount(numId);
}

function removeSpectatorFromAll(socketId) {
  if (!socketId) return;
  for (const [roomId, specMap] of roomSpectators.entries()) {
    if (specMap.has(socketId)) {
      specMap.delete(socketId);
      emitSpectatorCount(roomId);
      if (specMap.size === 0) {
        roomSpectators.delete(roomId);
      }
    }
  }
}

function getSpectatorsList(roomId) {
  if (!roomId) return [];
  const numId = Number(roomId);
  if (!roomSpectators.has(numId)) return [];

  const specMap = roomSpectators.get(numId);
  const userMap = new Map(); // Deduplicate by userId

  for (const spec of specMap.values()) {
    const key = spec.userId ? String(spec.userId) : spec.socketId;
    if (!userMap.has(key)) {
      userMap.set(key, {
        userId: spec.userId,
        name: spec.name,
        avatar: spec.avatar,
        jobTitle: spec.jobTitle,
        department: spec.department,
        joinedAt: spec.joinedAt,
      });
    }
  }

  return Array.from(userMap.values());
}

function getSpectatorCount(roomId) {
  if (!roomId) return 0;
  return getSpectatorsList(roomId).length;
}

function emitSpectatorCount(roomId) {
  if (!ioInstance) return;
  const count = getSpectatorCount(roomId);
  const spectators = getSpectatorsList(roomId);
  ioInstance.to(roomChannel(roomId)).emit('typing:spectatorCount', {
    roomId: Number(roomId),
    spectatorCount: count,
    spectators,
  });
}

function emitToRoom(roomId, eventName, payload) {
  if (!ioInstance) return;
  ioInstance.to(roomChannel(roomId)).emit(eventName, payload);
  if (eventName === 'typing:roomUpdated' || eventName === 'typing:roomListChanged') {
    ioInstance.emit(eventName, payload);
  }
}

function emitToUser(userId, eventName, payload) {
  if (!ioInstance || !userId) return;
  ioInstance.to(`user:${userId}`).emit(eventName, payload);
  ioInstance.to(`web:${userId}`).emit(eventName, payload);
}

/**
 * Throttled broadcast of real-time progress in a typing room.
 * Batches high-frequency typing keystroke progress (120ms tick) to keep network lightweight and smooth.
 */
function queueProgressUpdate(roomId, userId, progressData) {
  const numId = Number(roomId);
  if (!progressThrottleTimers.has(numId)) {
    progressThrottleTimers.set(numId, {
      timer: null,
      pendingUpdates: new Map(),
    });
  }

  const batch = progressThrottleTimers.get(numId);
  batch.pendingUpdates.set(Number(userId), progressData);

  if (!batch.timer) {
    batch.timer = setTimeout(() => {
      const updates = Array.from(batch.pendingUpdates.values());
      batch.pendingUpdates.clear();
      batch.timer = null;

      if (ioInstance && updates.length > 0) {
        ioInstance.to(roomChannel(numId)).emit('typing:progressBatch', {
          roomId: numId,
          updates,
        });
      }
    }, 120);
  }
}

function clearProgressThrottle(roomId) {
  const numId = Number(roomId);
  if (progressThrottleTimers.has(numId)) {
    const batch = progressThrottleTimers.get(numId);
    if (batch.timer) clearTimeout(batch.timer);
    progressThrottleTimers.delete(numId);
  }
}

module.exports = {
  setIo,
  getIo,
  roomChannel,
  addSpectator,
  removeSpectator,
  removeSpectatorFromAll,
  getSpectatorCount,
  getSpectatorsList,
  emitSpectatorCount,
  emitToRoom,
  emitToUser,
  queueProgressUpdate,
  clearProgressThrottle,
};
