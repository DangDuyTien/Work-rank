import React, { useState, useEffect } from 'react';
import {
  Tv,
  Eye,
  Users,
  Video,
  TrendingUp,
  Award,
  Trophy,
  Medal,
  RefreshCw,
  Swords,
  Plus,
  Link,
  Unlink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Search,
  Filter,
  Flame,
  Calendar,
  Layers,
  ChevronRight,
  Shield,
  Lock,
  Building2,
  Sparkles,
  ArrowLeft,
  Info,
} from 'lucide-react';
import { youtube, groups as groupsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast, useConfirm } from '../context/UiContext';
import { parseApiError } from '../utils/errors';
import { TabTransition, TableSkeleton, AnimatedNumber, PageTransition, FlipTableBody } from '../components/ui';
import { getCached, setCached, fetchWithCache, CACHE_KEYS, CACHE_TTL, isDeepEqual } from '../services/cache';

function formatNumber(num) {
  if (num === null || num === undefined) return '0';
  const n = Number(num);
  if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric', year: 'numeric' });
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

export default function YouTubeOverview() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const userTeamId = user?.teamId || user?.team_id || null;

  // Tabs:
  // 'overview' (Company Overview)
  // 'channel_leaderboard' (Company-wide All Channels ranking, assigned & unassigned)
  // 'team_leaderboard' (Company-wide Team Ranking)
  // 'team_detail' (Drill-down into specific Team channels)
  // 'compare' (Admin only)
  // 'admin' (Admin only: Add channel, link/unlink, sync)
  const cachedOverview = getCached(CACHE_KEYS.YOUTUBE_OVERVIEW());

  const rawCachedTeamLeaderboard = getCached(CACHE_KEYS.YOUTUBE_LEADERBOARD('teams', 'views'));
  const cachedTeamLeaderboard = Array.isArray(rawCachedTeamLeaderboard)
    ? rawCachedTeamLeaderboard
    : Array.isArray(rawCachedTeamLeaderboard?.items)
      ? rawCachedTeamLeaderboard.items
      : [];

  const rawCachedChannelLeaderboard = getCached(CACHE_KEYS.YOUTUBE_LEADERBOARD('channels', 'views'));
  const cachedChannelLeaderboard = Array.isArray(rawCachedChannelLeaderboard)
    ? rawCachedChannelLeaderboard
    : Array.isArray(rawCachedChannelLeaderboard?.items)
      ? rawCachedChannelLeaderboard.items
      : [];

  const rawCachedTeamsList = getCached('groups:list');
  const cachedTeamsList = Array.isArray(rawCachedTeamsList)
    ? rawCachedTeamsList
    : Array.isArray(rawCachedTeamsList?.data?.teams)
      ? rawCachedTeamsList.data.teams
      : Array.isArray(rawCachedTeamsList?.data)
        ? rawCachedTeamsList.data
        : [];

  const hasInitialCache = Boolean(cachedOverview || cachedTeamLeaderboard.length > 0 || cachedChannelLeaderboard.length > 0);

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(!hasInitialCache);
  const [refreshing, setRefreshing] = useState(false);

  // Company Overview Data
  const [overview, setOverview] = useState(() => cachedOverview || null);

  // My Team Data (Member or Admin own team)
  const [myTeamData, setMyTeamData] = useState(null);
  const [myTeamLoading, setMyTeamLoading] = useState(false);

  // Channel Leaderboard (All channels, assigned + unassigned)
  const [channelSortBy, setChannelSortBy] = useState('views'); // 'views', 'subscribers', 'growth'
  const [channelSearch, setChannelSearch] = useState('');
  const [channelTeamFilter, setChannelTeamFilter] = useState(''); // '' (all), 'unassigned', or teamId
  const [channelLeaderboard, setChannelLeaderboard] = useState(() => cachedChannelLeaderboard);
  const [channelLeaderboardLoading, setChannelLeaderboardLoading] = useState(false);

  // Team Leaderboard Data
  const [teamSortBy, setTeamSortBy] = useState('views'); // 'views', 'subscribers', 'growth'
  const [teamLeaderboard, setTeamLeaderboard] = useState(() => cachedTeamLeaderboard);
  const [teamLeaderboardLoading, setTeamLeaderboardLoading] = useState(false);

  // Team comparison data (Admin)
  const [teamsList, setTeamsList] = useState(() => cachedTeamsList);
  const [teamAId, setTeamAId] = useState('');
  const [teamBId, setTeamBId] = useState('');
  const [comparison, setComparison] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Selected team drilldown
  const [selectedTeamId, setSelectedTeamId] = useState(userTeamId || null);
  const [teamDetails, setTeamDetails] = useState(null);
  const [teamDetailsLoading, setTeamDetailsLoading] = useState(false);

  // Admin state
  const [adminChannels, setAdminChannels] = useState([]);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelId, setNewChannelId] = useState('');
  const [newChannelTitle, setNewChannelTitle] = useState('');
  const [newCustomUrl, setNewCustomUrl] = useState('');
  const [newTeamId, setNewTeamId] = useState('');
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [adminSyncingId, setAdminSyncingId] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [linkingChannelId, setLinkingChannelId] = useState(null);
  const [deletingChannelId, setDeletingChannelId] = useState(null);

  // 1. Fetch Company Overview
  const fetchOverviewData = async () => {
    try {
      const data = await fetchWithCache(CACHE_KEYS.YOUTUBE_OVERVIEW(), () => youtube.getOverview(), { ttl: CACHE_TTL.MEDIUM });
      setOverview((prev) => (isDeepEqual(prev, data) ? prev : data));
    } catch (err) {
      console.error('Failed to load YouTube overview:', err);
    }
  };

  // 2. Fetch My Team Data
  const fetchMyTeamData = async () => {
    if (!userTeamId) {
      setMyTeamData(null);
      return;
    }
    const cacheKey = `youtube:my_team:${userTeamId}`;
    const cached = getCached(cacheKey);
    if (!cached) setMyTeamLoading(true);
    try {
      const data = await fetchWithCache(cacheKey, () => youtube.getMyTeam(), { ttl: CACHE_TTL.MEDIUM });
      setMyTeamData((prev) => (isDeepEqual(prev, data) ? prev : data));
    } catch (err) {
      console.error('Failed to load my team YouTube data:', err);
    } finally {
      setMyTeamLoading(false);
    }
  };

  // 3. Fetch Channel Leaderboard (All channels, assigned & unassigned)
  const fetchChannelLeaderboardData = async () => {
    const cacheKey = CACHE_KEYS.YOUTUBE_LEADERBOARD('channels', `${channelSortBy}:${channelTeamFilter}:${channelSearch}`);
    const cached = getCached(cacheKey);
    if (!cached) setChannelLeaderboardLoading(true);
    try {
      const params = {
        view: 'channels',
        sortBy: channelSortBy,
        limit: 100,
      };
      if (channelSearch.trim()) {
        params.search = channelSearch.trim();
      }
      if (channelTeamFilter === 'unassigned') {
        params.unassigned = true;
      } else if (channelTeamFilter) {
        params.teamId = channelTeamFilter;
      }
      const data = await fetchWithCache(cacheKey, () => youtube.getLeaderboard(params), { ttl: CACHE_TTL.MEDIUM });
      const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      setChannelLeaderboard((prev) => (isDeepEqual(prev, items) ? prev : items));
    } catch (err) {
      console.error('Failed to load YouTube channel leaderboard:', err);
    } finally {
      setChannelLeaderboardLoading(false);
    }
  };

  // 4. Fetch Team Leaderboard
  const fetchTeamLeaderboardData = async () => {
    const cacheKey = CACHE_KEYS.YOUTUBE_LEADERBOARD('teams', teamSortBy);
    const cached = getCached(cacheKey);
    if (!cached) setTeamLeaderboardLoading(true);
    try {
      const data = await fetchWithCache(cacheKey, () => youtube.getLeaderboard({ view: 'teams', sortBy: teamSortBy, limit: 50 }), { ttl: CACHE_TTL.MEDIUM });
      const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      setTeamLeaderboard((prev) => (isDeepEqual(prev, items) ? prev : items));
    } catch (err) {
      console.error('Failed to load YouTube team leaderboard:', err);
    } finally {
      setTeamLeaderboardLoading(false);
    }
  };

  // 6. Fetch Admin Channels
  const fetchAdminChannelsData = async () => {
    if (!isAdmin) return;
    try {
      const data = await fetchWithCache('youtube:admin_channels', () => youtube.adminGetChannels(), { ttl: CACHE_TTL.SHORT });
      const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      setAdminChannels((prev) => (isDeepEqual(prev, items) ? prev : items));
    } catch (err) {
      console.error('Failed to load admin channels:', err);
    }
  };

  // 7. Fetch Teams List
  const fetchTeams = async () => {
    try {
      const res = await fetchWithCache('groups:list', () => groupsApi.list(), { ttl: CACHE_TTL.STATIC });
      const teams = Array.isArray(res) ? res : Array.isArray(res?.data?.teams) ? res.data.teams : Array.isArray(res?.data) ? res.data : [];
      setTeamsList((prev) => (isDeepEqual(prev, teams) ? prev : teams));
      if (teams.length >= 2) {
        setTeamAId((prev) => prev || teams[0].id);
        setTeamBId((prev) => prev || teams[1].id);
      }
    } catch (err) {
      console.error('Failed to load teams list:', err);
    }
  };

  const loadAll = async () => {
    if (!hasInitialCache) setLoading(true);
    else setRefreshing(true);
    await Promise.all([
      fetchOverviewData(),
      fetchMyTeamData(),
      fetchChannelLeaderboardData(),
      fetchTeamLeaderboardData(),
      fetchTeams(),
      fetchAdminChannelsData(),
    ]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadAll();
  }, [isAdmin, userTeamId]);

  useEffect(() => {
    fetchChannelLeaderboardData();
  }, [channelSortBy, channelTeamFilter]);

  // Debounced channel search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchChannelLeaderboardData();
    }, 250);
    return () => clearTimeout(timer);
  }, [channelSearch]);

  useEffect(() => {
    fetchTeamLeaderboardData();
  }, [teamSortBy]);

  useEffect(() => {
    if (isAdmin && teamAId && teamBId && teamAId !== teamBId) {
      handleCompare(teamAId, teamBId);
    }
  }, [teamAId, teamBId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadAll();
      toast.success('Đã làm mới dữ liệu YouTube!');
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể làm mới dữ liệu YouTube'));
    } finally {
      setRefreshing(false);
    }
  };

  const handleCompare = async (aId, bId) => {
    if (!aId || !bId || aId === bId) return;
    setCompareLoading(true);
    try {
      const res = await youtube.compareTeams(aId, bId);
      setComparison(res);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể so sánh 2 đội tuyển'));
    } finally {
      setCompareLoading(false);
    }
  };

  const handleOpenTeamDetails = async (targetTeamId) => {
    if (!targetTeamId) return;
    if (!isAdmin && userTeamId && Number(targetTeamId) !== Number(userTeamId)) {
      toast.info('Dữ liệu chi tiết của đội khác được bảo mật. Bạn chỉ có thể xem YouTube của đội mình.');
      return;
    }

    setSelectedTeamId(targetTeamId);
    setActiveTab('team_detail');
    setTeamDetailsLoading(true);
    try {
      const res = await youtube.getTeamDetails(targetTeamId);
      setTeamDetails(res);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể tải chi tiết đội'));
    } finally {
      setTeamDetailsLoading(false);
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!newChannelId.trim() || !newChannelTitle.trim()) {
      toast.warning('Vui lòng điền Channel ID và Tên kênh YouTube');
      return;
    }

    setCreatingChannel(true);
    try {
      await youtube.adminCreateChannel({
        channelId: newChannelId.trim(),
        title: newChannelTitle.trim(),
        customUrl: newCustomUrl.trim() || null,
        teamId: newTeamId ? Number(newTeamId) : null,
      });
      toast.success('Đã đăng ký kênh YouTube mới thành công!');
      setShowAddChannel(false);
      setNewChannelId('');
      setNewChannelTitle('');
      setNewCustomUrl('');
      setNewTeamId('');
      await Promise.all([
        fetchAdminChannelsData(),
        fetchOverviewData(),
        fetchChannelLeaderboardData(),
        fetchTeamLeaderboardData(),
      ]);
    } catch (err) {
      toast.error(parseApiError(err, 'Lỗi khi tạo kênh YouTube'));
    } finally {
      setCreatingChannel(false);
    }
  };

  const handleSyncChannel = async (channelId) => {
    setAdminSyncingId(channelId);
    try {
      const res = await youtube.adminSyncChannel(channelId);
      if (res.status === 'SUCCESS' || res.data?.status === 'SUCCESS') {
        const viewsCount = res.views ?? res.data?.views;
        toast.success(`Đã đồng bộ kênh thành công${viewsCount ? `: ${formatNumber(viewsCount)} views` : ''}!`);
      } else {
        toast.error(`Đồng bộ kênh thất bại: ${res.error || res.data?.error?.message || 'Lỗi không xác định'}`);
      }
      await Promise.all([
        fetchAdminChannelsData(),
        fetchOverviewData(),
        fetchChannelLeaderboardData(),
        fetchTeamLeaderboardData(),
        fetchMyTeamData(),
      ]);
    } catch (err) {
      toast.error(parseApiError(err, 'Lỗi khi kích hoạt đồng bộ kênh'));
    } finally {
      setAdminSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await youtube.adminSyncAll();
      toast.success(`Hoàn tất đồng bộ ${res.total || 0} kênh (${res.success || 0} thành công, ${res.failed || 0} lỗi)`);
      await Promise.all([
        fetchAdminChannelsData(),
        fetchOverviewData(),
        fetchChannelLeaderboardData(),
        fetchTeamLeaderboardData(),
        fetchMyTeamData(),
      ]);
    } catch (err) {
      toast.error(parseApiError(err, 'Lỗi khi đồng bộ tất cả kênh YouTube'));
    } finally {
      setSyncingAll(false);
    }
  };

  const handleLinkTeam = async (channelId, tId) => {
    setLinkingChannelId(channelId);
    try {
      if (tId) {
        await youtube.adminLinkChannel(channelId, tId);
        toast.success('Đã liên kết kênh với Team thành công!');
      } else {
        await youtube.adminUnlinkChannel(channelId);
        toast.success('Đã chuyển kênh về trạng thái Chưa gán đội');
      }
      await Promise.all([
        fetchAdminChannelsData(),
        fetchOverviewData(),
        fetchChannelLeaderboardData(),
        fetchTeamLeaderboardData(),
        fetchMyTeamData(),
      ]);
    } catch (err) {
      toast.error(parseApiError(err, 'Lỗi khi cập nhật liên kết Team'));
    } finally {
      setLinkingChannelId(null);
    }
  };

  const handleDeleteChannel = async (channelId) => {
    const confirmed = await confirm({
      title: 'Xóa kênh YouTube',
      message: 'Bạn có chắc chắn muốn xóa kênh này khỏi hệ thống? Dữ liệu lịch sử và snapshot liên quan sẽ bị gỡ bỏ.',
      confirmText: 'Xóa kênh',
      tone: 'danger',
    });
    if (!confirmed) return;

    setDeletingChannelId(channelId);
    try {
      await youtube.adminDeleteChannel(channelId);
      toast.success('Đã xóa kênh YouTube thành công');
      await Promise.all([
        fetchAdminChannelsData(),
        fetchOverviewData(),
        fetchChannelLeaderboardData(),
        fetchTeamLeaderboardData(),
        fetchMyTeamData(),
      ]);
    } catch (err) {
      toast.error(parseApiError(err, 'Lỗi khi xóa kênh'));
    } finally {
      setDeletingChannelId(null);
    }
  };

  const freshness = overview?.kpis?.freshnessStatus || 'FRESH';
  const lastSync = overview?.kpis?.lastSyncedAt;
  const unassignedCount = overview?.kpis?.unassignedChannelsCount || overview?.unassignedSummary?.totalChannels || 0;
  const unassignedViews = overview?.kpis?.unassignedViews || overview?.unassignedSummary?.totalViews || 0;

  return (
    <div style={{ width: '100%', maxWidth: 1680, margin: '0 auto', padding: '24px 16px' }}>
      {/* HEADER & BREADCRUMB */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          {/* Breadcrumb Hierarchy */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b', marginBottom: 6 }}>
            <span
              onClick={() => setActiveTab('overview')}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: activeTab === 'overview' ? 700 : 500, color: activeTab === 'overview' ? '#0f172a' : '#64748b' }}
            >
              <Building2 size={14} /> Toàn Công Ty
            </span>
            {activeTab === 'team_detail' && (
              <>
                <ChevronRight size={14} />
                <span style={{ fontWeight: 700, color: '#ef4444' }}>
                  {teamDetails?.team?.name || myTeamData?.team?.name || (selectedTeamId ? `Team #${selectedTeamId}` : 'Chi Tiết Đội')}
                </span>
              </>
            )}
            {activeTab === 'channel_leaderboard' && (
              <>
                <ChevronRight size={14} />
                <span style={{ fontWeight: 700, color: '#ef4444' }}>BXH Kênh YouTube</span>
              </>
            )}
            {activeTab === 'team_leaderboard' && (
              <>
                <ChevronRight size={14} />
                <span style={{ fontWeight: 700, color: '#ef4444' }}>BXH Đội Tuyển</span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 8, background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Tv size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, lineHeight: 1.3, color: '#0f172a' }}>
                  YouTube Hub — {activeTab === 'team_detail' ? (teamDetails?.team?.name || myTeamData?.team?.name || 'Chi Tiết Đội') : 'Toàn Công Ty'}
                </h1>
                <span
                  style={{
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    background: isAdmin ? '#e0e7ff' : '#ecfdf5',
                    color: isAdmin ? '#4338ca' : '#047857',
                    border: `1px solid ${isAdmin ? '#c7d2fe' : '#a7f3d0'}`,
                  }}
                >
                  {isAdmin ? 'Admin Scope (Toàn công ty)' : 'Member Scope'}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b', lineHeight: 1.55 }}>
                Theo dõi hiệu suất thực tế của toàn bộ kênh YouTube (thuộc Team hoặc độc lập), bảng xếp hạng lượt xem và người đăng ký.
              </p>
            </div>
          </div>
        </div>

        {/* Freshness Badge, Central Hub & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              background: freshness === 'FRESH' ? '#ecfdf5' : (freshness === 'STALE' ? '#fffbeb' : '#fef2f2'),
              color: freshness === 'FRESH' ? '#059669' : (freshness === 'STALE' ? '#d97706' : '#dc2626'),
              border: `1px solid ${freshness === 'FRESH' ? '#a7f3d0' : (freshness === 'STALE' ? '#fde68a' : '#fecaca')}`,
            }}
          >
            {freshness === 'FRESH' && <CheckCircle2 size={14} />}
            {freshness === 'STALE' && <AlertTriangle size={14} />}
            {freshness === 'FAILED' && <XCircle size={14} />}
            <span>
              {freshness === 'FRESH' && `Cập nhật: ${formatRelativeTime(lastSync)}`}
              {freshness === 'STALE' && `Dữ liệu cũ: ${formatRelativeTime(lastSync)}`}
              {freshness === 'FAILED' && 'Lỗi đồng bộ gần nhất'}
            </span>
          </div>

          <a
            href="/rankings?scope=youtube"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              background: '#0f172a',
              color: '#ffffff',
              textDecoration: 'none',
            }}
          >
            <span>Trung Tâm BXH</span>
            <ExternalLink size={14} />
          </a>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS (Always shows Company totals, including unassigned channels) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 13, fontWeight: 600 }}>
            <span>Tổng Lượt Xem (Toàn Công Ty)</span>
            <Eye size={18} color="#3b82f6" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#0f172a', marginTop: 8 }}>
            <AnimatedNumber value={overview?.kpis?.totalViews || 0} formatFn={formatNumber} />
          </div>
          <div style={{ fontSize: 12, color: '#10b981', fontWeight: 500, marginTop: 4 }}>
            Bao gồm toàn bộ kênh thuộc đội & độc lập
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 13, fontWeight: 600 }}>
            <span>Tổng Người Đăng Ký</span>
            <Users size={18} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#0f172a', marginTop: 8 }}>
            <AnimatedNumber value={overview?.kpis?.totalSubscribers || 0} formatFn={formatNumber} />
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: 400 }}>
            Người theo dõi toàn hệ thống
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 13, fontWeight: 600 }}>
            <span>Số Kênh Hoạt Động</span>
            <TrendingUp size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#0f172a', marginTop: 8 }}>
            <AnimatedNumber value={overview?.kpis?.totalChannels || 0} />{' '}
            <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b', fontFamily: 'inherit' }}>
              kênh ({overview?.kpis?.totalTeams || 0} teams)
            </span>
          </div>
          <div style={{ fontSize: 12, color: unassignedCount > 0 ? '#d97706' : '#64748b', marginTop: 4, fontWeight: unassignedCount > 0 ? 600 : 400 }}>
            {unassignedCount > 0 ? `${unassignedCount} kênh chưa gán đội (${formatNumber(unassignedViews)} views)` : '100% kênh đã gán đội'}
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', gap: 6, marginBottom: 24, overflowX: 'auto', scrollbarWidth: 'none' }}>
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'overview' ? '3px solid #ef4444' : '3px solid transparent',
            color: activeTab === 'overview' ? '#ef4444' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            whiteSpace: 'nowrap',
            transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <Building2 size={16} />
          <span>Tổng Quan Công Ty</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('channel_leaderboard')}
          style={{
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'channel_leaderboard' ? '3px solid #ef4444' : '3px solid transparent',
            color: activeTab === 'channel_leaderboard' ? '#ef4444' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            whiteSpace: 'nowrap',
            transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <Tv size={16} />
          <span>BXH Kênh YouTube ({channelLeaderboard.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('team_leaderboard')}
          style={{
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'team_leaderboard' ? '3px solid #ef4444' : '3px solid transparent',
            color: activeTab === 'team_leaderboard' ? '#ef4444' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            whiteSpace: 'nowrap',
            transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <Award size={16} />
          <span>BXH Đội Tuyển</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('team_detail');
            if (userTeamId && !teamDetails) {
              handleOpenTeamDetails(userTeamId);
            }
          }}
          style={{
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'team_detail' ? '3px solid #ef4444' : '3px solid transparent',
            color: activeTab === 'team_detail' ? '#ef4444' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            whiteSpace: 'nowrap',
            transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <Layers size={16} />
          <span>{isAdmin ? 'Chi Tiết Kênh Theo Đội' : 'Kênh Của Đội Bạn'}</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('compare')}
            style={{
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 700,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'compare' ? '3px solid #ef4444' : '3px solid transparent',
              color: activeTab === 'compare' ? '#ef4444' : '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
              transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <Swords size={16} />
            <span>So Sánh Teams</span>
          </button>
        )}

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            style={{
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 700,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'admin' ? '3px solid #ef4444' : '3px solid transparent',
              color: activeTab === 'admin' ? '#ef4444' : '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
              transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <Shield size={16} />
            <span>Quản Lý Kênh & Sync</span>
          </button>
        )}
      </div>

      <TabTransition key={activeTab} minHeight={420}>
        {/* ================= TAB 1: COMPANY OVERVIEW ================= */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Unassigned channels alert notice if any */}
            {unassignedCount > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Info size={18} color="#d97706" />
                  <span style={{ fontSize: 13, color: '#92400e' }}>
                    Có <strong>{unassignedCount} kênh YouTube chưa gán đội</strong> (đóng góp <strong>{formatNumber(unassignedViews)} views</strong>). Kênh vẫn được theo dõi đầy đủ và tính vào tổng số liệu toàn công ty.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setChannelTeamFilter('unassigned');
                    setActiveTab('channel_leaderboard');
                  }}
                  style={{
                    padding: '4px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    background: '#ffffff',
                    border: '1px solid #d97706',
                    color: '#b45309',
                    cursor: 'pointer',
                  }}
                >
                  Xem các kênh chưa gán →
                </button>
              </div>
            )}

            {/* Top teams breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
              {/* Top Teams by Views */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Eye size={18} color="#3b82f6" />
                    <span>Top Đội Theo Lượt Xem</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('team_leaderboard')}
                    style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Xem tất cả →
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {overview?.topTeamsByViews?.map((team, idx) => (
                    <div
                      key={team.teamId}
                      onClick={() => handleOpenTeamDetails(team.teamId)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        background: '#f8fafc',
                        cursor: 'pointer',
                        borderLeft: idx === 0 ? '4px solid #eab308' : (idx === 1 ? '4px solid #94a3b8' : (idx === 2 ? '4px solid #d97706' : '4px solid #cbd5e1')),
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                          #{idx + 1} {team.teamName}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          {formatNumber(team.totalSubscribers)} subs • {team.viewsGrowth30dPct !== null && team.viewsGrowth30dPct !== undefined ? `+${Number(team.viewsGrowth30dPct).toFixed(1)}% 30D` : '—'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: 16, fontFamily: "'JetBrains Mono', monospace", color: '#3b82f6' }}>
                          {formatNumber(team.totalViews)}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>views</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Teams by Growth */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={18} color="#10b981" />
                    <span>Top Đội Tăng Trưởng Nhanh Nhất (30D)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('team_leaderboard')}
                    style={{ fontSize: 12, color: '#10b981', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Xem tất cả →
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {overview?.topTeamsByGrowth?.map((team, idx) => (
                    <div
                      key={team.teamId}
                      onClick={() => handleOpenTeamDetails(team.teamId)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        background: '#f8fafc',
                        cursor: 'pointer',
                        borderLeft: idx === 0 ? '4px solid #10b981' : '4px solid #cbd5e1',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                          #{idx + 1} {team.teamName}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          {formatNumber(team.totalViews)} views
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: 16, fontFamily: "'JetBrains Mono', monospace", color: team.viewsGrowth30dPct !== null ? '#10b981' : '#94a3b8' }}>
                          {team.viewsGrowth30dPct !== null && team.viewsGrowth30dPct !== undefined ? `${Number(team.viewsGrowth30dPct) >= 0 ? '+' : ''}${Number(team.viewsGrowth30dPct).toFixed(1)}%` : '—'}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>tốc độ tăng</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: CHANNEL LEADERBOARD (All channels, assigned & unassigned) ================= */}
        {activeTab === 'channel_leaderboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Filter and Search Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Xếp hạng theo:</span>
                <div style={{ display: 'inline-flex', border: '1px solid #cbd5e1' }}>
                  <button
                    type="button"
                    onClick={() => setChannelSortBy('views')}
                    style={{
                      padding: '6px 12px',
                      fontSize: 13,
                      fontWeight: 600,
                      background: channelSortBy === 'views' ? '#ef4444' : '#ffffff',
                      color: channelSortBy === 'views' ? '#ffffff' : '#334155',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Lượt Xem
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannelSortBy('subscribers')}
                    style={{
                      padding: '6px 12px',
                      fontSize: 13,
                      fontWeight: 600,
                      background: channelSortBy === 'subscribers' ? '#ef4444' : '#ffffff',
                      color: channelSortBy === 'subscribers' ? '#ffffff' : '#334155',
                      border: 'none',
                      borderLeft: '1px solid #cbd5e1',
                      cursor: 'pointer',
                    }}
                  >
                    Subscribers
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannelSortBy('growth')}
                    style={{
                      padding: '6px 12px',
                      fontSize: 13,
                      fontWeight: 600,
                      background: channelSortBy === 'growth' ? '#ef4444' : '#ffffff',
                      color: channelSortBy === 'growth' ? '#ffffff' : '#334155',
                      border: 'none',
                      borderLeft: '1px solid #cbd5e1',
                      cursor: 'pointer',
                    }}
                  >
                    Tăng Trưởng
                  </button>
                </div>

                {/* Team Filter Dropdown */}
                <select
                  value={channelTeamFilter}
                  onChange={(e) => setChannelTeamFilter(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155' }}
                >
                  <option value="">-- Tất cả đội --</option>
                  <option value="unassigned">Chưa gán đội (Độc lập)</option>
                  {teamsList.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Search input */}
              <div style={{ position: 'relative', minWidth: 240 }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Tìm kênh YouTube..."
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 32px',
                    fontSize: 13,
                    border: '1px solid #cbd5e1',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Channels Table */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                    <th style={{ padding: '12px 16px' }}>Hạng</th>
                    <th style={{ padding: '12px 16px' }}>Kênh YouTube</th>
                    <th style={{ padding: '12px 16px' }}>Đội Quản Lý</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Lượt Xem</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Tăng Trưởng (30D)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Subscribers</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Hành Động</th>
                  </tr>
                </thead>
                <FlipTableBody resetKey={`yt-overview:${channelSortBy}:${channelTeamFilter}`}>
                  {channelLeaderboardLoading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                        Đang tải danh sách kênh YouTube...
                      </td>
                    </tr>
                  ) : channelLeaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                        Không tìm thấy kênh YouTube nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    channelLeaderboard.map((ch) => {
                      const isAssigned = !!ch.teamId;
                      return (
                        <tr
                          key={ch.id || ch.channelId}
                          data-flip-id={ch.id || ch.channelId}
                          className="ranking-flip-row"
                          style={{ borderBottom: '1px solid #f1f5f9' }}
                        >
                          <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                            {ch.rank === 1 && (
                              <span style={{ color: '#eab308', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Trophy size={14} color="#eab308" /> #1
                              </span>
                            )}
                            {ch.rank === 2 && (
                              <span style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Medal size={14} color="#94a3b8" /> #2
                              </span>
                            )}
                            {ch.rank === 3 && (
                              <span style={{ color: '#d97706', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Medal size={14} color="#d97706" /> #3
                              </span>
                            )}
                            {ch.rank > 3 && <span style={{ color: '#64748b' }}>#{ch.rank}</span>}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: '50%',
                                  background: '#fee2e2',
                                  color: '#ef4444',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: 14,
                                  flexShrink: 0,
                                  overflow: 'hidden',
                                }}
                              >
                                {ch.thumbnailUrl ? (
                                  <img src={ch.thumbnailUrl} alt={ch.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  ch.title.charAt(0)
                                )}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#0f172a' }}>{ch.title}</div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>{ch.customUrl || ch.channelId}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {isAssigned ? (
                              <button
                                type="button"
                                onClick={() => handleOpenTeamDetails(ch.teamId)}
                                style={{
                                  padding: '2px 8px',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background: '#e0e7ff',
                                  color: '#4338ca',
                                  border: '1px solid #c7d2fe',
                                  cursor: 'pointer',
                                }}
                              >
                                {ch.teamName}
                              </button>
                            ) : (
                              <span
                                style={{
                                  padding: '2px 8px',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background: '#f1f5f9',
                                  color: '#64748b',
                                  border: '1px solid #cbd5e1',
                                }}
                              >
                                Chưa gán đội
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#0f172a' }}>
                            <AnimatedNumber value={ch.views || 0} duration={700} formatFn={formatNumber} />
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            {ch.viewsGrowth30dPct !== null && ch.viewsGrowth30dPct !== undefined ? (
                              <>
                                <div style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: Number(ch.viewsGrowth30dPct) >= 0 ? '#10b981' : '#ef4444' }}>
                                  {Number(ch.viewsGrowth30dPct) >= 0 ? '+' : ''}{Number(ch.viewsGrowth30dPct).toFixed(1)}%
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>
                                  +{formatNumber(ch.views30d)} views
                                </div>
                              </>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500 }} title="Chưa đủ dữ liệu lịch sử để tính tăng trưởng">
                                —
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: '#64748b' }}>
                            {formatNumber(ch.subscribers)}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <a
                              href={`https://youtube.com/channel/${ch.channelId}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 8px',
                                fontSize: 11,
                                fontWeight: 600,
                                color: '#ef4444',
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                textDecoration: 'none',
                              }}
                            >
                              <span>Kênh</span>
                              <ExternalLink size={10} />
                            </a>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </FlipTableBody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TAB 3: TEAM LEADERBOARD ================= */}
        {activeTab === 'team_leaderboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Sort Tabs */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Xếp hạng theo:</span>
                <button
                  type="button"
                  onClick={() => setTeamSortBy('views')}
                  style={{
                    padding: '6px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    background: teamSortBy === 'views' ? '#ef4444' : '#ffffff',
                    color: teamSortBy === 'views' ? '#ffffff' : '#334155',
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer',
                  }}
                >
                  Lượt Xem (Views)
                </button>
                <button
                  type="button"
                  onClick={() => setTeamSortBy('subscribers')}
                  style={{
                    padding: '6px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    background: teamSortBy === 'subscribers' ? '#ef4444' : '#ffffff',
                    color: teamSortBy === 'subscribers' ? '#ffffff' : '#334155',
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer',
                  }}
                >
                  Người Đăng Ký (Subs)
                </button>
                <button
                  type="button"
                  onClick={() => setTeamSortBy('growth')}
                  style={{
                    padding: '6px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    background: teamSortBy === 'growth' ? '#ef4444' : '#ffffff',
                    color: teamSortBy === 'growth' ? '#ffffff' : '#334155',
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer',
                  }}
                >
                  Tốc Độ Tăng Trưởng (%)
                </button>
              </div>
            </div>

            {/* Team Leaderboard Table */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                    <th style={{ padding: '12px 16px' }}>Hạng</th>
                    <th style={{ padding: '12px 16px' }}>Đội Tuyển</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Số Kênh</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Tổng Views</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Tổng Subs</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Tăng Trưởng (30D)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Hành Động</th>
                  </tr>
                </thead>
                <tbody>
                  {teamLeaderboard.map((item) => {
                    const isMyTeam = userTeamId && Number(item.teamId) === Number(userTeamId);
                    return (
                      <tr
                        key={item.id || item.teamId}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: isMyTeam ? '#f0fdf4' : '#ffffff',
                        }}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                          {item.rank === 1 && (
                            <span style={{ color: '#eab308', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Trophy size={14} color="#eab308" /> #1
                            </span>
                          )}
                          {item.rank === 2 && (
                            <span style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Medal size={14} color="#94a3b8" /> #2
                            </span>
                          )}
                          {item.rank === 3 && (
                            <span style={{ color: '#d97706', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Medal size={14} color="#d97706" /> #3
                            </span>
                          )}
                          {item.rank > 3 && <span style={{ color: '#64748b' }}>#{item.rank}</span>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{item.teamName}</span>
                            {isMyTeam && (
                              <span style={{ fontSize: 10, background: '#dcfce7', color: '#15803d', padding: '1px 6px', fontWeight: 700 }}>
                                ĐỘI CỦA BẠN
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                          {item.channelsCount || 0}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#0f172a' }}>
                          {formatNumber(item.totalViews)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: '#64748b' }}>
                          {formatNumber(item.totalSubscribers)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {item.viewsGrowth30dPct !== null && item.viewsGrowth30dPct !== undefined ? (
                            <span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: Number(item.viewsGrowth30dPct) >= 0 ? '#10b981' : '#ef4444' }}>
                              {Number(item.viewsGrowth30dPct) >= 0 ? '+' : ''}{Number(item.viewsGrowth30dPct).toFixed(1)}%
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500 }} title="Chưa đủ dữ liệu lịch sử để tính tăng trưởng">
                              —
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenTeamDetails(item.teamId)}
                            style={{
                              padding: '4px 10px',
                              fontSize: 12,
                              fontWeight: 600,
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              color: '#334155',
                              cursor: 'pointer',
                            }}
                          >
                            Xem Kênh Của Đội
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TAB 4: TEAM CHANNELS & DETAIL ================= */}
        {activeTab === 'team_detail' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Team Drilldown Header & Back Button */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  <ArrowLeft size={14} /> Quay lại Tổng Quan
                </button>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  Kênh YouTube của {teamDetails?.team?.name || myTeamData?.team?.name || 'Đội bạn'}
                </h3>
              </div>

              {isAdmin && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Đổi Team:</span>
                  <select
                    value={selectedTeamId || ''}
                    onChange={(e) => handleOpenTeamDetails(e.target.value)}
                    style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #cbd5e1', background: '#ffffff' }}
                  >
                    <option value="">-- Chọn Team --</option>
                    {teamsList.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Member with no team state */}
            {!isAdmin && !userTeamId && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: 24, textAlign: 'center', color: '#92400e' }}>
                <AlertTriangle size={32} style={{ margin: '0 auto 12px' }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Bạn chưa gia nhập Đội nào</h3>
                <p style={{ margin: '8px 0 0', fontSize: 13 }}>
                  Hãy tham gia một Đội để theo dõi YouTube Analytics riêng của đội bạn.
                </p>
              </div>
            )}

            {/* Team Details Content */}
            {(teamDetails || myTeamData) && (
              (() => {
                const currentTeam = (isAdmin && teamDetails) ? teamDetails : myTeamData;
                const summary = currentTeam?.summary;
                const channels = currentTeam?.channels || [];
                const history = currentTeam?.history || [];

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Team KPI Strip */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 16 }}>
                        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Tổng Views Của Đội</div>
                        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#0f172a', marginTop: 4 }}>
                          {formatNumber(summary?.totalViews || 0)}
                        </div>
                        <div style={{ fontSize: 11, color: '#10b981', marginTop: 2 }}>
                          +{formatNumber(summary?.views30d || 0)} views (30D)
                        </div>
                      </div>

                      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 16 }}>
                        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Subscribers Của Đội</div>
                        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#0f172a', marginTop: 4 }}>
                          {formatNumber(summary?.totalSubscribers || 0)}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          {channels.length} kênh thuộc sở hữu
                        </div>
                      </div>

                      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 16 }}>
                        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Tăng Trưởng 30 Ngày</div>
                        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: summary?.viewsGrowth30dPct !== null ? '#10b981' : '#94a3b8', marginTop: 4 }}>
                          {summary?.viewsGrowth30dPct !== null && summary?.viewsGrowth30dPct !== undefined
                            ? `${Number(summary.viewsGrowth30dPct) >= 0 ? '+' : ''}${Number(summary.viewsGrowth30dPct).toFixed(1)}%`
                            : 'Chưa đủ dữ liệu'}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          {summary?.viewsGrowth30dPct !== null ? `Hạng #${summary?.rankByGrowth || '—'} công ty` : 'Cần thêm dữ liệu lịch sử'}
                        </div>
                      </div>
                    </div>

                    {/* Channels belonging to team */}
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Tv size={16} color="#ef4444" />
                          <span>Kênh YouTube Thuộc Đội ({channels.length})</span>
                        </h3>
                      </div>

                      {channels.length === 0 ? (
                        <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                          Chưa có kênh YouTube nào được liên kết với Team này.
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                          {channels.map((ch) => (
                            <div
                              key={ch.id}
                              style={{
                                border: '1px solid #e2e8f0',
                                padding: 16,
                                background: '#f8fafc',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 12,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div
                                  style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: '50%',
                                    background: '#fee2e2',
                                    color: '#ef4444',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: 16,
                                    flexShrink: 0,
                                    overflow: 'hidden',
                                  }}
                                >
                                  {ch.thumbnailUrl ? (
                                    <img src={ch.thumbnailUrl} alt={ch.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    ch.title.charAt(0)
                                  )}
                                </div>
                                <div style={{ overflow: 'hidden' }}>
                                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {ch.title}
                                  </div>
                                  <div style={{ fontSize: 12, color: '#64748b' }}>
                                    {ch.customUrl || ch.channelId}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, textAlign: 'center', background: '#ffffff', padding: '10px 6px', border: '1px solid #e2e8f0' }}>
                                <div>
                                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#0f172a' }}>{formatNumber(ch.views)}</div>
                                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Views</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#0f172a' }}>{formatNumber(ch.subscribers)}</div>
                                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Subs</div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#64748b' }}>
                                <span>Đồng bộ: {formatRelativeTime(ch.lastSyncedAt)}</span>
                                <a
                                  href={`https://youtube.com/channel/${ch.channelId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: '#ef4444', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}
                                >
                                  Mở YouTube <ExternalLink size={10} />
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* ================= TAB: COMPARE TEAMS (Admin only) ================= */}
        {isAdmin && activeTab === 'compare' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Team Selectors */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>TEAM A</label>
                <select
                  value={teamAId}
                  onChange={(e) => setTeamAId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', fontSize: 14 }}
                >
                  {teamsList.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>VS</div>

              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>TEAM B</label>
                <select
                  value={teamBId}
                  onChange={(e) => setTeamBId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', fontSize: 14 }}
                >
                  {teamsList.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Comparison Result */}
            {comparison && (
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'center', marginBottom: 24, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{comparison.teamA?.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>CHỈ SỐ ĐỐI ĐẦU</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{comparison.teamB?.name}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Total Views Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr', gap: 16, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ textAlign: 'right', fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#3b82f6' }}>
                      {formatNumber(comparison.teamA?.totalViews)}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748b' }}>Tổng Lượt Xem</div>
                    <div style={{ textAlign: 'left', fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#3b82f6' }}>
                      {formatNumber(comparison.teamB?.totalViews)}
                    </div>
                  </div>

                  {/* Subscribers Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr', gap: 16, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ textAlign: 'right', fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#8b5cf6' }}>
                      {formatNumber(comparison.teamA?.totalSubscribers)}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748b' }}>Subscribers</div>
                    <div style={{ textAlign: 'left', fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#8b5cf6' }}>
                      {formatNumber(comparison.teamB?.totalSubscribers)}
                    </div>
                  </div>

                  {/* 30D Growth Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr', gap: 16, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ textAlign: 'right', fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: comparison.teamA?.viewsGrowth30dPct !== null ? '#10b981' : '#94a3b8' }}>
                      {comparison.teamA?.viewsGrowth30dPct !== null && comparison.teamA?.viewsGrowth30dPct !== undefined
                        ? `${Number(comparison.teamA.viewsGrowth30dPct) >= 0 ? '+' : ''}${Number(comparison.teamA.viewsGrowth30dPct).toFixed(1)}%`
                        : '—'}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748b' }}>Tăng Trưởng (30D)</div>
                    <div style={{ textAlign: 'left', fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: comparison.teamB?.viewsGrowth30dPct !== null ? '#10b981' : '#94a3b8' }}>
                      {comparison.teamB?.viewsGrowth30dPct !== null && comparison.teamB?.viewsGrowth30dPct !== undefined
                        ? `${Number(comparison.teamB.viewsGrowth30dPct) >= 0 ? '+' : ''}${Number(comparison.teamB.viewsGrowth30dPct).toFixed(1)}%`
                        : '—'}
                    </div>
                  </div>

                  {/* Channels Count Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr', gap: 16, alignItems: 'center', padding: '12px 0' }}>
                    <div style={{ textAlign: 'right', fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#0f172a' }}>
                      {comparison.teamA?.channelsCount} kênh
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748b' }}>Số Kênh Sở Hữu</div>
                    <div style={{ textAlign: 'left', fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#0f172a' }}>
                      {comparison.teamB?.channelsCount} kênh
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 7: ADMIN CHANNEL MANAGEMENT & SYNC ================= */}
        {isAdmin && activeTab === 'admin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Actions Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  Danh Sách & Quản Trị Kênh YouTube ({adminChannels.length})
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                  Thêm kênh mới, gán/hủy gán team quản lý, kích hoạt đồng bộ metrics từ YouTube API.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleSyncAll}
                  disabled={syncingAll}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    background: '#3b82f6',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={14} className={syncingAll ? 'animate-spin' : ''} />
                  <span>{syncingAll ? 'Đang đồng bộ...' : 'Đồng Bộ Tất Cả'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddChannel(!showAddChannel)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: 600,
                    background: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={14} />
                  <span>Thêm Kênh Mới</span>
                </button>
              </div>
            </div>

            {/* Add Channel Form */}
            {showAddChannel && (
              <form onSubmit={handleCreateChannel} style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20 }}>
                <h4 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Đăng Ký Kênh YouTube Mới</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Channel ID (bắt buộc)</label>
                    <input
                      type="text"
                      placeholder="UC_x5XG1OV2P6uZZ5FSM9Ttw"
                      value={newChannelId}
                      onChange={(e) => setNewChannelId(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Tên Kênh (bắt buộc)</label>
                    <input
                      type="text"
                      placeholder="Phoenix Official"
                      value={newChannelTitle}
                      onChange={(e) => setNewChannelTitle(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Custom URL / Handle</label>
                    <input
                      type="text"
                      placeholder="@phoenix_official"
                      value={newCustomUrl}
                      onChange={(e) => setNewCustomUrl(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Gán Team Quản Lý</label>
                    <select
                      value={newTeamId}
                      onChange={(e) => setNewTeamId(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', fontSize: 13 }}
                    >
                      <option value="">-- Chưa gán Team (Kênh độc lập) --</option>
                      {teamsList.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowAddChannel(false)}
                    style={{ padding: '6px 14px', fontSize: 13, background: '#f1f5f9', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={creatingChannel}
                    style={{ padding: '6px 14px', fontSize: 13, fontWeight: 600, background: '#ef4444', color: '#ffffff', border: 'none', cursor: 'pointer' }}
                  >
                    {creatingChannel ? 'Đang lưu...' : 'Lưu & Đăng Ký'}
                  </button>
                </div>
              </form>
            )}

            {/* Admin Channels Table */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                    <th style={{ padding: '12px 14px' }}>Kênh</th>
                    <th style={{ padding: '12px 14px' }}>Team Quản Lý</th>
                    <th style={{ padding: '12px 14px' }}>Trạng Thái Đồng Bộ</th>
                    <th style={{ padding: '12px 14px' }}>Cập Nhật Lần Cuối</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {adminChannels.map((ch) => (
                    <tr key={ch.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{ch.title}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{ch.channelId} {ch.customUrl ? `• ${ch.customUrl}` : ''}</div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <select
                          value={ch.teamId || ''}
                          disabled={linkingChannelId === ch.id}
                          onChange={(e) => handleLinkTeam(ch.id, e.target.value)}
                          style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #cbd5e1', background: '#ffffff' }}
                        >
                          <option value="">-- Chưa gán đội --</option>
                          {teamsList.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {ch.syncStatus === 'SUCCESS' && (
                          <span style={{ color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={14} /> Thành công
                          </span>
                        )}
                        {ch.syncStatus === 'SYNCING' && (
                          <span style={{ color: '#3b82f6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <RefreshCw size={14} className="animate-spin" /> Đang đồng bộ...
                          </span>
                        )}
                        {ch.syncStatus === 'ERROR' && (
                          <span style={{ color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <XCircle size={14} /> Lỗi
                          </span>
                        )}
                        {ch.syncStatus === 'IDLE' && (
                          <span style={{ color: '#64748b' }}>Chờ đồng bộ</span>
                        )}
                        {ch.lastSyncError && (
                          <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ch.lastSyncError}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#64748b' }}>
                        {formatRelativeTime(ch.lastSyncedAt)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => handleSyncChannel(ch.id)}
                            disabled={adminSyncingId === ch.id}
                            style={{
                              padding: '4px 10px',
                              fontSize: 12,
                              fontWeight: 600,
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              color: '#334155',
                              cursor: 'pointer',
                            }}
                          >
                            {adminSyncingId === ch.id ? '...' : 'Sync'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteChannel(ch.id)}
                            disabled={deletingChannelId === ch.id}
                            style={{
                              padding: '4px 10px',
                              fontSize: 12,
                              fontWeight: 600,
                              background: '#fee2e2',
                              border: '1px solid #fecaca',
                              color: '#dc2626',
                              cursor: 'pointer',
                            }}
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </TabTransition>
    </div>
  );
}
