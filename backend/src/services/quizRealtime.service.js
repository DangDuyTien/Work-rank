'use strict';

/**
 * Quiz Realtime Socket.IO Service for Image & Music Quiz Game V1
 */

let ioInstance = null;

function setIo(io) {
  ioInstance = io;
}

function getIo() {
  return ioInstance;
}

function roomChannel(roomId) {
  return `quiz:${roomId}`;
}

function emitToRoom(roomId, eventName, payload) {
  if (!ioInstance) return;
  ioInstance.to(roomChannel(roomId)).emit(eventName, payload);
  // Also broadcast room list / room updated events to lobby
  if (eventName === 'quiz:roomUpdated' || eventName === 'quiz:roomListChanged') {
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
