import axios from 'axios';

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
    accountStatus: user.status || row.accountStatus || row.status || 'active',
    status: row.presence || row.presenceStatus || row.status || 'offline',
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
    const res = await api.get(`/api/reports/users/${id}/level`);
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
  desktopStatus: () => api.get('/api/activity/desktop-status', {
    headers: { 'Cache-Control': 'no-store' },
  }),
  desktopLaunch: (action) => api.post('/api/activity/desktop-launch', {
    action,
    refreshToken: localStorage.getItem('refreshToken'),
  }),
};

export const dashboard = {
  overview: (range = 'today') => api.get(`/api/dashboard/overview?range=${range}`),
  realtimeUsers: () => api.get('/api/dashboard/realtime-users'),
};

export const leaderboard = {
  get: async (range = 'daily') => {
    const apiRange = range === 'today' ? 'daily' : range === 'week' ? 'weekly' : range === 'month' ? 'monthly' : range;
    const res = await api.get(`/api/leaderboard/${apiRange}`);
    return { ...res, data: unwrapArray(res.data).map(normalizeLeaderboardRow) };
  },
  group: async (groupId, range = 'today') => {
    const res = await api.get(`/api/leaderboard/team/${groupId}?range=${range}`);
    return { ...res, data: unwrapArray(res.data).map(normalizeLeaderboardRow) };
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
  update: async () => { throw new Error('Groups update API pending'); },
  delete: async () => { throw new Error('Groups delete API pending'); },
  join: async (inviteCode) => {
    const res = await api.post('/api/groups/join', { inviteCode });
    return { ...res, data: res.data?.data || res.data?.group };
  },
  leave: (id) => api.post(`/api/groups/${id}/leave`),
  kick: async () => { throw new Error('Groups kick API pending'); },
};

export const users = {
  list: async () => {
    const res = await api.get('/api/users');
    return {
      ...res,
      data: unwrapArray(res.data).map((user) => ({
        ...user,
        user_id: user.id,
        accountStatus: user.status || 'active',
        status: user.presence || user.presenceStatus || 'offline',
      })),
    };
  },
  get: async (id) => {
    try {
      const res = await api.get(`/api/users/${id}`);
      const user = res.data?.user || res.data || {};
      return {
        ...res,
        data: {
          ...user,
          user_id: user.id,
          accountStatus: user.status || 'active',
          status: user.presence || user.presenceStatus || 'offline',
        },
      };
    } catch (err) {
      if (err.response?.status === 403) return { data: { id, user_id: id, name: `User #${id}`, accountStatus: 'active', status: 'offline' } };
      throw err;
    }
  },
};

export { storeAuth };
export default api;
