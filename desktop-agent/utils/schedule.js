'use strict';

/**
 * Desktop Agent Working Hours Schedule
 * Timezone: Asia/Ho_Chi_Minh
 * Working Hours: 08:00 -> 17:30
 */

const TIMEZONE = 'Asia/Ho_Chi_Minh';
const START_MINUTE_OF_DAY = 8 * 60; // 08:00 (480)
const END_MINUTE_OF_DAY = 17 * 60 + 30; // 17:30 (1050)

function getVietnamTimeParts(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour12: false,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });

  const parts = formatter.formatToParts(d);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const second = parseInt(parts.find((p) => p.type === 'second')?.value || '0', 10);

  const minuteOfDay = hour * 60 + minute;
  return { hour, minute, second, minuteOfDay };
}

function isWithinWorkingSchedule(date = new Date()) {
  const { minuteOfDay } = getVietnamTimeParts(date);
  return minuteOfDay >= START_MINUTE_OF_DAY && minuteOfDay < END_MINUTE_OF_DAY;
}

module.exports = {
  TIMEZONE,
  isWithinWorkingSchedule,
  getVietnamTimeParts,
};
