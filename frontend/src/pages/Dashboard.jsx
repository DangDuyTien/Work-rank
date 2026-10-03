import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboard, leaderboard, youtube } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AVATAR_UPDATED_EVENT, getUserAvatar, initialsFromName } from '../utils/avatar';
import {
  Activity,
  AlertCircle,
  Clock3,
  Monitor,
  RefreshCw,
  Users,
  Tv,
  ChevronRight,
  Building2,
  Search,
  ArrowLeft,
  ExternalLink,
  Trophy,
} from 'lucide-react';

import VerifiedBadge from '../components/VerifiedBadge';
import JobTitleBadge from '../components/JobTitleBadge';
import usePageVisibility from '../hooks/usePageVisibility';
import CompetitionProgressWidget from '../components/CompetitionProgressWidget';
import YouTubeTrendChart from '../components/YouTubeTrendChart';
import TeamComparisonBar from '../components/TeamComparisonBar';
import ChannelDetailModal from '../components/ChannelDetailModal';
import { getCached, fetchWithCache, CACHE_KEYS, isDeepEqual } from '../services/cache';

function isVerifiedUser(user) {
  return (
    user?.verified === true ||
    user?.isVerified === true ||
    user?.verified === 1 ||
    user?.isVerified === 1 ||
    user?.verified === '1'
  );
}

const STATUS_CONFIG = {
  active: {
    label: 'Đang hoạt động',
    bg: 'rgba(21,128,61,0.08)',
    border: 'rgba(21,128,61,0.25)',
    color: '#15803d',
    dot: '#15803d',
  },
  online: {
    label: 'Trực tuyến',
    bg: 'rgba(180,83,9,0.08)',
    border: 'rgba(180,83,9,0.25)',
    color: '#b45309',
    dot: '#b45309',
  },
  idle: {
    label: 'Không hoạt động',
    bg: 'rgba(217,119,6,0.08)',
    border: 'rgba(217,119,6,0.25)',
    color: '#b45309',
    dot: '#d97706',
  },
  offline: {
    label: 'Ngoại tuyến',
    bg: 'rgba(0,0,0,0.04)',
    border: 'rgba(0,0,0,0.08)',
    color: '#777777',
    dot: '#a3a3a3',
  },
};

const RANGES = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'week', label: 'Tuần này' },
  { key: 'month', label: 'Tháng này' },
];

const ONLINE_STATUSES = ['active', 'online', 'idle'];
const STATUS_PRIORITY = { active: 0, online: 1, idle: 2, offline: 3 };
const DASHBOARD_LEADERBOARD_LIMIT = 24;

function formatNum(value) {
  const n = Number(value) || 0;
  if (n >= 1000000000) return (n / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toLocaleString();
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return 'Chưa đồng bộ';
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

function statusConfig(status) {
  return STATUS_CONFIG[String(status || 'offline').toLowerCase()] || STATUS_CONFIG.offline;
}

function normalizeTotals(raw) {
  if (!raw || typeof raw !== 'object') return { keystrokes: 0, clicks: 0, activeSeconds: 0, online: 0 };
  return {
    keystrokes: Number(raw.keystrokes ?? raw.totalKeystrokes ?? 0),
    clicks: Number(raw.clicks ?? raw.totalMouseClicks ?? 0),
    activeSeconds: Number(raw.activeSeconds ?? raw.totalActiveSeconds ?? raw.totalActiveSecondsToday ?? 0),
    online: Number(raw.online ?? raw.activeUsersNow ?? 0),
  };
}

function normalizeUserList(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.users)) return raw.users;
  return [];
}

