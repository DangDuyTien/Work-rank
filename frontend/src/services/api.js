import axios from 'axios';
import { calculateRankScore } from '../utils/scoring';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

const AUTH_UPDATED_EVENT = 'workrank:auth-updated';
const AUTH_EXPIRED_EVENT = 'workrank:auth-expired';
let refreshPromise = null;

function storeAuth(data) {
  const token = data.accessToken || data.token;
  if (token) localStorage.setItem('token', token);
  if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
  if (token) window.dispatchEvent(new CustomEvent(AUTH_UPDATED_EVENT, { detail: { token } }));
  return token;
}

function clearAuth(options = {}) {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  window.dispatchEvent(new CustomEvent(AUTH_UPDATED_EVENT, { detail: { token: null } }));
  if (options.expired) {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, {
      detail: {
        message: options.message || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      },
    }));
  }
}

function isAuthEndpoint(url = '') {
  return ['/api/auth/login', '/api/auth/register', '/api/auth/refresh-token'].some((path) => String(url).includes(path));
}

async function refreshStoredAuth() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('Missing refresh token');

  if (!refreshPromise) {
    refreshPromise = axios.post('/api/auth/refresh-token', { refreshToken }, {
      baseURL: import.meta.env.VITE_API_URL || '',
    }).then((res) => storeAuth(res.data)).finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

function unwrapArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function toBoolean(value) {
  if (value === true || value === 1 || value === '1') return true;
  if (typeof value === 'string' && value.toLowerCase() === 'true') return true;
  return false;
}

function normalizeVerified(user = {}, row = {}) {
  const safeUser = user || {};
  const safeRow = row || {};
  return toBoolean(safeUser.isVerified ?? safeUser.is_verified ?? safeRow.isVerified ?? safeRow.is_verified ?? safeRow.verified);
}

function normalizeLeaderboardRow(row, index = 0) {
  if (!row) {
    return {
      user_id: null,
      id: null,
      name: 'Unknown User',
      email: '',
      role: 'user',
      avatarData: null,
      avatarUrl: '',
      photoUrl: '',
      imageUrl: '',
      featuredBadges: [],
      isVerified: false,
      verified: false,
      accountStatus: 'active',
      status: 'offline',
      rank: index + 1,
      focusScore: 0,
      score: 0,
      total_keystrokes: 0,
      total_mouse_clicks: 0,
      total_active_seconds: 0,
      total_idle_seconds: 0,
      lifetimeKeystrokeCount: 0,
      lifetimeMouseClickCount: 0,
      lifetimeActions: 0,
      level: 0,
      keystrokes: 0,
      mouse_clicks: 0,
      active_seconds: 0,
      idle_seconds: 0,
    };
  }
  const user = row.User || row.user || row;
  const activeSeconds = Number(row.activeSeconds ?? row.active_seconds ?? row.total_active_seconds ?? 0);
  const idleSeconds = Number(row.idleSeconds ?? row.idle_seconds ?? row.total_idle_seconds ?? 0);
  const keystrokes = Number(row.keystrokeCount ?? row.keystrokes ?? row.total_keystrokes ?? 0);
  const clicks = Number(row.mouseClickCount ?? row.mouse_clicks ?? row.total_mouse_clicks ?? 0);
  const lifetimeKeystrokeCount = Number(row.lifetimeKeystrokeCount ?? row.lifetime_keystroke_count ?? row.total_lifetime_keystrokes ?? 0);
  const lifetimeMouseClickCount = Number(row.lifetimeMouseClickCount ?? row.lifetime_mouse_click_count ?? row.total_lifetime_mouse_clicks ?? 0);
  const lifetimeActions = Number(row.lifetimeActions ?? row.lifetime_actions ?? (lifetimeKeystrokeCount + lifetimeMouseClickCount));
  const level = Number(row.level ?? row.userLevel ?? row.user_level ?? 0);
  const focusScore = Number(row.focusScore ?? row.focus_score ?? 0);
  const fallbackScore = calculateRankScore({
    activeSeconds,
    idleSeconds,
    keystrokeCount: keystrokes,
    mouseClickCount: clicks,
    focusScore,
  });
  const score = Number(row.score ?? fallbackScore);
  return {
    ...row,
    user_id: user?.id ?? row.userId ?? row.user_id,
    id: user?.id ?? row.userId ?? row.user_id,
    name: user?.name || row.name || 'Unknown User',
    email: user?.email || row.email || '',
    role: user?.role || row.role || 'user',
    avatarData: user?.avatarData || row.avatarData || user?.UserProfilePreference?.avatarData || row.UserProfilePreference?.avatarData || null,
    avatarUrl: user?.avatarUrl || row.avatarUrl || '',
    photoUrl: user?.photoUrl || row.photoUrl || '',
    imageUrl: user?.imageUrl || row.imageUrl || '',
    featuredBadges: Array.isArray(row.featuredBadges)
      ? row.featuredBadges
      : Array.isArray(row.featured_badges)
        ? row.featured_badges
        : Array.isArray(user?.featuredBadges)
          ? user.featuredBadges
          : [],
    isVerified: normalizeVerified(user, row),
    verified: normalizeVerified(user, row),
    accountStatus: user?.status || row.accountStatus || row.status || 'active',
    status: row.presence || row.presenceStatus || row.status || 'offline',
    rank: row.rankPosition || index + 1,
    focusScore,
    score,
    total_keystrokes: keystrokes,
    total_mouse_clicks: clicks,
    total_active_seconds: activeSeconds,
    total_idle_seconds: idleSeconds,
    lifetimeKeystrokeCount,
    lifetimeMouseClickCount,
    lifetimeActions,
    level,
    keystrokes,
    mouse_clicks: clicks,
    active_seconds: activeSeconds,
    idle_seconds: idleSeconds,
  };
}

function normalizeStat(row = {}) {
  return {
    ...row,
    total_keystrokes: Number(row.keystrokeCount ?? row.total_keystrokes ?? 0),
    total_mouse_clicks: Number(row.mouseClickCount ?? row.total_mouse_clicks ?? 0),
    total_active_seconds: Number(row.activeSeconds ?? row.total_active_seconds ?? 0),
    total_idle_seconds: Number(row.idleSeconds ?? row.total_idle_seconds ?? 0),
    score: Number(row.focusScore ?? row.score ?? 0),
  };
}

function normalizeUserSummary(user = {}) {
  return {
    ...user,
    user_id: user.id ?? user.userId ?? user.user_id,
    id: user.id ?? user.userId ?? user.user_id,
    isVerified: normalizeVerified(user),
    verified: normalizeVerified(user),
    isSimulated: toBoolean(user.isSimulated ?? user.is_simulated),
    accountStatus: user.accountStatus || user.status || 'active',
    status: user.presence || user.presenceStatus || user.status || 'offline',
    presence: user.presence || user.presenceStatus || user.status || 'offline',
    presenceStatus: user.presence || user.presenceStatus || user.status || 'offline',
  };
}

function normalizeFriendship(row = {}) {
  const friend = normalizeUserSummary(row.friend || row.user || {});
  return {
    ...row,
    id: row.id || row.friendshipId,
    friendshipId: row.friendshipId || row.id,
    friend,
  };
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config || {};
    if (err.response?.status === 401 && !original._retry && !isAuthEndpoint(original.url)) {
      try {
        original._retry = true;
        const token = await refreshStoredAuth();
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${token}` };
        return api(original);
      } catch {
        clearAuth({ expired: true });
      }
    } else if (err.response?.status === 401 && String(original.url || '').includes('/api/auth/refresh-token')) {
      clearAuth({ expired: true });
    }
    return Promise.reject(err);
  }
);

export const auth = {
  register: async (data) => { const res = await api.post('/api/auth/register', data); storeAuth(res.data); return res; },
  login: async (data) => { const res = await api.post('/api/auth/login', data); storeAuth(res.data); return res; },
  refreshSession: refreshStoredAuth,
  clearLocalSession: clearAuth,
  logout: async () => {
    try {
      return await api.post('/api/auth/logout');
    } finally {
      clearAuth();
    }
  },
  me: () => api.get('/api/auth/me'),
  updateProfile: (data) => api.patch('/api/auth/me', data),
  changePassword: (data) => api.patch('/api/auth/password', data),
};

export const activity = {
  today: async () => {
    const res = await api.get('/api/activity/me/today');
    return { ...res, data: normalizeStat(res.data?.stat || {}) };
  },
  userStats: async (id) => {
    const res = await api.get(`/api/reports/users/${id}/today`);
    const row = unwrapArray(res.data)[0] || {};
    return { ...res, data: normalizeStat(row) };
  },
  level: async (id) => {
    const res = await api.get(`/api/reports/users/${id}/level`, {
      params: { _: Date.now() },
      headers: { 'Cache-Control': 'no-cache' },
    });
    return { ...res, data: res.data?.data || res.data || {} };
  },
  timeline: async (id, date, granularity = 'hour') => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (granularity) params.set('granularity', granularity);
    params.set('timezoneOffsetMinutes', String(new Date().getTimezoneOffset()));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await api.get(`/api/reports/users/${id}/timeline${qs}`);
    return { ...res, data: unwrapArray(res.data) };
  },
  heatmap: async (id, days = 365) => {
    const res = await api.get(`/api/reports/users/${id}/heatmap?days=${days}`);
    return { ...res, data: unwrapArray(res.data) };
  },
  sessions: async (id, limit = 10) => {
    const res = await api.get(`/api/reports/users/${id}/sessions?limit=${limit}`);
    return { ...res, data: unwrapArray(res.data) };
  },
  weekly: async (id, limit = 12) => {
    const res = await api.get(`/api/reports/users/${id}/weekly?limit=${limit}`);
    return { ...res, data: unwrapArray(res.data) };
  },
  monthly: async (id, limit = 12) => {
    const res = await api.get(`/api/reports/users/${id}/monthly?limit=${limit}`);
    return { ...res, data: unwrapArray(res.data) };
  },
  desktopStatus: () => api.get('/api/activity/desktop-status', {
    headers: { 'Cache-Control': 'no-store' },
  }),
  desktopLaunch: (action, options = {}) => api.post('/api/activity/desktop-launch', {
    action,
    refreshToken: localStorage.getItem('refreshToken'),
    ...options,
  }),
};

export const dashboard = {
  overview: (range = 'today') => api.get(`/api/dashboard/overview?range=${range}`),
  realtimeUsers: () => api.get('/api/dashboard/realtime-users'),
};

export const leaderboard = {
  get: async (range = 'daily', options = {}) => {
    const apiRange = range === 'today' ? 'daily' : range === 'week' ? 'weekly' : range === 'month' ? 'monthly' : range === 'year' ? 'yearly' : range;
    const params = new URLSearchParams();
    if (options.page) params.set('page', String(options.page));
    if (options.limit) params.set('limit', String(options.limit));
    if (options.search) params.set('search', String(options.search));
    const qs = params.toString();
    const res = await api.get(`/api/leaderboard/${apiRange}${qs ? `?${qs}` : ''}`);
    return {
      ...res,
      data: unwrapArray(res.data).map(normalizeLeaderboardRow),
      currentUserRank: res.data?.currentUserRank ? normalizeLeaderboardRow(res.data.currentUserRank) : null,
      totalRanked: Number(res.data?.totalRanked || 0),
      page: Number(res.data?.page || options.page || 1),
      limit: Number(res.data?.limit || options.limit || 20),
      totalPages: Number(res.data?.totalPages || 1),
    };
  },
  group: async (groupId, range = 'today', options = {}) => {
    const params = new URLSearchParams({ range });
    if (options.page) params.set('page', String(options.page));
    if (options.limit) params.set('limit', String(options.limit));
    if (options.search) params.set('search', String(options.search));
    const res = await api.get(`/api/leaderboard/team/${groupId}?${params.toString()}`);
    return {
      ...res,
      data: unwrapArray(res.data).map(normalizeLeaderboardRow),
      currentUserRank: res.data?.currentUserRank ? normalizeLeaderboardRow(res.data.currentUserRank) : null,
      totalRanked: Number(res.data?.totalRanked || 0),
      page: Number(res.data?.page || options.page || 1),
      limit: Number(res.data?.limit || options.limit || 20),
      totalPages: Number(res.data?.totalPages || 1),
    };
  },
  friends: async (range = 'today', options = {}) => {
    const params = new URLSearchParams({ range });
    if (options.page) params.set('page', String(options.page));
    if (options.limit) params.set('limit', String(options.limit));
    if (options.search) params.set('search', String(options.search));
    const res = await api.get(`/api/leaderboard/friends?${params.toString()}`);
    return {
      ...res,
      data: unwrapArray(res.data).map(normalizeLeaderboardRow),
      currentUserRank: res.data?.currentUserRank ? normalizeLeaderboardRow(res.data.currentUserRank) : null,
      totalRanked: Number(res.data?.totalRanked || 0),
      page: Number(res.data?.page || options.page || 1),
      limit: Number(res.data?.limit || options.limit || 50),
      totalPages: Number(res.data?.totalPages || 1),
    };
  },
};

export const security = {
  anomalies: (days = 1) => api.get(`/api/security/anomalies?days=${days}`),
  events: (days = 1, limit = 50) => api.get(`/api/security/events?days=${days}&limit=${limit}`),
  devices: (includeRevoked = true) => api.get(`/api/security/devices?includeRevoked=${includeRevoked}`),
  revokeDevice: (id) => api.post(`/api/security/devices/${id}/revoke`),
  restoreDevice: (id) => api.post(`/api/security/devices/${id}/restore`),
  baseline: (userId, days = 7) => api.get(`/api/security/users/${userId}/baseline?days=${days}`),
};

export const simulation = {
  status: () => api.get('/api/simulation/status'),
  start: (data = {}) => api.post('/api/simulation/start', data),
  stop: () => api.post('/api/simulation/stop'),
  tick: () => api.post('/api/simulation/tick'),
};

export const groups = {
  list: async () => {
    const res = await api.get('/api/groups');
    return { ...res, data: unwrapArray(res.data) };
  },
  get: async (id) => {
    const res = await api.get('/api/groups');
    return { ...res, data: unwrapArray(res.data).find((group) => String(group.id) === String(id)) || null };
  },
  create: async (data) => {
    const res = await api.post('/api/groups', data);
    return { ...res, data: res.data?.data || res.data?.group };
  },
  update: async (id, data) => {
    const res = await api.patch(`/api/groups/${id}`, data);
    return { ...res, data: res.data?.data || res.data?.group };
  },
  delete: (id) => api.delete(`/api/groups/${id}`),
  join: async (inviteCode) => {
    const res = await api.post('/api/groups/join', { inviteCode });
    return { ...res, data: res.data?.data || res.data?.group };
  },
  leave: (id) => api.post(`/api/groups/${id}/leave`),
  kick: async (id, userId) => {
    const res = await api.post(`/api/groups/${id}/kick`, { userId });
    return { ...res, data: res.data?.data || res.data?.group };
  },
};

export const friends = {
  list: async () => {
    const res = await api.get('/api/friends');
    return { ...res, data: unwrapArray(res.data).map(normalizeFriendship) };
  },
  requests: async () => {
    const res = await api.get('/api/friends/requests');
    return {
      ...res,
      data: {
        incoming: unwrapArray(res.data?.incoming).map(normalizeFriendship),
        outgoing: unwrapArray(res.data?.outgoing).map(normalizeFriendship),
      },
    };
  },
  sendRequest: async (userId) => {
    const res = await api.post('/api/friends/requests', { userId });
    return { ...res, data: normalizeFriendship(res.data?.data || res.data || {}) };
  },
  accept: async (requestId) => {
    const res = await api.post(`/api/friends/requests/${requestId}/accept`);
    return { ...res, data: normalizeFriendship(res.data?.data || res.data || {}) };
  },
  decline: (requestId) => api.post(`/api/friends/requests/${requestId}/decline`),
  cancel: (requestId) => api.delete(`/api/friends/requests/${requestId}`),
  remove: (userId) => api.delete(`/api/friends/${userId}`),
};

export const users = {
  list: async (options = {}) => {
    const params = new URLSearchParams();
    const page = Number(options.page || 1);
    const limit = Number(options.limit || 100);
    if (page > 1) params.set('page', String(page));
    if (limit) params.set('limit', String(limit));
    if (options.search) params.set('search', String(options.search));
    const qs = params.toString();
    const res = await api.get(`/api/users${qs ? `?${qs}` : ''}`);
    return {
      ...res,
      data: unwrapArray(res.data).map(normalizeUserSummary),
      pagination: res.data?.pagination || null,
    };
  },
  get: async (id) => {
    try {
      const res = await api.get(`/api/users/${id}`);
      const user = res.data?.user || res.data || {};
      return {
        ...res,
        data: normalizeUserSummary(user),
      };
    } catch (err) {
      if (err.response?.status === 403) return { data: { id, user_id: id, name: `User #${id}`, accountStatus: 'active', status: 'offline' } };
      throw err;
    }
  },
  update: async (id, data) => {
    const res = await api.patch(`/api/users/${id}`, data);
    const user = res.data?.user || res.data || {};
    return {
      ...res,
      data: normalizeUserSummary(user),
    };
  },
  profilePreferences: async (id) => {
    const res = await api.get(`/api/users/${id}/profile-preferences`);
    return { ...res, data: res.data?.data || {} };
  },
  updateProfilePreferences: async (id, data) => {
    const res = await api.patch(`/api/users/${id}/profile-preferences`, data);
    return { ...res, data: res.data?.data || {} };
  },
  gallery: async (id) => {
    const res = await api.get(`/api/users/${id}/gallery`);
    return { ...res, data: unwrapArray(res.data) };
  },
  profileLikes: async (id) => {
    const res = await api.get(`/api/users/${id}/profile-likes`);
    return { ...res, data: res.data?.data || {} };
  },
  likeProfile: async (id) => {
    const res = await api.post(`/api/users/${id}/profile-likes`);
    return { ...res, data: res.data?.data || {} };
  },
  updateGalleryImage: async (id, slot, imageData) => {
    const res = await api.put(`/api/users/${id}/gallery/${slot}`, { imageData });
    return { ...res, data: res.data?.image || res.data?.data || res.data };
  },
  removeGalleryImage: (id, slot) => api.delete(`/api/users/${id}/gallery/${slot}`),
};

export { storeAuth };
export default api;
