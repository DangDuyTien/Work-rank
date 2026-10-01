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

function isAccountLockedResponse(err) {
  const message = err?.response?.data?.message || err?.response?.data?.error || '';
  return err?.response?.status === 403 && String(message).includes('Tài khoản đã bị khóa');
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

function normalizeUserSummary(user = {}) {
  return {
    ...user,
    user_id: user.id ?? user.userId ?? user.user_id,
    id: user.id ?? user.userId ?? user.user_id,
    isVerified: normalizeVerified(user),
    verified: normalizeVerified(user),
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

function normalizeChatMessage(row = {}) {
  return {
    ...row,
    id: row.id || row.messageId,
    senderId: row.senderId ?? row.sender_id,
    receiverId: row.receiverId ?? row.receiver_id,
    body: String(row.body || ''),
    clientMessageId: row.clientMessageId || row.client_message_id || '',
    readAt: row.readAt || row.read_at || null,
    createdAt: row.createdAt || row.created_at || new Date().toISOString(),
    updatedAt: row.updatedAt || row.updated_at || row.createdAt || row.created_at || new Date().toISOString(),
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
      } catch (refreshError) {
        clearAuth({
          expired: true,
          message: refreshError?.response?.data?.message || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        });
      }
    } else if (isAccountLockedResponse(err) && !isAuthEndpoint(original.url)) {
      clearAuth({
        expired: true,
        message: err.response?.data?.message,
      });
    } else if (err.response?.status === 401 && String(original.url || '').includes('/api/auth/refresh-token')) {
      clearAuth({ expired: true });
    }
    return Promise.reject(err);
  }
);

export const auth = {
  register: async (data, password, name) => {
    const payload = (data && typeof data === 'object') ? data : { email: data, password, name };
    const res = await api.post('/api/auth/register', payload);
    storeAuth(res.data);
    return res;
  },
  login: async (data, password) => {
    const payload = (data && typeof data === 'object') ? data : { email: data, password };
    const res = await api.post('/api/auth/login', payload);
    storeAuth(res.data);
    return res;
  },
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

export const groups = {
  list: async () => {
    const res = await api.get('/api/groups');
    return { ...res, data: unwrapArray(res.data) };
  },
  listAll: async () => {
    const res = await api.get('/api/groups/all');
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
  addMember: async (id, userId) => {
    const res = await api.post(`/api/groups/${id}/add-member`, { userId });
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

export const chats = {
  unreadCounts: async () => {
    const res = await api.get('/api/chats/unread-counts');
    return { ...res, data: res.data?.data || {} };
  },
  messages: async (friendId, options = {}) => {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.beforeId) params.set('beforeId', String(options.beforeId));
    const qs = params.toString();
    const res = await api.get(`/api/chats/${friendId}/messages${qs ? `?${qs}` : ''}`);
    return {
      ...res,
      data: unwrapArray(res.data).map(normalizeChatMessage),
      pagination: res.data?.pagination || { hasMore: false, nextBeforeId: null },
    };
  },
  send: async (friendId, data) => {
    const res = await api.post(`/api/chats/${friendId}/messages`, data);
    return { ...res, data: normalizeChatMessage(res.data?.data || res.data || {}) };
  },
  markRead: (friendId) => api.post(`/api/chats/${friendId}/read`),
  normalizeMessage: normalizeChatMessage,
};

export const users = {
  list: async (options = {}) => {
    const params = new URLSearchParams();
    const page = Number(options.page || 1);
    const limit = Number(options.limit || 100);
    if (page > 1) params.set('page', String(page));
    if (limit) params.set('limit', String(limit));
    if (options.search) params.set('search', String(options.search));
    if (options.withCount === false) params.set('withCount', '0');
    if (options.withProfile === false) params.set('withProfile', '0');
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
        team: res.data?.team || null,
        competition: res.data?.competition || null,
        historicalSeasons: res.data?.historicalSeasons || [],
        youtubeSummary: res.data?.youtubeSummary || null,
        recognitions: res.data?.recognitions || null,
      };
    } catch (err) {
      if (err.response?.status === 403) return { data: { id, user_id: id, name: `User #${id}`, accountStatus: 'active', status: 'offline' } };
      throw err;
    }
  },
  create: async (data) => {
    const res = await api.post('/api/users', data);
    return res.data?.user || res.data;
  },
  delete: async (id) => {
    const res = await api.delete(`/api/users/${id}`);
    return res.data;
  },
  update: async (id, data) => {
    const res = await api.patch(`/api/users/${id}`, data);
    const user = res.data?.user || res.data || {};
    return {
      ...res,
      data: normalizeUserSummary(user),
    };
  },
  updateProfile: async (id, data) => {
    const res = await api.patch(`/api/users/${id}/profile`, data);
    const user = res.data?.user || res.data || {};
    return {
      ...res,
      data: normalizeUserSummary(user),
    };
  },
  getRecognitions: async (id) => {
    const res = await api.get(`/api/users/${id}/recognitions`);
    return res.data?.data || null;
  },
  adminAwardMVP: async (data) => {
    const res = await api.post('/api/users/admin/recognitions/mvp', data);
    return res.data?.recognition;
  },
  adminRevokeMVP: async (id, reason) => {
    const res = await api.delete(`/api/users/admin/recognitions/${id}`, { data: { reason } });
    return res.data;
  },
  adminAwardChampion: async (data) => {
    const res = await api.post('/api/users/admin/recognitions/champion', data);
    return res.data?.recognition;
  },
  adminUpdateJobProfile: async (id, data) => {
    const res = await api.patch(`/api/users/admin/users/${id}/job-profile`, data);
    return res.data?.user;
  },
  adminGetRecognitionAuditLogs: async (params = {}) => {
    const res = await api.get('/api/users/admin/recognitions/audit-logs', { params });
    return res.data?.logs || [];
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

export const competition = {
  getPublicSpotlight: async () => {
    const res = await api.get('/api/competition/public/spotlight');
    return res.data || { hasSpotlight: false, season: null, championTeam: null, mvp: null };
  },
  getMyState: async (params = {}) => {
    const res = await api.get('/api/competition/my-state', { params });
    return { ...res, data: res.data?.states || [] };
  },
  getMyScoreHistory: async (params = {}) => {
    const res = await api.get('/api/competition/my-score-history', { params });
    return { ...res, data: res.data?.history || [] };
  },
  adminListStates: async (params = {}) => {
    const res = await api.get('/api/competition/admin/states', { params });
    return res.data || { total: 0, states: [] };
  },
  adminGetStateDetail: async (id) => {
    const res = await api.get(`/api/competition/admin/states/${id}`);
    return res.data || {};
  },
  adminScoreInspect: async (userId, params = {}) => {
    const res = await api.get(`/api/competition/admin/score-inspect/${userId}`, { params });
    return res.data || { total: 0, entries: [] };
  },
  // Phase 4 — Season & Arena
  getActiveSeason: async () => {
    const res = await api.get('/api/competition/seasons/active');
    return res.data?.season || null;
  },
  getSeasonDetail: async (id) => {
    const res = await api.get(`/api/competition/seasons/${id}`);
    return res.data || {};
  },
  getSeasonLeaderboard: async (id) => {
    const res = await api.get(`/api/competition/seasons/${id}/leaderboard`);
    return res.data || { rankings: [] };
  },
  getSeasonIndividualLeaderboard: async (id, params = {}) => {
    const res = await api.get(`/api/competition/seasons/${id}/individual-leaderboard`, { params });
    return res.data || { rankings: [], total: 0 };
  },
  getSeasonChallenges: async (id) => {
    const res = await api.get(`/api/competition/seasons/${id}/challenges`);
    return res.data?.challenges || [];
  },
  getSeasonRules: async (id) => {
    const res = await api.get(`/api/competition/seasons/${id}/rules`);
    return res.data || { hasRules: false, rules: [] };
  },
  // Admin Season Management
  adminListSeasons: async () => {
    const res = await api.get('/api/competition/admin/seasons');
    return res.data?.seasons || [];
  },
  adminCreateSeason: async (data) => {
    const res = await api.post('/api/competition/admin/seasons', data);
    return res.data?.season;
  },
  adminUpdateSeasonStatus: async (id, status, reason) => {
    const res = await api.patch(`/api/competition/admin/seasons/${id}/status`, { status, reason });
    return res.data?.season;
  },
  adminAddTeamToSeason: async (id, data) => {
    const res = await api.post(`/api/competition/admin/seasons/${id}/teams`, data);
    return res.data?.seasonTeam;
  },
  // Phase 7 Visual Rule Builder & Rules Management
  adminListRuleSets: async (params = {}) => {
    const res = await api.get('/api/competition/admin/rules', { params });
    return res.data?.ruleSets || [];
  },
  adminGetRuleSet: async (id) => {
    const res = await api.get(`/api/competition/admin/rules/${id}`);
    return res.data?.ruleSet;
  },
  adminCreateRuleSet: async (data) => {
    const res = await api.post('/api/competition/admin/rules', data);
    return res.data?.ruleSet;
  },
  adminUpdateRuleSet: async (id, data) => {
    const res = await api.put(`/api/competition/admin/rules/${id}`, data);
    return res.data?.ruleSet;
  },
  adminArchiveRuleSet: async (id, reason) => {
    const res = await api.post(`/api/competition/admin/rules/${id}/archive`, { reason });
    return res.data;
  },
  adminCreateRuleSetVersion: async (ruleSetId, data) => {
    const res = await api.post(`/api/competition/admin/rules/${ruleSetId}/versions`, data);
    return res.data?.version;
  },
  adminGetRuleSetVersion: async (ruleSetId, versionId) => {
    const res = await api.get(`/api/competition/admin/rules/${ruleSetId}/versions/${versionId}`);
    return res.data?.version;
  },
  adminUpdateDraftVersion: async (ruleSetId, versionId, data) => {
    const res = await api.put(`/api/competition/admin/rules/${ruleSetId}/versions/${versionId}`, data);
    return res.data?.version;
  },
  adminDuplicateVersion: async (ruleSetId, versionId) => {
    const res = await api.post(`/api/competition/admin/rules/${ruleSetId}/versions/${versionId}/duplicate`);
    return res.data?.version;
  },
  adminValidateVersion: async (ruleSetId, versionId, astPayload) => {
    const res = await api.post(`/api/competition/admin/rules/${ruleSetId}/versions/${versionId}/validate`, { astPayload });
    return res.data;
  },
  adminPublishRuleSetVersion: async (ruleSetId, versionId, reason) => {
    const res = await api.post(`/api/competition/admin/rules/${ruleSetId}/versions/${versionId}/publish`, { reason });
    return res.data?.version;
  },
  adminSimulateRule: async (data) => {
    const res = await api.post('/api/competition/admin/rules/simulate', data);
    return res.data;
  },
  adminDiffVersions: async (ruleSetId, fromVersionId, toVersionId) => {
    const res = await api.get(`/api/competition/admin/rules/${ruleSetId}/diff/${fromVersionId}/${toVersionId}`);
    return res.data;
  },
  adminCreateChallenge: async (seasonId, data) => {
    const res = await api.post(`/api/competition/admin/seasons/${seasonId}/challenges`, data);
    return res.data?.challenge;
  },
  adminListAuditLogs: async (params = {}) => {
    const res = await api.get('/api/competition/admin/audit-logs', { params });
    return res.data?.logs || [];
  },
  // Phase 5 — Grand Championship
  getCurrentGrand: async () => {
    const res = await api.get('/api/competition/grand/current');
    return res.data?.grand || null;
  },
  getGrandStandings: async (id) => {
    const res = await api.get(`/api/competition/grand/${id}/standings`);
    return res.data || { standings: [] };
  },
  getGrandIndividualStandings: async (id, params = {}) => {
    const res = await api.get(`/api/competition/grand/${id}/individual-standings`, { params });
    return res.data || { standings: [], total: 0 };
  },
  getGrandTimeline: async (id) => {
    const res = await api.get(`/api/competition/grand/${id}/timeline`);
    return res.data?.timeline || [];
  },
  getGrandTeamJourney: async (id, teamId) => {
    const res = await api.get(`/api/competition/grand/${id}/teams/${teamId}/journey`);
    return res.data || { history: [] };
  },
  getTopPerformers: async (params = {}) => {
    const res = await api.get('/api/competition/top-performers', { params });
    return res.data || { topSeasonPerformers: [], topGrandPerformers: [] };
  },
  getUserCompetitionProfile: async (userId, params = {}) => {
    const res = await api.get(`/api/competition/users/${userId}/competition-profile`, { params });
    return res.data || {};
  },
  adminListGrands: async () => {
    const res = await api.get('/api/competition/admin/grand');
    return res.data?.championships || [];
  },
  adminCreateGrand: async (data) => {
    const res = await api.post('/api/competition/admin/grand', data);
    return res.data?.grand;
  },
  adminUpdateGrandStatus: async (id, status, reason, forceOverride = false) => {
    const res = await api.patch(`/api/competition/admin/grand/${id}/status`, { status, reason, forceOverride });
    return res.data?.grand;
  },
  adminLinkSeasonToGrand: async (id, seasonId) => {
    const res = await api.post(`/api/competition/admin/grand/${id}/seasons/${seasonId}/link`);
    return res.data?.season;
  },
  adminSettleGrandPoints: async (id, seasonId) => {
    const res = await api.post(`/api/competition/admin/grand/${id}/seasons/${seasonId}/settle`);
    return res.data;
  },
  adminReconcileGrandPoints: async (id, data) => {
    const res = await api.post(`/api/competition/admin/grand/${id}/reconcile`, data);
    return res.data?.record;
  },
  // Phase 6 — Read Models & Company Dashboard
  getDashboard: async () => {
    const res = await api.get('/api/competition/dashboard');
    return res.data;
  },
  getTeamSummary: async (teamId) => {
    const res = await api.get(`/api/competition/teams/${teamId}/summary`);
    return res.data;
  },
  getActivityFeed: async (params = {}) => {
    const res = await api.get('/api/competition/activity', { params });
    return res.data;
  },
  getCompanyOverview: async () => {
    const res = await api.get('/api/competition/company-overview');
    return res.data;
  },
  getProjectedSeasonLeaderboard: async (seasonId, params = {}) => {
    const res = await api.get(`/api/competition/projections/seasons/${seasonId}/leaderboard`, { params });
    return res.data;
  },
  getProjectedGrandLeaderboard: async (grandId, params = {}) => {
    const res = await api.get(`/api/competition/projections/grand/${grandId}/leaderboard`, { params });
    return res.data;
  },
  adminGetDashboard: async () => {
    const res = await api.get('/api/competition/admin/dashboard');
    return res.data;
  },
  adminGetEmployeeExcellence: async (params = {}) => {
    const res = await api.get('/api/competition/admin/employee-excellence', { params });
    return res.data;
  },
  adminGetProjectionsStatus: async () => {
    const res = await api.get('/api/competition/admin/projections/status');
    return res.data;
  },
  adminCheckProjectionsConsistency: async (params = {}) => {
    const res = await api.get('/api/competition/admin/projections/consistency', { params });
    return res.data;
  },
  adminRebuildProjections: async (reason) => {
    const res = await api.post('/api/competition/admin/projections/rebuild', { reason });
    return res.data;
  },
  // Phase 8 — Product Integration & Event Tracing
  getEventTrace: async (eventId) => {
    const res = await api.get(`/api/competition/events/${eventId}/trace`);
    return res.data;
  },
  listEventContracts: async () => {
    const res = await api.get('/api/competition/contracts');
    return res.data?.contracts || [];
  },
  publishEvent: async (data) => {
    const res = await api.post('/api/competition/events/publish', data);
    return res.data;
  },
  triggerProductionAction: async (data) => {
    const res = await api.post('/api/competition/integration/production/video-action', data);
    return res.data;
  },
  triggerYouTubeMilestone: async (data) => {
    const res = await api.post('/api/competition/integration/youtube/milestone', data);
    return res.data;
  },
  triggerCommunityKudos: async (data) => {
    const res = await api.post('/api/competition/integration/community/kudos', data);
    return res.data;
  },
  adminGetIntegrationHealth: async () => {
    const res = await api.get('/api/competition/admin/integration/health');
    return res.data;
  },
  adminListIntegrationEvents: async (params = {}) => {
    const res = await api.get('/api/competition/admin/integration/events', { params });
    return res.data;
  },
  adminRetryIntegrationEvent: async (eventId, reason) => {
    const res = await api.post(`/api/competition/admin/events/${eventId}/retry`, { reason });
    return res.data;
  },
};

export const youtube = {
  getOverview: async () => {
    const res = await api.get('/api/youtube/overview');
    return res.data;
  },
  getMyTeam: async () => {
    const res = await api.get('/api/youtube/my-team');
    return res.data;
  },
  getLeaderboard: async (params = {}) => {
    const res = await api.get('/api/youtube/leaderboard', { params });
    return res.data;
  },
  getTopVideos: async (params = {}) => {
    const res = await api.get('/api/youtube/top-videos', { params });
    return res.data;
  },
  getTeamDetails: async (teamId) => {
    const res = await api.get(`/api/youtube/teams/${teamId}`);
    return res.data;
  },
  getChannelDetails: async (id) => {
    const res = await api.get(`/api/youtube/channels/${id}`);
    return res.data;
  },
  compareTeams: async (teamA, teamB) => {
    const res = await api.get('/api/youtube/compare', { params: { teamA, teamB } });
    return res.data;
  },
  getChannels: async (params = {}) => {
    const res = await api.get('/api/youtube/channels', { params });
    return res.data;
  },
  adminGetOverview: async () => {
    const res = await api.get('/api/youtube/admin/overview');
    return res.data;
  },
  adminGetChannels: async (params = {}) => {
    const res = await api.get('/api/youtube/admin/channels', { params });
    return res.data;
  },
  adminCreateChannel: async (data) => {
    const res = await api.post('/api/youtube/admin/channels', data);
    return res.data;
  },
  adminLinkChannel: async (id, teamId) => {
    const res = await api.patch(`/api/youtube/admin/channels/${id}/link`, { teamId });
    return res.data;
  },
  adminUnlinkChannel: async (id) => {
    const res = await api.post(`/api/youtube/admin/channels/${id}/unlink`);
    return res.data;
  },
  adminSyncChannel: async (id) => {
    const res = await api.post(`/api/youtube/admin/channels/${id}/sync`);
    return res.data;
  },
  adminSyncAll: async () => {
    const res = await api.post('/api/youtube/admin/sync-all');
    return res.data;
  },
  adminDeleteChannel: async (id) => {
    const res = await api.delete(`/api/youtube/admin/channels/${id}`);
    return res.data;
  },
  adminGetHealth: async () => {
    const res = await api.get('/api/youtube/admin/health');
    return res.data;
  },
};

export const rankings = {
  getOverview: async () => {
    const res = await api.get('/api/rankings/overview');
    return res.data;
  },
  getTeams: async (params = {}) => {
    const res = await api.get('/api/rankings/teams', { params });
    return res.data;
  },
  getIndividuals: async (params = {}) => {
    const res = await api.get('/api/rankings/individuals', { params });
    return res.data;
  },
  getSeasons: async () => {
    const res = await api.get('/api/rankings/seasons');
    return res.data?.seasons || [];
  },
  getGrands: async () => {
    const res = await api.get('/api/rankings/grands');
    return res.data?.grands || [];
  },
  getYouTube: async (params = {}) => {
    const res = await api.get('/api/rankings/youtube', { params });
    return res.data;
  },
  getTopPerformers: async () => {
    const res = await api.get('/api/rankings/top-performers');
    return res.data;
  },
};

export const capitalBoardGame = {
  listRooms: async (params = {}) => {
    const res = await api.get('/api/games/rooms', { params });
    return res.data?.data || [];
  },
  getActiveRoom: async () => {
    const res = await api.get('/api/games/active-room');
    return res.data?.data || null;
  },
  getRoom: async (id) => {
    const res = await api.get(`/api/games/rooms/${id}`);
    return res.data?.data || null;
  },
  createRoom: async (data) => {
    const res = await api.post('/api/games/rooms', data);
    return res.data?.data || null;
  },
  joinRoom: async (id) => {
    const res = await api.post(`/api/games/rooms/${id}/join`);
    return res.data?.data || null;
  },
  leaveRoom: async (id) => {
    const res = await api.post(`/api/games/rooms/${id}/leave`);
    return res.data?.data || null;
  },
  startGame: async (id) => {
    const res = await api.post(`/api/games/rooms/${id}/start`);
    return res.data?.data || null;
  },
  rollDice: async (id) => {
    const res = await api.post(`/api/games/rooms/${id}/roll`);
    return res.data?.data || null;
  },
  buyProperty: async (id) => {
    const res = await api.post(`/api/games/rooms/${id}/buy`);
    return res.data?.data || null;
  },
  endTurn: async (id) => {
    const res = await api.post(`/api/games/rooms/${id}/end-turn`);
    return res.data?.data || null;
  },
  getLeaderboard: async (params = {}) => {
    const res = await api.get('/api/games/leaderboard', { params });
    return res.data || { data: [], myProfile: null };
  },
  getMyHistory: async (params = {}) => {
    const res = await api.get('/api/games/history', { params });
    return res.data?.data || [];
  },
};

export const quizGame = {
  listRooms: async (params = {}) => {
    const res = await api.get('/api/games/quiz/rooms', { params });
    return res.data?.data || [];
  },
  getActiveRoom: async () => {
    const res = await api.get('/api/games/quiz/active-room');
    return res.data?.data || null;
  },
  getRoom: async (id) => {
    const res = await api.get(`/api/games/quiz/rooms/${id}`);
    return res.data?.data || null;
  },
  createRoom: async (data) => {
    const res = await api.post('/api/games/quiz/rooms', data);
    return res.data?.data || null;
  },
  joinRoom: async (id) => {
    const res = await api.post(`/api/games/quiz/rooms/${id}/join`);
    return res.data?.data || null;
  },
  leaveRoom: async (id) => {
    const res = await api.post(`/api/games/quiz/rooms/${id}/leave`);
    return res.data?.data || null;
  },
  startGame: async (id) => {
    const res = await api.post(`/api/games/quiz/rooms/${id}/start`);
    return res.data?.data || null;
  },
  submitAnswer: async (id, data) => {
    const res = await api.post(`/api/games/quiz/rooms/${id}/answer`, data);
    return res.data?.data || null;
  },
  getLeaderboard: async (params = {}) => {
    const res = await api.get('/api/games/quiz/leaderboard', { params });
    return res.data || { data: [], myStats: null };
  },
  getMyStats: async () => {
    const res = await api.get('/api/games/quiz/my-stats');
    return res.data?.data || null;
  },
};

export const game2048 = {
  startSession: async () => {
    const res = await api.post('/api/games/2048/start');
    return res.data?.data || null;
  },
  submitScore: async (data) => {
    const res = await api.post('/api/games/2048/submit', data);
    return res.data?.data || null;
  },
  getLeaderboard: async (params = {}) => {
    const res = await api.get('/api/games/2048/leaderboard', { params });
    return res.data || { data: [], myStats: null };
  },
  getMyStats: async () => {
    const res = await api.get('/api/games/2048/my-stats');
    return res.data?.data || null;
  },
};

export const samGame = {
  listRooms: async (params = {}) => {
    const res = await api.get('/api/games/sam/rooms', { params });
    return res.data;
  },
  getActiveRoom: async () => {
    const res = await api.get('/api/games/sam/rooms/active');
    return res.data;
  },
  getRoom: async (id) => {
    const res = await api.get(`/api/games/sam/rooms/${id}`);
    return res.data;
  },
  createRoom: async (data) => {
    const res = await api.post('/api/games/sam/rooms', data);
    return res.data;
  },
  joinRoom: async (id) => {
    const res = await api.post(`/api/games/sam/rooms/${id}/join`);
    return res.data;
  },
  leaveRoom: async (id) => {
    const res = await api.post(`/api/games/sam/rooms/${id}/leave`);
    return res.data;
  },
  startMatch: async (id) => {
    const res = await api.post(`/api/games/sam/rooms/${id}/start`);
    return res.data;
  },
  declareSam: async (id, declare = true) => {
    const res = await api.post(`/api/games/sam/rooms/${id}/declare-sam`, { declare });
    return res.data;
  },
  playCards: async (id, cardIds) => {
    const res = await api.post(`/api/games/sam/rooms/${id}/play-cards`, { cardIds });
    return res.data;
  },
  passTurn: async (id) => {
    const res = await api.post(`/api/games/sam/rooms/${id}/pass`);
    return res.data;
  },
  getLeaderboard: async (params = {}) => {
    const res = await api.get('/api/games/sam/leaderboard', { params });
    return res.data;
  },
  getMyStats: async () => {
    const res = await api.get('/api/games/sam/my-stats');
    return res.data;
  },
};

export { storeAuth };
export default api;


