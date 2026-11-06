'use strict';

/**
 * PRIVATE MEDIA — VIETNAM CALENDAR DAY
 *
 * The chat feed is "today only", and "today" must be the same instant for every
 * client. Browsers cannot be trusted for that: a laptop with a wrong clock, a
 * traveller in another timezone, or a tab that was asleep across midnight would
 * each compute a different boundary.
 *
 * So the server owns the day:
 *   - `dayKey()`     → 'YYYY-MM-DD' in Asia/Ho_Chi_Minh
 *   - `dayEndsAt()`  → the UTC instant of the next 00:00 Vietnam time
 *
 * Vietnam has been a fixed UTC+7 offset with no DST since 1975, so the boundary
 * is built from the explicit `+07:00` offset instead of relying on the host's
 * timezone database. The day *label* still goes through `Intl` with the real
 * zone name, so a future offset change would move the key and the boundary
 * together.
 */

const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const VN_OFFSET = '+07:00';
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const dayFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 'YYYY-MM-DD' for the given instant, in Vietnam time. */
function dayKey(at = new Date()) {
  const date = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(date.getTime())) throw new TypeError('dayKey: invalid date');
  const parts = dayFormatter.formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function isDayKey(value) {
  return typeof value === 'string' && DAY_PATTERN.test(value);
}

function assertDayKey(value) {
  if (!isDayKey(value)) throw new TypeError(`Invalid day key: ${value}`);
  return value;
}

/** First millisecond of the given Vietnam day, as a UTC instant. */
function dayStartsAt(day) {
  return new Date(`${assertDayKey(day)}T00:00:00${VN_OFFSET}`);
}

/** First millisecond of the NEXT Vietnam day (= the 00:00 rollover instant). */
function dayEndsAt(day) {
  return new Date(dayStartsAt(day).getTime() + DAY_MS);
}

/**
 * Everything a client needs to schedule its own midnight switch:
 * the authoritative day, when it ends, and the server clock it was measured on.
 */
function dayWindow(at = new Date()) {
  const date = at instanceof Date ? at : new Date(at);
  const day = dayKey(date);
  return {
    day,
    dayStartsAt: dayStartsAt(day).toISOString(),
    dayEndsAt: dayEndsAt(day).toISOString(),
    serverNow: date.getTime(),
  };
}

/** Milliseconds until the next Vietnam midnight (never negative). */
function msUntilNextDay(at = new Date()) {
  const date = at instanceof Date ? at : new Date(at);
  return Math.max(0, dayEndsAt(dayKey(date)).getTime() - date.getTime());
}

module.exports = {
  TIME_ZONE,
  VN_OFFSET,
  DAY_MS,
  dayKey,
  isDayKey,
  dayStartsAt,
  dayEndsAt,
  dayWindow,
  msUntilNextDay,
};
