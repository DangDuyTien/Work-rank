/**
 * CHAT CHUNG — FEED RULES
 *
 * Pure helpers, no React and no DOM, so the tricky parts (ordering, dedupe,
 * midnight) can be unit-tested without a browser.
 *
 * The server is the authority for the day and for message ids. The client only
 * has to obey two rules:
 *   - the feed is ordered by id, never by arrival time
 *   - a message stamped with another day is not part of today's feed
 */

/** Keep the DOM light on a long day; the server keeps everything. */
export const MAX_FEED = 400;

export function messageId(message) {
  return Number(message?.id) || 0;
}

/**
 * Union of the messages already on screen and the ones that just arrived,
 * deduplicated by id and sorted ascending. Socket delivery, REST catch-up and
 * the initial page can therefore overlap freely without duplicating a row.
 */
export function mergeMessages(current = [], incoming = [], { max = MAX_FEED } = {}) {
  const seen = new Set();
  const all = [];
  for (const message of [...current, ...incoming]) {
    const id = messageId(message);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    all.push(message);
  }
  all.sort((a, b) => messageId(a) - messageId(b));
  return all.length > max ? all.slice(all.length - max) : all;
}

/** True when a message belongs to a different calendar day than the open feed. */
export function isStaleDay(messageDay, currentDay) {
  if (!messageDay || !currentDay) return false;
  return String(messageDay) !== String(currentDay);
}

/** 'YYYY-MM-DD' → 'dd/MM' (empty string when the server has not answered yet). */
export function dayLabel(day) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ''));
  if (!match) return '';
  return `${match[3]}/${match[2]}`;
}

/** Heading above the first message of the day. */
export function dayHeading(day, today = day) {
  const label = dayLabel(day);
  if (!label) return 'Hôm nay';
  return day && today && day === today ? `Hôm nay · ${label}` : label;
}

/**
 * Milliseconds until the server's next midnight.
 *
 * `serverNow`/`clientNow` correct a device whose clock is off: a laptop five
 * minutes ahead would otherwise clear the feed five minutes early.
 */
export function msUntilBoundary(dayEndsAt, { serverNow, clientNow } = {}) {
  const end = new Date(dayEndsAt || 0).getTime();
  if (!Number.isFinite(end) || end <= 0) return null;
  const skew = Number.isFinite(serverNow) && Number.isFinite(clientNow) ? serverNow - clientNow : 0;
  return Math.max(0, end - (clientNow + skew));
}

/** HH:mm in the viewer's locale — the day itself is already fixed by the server. */
export function timeLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Two messages from the same person within two minutes are visually grouped. */
export function isGrouped(previous, message) {
  if (!previous || !message) return false;
  if (Number(previous.user?.id) !== Number(message.user?.id)) return false;
  const gap = new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime();
  return Number.isFinite(gap) && gap >= 0 && gap < 120_000;
}
