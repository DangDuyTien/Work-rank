import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboard, leaderboard } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AVATAR_UPDATED_EVENT, getUserAvatar, initialsFromName } from '../utils/avatar';
import { calculateRankScore } from '../utils/scoring';
import {
  Activity,
  AlertCircle,
  Clock3,
  Monitor,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';
import usePageVisibility from '../hooks/usePageVisibility';

function isVerifiedUser(user) {
  return user.verified === true || user.isVerified === true || user.verified === 1 || user.isVerified === 1 || user.verified === '1' || user.isVerified === '1';
}

const STATUS_CONFIG = {
  active: { label: 'Đang hoạt động', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.35)', color: '#16a34a', dot: '#22c55e' },
  online: { label: 'Trực tuyến', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.35)', color: '#38bdf8', dot: '#38bdf8' },
  idle: { label: 'Không hoạt động', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.35)', color: '#ca8a04', dot: '#eab308' },
  offline: { label: 'Ngoại tuyến', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)', color: '#64748b', dot: '#94a3b8' },
};

const RANGES = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'week', label: 'Tuần này' },
  { key: 'month', label: 'Tháng này' },
];

const ONLINE_STATUSES = ['active', 'online', 'idle'];
const STATUS_PRIORITY = { active: 0, online: 1, idle: 2, offline: 3 };
const DASHBOARD_LEADERBOARD_LIMIT = 24;
const DASHBOARD_USER_CACHE_LIMIT = 80;
const DASHBOARD_REALTIME_FLUSH_MS = 700;

function formatNum(value) {
  const n = Number(value) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toLocaleString();
}

