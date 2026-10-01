import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Award,
  Filter,
  Check,
  X,
  Sparkles,
  Layers,
  ChevronRight,
  Shield,
  HelpCircle,
  ThumbsUp,
  MessageSquare,
} from 'lucide-react';
import { youtube, groups as groupsApi, users as usersApi } from '../services/api';
import { useToast, useConfirm } from '../context/UiContext';
import { parseApiError } from '../utils/errors';
import { Card, EmptyState, PageState, Button, SegmentedControl, TabTransition, CardSkeleton, TableSkeleton } from '../components/ui';

const CARD = {
  background: '#ffffff',
  border: '1px solid rgba(15,23,42,0.08)',
  borderRadius: 0,
  boxShadow: 'none',
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
  '#64748b',
];

function fmtNum(n) {
  n = Number(n) || 0;
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString('vi-VN');
}

export default function AdminTeamsYouTube() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState('teams'); // 'teams' | 'channels' | 'insights'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Teams State
  const [teams, setTeams] = useState([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [teamDeptFilter, setTeamDeptFilter] = useState('all');
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState(false);
  const [editTeamModalOpen, setEditTeamModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamForm, setTeamForm] = useState({ name: '', description: '', department: 'Media & Content', color: '#3b82f6' });
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
  const [channelStatusFilter, setChannelStatusFilter] = useState('all');
  const [createChannelModalOpen, setCreateChannelModalOpen] = useState(false);
  const [newChannelForm, setNewChannelForm] = useState({ channelId: '', title: '', customUrl: '', teamId: '' });
  const [savingChannel, setSavingChannel] = useState(false);
  const [syncingChannelId, setSyncingChannelId] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [linkingChannelId, setLinkingChannelId] = useState(null);
  const [deletingChannelId, setDeletingChannelId] = useState(null);

  // Insights State
  const [topVideos, setTopVideos] = useState([]);
  const [videoTimeframe, setVideoTimeframe] = useState('30d');
  const [loadingVideos, setLoadingVideos] = useState(false);

  // Load All Data
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [groupsRes, channelsRes, overviewRes, usersRes] = await Promise.all([
        groupsApi.list().catch(() => ({ data: [] })),
        youtube.adminGetChannels().catch(() => ({ channels: [] })),
        youtube.adminGetOverview().catch(() => null),
        usersApi.list({ limit: 300 }).catch(() => ({ data: [] })),
      ]);

      setTeams(groupsRes.data || []);
      setChannels(channelsRes.channels || []);
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

  // Load Top Videos for Insights Tab
  const loadTopVideos = useCallback(async () => {
    setLoadingVideos(true);
    try {
      const res = await youtube.getTopVideos({ timeframe: videoTimeframe, limit: 30 });
      setTopVideos(res.videos || []);
    } catch (err) {
      console.error('Failed to load top videos:', err);
    } finally {
      setLoadingVideos(false);
    }
  }, [videoTimeframe]);

  useEffect(() => {
    if (activeTab === 'insights') {
      loadTopVideos();
    }
  }, [activeTab, loadTopVideos]);

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
      });
      toast.success(`Đã tạo đội "${teamForm.name}" thành công!`);
      setCreateTeamModalOpen(false);
      setTeamForm({ name: '', description: '', department: 'Media & Content', color: '#3b82f6' });
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
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể cập nhật liên kết kênh.'));
    } finally {
      setLinkingChannelId(null);
    }
  };

  const handleSyncChannel = async (channelId, title) => {
    setSyncingChannelId(channelId);
    try {
      await youtube.adminSyncChannel(channelId);
      toast.success(`Đã đồng bộ dữ liệu mới nhất cho kênh "${title}"!`);
      await loadData(true);
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
      if (channelStatusFilter === 'linked' && !c.teamId) return false;
      if (channelStatusFilter === 'unlinked' && c.teamId) return false;
      if (channelStatusFilter === 'error' && c.syncStatus !== 'ERROR') return false;
      return true;
    });
  }, [channels, channelSearch, channelStatusFilter]);

  const teamMembersList = useMemo(() => {
    if (!membersDrawerTeam) return [];
    return allUsers.filter((u) => Number(u.teamId) === Number(membersDrawerTeam.id));
  }, [allUsers, membersDrawerTeam]);

  const nonTeamUsers = useMemo(() => {
    if (!membersDrawerTeam) return [];
    return allUsers.filter((u) => Number(u.teamId) !== Number(membersDrawerTeam.id));
  }, [allUsers, membersDrawerTeam]);

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gap: 16 }}>
        <CardSkeleton />
        <TableSkeleton rows={8} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gap: 16, fontFamily: "'JetBrains Mono', monospace" }}>
      {/* ── HEADER / CONTROL CENTER HERO ── */}
      <section style={{ ...CARD, padding: 22, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', background: 'rgba(180,83,9,0.08)', color: '#b45309', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>
            <Building2 size={14} />
            Quản trị tổ chức & Kênh xuất bản
          </div>
          <h1 style={{ margin: '12px 0 6px', fontSize: 24, lineHeight: 1.15, color: '#0f172a', fontWeight: 900 }}>
            Quản Lý Đội Nhóm & Kênh YouTube
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            Phân bổ phòng ban, cơ cấu đội ngũ sản xuất video và kết nối dữ liệu lượt xem YouTube theo thời gian thực.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ ...CARD, padding: '10px 14px', minWidth: 120 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase' }}>Đội Nhóm (Teams)</div>
            <strong style={{ display: 'block', marginTop: 3, fontSize: 22, color: '#b45309', fontWeight: 900 }}>{teams.length}</strong>
          </div>
          <div style={{ ...CARD, padding: '10px 14px', minWidth: 120 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase' }}>Kênh YouTube</div>
            <strong style={{ display: 'block', marginTop: 3, fontSize: 22, color: '#ef4444', fontWeight: 900 }}>{channels.length}</strong>
          </div>
          <div style={{ ...CARD, padding: '10px 14px', minWidth: 130 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase' }}>Tổng Lượt Xem</div>
            <strong style={{ display: 'block', marginTop: 3, fontSize: 22, color: '#16a34a', fontWeight: 900 }}>
              {fmtNum(overview?.kpis?.totalViews || 0)}
            </strong>
          </div>
        </div>
      </section>

      {/* ── TABS NAVIGATION & ACTIONS ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <SegmentedControl
          ariaLabel="Admin Teams & YouTube Tabs"
          options={[
            { key: 'teams', label: `Đội Nhóm & Phòng Ban (${teams.length})` },
            { key: 'channels', label: `Kênh YouTube & Đồng Bộ (${channels.length})` },
            { key: 'insights', label: 'Top Video & Hiệu Suất' },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {activeTab === 'teams' && (
            <button
              type="button"
              onClick={() => setCreateTeamModalOpen(true)}
              style={{
                padding: '8px 16px', background: '#b45309', color: '#ffffff', border: 'none',
                fontSize: 12, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Plus size={14} /> Thêm Đội Mới
            </button>
          )}

          {activeTab === 'channels' && (
            <>
              <button
                type="button"
                onClick={handleSyncAllChannels}
                disabled={syncingAll}
                style={{
                  padding: '8px 14px', background: '#ffffff', color: '#0f172a', border: '1px solid rgba(15,23,42,0.15)',
                  fontSize: 12, fontWeight: 800, cursor: syncingAll ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <RefreshCw size={13} className={syncingAll ? 'spin' : ''} />
                {syncingAll ? 'Đang đồng bộ...' : 'Đồng Bộ Tất Cả Kênh'}
              </button>
              <button
                type="button"
                onClick={() => setCreateChannelModalOpen(true)}
                style={{
                  padding: '8px 16px', background: '#ef4444', color: '#ffffff', border: 'none',
                  fontSize: 12, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Plus size={14} /> Thêm Kênh YouTube
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            style={{
              padding: '8px 12px', background: '#ffffff', color: '#64748b', border: '1px solid rgba(15,23,42,0.15)',
              fontSize: 12, fontWeight: 800, cursor: refreshing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
          </button>
        </div>
      </div>

      <TabTransition key={activeTab} minHeight={450}>
        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1: TEAMS & DEPARTMENTS MANAGEMENT
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'teams' && (
          <div style={{ display: 'grid', gap: 14 }}>
            {/* Search & Dept Filter */}
            <div style={{ ...CARD, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 260px' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  placeholder="Tìm kiếm đội theo tên hoặc mô tả..."
                  style={{ width: '100%', padding: '7px 12px 7px 32px', fontSize: 12, border: '1px solid rgba(15,23,42,0.1)', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b' }}>Phòng ban:</span>
                <select
                  value={teamDeptFilter}
                  onChange={(e) => setTeamDeptFilter(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: 12, border: '1px solid rgba(15,23,42,0.12)', background: '#fff' }}
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
                            <span style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              {team.department || 'Media & Content'}
                            </span>
                            <h3 style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 900, color: '#0f172a' }}>
                              {team.name}
                            </h3>
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => openEditTeam(team)}
                              style={{ width: 28, height: 28, background: 'rgba(15,23,42,0.04)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309' }}
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

                        <p style={{ margin: '0 0 14px', fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>
                          {team.description || 'Chưa có mô tả chi tiết nhiệm vụ của đội nhóm.'}
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 12px', background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)', marginBottom: 14 }}>
                          <div>
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Nhân sự</span>
                            <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <Users size={14} color="#b45309" /> {membersCount} thành viên
                            </div>
                          </div>
                          <div>
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Kênh YouTube</span>
                            <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <Tv size={14} color="#ef4444" /> {teamChannels.length} kênh
                            </div>
                          </div>
                        </div>

                        {teamChannels.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                              Kênh xuất bản trực thuộc:
                            </span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {teamChannels.map((tc) => (
                                <span key={tc.id} style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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
                          style={{ background: 'transparent', border: 'none', color: '#b45309', fontSize: 12, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Users size={13} /> Quản lý thành viên ({membersCount}) <ChevronRight size={13} />
                        </button>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>ID: #{team.id}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2: YOUTUBE CHANNELS & LIVE SYNC MANAGEMENT
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'channels' && (
          <div style={{ display: 'grid', gap: 14 }}>
            {/* Search & Filter Bar */}
            <div style={{ ...CARD, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 260px' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  placeholder="Tìm theo tên kênh, Channel ID hoặc Custom URL..."
                  style={{ width: '100%', padding: '7px 12px 7px 32px', fontSize: 12, border: '1px solid rgba(15,23,42,0.1)', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {[
                  ['all', 'Tất cả'],
                  ['linked', 'Đã gán đội'],
                  ['unlinked', 'Chưa gán đội'],
                  ['error', 'Lỗi đồng bộ'],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setChannelStatusFilter(val)}
                    style={{
                      padding: '5px 10px',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      border: channelStatusFilter === val ? '1px solid #0f172a' : '1px solid rgba(15,23,42,0.1)',
                      background: channelStatusFilter === val ? '#0f172a' : '#ffffff',
                      color: channelStatusFilter === val ? '#ffffff' : '#64748b',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Channels Table */}
            <div style={{ ...CARD, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', fontSize: 10 }}>Kênh YouTube</th>
                    <th style={{ padding: '10px 14px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', fontSize: 10 }}>Đội Phụ Trách</th>
                    <th style={{ padding: '10px 14px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', fontSize: 10, textAlign: 'right' }}>Lượt Xem (Views)</th>
                    <th style={{ padding: '10px 14px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', fontSize: 10, textAlign: 'right' }}>Đăng Ký (Subs)</th>
                    <th style={{ padding: '10px 14px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', fontSize: 10 }}>Trạng Thái Sync</th>
                    <th style={{ padding: '10px 14px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', fontSize: 10, textAlign: 'right' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChannels.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                        Chưa có kênh YouTube nào khớp với điều kiện tìm kiếm.
                      </td>
                    </tr>
                  ) : (
                    filteredChannels.map((ch) => {
                      const isSyncing = syncingChannelId === ch.id;
                      const hasError = ch.syncStatus === 'ERROR';
                      const assignedTeam = teams.find((t) => Number(t.id) === Number(ch.teamId));

                      return (
                        <tr key={ch.id} style={{ borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                          {/* 1. Channel Info */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 36, height: 36, background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14 }}>
                                <Tv size={18} />
                              </div>
                              <div>
                                <div style={{ fontWeight: 900, color: '#0f172a', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>{ch.title || ch.channelId}</span>
                                  {ch.customUrl && (
                                    <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>
                                      ({ch.customUrl})
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                                  ID: {ch.channelId}
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
                                padding: '5px 8px', fontSize: 11, fontWeight: 800,
                                border: '1px solid rgba(15,23,42,0.12)', background: assignedTeam ? 'rgba(180,83,9,0.06)' : '#fff',
                                color: assignedTeam ? '#b45309' : '#64748b',
                                opacity: linkingChannelId === ch.id ? 0.6 : 1,
                                cursor: linkingChannelId === ch.id ? 'not-allowed' : 'pointer',
                              }}
                            >
                              <option value="">-- Chưa gán đội --</option>
                              {teams.map((t) => (
                                <option key={t.id} value={t.id}>{t.name} ({t.department})</option>
                              ))}
                            </select>
                          </td>

                          {/* 3. Views */}
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 900, color: '#0f172a', fontSize: 13 }}>
                            {fmtNum(ch.views || 0)}
                          </td>

                          {/* 4. Subs */}
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 900, color: '#16a34a', fontSize: 13 }}>
                            {fmtNum(ch.subscribers || 0)}
                          </td>

                          {/* 5. Sync Status */}
                          <td style={{ padding: '12px 14px' }}>
                            {hasError ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: '#fee2e2', color: '#dc2626', fontSize: 10, fontWeight: 900 }} title={ch.lastSyncError || 'Lỗi đồng bộ'}>
                                <XCircle size={12} /> Lỗi Sync
                              </span>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: '#dcfce7', color: '#16a34a', fontSize: 10, fontWeight: 900 }}>
                                <CheckCircle2 size={12} /> Hoạt động
                              </span>
                            )}
                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                              {ch.lastSyncedAt ? new Date(ch.lastSyncedAt).toLocaleDateString('vi-VN') : 'Chưa sync'}
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
                                  padding: '5px 8px', background: '#ffffff', border: '1px solid rgba(15,23,42,0.12)',
                                  fontSize: 11, fontWeight: 800, color: '#b45309', cursor: isSyncing ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                }}
                                title="Đồng bộ lại từ YouTube API"
                              >
                                <RefreshCw size={11} className={isSyncing ? 'spin' : ''} />
                                {isSyncing ? 'Sync...' : 'Sync'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteChannel(ch)}
                                disabled={deletingChannelId === ch.id}
                                style={{
                                  padding: '5px 8px', background: '#fee2e2', border: 'none',
                                  fontSize: 11, fontWeight: 800, color: '#dc2626',
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
            TAB 3: TOP VIDEOS & PRODUCTION INSIGHTS
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'insights' && (
          <div style={{ display: 'grid', gap: 14 }}>
            {/* Filter Bar */}
            <div style={{ ...CARD, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Flame size={18} color="#ef4444" />
                <span style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>Top Video Xuất Sắc Toàn Công Ty</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  ['7d', '7 Ngày Gần Nhất'],
                  ['30d', '30 Ngày'],
                  ['all', 'Toàn Thời Gian'],
                ].map(([tf, label]) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setVideoTimeframe(tf)}
                    style={{
                      padding: '5px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer',
                      border: videoTimeframe === tf ? '1px solid #ef4444' : '1px solid rgba(15,23,42,0.1)',
                      background: videoTimeframe === tf ? '#ef4444' : '#ffffff',
                      color: videoTimeframe === tf ? '#ffffff' : '#64748b',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Videos Grid */}
            {loadingVideos ? (
              <TableSkeleton rows={6} />
            ) : topVideos.length === 0 ? (
              <Card style={{ padding: 40, textAlign: 'center' }}>
                <EmptyState title="Chưa có dữ liệu video" description="Hãy đồng bộ các kênh YouTube để kéo danh sách video xuất sắc về hệ thống." />
              </Card>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
                {topVideos.map((vid, idx) => (
                  <div key={vid.id || idx} style={{ ...CARD, padding: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 32, height: 32, flexShrink: 0, background: idx < 3 ? '#ef4444' : '#f1f5f9',
                      color: idx < 3 ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900, fontSize: 13,
                    }}>
                      #{idx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 900, color: '#0f172a', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {vid.title}
                      </h4>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
                        Kênh: <strong>{vid.channelTitle || 'YouTube'}</strong> {vid.teamName && `· Đội: ${vid.teamName}`}
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12 }}>
                        <span style={{ fontWeight: 900, color: '#ef4444' }}>
                          {fmtNum(vid.views || 0)} views
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#64748b' }}>
                          <ThumbsUp size={12} />
                          <span>{fmtNum(vid.likes || 0)}</span>
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#64748b' }}>
                          <MessageSquare size={12} />
                          <span>{fmtNum(vid.comments || 0)}</span>
                        </span>
                        {vid.videoId && (
                          <a
                            href={`https://www.youtube.com/watch?v=${vid.videoId}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ marginLeft: 'auto', color: '#b45309', display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, textDecoration: 'none', fontWeight: 800 }}
                          >
                            Xem <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </TabTransition>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: TẠO ĐỘI NHÓM MỚI
         ══════════════════════════════════════════════════════════════════════ */}
      {createTeamModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#ffffff', width: '100%', maxWidth: 440, padding: 24, border: '1px solid rgba(15,23,42,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(15,23,42,0.08)', paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={18} color="#b45309" /> Thêm Đội Nhóm Mới
              </h3>
              <button type="button" onClick={() => setCreateTeamModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>Tên Đội Nhóm *</label>
                <input
                  type="text"
                  required
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                  placeholder="Ví dụ: Phoenix Team, Media Team 1..."
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>Phòng Ban Trực Thuộc</label>
                <select
                  value={teamForm.department}
                  onChange={(e) => setTeamForm({ ...teamForm, department: e.target.value })}
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  {DEPARTMENT_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>Màu Đại Diện Đội</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {TEAM_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTeamForm({ ...teamForm, color: c })}
                      style={{
                        width: 26, height: 26, background: c, border: teamForm.color === c ? '2px solid #0f172a' : 'none',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {teamForm.color === c && <Check size={14} color="#fff" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>Mô Tả Nhiệm Vụ</label>
                <textarea
                  rows={2}
                  value={teamForm.description}
                  onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                  placeholder="Mô tả mục tiêu sản xuất hoặc định hướng của team..."
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid #cbd5e1', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => setCreateTeamModalOpen(false)} style={{ padding: '8px 14px', background: '#ffffff', border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                  Hủy
                </button>
                <button type="submit" disabled={savingTeam} style={{ padding: '8px 18px', background: '#b45309', color: '#ffffff', border: 'none', fontSize: 12, fontWeight: 900, cursor: savingTeam ? 'not-allowed' : 'pointer' }}>
                  {savingTeam ? 'Đang tạo...' : 'Tạo Đội Nhóm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: CHỈNH SỬA ĐỘI NHÓM
         ══════════════════════════════════════════════════════════════════════ */}
      {editTeamModalOpen && selectedTeam && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#ffffff', width: '100%', maxWidth: 440, padding: 24, border: '1px solid rgba(15,23,42,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(15,23,42,0.08)', paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={18} color="#b45309" /> Cập Nhật Đội: {selectedTeam.name}
              </h3>
              <button type="button" onClick={() => setEditTeamModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateTeam} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>Tên Đội Nhóm *</label>
                <input
                  type="text"
                  required
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>Phòng Ban Trực Thuộc</label>
                <select
                  value={teamForm.department}
                  onChange={(e) => setTeamForm({ ...teamForm, department: e.target.value })}
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  {DEPARTMENT_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>Màu Đại Diện</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {TEAM_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTeamForm({ ...teamForm, color: c })}
                      style={{
                        width: 26, height: 26, background: c, border: teamForm.color === c ? '2px solid #0f172a' : 'none',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {teamForm.color === c && <Check size={14} color="#fff" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>Mô Tả</label>
                <textarea
                  rows={2}
                  value={teamForm.description}
                  onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid #cbd5e1', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => setEditTeamModalOpen(false)} style={{ padding: '8px 14px', background: '#ffffff', border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                  Hủy
                </button>
                <button type="submit" disabled={savingTeam} style={{ padding: '8px 18px', background: '#b45309', color: '#ffffff', border: 'none', fontSize: 12, fontWeight: 900, cursor: savingTeam ? 'not-allowed' : 'pointer' }}>
                  {savingTeam ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DRAWER / MODAL: QUẢN LÝ THÀNH VIÊN TRONG ĐỘI
         ══════════════════════════════════════════════════════════════════════ */}
      {membersDrawerTeam && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#ffffff', width: '100%', maxWidth: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column', border: '1px solid rgba(15,23,42,0.15)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(15,23,42,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={18} color="#b45309" /> Thành Viên Đội: {membersDrawerTeam.name}
                </h3>
                <span style={{ fontSize: 11, color: '#64748b' }}>Phòng ban: {membersDrawerTeam.department} · {teamMembersList.length} nhân sự</span>
              </div>
              <button type="button" onClick={() => setMembersDrawerTeam(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            {/* Add Member Form */}
            <form onSubmit={handleAddMemberToTeam} style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid rgba(15,23,42,0.06)', display: 'flex', gap: 8 }}>
              <select
                value={selectedUserIdToAdd}
                onChange={(e) => setSelectedUserIdToAdd(e.target.value)}
                style={{ flex: 1, padding: '7px', fontSize: 12, border: '1px solid #cbd5e1', background: '#fff' }}
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
                  padding: '7px 14px', background: '#b45309', color: '#ffffff', border: 'none',
                  fontSize: 12, fontWeight: 900, cursor: addingMember || !selectedUserIdToAdd ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                }}
              >
                <Plus size={13} /> Thêm
              </button>
            </form>

            {/* Members List */}
            <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {teamMembersList.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                  Đội này hiện chưa có nhân viên nào. Hãy chọn nhân viên ở trên để thêm vào đội.
                </div>
              ) : (
                teamMembersList.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: '10px 14px',
                      background: '#ffffff',
                      border: '1px solid rgba(15,23,42,0.08)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 900, color: '#0f172a', fontSize: 13 }}>
                        {m.name} <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>(#{m.id})</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        Chức danh: <strong>{m.jobTitle || 'Nhân viên'}</strong> · Email: {m.email}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveMemberFromTeam(m.id, m.name)}
                      disabled={removingMemberId === m.id}
                      style={{
                        padding: '4px 8px', background: '#fee2e2', color: '#dc2626', border: 'none',
                        fontSize: 11, fontWeight: 800, cursor: removingMemberId === m.id ? 'not-allowed' : 'pointer',
                        opacity: removingMemberId === m.id ? 0.5 : 1,
                      }}
                      title="Gỡ khỏi đội"
                    >
                      {removingMemberId === m.id ? 'Đang gỡ...' : 'Gỡ'}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(15,23,42,0.08)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setMembersDrawerTeam(null)}
                style={{ padding: '8px 16px', background: '#0f172a', color: '#ffffff', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: THÊM KÊNH YOUTUBE MỚI
         ══════════════════════════════════════════════════════════════════════ */}
      {createChannelModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#ffffff', width: '100%', maxWidth: 460, padding: 24, border: '1px solid rgba(15,23,42,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(15,23,42,0.08)', paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tv size={18} color="#ef4444" /> Thêm Kênh YouTube Mới
              </h3>
              <button type="button" onClick={() => setCreateChannelModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateChannel} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                  Mã Kênh YouTube (Channel ID) *
                </label>
                <input
                  type="text"
                  required
                  value={newChannelForm.channelId}
                  onChange={(e) => setNewChannelForm({ ...newChannelForm, channelId: e.target.value })}
                  placeholder="Ví dụ: UCxxxxxxxxxxxx hoặc channel_id_01"
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                  Tên Kênh YouTube (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={newChannelForm.title}
                  onChange={(e) => setNewChannelForm({ ...newChannelForm, title: e.target.value })}
                  placeholder="Ví dụ: TechReview Official, Production Channel..."
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                  Custom URL / Handle (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={newChannelForm.customUrl}
                  onChange={(e) => setNewChannelForm({ ...newChannelForm, customUrl: e.target.value })}
                  placeholder="Ví dụ: @TechReviewOfficial"
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
                  Gán Cho Đội Nhóm Phụ Trách
                </label>
                <select
                  value={newChannelForm.teamId}
                  onChange={(e) => setNewChannelForm({ ...newChannelForm, teamId: e.target.value })}
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  <option value="">-- Chưa gán đội (Gán sau) --</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.department})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => setCreateChannelModalOpen(false)} style={{ padding: '8px 14px', background: '#ffffff', border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                  Hủy
                </button>
                <button type="submit" disabled={savingChannel} style={{ padding: '8px 18px', background: '#ef4444', color: '#ffffff', border: 'none', fontSize: 12, fontWeight: 900, cursor: savingChannel ? 'not-allowed' : 'pointer' }}>
                  {savingChannel ? 'Đang thêm...' : 'Thêm Kênh'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
