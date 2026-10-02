'use strict';

/**
 * WorkRank Unified Working Hours Schedule
 * Timezone: Asia/Ho_Chi_Minh (UTC+7)
 * Working Hours: 08:00:00 -> 17:30:00 (Mon - Sun)
 *
 * Logic:
 * - 08:00:00 -> 17:29:59: TRACKING_ACTIVE
 * - 17:30:00 -> 23:59:59: TRACKING_OUTSIDE_SCHEDULE
 * - 00:00:00 -> 07:59:59: TRACKING_OUTSIDE_SCHEDULE
 */

const TIMEZONE = 'Asia/Ho_Chi_Minh';
const START_HOUR = 8;
const START_MINUTE = 0; // 08:00 (480 minutes from 00:00)
const END_HOUR = 17;
const END_MINUTE = 30; // 17:30 (1050 minutes from 00:00)

const START_MINUTE_OF_DAY = START_HOUR * 60 + START_MINUTE; // 480
const END_MINUTE_OF_DAY = END_HOUR * 60 + END_MINUTE; // 1050

const SCHEDULE_METADATA = Object.freeze({
  timezone: TIMEZONE,
  startHour: START_HOUR,
  startMinute: START_MINUTE,
  endHour: END_HOUR,
  endMinute: END_MINUTE,
  workingHours: '08:00 - 17:30',
});

/**
 * Extract time components in Asia/Ho_Chi_Minh timezone
 */
function getVietnamTimeParts(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = formatter.formatToParts(d);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const second = parseInt(parts.find((p) => p.type === 'second')?.value || '0', 10);
  const year = parts.find((p) => p.type === 'year')?.value || '2026';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';

  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
  const minuteOfDay = hour * 60 + minute;

  return {
    hour,
    hours: hour,
    minute,
    minutes: minute,
    second,
    seconds: second,
    dateStr,
    timeStr,
    minuteOfDay,
    rawDate: d,
  };
}

/**
 * Check if a date/timestamp falls strictly within 08:00 -> 17:30 Asia/Ho_Chi_Minh
 */
function isWithinWorkingSchedule(date = new Date()) {
  const { minuteOfDay } = getVietnamTimeParts(date);
  return minuteOfDay >= START_MINUTE_OF_DAY && minuteOfDay < END_MINUTE_OF_DAY;
}

/**
 * Get canonical tracking state based on schedule and auth/web status
 */
function getTrackingState(options = {}) {
  const isAuthenticated = options.isAuthenticated !== undefined
    ? options.isAuthenticated
    : (options.isLoggedIn !== undefined ? options.isLoggedIn : true);
  const isWebOpen = options.isWebOpen !== undefined ? options.isWebOpen : true;
  const date = options.date || new Date();

  if (!isAuthenticated) {
    return 'TRACKING_LOGGED_OUT';
  }
  if (!isWebOpen) {
    return 'TRACKING_WEB_CLOSED';
  }
  if (!isWithinWorkingSchedule(date)) {
    return 'TRACKING_OUTSIDE_SCHEDULE';
  }
  return 'TRACKING_ACTIVE';
}

module.exports = {
  TIMEZONE,
  START_HOUR,
  START_MINUTE,
  END_HOUR,
  END_MINUTE,
  START_MINUTE_OF_DAY,
  END_MINUTE_OF_DAY,
  SCHEDULE_METADATA,
  getVietnamTimeParts,
  isWithinWorkingSchedule,
  getTrackingState,
};
