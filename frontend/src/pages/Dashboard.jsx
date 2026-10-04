import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboard, leaderboard, youtube, kpiApi, competition, users as usersApi } from '../services/api';
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
  ArrowRight,
  ExternalLink,
  Trophy,
  Target,
  Flame,
  ArrowUpRight,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  Clock,
  UserCheck,
  Medal,
} from 'lucide-react';

import VerifiedBadge from '../components/VerifiedBadge';
import JobTitleBadge from '../components/JobTitleBadge';
import usePageVisibility from '../hooks/usePageVisibility';
import YouTubeTrendChart from '../components/YouTubeTrendChart';
import TeamComparisonBar from '../components/TeamComparisonBar';
import ChannelDetailModal from '../components/ChannelDetailModal';
import { AnimatedNumber, FlipList } from '../components/ui';
import { getCached, fetchWithCache, CACHE_KEYS, CACHE_TTL, isDeepEqual } from '../services/cache';

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
  if (!raw || typeof raw !== 'object') return { online: 0 };
  return {
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

function normalizeKpiSummary(raw) {
  if (!raw || typeof raw !== 'object') return { department: null, period: null, kpis: [] };
  const kpis = Array.isArray(raw.kpis) ? raw.kpis : [];
  return {
    department: raw.department || null,
    period: raw.period || raw.currentPeriod || null,
    kpis,
  };
}

export default function Dashboard() {
  const { user, isAdmin, socket } = useAuth();
  const navigate = useNavigate();
  const pageVisible = usePageVisibility();

  // Cached initial states for Instant Render (Stale-While-Revalidate)
  const cachedTotals = normalizeTotals(getCached(CACHE_KEYS.DASHBOARD_TOTALS('today')));
  const cachedUsers = normalizeUserList(getCached(CACHE_KEYS.DASHBOARD_USERS('today')));
  const cachedMyKpis = normalizeKpiSummary(getCached(CACHE_KEYS.DASHBOARD_KPI_MY_SUMMARY(user?.id)));
  const cachedCompetition = getCached(CACHE_KEYS.COMPETITION_DASHBOARD(user?.id, user?.teamId));
  const cachedRecognitions = user?.id ? getCached(CACHE_KEYS.USER_PROFILE(`${user.id}:recognitions`)) : null;
  const cachedCompanyYt = isAdmin ? getCached(CACHE_KEYS.DASHBOARD_YT_COMPANY('30d')) : null;
  const cachedMemberYt = !isAdmin ? getCached(CACHE_KEYS.DASHBOARD_YT_MEMBER('30d', user?.id)) : null;
  const cachedChannels = isAdmin ? normalizeChannelList(getCached(CACHE_KEYS.DASHBOARD_YT_CHANNELS())) : [];

  const hasInitialCache = Boolean(
    (cachedTotals && cachedTotals.online > 0) ||
    cachedUsers.length > 0 ||
    cachedMyKpis.kpis.length > 0 ||
    cachedCompetition ||
    cachedCompanyYt ||
    cachedMemberYt ||
    cachedChannels.length > 0
  );

  // Range and master state
  const [range, setRange] = useState('today');
  const [totals, setTotals] = useState(() => cachedTotals);
  const [users, setUsers] = useState(() => cachedUsers);
  const [myKpis, setMyKpis] = useState(() => cachedMyKpis);
  const [competitionData, setCompetitionData] = useState(() => cachedCompetition || null);
  const [recognitions, setRecognitions] = useState(() => cachedRecognitions || null);
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

  // Main data fetch: Multi-layer KPI data fetching with defensive catch per call
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
          // 1. Leaderboard users (online rows)
          fetchWithCache(CACHE_KEYS.DASHBOARD_USERS(selectedRange), async () => {
            const res = await leaderboard.get(selectedRange, { limit: DASHBOARD_LEADERBOARD_LIMIT });
            return normalizeUserList(res);
          }),
          // 2. Realtime presence overview
          fetchWithCache(CACHE_KEYS.DASHBOARD_TOTALS(selectedRange), async () => {
            const res = await dashboard.overview(selectedRange);
            return normalizeTotals(res.data || res || {});
          }),
          // 3. User Department KPIs (Layer 1)
          fetchWithCache(
            CACHE_KEYS.DASHBOARD_KPI_MY_SUMMARY(user?.id),
            async () => {
              const res = await kpiApi.getMyKpis();
              return normalizeKpiSummary(res.data || res);
            },
            { ttl: CACHE_TTL.SHORT }
          ).catch(() => normalizeKpiSummary(null)),
          // 4. Competition Dashboard Overview (Layer 1 + Layer 2)
          fetchWithCache(
            CACHE_KEYS.COMPETITION_DASHBOARD(user?.id, user?.teamId),
            async () => {
              const res = await competition.getDashboard();
              return res.data || res || null;
            },
            { ttl: CACHE_TTL.SHORT }
          ).catch(() => null),
          // 5. Recognitions & MVP badges
          user?.id
            ? fetchWithCache(
                CACHE_KEYS.USER_PROFILE(`${user.id}:recognitions`),
                async () => {
                  const res = await usersApi.getRecognitions(user.id);
                  return res || null;
                },
                { ttl: CACHE_TTL.MEDIUM }
              ).catch(() => null)
            : Promise.resolve(null),
        ];

        // 6 & 7. YouTube Analytics (Layer 3)
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
            fetchWithCache(CACHE_KEYS.DASHBOARD_YT_MEMBER(period, user?.id), () => youtube.getMyOverview({ period })).catch(() => null)
          );
        }

        const results = await Promise.all(calls);
        if (requestId !== requestIdRef.current) return;

        const [leaderboardRes, overviewData, myKpiRes, competitionRes, recognitionsRes, ytDataRes, channelsRes] = results;

        const newTotals = normalizeTotals(overviewData);
        const newUsersList = normalizeUserList(leaderboardRes);
        const safeKpis = normalizeKpiSummary(myKpiRes);

        setTotals((prev) => (isDeepEqual(prev, newTotals) ? prev : newTotals));
        setUsers((prev) => (isDeepEqual(prev, newUsersList) ? prev : newUsersList));
        if (safeKpis) setMyKpis((prev) => (isDeepEqual(prev, safeKpis) ? prev : safeKpis));
        if (competitionRes) setCompetitionData((prev) => (isDeepEqual(prev, competitionRes) ? prev : competitionRes));
        if (recognitionsRes) setRecognitions((prev) => (isDeepEqual(prev, recognitionsRes) ? prev : recognitionsRes));

        if (isAdmin) {
          if (ytDataRes) setCompanyOverview((prev) => (isDeepEqual(prev, ytDataRes) ? prev : ytDataRes));
          const chItems = normalizeChannelList(channelsRes);
          setAllChannels((prev) => (isDeepEqual(prev, chItems) ? prev : chItems));
        } else {
          if (ytDataRes) setMemberOverview((prev) => (isDeepEqual(prev, ytDataRes) ? prev : ytDataRes));
        }
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
    [isAdmin, user?.id, user?.teamId, ytPeriod]
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

  // Realtime Socket listeners for reactive dashboard update
  useEffect(() => {
    if (!socket) return;

    const handleDashboardUpdated = (payload) => {
      if (
        !payload.userId ||
        Number(payload.userId) === Number(user?.id) ||
        (payload.teamId && Number(payload.teamId) === Number(user?.teamId))
      ) {
        fetchData(range, ytPeriod, { background: true });
      }
    };

    const handleScoreAwarded = () => fetchData(range, ytPeriod, { background: true });
    socket.on('competition:dashboard_updated', handleDashboardUpdated);
    socket.on('competition:score_awarded', handleScoreAwarded);

    return () => {
      socket.off('competition:dashboard_updated', handleDashboardUpdated);
      socket.off('competition:score_awarded', handleScoreAwarded);
    };
  }, [socket, user?.id, user?.teamId, fetchData, range, ytPeriod]);

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

  // ── LAYER 1 COMPUTATIONS: Personal KPI stats ──
  const kpiStats = useMemo(() => {
    const list = normalizeKpiSummary(myKpis).kpis;
    if (!list.length) return { avgProgress: 0, completedCount: 0, totalCount: 0 };
    const total = list.length;
    const completed = list.filter((k) => k.status === 'COMPLETED' || Number(k.progressPct || k.progress || 0) >= 100).length;
    const sumProgress = list.reduce(
      (acc, k) => acc + Math.min(100, Math.max(0, Number(k.progressPct || k.progress || 0))),
      0
    );
    return {
      avgProgress: Math.round(sumProgress / total),
      completedCount: completed,
      totalCount: total,
    };
  }, [myKpis]);

  const personalInfo = useMemo(() => {
    const uSum = competitionData?.userSummary;
    const rk = memberOverview?.ranking;
    const score = Number(uSum?.currentSeasonScore ?? rk?.score ?? 0);
    const rank = uSum?.currentSeasonRank || rk?.rank || 1;
    const totalUsers = rk?.totalUsers || normalizeUserList(users).length || 1;
    const streak = Number(uSum?.currentStreak || 0);
    const recentScoreDelta = Number(uSum?.recentScoreDelta || 0);
    const seasonWins = Number(uSum?.seasonWins || 0);
    const mvpCount = Number(recognitions?.badges?.mvp?.count || 0);
    const championCount = Number(recognitions?.badges?.champion?.count || 0);

    const channels = memberOverview?.channels || [];
    const assignedChannels = channels.filter((c) => c.isDirectlyAssigned);
    const myChannelViews = assignedChannels.reduce((sum, c) => sum + Number(c.views || 0), 0);
    const myChannelSubs = assignedChannels.reduce((sum, c) => sum + Number(c.subscribers || 0), 0);

    return {
      score,
      rank,
      totalUsers,
      streak,
      recentScoreDelta,
      seasonWins,
      mvpCount,
      championCount,
      assignedChannelsCount: assignedChannels.length,
      myChannelViews,
      myChannelSubs,
    };
  }, [competitionData, memberOverview, recognitions, users]);

  // ── LAYER 2 COMPUTATIONS: Team KPI stats ──
  const teamInfo = useMemo(() => {
    const tComp = competitionData?.teamSummary;
    const tYt = memberOverview?.teamSummary;
    const userTeam = user?.team || memberOverview?.team || (tComp ? { id: tComp.teamId, name: tComp.teamName } : null);
    const teamId = user?.teamId || userTeam?.id || tComp?.teamId || null;
    const teamName = userTeam?.name || tComp?.teamName || (teamId ? `Đội #${teamId}` : null);

    return {
      hasTeam: Boolean(teamId),
      teamId,
      teamName,
      score: Number(tComp?.currentSeasonScore || 0),
      rank: tComp?.currentSeasonRank || tYt?.rankByViews || null,
      membersCount: Number(tComp?.membersCount || 1),
      totalViews: Number(tYt?.totalViews || 0),
      totalSubs: Number(tYt?.totalSubscribers || 0),
      growthPct: tYt?.viewsGrowthPct ?? null,
    };
  }, [competitionData, memberOverview, user]);

  return (
    <div className="dashboard-page">
      {/* ── HEADER SECTION: LỜI CHÀO & USER IDENTITY BAR ────────────────────── */}
      <section className="dashboard-hero" data-tour="dashboard-overview">
        <div>
          <div className="dashboard-eyebrow">
            <Activity size={14} />
            WorkRank Performance Center
          </div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span>Xin chào, {user?.name || 'Bạn'}</span>
            <Sparkles size={22} color="#b45309" />
          </h1>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 6,
              fontSize: 13,
              color: '#64748b',
              flexWrap: 'wrap',
            }}
          >
            {user?.jobTitle && <JobTitleBadge jobTitle={user.jobTitle} size="xs" />}
            <span>•</span>
            <span style={{ fontWeight: 600, color: '#334155' }}>
              {user?.department || myKpis?.department?.name || 'Media & Content'}
            </span>
            <span>•</span>
            <span
              style={{
                background: teamInfo.hasTeam ? '#f1f5f9' : '#fffbeb',
                color: teamInfo.hasTeam ? '#0f172a' : '#b45309',
                padding: '2px 8px',
                borderRadius: 4,
                fontWeight: 600,
                fontSize: 11,
              }}
            >
              {teamInfo.hasTeam ? teamInfo.teamName : 'Chưa gia nhập đội'}
            </span>
            {isVerifiedUser(user) && <VerifiedBadge size={14} />}
            {isAdmin && (
              <span
                style={{
                  background: '#0f172a',
                  color: '#f8fafc',
                  padding: '2px 6px',
                  borderRadius: 3,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Admin
              </span>
            )}
          </div>
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

      <nav className="dashboard-section-nav" aria-label="Đi nhanh trong dashboard">
        <span className="dashboard-section-nav__label">Đi nhanh</span>
        <a href="#dashboard-personal">Cá nhân</a>
        <a href="#dashboard-team">Đội nhóm</a>
        <a href="#dashboard-youtube">YouTube</a>
        <a href="#dashboard-community">BXH &amp; online</a>
      </nav>

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

      {/* ======================================================================= */}
      {/* ── SECTION 1 — KPI CÁ NHÂN ("HIỆU SUẤT CỦA TÔI") ──────────────────── */}
      {/* ======================================================================= */}
      <section id="dashboard-personal" className="dashboard-section dashboard-section--personal" style={{ marginBottom: 32 }} data-tour="personal-kpis">
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
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserCheck size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                1. Hiệu Suất & KPI Cá Nhân
              </h2>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                Chỉ số hoàn thành công việc, điểm thi đua và tiến độ thực tế của bạn
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/rankings?scope=members')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 10px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span>Bảng xếp hạng cá nhân</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* 4 SUMMARY METRIC CARDS FOR PERSONAL KPI */}
        <div className="competition-overview-grid" style={{ marginBottom: 14 }}>
          {/* CARD 1: Điểm & XP Cá Nhân */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              padding: '16px 18px',
              cursor: 'pointer',
            }}
            onClick={() => navigate('/rankings?scope=members')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                ĐIỂM & XP CÁ NHÂN
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '1px 6px' }}>
                Hạng #{personalInfo.rank}
              </span>
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 24,
                fontWeight: 700,
                color: '#0f172a',
              }}
            >
              {formatNum(personalInfo.score)}{' '}
              <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>XP</span>
            </div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
              <span>Streak: <strong style={{ color: '#0f172a' }}>{personalInfo.streak} ngày</strong></span>
              {personalInfo.recentScoreDelta ? (
                <span style={{ color: personalInfo.recentScoreDelta > 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                  {personalInfo.recentScoreDelta > 0 ? `+${personalInfo.recentScoreDelta}` : personalInfo.recentScoreDelta} gần nhất
                </span>
              ) : (
                <span>Tích lũy mùa thi đua</span>
              )}
            </div>
          </div>

          {/* CARD 2: Tỷ Lệ Đạt KPI Công Việc */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                TIẾN ĐỘ KPI CÔNG VIỆC
              </span>
              <Target size={14} color="#2563eb" />
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 24,
                fontWeight: 700,
                color: '#0f172a',
              }}
            >
              {kpiStats.avgProgress}%
            </div>
            {/* Progress bar */}
            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden', margin: '8px 0 6px 0' }}>
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, kpiStats.avgProgress))}%`,
                  height: '100%',
                  background: kpiStats.avgProgress >= 100 ? '#10b981' : kpiStats.avgProgress > 0 ? '#2563eb' : '#94a3b8',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {kpiStats.totalCount > 0
                ? `${kpiStats.completedCount}/${kpiStats.totalCount} chỉ số đạt target kỳ này`
                : 'Chưa có chỉ số giao trong kỳ'}
            </div>
          </div>

          {/* CARD 3: Thứ Hạng Cá Nhân Toàn Hệ Thống */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              padding: '16px 18px',
              cursor: 'pointer',
            }}
            onClick={() => navigate('/rankings?scope=members')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                VỊ TRÍ BẢNG XẾP HẠNG
              </span>
              <Trophy size={14} color="#b45309" />
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 24,
                fontWeight: 700,
                color: '#0f172a',
              }}
            >
              #{personalInfo.rank}{' '}
              <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>
                / {personalInfo.totalUsers} thành viên
              </span>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>Xem vị trí cá nhân</span>
              <ArrowUpRight size={12} />
            </div>
          </div>

          {/* CARD 4: Danh Hiệu & Kênh YouTube Phụ Trách */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                VINH DANH & PHÂN CÔNG
              </span>
              <Medal size={14} color="#059669" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
              {personalInfo.mvpCount > 0 || personalInfo.championCount > 0 ? (
                <span>
                  {personalInfo.mvpCount > 0 && `${personalInfo.mvpCount} Danh hiệu MVP`}
                  {personalInfo.mvpCount > 0 && personalInfo.championCount > 0 && ' • '}
                  {personalInfo.championCount > 0 && `${personalInfo.championCount} Cúp Vô Địch`}
                </span>
              ) : personalInfo.assignedChannelsCount > 0 ? (
                <span>{personalInfo.assignedChannelsCount} Kênh YouTube Phụ Trách</span>
              ) : (
                <span>Thành viên Tích cực</span>
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
              {personalInfo.myChannelViews > 0
                ? `${formatNum(personalInfo.myChannelViews)} views trên kênh cá nhân`
                : personalInfo.seasonWins > 0
                ? `${personalInfo.seasonWins} lần chiến thắng mùa`
                : 'Chỉ số thi đua được ghi nhận tự động'}
            </div>
          </div>
        </div>

        {/* CHI TIẾT CÁC CHỈ SỐ KPI PHÒNG BAN CỦA CÁ NHÂN */}
        <details className="dashboard-details">
          <summary className="dashboard-details__summary">
            <span className="dashboard-details__title">
              <Target size={16} color="#0f172a" />
              <span>Chi tiết KPI phòng ban</span>
              <span className="dashboard-details__context">{myKpis?.period?.name || 'Kỳ hiện tại'}</span>
            </span>
            <span className="dashboard-details__meta">
              {myKpis?.department?.name && <span className="dashboard-details__badge">{myKpis.department.name}</span>}
              <ChevronRight size={16} aria-hidden="true" />
            </span>
          </summary>
          <div className="dashboard-details__body">
          {myKpis.kpis.length === 0 ? (
            <div
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                color: '#64748b',
                fontSize: 12,
              }}
            >
              <Target size={22} color="#94a3b8" style={{ marginBottom: 6 }} />
              <div style={{ fontWeight: 600, color: '#334155' }}>
                Chưa có chỉ số KPI phòng ban nào được giao trong kỳ này
              </div>
              <div style={{ fontSize: 11, marginTop: 4 }}>
                Khi Quản trị viên cấu hình chỉ số sản xuất cho phòng ban của bạn, các nhiệm vụ sẽ xuất hiện tại đây.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Tên Chỉ Số / Nhiệm Vụ</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Mục Tiêu</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Đạt Được</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Tiến Độ</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>Trạng Thái</th>
                  </tr>
                </thead>
                <tbody>
                  {myKpis.kpis.map((kpi) => {
                    const pct = Math.min(100, Math.max(0, Number(kpi.progressPct || kpi.progress || 0)));
                    const isCompleted = kpi.status === 'COMPLETED' || pct >= 100;
                    return (
                      <tr key={kpi.id || kpi.kpiId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{kpi.name}</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>{kpi.code || kpi.description}</div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                          {formatNum(kpi.targetValue ?? kpi.target)} {kpi.unit}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: isCompleted ? '#10b981' : '#0f172a' }}>
                          {formatNum(kpi.actualValue ?? kpi.actual)} {kpi.unit}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', width: 140 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${pct}%`,
                                  height: '100%',
                                  background: isCompleted ? '#10b981' : pct > 0 ? '#2563eb' : '#cbd5e1',
                                }}
                              />
                            </div>
                            <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, width: 34, textAlign: 'right' }}>
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 6px',
                              borderRadius: 2,
                              background: isCompleted ? '#ecfdf5' : pct > 0 ? '#eff6ff' : '#f8fafc',
                              color: isCompleted ? '#047857' : pct > 0 ? '#1d4ed8' : '#64748b',
                              border: `1px solid ${isCompleted ? '#a7f3d0' : pct > 0 ? '#bfdbfe' : '#e2e8f0'}`,
                            }}
                          >
                            {isCompleted ? 'Hoàn thành' : pct > 0 ? 'Đang thực hiện' : 'Chưa có'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </details>
      </section>

      {/* ======================================================================= */}
      {/* ── SECTION 2 — KPI PHÒNG BAN / TEAM ("HIỆU SUẤT ĐỘI NHÓM") ─────────── */}
      {/* ======================================================================= */}
      <section id="dashboard-team" className="dashboard-section dashboard-section--team" style={{ marginBottom: 32 }} data-tour="team-kpis">
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
                background: '#fef3c7',
                color: '#b45309',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                2. Hiệu Suất Đội Nhóm & Phòng Ban
              </h2>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                Tiến độ thi đua tập thể, xếp hạng và đóng góp thực tế của đội nhóm
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/rankings?scope=teams')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 10px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span>Bảng xếp hạng đội nhóm</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {teamInfo.hasTeam ? (
          <div>
            {/* 4 SUMMARY METRIC CARDS FOR TEAM KPI */}
            <div className="competition-overview-grid" style={{ marginBottom: 14 }}>
              {/* CARD 1: Điểm Thi Đua Team */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  padding: '16px 18px',
                  cursor: 'pointer',
                }}
                onClick={() => navigate('/rankings?scope=teams')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    ĐIỂM THI ĐUA ĐỘI
                  </span>
                  {teamInfo.rank && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', background: '#f1f5f9', padding: '1px 6px' }}>
                      Hạng #{teamInfo.rank}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 24,
                    fontWeight: 700,
                    color: '#0f172a',
                  }}
                >
                  {formatNum(teamInfo.score)}{' '}
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>XP</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
                  Đội: <strong style={{ color: '#0f172a' }}>{teamInfo.teamName}</strong>
                </div>
              </div>

              {/* CARD 2: Thứ Hạng Team */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  padding: '16px 18px',
                  cursor: 'pointer',
                }}
                onClick={() => navigate('/rankings?scope=teams')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    THỨ HẠNG ĐỘI NHÓM
                  </span>
                  <Trophy size={14} color="#b45309" />
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 24,
                    fontWeight: 700,
                    color: '#0f172a',
                  }}
                >
                  {teamInfo.rank ? `#${teamInfo.rank}` : 'Chưa xếp hạng'}
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>Xem vị trí đội nhóm</span>
                  <ArrowUpRight size={12} />
                </div>
              </div>

              {/* CARD 3: Thành Viên Tham Gia */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    QUY MÔ ĐỘI NHÓM
                  </span>
                  <Users size={14} color="#64748b" />
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 24,
                    fontWeight: 700,
                    color: '#0f172a',
                  }}
                >
                  {teamInfo.membersCount}{' '}
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>thành viên</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
                  Đang hoạt động trong đội
                </div>
              </div>

              {/* CARD 4: Đóng Góp YouTube Của Team */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    ĐÓNG GÓP YOUTUBE CỦA ĐỘI
                  </span>
                  <Tv size={14} color="#ef4444" />
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 24,
                    fontWeight: 700,
                    color: '#0f172a',
                  }}
                >
                  {formatNum(teamInfo.totalViews)}{' '}
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>views</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
                  {formatNum(teamInfo.totalSubs)} subs
                  {teamInfo.growthPct !== null && (
                    <span style={{ marginLeft: 6, fontWeight: 600, color: teamInfo.growthPct >= 0 ? '#10b981' : '#ef4444' }}>
                      ({teamInfo.growthPct >= 0 ? '+' : ''}{Number(teamInfo.growthPct).toFixed(1)}%)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '30px 20px',
              textAlign: 'center',
              background: '#ffffff',
              border: '1px dashed #cbd5e1',
              color: '#64748b',
            }}
          >
            <Users size={30} color="#94a3b8" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
              Bạn chưa gia nhập đội nhóm nào
            </div>
            <div style={{ fontSize: 12, color: '#64748b', maxWidth: 460, margin: '6px auto 14px' }}>
              Gia nhập đội nhóm để cùng đồng đội tích lũy điểm thi đua, đóng góp chỉ số KPI tập thể và tranh tài trên bảng xếp hạng.
            </div>
            <button
              type="button"
              onClick={() => navigate('/rankings?scope=teams')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 16px',
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span>Khám phá các đội nhóm</span>
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </section>

      {/* ======================================================================= */}
      {/* ── SECTION 3 — KPI YOUTUBE ─────────────────────────────────────────── */}
      {/* ======================================================================= */}
      <section id="dashboard-youtube" className="dashboard-section dashboard-section--youtube" style={{ marginBottom: 32 }} data-tour="youtube-kpis">
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
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                3. Hiệu Suất YouTube
              </h2>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                {isAdmin
                  ? 'Dữ liệu YouTube toàn công ty (Cấp 1 & Cấp 2)'
                  : 'Kênh YouTube phụ trách và hiệu suất tăng trưởng trong kỳ'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => navigate('/youtube')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
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
                padding: '5px 10px',
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

        {/* ── 3A. ADMIN DASHBOARD VIEW (COMPANY -> TEAM -> CHANNEL DRILL-DOWN) ─── */}
        {isAdmin && (
          <div>
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
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Đối chiếu baseline chuẩn</div>
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
          <div>
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
      </section>

      {/* ======================================================================= */}
      {/* ── SECTION 4 — BXH, VỊ TRÍ & CỘNG ĐỒNG REALTIME ───────────────────── */}
      {/* ======================================================================= */}
      <section id="dashboard-community" className="dashboard-section dashboard-section--community" style={{ marginBottom: 30 }} data-tour="ranking-and-presence">
        <div className="analytics-two-columns-grid">
          {/* CỘT 1: TÓM TẮT VỊ THẾ THI ĐUA & HOẠT ĐỘNG */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trophy size={16} color="#b45309" />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Vị Thế Thi Đua & Bảng Xếp Hạng
                </h3>
              </div>
              <span style={{ fontSize: 11, color: '#64748b' }}>Season & Grand Race</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {/* Vị trí cá nhân */}
              <div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>CÁ NHÂN (SEASON)</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                    Hạng #{personalInfo.rank} / {personalInfo.totalUsers}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#0f172a' }}>
                    <AnimatedNumber value={personalInfo.score || 0} duration={700} formatFn={formatNum} /> XP
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/rankings?scope=members')}
                    style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                  >
                    <span>Xem BXH</span>
                    <ArrowRight size={11} />
                  </button>
                </div>
              </div>

              {/* Vị trí team */}
              <div style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>ĐỘI NHÓM (TEAM)</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                    {teamInfo.hasTeam ? (teamInfo.rank ? `Hạng #${teamInfo.rank}` : 'Chưa xếp hạng') : 'Chưa vào đội'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#0f172a' }}>
                    <AnimatedNumber value={teamInfo.score || 0} duration={700} formatFn={formatNum} /> XP
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/rankings?scope=teams')}
                    style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                  >
                    <span>Xem BXH Đội</span>
                    <ArrowRight size={11} />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick links to Arena / Grand */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => navigate('/arena')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <span>Đấu trường Season</span>
                <ChevronRight size={13} />
              </button>
              <button
                type="button"
                onClick={() => navigate('/grand')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  color: '#b45309',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <span>Grand Championship</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>

          {/* CỘT 2: NGƯỜI ĐANG ONLINE (REALTIME COMMUNITY) */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="dashboard-live-dot" />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Người Đang Trực Tuyến
                </h3>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>
                {currentOnlineUsers ? `${currentOnlineUsers} online` : '0 online'}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: 250,
                overflowY: 'auto',
              }}
            >
              {loading && !error ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="dashboard-online-row is-loading" style={{ padding: '6px 10px' }}>
                    <div className="dashboard-avatar dashboard-skeleton" style={{ width: 28, height: 28 }} />
                    <div className="dashboard-online-skeleton-copy">
                      <div className="dashboard-skeleton" style={{ width: 80, height: 10 }} />
                      <div className="dashboard-skeleton" style={{ width: 40, height: 8 }} />
                    </div>
                  </div>
                ))
              ) : onlineRows.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                  <Monitor size={22} color="#94a3b8" style={{ marginBottom: 6 }} />
                  <div>Chưa có người trực tuyến</div>
                </div>
              ) : (
                <FlipList resetKey="dashboard-online" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {onlineRows.map((u) => {
                    const sc = statusConfig(u.status);
                    const avatarUrl = getUserAvatar(u);
                    const initials = initialsFromName(u.name || `User #${u.id}`);
                    return (
                      <button
                        key={u.id}
                        data-flip-id={u.id}
                        className="ranking-flip-row"
                        type="button"
                        onClick={() => navigate(`/users/${u.id}`)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          background: '#f8fafc',
                          border: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 14,
                              background: '#0f172a',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              fontWeight: 700,
                              overflow: 'hidden',
                            }}
                          >
                            {avatarUrl ? (
                              <img src={avatarUrl} alt={u.name} style={{ width: 28, height: 28, objectFit: 'cover' }} />
                            ) : (
                              initials
                            )}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{u.name}</span>
                              {isVerifiedUser(u) && <VerifiedBadge size={12} />}
                            </div>
                            <div style={{ fontSize: 10, color: '#64748b' }}>
                              <AnimatedNumber value={Number(u.score || 0)} duration={700} /> XP
                            </div>
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: sc.color,
                            background: sc.bg,
                            border: `1px solid ${sc.border}`,
                            padding: '1px 6px',
                          }}
                        >
                          {sc.label}
                        </span>
                      </button>
                    );
                  })}
                </FlipList>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── CHANNEL DETAIL DRILLDOWN MODAL ──────────────────────────────────── */}
      <ChannelDetailModal
        channelId={activeModalChannelId}
        isOpen={Boolean(activeModalChannelId)}
        onClose={() => setActiveModalChannelId(null)}
      />
    </div>
  );
}