function normalizeChannelList(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.channels)) return raw.channels;
  return [];
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const pageVisible = usePageVisibility();

  const cachedTotals = normalizeTotals(getCached(CACHE_KEYS.DASHBOARD_TOTALS('today')));
  const cachedUsers = normalizeUserList(getCached(CACHE_KEYS.DASHBOARD_USERS('today')));
  const cachedCompanyYt = isAdmin ? getCached(CACHE_KEYS.DASHBOARD_YT_COMPANY('30d')) : null;
  const cachedMemberYt = !isAdmin ? getCached(CACHE_KEYS.DASHBOARD_YT_MEMBER('30d')) : null;
  const cachedChannels = isAdmin ? normalizeChannelList(getCached(CACHE_KEYS.DASHBOARD_YT_CHANNELS())) : [];

  const hasInitialCache = Boolean(
    (cachedTotals && (cachedTotals.keystrokes > 0 || cachedTotals.online > 0)) ||
    cachedUsers.length > 0 ||
    cachedCompanyYt ||
    cachedMemberYt ||
    cachedChannels.length > 0
  );

  // Basic dashboard range & presence states
  const [range, setRange] = useState('today');
  const [totals, setTotals] = useState(() => cachedTotals);
  const [users, setUsers] = useState(() => cachedUsers);
  const [loading, setLoading] = useState(!hasInitialCache);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);

  // YouTube module states
  const [ytPeriod, setYtPeriod] = useState('30d');
  const [companyOverview, setCompanyOverview] = useState(() => cachedCompanyYt || null);
  const [memberOverview, setMemberOverview] = useState(() => cachedMemberYt || null);
  const [allChannels, setAllChannels] = useState(() => cachedChannels);

  // Admin Drill-down & Comparison states
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [drilldownTeamDetails, setDrilldownTeamDetails] = useState(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [compareMetric, setCompareMetric] = useState('views'); // 'views' | 'subscribers'
  const [channelFilter, setChannelFilter] = useState('all'); // 'all' | 'assigned' | 'unassigned'
  const [channelSearch, setChannelSearch] = useState('');

  // Modal state
  const [activeModalChannelId, setActiveModalChannelId] = useState(null);

  const requestIdRef = useRef(0);

  // Main data fetch: Online/Presence & YouTube ONLY (No tracking / activity fetch)
  const fetchData = useCallback(
    async (selectedRange, period = ytPeriod, options = {}) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const background = options.background === true;

      const cachedRangeTotals = getCached(CACHE_KEYS.DASHBOARD_TOTALS(selectedRange));
      const cachedRangeUsers = getCached(CACHE_KEYS.DASHBOARD_USERS(selectedRange));
      const safeRangeTotals = cachedRangeTotals ? normalizeTotals(cachedRangeTotals) : null;
      const safeRangeUsers = cachedRangeUsers ? normalizeUserList(cachedRangeUsers) : [];
      const hasCachedRange = Boolean(safeRangeTotals || safeRangeUsers.length > 0);

      if (hasCachedRange) {
        if (safeRangeTotals) setTotals((prev) => (isDeepEqual(prev, safeRangeTotals) ? prev : safeRangeTotals));
        if (safeRangeUsers.length > 0) setUsers((prev) => (isDeepEqual(prev, safeRangeUsers) ? prev : safeRangeUsers));
        setLoading(false);
        setRefreshing(true);
      } else if (!background) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError('');

      try {
        const calls = [
          fetchWithCache(CACHE_KEYS.DASHBOARD_USERS(selectedRange), async () => {
            const res = await leaderboard.get(selectedRange, { limit: DASHBOARD_LEADERBOARD_LIMIT });
            return normalizeUserList(res);
          }),
          fetchWithCache(CACHE_KEYS.DASHBOARD_TOTALS(selectedRange), async () => {
            const res = await dashboard.overview(selectedRange);
            return normalizeTotals(res.data || res || {});
          }),
        ];

        if (isAdmin) {
          calls.push(
            fetchWithCache(CACHE_KEYS.DASHBOARD_YT_COMPANY(period), () => youtube.getOverview({ period })).catch(() => null)
          );
          calls.push(
            fetchWithCache(CACHE_KEYS.DASHBOARD_YT_CHANNELS(), async () => {
              const res = await youtube.getLeaderboard({ view: 'channels', limit: 200 });
              return normalizeChannelList(res);
            }).catch(() => [])
          );
        } else {
          calls.push(
            fetchWithCache(CACHE_KEYS.DASHBOARD_YT_MEMBER(period), () => youtube.getMyOverview({ period })).catch(() => null)
          );
        }

        const results = await Promise.all(calls);
        if (requestId !== requestIdRef.current) return;

        const [leaderboardRes, overviewData, ytDataRes, channelsRes] = results;

        if (isAdmin) {
          if (ytDataRes) setCompanyOverview((prev) => (isDeepEqual(prev, ytDataRes) ? prev : ytDataRes));
          const chItems = normalizeChannelList(channelsRes);
          setAllChannels((prev) => (isDeepEqual(prev, chItems) ? prev : chItems));
        } else {
          if (ytDataRes) setMemberOverview((prev) => (isDeepEqual(prev, ytDataRes) ? prev : ytDataRes));
        }

        const newTotals = normalizeTotals(overviewData);
        const newUsersList = normalizeUserList(leaderboardRes);
        setUsers((prev) => (isDeepEqual(prev, newUsersList) ? prev : newUsersList));
        setTotals((prev) => (isDeepEqual(prev, newTotals) ? prev : newTotals));
      } catch (err) {
        if (requestId === requestIdRef.current) {
          setError(err?.response?.data?.message || err?.message || 'Không tải được dữ liệu dashboard');
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [isAdmin, ytPeriod]
  );

  // Load team drilldown if selected
  const fetchTeamDrilldown = useCallback(async (teamId, period) => {
    if (!teamId) {
      setDrilldownTeamDetails(null);
      return;
    }
    setDrilldownLoading(true);
    try {
      const data = await youtube.getTeamDetails(teamId, { period });
      setDrilldownTeamDetails(data);
    } catch {
      setDrilldownTeamDetails(null);
    } finally {
      setDrilldownLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTeamId) {
      fetchTeamDrilldown(selectedTeamId, ytPeriod);
    }
  }, [selectedTeamId, ytPeriod, fetchTeamDrilldown]);

  useEffect(() => {
    if (pageVisible) fetchData(range, ytPeriod);
  }, [fetchData, pageVisible, range, ytPeriod]);

  useEffect(() => {
    const refreshAvatars = () => setAvatarRefreshKey((k) => k + 1);
    window.addEventListener(AVATAR_UPDATED_EVENT, refreshAvatars);
    return () => window.removeEventListener(AVATAR_UPDATED_EVENT, refreshAvatars);
  }, []);

  // Filtered channels list for admin
  const filteredChannels = useMemo(() => {
    const safeChannels = normalizeChannelList(allChannels);
    let list = [...safeChannels];
    if (channelFilter === 'assigned') {
      list = list.filter((c) => Boolean(c?.teamId));
    } else if (channelFilter === 'unassigned') {
      list = list.filter((c) => !c?.teamId);
    }

    if (channelSearch.trim()) {
      const q = channelSearch.trim().toLowerCase();
      list = list.filter((c) => (c?.title || '').toLowerCase().includes(q) || (c?.customUrl || '').toLowerCase().includes(q));
    }
    return list;
  }, [allChannels, channelFilter, channelSearch]);

  const activeUsers = useMemo(
    () => normalizeUserList(users).filter((u) => ONLINE_STATUSES.includes(String(u?.status || u?.presence || '').toLowerCase())).length,
    [users]
  );
  const currentOnlineUsers = Math.max(Number(totals.online || 0), activeUsers);

  const onlineRows = useMemo(() => {
    const safeUsers = normalizeUserList(users);
    return [...safeUsers]
      .filter((u) => ONLINE_STATUSES.includes(String(u?.status || u?.presence || '').toLowerCase()))
      .sort((a, b) => {
        const aStatus = STATUS_PRIORITY[String(a?.status || a?.presence || '').toLowerCase()] ?? 9;
        const bStatus = STATUS_PRIORITY[String(b?.status || b?.presence || '').toLowerCase()] ?? 9;
        if (aStatus !== bStatus) return aStatus - bStatus;
        return Number(b?.score || 0) - Number(a?.score || 0);
      })
      .slice(0, 12);
  }, [users]);

  return (
    <div className="dashboard-page">
      {/* ── 1. HERO SECTION ─────────────────────────────────────────────────── */}
      <section className="dashboard-hero" data-tour="dashboard-overview">
        <div>
          <div className="dashboard-eyebrow">
            <Activity size={14} />
            WorkRank Analytics
          </div>
          <h1>{isAdmin ? 'Trung tâm Quản trị & Hiệu suất' : 'Tổng quan & Hiệu suất của tôi'}</h1>
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
            onClick={() => fetchData(range, ytPeriod, { background: true })}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            Làm mới
          </button>
        </div>
      </section>

      {/* ── ERROR ALERT ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="dashboard-error" role="alert" style={{ marginBottom: 20 }}>
          <AlertCircle size={17} />
          <span>{error}</span>
          <button type="button" onClick={() => fetchData(range, ytPeriod)}>
            Thử lại
          </button>
        </div>
      )}

      {/* ── 2. COMPETITION PROGRESS WIDGET ───────────────────────────────────── */}
      <CompetitionProgressWidget />

      {/* ── 3. YOUTUBE MODULE (ADMIN & MEMBER VIEWS) ─────────────────────────── */}
      {/* ── 3A. ADMIN DASHBOARD VIEW (COMPANY -> TEAM -> CHANNEL DRILL-DOWN) ─── */}
      {isAdmin && (
        <div style={{ marginBottom: 30 }}>
          {/* Section Heading & Quick Nav */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  background: '#fee2e2',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Tv size={16} />
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Hiệu suất YouTube Toàn Công Ty (Cấp 1)
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => navigate('/youtube')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 12px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <span>Studio Hub</span>
                <ExternalLink size={13} />
              </button>
              <button
                type="button"
                onClick={() => navigate('/rankings?scope=youtube')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 12px',
                  background: '#0f172a',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <span>BXH YouTube</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* KPI CARDS GRID */}
          {companyOverview?.kpis && (
            <div className="youtube-kpis-grid" style={{ marginBottom: 16 }}>
              {/* Total Views */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '16px 18px' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  TỔNG LƯỢT XEM
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 22,
                    fontWeight: 700,
                    color: '#0f172a',
                    marginTop: 4,
                  }}
                >
                  {formatNum(companyOverview.kpis.totalViews)}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Tích lũy toàn hệ thống</div>
              </div>

              {/* Total Subscribers */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '16px 18px' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  SUBSCRIBERS
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 22,
                    fontWeight: 700,
                    color: '#0f172a',
                    marginTop: 4,
                  }}
                >
                  {formatNum(companyOverview.kpis.totalSubscribers)}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Người đăng ký thực tế</div>
              </div>

              {/* Growth % */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '16px 18px' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  TĂNG TRƯỞNG KỲ ({ytPeriod.toUpperCase()})
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 22,
                    fontWeight: 700,
                    color:
                      companyOverview.kpis.viewsGrowthPct !== null
                        ? companyOverview.kpis.viewsGrowthPct >= 0
                          ? '#10b981'
                          : '#ef4444'
                        : '#64748b',
                    marginTop: 4,
                  }}
                >
                  {companyOverview.kpis.viewsGrowthPct !== null
                    ? `${companyOverview.kpis.viewsGrowthPct >= 0 ? '+' : ''}${Number(companyOverview.kpis.viewsGrowthPct).toFixed(1)}%`
                    : 'Chưa đủ dữ liệu'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Đối chiếu snapshot kỳ trước</div>
              </div>

              {/* Channels & Teams Count */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '16px 18px' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  KÊNH & ĐỘI NHÓM
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 22,
                    fontWeight: 700,
                    color: '#0f172a',
                    marginTop: 4,
                  }}
                >
                  {companyOverview.kpis.totalChannels}{' '}
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>kênh /</span>{' '}
                  {companyOverview.kpis.totalTeams}{' '}
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>đội</span>
                </div>
                <div style={{ marginTop: 4 }}>
                  {companyOverview.kpis.unassignedChannelsCount > 0 ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        background: '#fef3c7',
                        color: '#b45309',
                        padding: '2px 6px',
                        border: '1px solid #fde68a',
                      }}
                    >
                      {companyOverview.kpis.unassignedChannelsCount} kênh chưa gán đội
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>100% kênh đã gán đội</span>
                  )}
                </div>
              </div>

              {/* Sync Status */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '16px 18px' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  ĐỒNG BỘ MỚI NHẤT
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#0f172a',
                    marginTop: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Clock3 size={16} color="#64748b" />
                  <span>{formatRelativeTime(companyOverview.kpis.lastSyncedAt)}</span>
                </div>
                <div style={{ marginTop: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      background: companyOverview.kpis.freshnessStatus === 'FRESH' ? '#ecfdf5' : '#fffbeb',
                      color: companyOverview.kpis.freshnessStatus === 'FRESH' ? '#047857' : '#b45309',
                      border: `1px solid ${companyOverview.kpis.freshnessStatus === 'FRESH' ? '#a7f3d0' : '#fde68a'}`,
                    }}
                  >
                    {companyOverview.kpis.freshnessStatus === 'FRESH' ? 'Tín hiệu chuẩn' : 'Cần cập nhật'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* IF ADMIN DRILLED DOWN INTO A SPECIFIC TEAM */}
          {selectedTeamId && (
            <div style={{ marginBottom: 20, background: '#f8fafc', border: '1px solid #cbd5e1', padding: 18 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 14,
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setSelectedTeamId(null)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '5px 10px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <ArrowLeft size={14} />
                    <span>Quay lại Toàn Công Ty</span>
                  </button>
                  <span style={{ color: '#94a3b8' }}>/</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                    Chi tiết Đội: {drilldownTeamDetails?.team?.name || `Đội #${selectedTeamId}`}
                  </span>
                </div>
              </div>

              {drilldownLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                  <RefreshCw size={20} className="spin" style={{ marginBottom: 8 }} />
                  <div>Đang tải thông tin đội nhóm...</div>
                </div>
              ) : drilldownTeamDetails ? (
                <div>
                  {/* Team Trend Chart */}
                  <div style={{ marginBottom: 16 }}>
                    <YouTubeTrendChart
                      data={drilldownTeamDetails.history || []}
                      period={ytPeriod}
                      onPeriodChange={(newPeriod) => setYtPeriod(newPeriod)}
                      title={`Tăng trưởng Đội: ${drilldownTeamDetails.team?.name}`}
                    />
                  </div>

                  {/* Team Channels Table */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
                      Các kênh thuộc đội ({drilldownTeamDetails.channels?.length || 0})
                    </div>
                    {drilldownTeamDetails.channels?.length === 0 ? (
                      <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                        Đội này chưa có kênh YouTube nào được gán.
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                          gap: 10,
                        }}
                      >
                        {(drilldownTeamDetails.channels || []).map((c) => (
                          <div
                            key={c.id}
                            onClick={() => setActiveModalChannelId(c.id)}
                            style={{
                              padding: '10px 12px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {c.thumbnailUrl ? (
                                <img
                                  src={c.thumbnailUrl}
                                  alt={c.title}
                                  style={{ width: 32, height: 32, borderRadius: 16 }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: 32,
                                    height: 32,
                                    background: '#fee2e2',
                                    color: '#ef4444',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Tv size={16} />
                                </div>
                              )}
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{c.title}</div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>{formatNum(c.views)} views</div>
                              </div>
                            </div>
                            <ChevronRight size={14} color="#94a3b8" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* IF IN COMPANY VIEW (NOT DRILLED DOWN) */}
          {!selectedTeamId && (
            <div>
              {/* COMPANY TREND CHART */}
              <div style={{ marginBottom: 20 }}>
                <YouTubeTrendChart
                  data={companyOverview?.history || []}
                  period={ytPeriod}
                  onPeriodChange={(newPeriod) => setYtPeriod(newPeriod)}
                  title="Biểu đồ tăng trưởng YouTube toàn công ty"
                />
              </div>

              {/* TWO-COLUMN ANALYTICS: TEAMS PERFORMANCE & CHANNELS PERFORMANCE */}
              <div className="analytics-two-columns-grid">
                {/* COLUMN 1: TEAM PERFORMANCE & COMPARISON */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 18 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Building2 size={16} color="#0f172a" />
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                        Hiệu suất theo Đội nhóm (Cấp 2)
                      </h3>
                    </div>
                    {/* Metric switcher for comparison */}
                    <div style={{ display: 'flex', background: '#f1f5f9', padding: 2 }}>
                      <button
                        type="button"
                        onClick={() => setCompareMetric('views')}
                        style={{
                          padding: '3px 8px',
                          fontSize: 10,
                          fontWeight: 700,
                          border: 'none',
                          cursor: 'pointer',
                          background: compareMetric === 'views' ? '#ffffff' : 'transparent',
                          color: compareMetric === 'views' ? '#0f172a' : '#64748b',
                        }}
                      >
                        Views
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompareMetric('subscribers')}
                        style={{
                          padding: '3px 8px',
                          fontSize: 10,
                          fontWeight: 700,
                          border: 'none',
                          cursor: 'pointer',
                          background: compareMetric === 'subscribers' ? '#ffffff' : 'transparent',
                          color: compareMetric === 'subscribers' ? '#0f172a' : '#64748b',
                        }}
                      >
                        Subs
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Bar Chart */}
                  <div style={{ marginBottom: 16 }}>
                    <TeamComparisonBar
                      teams={companyOverview?.allTeams || []}
                      metric={compareMetric}
                      onSelectTeam={(teamId) => setSelectedTeamId(teamId)}
                      limit={5}
                    />
                  </div>

                  {/* Teams Mini Table */}
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        marginBottom: 8,
                      }}
                    >
                      Tất cả các đội ({companyOverview?.allTeams?.length || 0}) — Bấm để drill-down
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        maxHeight: 220,
                        overflowY: 'auto',
                      }}
                    >
                      {(companyOverview?.allTeams || []).map((t) => (
                        <div
                          key={t.teamId}
                          onClick={() => setSelectedTeamId(t.teamId)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            background: '#f8fafc',
                            cursor: 'pointer',
                            fontSize: 12,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>{t.teamName}</span>
                            <span style={{ fontSize: 11, color: '#64748b' }}>({t.channelsCount} kênh)</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontWeight: 700,
                                color: '#0f172a',
                              }}
                            >
                              {formatNum(t.totalViews)}
                            </span>
                            <ChevronRight size={13} color="#94a3b8" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* COLUMN 2: CHANNEL PERFORMANCE LIST */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 18 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Tv size={16} color="#0f172a" />
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                        Danh Sách Kênh Toàn Công Ty ({normalizeChannelList(allChannels).length})
                      </h3>
                    </div>

                    {/* Filter tabs */}
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => setChannelFilter('all')}
                        style={{
                          padding: '3px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          background: channelFilter === 'all' ? '#0f172a' : '#f1f5f9',
                          color: channelFilter === 'all' ? '#ffffff' : '#64748b',
                        }}
                      >
                        Tất cả
                      </button>
                      <button
                        type="button"
                        onClick={() => setChannelFilter('assigned')}
                        style={{
                          padding: '3px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          background: channelFilter === 'assigned' ? '#0f172a' : '#f1f5f9',
                          color: channelFilter === 'assigned' ? '#ffffff' : '#64748b',
                        }}
                      >
                        Đã gán
                      </button>
                      <button
                        type="button"
                        onClick={() => setChannelFilter('unassigned')}
                        style={{
                          padding: '3px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          background: channelFilter === 'unassigned' ? '#b45309' : '#fef3c7',
                          color: channelFilter === 'unassigned' ? '#ffffff' : '#b45309',
                        }}
                      >
                        Chưa gán
                      </button>
                    </div>
                  </div>

                  {/* Search box */}
                  <div style={{ marginBottom: 12, position: 'relative' }}>
                    <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 9 }} />
                    <input
                      type="text"
                      placeholder="Tìm kiếm kênh theo tên hoặc handle..."
                      value={channelSearch}
                      onChange={(e) => setChannelSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px 6px 30px',
                        fontSize: 12,
                        border: '1px solid #cbd5e1',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* Channel List */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      maxHeight: 340,
                      overflowY: 'auto',
                    }}
                  >
                    {filteredChannels.length === 0 ? (
                      <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                        Không tìm thấy kênh phù hợp với bộ lọc.
                      </div>
                    ) : (
                      filteredChannels.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => setActiveModalChannelId(c.id)}
                          style={{
                            padding: '8px 10px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {c.thumbnailUrl ? (
                              <img
                                src={c.thumbnailUrl}
                                alt={c.title}
                                style={{ width: 28, height: 28, borderRadius: 14 }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  background: '#fee2e2',
                                  color: '#ef4444',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Tv size={14} />
                              </div>
                            )}
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{c.title}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                {c.team?.name ? (
                                  <span style={{ fontSize: 10, background: '#e0e7ff', color: '#4338ca', padding: '1px 5px' }}>
                                    {c.team.name}
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      background: '#fef3c7',
                                      color: '#b45309',
                                      padding: '1px 5px',
                                      fontWeight: 600,
                                    }}
                                  >
                                    Chưa gán đội
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#0f172a',
                              }}
                            >
                              {formatNum(c.views)} views
                            </div>
                            <div style={{ fontSize: 10, color: '#64748b' }}>{formatNum(c.subscribers)} subs</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 3B. MEMBER DASHBOARD VIEW ("CỦA TÔI" - PERSONAL SCOPE) ───────────── */}
      {!isAdmin && (
        <div style={{ marginBottom: 30 }}>
          {/* Section Heading */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div
              style={{
                width: 28,
                height: 28,
                background: '#dbeafe',
                color: '#1d4ed8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={16} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Tổng Quan Cá Nhân & Hiệu Suất Của Tôi
            </h2>
          </div>

          {/* 3-GRID CARDS: MY PROFILE / MY RANKING / MY TEAM */}
          <div className="member-overview-grid">
            {/* CARD 1: MY PROFILE */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 18 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                HỒ SƠ CÁ NHÂN
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    background: '#0f172a',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 16,
                  }}
                >
                  {getUserAvatar(user) ? (
                    <img
                      src={getUserAvatar(user)}
                      alt={user?.name}
                      style={{ width: 44, height: 44, borderRadius: 22, objectFit: 'cover' }}
                    />
                  ) : (
                    initialsFromName(user?.name)
                  )}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{user?.name}</span>
                    {isVerifiedUser(user) && <VerifiedBadge size={14} />}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {user?.jobTitle || 'Thành viên'} • {user?.department || 'Media & Content'}
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: MY RANKING (CANONICAL ALL-TIME MATCHING /rankings) */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 18 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  THỨ HẠNG CÁ NHÂN (TOÀN THỜI GIAN)
                </span>
                <Trophy size={14} color="#b45309" />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 26,
                    fontWeight: 800,
                    color: '#0f172a',
                  }}
                >
                  #{memberOverview?.ranking?.rank || 1}
                </span>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  / {memberOverview?.ranking?.totalUsers || 1} thành viên
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 8,
                  fontSize: 12,
                }}
              >
                <span style={{ color: '#0f172a', fontWeight: 600 }}>
                  {formatNum(memberOverview?.ranking?.score || 0)} XP
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/rankings?scope=members&period=all-time')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Xem bảng xếp hạng →
                </button>
              </div>
            </div>

            {/* CARD 3: MY TEAM */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 18 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                ĐỘI NHÓM CỦA TÔI
              </div>
              {memberOverview?.team ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                      {memberOverview.team.name}
                    </div>
                    {memberOverview.teamSummary?.rankByViews && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          background: '#fef3c7',
                          color: '#b45309',
                          padding: '2px 7px',
                          border: '1px solid #fde68a',
                        }}
                      >
                        Hạng #{memberOverview.teamSummary.rankByViews}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    {formatNum(memberOverview.teamSummary?.totalViews || 0)} views •{' '}
                    {formatNum(memberOverview.teamSummary?.totalSubscribers || 0)} subs
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    background: '#f8fafc',
                    padding: 10,
                    border: '1px dashed #cbd5e1',
                    fontSize: 12,
                    color: '#64748b',
                  }}
                >
                  <div>Bạn chưa thuộc đội nhóm nào.</div>
                  <button
                    type="button"
                    onClick={() => navigate('/rankings?scope=teams')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                      marginTop: 4,
                    }}
                  >
                    Khám phá các đội →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* MY YOUTUBE CHANNELS & GROWTH CHART */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                  Kênh YouTube Phụ Trách ({memberOverview?.channels?.length || 0})
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Bao gồm các kênh được gán trực tiếp cho bạn hoặc thuộc đội của bạn
                </div>
              </div>

              {memberOverview?.channels && memberOverview.channels.length > 0 && (
                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>TỔNG LƯỢT XEM</div>
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 16,
                        fontWeight: 700,
                        color: '#0f172a',
                      }}
                    >
                      {formatNum(memberOverview.kpis?.totalViews || 0)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>SUBSCRIBERS</div>
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 16,
                        fontWeight: 700,
                        color: '#0f172a',
                      }}
                    >
                      {formatNum(memberOverview.kpis?.totalSubscribers || 0)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Empty State vs Content */}
            {!memberOverview?.channels || memberOverview.channels.length === 0 ? (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  color: '#64748b',
                }}
              >
                <Tv size={28} color="#94a3b8" style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                  Bạn chưa được gán kênh YouTube nào
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#64748b',
                    marginTop: 4,
                    maxWidth: 420,
                    margin: '4px auto 0',
                  }}
                >
                  Khi bạn được Quản trị viên phân công phụ trách kênh hoặc gia nhập đội nhóm, dữ liệu hiệu suất và
                  biểu đồ tăng trưởng sẽ hiển thị tại đây.
                </div>
              </div>
            ) : (
              <div>
                {/* Personal Growth Chart */}
                <div style={{ marginBottom: 18 }}>
                  <YouTubeTrendChart
                    data={memberOverview.history || []}
                    period={ytPeriod}
                    onPeriodChange={(newPeriod) => setYtPeriod(newPeriod)}
                    title="Biểu đồ tăng trưởng các kênh của tôi"
                  />
                </div>

                {/* Channels Cards Grid */}
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    marginBottom: 10,
                  }}
                >
                  Danh sách kênh chi tiết (Bấm để xem lịch sử)
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: 10,
                  }}
                >
                  {(memberOverview.channels || []).map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setActiveModalChannelId(c.id)}
                      style={{
                        padding: '12px 14px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {c.thumbnailUrl ? (
                          <img
                            src={c.thumbnailUrl}
                            alt={c.title}
                            style={{ width: 36, height: 36, borderRadius: 18 }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              background: '#fee2e2',
                              color: '#ef4444',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Tv size={18} />
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{c.title}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            {c.isDirectlyAssigned && (
                              <span
                                style={{
                                  fontSize: 10,
                                  background: '#dcfce7',
                                  color: '#15803d',
                                  padding: '1px 5px',
                                  fontWeight: 600,
                                }}
                              >
                                Phụ trách chính
                              </span>
                            )}
                            <span style={{ fontSize: 10, color: '#64748b' }}>{c.teamName}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#0f172a',
                          }}
                        >
                          {formatNum(c.views)}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{formatNum(c.subscribers)} subs</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 4. REALTIME ONLINE COMMUNITY SECTION ─────────────────────────────── */}
      <section className="dashboard-live-card is-compact" data-tour="live-table" style={{ marginTop: 20 }}>
        <div className="dashboard-table-header">
          <div>
            <h2>Người đang online</h2>
            <p>
              {currentOnlineUsers
                ? `${currentOnlineUsers.toLocaleString()} người có tín hiệu hiện tại`
                : 'Chưa có tín hiệu online'}
            </p>
          </div>
          <div className="dashboard-table-actions">
            <div className="dashboard-table-status">
              <span className="dashboard-live-dot" />
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
              <button type="button" onClick={() => navigate('/arena')}>
                Vào Arena
              </button>
            </div>
          ) : (
            onlineRows.map((u) => {
              const sc = statusConfig(u.status);
              const avatarUrl = getUserAvatar(u);
              const initials = initialsFromName(u.name || `User #${u.id}`);
              return (
                <button
                  key={u.id}
                  type="button"
                  className="dashboard-online-row"
                  onClick={() => navigate(`/users/${u.id}`)}
                >
                  <div className="dashboard-user-cell">
                    <div className="dashboard-avatar" data-avatar-refresh={avatarRefreshKey}>
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={`Ảnh đại diện ${u.name || `User #${u.id}`}`} />
                      ) : (
                        initials
                      )}
                    </div>
                    <div>
                      <div
                        className="dashboard-user-name"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
                      >
                        <span>{u.name || `User #${u.id}`}</span>
                        {isVerifiedUser(u) && <VerifiedBadge size={14} />}
                        {u.jobTitle && <JobTitleBadge jobTitle={u.jobTitle} size="xs" />}
                      </div>
                      <div className="dashboard-online-meta">
                        <span>{Number(u.score || 0).toLocaleString()} điểm XP</span>
                      </div>
                    </div>
                  </div>
                  <span
                    className="dashboard-status-pill is-compact"
                    style={{ color: sc.color, background: sc.bg, borderColor: sc.border }}
                  >
                    <span style={{ background: sc.dot }} />
                    {sc.label}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* ── 5. CHANNEL DETAIL DRILLDOWN MODAL ────────────────────────────────── */}
      <ChannelDetailModal
        channelId={activeModalChannelId}
        isOpen={Boolean(activeModalChannelId)}
        onClose={() => setActiveModalChannelId(null)}
      />
    </div>
  );
}
