import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  Building2,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Crown,
  Edit3,
  Eye,
  LogOut,
  Mail,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Trash2,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';
import JobTitleBadge, { CATEGORIZED_DEPARTMENTS } from '../components/JobTitleBadge';
import { PageShell, PageHeader, Card, EmptyState, PageState, TabTransition } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useConfirm, useToast } from '../context/UiContext';
import { parseApiError } from '../utils/errors';
import {
  groups as groupsApi,
  users as usersApi,
  rankings as rankingsApi,
  leaderboard as leaderboardApi,
} from '../services/api';
import { getUserAvatar, initialsFromName } from '../utils/avatar';
import usePageVisibility from '../hooks/usePageVisibility';

const STATUS_META = {
  active: { label: 'Đang làm việc', color: '#16a34a', bg: 'rgba(22,163,74,0.1)', border: 'rgba(22,163,74,0.28)', dot: '#22c55e' },
  online: { label: 'Trực tuyến', color: '#0891b2', bg: 'rgba(8,145,178,0.1)', border: 'rgba(8,145,178,0.25)', dot: '#06b6d4' },
  idle: { label: 'Tạm nghỉ', color: '#ca8a04', bg: 'rgba(234,179,8,0.13)', border: 'rgba(234,179,8,0.3)', dot: '#eab308' },
  offline: { label: 'Ngoại tuyến', color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.22)', dot: '#94a3b8' },
};

function statusMeta(status) {
  return STATUS_META[String(status || 'offline').toLowerCase()] || STATUS_META.offline;
}

function userIdOf(user = {}) {
  return String(user.id || user.user_id || user.userId || '');
}

function isVerified(user = {}) {
  return user.isVerified === true || user.verified === true || user.isVerified === 1 || user.verified === 1;
}

function formatMemberCode(user = {}) {
  const id = user.id || user.user_id || user.userId || '';
  return `WR-${String(id).padStart(4, '0')}`;
}

function fmtNum(n) {
  const val = Number(n) || 0;
  return val.toLocaleString('vi-VN');
}

