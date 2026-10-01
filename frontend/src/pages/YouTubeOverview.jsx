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
} from 'lucide-react';
import { youtube, groups as groupsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast, useConfirm } from '../context/UiContext';
import { parseApiError } from '../utils/errors';
import { TabTransition, TableSkeleton } from '../components/ui';

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
  // For Admin: 'overview', 'leaderboard', 'top_videos', 'compare', 'admin'
  // For Member: 'my_team', 'leaderboard', 'top_videos'
  const [activeTab, setActiveTab] = useState(isAdmin ? 'overview' : 'my_team');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Company Overview (Admin or High-level)
  const [overview, setOverview] = useState(null);

  // My Team Data (Member or Admin own team)
  const [myTeamData, setMyTeamData] = useState(null);
  const [myTeamLoading, setMyTeamLoading] = useState(false);

  // Leaderboard data (Public / Company-wide)
  const [sortBy, setSortBy] = useState('views'); // 'views', 'subscribers', 'growth'
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Top videos data
  const [videoTimeframe, setVideoTimeframe] = useState('30d');
  const [topVideos, setTopVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);

  // Team comparison data (Admin or Member own team)
  const [teamsList, setTeamsList] = useState([]);
  const [teamAId, setTeamAId] = useState('');
  const [teamBId, setTeamBId] = useState('');
  const [comparison, setComparison] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Selected team drilldown (Admin only or Member own team)
  const [selectedTeamId, setSelectedTeamId] = useState(null);
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

  // Fetch Company Overview
  const fetchOverviewData = async () => {
    try {
      const data = await youtube.getOverview();
      setOverview(data);
    } catch (err) {
      console.error('Failed to load YouTube overview:', err);
    }
  };

  // Fetch My Team Data
  const fetchMyTeamData = async () => {
    if (!userTeamId) {
      setMyTeamData(null);
      return;
    }
    setMyTeamLoading(true);
    try {
      const data = await youtube.getMyTeam();
      setMyTeamData(data);
    } catch (err) {
      console.error('Failed to load my team YouTube data:', err);
    } finally {
      setMyTeamLoading(false);
    }
  };

  // Fetch Public Leaderboard
  const fetchLeaderboardData = async () => {
    setLeaderboardLoading(true);
    try {
      const data = await youtube.getLeaderboard({ sortBy, limit: 50 });
      setLeaderboard(data.items || []);
    } catch (err) {
      console.error('Failed to load YouTube leaderboard:', err);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  // Fetch Top Videos
  const fetchTopVideosData = async () => {
    setVideosLoading(true);
    try {
      // Members automatically fetch own team top videos if present
      const params = { timeframe: videoTimeframe, limit: 24 };
      if (!isAdmin && userTeamId) {
        params.teamId = userTeamId;
      }
      const data = await youtube.getTopVideos(params);
      setTopVideos(data.items || []);
    } catch (err) {
      console.error('Failed to load top videos:', err);
    } finally {
      setVideosLoading(false);
    }
  };

  // Fetch Admin Channels (Admin only)
  const fetchAdminChannelsData = async () => {
    if (!isAdmin) return;
    try {
      const data = await youtube.adminGetChannels();
      setAdminChannels(data.items || []);
    } catch (err) {
      console.error('Failed to load admin channels:', err);
    }
  };

  // Fetch Teams List
  const fetchTeams = async () => {
    try {
      const res = await groupsApi.list();
      const teams = res.data?.teams || res.data || [];
      setTeamsList(teams);
      if (teams.length >= 2) {
        setTeamAId(teams[0].id);
        setTeamBId(teams[1].id);
      }
    } catch (err) {
      console.error('Failed to load teams list:', err);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchOverviewData(),
      fetchMyTeamData(),
      fetchLeaderboardData(),
      fetchTopVideosData(),
      fetchTeams(),
      fetchAdminChannelsData(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [isAdmin, userTeamId]);

  useEffect(() => {
    fetchLeaderboardData();
  }, [sortBy]);

  useEffect(() => {
    fetchTopVideosData();
  }, [videoTimeframe]);

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
    // If user is member and clicks a team other than their own, block access
    if (!isAdmin && userTeamId && Number(targetTeamId) !== Number(userTeamId)) {
      toast.info('Dữ liệu chi tiết của đội khác được bảo mật. Bạn chỉ có thể xem YouTube của đội mình.');
      return;
    }

    setSelectedTeamId(targetTeamId);
    setTeamDetailsLoading(true);
    try {
      const res = await youtube.getTeamDetails(targetTeamId);
      setTeamDetails(res);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể tải chi tiết team'));
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
        fetchLeaderboardData(),
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
        fetchLeaderboardData(),
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
        fetchLeaderboardData(),
        fetchTopVideosData(),
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
        toast.success('Đã gỡ liên kết kênh khỏi Team');
      }
      await Promise.all([
        fetchAdminChannelsData(),
        fetchOverviewData(),
        fetchLeaderboardData(),
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
      message: 'Bạn có chắc chắn muốn xóa kênh này khỏi hệ thống? Dữ liệu lịch sử và video liên quan sẽ bị gỡ bỏ.',
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
        fetchLeaderboardData(),
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

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 8, background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Tv size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, lineHeight: 1.3, color: '#0f172a' }}>
                  {isAdmin ? 'YouTube Studio Hub — Toàn Công Ty' : `YouTube của Đội: ${myTeamData?.team?.name || 'My Team'}`}
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
                  {isAdmin ? 'Admin Scope (Toàn công ty)' : 'Team Scope (Nội bộ đội)'}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b', lineHeight: 1.55, fontWeight: 400 }}>
                {isAdmin
                  ? 'Theo dõi thành tích thực tế, bảng xếp hạng views/subs của các Team và kho nội dung video toàn công ty.'
                  : `Theo dõi số liệu lượt xem, người đăng ký, kênh và video thuộc quyền sở hữu của ${myTeamData?.team?.name || 'đội bạn'}.`}
              </p>
            </div>
          </div>
        </div>

        {/* Freshness Badge & Refresh Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

      {/* KPI METRIC CARDS (Admin sees Company, Member sees Team) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 13, fontWeight: 600 }}>
            <span>{isAdmin ? 'Tổng Lượt Xem (Công ty)' : 'Lượt Xem Của Đội'}</span>
            <Eye size={18} color="#3b82f6" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#0f172a', marginTop: 8 }}>
            {isAdmin
              ? formatNumber(overview?.kpis?.totalViews || 0)
              : formatNumber(myTeamData?.summary?.totalViews || 0)}
          </div>
          <div style={{ fontSize: 12, color: '#10b981', fontWeight: 500, marginTop: 4 }}>
            {isAdmin
              ? 'Toàn bộ các kênh công ty'
              : `+${formatNumber(myTeamData?.summary?.views30d || 0)} views trong 30 ngày`}
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 13, fontWeight: 600 }}>
            <span>{isAdmin ? 'Tổng Người Đăng Ký' : 'Subscribers Của Đội'}</span>
            <Users size={18} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#0f172a', marginTop: 8 }}>
            {isAdmin
              ? formatNumber(overview?.kpis?.totalSubscribers || 0)
              : formatNumber(myTeamData?.summary?.totalSubscribers || 0)}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: 400 }}>
            {isAdmin ? 'Người theo dõi toàn hệ thống' : `${myTeamData?.summary?.channelsCount || 0} kênh thuộc đội`}
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 13, fontWeight: 600 }}>
            <span>{isAdmin ? 'Tổng Số Video' : 'Video Đã Xuất Bản'}</span>
            <Video size={18} color="#ec4899" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#0f172a', marginTop: 8 }}>
            {isAdmin
              ? overview?.kpis?.totalVideos || 0
              : myTeamData?.summary?.videosCount || 0}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: 400 }}>
            Nội dung đã xuất bản
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 13, fontWeight: 600 }}>
            <span>{isAdmin ? 'Số Kênh Hoạt Động' : 'Tăng Trưởng 30 Ngày'}</span>
            <TrendingUp size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#0f172a', marginTop: 8 }}>
            {isAdmin ? (
              <>
                {overview?.kpis?.totalChannels || 0}{' '}
                <span style={{ fontSize: 14, fontWeight: 500, color: '#64748b', fontFamily: 'inherit' }}>
                  kênh / {overview?.kpis?.totalTeams || 0} teams
                </span>
              </>
            ) : (
              `${Number(myTeamData?.summary?.viewsGrowth30dPct || 0) >= 0 ? '+' : ''}${myTeamData?.summary?.viewsGrowth30dPct || 0}%`
            )}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: 400 }}>
            {isAdmin ? 'Được phân quyền quản lý' : `Hạng #${myTeamData?.summary?.rankByViews || '—'} Views toàn công ty`}
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', gap: 8, marginBottom: 24, overflowX: 'auto' }}>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '12px 18px',
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
            }}
          >
            <Building2 size={16} />
            <span>Tổng Quan Công Ty</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('my_team')}
          style={{
            padding: '12px 18px',
            fontSize: 14,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'my_team' ? '3px solid #ef4444' : '3px solid transparent',
            color: activeTab === 'my_team' ? '#ef4444' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            whiteSpace: 'nowrap',
          }}
        >
          <Tv size={16} />
          <span>{isAdmin ? 'Chi Tiết Theo Đội' : 'YouTube Của Đội'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leaderboard')}
          style={{
            padding: '12px 18px',
            fontSize: 14,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'leaderboard' ? '3px solid #ef4444' : '3px solid transparent',
            color: activeTab === 'leaderboard' ? '#ef4444' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            whiteSpace: 'nowrap',
          }}
        >
          <Award size={16} />
          <span>Bảng Xếp Hạng</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('top_videos')}
          style={{
            padding: '12px 18px',
            fontSize: 14,
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'top_videos' ? '3px solid #ef4444' : '3px solid transparent',
            color: activeTab === 'top_videos' ? '#ef4444' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            whiteSpace: 'nowrap',
          }}
        >
          <Flame size={16} />
          <span>Top Video Xuất Sắc</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('compare')}
            style={{
              padding: '12px 18px',
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
              padding: '12px 18px',
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
            }}
          >
            <Shield size={16} />
            <span>Quản Lý Kênh & Sync</span>
          </button>
        )}
      </div>

      <TabTransition key={activeTab} minHeight={420}>
        {/* TAB 1: COMPANY OVERVIEW (Admin only) */}
        {isAdmin && activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Top teams breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {/* Top Teams by Views */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Eye size={18} color="#3b82f6" />
                <span>Top Teams Theo Lượt Xem</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {overview?.topTeamsByViews?.map((team, idx) => (
                  <div
                    key={team.teamId}
                    onClick={() => handleOpenTeamDetails(team.teamId)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      background: '#f8fafc',
                      cursor: 'pointer',
                      borderLeft: idx === 0 ? '4px solid #eab308' : '4px solid #cbd5e1',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                        #{idx + 1} {team.teamName}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {formatNumber(team.totalSubscribers)} subs • +{team.viewsGrowth30dPct}% 30D
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#3b82f6' }}>
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
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={18} color="#10b981" />
                <span>Top Teams Tăng Trưởng Nhanh Nhất (30D)</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {overview?.topTeamsByGrowth?.map((team, idx) => (
                  <div
                    key={team.teamId}
                    onClick={() => handleOpenTeamDetails(team.teamId)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      background: '#f8fafc',
                      cursor: 'pointer',
                      borderLeft: idx === 0 ? '4px solid #10b981' : '4px solid #cbd5e1',
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
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#10b981' }}>
                        +{team.viewsGrowth30dPct}%
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

      {/* TAB 2: MY TEAM / TEAM DRILLDOWN VIEW */}
      {activeTab === 'my_team' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {isAdmin && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Chọn Team để xem chi tiết:</span>
              <select
                value={selectedTeamId || userTeamId || ''}
                onChange={(e) => handleOpenTeamDetails(e.target.value)}
                style={{ padding: '6px 12px', fontSize: 13, border: '1px solid #cbd5e1', background: '#ffffff', minWidth: 200 }}
              >
                <option value="">-- Chọn Team --</option>
                {teamsList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Member with no team state */}
          {!isAdmin && !userTeamId && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: 24, textAlign: 'center', color: '#92400e' }}>
              <AlertTriangle size={32} style={{ margin: '0 auto 12px' }} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Bạn chưa gia nhập Team nào</h3>
              <p style={{ margin: '8px 0 0', fontSize: 13 }}>
                Hãy tham gia một Đội để theo dõi YouTube Analytics riêng của đội bạn.
              </p>
            </div>
          )}

          {/* Team Details Container */}
          {(myTeamData || teamDetails) && (
            (() => {
              const currentTeam = (isAdmin && teamDetails) ? teamDetails : myTeamData;
              const summary = currentTeam?.summary;
              const channels = currentTeam?.channels || [];
              const teamTopVideos = currentTeam?.topVideos || [];
              const history = currentTeam?.history || [];

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Channels belonging to team */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Layers size={18} color="#ef4444" />
                        <span>Các Kênh YouTube Thuộc Đội ({channels.length})</span>
                      </h3>
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        1 Team có thể sở hữu nhiều kênh
                      </span>
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
                                }}
                              >
                                {ch.thumbnailUrl ? (
                                  <img src={ch.thumbnailUrl} alt={ch.title} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
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

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center', background: '#ffffff', padding: '10px 6px', border: '1px solid #e2e8f0' }}>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{formatNumber(ch.views)}</div>
                                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Views</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{formatNumber(ch.subscribers)}</div>
                                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Subs</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{ch.videosCount || 0}</div>
                                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Videos</div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#64748b' }}>
                              <span>Đồng bộ: {formatRelativeTime(ch.lastSyncedAt)}</span>
                              {ch.syncStatus === 'SUCCESS' && <span style={{ color: '#059669', fontWeight: 600 }}>Thành công</span>}
                              {ch.syncStatus === 'ERROR' && <span style={{ color: '#dc2626', fontWeight: 600 }}>Lỗi</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Team Top Videos */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Flame size={18} color="#f59e0b" />
                      <span>Top 10 Video Lượt Xem Cao Nhất Của Đội</span>
                    </h3>

                    {teamTopVideos.length === 0 ? (
                      <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                        Chưa có dữ liệu video cho đội này.
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                              <th style={{ padding: '10px 8px' }}>#</th>
                              <th style={{ padding: '10px 8px' }}>Video</th>
                              <th style={{ padding: '10px 8px' }}>Kênh</th>
                              <th style={{ padding: '10px 8px', textAlign: 'right' }}>Lượt xem</th>
                              <th style={{ padding: '10px 8px', textAlign: 'right' }}>Likes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {teamTopVideos.map((v, idx) => (
                              <tr key={v.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '12px 8px', fontWeight: 700, color: '#64748b' }}>#{idx + 1}</td>
                                <td style={{ padding: '12px 8px', fontWeight: 600, color: '#0f172a' }}>{v.title}</td>
                                <td style={{ padding: '12px 8px', color: '#64748b' }}>{v.channelTitle}</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: '#3b82f6' }}>{formatNumber(v.views)}</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', color: '#64748b' }}>{formatNumber(v.likes)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* 30D Historical Trend Points */}
                  {history.length > 0 && (
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20 }}>
                      <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TrendingUp size={18} color="#10b981" />
                        <span>Xu Hướng Tăng Trưởng 30 Ngày Gần Nhất</span>
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                        {history.slice(-7).map((pt, idx) => (
                          <div key={pt.date || idx} style={{ background: '#f8fafc', padding: 12, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{pt.date}</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{formatNumber(pt.views)}</div>
                            <div style={{ fontSize: 11, color: '#10b981', marginTop: 2 }}>{formatNumber(pt.subscribers)} subs</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* TAB 3: PUBLIC LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Privacy & Scope Notice */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Lock size={16} color="#64748b" />
            <span style={{ fontSize: 13, color: '#475569' }}>
              <strong>Bảng xếp hạng công khai:</strong> Toàn bộ nhân viên có thể xem thứ hạng và tổng số liệu của các đội. Chi tiết kênh và phân tích chuyên sâu được bảo mật theo từng Team.
            </span>
          </div>

          {/* Sort Tabs & Canonical Hub Link */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Xếp hạng theo:</span>
              <button
                type="button"
                onClick={() => setSortBy('views')}
                style={{
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  background: sortBy === 'views' ? '#ef4444' : '#ffffff',
                  color: sortBy === 'views' ? '#ffffff' : '#334155',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                }}
              >
                Lượt Xem (Views)
              </button>
              <button
                type="button"
                onClick={() => setSortBy('subscribers')}
                style={{
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  background: sortBy === 'subscribers' ? '#ef4444' : '#ffffff',
                  color: sortBy === 'subscribers' ? '#ffffff' : '#334155',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                }}
              >
                Người Đăng Ký (Subs)
              </button>
              <button
                type="button"
                onClick={() => setSortBy('growth')}
                style={{
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  background: sortBy === 'growth' ? '#ef4444' : '#ffffff',
                  color: sortBy === 'growth' ? '#ffffff' : '#334155',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                }}
              >
                Tốc Độ Tăng Trưởng (%)
              </button>
            </div>

            <a
              href={`/rankings?scope=youtube&metric=${sortBy}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                background: '#0f172a',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
                borderRadius: 4,
              }}
            >
              <span>Xem Tại Trung Tâm BXH</span>
              <ExternalLink size={12} />
            </a>
          </div>

          {/* Leaderboard Table */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '14px 16px' }}>Hạng</th>
                  <th style={{ padding: '14px 16px' }}>Team</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>Số Kênh</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right' }}>Tổng Views</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right' }}>Tổng Subs</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right' }}>Tăng Trưởng (30D)</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>Chi Tiết</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((item, idx) => {
                  const isMyTeam = userTeamId && Number(item.teamId) === Number(userTeamId);
                  return (
                    <tr
                      key={item.id || item.teamId}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isMyTeam ? '#f0fdf4' : '#ffffff',
                      }}
                    >
                      <td style={{ padding: '14px 16px', fontWeight: 700 }}>
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
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{item.teamName}</span>
                          {isMyTeam && (
                            <span style={{ fontSize: 11, background: '#dcfce7', color: '#15803d', padding: '2px 6px', fontWeight: 700 }}>
                              ĐỘI CỦA BẠN
                            </span>
                          )}
                        </div>
                        {item.topVideoTitle && (
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                            Top Video: {item.topVideoTitle}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                        {item.channelsCount || 0}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        {formatNumber(item.totalViews)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: '#64748b' }}>
                        {formatNumber(item.totalSubscribers)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: Number(item.viewsGrowth30dPct) >= 0 ? '#10b981' : '#ef4444' }}>
                          {Number(item.viewsGrowth30dPct) >= 0 ? '+' : ''}{item.viewsGrowth30dPct}%
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {isAdmin || isMyTeam ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (isMyTeam) {
                                setActiveTab('my_team');
                              } else {
                                handleOpenTeamDetails(item.teamId);
                              }
                            }}
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
                            Xem Chi Tiết
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <Lock size={12} /> Bảo mật
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: TOP VIDEOS */}
      {activeTab === 'top_videos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Timeframe Filter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Khoảng thời gian:</span>
              <button
                type="button"
                onClick={() => setVideoTimeframe('7d')}
                style={{
                  padding: '6px 12px',
                  fontSize: 13,
                  fontWeight: 600,
                  background: videoTimeframe === '7d' ? '#ef4444' : '#ffffff',
                  color: videoTimeframe === '7d' ? '#ffffff' : '#334155',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                }}
              >
                7 Ngày Qua
              </button>
              <button
                type="button"
                onClick={() => setVideoTimeframe('30d')}
                style={{
                  padding: '6px 12px',
                  fontSize: 13,
                  fontWeight: 600,
                  background: videoTimeframe === '30d' ? '#ef4444' : '#ffffff',
                  color: videoTimeframe === '30d' ? '#ffffff' : '#334155',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                }}
              >
                30 Ngày Qua
              </button>
              <button
                type="button"
                onClick={() => setVideoTimeframe('year')}
                style={{
                  padding: '6px 12px',
                  fontSize: 13,
                  fontWeight: 600,
                  background: videoTimeframe === 'year' ? '#ef4444' : '#ffffff',
                  color: videoTimeframe === 'year' ? '#ffffff' : '#334155',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                }}
              >
                Năm Nay
              </button>
              <button
                type="button"
                onClick={() => setVideoTimeframe('all')}
                style={{
                  padding: '6px 12px',
                  fontSize: 13,
                  fontWeight: 600,
                  background: videoTimeframe === 'all' ? '#ef4444' : '#ffffff',
                  color: videoTimeframe === 'all' ? '#ffffff' : '#334155',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                }}
              >
                Tất Cả
              </button>
            </div>

            <span style={{ fontSize: 12, color: '#64748b' }}>
              {isAdmin ? 'Top video toàn công ty' : `Top video của ${myTeamData?.team?.name || 'đội bạn'}`}
            </span>
          </div>

          {/* Videos Grid */}
          {topVideos.length === 0 ? (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 40, textAlign: 'center', color: '#94a3b8' }}>
              Chưa có video nào trong khoảng thời gian đã chọn.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {topVideos.map((v, idx) => (
                <div
                  key={v.id || idx}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ height: 160, background: '#0f172a', position: 'relative', overflow: 'hidden' }}>
                    {v.thumbnailUrl ? (
                      <img src={v.thumbnailUrl} alt={v.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                        <Tv size={32} />
                      </div>
                    )}
                    <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.8)', color: '#ffffff', fontSize: 11, padding: '2px 6px', fontWeight: 600 }}>
                      {formatNumber(v.views)} views
                    </div>
                  </div>

                  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', lineHeight: 1.4, marginBottom: 6 }}>
                        {v.title}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {v.channel?.title || 'YouTube Channel'} • {v.channel?.team?.name || 'Team'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#94a3b8', marginTop: 12, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                      <span>{formatDate(v.publishedAt)}</span>
                      <span>{formatNumber(v.likes)} likes</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: COMPARE TEAMS (Admin only) */}
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
                  <div style={{ textAlign: 'right', fontSize: 18, fontWeight: 700, color: '#3b82f6' }}>
                    {formatNumber(comparison.teamA?.totalViews)}
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748b' }}>Tổng Lượt Xem</div>
                  <div style={{ textAlign: 'left', fontSize: 18, fontWeight: 700, color: '#3b82f6' }}>
                    {formatNumber(comparison.teamB?.totalViews)}
                  </div>
                </div>

                {/* Subscribers Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr', gap: 16, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ textAlign: 'right', fontSize: 18, fontWeight: 700, color: '#8b5cf6' }}>
                    {formatNumber(comparison.teamA?.totalSubscribers)}
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748b' }}>Subscribers</div>
                  <div style={{ textAlign: 'left', fontSize: 18, fontWeight: 700, color: '#8b5cf6' }}>
                    {formatNumber(comparison.teamB?.totalSubscribers)}
                  </div>
                </div>

                {/* 30D Growth Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr', gap: 16, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ textAlign: 'right', fontSize: 18, fontWeight: 700, color: '#10b981' }}>
                    +{comparison.teamA?.viewsGrowth30dPct}%
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748b' }}>Tăng Trưởng (30D)</div>
                  <div style={{ textAlign: 'left', fontSize: 18, fontWeight: 700, color: '#10b981' }}>
                    +{comparison.teamB?.viewsGrowth30dPct}%
                  </div>
                </div>

                {/* Channels Count Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr', gap: 16, alignItems: 'center', padding: '12px 0' }}>
                  <div style={{ textAlign: 'right', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                    {comparison.teamA?.channelsCount} kênh
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748b' }}>Số Kênh Sở Hữu</div>
                  <div style={{ textAlign: 'left', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                    {comparison.teamB?.channelsCount} kênh
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: ADMIN CHANNEL MANAGEMENT & SYNC */}
      {isAdmin && activeTab === 'admin' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Actions Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                Danh Sách & Quản Trị Kênh YouTube ({adminChannels.length})
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                Thêm kênh mới, gán team quản lý, kích hoạt đồng bộ metrics thực tế từ YouTube API.
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
                    <option value="">-- Chưa gán Team --</option>
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
                  style={{ padding: '6px 14px', fontSize: 13, fontWeight: 600, background: '#ef4444', color: '#ffffff', border: 'none', cursor: 'pointer' }}
                >
                  Lưu & Đồng Bộ Ngay
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
                        onChange={(e) => handleLinkTeam(ch.id, e.target.value)}
                        style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #cbd5e1', background: '#ffffff' }}
                      >
                        <option value="">-- Chưa gán --</option>
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
