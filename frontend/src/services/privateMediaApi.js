import api from './api';

/**
 * PRIVATE MEDIA API CLIENT
 *
 * Every call here is authorized server-side. This module holds no permission
 * logic of its own: a 404 means "you cannot see this", and the UI treats it as
 * "capability not available" rather than rendering an error.
 */

const BASE = '/api/private-media';

// Which playback session this tab talks to. 'private' is the default: every
// account has its own. 'shared' joins the one listening room everybody shares.
let roomMode = 'private';

/** Called by the page when the owner switches between private and the room. */
export function setPrivateMediaRoom(mode) {
  roomMode = mode === 'shared' ? 'shared' : 'private';
  return roomMode;
}

export function getPrivateMediaRoom() {
  return roomMode;
}

// Attach the room to every private-media request; other modules are untouched.
api.interceptors.request.use((config) => {
  if (typeof config.url === 'string' && config.url.startsWith(BASE)) {
    config.headers = config.headers || {};
    config.headers['X-PM-Room'] = roomMode;
  }
  return config;
});

function isConcealed(error) {
  return error?.response?.status === 404;
}

function messageFrom(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function codeFrom(error) {
  return error?.response?.data?.code || 'ERROR';
}

export const privateMediaApi = {
  /** Capability probe. Returns { entitled:false } when the caller has no access. */
  async getAccess() {
    try {
      const res = await api.get(`${BASE}/access`);
      return res.data;
    } catch (error) {
      if (isConcealed(error)) return { entitled: false };
      throw error;
    }
  },

  async getStatus() {
    const res = await api.get(`${BASE}/status`);
    return res.data;
  },

  async getSession() {
    const res = await api.get(`${BASE}/session`);
    return res.data;
  },

  async sendCommand({ commandId, action, payload }) {
    const res = await api.post(`${BASE}/commands`, { commandId, action, payload });
    return res.data;
  },

  async searchYouTube(query, limit = 12) {
    const res = await api.get(`${BASE}/youtube/search`, { params: { q: query, limit } });
    return res.data;
  },

  async resolveYouTube(input) {
    const res = await api.post(`${BASE}/youtube/resolve`, { input });
    return res.data;
  },

  /** Recently loaded videos — works without a YouTube API key. */
  async getRecent(limit = 12) {
    const res = await api.get(`${BASE}/recent`, { params: { limit } });
    return res.data;
  },

  async listGrants() {
    const res = await api.get(`${BASE}/grants`);
    return res.data;
  },

  async createGrant(payload) {
    const res = await api.post(`${BASE}/grants`, payload);
    return res.data;
  },

  async revokeGrant(userId) {
    const res = await api.delete(`${BASE}/grants/${userId}`);
    return res.data;
  },

  async searchUsers(query) {
    const res = await api.get(`${BASE}/users/search`, { params: { q: query } });
    return res.data;
  },

  async getTelegram() {
    const res = await api.get(`${BASE}/telegram`);
    return res.data;
  },

  async createTelegramCode() {
    const res = await api.post(`${BASE}/telegram/code`, {});
    return res.data;
  },

  async unbindTelegram() {
    const res = await api.delete(`${BASE}/telegram`);
    return res.data;
  },

  async listDevices() {
    const res = await api.get(`${BASE}/devices`);
    return res.data;
  },

  async createDeviceCode(label) {
    const res = await api.post(`${BASE}/devices/code`, { label });
    return res.data;
  },

  async revokeDevice(id) {
    const res = await api.delete(`${BASE}/devices/${id}`);
    return res.data;
  },

  async listAudit(limit = 40) {
    const res = await api.get(`${BASE}/audit`, { params: { limit } });
    return res.data;
  },
};

export { isConcealed, messageFrom, codeFrom, BASE as PRIVATE_MEDIA_BASE };
