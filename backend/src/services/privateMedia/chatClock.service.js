'use strict';

/**
 * PRIVATE MEDIA — CHAT DAY CLOCK
 *
 * The chat feed only shows today's messages (Asia/Ho_Chi_Minh). Clients are told
 * exactly when today ends, so each tab can switch on its own even if it was in
 * the background; this clock is the server-side backstop that pushes the switch
 * to everyone at 00:00, including clients whose timers were throttled.
 *
 * One timer, `unref()`-ed so it can never keep a test process or a shutting-down
 * server alive.
 */

const realtime = require('./realtime.service');
const chatTime = require('./chatTime');

const MAX_TIMEOUT_MS = 2_147_483_647; // setTimeout's ceiling (~24.8 days)
const EDGE_GRACE_MS = 500;

let timer = null;
let lastEmittedDay = null;

function payloadAt(at = new Date()) {
  const window = chatTime.dayWindow(at);
  return {
    day: window.day,
    dayStartsAt: window.dayStartsAt,
    dayEndsAt: window.dayEndsAt,
    serverNow: window.serverNow,
  };
}

/**
 * Announce a day boundary. Exported so a test can drive midnight deterministically
 * instead of waiting for a real clock (or freezing the process clock).
 */
function emitRollover(at = new Date()) {
  const payload = payloadAt(at);
  lastEmittedDay = payload.day;
  realtime.broadcastChatDay(payload);
  return payload;
}

function schedule() {
  clearTimer();
  const now = new Date();
  const delay = Math.min(
    MAX_TIMEOUT_MS,
    chatTime.msUntilNextDay(now) + EDGE_GRACE_MS,
  );
  timer = setTimeout(() => {
    // Fire first, then re-arm for the next midnight: the client uses the day in
    // the payload, so a slightly late timer is still correct.
    emitRollover(new Date());
    schedule();
  }, delay);
  if (typeof timer.unref === 'function') timer.unref();
  return delay;
}

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function start() {
  schedule();
  return msUntilNextDay();
}

function stop() {
  clearTimer();
}

function msUntilNextDay() {
  return chatTime.msUntilNextDay(new Date());
}

module.exports = {
  start,
  stop,
  emitRollover,
  payloadAt,
  msUntilNextDay,
  currentDay: () => chatTime.dayKey(),
  lastEmittedDay: () => lastEmittedDay,
  isRunning: () => Boolean(timer),
};
