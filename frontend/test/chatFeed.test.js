import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_FEED, dayHeading, dayLabel, isGrouped, isStaleDay, mergeMessages,
  messageId, msUntilBoundary, timeLabel,
} from '../src/components/privateMedia/chatFeed.js';

const msg = (id, over = {}) => ({
  id,
  content: `tin ${id}`,
  createdAt: new Date(2026, 10, 6, 10, 0, id).toISOString(),
  day: '2026-11-06',
  user: { id: 1, name: 'Minh Anh' },
  ...over,
});

test('mergeMessages deduplicates by id and orders by id, not arrival', () => {
  const merged = mergeMessages([msg(3), msg(1)], [msg(2), msg(3), msg(4)]);
  assert.deepEqual(merged.map(messageId), [1, 2, 3, 4]);
  assert.equal(merged.length, 4);
});

test('mergeMessages ignores malformed rows and caps the feed at the newest', () => {
  const many = Array.from({ length: MAX_FEED + 25 }, (_, index) => msg(index + 1));
  const capped = mergeMessages([], many);
  assert.equal(capped.length, MAX_FEED);
  assert.equal(messageId(capped[0]), 26, 'the oldest messages are the ones dropped');
  assert.equal(messageId(capped[capped.length - 1]), MAX_FEED + 25);
  assert.deepEqual(mergeMessages([], [null, undefined, {}, { id: 0 }]), []);
});

test('a reconnect page and a live socket message can overlap without duplicating', () => {
  const onScreen = [msg(10), msg(11)];
  const catchUp = [msg(11), msg(12), msg(13)];
  const live = [msg(13), msg(14)];
  const merged = mergeMessages(mergeMessages(onScreen, catchUp), live);
  assert.deepEqual(merged.map(messageId), [10, 11, 12, 13, 14]);
  assert.equal(new Set(merged.map(messageId)).size, merged.length);
});

test('a message from another day is not part of the open feed', () => {
  assert.equal(isStaleDay('2026-11-05', '2026-11-06'), true);
  assert.equal(isStaleDay('2026-11-06', '2026-11-06'), false);
  // Unknown metadata must not throw a message away.
  assert.equal(isStaleDay(null, '2026-11-06'), false);
  assert.equal(isStaleDay('2026-11-06', null), false);
});

test('day labels are dd/MM and the heading says "Hôm nay" only for today', () => {
  assert.equal(dayLabel('2026-11-06'), '06/11');
  assert.equal(dayLabel('2026-01-02'), '02/01');
  assert.equal(dayLabel(''), '');
  assert.equal(dayLabel('06/11/2026'), '');
  assert.equal(dayHeading('2026-11-06', '2026-11-06'), 'Hôm nay · 06/11');
  assert.equal(dayHeading('2026-11-05', '2026-11-06'), '05/11');
  assert.equal(dayHeading(null), 'Hôm nay');
});

test('the midnight delay is measured on the server clock, not the device clock', () => {
  const dayEndsAt = '2026-11-06T17:00:00.000Z';
  const clientNow = Date.parse('2026-11-06T16:30:00.000Z');

  // Device clock is correct: 30 minutes left.
  assert.equal(msUntilBoundary(dayEndsAt, { serverNow: clientNow, clientNow }), 30 * 60 * 1000);
  // Device clock is 10 minutes FAST: the real wait is 40 minutes.
  assert.equal(msUntilBoundary(dayEndsAt, { serverNow: clientNow - 600_000, clientNow }), 40 * 60 * 1000);
  // Device clock is 10 minutes SLOW: the real wait is 20 minutes.
  assert.equal(msUntilBoundary(dayEndsAt, { serverNow: clientNow + 600_000, clientNow }), 20 * 60 * 1000);
  // Already past midnight: never a negative timer.
  assert.equal(msUntilBoundary(dayEndsAt, { serverNow: clientNow + 3_600_000, clientNow }), 0);
  // No metadata yet: no timer at all.
  assert.equal(msUntilBoundary(null), null);
});

test('consecutive messages from the same person are grouped, others are not', () => {
  const base = { createdAt: '2026-11-06T10:00:00.000Z', user: { id: 1 } };
  assert.equal(isGrouped(base, { createdAt: '2026-11-06T10:00:30.000Z', user: { id: 1 } }), true);
  assert.equal(isGrouped(base, { createdAt: '2026-11-06T10:05:00.000Z', user: { id: 1 } }), false);
  assert.equal(isGrouped(base, { createdAt: '2026-11-06T10:00:30.000Z', user: { id: 2 } }), false);
  assert.equal(isGrouped(null, base), false);
});

test('time labels are HH:mm', () => {
  assert.match(timeLabel('2026-11-06T03:05:00.000Z'), /^\d{2}:\d{2}$/);
  assert.equal(timeLabel(null), '');
});
