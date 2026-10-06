import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2,
  Tv,
  Users,
  Plus,
  Edit3,
  Trash2,
  RefreshCw,
  Link2,
  Unlink,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Eye,
  Flame,
  Filter,
  Check,
  X,
  Sparkles,
  Layers,
  ChevronRight,
  HelpCircle,
  ThumbsUp,
  MessageSquare,
  BarChart2,
  Clock,
  Info,
  Crown,
} from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';
import { youtube, groups as groupsApi, users as usersApi } from '../services/api';
import { useToast, useConfirm } from '../context/UiContext';
import { parseApiError } from '../utils/errors';
import { Card, EmptyState, PageState, Button, SegmentedControl, TabTransition, CardSkeleton, TableSkeleton } from '../components/ui';

const CARD = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-content)',
  boxShadow: 'var(--shadow-card)',
};

const DEPARTMENT_OPTIONS = [
  'Media & Content',
  'Engineering Core',
  'Community & Growth',
  'Phòng Sản Xuất Video',
  'Phòng Truyền Thông',
  'Phòng Kỹ Thuật',
  'Ban Giám Đốc',
];

const TEAM_COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  'var(--text-secondary)',
];

function fmtNum(n) {
  n = Number(n) || 0;
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString('vi-VN');
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

export default function AdminTeamsYouTube() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();

  const activeTab = searchParams.get('tab') === 'teams' ? 'teams' : 'channels';
  const setActiveTab = (tab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    setSearchParams(nextParams);
  };
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Teams State
  const [teams, setTeams] = useState([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [teamDeptFilter, setTeamDeptFilter] = useState('all');
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState(false);
  const [editTeamModalOpen, setEditTeamModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamForm, setTeamForm] = useState({ name: '', description: '', department: 'Media & Content', color: '#3b82f6', ownerId: '' });
  const [savingTeam, setSavingTeam] = useState(false);
  const [deletingTeamId, setDeletingTeamId] = useState(null);

  // Team Members Drawer State
  const [membersDrawerTeam, setMembersDrawerTeam] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserIdToAdd, setSelectedUserIdToAdd] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState(null);

  // Channels State
  const [channels, setChannels] = useState([]);
  const [overview, setOverview] = useState(null);
  const [channelSearch, setChannelSearch] = useState('');
  const [channelTeamFilter, setChannelTeamFilter] = useState('all'); // 'all' | 'unassigned' | teamId
  const [channelStatusFilter, setChannelStatusFilter] = useState('all'); // 'all' | 'synced' | 'stale' | 'error'
  const [createChannelModalOpen, setCreateChannelModalOpen] = useState(false);
  const [newChannelForm, setNewChannelForm] = useState({ channelId: '', title: '', customUrl: '', teamId: '' });
  const [savingChannel, setSavingChannel] = useState(false);
  const [syncingChannelId, setSyncingChannelId] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [linkingChannelId, setLinkingChannelId] = useState(null);
  const [deletingChannelId, setDeletingChannelId] = useState(null);

  // Channel Detail Modal State
  const [selectedChannelDetail, setSelectedChannelDetail] = useState(null);

  // Load All Data
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [groupsRes, channelsRes, overviewRes, usersRes] = await Promise.all([
        groupsApi.listAll().catch(() => ({ data: [] })),
        youtube.adminGetChannels().catch(() => ({ items: [], channels: [] })),
        youtube.adminGetOverview().catch(() => null),
        usersApi.list({ limit: 300 }).catch(() => ({ data: [] })),
      ]);

      setTeams(groupsRes.data || []);
      const channelItems = channelsRes.items || channelsRes.channels || (Array.isArray(channelsRes) ? channelsRes : []);
      setChannels(channelItems);
      setOverview(overviewRes);
      setAllUsers(usersRes.data || []);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể tải dữ liệu Đội nhóm & Kênh YouTube.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleUpdate = () => {
      loadData(true);
    };
    window.addEventListener('workrank:team-updated', handleUpdate);
    window.addEventListener('workrank:user-updated', handleUpdate);
    return () => {
      window.removeEventListener('workrank:team-updated', handleUpdate);
      window.removeEventListener('workrank:user-updated', handleUpdate);
    };
  }, [loadData]);

  // ─── TEAM HANDLERS ──────────────────────────────────────────────────────────

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!teamForm.name.trim()) {
      toast.warning('Tên đội nhóm không được để trống.');
      return;
    }

    setSavingTeam(true);
    try {
      await groupsApi.create({
        name: teamForm.name.trim(),
        description: teamForm.description.trim() || undefined,
        department: teamForm.department,
        color: teamForm.color,
        ownerId: teamForm.ownerId ? Number(teamForm.ownerId) : undefined,
      });
      toast.success(`Đã tạo đội "${teamForm.name}" thành công!`);
      setCreateTeamModalOpen(false);
      setTeamForm({ name: '', description: '', department: 'Media & Content', color: '#3b82f6', ownerId: '' });
      await loadData(true);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể tạo đội nhóm.'));
    } finally {
      setSavingTeam(false);
    }
  };

  const openEditTeam = (team) => {
    setSelectedTeam(team);
    setTeamForm({
      name: team.name || '',
      description: team.description || '',
      department: team.department || 'Media & Content',
      color: team.color || '#3b82f6',
      ownerId: team.ownerId ? String(team.ownerId) : '',
    });
    setEditTeamModalOpen(true);
  };

  const handleUpdateTeam = async (e) => {
    e.preventDefault();
    if (!selectedTeam) return;
    if (!teamForm.name.trim()) {
      toast.warning('Tên đội nhóm không được để trống.');
      return;
    }

    setSavingTeam(true);
    try {
      await groupsApi.update(selectedTeam.id, {
        name: teamForm.name.trim(),
        description: teamForm.description.trim(),
        department: teamForm.department,
        color: teamForm.color,
        ownerId: teamForm.ownerId ? Number(teamForm.ownerId) : null,
      });
      toast.success(`Đã cập nhật thông tin đội "${teamForm.name}"!`);
      setEditTeamModalOpen(false);
      setSelectedTeam(null);
      await loadData(true);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể cập nhật đội nhóm.'));
    } finally {
      setSavingTeam(false);
    }
  };

  const handleDeleteTeam = async (team) => {
    const ok = await confirm({
      title: 'Xác nhận xóa đội nhóm',
      message: `Bạn có chắc chắn muốn xóa Đội "${team.name}"? Thao tác này sẽ gỡ thành viên khỏi đội hiện tại.`,
      confirmText: 'Xóa đội',
      cancelText: 'Hủy',
      type: 'danger',
    });
    if (!ok) return;

    setDeletingTeamId(team.id);
    try {
      await groupsApi.delete(team.id);
      toast.success(`Đã xóa đội "${team.name}".`);
      await loadData(true);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể xóa đội nhóm.'));
    } finally {
      setDeletingTeamId(null);
    }
  };

  const openMembersDrawer = (team) => {
    setMembersDrawerTeam(team);
    setSelectedUserIdToAdd('');
  };

  const handleAddMemberToTeam = async (e) => {
    e.preventDefault();
    if (!membersDrawerTeam || !selectedUserIdToAdd) {
      toast.warning('Hãy chọn nhân viên cần thêm vào đội.');
      return;
    }

    setAddingMember(true);
    try {
      await usersApi.update(selectedUserIdToAdd, {
        teamId: membersDrawerTeam.id,
        reason: `Admin added employee to team ${membersDrawerTeam.name}`,
      });
      toast.success('Đã thêm nhân viên vào đội!');
      setSelectedUserIdToAdd('');
      await loadData(true);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể thêm thành viên vào đội.'));
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMemberFromTeam = async (userId, memberName) => {
    const ok = await confirm({
      title: 'Gỡ thành viên khỏi đội',
      message: `Bạn có chắc muốn gỡ "${memberName}" khỏi đội hiện tại?`,
      confirmText: 'Gỡ thành viên',
      cancelText: 'Hủy',
      type: 'danger',
    });
    if (!ok) return;

    setRemovingMemberId(userId);
    try {
      await usersApi.update(userId, {
        teamId: null,
        reason: `Admin removed employee from team`,
      });
      toast.success(`Đã gỡ "${memberName}" khỏi đội.`);
      await loadData(true);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể gỡ thành viên.'));
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleSetTeamLeader = async (teamId, userId, userName) => {
    try {
      await groupsApi.update(teamId, { ownerId: Number(userId) });
      toast.success(`Đã bổ nhiệm "${userName}" làm Trưởng nhóm!`);
      setMembersDrawerTeam((prev) => (prev ? { ...prev, ownerId: Number(userId) } : null));
      setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, ownerId: Number(userId) } : t)));
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể bổ nhiệm trưởng nhóm.'));
    }
  };

  // ─── CHANNEL HANDLERS ───────────────────────────────────────────────────────

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!newChannelForm.channelId.trim()) {
      toast.warning('Mã Channel ID (YouTube ID) không được để trống.');
      return;
    }

    setSavingChannel(true);
    try {
      await youtube.adminCreateChannel({
        channelId: newChannelForm.channelId.trim(),
        title: newChannelForm.title.trim() || undefined,
        customUrl: newChannelForm.customUrl.trim() || undefined,
        teamId: newChannelForm.teamId ? Number(newChannelForm.teamId) : null,
      });
      toast.success('Đã thêm kênh YouTube mới thành công!');
      setCreateChannelModalOpen(false);
      setNewChannelForm({ channelId: '', title: '', customUrl: '', teamId: '' });
      await loadData(true);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể thêm kênh YouTube.'));
    } finally {
      setSavingChannel(false);
    }
  };

  const handleLinkChannel = async (channelId, teamId) => {
    setLinkingChannelId(channelId);
    try {
      if (teamId) {
        await youtube.adminLinkChannel(channelId, Number(teamId));
        toast.success('Đã gán kênh cho đội thành công!');
      } else {
        await youtube.adminUnlinkChannel(channelId);
        toast.success('Đã hủy gán kênh.');
      }
      await loadData(true);
      if (selectedChannelDetail && selectedChannelDetail.id === channelId) {
        setSelectedChannelDetail((prev) => prev ? { ...prev, teamId: teamId ? Number(teamId) : null } : null);
      }
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể cập nhật liên kết kênh.'));
    } finally {
      setLinkingChannelId(null);
    }
  };

  const handleSyncChannel = async (channelId, title) => {
    setSyncingChannelId(channelId);
    try {
      const res = await youtube.adminSyncChannel(channelId);
      if (res.status === 'ERROR') {
        toast.error(`Đồng bộ thất bại: ${res.error || 'Lỗi không xác định'}`);
      } else {
        toast.success(`Đã đồng bộ dữ liệu mới nhất cho kênh "${title}"!`);
      }
      await loadData(true);
      if (selectedChannelDetail && selectedChannelDetail.id === channelId) {
        const updated = await youtube.getChannelDetails(channelId).catch(() => null);
        if (updated) setSelectedChannelDetail(updated);
      }
    } catch (err) {
      toast.error(parseApiError(err, 'Lỗi khi đồng bộ kênh từ YouTube.'));
    } finally {
      setSyncingChannelId(null);
    }
  };

  const handleSyncAllChannels = async () => {
    setSyncingAll(true);
    try {
      const res = await youtube.adminSyncAll();
      toast.success(`Đã đồng bộ hoàn tất ${res.success || 0}/${res.total || 0} kênh YouTube!`);
      await loadData(true);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể đồng bộ tất cả kênh YouTube.'));
    } finally {
      setSyncingAll(false);
    }
  };

  const handleDeleteChannel = async (channel) => {
    const ok = await confirm({
      title: 'Xác nhận xóa kênh YouTube',
      message: `Bạn có chắc chắn muốn xóa kênh "${channel.title || channel.channelId}" khỏi hệ thống?`,
      confirmText: 'Xóa kênh',
      cancelText: 'Hủy',
      type: 'danger',
    });
    if (!ok) return;

    setDeletingChannelId(channel.id);
    try {
      await youtube.adminDeleteChannel(channel.id);
      toast.success(`Đã xóa kênh "${channel.title || channel.channelId}".`);
      if (selectedChannelDetail && selectedChannelDetail.id === channel.id) {
        setSelectedChannelDetail(null);
      }
      await loadData(true);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể xóa kênh YouTube.'));
    } finally {
      setDeletingChannelId(null);
    }
  };

  // ─── FILTERED LISTS ─────────────────────────────────────────────────────────

  const filteredTeams = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    return teams.filter((t) => {
      if (q && !((t.name || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q))) return false;
      if (teamDeptFilter !== 'all' && t.department !== teamDeptFilter) return false;
      return true;
    });
  }, [teams, teamSearch, teamDeptFilter]);

  const filteredChannels = useMemo(() => {
    const q = channelSearch.trim().toLowerCase();
    return channels.filter((c) => {
      if (q && !((c.title || '').toLowerCase().includes(q) || (c.channelId || '').toLowerCase().includes(q) || (c.customUrl || '').toLowerCase().includes(q))) return false;
      
      // Team filter
      if (channelTeamFilter === 'unassigned' && c.teamId) return false;
      if (channelTeamFilter !== 'all' && channelTeamFilter !== 'unassigned' && Number(c.teamId) !== Number(channelTeamFilter)) return false;

      // Status filter
      if (channelStatusFilter === 'error' && c.syncStatus !== 'ERROR') return false;
      if (channelStatusFilter === 'synced' && c.syncStatus !== 'SUCCESS') return false;
      if (channelStatusFilter === 'stale') {
        const isStale = !c.lastSyncedAt || (Date.now() - new Date(c.lastSyncedAt).getTime() > 2 * 3600000);
        if (!isStale || c.syncStatus === 'ERROR') return false;
      }
      return true;
    });
  }, [channels, channelSearch, channelTeamFilter, channelStatusFilter]);

  const teamMembersList = useMemo(() => {
    if (!membersDrawerTeam) return [];
    return allUsers.filter((u) => Number(u.teamId) === Number(membersDrawerTeam.id));
  }, [allUsers, membersDrawerTeam]);

  const nonTeamUsers = useMemo(() => {
    if (!membersDrawerTeam) return [];
    return allUsers.filter((u) => Number(u.teamId) !== Number(membersDrawerTeam.id));
  }, [allUsers, membersDrawerTeam]);

  // Unassigned summary calculations
  const unassignedSummary = useMemo(() => {
    const unassigned = channels.filter((c) => !c.teamId);
    let views = 0;
    let subs = 0;
    unassigned.forEach((c) => {
      views += Number(c.views || 0);
      subs += Number(c.subscribers || 0);
    });
    return {
      count: unassigned.length,
      views,
      subs,
    };
  }, [channels]);

  const freshness = overview?.kpis?.freshnessStatus || 'FRESH';
  const lastSyncTime = overview?.kpis?.lastSyncedAt;

  if (loading) {
    return (
      <div className="admin-data-page" style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gap: 16 }}>
        <CardSkeleton />
        <TableSkeleton rows={8} />
      </div>
    );
  }

  return (
    <div className="admin-data-page" style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gap: 16, fontFamily: "'JetBrains Mono', monospace" }}>
      {/* ── 1. COMPANY OVERVIEW KPI BAR (TIER 1) ── */}
      <section style={{ ...CARD, padding: 22, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <Tv size={14} />
            Hệ Thống YouTube Toàn Công Ty
          </div>
          <h1 style={{ margin: '12px 0 6px', fontSize: 'var(--text-h1, 24px)', lineHeight: 1.25, color: 'var(--text-primary)', fontWeight: 700 }}>
            Quản Lý & Phân Tầng Dữ Liệu YouTube
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            Mô hình phân cấp: <strong>Công ty (Company Total)</strong> &rarr; <strong>Đội nhóm (Team Total)</strong> &rarr; <strong>Kênh (Channel Total)</strong>.
          </p>
        </div>

        {/* Freshness & Top Action Bar */}
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
              {freshness === 'FRESH' && `Cập nhật: ${formatRelativeTime(lastSyncTime)}`}
              {freshness === 'STALE' && `Cần sync: ${formatRelativeTime(lastSyncTime)}`}
              {freshness === 'FAILED' && 'Lỗi sync gần nhất'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            style={{
              padding: '8px 12px', background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid rgba(15,23,42,0.15)',
              fontSize: 12, fontWeight: 600, cursor: refreshing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </section>

      {/* KPI METRIC TILES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div style={{ ...CARD, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
            <span>Tổng Lượt Xem</span>
            <Eye size={16} color="#3b82f6" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
            {fmtNum(overview?.kpis?.totalViews || 0)}
          </div>
          <div style={{ fontSize: 11, color: overview?.kpis?.viewsGrowth30dPct !== null && overview?.kpis?.viewsGrowth30dPct !== undefined ? '#16a34a' : 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>
            {overview?.kpis?.viewsGrowth30dPct !== null && overview?.kpis?.viewsGrowth30dPct !== undefined
              ? `${Number(overview?.kpis?.viewsGrowth30dPct) >= 0 ? '+' : ''}${Number(overview?.kpis?.viewsGrowth30dPct).toFixed(1)}% tăng trưởng 30D`
              : 'Chưa đủ dữ liệu tăng trưởng'}
          </div>
        </div>

        <div style={{ ...CARD, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
            <span>Tổng Subscribers</span>
            <Users size={16} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
            {fmtNum(overview?.kpis?.totalSubscribers || 0)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Người theo dõi toàn hệ thống
          </div>
        </div>

        <div style={{ ...CARD, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
            <span>Tổng Kênh YouTube</span>
            <Tv size={16} color="#ef4444" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
            {channels.length}
          </div>
          <div style={{ fontSize: 11, color: unassignedSummary.count > 0 ? '#d97706' : 'var(--text-secondary)', marginTop: 4 }}>
            {unassignedSummary.count > 0 ? `${unassignedSummary.count} kênh chưa gán đội` : '100% kênh đã gán đội'}
          </div>
        </div>

        <div style={{ ...CARD, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
            <span>Đội Nhóm Phụ Trách</span>
            <Building2 size={16} color="var(--accent)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
            {teams.length}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Phòng ban & Production Teams
          </div>
        </div>
      </div>

      {/* ── TABS NAVIGATION & ACTIONS ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <SegmentedControl
          ariaLabel="Admin Teams & YouTube Tabs"
          options={[
            { key: 'channels', label: `Kênh YouTube & Đồng Bộ (${channels.length})` },
            { key: 'teams', label: `Đội Nhóm & Phòng Ban (${teams.length})` },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {activeTab === 'channels' && (
            <>
              <button
                type="button"
                onClick={handleSyncAllChannels}
                disabled={syncingAll}
                style={{
                  padding: '8px 14px', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid rgba(15,23,42,0.15)',
                  fontSize: 12, fontWeight: 600, cursor: syncingAll ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <RefreshCw size={13} className={syncingAll ? 'spin' : ''} />
                {syncingAll ? 'Đang đồng bộ...' : 'Đồng Bộ Tất Cả Kênh'}
              </button>
              <button
                type="button"
                onClick={() => setCreateChannelModalOpen(true)}
                style={{
                  padding: '8px 16px', background: '#ef4444', color: 'var(--surface)', border: 'none',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Plus size={14} /> Thêm Kênh YouTube
              </button>
            </>
          )}

          {activeTab === 'teams' && (
            <button
              type="button"
              onClick={() => setCreateTeamModalOpen(true)}
              style={{
                padding: '8px 16px', background: 'var(--accent)', color: 'var(--surface)', border: 'none',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Plus size={14} /> Thêm Đội Mới
            </button>
          )}
        </div>
      </div>

      <TabTransition key={activeTab} minHeight={450}>
        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1: YOUTUBE CHANNELS & LIVE SYNC MANAGEMENT (TIER 2 & 3)
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'channels' && (
          <div style={{ display: 'grid', gap: 16 }}>
            {/* ── TIER 2: TEAM SUMMARY BREAKDOWN CARDS ── */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Phân Bổ Kênh Theo Đội Nhóm
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Bấm vào thẻ đội để lọc danh sách kênh bên dưới
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {/* "All Teams" Card */}
                <div
                  onClick={() => setChannelTeamFilter('all')}
                  style={{
                    ...CARD,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    borderLeft: channelTeamFilter === 'all' ? '4px solid var(--text-primary)' : '4px solid var(--border-2)',
                    background: channelTeamFilter === 'all' ? 'var(--surface-soft)' : 'var(--surface)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Tất Cả Kênh</span>
                    <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--border)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {channels.length}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {fmtNum(overview?.kpis?.totalViews || 0)} views
                  </div>
                </div>

                {/* Team Cards */}
                {teams.map((t) => {
                  const teamChannels = channels.filter((c) => Number(c.teamId) === Number(t.id));
                  let tViews = 0;
                  teamChannels.forEach((c) => { tViews += Number(c.views || 0); });
                  const isSelected = String(channelTeamFilter) === String(t.id);

                  return (
                    <div
                      key={t.id}
                      onClick={() => setChannelTeamFilter(isSelected ? 'all' : String(t.id))}
                      style={{
                        ...CARD,
                        padding: '12px 14px',
                        cursor: 'pointer',
                        borderLeft: `4px solid ${t.color || '#3b82f6'}`,
                        background: isSelected ? 'var(--info-soft)' : 'var(--surface)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.name}
                        </span>
                        <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(15,23,42,0.06)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          {teamChannels.length}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                        {fmtNum(tViews)} views · {t.department}
                      </div>
                    </div>
                  );
                })}

                {/* Unassigned Pool Card */}
                <div
                  onClick={() => setChannelTeamFilter(channelTeamFilter === 'unassigned' ? 'all' : 'unassigned')}
                  style={{
                    ...CARD,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    borderLeft: '4px solid #f59e0b',
                    background: channelTeamFilter === 'unassigned' ? 'rgba(245,158,11,0.08)' : 'var(--surface)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#d97706' }}>Chưa Gán Đội</span>
                    <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(245,158,11,0.15)', color: 'var(--accent)', fontWeight: 600 }}>
                      {unassignedSummary.count}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {fmtNum(unassignedSummary.views)} views (Tính vào Cty)
                  </div>
                </div>
              </div>
            </div>

            {/* ── TIER 3: CHANNELS SEARCH, FILTER & TABLE ── */}
            <div style={{ ...CARD, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 260px' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  placeholder="Tìm theo tên kênh, Channel ID hoặc Custom URL..."
                  style={{ width: '100%', padding: '7px 12px 7px 32px', fontSize: 12, border: '1px solid rgba(15,23,42,0.1)', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Team Filter Dropdown */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Đội:</span>
                  <select
                    value={channelTeamFilter}
                    onChange={(e) => setChannelTeamFilter(e.target.value)}
                    style={{ padding: '5px 8px', fontSize: 11, border: '1px solid rgba(15,23,42,0.12)', background: 'var(--surface)' }}
                  >
                    <option value="all">Tất cả đội ({channels.length})</option>
                    {teams.map((t) => {
                      const count = channels.filter((c) => Number(c.teamId) === Number(t.id)).length;
                      return <option key={t.id} value={String(t.id)}>{t.name} ({count})</option>;
                    })}
                    <option value="unassigned">Chưa gán đội ({unassignedSummary.count})</option>
                  </select>
                </div>

                {/* Status Filter Buttons */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {[
                    ['all', 'Tất cả trạng thái'],
                    ['synced', 'Đã sync'],
                    ['stale', 'Cần sync'],
                    ['error', 'Lỗi sync'],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setChannelStatusFilter(val)}
                      style={{
                        padding: '5px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: channelStatusFilter === val ? '1px solid var(--text-primary)' : '1px solid rgba(15,23,42,0.1)',
                        background: channelStatusFilter === val ? 'var(--text-primary)' : 'var(--surface)',
                        color: channelStatusFilter === val ? 'var(--surface)' : 'var(--text-secondary)',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Channels Table */}
            <div style={{ ...CARD, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-soft)', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.04em' }}>Kênh YouTube</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.04em' }}>Đội Phụ Trách</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: 10, textAlign: 'right', letterSpacing: '0.04em' }}>Lượt Xem (Views)</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: 10, textAlign: 'right', letterSpacing: '0.04em' }}>Đăng Ký (Subs)</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.04em' }}>Trạng Thái Sync</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: 10, textAlign: 'right', letterSpacing: '0.04em' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChannels.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                        Chưa có kênh YouTube nào khớp với điều kiện lọc hiện tại.
                      </td>
                    </tr>
                  ) : (
                    filteredChannels.map((ch) => {
                      const isSyncing = syncingChannelId === ch.id;
                      const hasError = ch.syncStatus === 'ERROR';
                      const assignedTeam = teams.find((t) => Number(t.id) === Number(ch.teamId));
                      const isNeverSynced = !ch.lastSyncedAt;
                      const isStale = ch.lastSyncedAt && (Date.now() - new Date(ch.lastSyncedAt).getTime() > 2 * 3600000);

                      return (
                        <tr key={ch.id} style={{ borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                          {/* 1. Channel Info */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14, overflow: 'hidden', flexShrink: 0 }}>
                                {ch.thumbnailUrl ? (
                                  <img src={ch.thumbnailUrl} alt={ch.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <Tv size={18} />
                                )}
                              </div>
                              <div>
                                <div
                                  onClick={() => setSelectedChannelDetail(ch)}
                                  style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                                  title="Xem chi tiết kênh"
                                >
                                  <span>{ch.title || ch.channelId}</span>
                                  {ch.customUrl && (
                                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500 }}>
                                      ({ch.customUrl})
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>ID: {ch.channelId}</span>
                                  {ch.customUrl && (
                                    <a
                                      href={`https://youtube.com/${ch.customUrl.startsWith('@') ? ch.customUrl : `@${ch.customUrl}`}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 2, textDecoration: 'none' }}
                                    >
                                      YouTube <ExternalLink size={9} />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. Team Mapping */}
                          <td style={{ padding: '12px 14px' }}>
                            <select
                              value={ch.teamId || ''}
                              onChange={(e) => handleLinkChannel(ch.id, e.target.value)}
                              disabled={linkingChannelId === ch.id}
                              style={{
                                padding: '5px 8px', fontSize: 11, fontWeight: 600,
                                border: '1px solid rgba(15,23,42,0.12)', background: assignedTeam ? 'rgba(180,83,9,0.06)' : '#fffbeb',
                                color: assignedTeam ? 'var(--accent)' : '#d97706',
                                opacity: linkingChannelId === ch.id ? 0.6 : 1,
                                cursor: linkingChannelId === ch.id ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <option value="">-- Chưa gán đội (Độc lập) --</option>
                              {teams.map((t) => (
                                <option key={t.id} value={t.id}>{t.name} ({t.department})</option>
                              ))}
                            </select>
                          </td>

                          {/* 3. Views */}
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)', fontSize: 13 }}>
                            {fmtNum(ch.views || 0)}
                          </td>

                          {/* 4. Subs */}
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#16a34a', fontSize: 13 }}>
                            {fmtNum(ch.subscribers || 0)}
                          </td>

                          {/* 5. Sync Status */}
                          <td style={{ padding: '12px 14px' }}>
                            {hasError ? (
                              <span
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: '#fee2e2', color: '#dc2626', fontSize: 10, fontWeight: 600, cursor: 'help' }}
                                title={ch.lastSyncError || 'Lỗi đồng bộ từ YouTube API'}
                              >
                                <XCircle size={12} /> Lỗi Sync
                              </span>
                            ) : isNeverSynced ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'var(--surface-muted)', color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600 }}>
                                <Clock size={12} /> Chưa Sync
                              </span>
                            ) : isStale ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: '#fffbeb', color: '#d97706', fontSize: 10, fontWeight: 600 }}>
                                <AlertTriangle size={12} /> Cần Sync lại
                              </span>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: '#dcfce7', color: '#16a34a', fontSize: 10, fontWeight: 600 }}>
                                <CheckCircle2 size={12} /> Hoạt Động
                              </span>
                            )}
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                              {ch.lastSyncedAt ? formatRelativeTime(ch.lastSyncedAt) : 'Chưa sync'}
                            </div>
                          </td>

                          {/* 6. Actions */}
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => handleSyncChannel(ch.id, ch.title || ch.channelId)}
                                disabled={isSyncing}
                                style={{
                                  padding: '5px 8px', background: 'var(--surface)', border: '1px solid rgba(15,23,42,0.12)',
                                  fontSize: 11, fontWeight: 700, color: 'var(--accent)', cursor: isSyncing ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                }}
                                title="Đồng bộ lại từ YouTube API"
                              >
                                <RefreshCw size={11} className={isSyncing ? 'spin' : ''} />
                                {isSyncing ? 'Sync...' : 'Sync'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedChannelDetail(ch)}
                                style={{
                                  padding: '5px 8px', background: 'var(--surface-soft)', border: '1px solid rgba(15,23,42,0.12)',
                                  fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer',
                                }}
                                title="Xem chi tiết kênh"
                              >
                                Chi tiết
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteChannel(ch)}
                                disabled={deletingChannelId === ch.id}
                                style={{
                                  padding: '5px 8px', background: '#fee2e2', border: 'none',
                                  fontSize: 11, fontWeight: 700, color: '#dc2626',
                                  cursor: deletingChannelId === ch.id ? 'not-allowed' : 'pointer',
                                  opacity: deletingChannelId === ch.id ? 0.5 : 1,
                                }}
                                title="Xóa kênh"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2: TEAMS & DEPARTMENTS MANAGEMENT
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'teams' && (
          <div style={{ display: 'grid', gap: 14 }}>
            {/* Search & Dept Filter */}
            <div style={{ ...CARD, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 260px' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  placeholder="Tìm kiếm đội theo tên hoặc mô tả..."
                  style={{ width: '100%', padding: '7px 12px 7px 32px', fontSize: 12, border: '1px solid rgba(15,23,42,0.1)', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Phòng ban:</span>
                <select
                  value={teamDeptFilter}
                  onChange={(e) => setTeamDeptFilter(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: 12, border: '1px solid rgba(15,23,42,0.12)', background: 'var(--surface)' }}
                >
                  <option value="all">Tất cả phòng ban</option>
                  {DEPARTMENT_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            {/* Teams Grid */}
            {filteredTeams.length === 0 ? (
              <Card style={{ padding: 40, textAlign: 'center' }}>
                <EmptyState title="Không tìm thấy đội nhóm nào" description="Hãy tạo đội nhóm đầu tiên hoặc xóa bộ lọc tìm kiếm." />
              </Card>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
                {filteredTeams.map((team) => {
                  const teamChannels = channels.filter((c) => Number(c.teamId) === Number(team.id));
                  const membersCount = allUsers.filter((u) => Number(u.teamId) === Number(team.id)).length;
                  let tViews = 0;
                  let tSubs = 0;
                  teamChannels.forEach((c) => {
                    tViews += Number(c.views || 0);
                    tSubs += Number(c.subscribers || 0);
                  });

                  return (
                    <div
                      key={team.id}
                      style={{
                        ...CARD,
                        padding: 18,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        borderLeft: `5px solid ${team.color || '#3b82f6'}`,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {team.department || 'Media & Content'}
                            </span>
                            <h3 style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                              {team.name}
                            </h3>
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => openEditTeam(team)}
                              style={{ width: 28, height: 28, background: 'rgba(15,23,42,0.04)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}
                              title="Chỉnh sửa đội"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTeam(team)}
                              disabled={deletingTeamId === team.id}
                              style={{
                                width: 28,
                                height: 28,
                                background: 'rgba(239,68,68,0.06)',
                                border: 'none',
                                cursor: deletingTeamId === team.id ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ef4444',
                                opacity: deletingTeamId === team.id ? 0.5 : 1,
                              }}
                              title="Xóa đội"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                          {team.description || 'Chưa có mô tả chi tiết nhiệm vụ của đội nhóm.'}
                        </p>

                        {team.ownerId && (() => {
                          const leader = allUsers.find((u) => Number(u.id) === Number(team.ownerId));
                          return leader ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: '#fffbeb', border: '1px solid rgba(217,119,6,0.25)', fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 10 }}>
                              <Crown size={12} /> Trưởng nhóm: {leader.name} {leader.jobTitle ? `(${leader.jobTitle})` : ''}
                            </div>
                          ) : null;
                        })()}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 12px', background: 'var(--surface-soft)', border: '1px solid rgba(15,23,42,0.06)', marginBottom: 14 }}>
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nhân sự</span>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <Users size={14} color="var(--accent)" /> {membersCount} thành viên
                            </div>
                          </div>
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Kênh YouTube</span>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <Tv size={14} color="#ef4444" /> {teamChannels.length} kênh ({fmtNum(tViews)} views)
                            </div>
                          </div>
                        </div>

                        {teamChannels.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                              Kênh xuất bản trực thuộc:
                            </span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {teamChannels.map((tc) => (
                                <span
                                  key={tc.id}
                                  onClick={() => setSelectedChannelDetail(tc)}
                                  style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                                >
                                  <Tv size={11} /> {tc.title || tc.channelId}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div style={{ borderTop: '1px solid rgba(15,23,42,0.06)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openMembersDrawer(team)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Users size={13} /> Quản lý thành viên ({membersCount}) <ChevronRight size={13} />
                        </button>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: #{team.id}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </TabTransition>

      {/* ══════════════════════════════════════════════════════════════════════
          DRAWER / MODAL: CHI TIẾT KÊNH YOUTUBE
         ══════════════════════════════════════════════════════════════════════ */}
      {selectedChannelDetail && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-backdrop-enter"
          style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedChannelDetail(null);
          }}
        >
          <div
            className="modal-dialog-enter"
            style={{ background: 'var(--surface)', width: '100%', maxWidth: 540, border: '1px solid rgba(15,23,42,0.15)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(15,23,42,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Tv size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedChannelDetail.title || selectedChannelDetail.channelId}
                  </h3>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ID: {selectedChannelDetail.channelId}</span>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedChannelDetail(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 20, overflowY: 'auto', display: 'grid', gap: 16 }}>
              {/* Snapshot Tiles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                <div style={{ ...CARD, padding: 12, textAlign: 'center', background: 'var(--surface-soft)' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Views</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                    {fmtNum(selectedChannelDetail.views || 0)}
                  </div>
                </div>
                <div style={{ ...CARD, padding: 12, textAlign: 'center', background: 'var(--surface-soft)' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Subscribers</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a', marginTop: 4 }}>
                    {fmtNum(selectedChannelDetail.subscribers || 0)}
                  </div>
                </div>
              </div>

              {/* Team Assignment Field */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Đội Nhóm Phụ Trách
                </label>
                <select
                  value={selectedChannelDetail.teamId || ''}
                  onChange={(e) => handleLinkChannel(selectedChannelDetail.id, e.target.value)}
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)', background: 'var(--surface)' }}
                >
                  <option value="">-- Chưa gán đội (Kênh tự do) --</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.department})</option>
                  ))}
                </select>
              </div>

              {/* Sync Status Info */}
              <div style={{ padding: 12, background: selectedChannelDetail.syncStatus === 'ERROR' ? '#fee2e2' : 'var(--surface-soft)', border: '1px solid rgba(15,23,42,0.06)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: selectedChannelDetail.syncStatus === 'ERROR' ? '#dc2626' : 'var(--text-secondary)' }}>
                  Trạng Thái Đồng Bộ: {selectedChannelDetail.syncStatus || 'IDLE'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Lần sync gần nhất: {selectedChannelDetail.lastSyncedAt ? new Date(selectedChannelDetail.lastSyncedAt).toLocaleString('vi-VN') : 'Chưa có'}
                </div>
                {selectedChannelDetail.lastSyncError && (
                  <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4, fontWeight: 600 }}>
                    Lỗi: {selectedChannelDetail.lastSyncError}
                  </div>
                )}
              </div>

              {/* Links */}
              <div style={{ display: 'flex', gap: 8 }}>
                {selectedChannelDetail.customUrl && (
                  <a
                    href={`https://youtube.com/${selectedChannelDetail.customUrl.startsWith('@') ? selectedChannelDetail.customUrl : `@${selectedChannelDetail.customUrl}`}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '8px 14px', background: '#fee2e2', color: '#ef4444', textDecoration: 'none',
                      fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    Mở YouTube <ExternalLink size={13} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleSyncChannel(selectedChannelDetail.id, selectedChannelDetail.title || selectedChannelDetail.channelId)}
                  disabled={syncingChannelId === selectedChannelDetail.id}
                  style={{
                    padding: '8px 14px', background: 'var(--accent)', color: 'var(--surface)', border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: syncingChannelId === selectedChannelDetail.id ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <RefreshCw size={13} className={syncingChannelId === selectedChannelDetail.id ? 'spin' : ''} />
                  {syncingChannelId === selectedChannelDetail.id ? 'Đang sync...' : 'Đồng bộ ngay'}
                </button>
              </div>
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(15,23,42,0.08)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSelectedChannelDetail(null)}
                style={{ padding: '8px 16px', background: 'var(--text-primary)', color: 'var(--surface)', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: TẠO ĐỘI NHÓM MỚI
         ══════════════════════════════════════════════════════════════════════ */}
      {createTeamModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-backdrop-enter"
          style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingTeam) setCreateTeamModalOpen(false);
          }}
        >
          <div
            className="modal-dialog-enter"
            style={{ background: 'var(--surface)', width: '100%', maxWidth: 440, padding: 24, border: '1px solid rgba(15,23,42,0.15)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(15,23,42,0.08)', paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={18} color="var(--accent)" /> Thêm Đội Nhóm Mới
              </h3>
              <button type="button" onClick={() => setCreateTeamModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Tên Đội Nhóm *</label>
                <input
                  type="text"
                  required
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                  placeholder="Ví dụ: Phoenix Team, Media Team 1..."
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Phòng Ban Trực Thuộc</label>
                <select
                  value={teamForm.department}
                  onChange={(e) => setTeamForm({ ...teamForm, department: e.target.value })}
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)', background: 'var(--surface)' }}
                >
                  {DEPARTMENT_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Màu Đại Diện Đội</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {TEAM_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTeamForm({ ...teamForm, color: c })}
                      style={{
                        width: 26, height: 26, background: c, border: teamForm.color === c ? '2px solid var(--text-primary)' : 'none',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {teamForm.color === c && <Check size={14} color="var(--surface)" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Chỉ Định Trưởng Nhóm (Tùy chọn)
                </label>
                <select
                  value={teamForm.ownerId}
                  onChange={(e) => setTeamForm({ ...teamForm, ownerId: e.target.value })}
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)', background: 'var(--surface)' }}
                >
                  <option value="">-- Chưa chỉ định (Có thể bổ nhiệm sau) --</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      #{u.id} - {u.name} ({u.jobTitle || 'Nhân viên'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Mô Tả Nhiệm Vụ</label>
                <textarea
                  rows={2}
                  value={teamForm.description}
                  onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                  placeholder="Mô tả mục tiêu sản xuất hoặc định hướng của team..."
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => setCreateTeamModalOpen(false)} style={{ padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Hủy
                </button>
                <button type="submit" disabled={savingTeam} style={{ padding: '8px 18px', background: 'var(--accent)', color: 'var(--surface)', border: 'none', fontSize: 12, fontWeight: 600, cursor: savingTeam ? 'not-allowed' : 'pointer' }}>
                  {savingTeam ? 'Đang tạo...' : 'Tạo Đội Nhóm'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: CHỈNH SỬA ĐỘI NHÓM
         ══════════════════════════════════════════════════════════════════════ */}
      {editTeamModalOpen && selectedTeam && createPortal(
        <div
          className="modal-backdrop-enter"
          onClick={(e) => { if (e.target === e.currentTarget) setEditTeamModalOpen(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}
        >
          <div
            className="modal-dialog-enter"
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--surface)', width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', padding: 24, border: '1px solid rgba(15,23,42,0.15)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(15,23,42,0.08)', paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={18} color="var(--accent)" /> Cập Nhật Đội: {selectedTeam.name}
              </h3>
              <button type="button" onClick={() => setEditTeamModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateTeam} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Tên Đội Nhóm *</label>
                <input
                  type="text"
                  required
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Phòng Ban Trực Thuộc</label>
                <select
                  value={teamForm.department}
                  onChange={(e) => setTeamForm({ ...teamForm, department: e.target.value })}
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)', background: 'var(--surface)' }}
                >
                  {DEPARTMENT_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Màu Đại Diện</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {TEAM_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTeamForm({ ...teamForm, color: c })}
                      style={{
                        width: 26, height: 26, background: c, border: teamForm.color === c ? '2px solid var(--text-primary)' : 'none',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {teamForm.color === c && <Check size={14} color="var(--surface)" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Trưởng Nhóm Đội (Bổ nhiệm / Chuyển giao)
                </label>
                <select
                  value={teamForm.ownerId}
                  onChange={(e) => setTeamForm({ ...teamForm, ownerId: e.target.value })}
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)', background: 'var(--surface)' }}
                >
                  <option value="">-- Chưa chỉ định Trưởng nhóm --</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      #{u.id} - {u.name} ({u.jobTitle || 'Nhân viên'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Mô Tả</label>
                <textarea
                  rows={2}
                  value={teamForm.description}
                  onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => setEditTeamModalOpen(false)} style={{ padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Hủy
                </button>
                <button type="submit" disabled={savingTeam} style={{ padding: '8px 18px', background: 'var(--accent)', color: 'var(--surface)', border: 'none', fontSize: 12, fontWeight: 600, cursor: savingTeam ? 'not-allowed' : 'pointer' }}>
                  {savingTeam ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DRAWER / MODAL: QUẢN LÝ THÀNH VIÊN TRONG ĐỘI
         ══════════════════════════════════════════════════════════════════════ */}
      {membersDrawerTeam && createPortal(
        <div
          className="modal-backdrop-enter"
          onClick={(e) => { if (e.target === e.currentTarget) setMembersDrawerTeam(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}
        >
          <div
            className="modal-dialog-enter"
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--surface)', width: '100%', maxWidth: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column', border: '1px solid rgba(15,23,42,0.15)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(15,23,42,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={18} color="var(--accent)" /> Thành Viên Đội: {membersDrawerTeam.name}
                </h3>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Phòng ban: {membersDrawerTeam.department} · {teamMembersList.length} nhân sự</span>
              </div>
              <button type="button" onClick={() => setMembersDrawerTeam(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>

            {/* Add Member Form */}
            <form onSubmit={handleAddMemberToTeam} style={{ padding: '12px 20px', background: 'var(--surface-soft)', borderBottom: '1px solid rgba(15,23,42,0.06)', display: 'flex', gap: 8 }}>
              <select
                value={selectedUserIdToAdd}
                onChange={(e) => setSelectedUserIdToAdd(e.target.value)}
                style={{ flex: 1, padding: '7px', fontSize: 12, border: '1px solid var(--border-2)', background: 'var(--surface)' }}
              >
                <option value="">-- Chọn nhân viên để thêm vào đội --</option>
                {nonTeamUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    #{u.id} - {u.name} ({u.jobTitle || 'Nhân viên'}) {u.teamId ? `[Đang ở đội #${u.teamId}]` : '[Chưa có đội]'}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={addingMember || !selectedUserIdToAdd}
                style={{
                  padding: '7px 14px', background: 'var(--accent)', color: 'var(--surface)', border: 'none',
                  fontSize: 12, fontWeight: 600, cursor: addingMember || !selectedUserIdToAdd ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                }}
              >
                <Plus size={13} /> Thêm
              </button>
            </form>

            {/* Members List */}
            <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {teamMembersList.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  Đội này hiện chưa có nhân viên nào. Hãy chọn nhân viên ở trên để thêm vào đội.
                </div>
              ) : (
                teamMembersList.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: '10px 14px',
                      background: 'var(--surface)',
                      border: '1px solid rgba(15,23,42,0.08)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {m.name} <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>(#{m.id})</span>
                        {m.isVerified && <VerifiedBadge size={13} />}
                        {Number(membersDrawerTeam.ownerId) === Number(m.id) && (
                          <span style={{ fontSize: 10, background: '#fef3c7', color: 'var(--accent)', border: '1px solid rgba(217,119,6,0.3)', padding: '1px 6px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            👑 Trưởng nhóm
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Chức danh: <strong>{m.jobTitle || 'Nhân viên'}</strong> · Email: {m.email}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {Number(membersDrawerTeam.ownerId) !== Number(m.id) && (
                        <button
                          type="button"
                          onClick={() => handleSetTeamLeader(membersDrawerTeam.id, m.id, m.name)}
                          style={{
                            padding: '4px 8px', background: '#fffbeb', color: 'var(--accent)', border: '1px solid rgba(217,119,6,0.3)',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          }}
                          title="Bổ nhiệm làm trưởng nhóm"
                        >
                          👑 Trưởng nhóm
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/privileges?userId=${m.id}`)}
                        style={{
                          padding: '4px 8px', background: 'var(--surface-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border-2)',
                          fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}
                        title="Quản lý hồ sơ, chức danh & vinh danh nhân sự"
                      >
                        <ExternalLink size={12} /> Hồ sơ nhân sự
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveMemberFromTeam(m.id, m.name)}
                        disabled={removingMemberId === m.id}
                        style={{
                          padding: '4px 8px', background: '#fee2e2', color: '#dc2626', border: 'none',
                          fontSize: 11, fontWeight: 600, cursor: removingMemberId === m.id ? 'not-allowed' : 'pointer',
                          opacity: removingMemberId === m.id ? 0.5 : 1,
                        }}
                        title="Gỡ khỏi đội"
                      >
                        {removingMemberId === m.id ? 'Đang gỡ...' : 'Gỡ'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(15,23,42,0.08)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setMembersDrawerTeam(null)}
                style={{ padding: '8px 16px', background: 'var(--text-primary)', color: 'var(--surface)', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: THÊM KÊNH YOUTUBE MỚI
         ══════════════════════════════════════════════════════════════════════ */}
      {createChannelModalOpen && createPortal(
        <div
          className="modal-backdrop-enter"
          onClick={(e) => { if (e.target === e.currentTarget) setCreateChannelModalOpen(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}
        >
          <div
            className="modal-dialog-enter"
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--surface)', width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', padding: 24, border: '1px solid rgba(15,23,42,0.15)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(15,23,42,0.08)', paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tv size={18} color="#ef4444" /> Thêm Kênh YouTube Mới
              </h3>
              <button type="button" onClick={() => setCreateChannelModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateChannel} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Mã Kênh YouTube (Channel ID hoặc Handle) *
                </label>
                <input
                  type="text"
                  required
                  value={newChannelForm.channelId}
                  onChange={(e) => setNewChannelForm({ ...newChannelForm, channelId: e.target.value })}
                  placeholder="Ví dụ: UCxxxxxxxxxxxx hoặc @ten_kenh"
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Tên Kênh YouTube (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={newChannelForm.title}
                  onChange={(e) => setNewChannelForm({ ...newChannelForm, title: e.target.value })}
                  placeholder="Ví dụ: TechReview Official, Production Channel..."
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Custom URL / Handle (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={newChannelForm.customUrl}
                  onChange={(e) => setNewChannelForm({ ...newChannelForm, customUrl: e.target.value })}
                  placeholder="Ví dụ: @TechReviewOfficial"
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Gán Cho Đội Nhóm Phụ Trách
                </label>
                <select
                  value={newChannelForm.teamId}
                  onChange={(e) => setNewChannelForm({ ...newChannelForm, teamId: e.target.value })}
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)', background: 'var(--surface)' }}
                >
                  <option value="">-- Chưa gán đội (Gán sau) --</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.department})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => setCreateChannelModalOpen(false)} style={{ padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Hủy
                </button>
                <button type="submit" disabled={savingChannel} style={{ padding: '8px 18px', background: '#ef4444', color: 'var(--surface)', border: 'none', fontSize: 12, fontWeight: 600, cursor: savingChannel ? 'not-allowed' : 'pointer' }}>
                  {savingChannel ? 'Đang thêm...' : 'Thêm Kênh'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
