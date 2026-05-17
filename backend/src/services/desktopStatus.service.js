/**
 * In-memory registry of desktop app heartbeats.
 * Desktop apps POST a heartbeat every ~10s via /api/activity/desktop-status.
 * The web frontend can GET /api/activity/desktop-status to check if the user's
 * desktop tracker is currently online and optionally send start/stop commands
 * through Socket.IO.
 */

const ONLINE_THRESHOLD_MS = 20_000; // consider desktop offline after 20s without heartbeat

// userId → { lastHeartbeat, tracking, trackingStartedAt, sessionId, deviceUuid, deviceName, platform, error }
const registry = new Map();

/**
 * Record a heartbeat from the desktop app.
 */
function heartbeat(userId, payload = {}) {
  registry.set(String(userId), {
    lastHeartbeat: Date.now(),
    tracking: !!payload.tracking,
    trackingStartedAt: payload.tracking && payload.trackingStartedAt ? payload.trackingStartedAt : null,
    sessionId: payload.tracking && payload.sessionId ? payload.sessionId : null,
    deviceUuid: payload.deviceUuid || null,
    deviceName: payload.deviceName || null,
    platform: payload.platform || null,
    appVersion: payload.appVersion || null,
    error: payload.error || null,
  });
}

/**
 * Return the current desktop status for a user.
 */
function getStatus(userId) {
  const entry = registry.get(String(userId));
  if (!entry) return { online: false, tracking: false };

  const online = Date.now() - entry.lastHeartbeat < ONLINE_THRESHOLD_MS;
  if (!online) {
    registry.delete(String(userId));
    return { online: false, tracking: false };
  }

  return {
    online: true,
    tracking: entry.tracking,
    trackingStartedAt: entry.trackingStartedAt,
    sessionId: entry.sessionId,
    deviceUuid: entry.deviceUuid,
    deviceName: entry.deviceName,
    platform: entry.platform,
    error: entry.error,
    lastHeartbeat: new Date(entry.lastHeartbeat).toISOString(),
  };
}

function activeUserIds() {
  const ids = [];
  for (const userId of registry.keys()) {
    if (getStatus(userId).online) ids.push(userId);
  }
  return ids;
}

module.exports = { activeUserIds, heartbeat, getStatus };