function formatDuration(seconds) {
  const safe = Number(seconds) || 0;
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function calcChange(current, previous) {
  if (!previous || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function localDateKey(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function statusConfig(status) {
  return STATUS_CONFIG[String(status || 'offline').toLowerCase()] || STATUS_CONFIG.offline;
}

function dashboardUserId(user = {}) {
  return String(user.user_id || user.id || user.userId || '');
}

function activityDeltaFromPayload(data = {}) {
  const delta = data.delta || {};
  return {
    keystrokeCount: Number(delta.keystrokeCount ?? data.keystrokes ?? 0),
    mouseClickCount: Number(delta.mouseClickCount ?? data.clicks ?? 0),
    activeSeconds: Number(delta.activeSeconds ?? data.activeSeconds ?? 0),
    idleSeconds: Number(delta.idleSeconds ?? data.idleSeconds ?? 0),
  };
}

function mergeActivityPayload(previous, data = {}) {
  const incomingDelta = activityDeltaFromPayload(data);
  if (!previous) {
    return {
      ...data,
      delta: incomingDelta,
    };
  }
  const previousDelta = previous.delta || {};
  return {
    ...previous,
    ...data,
    delta: {
      keystrokeCount: Number(previousDelta.keystrokeCount || 0) + incomingDelta.keystrokeCount,
      mouseClickCount: Number(previousDelta.mouseClickCount || 0) + incomingDelta.mouseClickCount,
      activeSeconds: Number(previousDelta.activeSeconds || 0) + incomingDelta.activeSeconds,
      idleSeconds: Number(previousDelta.idleSeconds || 0) + incomingDelta.idleSeconds,
    },
    totals: data.totals || previous.totals,
  };
}

function capDashboardUsers(rows = []) {
  if (rows.length <= DASHBOARD_USER_CACHE_LIMIT) return rows;
  return [...rows]
    .sort((a, b) => {
      const aStatus = STATUS_PRIORITY[String(a.status || a.presence || '').toLowerCase()] ?? 9;
      const bStatus = STATUS_PRIORITY[String(b.status || b.presence || '').toLowerCase()] ?? 9;
      if (aStatus !== bStatus) return aStatus - bStatus;
      return Number(b.score || 0) - Number(a.score || 0);
    })
    .slice(0, DASHBOARD_USER_CACHE_LIMIT);
}

function buildDelta(current, previous, label = 'lần cập nhật trước') {
  const pct = calcChange(current, previous);
  if (pct === null) return { text: 'Chưa có dữ liệu so sánh', tone: 'neutral', icon: null };
  if (pct === 0) return { text: `Ổn định so với ${label}`, tone: 'neutral', icon: null };
  if (pct > 0) return { text: `+${pct}% so với ${label}`, tone: 'up', icon: TrendingUp };
  return { text: `${pct}% so với ${label}`, tone: 'down', icon: TrendingDown };
}

function getErrorMessage(error) {
  return error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Không tải được dữ liệu dashboard';
}

function StatSkeleton() {
  return (
    <div className="dashboard-stat-card is-loading">
      <div className="dashboard-skeleton" style={{ width: '44%', height: 12 }} />
      <div className="dashboard-skeleton" style={{ width: '68%', height: 34, marginTop: 16 }} />
      <div className="dashboard-skeleton" style={{ width: '52%', height: 10, marginTop: 14 }} />
    </div>
  );
}

function StatCard({ card, loading }) {
  if (loading) return <StatSkeleton />;
  const DeltaIcon = card.delta.icon;
  const Icon = card.icon;
  return (
    <div className="dashboard-stat-card">
      <div className="dashboard-stat-topline">
        <span>{card.label}</span>
        <div className="dashboard-stat-icon" style={{ color: card.color, background: card.iconBg }}>
          <Icon size={17} strokeWidth={2.4} />
        </div>
      </div>
      <div className="dashboard-stat-value">{card.value}</div>
      <div className={`dashboard-stat-delta ${card.delta.tone}`}>
        {DeltaIcon && <DeltaIcon size={12} strokeWidth={2.5} />}
        <span>{card.delta.text}</span>
      </div>
      {card.note && <div className="dashboard-stat-note">{card.note}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { socket } = useAuth();
  const navigate = useNavigate();
  const pageVisible = usePageVisibility();
  const [range, setRange] = useState('today');
  const [totals, setTotals] = useState({ keystrokes: 0, clicks: 0, activeSeconds: 0, online: 0 });
  const [prevTotals, setPrevTotals] = useState(null);
  const [users, setUsers] = useState([]);
  const [liveFlash, setLiveFlash] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);
  const prevRef = useRef(null);
  const requestIdRef = useRef(0);

  const fetchData = useCallback(async (selectedRange, options = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const background = options.background === true;

    if (!background) {
      setUsers([]);
      setLoading(true);
      setPrevTotals(null);
      prevRef.current = null;
    } else {
      setRefreshing(true);
    }
    setError('');

    try {
      const [leaderboardRes, overviewRes] = await Promise.all([
        leaderboard.get(selectedRange, { limit: DASHBOARD_LEADERBOARD_LIMIT }),
        dashboard.overview(selectedRange),
      ]);
      if (requestId !== requestIdRef.current) return;

      const overview = overviewRes.data || {};
      const newTotals = {
        keystrokes: Number(overview.totalKeystrokes || 0),
        clicks: Number(overview.totalMouseClicks || 0),
        activeSeconds: Number(overview.totalActiveSeconds || overview.totalActiveSecondsToday || 0),
        online: Number(overview.activeUsersNow || 0),
      };

      setUsers(leaderboardRes.data || []);
      if (prevRef.current) setPrevTotals(prevRef.current);
      prevRef.current = newTotals;
      setTotals(newTotals);
    } catch (err) {
      if (requestId === requestIdRef.current) setError(getErrorMessage(err));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (pageVisible) fetchData(range);
  }, [fetchData, pageVisible, range]);

  useEffect(() => {
    const refreshAvatars = () => setAvatarRefreshKey((key) => key + 1);
    window.addEventListener(AVATAR_UPDATED_EVENT, refreshAvatars);
    return () => window.removeEventListener(AVATAR_UPDATED_EVENT, refreshAvatars);
  }, []);

  useEffect(() => {
    if (!socket || !pageVisible) return undefined;
    let flashTimer = null;
    let flushTimer = null;
    let pendingTotalDelta = { keystrokes: 0, clicks: 0, activeSeconds: 0 };
    const pendingUserUpdates = new Map();

    const eventBelongsToRange = (data = {}) => {
      if (range !== 'today') return true;
      return !data.statDate || data.statDate === localDateKey();
    };

    const flushActivityBatch = () => {
      flushTimer = null;
      const totalDelta = pendingTotalDelta;
      const updates = Array.from(pendingUserUpdates.values());
      pendingTotalDelta = { keystrokes: 0, clicks: 0, activeSeconds: 0 };
      pendingUserUpdates.clear();

      if (totalDelta.keystrokes || totalDelta.clicks || totalDelta.activeSeconds) {
        setTotals((prev) => ({
          ...prev,
          keystrokes: prev.keystrokes + totalDelta.keystrokes,
          clicks: prev.clicks + totalDelta.clicks,
          activeSeconds: prev.activeSeconds + totalDelta.activeSeconds,
        }));
      }
      if (updates.length === 0) return;
      setUsers((prev) => {
        let next = [...prev];
        let changed = false;
        updates.forEach((data = {}) => {
          const userId = String(data.userId || data.user_id || '');
          if (!userId) return;
          const totals = range === 'today' ? data.totals || null : null;
          const delta = data.delta || {};
          const deltaKeys = Number(delta.keystrokeCount || 0);
          const deltaClicks = Number(delta.mouseClickCount || 0);
          const deltaActiveSeconds = Number(delta.activeSeconds || 0);
          const deltaIdleSeconds = Number(delta.idleSeconds || 0);
          const nextStatus = data.presence || data.status || 'active';
          const idx = next.findIndex((user) => dashboardUserId(user) === userId);

          if (idx >= 0) {
            const existing = next[idx];
            const keystrokeCount = totals ? Number(totals.keystrokeCount || 0) : (Number(existing.keystrokeCount) || 0) + deltaKeys;
            const mouseClickCount = totals ? Number(totals.mouseClickCount || 0) : (Number(existing.mouseClickCount) || 0) + deltaClicks;
            const activeSeconds = totals ? Number(totals.activeSeconds || 0) : (Number(existing.activeSeconds || existing.total_active_seconds) || 0) + deltaActiveSeconds;
            const idleSeconds = totals ? Number(totals.idleSeconds || 0) : (Number(existing.idleSeconds || existing.total_idle_seconds) || 0) + deltaIdleSeconds;
            const focusScore = totals ? Number(totals.focusScore || 0) : Number(data.focusScore ?? existing.focusScore ?? 0);
            const score = calculateRankScore({ activeSeconds, idleSeconds, keystrokeCount, mouseClickCount, focusScore });
            next[idx] = {
              ...existing,
              ...data,
              name: data.name || existing.name,
              keystrokeCount,
              mouseClickCount,
              activeSeconds,
              idleSeconds,
              total_active_seconds: activeSeconds,
              total_idle_seconds: idleSeconds,
              focusScore,
              score,
              status: nextStatus,
              presence: nextStatus,
              presenceStatus: nextStatus,
            };
            changed = true;
            return;
          }

          const keystrokeCount = totals ? Number(totals.keystrokeCount || 0) : deltaKeys;
          const mouseClickCount = totals ? Number(totals.mouseClickCount || 0) : deltaClicks;
          const activeSeconds = totals ? Number(totals.activeSeconds || 0) : deltaActiveSeconds;
          const idleSeconds = totals ? Number(totals.idleSeconds || 0) : deltaIdleSeconds;
          const focusScore = totals ? Number(totals.focusScore || 0) : Number(data.focusScore || 0);
          const score = calculateRankScore({ activeSeconds, idleSeconds, keystrokeCount, mouseClickCount, focusScore });

          next.push({
            ...data,
            user_id: userId,
            status: nextStatus,
            name: data.name || `User #${userId}`,
            keystrokeCount,
            mouseClickCount,
            activeSeconds,
            idleSeconds,
            total_active_seconds: activeSeconds,
            total_idle_seconds: idleSeconds,
            focusScore,
            score,
            presence: nextStatus,
            presenceStatus: nextStatus,
          });
          changed = true;
        });
        return changed ? capDashboardUsers(next) : prev;
      });
    };

    const handleActivity = (data = {}) => {
      if (!eventBelongsToRange(data)) return;
      if (!flashTimer) setLiveFlash(true);
      if (flashTimer) window.clearTimeout(flashTimer);
      flashTimer = window.setTimeout(() => {
        flashTimer = null;
        setLiveFlash(false);
      }, 650);

      const userId = String(data.userId || data.user_id || '');
      const delta = activityDeltaFromPayload(data);
      pendingTotalDelta.keystrokes += delta.keystrokeCount;
      pendingTotalDelta.clicks += delta.mouseClickCount;
      pendingTotalDelta.activeSeconds += delta.activeSeconds;
      if (userId) pendingUserUpdates.set(userId, mergeActivityPayload(pendingUserUpdates.get(userId), data));
      if (!flushTimer) flushTimer = window.setTimeout(flushActivityBatch, DASHBOARD_REALTIME_FLUSH_MS);
    };

    const handleOverview = (overview = {}) => {
      if (range !== 'today') return;
      pendingTotalDelta = { keystrokes: 0, clicks: 0, activeSeconds: 0 };
      setTotals({
        keystrokes: Number(overview.totalKeystrokes || 0),
        clicks: Number(overview.totalMouseClicks || 0),
        activeSeconds: Number(overview.totalActiveSeconds || overview.totalActiveSecondsToday || 0),
        online: Number(overview.activeUsersNow || 0),
      });
    };

    const handleStatus = (data = {}) => {
      setUsers((prev) => {
        const userId = String(data.userId || data.user_id || '');
        const idx = prev.findIndex((user) => dashboardUserId(user) === userId);
        if (idx < 0) return prev;
        const nextStatus = data.presence || data.presenceStatus || data.status || 'online';
        const next = [...prev];
        next[idx] = { ...next[idx], status: nextStatus, presence: nextStatus, presenceStatus: nextStatus };
        return next;
      });
    };

    socket.on('activity:user:update', handleActivity);
    socket.on('user:status:update', handleStatus);
    socket.on('dashboard:overview:update', handleOverview);

    return () => {
      if (flashTimer) window.clearTimeout(flashTimer);
      if (flushTimer) window.clearTimeout(flushTimer);
      socket.off('activity:user:update', handleActivity);
      socket.off('user:status:update', handleStatus);
      socket.off('dashboard:overview:update', handleOverview);
    };
  }, [socket, pageVisible, range]);

  const activeUsers = useMemo(
    () => users.filter((user) => ONLINE_STATUSES.includes(String(user.status || user.presence || '').toLowerCase())).length,
    [users]
  );
  const currentOnlineUsers = Math.max(Number(totals.online || 0), activeUsers);
  const totalActions = Number(totals.keystrokes || 0) + Number(totals.clicks || 0);
  const previousActions = prevTotals ? Number(prevTotals.keystrokes || 0) + Number(prevTotals.clicks || 0) : null;

  const statCards = useMemo(() => ([
    {
      label: 'Đang online',
      value: currentOnlineUsers.toLocaleString(),
      delta: buildDelta(currentOnlineUsers, prevTotals?.online),
      note: `${currentOnlineUsers.toLocaleString()} người có tín hiệu hiện tại`,
      icon: Users,
      color: '#38bdf8',
      iconBg: 'rgba(56,189,248,0.1)',
    },
    {
      label: 'Thời gian active',
      value: formatDuration(totals.activeSeconds),
      delta: buildDelta(totals.activeSeconds, prevTotals?.activeSeconds),
      icon: Clock3,
      color: '#16a34a',
      iconBg: 'rgba(22,163,74,0.1)',
    },
    {
      label: 'Thao tác',
      value: formatNum(totalActions),
      delta: buildDelta(totalActions, previousActions),
      note: 'Gộp gõ phím và click chuột',
      icon: Activity,
      color: '#7c3aed',
      iconBg: 'rgba(124,58,237,0.1)',
    },
  ]), [currentOnlineUsers, prevTotals, previousActions, totalActions, totals.activeSeconds]);

  const tableRows = useMemo(() => users.map((user) => {
    const activeSeconds = Number(user.activeSeconds || user.active_seconds || user.total_active_seconds || 0);
    const idleSeconds = Number(user.idleSeconds || user.idle_seconds || user.total_idle_seconds || 0);
    const keystrokeCount = Number(user.keystrokeCount || user.keystrokes || 0);
    const mouseClickCount = Number(user.mouseClickCount || user.mouse_clicks || 0);
    return {
      ...user,
      id: user.user_id || user.id,
      status: user.status || user.presence || user.presenceStatus || 'offline',
      activeSeconds,
      idleSeconds,
      actions: keystrokeCount + mouseClickCount,
    };
  }), [users]);

  const onlineRows = useMemo(() => [...tableRows]
    .filter((user) => ONLINE_STATUSES.includes(String(user.status || '').toLowerCase()))
    .sort((a, b) => {
      const aStatus = STATUS_PRIORITY[String(a.status || '').toLowerCase()] ?? 9;
      const bStatus = STATUS_PRIORITY[String(b.status || '').toLowerCase()] ?? 9;
      if (aStatus !== bStatus) return aStatus - bStatus;
      return Number(b.activeSeconds || 0) - Number(a.activeSeconds || 0);
    })
    .slice(0, 12), [tableRows]);
  const hiddenOnlineCount = Math.max(0, currentOnlineUsers - onlineRows.length);

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero" data-tour="dashboard-overview">
        <div>
          <div className="dashboard-eyebrow">
            <Activity size={14} />
            Dashboard realtime
          </div>
          <h1>Tổng quan hoạt động</h1>
        </div>

        <div className="dashboard-hero-actions">
          <div className="dashboard-range-control" role="group" aria-label="Khoảng thời gian dashboard">
            {RANGES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                aria-pressed={range === key}
                onClick={() => setRange(key)}
                className={range === key ? 'active' : ''}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="dashboard-refresh-button"
            disabled={refreshing || loading}
            onClick={() => fetchData(range, { background: true })}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            Làm mới
          </button>
        </div>
      </section>

      {error && (
        <div className="dashboard-error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
          <button type="button" onClick={() => fetchData(range)}>Thử lại</button>
        </div>
      )}

      <section className="dashboard-stat-grid" data-tour="dashboard-stats">
        {statCards.map((card) => <StatCard key={card.label} card={card} loading={loading && !error} />)}
      </section>

      <section className="dashboard-live-card is-compact" data-tour="live-table">
        <div className="dashboard-table-header">
          <div>
            <h2>Người đang online</h2>
            <p>{currentOnlineUsers ? `${currentOnlineUsers.toLocaleString()} người có tín hiệu hiện tại` : 'Chưa có tín hiệu online'}</p>
          </div>
          <div className="dashboard-table-actions">
            <div className="dashboard-table-status">
              <span className={`dashboard-live-dot ${liveFlash ? 'flash' : ''}`} />
              <span>Live</span>
            </div>
            <button type="button" className="dashboard-table-link" onClick={() => navigate('/leaderboard')}>
              Xem xếp hạng
            </button>
          </div>
        </div>

        <div className="dashboard-online-list">
          {loading && !error ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="dashboard-online-row is-loading">
                <div className="dashboard-avatar dashboard-skeleton" />
                <div className="dashboard-online-skeleton-copy">
                  <div className="dashboard-skeleton" />
                  <div className="dashboard-skeleton" />
                </div>
              </div>
            ))
          ) : onlineRows.length === 0 ? (
            <div className="dashboard-empty-state">
              <Monitor size={28} />
              <strong>Chưa có người online</strong>
              <span>Mở Desktop Tracker để bắt đầu gửi tín hiệu hoạt động realtime.</span>
              <button type="button" onClick={() => navigate('/tracker')}>Mở Tracker</button>
            </div>
          ) : (
            onlineRows.map((user) => {
              const sc = statusConfig(user.status);
              const avatarUrl = getUserAvatar(user);
              const initials = initialsFromName(user.name || `User #${user.id}`);
              return (
                <button
                  key={user.id}
                  type="button"
                  className="dashboard-online-row"
                  onClick={() => navigate(`/users/${user.id}`)}
                >
                  <div className="dashboard-user-cell">
                    <div className="dashboard-avatar" data-avatar-refresh={avatarRefreshKey}>
                      {avatarUrl ? <img src={avatarUrl} alt={`Ảnh đại diện ${user.name || `User #${user.id}`}`} /> : initials}
                    </div>
                    <div>
                      <div className="dashboard-user-name">
                        {user.name || `User #${user.id}`}
                        {isVerifiedUser(user) && <VerifiedBadge size={14} />}
                      </div>
                      <div className="dashboard-online-meta">
                        <span>{formatDuration(user.activeSeconds)}</span>
                        <span>{formatNum(user.actions)} thao tác</span>
                      </div>
                    </div>
                  </div>
                  <span className="dashboard-status-pill is-compact" style={{ color: sc.color, background: sc.bg, borderColor: sc.border }}>
                    <span style={{ background: sc.dot }} />
                    {sc.label}
                  </span>
                </button>
              );
            })
          )}

          {!loading && hiddenOnlineCount > 0 && (
            <button type="button" className="dashboard-online-overflow" onClick={() => navigate('/leaderboard')}>
              +{hiddenOnlineCount.toLocaleString()} người khác trong bảng xếp hạng
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