function Avatar({ user, size = 42 }) {
  const avatar = getUserAvatar(user, userIdOf(user));
  const name = user.name || user.email || 'User';
  return (
    <div style={{
      width: size,
      height: size,
      overflow: 'hidden',
      background: '#0f172a',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: Math.max(11, Math.round(size * 0.34)),
      fontWeight: 900,
      flexShrink: 0,
      position: 'relative',
      borderRadius: '50%',
    }}>
      {avatar ? (
        <img src={avatar} alt={`Ảnh ${name}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        initialsFromName(name)
      )}
    </div>
  );
}

function PresencePill({ status }) {
  const meta = statusMeta(status);
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      minHeight: 22,
      border: `1px solid ${meta.border}`,
      background: meta.bg,
      color: meta.color,
      padding: '0 8px',
      fontSize: 10,
      fontWeight: 900,
      whiteSpace: 'nowrap',
      textTransform: 'uppercase',
      borderRadius: 9999,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot, flexShrink: 0 }} />
      {meta.label}
    </span>
  );
}

export default function Friends() {
  const { user: authUser, socket } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const pageVisible = usePageVisibility();

  // Tab State
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'team' | 'leaderboard'

  // Data States
  const [memberList, setMemberList] = useState([]);
  const [memberPagination, setMemberPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [myTeam, setMyTeam] = useState(null);
  const [allTeams, setAllTeams] = useState([]);
  const [rankingRows, setRankingRows] = useState([]);
  
  // Filter States (Directory)
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [teamStatusFilter, setTeamStatusFilter] = useState('all'); // 'all' | 'has_team' | 'no_team'

  // Status & Busy States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState('');

  // Modals
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinInviteCode, setJoinInviteCode] = useState('');

  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamDesc, setEditTeamDesc] = useState('');

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');

  const searchTimerRef = useRef(null);

  // Derived Values
  const isTeamLeader = useMemo(() => {
    if (!myTeam || !authUser) return false;
    return String(myTeam.ownerId || myTeam.owner_id || '') === String(authUser.id || '');
  }, [myTeam, authUser]);

  const isAdmin = authUser?.role === 'admin';
  const canManageTeam = isTeamLeader || isAdmin;

  const onlineCount = useMemo(() => {
    return memberList.filter((m) => ['active', 'online', 'idle'].includes(String(m.presence || m.status || '').toLowerCase())).length;
  }, [memberList]);

  // Load Main Data
  const loadData = useCallback(async (options = {}) => {
    const background = options.background === true;
    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const searchParams = {
        limit: 100,
        withProfile: true,
        withCount: true,
      };
      if (searchQuery.trim()) searchParams.search = searchQuery.trim();
      if (departmentFilter !== 'all') searchParams.department = departmentFilter;
      if (teamStatusFilter === 'has_team') searchParams.hasTeam = 'true';
      if (teamStatusFilter === 'no_team') searchParams.hasTeam = 'false';

      const [usersRes, groupsRes, allTeamsRes, rankingRes] = await Promise.allSettled([
        usersApi.list(searchParams),
        groupsApi.list(),
        groupsApi.listAll(),
        rankingsApi.getIndividuals({ limit: 50 }),
      ]);

      if (usersRes.status === 'fulfilled') {
        const uData = usersRes.value.data || [];
        setMemberList(uData);
        if (usersRes.value.pagination) {
          setMemberPagination(usersRes.value.pagination);
        }
      }

      if (groupsRes.status === 'fulfilled') {
        const groups = groupsRes.value.data || [];
        setMyTeam(groups.length > 0 ? groups[0] : null);
      }

      if (allTeamsRes.status === 'fulfilled') {
        setAllTeams(allTeamsRes.value.data || []);
      }

      if (rankingRes.status === 'fulfilled') {
        const ranks = rankingRes.value.data || rankingRes.value.individuals || [];
        setRankingRows(Array.isArray(ranks) ? ranks : []);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Không thể tải dữ liệu thành viên & đội nhóm';
      setError(msg);
      toast(msg, { type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, departmentFilter, teamStatusFilter, toast]);

  useEffect(() => {
    if (pageVisible) {
      loadData();
    }
  }, [loadData, pageVisible]);

  // Real-time presence listener
  useEffect(() => {
    if (!socket || !pageVisible) return undefined;
    const handleStatusUpdate = (payload = {}) => {
      const targetId = String(payload.userId || payload.user_id || payload.id || '');
      if (!targetId) return;
      const nextStatus = payload.presence || payload.presenceStatus || payload.status || 'online';
      setMemberList((prev) =>
        prev.map((m) =>
          userIdOf(m) === targetId
            ? { ...m, status: nextStatus, presence: nextStatus, lastSeenAt: payload.lastSeenAt || m.lastSeenAt }
            : m
        )
      );
    };
    socket.on('user:status:update', handleStatusUpdate);
    return () => socket.off('user:status:update', handleStatusUpdate);
  }, [socket, pageVisible]);

  // Handle Team Actions
  const handleCreateTeam = async (e) => {
    e?.preventDefault?.();
    if (!newTeamName.trim()) {
      toast('Vui lòng nhập tên đội nhóm', { type: 'error' });
      return;
    }
    setBusyAction('create-team');
    try {
      const res = await groupsApi.create({
        name: newTeamName.trim(),
        description: newTeamDesc.trim() || undefined,
      });
      toast(`Đã tạo đội "${res.data?.name || newTeamName}" thành công! Bạn là Trưởng nhóm.`, { type: 'success' });
      setShowCreateTeamModal(false);
      setNewTeamName('');
      setNewTeamDesc('');
      await loadData({ background: true });
    } catch (err) {
      toast(err.response?.data?.message || err.message || 'Không thể tạo đội nhóm', { type: 'error' });
    } finally {
      setBusyAction('');
    }
  };

  const handleJoinTeam = async (e) => {
    e?.preventDefault?.();
    if (!joinInviteCode.trim()) {
      toast('Vui lòng nhập mã mời đội', { type: 'error' });
      return;
    }
    setBusyAction('join-team');
    try {
      const res = await groupsApi.join(joinInviteCode.trim());
      toast(`Gia nhập đội "${res.data?.name}" thành công!`, { type: 'success' });
      setShowJoinModal(false);
      setJoinInviteCode('');
      await loadData({ background: true });
    } catch (err) {
      toast(err.response?.data?.message || err.message || 'Mã mời không hợp lệ hoặc đã hết hạn', { type: 'error' });
    } finally {
      setBusyAction('');
    }
  };

  const handleEditTeam = async (e) => {
    e?.preventDefault?.();
    if (!myTeam) return;
    if (!editTeamName.trim()) {
      toast('Tên đội không được để trống', { type: 'error' });
      return;
    }
    setBusyAction('edit-team');
    try {
      await groupsApi.update(myTeam.id, {
        name: editTeamName.trim(),
        description: editTeamDesc.trim() || undefined,
      });
      toast('Đã cập nhật thông tin đội thành công!', { type: 'success' });
      setShowEditTeamModal(false);
      await loadData({ background: true });
    } catch (err) {
      toast(err.response?.data?.message || err.message || 'Không thể cập nhật thông tin đội', { type: 'error' });
    } finally {
      setBusyAction('');
    }
  };

  const handleLeaveTeam = async () => {
    if (!myTeam) return;
    if (isTeamLeader && myTeam.memberCount > 1) {
      toast('Trưởng nhóm phải giải tán đội hoặc chuyển quyền trước khi rời đội.', { type: 'error' });
      return;
    }
    const ok = await confirm({
      title: 'Xác nhận rời đội',
      message: `Bạn có chắc chắn muốn rời khỏi đội "${myTeam.name}" không?`,
      confirmLabel: 'Rời đội',
      variant: 'danger',
    });
    if (!ok) return;

    setBusyAction('leave-team');
    try {
      if (isTeamLeader) {
        await groupsApi.delete(myTeam.id);
        toast(`Đã giải tán đội "${myTeam.name}".`, { type: 'success' });
      } else {
        await groupsApi.leave(myTeam.id);
        toast(`Bạn đã rời đội "${myTeam.name}".`, { type: 'success' });
      }
      await loadData({ background: true });
    } catch (err) {
      toast(err.response?.data?.message || err.message || 'Không thể rời đội', { type: 'error' });
    } finally {
      setBusyAction('');
    }
  };

  const handleDeleteTeam = async () => {
    if (!myTeam) return;
    const ok = await confirm({
      title: 'Giải tán đội nhóm',
      message: `Hành động này sẽ giải tán đội "${myTeam.name}" và toàn bộ thành viên sẽ trở về trạng thái tự do. Bạn có chắc chắn không?`,
      confirmLabel: 'Giải tán đội',
      variant: 'danger',
    });
    if (!ok) return;

    setBusyAction('delete-team');
    try {
      await groupsApi.delete(myTeam.id);
      toast(`Đã giải tán đội "${myTeam.name}".`, { type: 'success' });
      await loadData({ background: true });
    } catch (err) {
      toast(err.response?.data?.message || err.message || 'Không thể giải tán đội', { type: 'error' });
    } finally {
      setBusyAction('');
    }
  };

  const handleKickMember = async (member) => {
    if (!myTeam) return;
    const memberId = userIdOf(member);
    const ok = await confirm({
      title: 'Xóa thành viên khỏi đội',
      message: `Bạn có chắc chắn muốn mời thành viên "${member.name || member.email}" rời khỏi đội?`,
      confirmLabel: 'Xóa khỏi đội',
      variant: 'danger',
    });
    if (!ok) return;

    setBusyAction(`kick:${memberId}`);
    try {
      await groupsApi.kick(myTeam.id, memberId);
      toast(`Đã đưa ${member.name || 'thành viên'} ra khỏi đội.`, { type: 'success' });
      await loadData({ background: true });
    } catch (err) {
      toast(err.response?.data?.message || err.message || 'Không thể xóa thành viên', { type: 'error' });
    } finally {
      setBusyAction('');
    }
  };

  const handleDirectAddMember = async (targetUser) => {
    if (!myTeam) {
      toast('Bạn chưa có đội để thêm thành viên. Hãy tạo đội trước.', { type: 'error' });
      return;
    }
    const targetId = userIdOf(targetUser);
    setBusyAction(`add:${targetId}`);
    try {
      await groupsApi.addMember(myTeam.id, targetId);
      toast(`Đã thêm ${targetUser.name || 'đồng nghiệp'} vào đội "${myTeam.name}"!`, { type: 'success' });
      await loadData({ background: true });
    } catch (err) {
      toast(err.response?.data?.message || err.message || 'Không thể thêm thành viên vào đội', { type: 'error' });
    } finally {
      setBusyAction('');
    }
  };

  const handleCopyInviteCode = () => {
    if (!myTeam?.inviteCode && !myTeam?.invite_code) return;
    const code = myTeam.inviteCode || myTeam.invite_code;
    navigator.clipboard.writeText(code);
    toast(`Đã sao chép mã mời: ${code}`, { type: 'success' });
  };

  const openProfile = (targetUser) => {
    const targetId = userIdOf(targetUser);
    if (targetId) navigate(`/users/${targetId}`);
  };

  // Filter unassigned colleagues for leader add modal
  const unassignedColleagues = useMemo(() => {
    return memberList.filter((m) => {
      const isSelf = userIdOf(m) === String(authUser?.id || '');
      const hasTeam = Boolean(m.teamId || m.team_id || m.team);
      if (isSelf || hasTeam) return false;
      if (!addMemberSearch.trim()) return true;
      const s = addMemberSearch.trim().toLowerCase();
      return (
        (m.name || '').toLowerCase().includes(s) ||
        (m.email || '').toLowerCase().includes(s) ||
        (m.jobTitle || '').toLowerCase().includes(s) ||
        (m.department || '').toLowerCase().includes(s)
      );
    });
  }, [memberList, authUser?.id, addMemberSearch]);

  return (
    <PageShell>
      {/* Header */}
      <PageHeader
        title="Thành Viên & Đội Nhóm"
        subtitle="Mạng lưới đồng nghiệp nội bộ, quản lý đội nhóm thi đua và bảng xếp hạng thành viên"
        badge="Nội Bộ"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => loadData({ background: true })}
              disabled={refreshing}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Làm mới
            </button>
            {!myTeam ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowJoinModal(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <KeyRoundIcon size={14} />
                  Nhập mã mời
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowCreateTeamModal(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={14} />
                  Tạo đội mới
                </button>
              </>
            ) : canManageTeam ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowAddMemberModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <UserPlus size={14} />
                Thêm thành viên
              </button>
            ) : null}
          </div>
        }
      />

      {/* KPI Metric Summary Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
        marginBottom: 20,
      }}>
        <div style={{
          background: '#ffffff',
          border: '1px solid rgba(15,23,42,0.08)',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{
            width: 40,
            height: 40,
            background: 'rgba(56,189,248,0.1)',
            color: '#0284c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tổng nhân sự công ty
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
              {memberPagination.total || memberList.length} <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>người</span>
            </div>
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          border: '1px solid rgba(15,23,42,0.08)',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{
            width: 40,
            height: 40,
            background: 'rgba(22,163,74,0.1)',
            color: '#16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Trực tuyến / Hoạt động
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#16a34a', marginTop: 2 }}>
              {onlineCount} <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>đang online</span>
            </div>
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          border: '1px solid rgba(15,23,42,0.08)',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{
            width: 40,
            height: 40,
            background: myTeam ? 'rgba(124,58,237,0.1)' : 'rgba(100,116,139,0.1)',
            color: myTeam ? '#7c3aed' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Shield size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Đội nhóm của bạn
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {myTeam ? myTeam.name : 'Chưa tham gia đội'}
            </div>
          </div>
        </div>

        <div style={{
          background: '#ffffff',
          border: '1px solid rgba(15,23,42,0.08)',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{
            width: 40,
            height: 40,
            background: isTeamLeader ? 'rgba(217,119,6,0.1)' : 'rgba(15,23,42,0.06)',
            color: isTeamLeader ? '#d97706' : '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            {isTeamLeader ? <Crown size={20} /> : <Award size={20} />}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Vai trò trong đội
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: isTeamLeader ? '#d97706' : '#0f172a', marginTop: 2 }}>
              {isTeamLeader ? '👑 Trưởng nhóm' : myTeam ? 'Thành viên' : 'Chưa có đội'}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid rgba(15,23,42,0.1)',
        marginBottom: 24,
        gap: 8,
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          style={{
            padding: '12px 18px',
            fontSize: 14,
            fontWeight: 900,
            border: 'none',
            borderBottom: activeTab === 'directory' ? '3px solid #0f172a' : '3px solid transparent',
            background: 'transparent',
            color: activeTab === 'directory' ? '#0f172a' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2,
            transition: 'all 0.15s ease',
          }}
        >
          <Users size={16} />
          Danh Bạ Đồng Nghiệp
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            padding: '2px 6px',
            background: activeTab === 'directory' ? '#0f172a' : 'rgba(100,116,139,0.15)',
            color: activeTab === 'directory' ? '#ffffff' : '#64748b',
          }}>
            {memberPagination.total || memberList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('team')}
          style={{
            padding: '12px 18px',
            fontSize: 14,
            fontWeight: 900,
            border: 'none',
            borderBottom: activeTab === 'team' ? '3px solid #0f172a' : '3px solid transparent',
            background: 'transparent',
            color: activeTab === 'team' ? '#0f172a' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2,
            transition: 'all 0.15s ease',
          }}
        >
          <Shield size={16} />
          Đội Nhóm Của Tôi
          {myTeam && (
            <span style={{
              fontSize: 11,
              fontWeight: 800,
              padding: '2px 6px',
              background: '#0284c7',
              color: '#ffffff',
            }}>
              {myTeam.name}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leaderboard')}
          style={{
            padding: '12px 18px',
            fontSize: 14,
            fontWeight: 900,
            border: 'none',
            borderBottom: activeTab === 'leaderboard' ? '3px solid #0f172a' : '3px solid transparent',
            background: 'transparent',
            color: activeTab === 'leaderboard' ? '#0f172a' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2,
            transition: 'all 0.15s ease',
          }}
        >
          <Trophy size={16} />
          BXH Thành Viên
        </button>
      </div>

      {/* Main Tab Content */}
      <TabTransition tabKey={activeTab}>
        {/* =========================================================================
            TAB 1: MEMBER DIRECTORY (DANH BẠ ĐỒNG NGHIỆP)
            ========================================================================= */}
        {activeTab === 'directory' && (
          <div>
            {/* Search & Filter Controls */}
            <div style={{
              background: '#ffffff',
              border: '1px solid rgba(15,23,42,0.08)',
              padding: 16,
              marginBottom: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên, email, chức danh, mã WR-0001..."
                    style={{
                      width: '100%',
                      height: 40,
                      paddingLeft: 38,
                      paddingRight: 12,
                      border: '1px solid rgba(15,23,42,0.16)',
                      background: '#ffffff',
                      fontSize: 13,
                      fontWeight: 600,
                      outline: 'none',
                    }}
                  />
                </div>

                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  style={{
                    height: 40,
                    padding: '0 12px',
                    border: '1px solid rgba(15,23,42,0.16)',
                    background: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#0f172a',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="all">Tất cả phòng ban</option>
                  <option value="Media & Content">Media & Content</option>
                  <option value="Engineering Core">Engineering Core</option>
                  <option value="Community & Growth">Community & Growth</option>
                  <option value="Phòng Sản Xuất Video">Phòng Sản Xuất Video</option>
                  <option value="Phòng Truyền Thông">Phòng Truyền Thông</option>
                  <option value="Phòng Kỹ Thuật">Phòng Kỹ Thuật</option>
                  <option value="Ban Giám Đốc">Ban Giám Đốc</option>
                </select>

                <select
                  value={teamStatusFilter}
                  onChange={(e) => setTeamStatusFilter(e.target.value)}
                  style={{
                    height: 40,
                    padding: '0 12px',
                    border: '1px solid rgba(15,23,42,0.16)',
                    background: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#0f172a',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="all">Tất cả trạng thái đội</option>
                  <option value="has_team">Đã có đội nhóm</option>
                  <option value="no_team">Chưa tham gia đội</option>
                </select>
              </div>
            </div>

            {/* Member Cards Grid */}
            {loading ? (
              <PageState type="loading" title="Đang tải danh bạ nhân sự..." />
            ) : memberList.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Không tìm thấy thành viên nào"
                description="Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc phòng ban."
              />
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 16,
              }}>
                {memberList.map((member) => {
                  const mId = userIdOf(member);
                  const isSelf = String(authUser?.id || '') === mId;
                  const memberTeamName = member.teamName || member.team?.name || (member.teamId && myTeam && String(member.teamId) === String(myTeam.id) ? myTeam.name : null);
                  const memberIsLeader = member.isTeamLeader || (member.team && String(member.team.ownerId) === mId);
                  const canInviteToMyTeam = canManageTeam && myTeam && !member.teamId && !member.team;

                  return (
                    <article
                      key={mId}
                      style={{
                        background: '#ffffff',
                        border: isSelf ? '2px solid #0284c7' : '1px solid rgba(15,23,42,0.08)',
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 14,
                        position: 'relative',
                        transition: 'border-color 0.15s ease',
                      }}
                    >
                      {/* Top identity */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                            <Avatar user={member} size={46} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                <strong style={{
                                  fontSize: 14,
                                  fontWeight: 900,
                                  color: '#0f172a',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {member.name || member.email || `Thành viên #${mId}`}
                                </strong>
                                {isVerified(member) && <VerifiedBadge size={14} />}
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', marginTop: 2 }}>
                                {formatMemberCode(member)} {isSelf && <span style={{ color: '#0284c7', fontWeight: 900 }}>· Bạn</span>}
                              </div>
                            </div>
                          </div>
                          <PresencePill status={member.presence || member.status} />
                        </div>

                        {/* Badges: Job Title & Department */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                          <JobTitleBadge title={member.jobTitle} size="sm" />
                          {member.department && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              minHeight: 22,
                              padding: '0 8px',
                              background: '#f8fafc',
                              border: '1px solid rgba(15,23,42,0.1)',
                              fontSize: 11,
                              fontWeight: 700,
                              color: '#475569',
                            }}>
                              <Building2 size={12} />
                              {member.department}
                            </span>
                          )}
                        </div>

                        {/* Team Info */}
                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed rgba(15,23,42,0.08)' }}>
                          {memberTeamName ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 11,
                                fontWeight: 900,
                                color: memberIsLeader ? '#d97706' : '#0284c7',
                                background: memberIsLeader ? 'rgba(217,119,6,0.08)' : 'rgba(2,132,199,0.08)',
                                border: memberIsLeader ? '1px solid rgba(217,119,6,0.25)' : '1px solid rgba(2,132,199,0.2)',
                                padding: '2px 8px',
                              }}>
                                <Shield size={12} />
                                {memberTeamName} {memberIsLeader && '👑 Trưởng nhóm'}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>
                              Chưa tham gia đội nhóm nào
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                        borderTop: '1px solid rgba(15,23,42,0.06)',
                        paddingTop: 12,
                      }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => openProfile(member)}
                          style={{ flex: 1, minHeight: 32, fontSize: 12, fontWeight: 800, padding: '0 10px' }}
                        >
                          <Eye size={13} />
                          Hồ sơ
                        </button>

                        {canInviteToMyTeam && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={busyAction === `add:${mId}`}
                            onClick={() => handleDirectAddMember(member)}
                            style={{ minHeight: 32, fontSize: 12, fontWeight: 800, padding: '0 10px', background: '#0284c7' }}
                          >
                            <UserPlus size={13} />
                            Thêm vào đội
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 2: MY TEAM & SQUAD MANAGEMENT (ĐỘI NHÓM CỦA TÔI)
            ========================================================================= */}
        {activeTab === 'team' && (
          <div>
            {myTeam ? (
              <div style={{ display: 'grid', gap: 20 }}>
                {/* Team Overview Banner */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid rgba(15,23,42,0.1)',
                  padding: 24,
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
                      <div style={{
                        width: 56,
                        height: 56,
                        background: '#0f172a',
                        color: '#38bdf8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Shield size={28} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                            {myTeam.name}
                          </h2>
                          <span style={{
                            fontSize: 12,
                            fontWeight: 900,
                            padding: '3px 8px',
                            background: isTeamLeader ? '#d97706' : '#0284c7',
                            color: '#ffffff',
                          }}>
                            {isTeamLeader ? '👑 Bạn là Trưởng nhóm' : 'Thành viên'}
                          </span>
                        </div>
                        {myTeam.description && (
                          <p style={{ fontSize: 13, color: '#475569', marginTop: 6, marginBottom: 0 }}>
                            {myTeam.description}
                          </p>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                          <span>👥 {myTeam.memberCount || myTeam.members?.length || 0} thành viên</span>
                          {myTeam.owner && (
                            <span>👑 Trưởng nhóm: <strong style={{ color: '#0f172a' }}>{myTeam.owner.name || myTeam.owner.email}</strong></span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Invite Code & Management Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: '#f8fafc',
                        border: '1px solid rgba(15,23,42,0.12)',
                        padding: '6px 12px',
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                          Mã mời:
                        </span>
                        <strong style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', letterSpacing: '0.05em' }}>
                          {myTeam.inviteCode || myTeam.invite_code}
                        </strong>
                        <button
                          type="button"
                          onClick={handleCopyInviteCode}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#0284c7', padding: 2 }}
                          title="Sao chép mã mời"
                        >
                          <Copy size={15} />
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {canManageTeam && (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => {
                                setEditTeamName(myTeam.name || '');
                                setEditTeamDesc(myTeam.description || '');
                                setShowEditTeamModal(true);
                              }}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, minHeight: 34 }}
                            >
                              <Edit3 size={14} />
                              Chỉnh sửa đội
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => setShowAddMemberModal(true)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, minHeight: 34 }}
                            >
                              <UserPlus size={14} />
                              Thêm thành viên
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleLeaveTeam}
                          disabled={busyAction === 'leave-team'}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 12,
                            minHeight: 34,
                            color: '#dc2626',
                            borderColor: 'rgba(220,38,38,0.25)',
                          }}
                        >
                          <LogOut size={14} />
                          {isTeamLeader ? 'Giải tán đội' : 'Rời đội'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Team Members List */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid rgba(15,23,42,0.1)',
                  padding: 20,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                      Danh Sách Thành Viên ({myTeam.members?.length || 0})
                    </h3>
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
                    {(myTeam.members || []).map((m) => {
                      const memberId = userIdOf(m);
                      const isSelf = String(authUser?.id || '') === memberId;
                      const isMemberLeader = String(myTeam.ownerId || myTeam.owner_id || '') === memberId;

                      return (
                        <div
                          key={memberId}
                          style={{
                            border: '1px solid rgba(15,23,42,0.08)',
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            background: isSelf ? '#f8fafc' : '#ffffff',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                            <Avatar user={m} size={40} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <strong style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>
                                  {m.name || m.email || `Thành viên #${memberId}`}
                                </strong>
                                {isVerified(m) && <VerifiedBadge size={14} />}
                                {isMemberLeader && (
                                  <span style={{
                                    fontSize: 10,
                                    fontWeight: 900,
                                    padding: '1px 6px',
                                    background: 'rgba(217,119,6,0.12)',
                                    color: '#b45309',
                                    border: '1px solid rgba(217,119,6,0.3)',
                                  }}>
                                    👑 Trưởng nhóm
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                                <JobTitleBadge title={m.jobTitle} size="sm" />
                                {m.department && (
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                                    · {m.department}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <PresencePill status={m.presence || m.status} />
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => openProfile(m)}
                              style={{ minHeight: 30, padding: '0 10px', fontSize: 12 }}
                            >
                              <Eye size={13} />
                              Hồ sơ
                            </button>

                            {canManageTeam && !isMemberLeader && !isSelf && (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                disabled={busyAction === `kick:${memberId}`}
                                onClick={() => handleKickMember(m)}
                                style={{
                                  minHeight: 30,
                                  padding: '0 10px',
                                  fontSize: 12,
                                  color: '#dc2626',
                                  borderColor: 'rgba(220,38,38,0.2)',
                                }}
                              >
                                <Trash2 size={13} />
                                Xóa
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* No Team: Onboarding Hub */
              <div style={{ display: 'grid', gap: 24 }}>
                <div style={{
                  background: '#ffffff',
                  border: '1px solid rgba(15,23,42,0.1)',
                  padding: 32,
                  textAlign: 'center',
                }}>
                  <div style={{
                    width: 64,
                    height: 64,
                    background: 'rgba(56,189,248,0.1)',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px auto',
                  }}>
                    <Shield size={32} />
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>
                    Bạn Chưa Thuộc Đội Nhóm Nào
                  </h2>
                  <p style={{ fontSize: 14, color: '#64748b', maxWidth: 540, margin: '0 auto 24px auto', lineHeight: 1.5 }}>
                    Tham gia một đội nhóm để cùng các đồng nghiệp thi đua sản xuất video, tích lũy điểm thưởng mùa giải và tranh cúp vô địch WorkRank.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setShowCreateTeamModal(true)}
                      style={{ minHeight: 40, padding: '0 20px', fontSize: 14, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    >
                      <Plus size={16} />
                      Tạo đội mới (Trở thành Trưởng nhóm)
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowJoinModal(true)}
                      style={{ minHeight: 40, padding: '0 20px', fontSize: 14, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    >
                      <KeyRoundIcon size={16} />
                      Gia nhập bằng mã mời
                    </button>
                  </div>
                </div>

                {/* Company Teams Showcase */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid rgba(15,23,42,0.1)',
                  padding: 24,
                }}>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginBottom: 16 }}>
                    Các Đội Nhóm Trong Công Ty ({allTeams.length})
                  </h3>
                  {allTeams.length === 0 ? (
                    <EmptyState
                      icon={Shield}
                      title="Chưa có đội nhóm nào"
                      description="Hãy là người đầu tiên tạo đội nhóm cho phòng ban của bạn!"
                    />
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                      gap: 14,
                    }}>
                      {allTeams.map((team) => (
                        <div
                          key={team.id}
                          style={{
                            border: '1px solid rgba(15,23,42,0.08)',
                            padding: 16,
                            background: '#ffffff',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: 12,
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                              <strong style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
                                {team.name}
                              </strong>
                              <span style={{ fontSize: 11, fontWeight: 800, color: '#0284c7', background: 'rgba(2,132,199,0.08)', padding: '2px 8px' }}>
                                {team.memberCount || 0} thành viên
                              </span>
                            </div>
                            {team.description && (
                              <p style={{ fontSize: 12, color: '#64748b', marginTop: 6, marginBottom: 0 }}>
                                {team.description}
                              </p>
                            )}
                            {team.owner && (
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginTop: 8 }}>
                                👑 Trưởng nhóm: <strong style={{ color: '#475569' }}>{team.owner.name || team.owner.email}</strong>
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', borderTop: '1px dashed rgba(15,23,42,0.08)', paddingTop: 8 }}>
                            Liên hệ Trưởng nhóm để nhận mã mời gia nhập
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 3: COLLEAGUE LEADERBOARD (BXH THÀNH VIÊN)
            ========================================================================= */}
        {activeTab === 'leaderboard' && (
          <div style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.1)', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  Bảng Xếp Hạng Cá Nhân Toàn Công Ty
                </h3>
                <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0 0' }}>
                  Dữ liệu điểm thi đua được tính toán chuẩn xác từ hệ thống WorkRank Ranking Hub
                </p>
              </div>
            </div>

            {rankingRows.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="Chưa có dữ liệu xếp hạng"
                description="Hệ thống sẽ cập nhật bảng xếp hạng khi mùa giải thi đấu bắt đầu."
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #0f172a', fontSize: 12, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 12px', width: 60 }}>Hạng</th>
                      <th style={{ padding: '10px 12px' }}>Thành viên</th>
                      <th style={{ padding: '10px 12px' }}>Chức danh / Phòng ban</th>
                      <th style={{ padding: '10px 12px' }}>Đội nhóm</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Điểm Mùa Giải</th>
                      <th style={{ padding: '10px 12px', width: 80, textAlign: 'center' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingRows.map((row, idx) => {
                      const rank = row.rank || idx + 1;
                      const rUser = row.User || row.user || row;
                      const rId = userIdOf(rUser);
                      const isTop3 = rank <= 3;
                      const isSelf = String(authUser?.id || '') === rId;

                      return (
                        <tr
                          key={rId || idx}
                          style={{
                            borderBottom: '1px solid rgba(15,23,42,0.06)',
                            background: isSelf ? 'rgba(56,189,248,0.06)' : isTop3 ? 'rgba(254,243,199,0.15)' : '#ffffff',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '12px 12px', fontWeight: 900, fontSize: 14 }}>
                            {rank === 1 ? '🥇 1' : rank === 2 ? '🥈 2' : rank === 3 ? '🥉 3' : `#${rank}`}
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar user={rUser} size={36} />
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <strong style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>
                                    {rUser.name || rUser.email || `User #${rId}`}
                                  </strong>
                                  {isVerified(rUser) && <VerifiedBadge size={13} />}
                                </div>
                                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                                  {formatMemberCode(rUser)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <JobTitleBadge title={rUser.jobTitle || row.jobTitle} size="sm" />
                              {(rUser.department || row.department) && (
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                                  {rUser.department || row.department}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            {row.teamName || rUser.teamName || (rUser.Team && rUser.Team.name) ? (
                              <span style={{ fontSize: 12, fontWeight: 800, color: '#0284c7' }}>
                                🛡️ {row.teamName || rUser.teamName || rUser.Team?.name}
                              </span>
                            ) : (
                              <span style={{ fontSize: 12, color: '#94a3b8' }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                            <strong style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
                              {fmtNum(row.points || row.score || row.seasonScore || 0)}
                            </strong>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginLeft: 4 }}>PTS</span>
                          </td>
                          <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => openProfile(rUser)}
                              style={{ minHeight: 28, padding: '0 8px', fontSize: 11 }}
                            >
                              <Eye size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </TabTransition>

      {/* =========================================================================
          MODAL: TẠO ĐỘI MỚI (CREATE TEAM)
          ========================================================================= */}
      {showCreateTeamModal && (
        <div style={MODAL_BACKDROP}>
          <div style={MODAL_PANEL}>
            <div style={MODAL_HEADER}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                  Tạo Đội Nhóm Mới
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateTeamModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={LABEL_STYLE}>
                  Tên Đội Nhóm <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Ví dụ: Team Alpha Media, Dragon Studio..."
                  style={INPUT_STYLE}
                  maxLength={120}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={LABEL_STYLE}>Mô Tả Đội (Không bắt buộc)</label>
                <textarea
                  rows={3}
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                  placeholder="Mục tiêu sản xuất, phương châm hoạt động của đội..."
                  style={{ ...INPUT_STYLE, height: 'auto', padding: '10px 12px' }}
                  maxLength={1000}
                />
              </div>

              <div style={{
                background: '#f8fafc',
                border: '1px solid rgba(15,23,42,0.08)',
                padding: 12,
                fontSize: 12,
                color: '#64748b',
                marginBottom: 20,
              }}>
                👑 <strong>Lưu ý:</strong> Bạn sẽ tự động trở thành <strong>Trưởng nhóm</strong> của đội này và có quyền mời đồng nghiệp, chỉnh sửa thông tin đội.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateTeamModal(false)}
                  disabled={busyAction === 'create-team'}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!newTeamName.trim() || busyAction === 'create-team'}
                >
                  {busyAction === 'create-team' ? 'Đang tạo...' : 'Tạo Đội Nhóm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: GIA NHẬP BẰNG MÃ MỜI (JOIN TEAM)
          ========================================================================= */}
      {showJoinModal && (
        <div style={MODAL_BACKDROP}>
          <div style={MODAL_PANEL}>
            <div style={MODAL_HEADER}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyRoundIcon size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                  Gia Nhập Đội Bằng Mã Mời
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleJoinTeam} style={{ padding: 20 }}>
              <div style={{ marginBottom: 20 }}>
                <label style={LABEL_STYLE}>
                  Nhập Mã Mời Của Đội (WR-XXXXXX) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={joinInviteCode}
                  onChange={(e) => setJoinInviteCode(e.target.value.toUpperCase())}
                  placeholder="WR-ABC123"
                  style={{ ...INPUT_STYLE, letterSpacing: '0.08em', fontWeight: 900 }}
                  maxLength={32}
                />
                <span style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginTop: 4 }}>
                  Hỏi Trưởng nhóm của bạn để lấy mã mời vào đội.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowJoinModal(false)}
                  disabled={busyAction === 'join-team'}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!joinInviteCode.trim() || busyAction === 'join-team'}
                >
                  {busyAction === 'join-team' ? 'Đang gia nhập...' : 'Gia Nhập Đội'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CHỈNH SỬA THÔNG TIN ĐỘI (EDIT TEAM)
          ========================================================================= */}
      {showEditTeamModal && myTeam && (
        <div style={MODAL_BACKDROP}>
          <div style={MODAL_PANEL}>
            <div style={MODAL_HEADER}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                  Chỉnh Sửa Thông Tin Đội
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditTeamModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditTeam} style={{ padding: 20 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={LABEL_STYLE}>
                  Tên Đội Nhóm <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  style={INPUT_STYLE}
                  maxLength={120}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={LABEL_STYLE}>Mô Tả Đội</label>
                <textarea
                  rows={3}
                  value={editTeamDesc}
                  onChange={(e) => setEditTeamDesc(e.target.value)}
                  style={{ ...INPUT_STYLE, height: 'auto', padding: '10px 12px' }}
                  maxLength={1000}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditTeamModal(false)}
                  disabled={busyAction === 'edit-team'}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!editTeamName.trim() || busyAction === 'edit-team'}
                >
                  {busyAction === 'edit-team' ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: THÊM THÀNH VIÊN VÀO ĐỘI (LEADER ADD MEMBER DIRECTLY)
          ========================================================================= */}
      {showAddMemberModal && myTeam && (
        <div style={MODAL_BACKDROP}>
          <div style={{ ...MODAL_PANEL, maxWidth: 560 }}>
            <div style={MODAL_HEADER}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                  Thêm Thành Viên Vào Đội "{myTeam.name}"
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 14, position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  value={addMemberSearch}
                  onChange={(e) => setAddMemberSearch(e.target.value)}
                  placeholder="Tìm đồng nghiệp chưa có đội..."
                  style={{ ...INPUT_STYLE, paddingLeft: 38 }}
                />
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10 }}>
                Đồng nghiệp sẵn sàng gia nhập ({unassignedColleagues.length})
              </div>

              <div style={{ maxHeight: 320, overflowY: 'auto', display: 'grid', gap: 8, paddingRight: 4 }}>
                {unassignedColleagues.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: 13 }}>
                    Không có đồng nghiệp nào chưa thuộc đội phù hợp.
                  </div>
                ) : (
                  unassignedColleagues.map((colleague) => {
                    const cId = userIdOf(colleague);
                    return (
                      <div
                        key={cId}
                        style={{
                          border: '1px solid rgba(15,23,42,0.08)',
                          padding: '10px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          background: '#ffffff',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <Avatar user={colleague} size={36} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <strong style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>
                                {colleague.name || colleague.email}
                              </strong>
                              {isVerified(colleague) && <VerifiedBadge size={13} />}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <JobTitleBadge title={colleague.jobTitle} size="sm" />
                              {colleague.department && (
                                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>
                                  · {colleague.department}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busyAction === `add:${cId}`}
                          onClick={() => handleDirectAddMember(colleague)}
                          style={{ minHeight: 30, fontSize: 12, fontWeight: 800, padding: '0 12px' }}
                        >
                          {busyAction === `add:${cId}` ? 'Đang thêm...' : '+ Thêm vào đội'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, borderTop: '1px solid rgba(15,23,42,0.08)', paddingTop: 14 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddMemberModal(false)}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function KeyRoundIcon(props) {
  return <Shield {...props} />;
}

const MODAL_BACKDROP = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(15,23,42,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: 16,
};

const MODAL_PANEL = {
  background: '#ffffff',
  width: '100%',
  maxWidth: 480,
  borderRadius: 10,
  overflow: 'hidden',
  border: '1px solid rgba(15,23,42,0.15)',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
};

const MODAL_HEADER = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: '1px solid rgba(15,23,42,0.08)',
  background: '#f8fafc',
};

const LABEL_STYLE = {
  display: 'block',
  fontSize: 12,
  fontWeight: 800,
  color: '#0f172a',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const INPUT_STYLE = {
  width: '100%',
  height: 40,
  padding: '0 12px',
  border: '1px solid rgba(15,23,42,0.16)',
  background: '#ffffff',
  fontSize: 13,
  fontWeight: 600,
  color: '#0f172a',
  outline: 'none',
  borderRadius: 8,
};
