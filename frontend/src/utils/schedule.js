/**
 * WorkRank Schedule Helper (Frontend)
 * Timezone: Asia/Ho_Chi_Minh
 * Working Hours: 08:00 -> 17:30 (Mon - Sun)
 */

export const TIMEZONE = 'Asia/Ho_Chi_Minh';
export const START_HOUR = 8;
export const START_MINUTE = 0;
export const END_HOUR = 17;
export const END_MINUTE = 30;

export const START_MINUTE_OF_DAY = START_HOUR * 60 + START_MINUTE; // 480
export const END_MINUTE_OF_DAY = END_HOUR * 60 + END_MINUTE; // 1050

export function getVietnamTimeParts(date = new Date()) {
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
    minute,
    second,
    dateStr,
    timeStr,
    minuteOfDay,
    rawDate: d,
  };
}

export function isWithinWorkingSchedule(date = new Date()) {
  const { minuteOfDay } = getVietnamTimeParts(date);
  return minuteOfDay >= START_MINUTE_OF_DAY && minuteOfDay < END_MINUTE_OF_DAY;
}

export function computeTrackingState({ isAuthenticated = true, isWebOpen = true, date = new Date() } = {}) {
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
