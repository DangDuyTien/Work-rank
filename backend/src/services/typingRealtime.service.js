'use strict';

/**
 * typingRealtime.service.js
 *
 * Realtime socket manager for WorkRank Typing Battle.
 * Handles room channels, throttled progress updates, spectator tracking, and lobby broadcasts.
 */

let ioInstance = null;
const roomSpectators = new Map(); // Map<roomId, Set<socketId>>
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

function addSpectator(roomId, socketId) {
  if (!roomId || !socketId) return;
  const numId = Number(roomId);
  if (!roomSpectators.has(numId)) {
    roomSpectators.set(numId, new Set());
  }
  roomSpectators.get(numId).add(socketId);
  emitSpectatorCount(numId);
}

function removeSpectator(roomId, socketId) {
  if (!roomId || !socketId) return;
  const numId = Number(roomId);
  if (roomSpectators.has(numId)) {
    roomSpectators.get(numId).delete(socketId);
    if (roomSpectators.get(numId).size === 0) {
      roomSpectators.delete(numId);
    }
  }
  emitSpectatorCount(numId);
}

function removeSpectatorFromAll(socketId) {
  if (!socketId) return;
  for (const [roomId, socketSet] of roomSpectators.entries()) {
    if (socketSet.has(socketId)) {
      socketSet.delete(socketId);
      emitSpectatorCount(roomId);
      if (socketSet.size === 0) {
        roomSpectators.delete(roomId);
      }
    }
  }
}

function getSpectatorCount(roomId) {
  if (!roomId) return 0;
  const numId = Number(roomId);
  return roomSpectators.has(numId) ? roomSpectators.get(numId).size : 0;
}

function emitSpectatorCount(roomId) {
  if (!ioInstance) return;
  const count = getSpectatorCount(roomId);
  ioInstance.to(roomChannel(roomId)).emit('typing:spectatorCount', {
    roomId: Number(roomId),
    spectatorCount: count,
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
  emitSpectatorCount,
  emitToRoom,
  emitToUser,
  queueProgressUpdate,
  clearProgressThrottle,
};
