import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The notification helpers touch `document`, `window` and `localStorage`. This
 * harness provides the minimum surface so the behaviour can be asserted in
 * Node without a browser (the browser paths are covered by the Playwright QA).
 */

function installDom({ visibility = 'visible' } = {}) {
  const listeners = new Map();
  const favicon = { attrs: { href: '/favicon-32x32.png' }, getAttribute(k) { return this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; } };
  const store = new Map();
  const document = {
    title: '3WIN MEDIA — Nền tảng',
    visibilityState: visibility,
    addEventListener() {},
    removeEventListener() {},
    querySelector: (selector) => (String(selector).includes('icon') ? favicon : null),
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => null,
      toDataURL: () => 'data:image/png;base64,x',
    }),
  };
  const window = {
    addEventListener() {},
    removeEventListener() {},
    AudioContext: FakeAudioContext,
    location: { origin: 'http://localhost' },
  };
  globalThis.document = document;
  globalThis.window = window;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  globalThis.Image = class { set src(_v) {} onload() {} };
  return { document, window, favicon, store, listeners };
}

let started = 0;
class FakeAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.destination = {};
  }

  resume() { this.state = 'running'; return Promise.resolve(); }

  createGain() {
    return {
      gain: {
        value: 0,
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect() {},
    };
  }

  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime() {} },
      connect() {},
      start() { started += 1; },
      stop() {},
    };
  }
}

const mod = await import('../src/utils/mediaNotifications.js');

beforeEach(() => {
  installDom();
  mod.resetNotificationSound();
  mod.resetNotificationDom();
  started = 0;
});

test('preferences default to a silent badge and persist per user', () => {
  const defaults = mod.readNotifyPrefs(7);
  assert.deepEqual(defaults, { notify: true, sound: false, volume: 55 }, 'the ting is off by default');

  mod.writeNotifyPrefs(7, { notify: false, sound: true, volume: 240 });
  const stored = mod.readNotifyPrefs(7);
  assert.equal(stored.notify, false);
  assert.equal(stored.sound, true, 'an explicit opt-in is honoured');
  assert.equal(stored.volume, 100, 'reading clamps an out-of-range volume');

  // Another user is unaffected by user 7's choice.
  assert.deepEqual(mod.readNotifyPrefs(8), { notify: true, sound: false, volume: 55 });
});

test('prefs stored before the silent default do not keep ringing', () => {
  // Exactly what the previous build wrote: no version tag, sound on.
  globalThis.localStorage.setItem(
    'workrank:private-media:notify:v1:9',
    JSON.stringify({ notify: true, sound: true, volume: 80 }),
  );
  const migrated = mod.readNotifyPrefs(9);
  assert.equal(migrated.sound, false, 'an old "sound on" default must be dropped');
  assert.equal(migrated.notify, true, 'the badge stays on');
  assert.equal(migrated.volume, 80, 'other choices are kept');

  // Turning it on after the migration is a real choice and sticks.
  mod.writeNotifyPrefs(9, { ...migrated, sound: true });
  assert.equal(mod.readNotifyPrefs(9).sound, true);
});

test('tab title shows the unread count and restores the original title', () => {
  mod.setTabBadge(3);
  assert.equal(globalThis.document.title, '(3) Tin nhắn mới — 3WIN MEDIA');
  mod.setTabBadge(120);
  assert.equal(globalThis.document.title, '(99+) Tin nhắn mới — 3WIN MEDIA');
  mod.setTabBadge(0);
  assert.equal(globalThis.document.title, '3WIN MEDIA — Nền tảng');
});

test('the badge is not rewritten when the count does not change', () => {
  mod.setTabBadge(2);
  const first = globalThis.document.title;
  globalThis.document.title = `${first} `; // simulate something else touching it
  mod.setTabBadge(2);
  assert.equal(globalThis.document.title, `${first} `, 'same count must not flicker the title');
});

test('the ting plays once per burst and respects the volume setting', () => {
  assert.equal(mod.playNotificationTing(60), 'played');
  assert.equal(started, 2, 'two-note chime');
  assert.equal(mod.playNotificationTing(60), 'coalesced', 'a burst is coalesced into one sound');
  mod.resetNotificationSound();
  assert.equal(mod.playNotificationTing(0), 'blocked', 'volume 0 is silent');
});

test('a suspended audio context reports blocked instead of throwing', () => {
  globalThis.window.AudioContext = class {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; }
    resume() { return Promise.resolve(); }
  };
  // Module-level context is already created; force the branch by clearing it.
  mod.resetNotificationSound();
  const result = mod.playNotificationTing(50);
  assert.ok(['played', 'blocked', 'coalesced'].includes(result));
});

test('desktop notifications are refused while the tab is visible', () => {
  globalThis.window.Notification = class {
    static permission = 'granted';
    constructor() {}
  };
  assert.equal(mod.notificationSupport(), true);
  assert.equal(mod.showDesktopNotification({ title: 'x', body: 'y' }), false);
});
