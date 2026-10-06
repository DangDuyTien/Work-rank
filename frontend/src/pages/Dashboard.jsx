import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboard, youtube, kpiApi, competition, users as usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AVATAR_UPDATED_EVENT, getUserAvatar, initialsFromName } from '../utils/avatar';
import {
  Activity,
  AlertCircle,
  Monitor,
  RefreshCw,
  Users,
  Tv,
  ChevronRight,
  Building2,
  ArrowRight,
  ExternalLink,
  Trophy,
  Target,
  Flame,
  ArrowUpRight,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  UserCheck,
  Medal,
} from 'lucide-react';

import VerifiedBadge from '../components/VerifiedBadge';
import JobTitleBadge from '../components/JobTitleBadge';
import usePageVisibility from '../hooks/usePageVisibility';
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
    color: 'var(--success)',
    dot: 'var(--success)',
  },
  online: {
    label: 'Trực tuyến',
    bg: 'rgba(180,83,9,0.08)',
    border: 'rgba(180,83,9,0.25)',
    color: 'var(--accent)',
    dot: 'var(--accent)',
  },
  idle: {
    label: 'Không hoạt động',
    bg: 'rgba(217,119,6,0.08)',
    border: 'rgba(217,119,6,0.25)',
    color: 'var(--accent)',
    dot: '#d97706',
  },
  offline: {
    label: 'Ngoại tuyến',
    bg: 'rgba(0,0,0,0.04)',
    border: 'rgba(0,0,0,0.08)',
    color: 'var(--text-muted)',
    dot: '#a3a3a3',
  },
};

const ONLINE_STATUSES = ['active', 'online', 'idle'];
const STATUS_PRIORITY = { active: 0, online: 1, idle: 2, offline: 3 };
const YOUTUBE_SUMMARY_PERIOD = '30d';

