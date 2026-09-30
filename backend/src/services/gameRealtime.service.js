'use strict';

/**
 * Game Realtime Socket.IO Service for Capital Board Game
 */

let ioInstance = null;

function setIo(io) {
  ioInstance = io;
}

function getIo() {
  return ioInstance;
}

function roomChannel(roomId) {
  return `game:${roomId}`;
}

function emitToRoom(roomId, eventName, payload) {
  if (!ioInstance) return;
  ioInstance.to(roomChannel(roomId)).emit(eventName, payload);
  // Also broadcast to general dashboard or game lobby if it's a room update
  if (eventName === 'game:roomUpdated' || eventName === 'game:roomListChanged') {
    ioInstance.emit(eventName, payload);
  }
}

function emitToUser(userId, eventName, payload) {
  if (!ioInstance) return;
  ioInstance.to(`user:${userId}`).emit(eventName, payload);
  ioInstance.to(`web:${userId}`).emit(eventName, payload);
}

module.exports = {
  setIo,
  getIo,
  roomChannel,
  emitToRoom,
  emitToUser,
};
