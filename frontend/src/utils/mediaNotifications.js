/**
 * PRIVATE MEDIA — CHAT NOTIFICATIONS (tab title, favicon, sound, desktop)
 *
 * Deliberately small and dependency-free. Nothing here touches the media
 * element: the "ting" is a Web Audio beep, so the YouTube player keeps its own
 * volume and is never paused, ducked or re-routed.
 *
 * Browser policy notes (stated honestly, not worked around):
 *   - AudioContext starts suspended until a user gesture. We resume it on the
 *     first real interaction; before that a message is silent, never a crash.
 *   - `Notification` requires an explicit permission prompt. We only ask from a
 *     button the user pressed.
 *   - A page that is fully closed cannot be notified without a service worker
 *     and push infrastructure, which is out of scope here.
 */

const TING_GAP_MS = 900;          // coalesce bursts into one sound
const TITLE_APP_NAME = '3WIN MEDIA';
const STORAGE_PREFIX = 'workrank:private-media:notify:v1:';

export const DEFAULT_NOTIFY_PREFS = Object.freeze({
  notify: true,   // tab title / favicon / desktop notification
  sound: true,    // the "ting"
  volume: 55,     // 0..100
});

function storageKey(userId) {
  return `${STORAGE_PREFIX}${userId ?? 'anon'}`;
}

export function readNotifyPrefs(userId) {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(userId)));
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_NOTIFY_PREFS };
    return {
      notify: raw.notify !== false,
      sound: raw.sound !== false,
      volume: Math.max(0, Math.min(100, Number.isFinite(Number(raw.volume)) ? Number(raw.volume) : DEFAULT_NOTIFY_PREFS.volume)),
    };
  } catch {
    return { ...DEFAULT_NOTIFY_PREFS };
  }
}

export function writeNotifyPrefs(userId, prefs) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(prefs));
  } catch { /* private mode: preferences stay in memory for this session */ }
  return prefs;
}

// ── Sound ───────────────────────────────────────────────────────────────────

let audioContext = null;
let lastTingAt = 0;
let unlockBound = false;

function ensureContext() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) {
    try { audioContext = new Ctor(); } catch { audioContext = null; }
  }
  return audioContext;
}

/** Call from a real user gesture so later notifications are allowed to sound. */
export function unlockNotificationAudio() {
  const ctx = ensureContext();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

/** Install a one-shot gesture listener (idempotent). */
export function bindAudioUnlock() {
  if (unlockBound || typeof window === 'undefined') return () => {};
  unlockBound = true;
  const handler = () => {
    unlockNotificationAudio();
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('keydown', handler);
    window.removeEventListener('touchstart', handler);
  };
  window.addEventListener('pointerdown', handler, { passive: true });
  window.addEventListener('keydown', handler);
  window.addEventListener('touchstart', handler, { passive: true });
  return () => {
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('keydown', handler);
    window.removeEventListener('touchstart', handler);
  };
}

/**
 * A short two-note "ting" (E6 → B6) with a soft exponential decay. Synthesised
 * at runtime: no third-party audio asset, nothing copied from another app.
 *
 * @returns {'played'|'coalesced'|'blocked'|'unsupported'}
 */
export function playNotificationTing(volume = DEFAULT_NOTIFY_PREFS.volume) {
  const now = Date.now();
  if (now - lastTingAt < TING_GAP_MS) return 'coalesced';
  const ctx = ensureContext();
  if (!ctx) return 'unsupported';
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
    if (ctx.state === 'suspended') return 'blocked';
  }
  const level = Math.max(0, Math.min(100, Number(volume) || 0)) / 100;
  if (level <= 0) return 'blocked';

  const start = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 0.0001;
  master.connect(ctx.destination);
  master.gain.setValueAtTime(0.0001, start);
  master.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.16 * level), start + 0.012);
  master.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);

  [
    { freq: 1318.5, delay: 0, duration: 0.34, gain: 1 },
    { freq: 1975.5, delay: 0.085, duration: 0.3, gain: 0.62 },
  ].forEach((note) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(note.freq, start + note.delay);
    gain.gain.setValueAtTime(0.0001, start + note.delay);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.9 * note.gain), start + note.delay + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.delay + note.duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start + note.delay);
    osc.stop(start + note.delay + note.duration + 0.02);
  });

  lastTingAt = now;
  return 'played';
}

