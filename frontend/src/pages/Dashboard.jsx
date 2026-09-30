import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboard, leaderboard, youtube } from '../services/api';
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
  Tv,
  Eye,
  ChevronRight,
} from 'lucide-react';

import VerifiedBadge from '../components/VerifiedBadge';
import JobTitleBadge from '../components/JobTitleBadge';
import usePageVisibility from '../hooks/usePageVisibility';
import CompetitionProgressWidget from '../components/CompetitionProgressWidget';

function isVerifiedUser(user) {
  return user.verified === true || user.isVerified === true || user.verified === 1 || user.isVerified === 1 || user.verified === '1' || user.isVerified === '1';
}

const STATUS_CONFIG = {
  active: { label: 'Đang hoạt động', bg: 'rgba(21,128,61,0.08)', border: 'rgba(21,128,61,0.25)', color: '#15803d', dot: '#15803d' },
  online: { label: 'Trực tuyến', bg: 'rgba(180,83,9,0.08)', border: 'rgba(180,83,9,0.25)', color: '#b45309', dot: '#b45309' },
  idle: { label: 'Không hoạt động', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.25)', color: '#b45309', dot: '#d97706' },
  offline: { label: 'Ngoại tuyến', bg: 'rgba(0,0,0,0.04)', border: 'rgba(0,0,0,0.08)', color: '#777777', dot: '#a3a3a3' },
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
  const { user, socket } = useAuth();
  const navigate = useNavigate();
  const pageVisible = usePageVisibility();
  const [range, setRange] = useState('today');
  const [totals, setTotals] = useState({ keystrokes: 0, clicks: 0, activeSeconds: 0, online: 0 });
  const [prevTotals, setPrevTotals] = useState(null);
  const [users, setUsers] = useState([]);
  const [teamYouTube, setTeamYouTube] = useState(null);
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
      const [leaderboardRes, overviewRes, ytRes] = await Promise.all([
        leaderboard.get(selectedRange, { limit: DASHBOARD_LEADERBOARD_LIMIT }),
        dashboard.overview(selectedRange),
        user?.teamId ? youtube.getTeamDetails(user.teamId).catch(() => null) : youtube.getOverview().catch(() => null),
      ]);
      if (requestId !== requestIdRef.current) return;

      if (ytRes) {
        setTeamYouTube(ytRes);
      }

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

    const handleOverview = (overview = {}) => {
      if (range !== 'today') return;
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

    socket.on('user:status:update', handleStatus);
    socket.on('dashboard:overview:update', handleOverview);

    return () => {
      socket.off('user:status:update', handleStatus);
      socket.off('dashboard:overview:update', handleOverview);
    };
  }, [socket, pageVisible, range]);

  const activeUsers = useMemo(
    () => users.filter((user) => ONLINE_STATUSES.includes(String(user.status || user.presence || '').toLowerCase())).length,
    [users]
  );
  const currentOnlineUsers = Math.max(Number(totals.online || 0), activeUsers);

  const statCards = useMemo(() => ([
    {
      label: 'Đang online',
      value: currentOnlineUsers.toLocaleString(),
      delta: buildDelta(currentOnlineUsers, prevTotals?.online),
      note: `${currentOnlineUsers.toLocaleString()} thành viên đang hoạt động`,
      icon: Users,
      color: '#111111',
      iconBg: 'rgba(0,0,0,0.05)',
    },
    {
      label: 'Tổng thành viên xếp hạng',
      value: users.length.toLocaleString(),
      delta: buildDelta(users.length, prevTotals ? users.length : null),
      icon: Activity,
      color: '#111111',
      iconBg: 'rgba(0,0,0,0.05)',
    },
  ]), [currentOnlineUsers, prevTotals, users.length]);

  const tableRows = useMemo(() => users.map((user) => {
    return {
      ...user,
      id: user.user_id || user.id,
      status: user.status || user.presence || user.presenceStatus || 'offline',
      score: Number(user.score || 0),
    };
  }), [users]);

  const onlineRows = useMemo(() => [...tableRows]
    .filter((user) => ONLINE_STATUSES.includes(String(user.status || '').toLowerCase()))
    .sort((a, b) => {
      const aStatus = STATUS_PRIORITY[String(a.status || '').toLowerCase()] ?? 9;
      const bStatus = STATUS_PRIORITY[String(b.status || '').toLowerCase()] ?? 9;
      if (aStatus !== bStatus) return aStatus - bStatus;
      return Number(b.score || 0) - Number(a.score || 0);
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
          <h1>Tổng quan thi đấu & hoạt động</h1>
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

      <CompetitionProgressWidget />

      {/* YOUTUBE PERFORMANCE CARD */}
      {teamYouTube && (
        <section
          style={{
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            padding: '18px 22px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 8,
                background: 'rgba(185,28,28,0.08)',
                color: '#b91c1c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Tv size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#111111' }}>
                  {teamYouTube.team?.name ? `Thành Tích YouTube: ${teamYouTube.team.name}` : 'YouTube Studio Toàn Công Ty'}
                </span>
                {teamYouTube.summary?.rankByViews && (
                  <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(185,28,28,0.08)', color: '#b91c1c', fontSize: 11, fontWeight: 800 }}>
                    Hạng #{teamYouTube.summary.rankByViews}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#666666', marginTop: 2 }}>
                {teamYouTube.summary
                  ? `${teamYouTube.channels?.length || teamYouTube.summary.channelsCount || 0} kênh • ${teamYouTube.summary.videosCount || 0} video xuất bản`
                  : `${teamYouTube.kpis?.totalChannels || 0} kênh hoạt động • ${teamYouTube.kpis?.totalVideos || 0} video`}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: '#777777', fontWeight: 700, textTransform: 'uppercase' }}>TỔNG LƯỢT XEM</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#111111' }}>
                {formatNum(teamYouTube.summary?.totalViews ?? teamYouTube.kpis?.totalViews ?? 0)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#777777', fontWeight: 700, textTransform: 'uppercase' }}>SUBSCRIBERS</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#111111' }}>
                {formatNum(teamYouTube.summary?.totalSubscribers ?? teamYouTube.kpis?.totalSubscribers ?? 0)}
              </div>
            </div>
            {teamYouTube.summary && (
              <div>
                <div style={{ fontSize: 11, color: '#777777', fontWeight: 700, textTransform: 'uppercase' }}>TĂNG TRƯỞNG 30D</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#15803d' }}>
                  +{teamYouTube.summary.viewsGrowth30dPct || 0}%
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => navigate('/rankings?scope=youtube')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: '#ffffff',
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 6,
                color: '#111111',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
            >
              <span>Xem BXH YouTube</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </section>
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
            <button type="button" className="dashboard-table-link" onClick={() => navigate('/rankings')}>
              Xem trung tâm BXH
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
              <span>Tham gia giải đấu Arena để bắt đầu ghi điểm trên bảng xếp hạng.</span>
              <button type="button" onClick={() => navigate('/arena')}>Vào Arena</button>
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
                      <div className="dashboard-user-name" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{user.name || `User #${user.id}`}</span>
                        {isVerifiedUser(user) && <VerifiedBadge size={14} />}
                        {user.jobTitle && <JobTitleBadge jobTitle={user.jobTitle} size="xs" />}
                      </div>
                      <div className="dashboard-online-meta">
                        <span>{user.score?.toLocaleString() || 0} điểm XP</span>
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
