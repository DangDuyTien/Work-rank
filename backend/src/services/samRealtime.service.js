'use strict';

/**
 * Sam Lốc Realtime Socket.IO Service
 * Manages broadcasts to game rooms and private emits to users
 */

let ioInstance = null;

function setIo(io) {
  ioInstance = io;
}

function getIo() {
  return ioInstance;
}

function roomChannel(roomId) {
  return `sam:${roomId}`;
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