/** Test seam. */
export function resetNotificationSound() {
  lastTingAt = 0;
}

// ── Tab title + favicon ─────────────────────────────────────────────────────

let baseTitle = null;
let baseFaviconHref = null;
let badgeCount = 0;

function titleFor(count) {
  if (!count) return baseTitle;
  return `(${count > 99 ? '99+' : count}) Tin nhắn mới — ${TITLE_APP_NAME}`;
}

export function setTabBadge(count) {
  if (typeof document === 'undefined') return;
  const next = Math.max(0, Number(count) || 0);
  if (next === badgeCount && baseTitle) return;
  if (baseTitle == null) baseTitle = document.title;
  badgeCount = next;
  const title = titleFor(next);
  if (title && document.title !== title) document.title = title;
  setFaviconBadge(next);
}

function faviconLink() {
  if (typeof document === 'undefined') return null;
  return document.querySelector('link[rel="icon"][type="image/png"]')
    || document.querySelector('link[rel="icon"]');
}

/**
 * A tiny red dot with the count, painted over the existing favicon. Cheap: one
 * canvas, only when the count actually changes.
 */
export function setFaviconBadge(count) {
  const link = faviconLink();
  if (!link) return;
  if (baseFaviconHref == null) baseFaviconHref = link.getAttribute('href') || '/favicon.ico';
  const next = Math.max(0, Number(count) || 0);
  if (!next) {
    if (link.getAttribute('href') !== baseFaviconHref) link.setAttribute('href', baseFaviconHref);
    return;
  }
  if (typeof document === 'undefined' || typeof Image === 'undefined') return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, size, size);
      ctx.beginPath();
      ctx.arc(size - 16, 16, 15, 0, Math.PI * 2);
      ctx.fillStyle = '#dc2626';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(next > 9 ? '9+' : String(next), size - 16, 17);
      link.setAttribute('href', canvas.toDataURL('image/png'));
    } catch { /* tainted canvas or no 2d context: title badge still works */ }
  };
  img.src = baseFaviconHref;
}

// ── Desktop notification ────────────────────────────────────────────────────

function notificationCtor() {
  if (typeof window === 'undefined') return null;
  return window.Notification || null;
}

export function notificationSupport() {
  return Boolean(notificationCtor());
}

export function notificationPermission() {
  const Ctor = notificationCtor();
  if (!Ctor) return 'unsupported';
  return Ctor.permission;
}

/** Only call from a user gesture (a button), never on mount. */
export async function requestNotificationPermission() {
  const Ctor = notificationCtor();
  if (!Ctor) return 'unsupported';
  if (Ctor.permission === 'granted') return 'granted';
  if (Ctor.permission === 'denied') return 'denied';
  try {
    return await Ctor.requestPermission();
  } catch {
    return 'denied';
  }
}

/**
 * Show a system notification. Returns false when it was not shown, so callers
 * never claim a notification happened when the browser refused.
 */
export function showDesktopNotification({ title, body, tag, icon, onClick } = {}) {
  const Ctor = notificationCtor();
  if (!Ctor || Ctor.permission !== 'granted') return false;
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return false;
  try {
    const note = new Ctor(title || `${TITLE_APP_NAME} · Nghe chung`, {
      body: body || '',
      tag: tag || 'workrank-private-media-chat',
      icon: icon || '/favicon-192x192.png',
      silent: true, // the app plays its own "ting"
      renotify: false,
    });
    note.onclick = () => {
      try { window.focus(); } catch { /* some platforms refuse */ }
      try { onClick?.(); } catch { /* navigation must not throw */ }
      note.close();
    };
    return true;
  } catch {
    return false;
  }
}

/** Test seam: forget cached DOM state. */
export function resetNotificationDom() {
  baseTitle = null;
  baseFaviconHref = null;
  badgeCount = 0;
}
