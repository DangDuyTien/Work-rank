import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

function storeAuth(data) {
  const token = data.accessToken || data.token;
  if (token) localStorage.setItem('token', token);
  if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
  return token;
}

function unwrapArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function normalizeLeaderboardRow(row, index = 0) {
  const user = row.User || row.user || row;
  const activeSeconds = Number(row.activeSeconds ?? row.active_seconds ?? row.total_active_seconds ?? 0);
  const idleSeconds = Number(row.idleSeconds ?? row.idle_seconds ?? row.total_idle_seconds ?? 0);
  const keystrokes = Number(row.keystrokeCount ?? row.keystrokes ?? row.total_keystrokes ?? 0);
  const clicks = Number(row.mouseClickCount ?? row.mouse_clicks ?? row.total_mouse_clicks ?? 0);
  const score = Number(row.focusScore ?? row.score ?? 0);
  return {
    ...row,
    user_id: user.id ?? row.userId ?? row.user_id,
    id: user.id ?? row.userId ?? row.user_id,
    name: user.name || row.name || 'Unknown User',
    email: user.email || row.email || '',
    role: user.role || row.role || 'user',
    status: row.status || user.status || 'active',
    rank: row.rankPosition || index + 1,
    score,
    total_keystrokes: keystrokes,
    total_mouse_clicks: clicks,
    total_active_seconds: activeSeconds,
    total_idle_seconds: idleSeconds,
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

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const auth = {
  register: async (data) => { const res = await api.post('/api/auth/register', data); storeAuth(res.data); return res; },
  login: async (data) => { const res = await api.post('/api/auth/login', data); storeAuth(res.data); return res; },
  logout: () => api.post('/api/auth/logout'),
  me: () => api.get('/api/auth/me'),
};

export const activity = {
  today: async () => {
    const res = await api.get('/api/activity/me/today');
    return { ...res, data: normalizeStat(res.data?.stat || {}) };
  },
  userStats: async (id) => {
    const res = await api.get(`/api/reports/users/${id}/daily`);
    const row = unwrapArray(res.data)[0] || {};
    return { ...res, data: normalizeStat(row) };
  },
  timeline: async () => ({ data: [] }),
  heatmap: async () => ({ data: [] }),
  batch: (data) => api.post('/api/activity/batch', data),
  startSession: (data) => api.post('/api/activity/session/start', data),
  endSession: (sessionId) => api.post('/api/activity/session/end', { sessionId }),
};

export const dashboard = {
  overview: () => api.get('/api/dashboard/overview'),
  realtimeUsers: () => api.get('/api/dashboard/realtime-users'),
};

export const leaderboard = {
  get: async (range = 'daily') => {
    const apiRange = range === 'today' ? 'daily' : range === 'week' ? 'weekly' : range === 'month' ? 'monthly' : range;
    const res = await api.get(`/api/leaderboard/${apiRange}`);
    return { ...res, data: unwrapArray(res.data).map(normalizeLeaderboardRow) };
  },
  group: async (groupId) => {
    const res = await api.get(`/api/leaderboard/team/${groupId}`);
    return { ...res, data: unwrapArray(res.data).map(normalizeLeaderboardRow) };
  },
};

export const security = {
  anomalies: (days = 1) => api.get(`/api/security/anomalies?days=${days}`),
  devices: (includeRevoked = true) => api.get(`/api/security/devices?includeRevoked=${includeRevoked}`),
  revokeDevice: (id) => api.post(`/api/security/devices/${id}/revoke`),
  restoreDevice: (id) => api.post(`/api/security/devices/${id}/restore`),
  baseline: (userId, days = 7) => api.get(`/api/security/users/${userId}/baseline?days=${days}`),
};

export const groups = {
  list: async () => ({ data: [] }),
  get: async () => ({ data: null }),
  create: async () => { throw new Error('Groups API pending on new backend'); },
  update: async () => { throw new Error('Groups API pending on new backend'); },
  delete: async () => { throw new Error('Groups API pending on new backend'); },
  join: async () => { throw new Error('Groups API pending on new backend'); },
  leave: async () => { throw new Error('Groups API pending on new backend'); },
  kick: async () => { throw new Error('Groups API pending on new backend'); },
};

export const users = {
  list: async () => {
    const res = await api.get('/api/users');
    return { ...res, data: unwrapArray(res.data).map((user) => ({ ...user, user_id: user.id, status: user.status || 'active' })) };
  },
  get: async (id) => {
    try {
      const res = await api.get(`/api/users/${id}`);
      const user = res.data?.user || res.data || {};
      return { ...res, data: { ...user, user_id: user.id, status: user.status || 'active' } };
    } catch (err) {
      if (err.response?.status === 403) return { data: { id, user_id: id, name: `User #${id}`, status: 'active' } };
      throw err;
    }
  },
};

export { storeAuth };
export default api;