function formatNum(value) {
  const n = Number(value) || 0;
  if (n >= 1000000000) return (n / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toLocaleString();
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
  const cachedUsers = normalizeUserList(getCached(CACHE_KEYS.DASHBOARD_USERS('realtime')));
  const cachedMyKpis = normalizeKpiSummary(getCached(CACHE_KEYS.DASHBOARD_KPI_MY_SUMMARY(user?.id)));
  const cachedCompetition = getCached(CACHE_KEYS.COMPETITION_DASHBOARD(user?.id, user?.teamId));
  const cachedRecognitions = user?.id ? getCached(CACHE_KEYS.USER_PROFILE(`${user.id}:recognitions`)) : null;
  const cachedCompanyYt = isAdmin ? getCached(CACHE_KEYS.DASHBOARD_YT_COMPANY('30d')) : null;
  const cachedMemberYt = !isAdmin ? getCached(CACHE_KEYS.DASHBOARD_YT_MEMBER('30d', user?.id)) : null;

  const hasInitialCache = Boolean(
    (cachedTotals && cachedTotals.online > 0) ||
    cachedUsers.length > 0 ||
    cachedMyKpis.kpis.length > 0 ||
    cachedCompetition ||
    cachedCompanyYt ||
    cachedMemberYt
  );

  // Range and master state
  const range = 'today';
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
  const ytPeriod = YOUTUBE_SUMMARY_PERIOD;
  const [companyOverview, setCompanyOverview] = useState(() => cachedCompanyYt || null);
  const [memberOverview, setMemberOverview] = useState(() => cachedMemberYt || null);

  const requestIdRef = useRef(0);

  // Main data fetch: Multi-layer KPI data fetching with defensive catch per call
  const fetchData = useCallback(
    async (selectedRange, period = ytPeriod, options = {}) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const background = options.background === true;

      const cachedRangeTotals = getCached(CACHE_KEYS.DASHBOARD_TOTALS(selectedRange));
      const cachedRangeUsers = getCached(CACHE_KEYS.DASHBOARD_USERS('realtime'));
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
          // Presence is independent of score rankings and reporting periods.
          fetchWithCache(CACHE_KEYS.DASHBOARD_USERS('realtime'), async () => {
            const res = await dashboard.realtimeUsers();
            return normalizeUserList(res.data).map((onlineUser) => ({ ...onlineUser, presence: 'online' }));
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
        } else {
          calls.push(
            fetchWithCache(CACHE_KEYS.DASHBOARD_YT_MEMBER(period, user?.id), () => youtube.getMyOverview({ period })).catch(() => null)
          );
        }

        const results = await Promise.all(calls);
        if (requestId !== requestIdRef.current) return;

        const [presenceRes, overviewData, myKpiRes, competitionRes, recognitionsRes, ytDataRes] = results;

        const newTotals = normalizeTotals(overviewData);
        const newUsersList = normalizeUserList(presenceRes);
        const safeKpis = normalizeKpiSummary(myKpiRes);

        setTotals((prev) => (isDeepEqual(prev, newTotals) ? prev : newTotals));
        setUsers((prev) => (isDeepEqual(prev, newUsersList) ? prev : newUsersList));
        if (safeKpis) setMyKpis((prev) => (isDeepEqual(prev, safeKpis) ? prev : safeKpis));
        if (competitionRes) setCompetitionData((prev) => (isDeepEqual(prev, competitionRes) ? prev : competitionRes));
        if (recognitionsRes) setRecognitions((prev) => (isDeepEqual(prev, recognitionsRes) ? prev : recognitionsRes));

        if (isAdmin) {
          if (ytDataRes) setCompanyOverview((prev) => (isDeepEqual(prev, ytDataRes) ? prev : ytDataRes));
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
        return String(a?.name || '').localeCompare(String(b?.name || ''), 'vi');
      })
      .slice(0, 6);
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
    const score = Number(uSum?.currentSeasonScore || 0);
    const rank = uSum?.currentSeasonRank || null;
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
      rank: tComp?.currentSeasonRank || null,
      membersCount: Number(tComp?.membersCount || 1),
      totalViews: Number(tYt?.totalViews || 0),
      totalSubs: Number(tYt?.totalSubscribers || 0),
      growthPct: tYt?.viewsGrowth30dPct ?? null,
    };
  }, [competitionData, memberOverview, user]);

  const youtubeSummary = {
    views: isAdmin ? Number(companyOverview?.kpis?.totalViews || 0) : personalInfo.myChannelViews,
    subscribers: isAdmin ? Number(companyOverview?.kpis?.totalSubscribers || 0) : personalInfo.myChannelSubs,
    channels: isAdmin ? Number(companyOverview?.kpis?.totalChannels || 0) : personalInfo.assignedChannelsCount,
    growth: isAdmin ? companyOverview?.kpis?.viewsGrowthPct ?? null : null,
  };

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
            <Sparkles size={22} color="var(--accent)" />
          </h1>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 6,
              fontSize: 13,
              color: 'var(--text-secondary)',
              flexWrap: 'wrap',
            }}
          >
            {user?.jobTitle && <JobTitleBadge jobTitle={user.jobTitle} size="xs" />}
            <span>•</span>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              {user?.department || myKpis?.department?.name || 'Media & Content'}
            </span>
            <span>•</span>
            <span
              style={{
                background: teamInfo.hasTeam ? 'var(--surface-muted)' : '#fffbeb',
                color: teamInfo.hasTeam ? 'var(--text-primary)' : 'var(--accent)',
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
                  background: 'var(--text-primary)',
                  color: 'var(--surface-soft)',
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
                background: 'var(--info-soft)',
                color: 'var(--info)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserCheck size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                1. Hiệu Suất & KPI Cá Nhân
              </h2>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Chỉ số hoàn thành công việc, điểm thi đua và tiến độ thực tế của bạn
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/leaderboard?scope=members&period=season')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 10px',
              background: 'var(--surface)',
              border: '1px solid var(--border-2)',
              color: 'var(--text-secondary)',
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
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              padding: '16px 18px',
              cursor: 'pointer',
            }}
            onClick={() => navigate('/leaderboard?scope=members&period=season')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                ĐIỂM & XP CÁ NHÂN
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: '#fef3c7', padding: '1px 6px' }}>
                {personalInfo.rank ? `Hạng #${personalInfo.rank}` : 'Chưa xếp hạng'}
              </span>
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              {formatNum(personalInfo.score)}{' '}
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>XP</span>
            </div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
              <span>Streak: <strong style={{ color: 'var(--text-primary)' }}>{personalInfo.streak} ngày</strong></span>
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
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                TIẾN ĐỘ KPI CÔNG VIỆC
              </span>
              <Target size={14} color="var(--info)" />
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              {kpiStats.avgProgress}%
            </div>
            {/* Progress bar */}
            <div style={{ height: 6, background: 'var(--surface-muted)', borderRadius: 3, overflow: 'hidden', margin: '8px 0 6px 0' }}>
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, kpiStats.avgProgress))}%`,
                  height: '100%',
                  background: kpiStats.avgProgress >= 100 ? 'var(--success)' : kpiStats.avgProgress > 0 ? 'var(--info)' : 'var(--text-muted)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {kpiStats.totalCount > 0
                ? `${kpiStats.completedCount}/${kpiStats.totalCount} chỉ số đạt target kỳ này`
                : 'Chưa có chỉ số giao trong kỳ'}
            </div>
          </div>

          {/* CARD 3: Thứ Hạng Cá Nhân Toàn Hệ Thống */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              padding: '16px 18px',
              cursor: 'pointer',
            }}
            onClick={() => navigate('/leaderboard?scope=members&period=season')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                VỊ TRÍ BẢNG XẾP HẠNG
              </span>
              <Trophy size={14} color="var(--accent)" />
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              {personalInfo.rank ? `#${personalInfo.rank}` : 'Chưa xếp hạng'}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--info)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>Xem vị trí cá nhân</span>
              <ArrowUpRight size={12} />
            </div>
          </div>

          {/* CARD 4: Danh Hiệu & Kênh YouTube Phụ Trách */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                VINH DANH & PHÂN CÔNG
              </span>
              <Medal size={14} color="#059669" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
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
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
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
              <Target size={16} color="var(--text-primary)" />
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
                background: 'var(--surface-soft)',
                border: '1px dashed var(--border-2)',
                color: 'var(--text-secondary)',
                fontSize: 12,
              }}
            >
              <Target size={22} color="var(--text-muted)" style={{ marginBottom: 6 }} />
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
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
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-soft)', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
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
                      <tr key={kpi.id || kpi.kpiId} style={{ borderBottom: '1px solid var(--surface-muted)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{kpi.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{kpi.code || kpi.description}</div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                          {formatNum(kpi.targetValue ?? kpi.target)} {kpi.unit}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: isCompleted ? '#10b981' : 'var(--text-primary)' }}>
                          {formatNum(kpi.actualValue ?? kpi.actual)} {kpi.unit}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', width: 140 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, height: 6, background: 'var(--surface-muted)', borderRadius: 3, overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${pct}%`,
                                  height: '100%',
                                  background: isCompleted ? 'var(--success)' : pct > 0 ? 'var(--info)' : 'var(--border-2)',
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
                              background: isCompleted ? 'var(--success-soft)' : pct > 0 ? 'var(--info-soft)' : 'var(--surface-soft)',
                              color: isCompleted ? 'var(--success)' : pct > 0 ? 'var(--info)' : 'var(--text-secondary)',
                              border: `1px solid ${isCompleted ? 'var(--success-border)' : pct > 0 ? 'var(--info-border)' : 'var(--border)'}`,
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
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                2. Hiệu Suất Đội Nhóm & Phòng Ban
              </h2>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Tiến độ thi đua tập thể, xếp hạng và đóng góp thực tế của đội nhóm
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/leaderboard?scope=teams&period=season')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 10px',
              background: 'var(--surface)',
              border: '1px solid var(--border-2)',
              color: 'var(--text-secondary)',
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
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  padding: '16px 18px',
                  cursor: 'pointer',
                }}
                onClick={() => navigate('/leaderboard?scope=teams&period=season')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    ĐIỂM THI ĐUA ĐỘI
                  </span>
                  {teamInfo.rank && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', background: 'var(--surface-muted)', padding: '1px 6px' }}>
                      Hạng #{teamInfo.rank}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 24,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  {formatNum(teamInfo.score)}{' '}
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>XP</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
                  Đội: <strong style={{ color: 'var(--text-primary)' }}>{teamInfo.teamName}</strong>
                </div>
              </div>

              {/* CARD 2: Thứ Hạng Team */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  padding: '16px 18px',
                  cursor: 'pointer',
                }}
                onClick={() => navigate('/leaderboard?scope=teams&period=season')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    THỨ HẠNG ĐỘI NHÓM
                  </span>
                  <Trophy size={14} color="var(--accent)" />
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 24,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  {teamInfo.rank ? `#${teamInfo.rank}` : 'Chưa xếp hạng'}
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--info)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>Xem vị trí đội nhóm</span>
                  <ArrowUpRight size={12} />
                </div>
              </div>

              {/* CARD 3: Thành Viên Tham Gia */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    QUY MÔ ĐỘI NHÓM
                  </span>
                  <Users size={14} color="var(--text-secondary)" />
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 24,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  {teamInfo.membersCount}{' '}
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>thành viên</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
                  Đang hoạt động trong đội
                </div>
              </div>

              {/* CARD 4: Đóng Góp YouTube Của Team */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    ĐÓNG GÓP YOUTUBE CỦA ĐỘI
                  </span>
                  <Tv size={14} color="#ef4444" />
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 24,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  {formatNum(teamInfo.totalViews)}{' '}
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>views</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
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
              background: 'var(--surface)',
              border: '1px dashed var(--border-2)',
              color: 'var(--text-secondary)',
            }}
          >
            <Users size={30} color="var(--text-muted)" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Bạn chưa gia nhập đội nhóm nào
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 460, margin: '6px auto 14px' }}>
              Gia nhập đội nhóm để cùng đồng đội tích lũy điểm thi đua, đóng góp chỉ số KPI tập thể và tranh tài trên bảng xếp hạng.
            </div>
            <button
              type="button"
              onClick={() => navigate('/leaderboard?scope=teams&period=season')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 16px',
                background: 'var(--text-primary)',
                color: 'var(--surface)',
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
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                3. Hiệu Suất YouTube
              </h2>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
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
                background: 'var(--surface)',
                border: '1px solid var(--border-2)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span>YouTube</span>
              <ExternalLink size={13} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/leaderboard?scope=youtube')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                background: 'var(--text-primary)',
                border: 'none',
                color: 'var(--surface)',
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

        <div className="youtube-kpis-grid">
          {[
            { label: isAdmin ? 'Lượt xem toàn công ty' : 'Lượt xem kênh phụ trách', value: youtubeSummary.views },
            { label: 'Người đăng ký', value: youtubeSummary.subscribers },
            { label: isAdmin ? 'Kênh trong hệ thống' : 'Kênh phụ trách', value: youtubeSummary.channels },
            ...(isAdmin ? [{ label: 'Tăng trưởng 30 ngày', value: youtubeSummary.growth, growth: true }] : []),
          ].map((metric) => (
            <div key={metric.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px 18px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{metric.label}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
                {metric.growth
                  ? metric.value === null ? 'Chưa đủ dữ liệu' : `${metric.value >= 0 ? '+' : ''}${Number(metric.value).toFixed(1)}%`
                  : <AnimatedNumber value={metric.value} formatFn={formatNum} duration={700} />}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ======================================================================= */}
      {/* ── SECTION 4 — BXH, VỊ TRÍ & CỘNG ĐỒNG REALTIME ───────────────────── */}
      {/* ======================================================================= */}
      <section id="dashboard-community" className="dashboard-section dashboard-section--community" style={{ marginBottom: 30 }} data-tour="ranking-and-presence">
        <div className="analytics-two-columns-grid">
          {/* CỘT 1: TÓM TẮT VỊ THẾ THI ĐUA & HOẠT ĐỘNG */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: 20 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trophy size={16} color="var(--accent)" />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Vị Thế Thi Đua & Bảng Xếp Hạng
                </h3>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Season & Grand Race</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {/* Vị trí cá nhân */}
              <div style={{ padding: '10px 12px', background: 'var(--surface-soft)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>CÁ NHÂN (SEASON)</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                    {personalInfo.rank ? `Hạng #${personalInfo.rank}` : 'Chưa xếp hạng'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--text-primary)' }}>
                    <AnimatedNumber value={personalInfo.score || 0} duration={700} formatFn={formatNum} /> XP
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/leaderboard?scope=members&period=season')}
                    style={{ background: 'none', border: 'none', color: 'var(--info)', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                  >
                    <span>Xem BXH</span>
                    <ArrowRight size={11} />
                  </button>
                </div>
              </div>

              {/* Vị trí team */}
              <div style={{ padding: '10px 12px', background: 'var(--surface-soft)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>ĐỘI NHÓM (TEAM)</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                    {teamInfo.hasTeam ? (teamInfo.rank ? `Hạng #${teamInfo.rank}` : 'Chưa xếp hạng') : 'Chưa vào đội'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--text-primary)' }}>
                    <AnimatedNumber value={teamInfo.score || 0} duration={700} formatFn={formatNum} /> XP
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/leaderboard?scope=teams&period=season')}
                    style={{ background: 'none', border: 'none', color: 'var(--info)', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 3 }}
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
                  background: 'var(--surface-soft)',
                  border: '1px solid var(--border-2)',
                  color: 'var(--text-primary)',
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
                  color: 'var(--accent)',
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
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: 20 }}>
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
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
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
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                  <Monitor size={22} color="var(--text-muted)" style={{ marginBottom: 6 }} />
                  <div>Chưa có người trực tuyến</div>
                </div>
              ) : (
                <FlipList resetKey="dashboard-online" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {onlineRows.map((u) => {
                    const sc = statusConfig(u.presence);
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
                          background: 'var(--surface-soft)',
                          border: '1px solid var(--surface-muted)',
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
                              background: 'var(--text-primary)',
                              color: 'var(--surface)',
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
                              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{u.name}</span>
                              {isVerifiedUser(u) && <VerifiedBadge size={12} />}
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
            <button type="button" onClick={() => navigate('/friends')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 12, background: 'transparent', border: 0, padding: 0, color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
              Bạn bè <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
