'use strict';

/**
 * Sam Lốc Realtime Socket.IO Service
 * Manages broadcasts to game rooms, private emits to users, and spectator tracking
 */

let ioInstance = null;
const roomSpectators = new Map(); // Map<roomId, Set<socketId>>

function setIo(io) {
  ioInstance = io;
}

function getIo() {
  return ioInstance;
}

function roomChannel(roomId) {
  return `sam:${roomId}`;
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
  ioInstance.to(roomChannel(roomId)).emit('sam:spectatorCount', {
    roomId: Number(roomId),
    spectatorCount: count,
  });
}

function emitToRoom(roomId, eventName, payload) {
  if (!ioInstance) return;
  ioInstance.to(roomChannel(roomId)).emit(eventName, payload);
  // Broadcast lobby updates to all connected users
  if (eventName === 'sam:roomUpdated' || eventName === 'sam:roomListChanged') {
    ioInstance.emit(eventName, payload);
  }
}

function emitToUser(userId, eventName, payload) {
  if (!ioInstance || !userId) return;
  ioInstance.to(`user:${userId}`).emit(eventName, payload);
  ioInstance.to(`web:${userId}`).emit(eventName, payload);
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
};
