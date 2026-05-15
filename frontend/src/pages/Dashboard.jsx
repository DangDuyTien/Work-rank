import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboard, leaderboard } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getStoredAvatar, initialsFromName } from '../utils/avatar';
import { calculateRankScore } from '../utils/scoring';
import {
  Activity,
  AlertCircle,
  Clock3,
  Keyboard,
  Monitor,
  Mouse,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';

const VERIFIED_STORAGE_KEY = 'workrank:verified-users';
function loadVerifiedUsers() {
  try {
    const parsed = JSON.parse(localStorage.getItem(VERIFIED_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function isVerifiedUser(user, verifiedUsers) {
  const userId = String(user.user_id || user.id || '');
  return Boolean(user.verified || user.isVerified || verifiedUsers.includes(userId));
}

const STATUS_CONFIG = {
  active: { label: 'Đang hoạt động', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.35)', color: '#16a34a', dot: '#22c55e' },
  online: { label: 'Trực tuyến', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.35)', color: '#2563eb', dot: '#3b82f6' },
  idle: { label: 'Không hoạt động', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.35)', color: '#ca8a04', dot: '#eab308' },
  offline: { label: 'Ngoại tuyến', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)', color: '#64748b', dot: '#94a3b8' },
};

const RANGES = [
  { key: 'today', label: 'Hôm nay', description: 'Dữ liệu trong ngày hiện tại' },
  { key: 'week', label: 'Tuần này', description: 'Tổng hợp từ đầu tuần' },
  { key: 'month', label: 'Tháng này', description: 'Tổng hợp từ đầu tháng' },
];

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
  const [range, setRange] = useState('today');
  const [totals, setTotals] = useState({ keystrokes: 0, clicks: 0, activeSeconds: 0, online: 0 });
  const [prevTotals, setPrevTotals] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [users, setUsers] = useState([]);
  const [verifiedUsers, setVerifiedUsers] = useState(() => loadVerifiedUsers());
  const [searchQuery, setSearchQuery] = useState('');
  const [now, setNow] = useState(new Date());
  const [liveFlash, setLiveFlash] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
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
        leaderboard.get(selectedRange),
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
      setLastUpdatedAt(new Date());
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
    const syncVerifiedUsers = () => setVerifiedUsers(loadVerifiedUsers());
    window.addEventListener('storage', syncVerifiedUsers);
    window.addEventListener('workrank:verified-users-updated', syncVerifiedUsers);
    return () => {
      window.removeEventListener('storage', syncVerifiedUsers);
      window.removeEventListener('workrank:verified-users-updated', syncVerifiedUsers);
    };
  }, []);

  useEffect(() => {
    fetchData(range);
  }, [fetchData, range]);

  useEffect(() => {
    if (!socket) return undefined;
    let flashTimer = null;

    const eventBelongsToRange = (data = {}) => {
      if (range !== 'today') return true;
      return !data.statDate || data.statDate === localDateKey();
    };

    const handleActivity = (data = {}) => {
      if (!eventBelongsToRange(data)) return;
      setLiveFlash(true);
      setLastUpdatedAt(new Date());
      if (flashTimer) window.clearTimeout(flashTimer);
      flashTimer = window.setTimeout(() => setLiveFlash(false), 650);

      const delta = data.delta || {};
      setTotals((prev) => ({
        ...prev,
        keystrokes: prev.keystrokes + Number(delta.keystrokeCount ?? data.keystrokes ?? 0),
        clicks: prev.clicks + Number(delta.mouseClickCount ?? data.clicks ?? 0),
        activeSeconds: prev.activeSeconds + Number(delta.activeSeconds ?? 0),
      }));

      setUsers((prev) => {
        const userId = String(data.userId || data.user_id || '');
        if (!userId) return prev;
        const totals = data.totals || null;
        const deltaKeys = Number(delta.keystrokeCount ?? data.keystrokes ?? 0);
        const deltaClicks = Number(delta.mouseClickCount ?? data.clicks ?? 0);
        const deltaActiveSeconds = Number(delta.activeSeconds ?? data.activeSeconds ?? 0);
        const deltaIdleSeconds = Number(delta.idleSeconds ?? data.idleSeconds ?? 0);
        const nextStatus = data.presence || data.status || 'active';
        const idx = prev.findIndex((user) => String(user.user_id || user.id) === userId);

        if (idx >= 0) {
          const next = [...prev];
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
          };
          return next;
        }

        const keystrokeCount = totals ? Number(totals.keystrokeCount || 0) : deltaKeys;
        const mouseClickCount = totals ? Number(totals.mouseClickCount || 0) : deltaClicks;
        const activeSeconds = totals ? Number(totals.activeSeconds || 0) : deltaActiveSeconds;
        const idleSeconds = totals ? Number(totals.idleSeconds || 0) : deltaIdleSeconds;
        const focusScore = totals ? Number(totals.focusScore || 0) : Number(data.focusScore || 0);
        const score = calculateRankScore({ activeSeconds, idleSeconds, keystrokeCount, mouseClickCount, focusScore });

        return [...prev, {
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
        }];
      });
    };

    const handleOverview = (overview = {}) => {
      if (range !== 'today') return;
      setLastUpdatedAt(new Date());
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
        const idx = prev.findIndex((user) => String(user.user_id || user.id) === userId);
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
      socket.off('activity:user:update', handleActivity);
      socket.off('user:status:update', handleStatus);
      socket.off('dashboard:overview:update', handleOverview);
    };
  }, [socket, range]);

  const rangeMeta = RANGES.find((item) => item.key === range) || RANGES[0];
  const activeUsers = users.filter((user) => ['active', 'online'].includes(String(user.status || user.presence || '').toLowerCase())).length;
  const averageScore = users.length ? Math.round(users.reduce((sum, user) => sum + Number(user.score ?? calculateRankScore(user)), 0) / users.length) : 0;
  const lastUpdatedText = lastUpdatedAt
    ? lastUpdatedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Chưa cập nhật';

  const statCards = useMemo(() => ([
    {
      label: 'Đang online',
      value: totals.online.toLocaleString(),
      delta: buildDelta(totals.online, prevTotals?.online),
      note: `${activeUsers.toLocaleString()} người có tín hiệu hiện tại`,
      icon: Users,
      color: '#2563eb',
      iconBg: 'rgba(37,99,235,0.1)',
    },
    {
      label: 'Thời gian active',
      value: formatDuration(totals.activeSeconds),
      delta: buildDelta(totals.activeSeconds, prevTotals?.activeSeconds),
      note: `${rangeMeta.description}`,
      icon: Clock3,
      color: '#16a34a',
      iconBg: 'rgba(22,163,74,0.1)',
    },
    {
      label: 'Gõ phím',
      value: formatNum(totals.keystrokes),
      delta: buildDelta(totals.keystrokes, prevTotals?.keystrokes),
      note: 'Không lưu nội dung phím',
      icon: Keyboard,
      color: '#7c3aed',
      iconBg: 'rgba(124,58,237,0.1)',
    },
    {
      label: 'Click chuột',
      value: formatNum(totals.clicks),
      delta: buildDelta(totals.clicks, prevTotals?.clicks),
      note: `Điểm tổng TB: ${averageScore.toLocaleString()}`,
      icon: Mouse,
      color: '#ea580c',
      iconBg: 'rgba(234,88,12,0.1)',
    },
  ]), [activeUsers, averageScore, prevTotals, rangeMeta.description, totals]);

  const tableRows = users.map((user) => {
    const activeSeconds = Number(user.activeSeconds || user.active_seconds || user.total_active_seconds || 0);
    const idleSeconds = Number(user.idleSeconds || user.idle_seconds || user.total_idle_seconds || 0);
    const keystrokeCount = Number(user.keystrokeCount || user.keystrokes || 0);
    const mouseClickCount = Number(user.mouseClickCount || user.mouse_clicks || 0);
    const focusScore = Number(user.focusScore || 0);
    const activeMinutes = Math.max(1, activeSeconds / 60);
    return {
      ...user,
      id: user.user_id || user.id,
      status: user.status || user.presence || user.presenceStatus || 'offline',
      activeSeconds,
      idleSeconds,
      kpm: activeSeconds > 0 ? Math.round(keystrokeCount / activeMinutes) : 0,
      cpm: activeSeconds > 0 ? Math.round(mouseClickCount / activeMinutes) : 0,
      score: Number(user.score ?? calculateRankScore({ activeSeconds, idleSeconds, keystrokeCount, mouseClickCount, focusScore })),
    };
  });

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <div className="dashboard-eyebrow">
            <Activity size={14} />
            Dashboard realtime
          </div>
          <h1>Tổng quan hoạt động</h1>
          <p>
            Theo dõi trạng thái làm việc của nhóm từ Desktop Tracker. Web chỉ hiển thị dữ liệu đã được backend xác nhận.
          </p>
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

      <div className="dashboard-source-strip">
        <div>
          <Monitor size={15} />
          <span>Nguồn dữ liệu: Desktop Tracker</span>
        </div>
        <div>
          <span className={`dashboard-live-dot ${liveFlash ? 'flash' : ''}`} />
          <span>Cập nhật: {lastUpdatedText}</span>
        </div>
      </div>

      {error && (
        <div className="dashboard-error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
          <button type="button" onClick={() => fetchData(range)}>Thử lại</button>
        </div>
      )}

      <section className="dashboard-stat-grid">
        {statCards.map((card) => <StatCard key={card.label} card={card} loading={loading && !error} />)}
      </section>

      <section className="dashboard-live-card">
        <div className="dashboard-table-header">
          <div>
            <h2>Hoạt động thời gian thực</h2>
            <p>{tableRows.length ? `${tableRows.length} người dùng trong bảng xếp hạng hiện tại` : 'Chưa có dữ liệu cho khoảng thời gian này'}</p>
          </div>
          <div className="dashboard-table-status">
            <span className={`dashboard-live-dot ${liveFlash ? 'flash' : ''}`} />
            <span>Live</span>
          </div>
        </div>

        <div className="dashboard-realtime-table">
          <table>
            <thead>
              <tr>
                {['Người dùng', 'Trạng thái', 'Gõ/phút', 'Click/phút', 'Thời gian active', 'Điểm tổng'].map((heading) => (
                  <th key={heading} className={heading === 'Người dùng' || heading === 'Trạng thái' ? 'left' : 'right'}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && !error ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    <td colSpan={6}><div className="dashboard-row-skeleton" /></td>
                  </tr>
                ))
              ) : tableRows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="dashboard-empty-state">
                      <Monitor size={28} />
                      <strong>Chưa có hoạt động realtime</strong>
                      <span>Mở Desktop Tracker để bắt đầu gửi dữ liệu gõ phím, click và thời gian active.</span>
                      <button type="button" onClick={() => navigate('/tracker')}>Mở Tracker</button>
                    </div>
                  </td>
                </tr>
              ) : tableRows.map((user) => {
                const sc = statusConfig(user.status);
                const avatarUrl = getStoredAvatar(user.id) || user.avatarUrl || user.photoUrl || user.imageUrl || '';
                const initials = initialsFromName(user.name || `User #${user.id}`);
                return (
                  <tr
                    key={user.id}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(`/users/${user.id}`);
                      }
                    }}
                    onClick={() => navigate(`/users/${user.id}`)}
                  >
                    <td>
                      <div className="dashboard-user-cell">
                        <div className="dashboard-avatar">
                          {avatarUrl ? <img src={avatarUrl} alt={`Ảnh đại diện ${user.name || `User #${user.id}`}`} /> : initials}
                        </div>
                        <div>
                          <div className="dashboard-user-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {user.name || `User #${user.id}`}
                            {isVerifiedUser(user, verifiedUsers) && <VerifiedBadge size={14} />}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="dashboard-status-pill" style={{ color: sc.color, background: sc.bg, borderColor: sc.border }}>
                        <span style={{ background: sc.dot }} />
                        {sc.label}
                      </span>
                    </td>
                    <td className="right mono">{user.kpm.toLocaleString()}</td>
                    <td className="right mono">{user.cpm.toLocaleString()}</td>
                    <td className="right mono muted">{formatDuration(user.activeSeconds)}</td>
                    <td className="right">
                      <span className="dashboard-score" data-tone={user.score >= 850 ? 'good' : user.score >= 600 ? 'ok' : 'warn'}>
                        {user.score.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
