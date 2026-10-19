'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const realtime = require('../src/services/typingRealtime.service');
test('Typing room details stay in their channel; the lobby receives only invalidation', () => {
  const globalEvents = [], roomEvents = [];
  realtime.setIo({ emit: (event, payload) => globalEvents.push({ event, payload }), to: (channel) => ({ emit: (event, payload) => roomEvents.push({ channel, event, payload }) }) });
  try {
    const detail = { room: { id: 7, players: [{ inputText: 'owner draft' }] } };
    realtime.emitToRoom(7, 'typing:roomUpdated', detail);
    assert.deepEqual(roomEvents, [{ channel: 'typing:7', event: 'typing:roomUpdated', payload: detail }]);
    assert.deepEqual(globalEvents, [{ event: 'typing:roomListChanged', payload: { roomId: 7 } }]);
    realtime.emitToRoom(8, 'typing:roomListChanged', detail);
    assert.deepEqual(globalEvents[1], { event: 'typing:roomListChanged', payload: { roomId: 8 } });
  } finally { realtime.setIo(null); }
});
