/**
 * PRIVATE MEDIA — ACTIVE PLAYER OWNERSHIP
 *
 * Only ONE tab of a given account may render the YouTube player. Without this,
 * two tabs of the same user both register as "the player", both report ENDED and
 * both play audio on top of each other.
 *
 * The lease is cooperative and browser-local:
 *   - `BroadcastChannel` shares intent between tabs of the same origin
 *   - a heartbeat (2s) with a 7s expiry lets a crashed tab be replaced quickly
 *   - `takeover` lets the user move playback to the tab they are looking at
 *
 * It is NOT a security boundary — the server remains authoritative for state.
 */

const CHANNEL_NAME = 'workrank:private-media:player-owner';
const HEARTBEAT_MS = 2000;
const LEASE_MS = 7000;
const CLAIM_WAIT_MS = 320;

function randomTabId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @returns {{ tabId: string, subscribe: (fn: (state: object) => void) => () => void,
 *   claim: (opts?: { takeover?: boolean }) => void, release: () => void,
 *   start: () => void, stop: () => void, state: () => object }}
 */
export function createPlayerOwnership() {
  const tabId = randomTabId();
  const listeners = new Set();
  let channel = null;
  let heartbeatTimer = null;
  let expiryTimer = null;
  let started = false;

  let ownerId = null;      // tab id of the current owner (null = free)
  let lastSeen = 0;        // last heartbeat from the owner
  let lastBeatAt = 0;      // when THIS tab last sent a heartbeat
  let selfOwner = false;

  const state = () => ({
    tabId,
    ownerId,
    isOwner: selfOwner,
    otherTab: Boolean(ownerId && ownerId !== tabId),
  });

  const emit = () => {
    const snapshot = state();
    listeners.forEach((fn) => {
      try { fn(snapshot); } catch { /* a listener must not break the lease */ }
    });
  };

  const post = (message) => {
    try { channel?.postMessage({ ...message, tabId, at: Date.now() }); } catch { /* channel closed */ }
  };

  const becomeOwner = () => {
    if (selfOwner) return;
    selfOwner = true;
    ownerId = tabId;
    lastSeen = Date.now();
    lastBeatAt = Date.now();
    post({ type: 'owner' });
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (!selfOwner) return;
      lastSeen = Date.now();
      lastBeatAt = Date.now();
      post({ type: 'heartbeat' });
    }, HEARTBEAT_MS);
    emit();
  };

  const stepDown = () => {
    if (!selfOwner) return;
    selfOwner = false;
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    post({ type: 'release' });
    emit();
  };

  const claim = ({ takeover = false } = {}) => {
    if (selfOwner) return;
    if (takeover) { becomeOwner(); return; }
    if (ownerId && ownerId !== tabId && Date.now() - lastSeen < LEASE_MS) {
      post({ type: 'claim' });
      return;
    }
    // Ask if anybody is there; if no live owner answers, take the lease.
    post({ type: 'claim' });
    setTimeout(() => {
      if (selfOwner) return;
      if (ownerId && ownerId !== tabId && Date.now() - lastSeen < LEASE_MS) return;
      becomeOwner();
    }, CLAIM_WAIT_MS);
  };

  const release = () => {
    if (selfOwner) stepDown();
  };

  const onMessage = (event) => {
    const data = event?.data || {};
    if (!data.type || data.tabId === tabId) return;

    if (data.type === 'claim') {
      // Answer only while the lease is actually alive.
      if (selfOwner) {
        lastSeen = Date.now();
        post({ type: 'owner' });
      }
      return;
    }
    if (data.type === 'owner' || data.type === 'heartbeat') {
      ownerId = data.tabId;
      lastSeen = Date.now();
      // Two tabs must never both render a player. If this tab still believes it
      // owns the lease but has not sent a heartbeat recently, it was frozen or
      // suspended — yield to the tab that is actually alive.
      if (selfOwner && data.type === 'owner' && Date.now() - lastBeatAt > HEARTBEAT_MS * 2) stepDown();
      emit();
      return;
    }
    if (data.type === 'takeover') {
      if (selfOwner) stepDown();
      ownerId = data.tabId;
      lastSeen = Date.now();
      emit();
      return;
    }
    if (data.type === 'release') {
      if (ownerId === data.tabId) {
        ownerId = null;
        lastSeen = 0;
        emit();
      }
    }
  };

  const start = () => {
    if (started) return;
    started = true;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.addEventListener('message', onMessage);
    }
    // A tab that loses the lease (crash, force-close) must not block forever.
    expiryTimer = setInterval(() => {
      if (selfOwner) return;
      if (ownerId && Date.now() - lastSeen > LEASE_MS) {
        ownerId = null;
        lastSeen = 0;
        emit();
      }
    }, 1500);
    claim();
  };

  const stop = () => {
    if (!started) return;
    started = false;
    release();
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (expiryTimer) clearInterval(expiryTimer);
    heartbeatTimer = null;
    expiryTimer = null;
    channel?.removeEventListener?.('message', onMessage);
    channel?.close?.();
    channel = null;
  };

  const subscribe = (fn) => {
    listeners.add(fn);
    fn(state());
    return () => listeners.delete(fn);
  };

  return {
    tabId,
    start,
    stop,
    claim: (options) => {
      if (options?.takeover) post({ type: 'takeover' });
      claim(options);
    },
    release,
    subscribe,
    state,
  };
}
