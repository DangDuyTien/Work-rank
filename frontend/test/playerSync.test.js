import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decidePlayerAction, shouldReportEnded, YT_STATE, END_SAFE_MARGIN_S,
} from '../src/components/privateMedia/playerSync.js';

const SESSION = (over = {}) => ({
  sessionId: 1,
  sessionRevision: 5,
  currentQueueItemId: 'item-A',
  status: 'PLAYING',
  video: { videoId: 'aaaaaaaaaaa', title: 'A', durationSeconds: 200 },
  currentTime: 190,
  positionAtReference: 190,
  receivedAt: Date.now(),
  ...over,
});

test('a new queue item is loaded exactly once', () => {
  const session = SESSION();
  const first = decidePlayerAction({ session, loadedItemId: null, now: Date.now() });
  assert.equal(first.type, 'load');
  assert.equal(first.itemId, 'item-A');
  const second = decidePlayerAction({ session, loadedItemId: 'item-A', loadedAt: Date.now(), now: Date.now(), playerState: YT_STATE.PLAYING, playerTime: 190 });
  assert.equal(second.type, 'none');
});

test('an item that reported ENDED is never played or seeked again (1s replay regression)', () => {
  const now = Date.now();
  const session = SESSION();
  const base = {
    session,
    loadedItemId: 'item-A',
    loadedAt: now - 200_000,
    lastSeekAt: 0,
    endedItemId: 'item-A',
    now,
  };
  // Every state the player can be in while the server still shows A.
  for (const playerState of [YT_STATE.ENDED, YT_STATE.PLAYING, YT_STATE.PAUSED, YT_STATE.CUED, YT_STATE.BUFFERING, null]) {
    for (const playerTime of [0, 0.4, 199, 199.9, 200]) {
      const decision = decidePlayerAction({ ...base, playerState, playerTime });
      assert.equal(decision.type, 'wait', `state=${playerState} time=${playerTime} must wait`);
    }
  }
  // …and it keeps waiting as time passes: no timeout can turn into a replay.
  for (const drift of [1000, 5000, 30_000]) {
    const decision = decidePlayerAction({ ...base, now: now + drift, playerState: YT_STATE.ENDED, playerTime: 0 });
    assert.equal(decision.type, 'wait');
  }
});

test('a player-reported end with no report yet is reported, never replayed', () => {
  const decision = decidePlayerAction({
    session: SESSION(), loadedItemId: 'item-A', loadedAt: Date.now() - 10_000,
    playerState: YT_STATE.ENDED, playerTime: 200, now: Date.now(),
  });
  assert.equal(decision.type, 'report-ended');
});

test('drift correction never seeks into the last seconds of a track', () => {
  const now = Date.now();
  const session = SESSION({ currentTime: 197 });
  const nearEnd = decidePlayerAction({
    session, loadedItemId: 'item-A', loadedAt: now - 60_000, lastSeekAt: 0,
    playerState: YT_STATE.PLAYING, playerTime: 200 - END_SAFE_MARGIN_S + 0.5, now,
  });
  assert.equal(nearEnd.type, 'none');
  assert.equal(nearEnd.reason, 'NEAR_END');

  const farFromEnd = decidePlayerAction({
    session: SESSION({ currentTime: 100 }), loadedItemId: 'item-A', loadedAt: now - 60_000,
    lastSeekAt: 0, playerState: YT_STATE.PLAYING, playerTime: 130, now,
  });
  assert.equal(farFromEnd.type, 'seek');
  assert.ok(farFromEnd.position < 200);
});

test('a buffering player is left alone', () => {
  const decision = decidePlayerAction({
    session: SESSION(), loadedItemId: 'item-A', loadedAt: 0,
    playerState: YT_STATE.BUFFERING, playerTime: 0, now: Date.now(),
  });
  assert.equal(decision.type, 'none');
});

test('autoplay blocked does not hammer playVideo', () => {
  const decision = decidePlayerAction({
    session: SESSION(), loadedItemId: 'item-A', loadedAt: 0,
    playerState: YT_STATE.UNSTARTED, blocked: true, now: Date.now(),
  });
  assert.equal(decision.type, 'none');
  assert.equal(decision.reason, 'AUTOPLAY_BLOCKED');
});

test('ENDED is reported once per item, with a single retry', () => {
  const now = Date.now();
  assert.equal(shouldReportEnded({ itemId: 'x', lastReport: null, now }), true);
  const first = { itemId: 'x', at: now, attempts: 1 };
  assert.equal(shouldReportEnded({ itemId: 'x', lastReport: first, now: now + 1000 }), false);
  assert.equal(shouldReportEnded({ itemId: 'x', lastReport: first, now: now + 4000 }), true);
  const second = { itemId: 'x', at: now + 4000, attempts: 2 };
  assert.equal(shouldReportEnded({ itemId: 'x', lastReport: second, now: now + 60_000 }), false);
  // A different item always starts a new report cycle.
  assert.equal(shouldReportEnded({ itemId: 'y', lastReport: second, now: now + 60_000 }), true);
});

test('server pause/stop are still applied', () => {
  const now = Date.now();
  assert.equal(decidePlayerAction({
    session: SESSION({ status: 'PAUSED' }), loadedItemId: 'item-A', playerState: YT_STATE.PLAYING, now,
  }).type, 'pause');
  assert.equal(decidePlayerAction({
    session: SESSION({ status: 'STOPPED' }), loadedItemId: 'item-A', playerState: YT_STATE.PLAYING, now,
  }).type, 'stop');
});

test('no media stops the player', () => {
  assert.equal(decidePlayerAction({ session: SESSION({ video: null, status: 'IDLE' }), loadedItemId: 'item-A' }).type, 'stop');
  assert.equal(decidePlayerAction({ session: null, loadedItemId: null }).type, 'none');
});
