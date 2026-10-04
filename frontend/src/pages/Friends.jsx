import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { getCached, setCached, fetchWithCache, createCacheKey, CACHE_KEYS, CACHE_TTL, isDeepEqual } from '../services/cache';

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
      fontWeight: 700,
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
      fontWeight: 600,
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

  const rawCachedMembers = getCached(createCacheKey('friends:members', { page: 1, limit: 50 })) || getCached('friends:members');
  const cachedMembers = Array.isArray(rawCachedMembers)
    ? rawCachedMembers
    : Array.isArray(rawCachedMembers?.data)
      ? rawCachedMembers.data
      : [];

  const rawCachedMyTeam = getCached('friends:myTeam');
  const cachedMyTeam = Array.isArray(rawCachedMyTeam)
    ? rawCachedMyTeam[0] || null
    : Array.isArray(rawCachedMyTeam?.data)
      ? rawCachedMyTeam.data[0] || null
      : rawCachedMyTeam || null;

  const rawCachedAllTeams = getCached('friends:allTeams');
  const cachedAllTeams = Array.isArray(rawCachedAllTeams)
    ? rawCachedAllTeams
    : Array.isArray(rawCachedAllTeams?.data)
      ? rawCachedAllTeams.data
      : [];

  const rawCachedRankingRows = getCached('friends:rankingRows');
  const cachedRankingRows = Array.isArray(rawCachedRankingRows)
    ? rawCachedRankingRows
    : Array.isArray(rawCachedRankingRows?.items)
      ? rawCachedRankingRows.items
      : Array.isArray(rawCachedRankingRows?.data)
        ? rawCachedRankingRows.data
        : [];

  const hasInitialCache = Boolean(cachedMembers.length > 0 || cachedAllTeams.length > 0 || cachedRankingRows.length > 0);

  // Data States
  const [memberList, setMemberList] = useState(() => cachedMembers);
  const [memberPagination, setMemberPagination] = useState({ page: 1, limit: 50, total: cachedMembers.length, totalPages: 1 });
  const [myTeam, setMyTeam] = useState(() => cachedMyTeam);
  const [allTeams, setAllTeams] = useState(() => cachedAllTeams);
  const [rankingRows, setRankingRows] = useState(() => cachedRankingRows);
  
  // Filter States (Directory)
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [teamStatusFilter, setTeamStatusFilter] = useState('all'); // 'all' | 'has_team' | 'no_team'

  // Status & Busy States
  const [loading, setLoading] = useState(!hasInitialCache);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState('');

  // Modals
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [newTeamLeaderId, setNewTeamLeaderId] = useState('');
  const [newTeamMemberIds, setNewTeamMemberIds] = useState([]);
  const [newTeamAssignSelf, setNewTeamAssignSelf] = useState(false);
  const [newTeamMemberSearch, setNewTeamMemberSearch] = useState('');
  const [allTeamsSearchQuery, setAllTeamsSearchQuery] = useState('');

  const [titleModalUser, setTitleModalUser] = useState(null);
  const [titleForm, setTitleForm] = useState({
    jobTitle: '',
    isLeader: false,
    isVerified: false,
    awardType: 'none',
    awardReason: '',
  });
  const [savingTitle, setSavingTitle] = useState(false);

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
    if (background || hasInitialCache) setRefreshing(true);
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

      const cacheKeyUsers = createCacheKey('friends:members', searchParams);

      const [usersRes, groupsRes, allTeamsRes, rankingRes] = await Promise.allSettled([
        fetchWithCache(cacheKeyUsers, () => usersApi.list(searchParams), { ttl: CACHE_TTL.MEDIUM, force: background }),
        fetchWithCache('friends:myTeam', () => groupsApi.list(), { ttl: CACHE_TTL.STATIC, force: background }),
        fetchWithCache('friends:allTeams', () => groupsApi.listAll(), { ttl: CACHE_TTL.STATIC, force: background }),
        fetchWithCache('friends:rankingRows', () => rankingsApi.getIndividuals({ limit: 50 }), { ttl: CACHE_TTL.MEDIUM, force: background }),
      ]);

      if (usersRes.status === 'fulfilled') {
        const uData = usersRes.value?.data || [];
        setMemberList((prev) => (isDeepEqual(prev, uData) ? prev : uData));
        if (usersRes.value?.pagination) {
          setMemberPagination((prev) => (isDeepEqual(prev, usersRes.value.pagination) ? prev : usersRes.value.pagination));
        }
      }

      if (groupsRes.status === 'fulfilled') {
        const groups = groupsRes.value?.data || [];
        const foundTeam = groups.length > 0 ? groups[0] : null;
        setMyTeam((prev) => (isDeepEqual(prev, foundTeam) ? prev : foundTeam));
      }

      if (allTeamsRes.status === 'fulfilled') {
        const allT = allTeamsRes.value?.data || [];
        setAllTeams((prev) => (isDeepEqual(prev, allT) ? prev : allT));
      }

      if (rankingRes.status === 'fulfilled') {
        const ranks = rankingRes.value?.items || rankingRes.value?.data || rankingRes.value?.individuals || [];
        const safeRanks = Array.isArray(ranks) ? ranks : [];
        setRankingRows((prev) => (isDeepEqual(prev, safeRanks) ? prev : safeRanks));
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Không thể tải dữ liệu thành viên & đội nhóm';
      setError(msg);
      toast(msg, { type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, departmentFilter, teamStatusFilter, hasInitialCache, toast]);

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

  // Real-time user & team modification listener
  useEffect(() => {
    const handleUserUpdate = (event) => {
      const payload = event.detail;
      const updatedUser = payload?.user || payload;
      const targetId = String(payload?.userId || updatedUser?.id || '');
      if (!targetId) return;

      setMemberList((prev) =>
        prev.map((m) => {
          if (userIdOf(m) === targetId) {
            return {
              ...m,
              ...updatedUser,
              name: updatedUser.name || m.name,
              jobTitle: updatedUser.jobTitle !== undefined ? updatedUser.jobTitle : m.jobTitle,
              department: updatedUser.department !== undefined ? updatedUser.department : m.department,
              teamId: updatedUser.teamId !== undefined ? updatedUser.teamId : m.teamId,
              teamName: updatedUser.teamName !== undefined ? updatedUser.teamName : m.teamName,
              isVerified: updatedUser.isVerified !== undefined ? updatedUser.isVerified : m.isVerified,
              isDev: updatedUser.isDev !== undefined ? updatedUser.isDev : m.isDev,
              avatarData: updatedUser.avatarData !== undefined ? updatedUser.avatarData : m.avatarData,
            };
          }
          return m;
        })
      );

      setRankingRows((prev) =>
        prev.map((r) => {
          if (String(r.userId || r.id) === targetId) {
            return {
              ...r,
              userName: updatedUser.name || r.userName,
              userAvatar: updatedUser.avatarData !== undefined ? updatedUser.avatarData : r.userAvatar,
              avatarData: updatedUser.avatarData !== undefined ? updatedUser.avatarData : r.avatarData,
              teamId: updatedUser.teamId !== undefined ? updatedUser.teamId : r.teamId,
              teamName: updatedUser.teamName !== undefined ? updatedUser.teamName : r.teamName,
              jobTitle: updatedUser.jobTitle !== undefined ? updatedUser.jobTitle : r.jobTitle,
            };
          }
          return r;
        })
      );
    };

    const handleTeamUpdate = () => {
      loadData();
    };

    window.addEventListener('workrank:user-updated', handleUserUpdate);
    window.addEventListener('workrank:team-updated', handleTeamUpdate);
    return () => {
      window.removeEventListener('workrank:user-updated', handleUserUpdate);
      window.removeEventListener('workrank:team-updated', handleTeamUpdate);
    };
  }, [loadData]);

  // Handle Team Actions
  const handleCreateTeam = async (e) => {
    e?.preventDefault?.();
    if (!isAdmin) {
      toast.warning('Chỉ Quản trị viên (Admin) mới có quyền tạo đội nhóm.');
      return;
    }
    if (!newTeamName.trim()) {
      toast.warning('Vui lòng nhập tên đội nhóm');
      return;
    }
    setBusyAction('create-team');
    try {
      const payload = {
        name: newTeamName.trim(),
        description: newTeamDesc.trim() || undefined,
        ownerId: newTeamLeaderId ? Number(newTeamLeaderId) : undefined,
        assignToUser: Boolean(newTeamAssignSelf),
      };
      if (newTeamMemberIds.length > 0) {
        payload.memberIds = newTeamMemberIds.map(Number);
      }
      const res = await groupsApi.create(payload);
      toast.success(`Đã tạo đội "${res.data?.name || newTeamName}" thành công!`);
      setShowCreateTeamModal(false);
      setNewTeamName('');
      setNewTeamDesc('');
      setNewTeamLeaderId('');
      setNewTeamMemberIds([]);
      setNewTeamAssignSelf(false);
      setNewTeamMemberSearch('');
      await loadData({ background: true });
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể tạo đội nhóm'));
    } finally {
      setBusyAction('');
    }
  };

  const openTitleModal = (member) => {
    const isMemberLeader = String(myTeam?.ownerId || myTeam?.owner_id || '') === userIdOf(member);
    setTitleModalUser(member);
    setTitleForm({
      jobTitle: member.jobTitle || 'Nhân viên',
      isLeader: isMemberLeader,
      isVerified: Boolean(isVerified(member)),
      awardType: 'none',
      awardReason: '',
    });
  };

  const handleSaveTitle = async (e) => {
    e?.preventDefault?.();
    if (!titleModalUser) return;
    setSavingTitle(true);
    try {
      const targetId = userIdOf(titleModalUser);
      // 1. Update Job Profile & Verified status
      await usersApi.adminUpdateJobProfile(targetId, {
        jobTitle: titleForm.jobTitle.trim(),
        isVerified: titleForm.isVerified,
        reason: 'Admin setup danh hiệu và chức danh đội nhóm',
      });

      // 2. Set / update leader if changed
      if (myTeam?.id) {
        if (titleForm.isLeader) {
          await groupsApi.update(myTeam.id, { ownerId: Number(targetId) });
        } else {
          const wasLeader = String(myTeam.ownerId || myTeam.owner_id || '') === String(targetId);
          if (wasLeader) {
            await groupsApi.update(myTeam.id, { ownerId: null });
          }
        }
      }

      // 3. Award MVP / Champion if selected
      if (titleForm.awardType === 'MVP') {
        await usersApi.adminAwardMVP({
          userId: Number(targetId),
          title: `MVP - ${titleForm.jobTitle || 'Xuất Sắc'}`,
          reason: titleForm.awardReason.trim() || 'Admin trao thưởng danh hiệu xuất sắc của đội nhóm',
        });
        toast.success(`Đã trao danh hiệu MVP cho ${titleModalUser.name}!`);
      } else if (titleForm.awardType === 'Champion') {
        await usersApi.adminAwardChampion({
          userId: Number(targetId),
          title: `Vô Địch - ${myTeam?.name || 'Đội Nhóm'}`,
          reason: titleForm.awardReason.trim() || 'Admin trao danh hiệu Quán quân đội nhóm',
        });
        toast.success(`Đã trao danh hiệu Champion cho ${titleModalUser.name}!`);
      }

      toast.success(`Đã cập nhật danh hiệu cho ${titleModalUser.name}!`);
      setTitleModalUser(null);
      await loadData({ background: true });
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể cập nhật danh hiệu'));
    } finally {
      setSavingTitle(false);
    }
  };

  const handleJoinTeam = async (e) => {
    e?.preventDefault?.();
    if (!joinInviteCode.trim()) {
      toast.warning('Vui lòng nhập mã mời đội');
      return;
    }
    setBusyAction('join-team');
    try {
      const res = await groupsApi.join(joinInviteCode.trim());
      toast.success(`Gia nhập đội "${res.data?.name}" thành công!`);
      setShowJoinModal(false);
      setJoinInviteCode('');
      await loadData({ background: true });
    } catch (err) {
      toast.error(parseApiError(err, 'Mã mời không hợp lệ hoặc đã hết hạn'));
    } finally {
      setBusyAction('');
    }
  };

  const handleEditTeam = async (e) => {
    e?.preventDefault?.();
    if (!myTeam) return;
    if (!editTeamName.trim()) {
      toast.warning('Tên đội không được để trống');
      return;
    }
    setBusyAction('edit-team');
    try {
      await groupsApi.update(myTeam.id, {
        name: editTeamName.trim(),
        description: editTeamDesc.trim() || undefined,
      });
      toast.success('Đã cập nhật thông tin đội thành công!');
      setShowEditTeamModal(false);
      await loadData({ background: true });
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể cập nhật thông tin đội'));
    } finally {
      setBusyAction('');
    }
  };

  const handleLeaveTeam = async () => {
    if (!myTeam) return;
    if (isTeamLeader && myTeam.memberCount > 1) {
      toast.warning('Trưởng nhóm phải giải tán đội hoặc chuyển quyền trước khi rời đội.');
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
        toast.success(`Đã giải tán đội "${myTeam.name}".`);
      } else {
        await groupsApi.leave(myTeam.id);
        toast.success(`Bạn đã rời đội "${myTeam.name}".`);
      }
      await loadData({ background: true });
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể rời đội'));
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
      toast.success(`Đã giải tán đội "${myTeam.name}".`);
      await loadData({ background: true });
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể giải tán đội'));
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
      toast.success(`Đã đưa ${member.name || 'thành viên'} ra khỏi đội.`);
      await loadData({ background: true });
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể xóa thành viên'));
    } finally {
      setBusyAction('');
    }
  };

  const handleDirectAddMember = async (targetUser) => {
    if (!myTeam) {
      toast.warning('Bạn chưa có đội để thêm thành viên. Hãy tạo đội trước.');
      return;
    }
    const targetId = userIdOf(targetUser);
    setBusyAction(`add:${targetId}`);
    try {
      await groupsApi.addMember(myTeam.id, targetId);
      toast.success(`Đã thêm ${targetUser.name || 'đồng nghiệp'} vào đội "${myTeam.name}"!`);
      await loadData({ background: true });
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể thêm thành viên vào đội'));
    } finally {
      setBusyAction('');
    }
  };

  const handleCopyInviteCode = () => {
    if (!myTeam?.inviteCode && !myTeam?.invite_code) return;
    const code = myTeam.inviteCode || myTeam.invite_code;
    navigator.clipboard.writeText(code);
    toast.success(`Đã sao chép mã mời: ${code}`);
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
            {isAdmin && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setNewTeamName('');
                  setNewTeamDesc('');
                  setNewTeamLeaderId('');
                  setNewTeamMemberIds([]);
                  setNewTeamAssignSelf(false);
                  setNewTeamMemberSearch('');
                  setShowCreateTeamModal(true);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                title="Quản trị viên: Tạo đội nhóm mới cho công ty"
              >
                <Plus size={14} />
                Tạo đội mới
              </button>
            )}
            {!myTeam ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowJoinModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <KeyRoundIcon size={14} />
                Nhập mã mời
              </button>
            ) : canManageTeam ? (
              <button
                type="button"
                className="btn btn-secondary"
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
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tổng nhân sự công ty
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
              {memberPagination.total || memberList.length} <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>người</span>
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
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Trực tuyến / Hoạt động
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a', marginTop: 2 }}>
              {onlineCount} <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>đang online</span>
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
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Đội nhóm của bạn
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Vai trò trong đội
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: isTeamLeader ? '#d97706' : '#0f172a', marginTop: 2 }}>
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
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'directory' ? '3px solid #0f172a' : '3px solid transparent',
            background: 'transparent',
            color: activeTab === 'directory' ? '#0f172a' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2,
            transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease',
          }}
        >
          <Users size={16} />
          Danh Bạ Đồng Nghiệp
          <span style={{
            fontSize: 11,
            fontWeight: 600,
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
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'team' ? '3px solid #0f172a' : '3px solid transparent',
            background: 'transparent',
            color: activeTab === 'team' ? '#0f172a' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2,
            transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease',
          }}
        >
          <Shield size={16} />
          Đội Nhóm Của Tôi
          {myTeam && (
            <span style={{
              fontSize: 11,
              fontWeight: 600,
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
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'leaderboard' ? '3px solid #0f172a' : '3px solid transparent',
            background: 'transparent',
            color: activeTab === 'leaderboard' ? '#0f172a' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2,
            transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease',
          }}
        >
          <Trophy size={16} />
          BXH Thành Viên
        </button>
      </div>

      {/* Main Tab Content */}
      <TabTransition key={activeTab} minHeight={420}>
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
                                  fontWeight: 600,
                                  color: '#0f172a',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {member.name || member.email || `Thành viên #${mId}`}
                                </strong>
                                {isVerified(member) && <VerifiedBadge size={14} />}
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8', marginTop: 2 }}>
                                {formatMemberCode(member)} {isSelf && <span style={{ color: '#0284c7', fontWeight: 600 }}>· Bạn</span>}
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
                              fontWeight: 600,
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
                                fontWeight: 600,
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
                            <span style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8' }}>
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
                          style={{ flex: 1, minHeight: 32, fontSize: 12, fontWeight: 600, padding: '0 10px' }}
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
                            style={{ minHeight: 32, fontSize: 12, fontWeight: 600, padding: '0 10px', background: '#0284c7' }}
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
                          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                            {myTeam.name}
                          </h2>
                          <span style={{
                            fontSize: 12,
                            fontWeight: 600,
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, fontSize: 12, fontWeight: 500, color: '#64748b' }}>
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
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                          Mã mời:
                        </span>
                        <strong style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', letterSpacing: '0.05em' }}>
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
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
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
                                <strong style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                                  {m.name || m.email || `Thành viên #${memberId}`}
                                </strong>
                                {isVerified(m) && <VerifiedBadge size={14} />}
                                {isMemberLeader && (
                                  <span style={{
                                    fontSize: 10,
                                    fontWeight: 600,
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

                            {isAdmin && (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => openTitleModal(m)}
                                style={{
                                  minHeight: 30,
                                  padding: '0 10px',
                                  fontSize: 12,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  color: '#b45309',
                                  borderColor: 'rgba(180,83,9,0.3)',
                                  background: 'rgba(180,83,9,0.04)',
                                }}
                                title="Thiết lập danh hiệu, chức danh và đặc quyền thành viên"
                              >
                                <Award size={13} />
                                Danh hiệu
                              </button>
                            )}

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
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                  Bạn Chưa Thuộc Đội Nhóm Nào
                </h2>
                <p style={{ fontSize: 14, color: '#64748b', maxWidth: 540, margin: '0 auto 24px auto', lineHeight: 1.5 }}>
                  {isAdmin
                    ? 'Bạn là Quản trị viên (Admin). Bạn có thể tạo đội nhóm mới, phân bổ nhân sự và thiết lập danh hiệu thi đua.'
                    : 'Đội nhóm được khởi tạo và phân bổ bởi Quản trị viên (Admin). Hãy liên hệ Admin để được thêm vào đội hoặc gia nhập bằng mã mời từ trưởng nhóm.'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        setNewTeamName('');
                        setNewTeamDesc('');
                        setNewTeamLeaderId('');
                        setNewTeamMemberIds([]);
                        setNewTeamAssignSelf(false);
                        setNewTeamMemberSearch('');
                        setShowCreateTeamModal(true);
                      }}
                      style={{ minHeight: 40, padding: '0 20px', fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    >
                      <Plus size={16} />
                      Tạo đội mới (Quản trị viên)
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowJoinModal(true)}
                    style={{ minHeight: 40, padding: '0 20px', fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                  >
                    <KeyRoundIcon size={16} />
                    Gia nhập bằng mã mời
                  </button>
                </div>
              </div>
            )}

            {/* Company Teams Showcase - ALWAYS VISIBLE TO ALL USERS & ADMIN */}
            <div style={{
              background: '#ffffff',
              border: '1px solid rgba(15,23,42,0.1)',
              padding: 24,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Các Đội Nhóm Trong Công Ty ({allTeams.length})
                  </h3>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0 0' }}>
                    {isAdmin
                      ? 'Quản trị viên có thể tạo thêm đội nhóm mới và chỉ định nhân sự bất kỳ lúc nào mà không làm ảnh hưởng đến đội nhóm hiện tại của mình.'
                      : 'Mạng lưới các đội nhóm thi đua và sản xuất trong toàn bộ hệ thống.'}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', width: 220 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      value={allTeamsSearchQuery}
                      onChange={(e) => setAllTeamsSearchQuery(e.target.value)}
                      placeholder="Tìm kiếm đội nhóm..."
                      style={{ ...INPUT_STYLE, paddingLeft: 30, fontSize: 12, height: 34 }}
                    />
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        setNewTeamName('');
                        setNewTeamDesc('');
                        setNewTeamLeaderId('');
                        setNewTeamMemberIds([]);
                        setNewTeamAssignSelf(false);
                        setNewTeamMemberSearch('');
                        setShowCreateTeamModal(true);
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, minHeight: 34 }}
                    >
                      <Plus size={14} />
                      Tạo đội mới
                    </button>
                  )}
                </div>
              </div>

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
                  {allTeams
                    .filter((team) => {
                      if (!allTeamsSearchQuery.trim()) return true;
                      const q = allTeamsSearchQuery.toLowerCase();
                      return (
                        (team.name && team.name.toLowerCase().includes(q)) ||
                        (team.description && team.description.toLowerCase().includes(q)) ||
                        (team.owner?.name && team.owner.name.toLowerCase().includes(q))
                      );
                    })
                    .map((team) => {
                      const isCurrentTeam = String(myTeam?.id || '') === String(team.id);
                      return (
                        <div
                          key={team.id}
                          style={{
                            border: isCurrentTeam ? '2px solid #0284c7' : '1px solid rgba(15,23,42,0.08)',
                            padding: 16,
                            background: isCurrentTeam ? '#f0f9ff' : '#ffffff',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: 12,
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <strong style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
                                  {team.name}
                                </strong>
                                {isCurrentTeam && (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '1px 6px' }}>
                                    Đội của bạn
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#0284c7', background: 'rgba(2,132,199,0.08)', padding: '2px 8px' }}>
                                {team.memberCount || 0} thành viên
                              </span>
                            </div>
                            {team.description && (
                              <p style={{ fontSize: 12, color: '#64748b', marginTop: 6, marginBottom: 0 }}>
                                {team.description}
                              </p>
                            )}
                            {team.owner && (
                              <div style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8', marginTop: 8 }}>
                                👑 Trưởng nhóm: <strong style={{ color: '#475569' }}>{team.owner.name || team.owner.email}</strong>
                              </div>
                            )}
                          </div>
                          
                          <div style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#64748b',
                            borderTop: '1px dashed rgba(15,23,42,0.08)',
                            paddingTop: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}>
                            {isAdmin && team.inviteCode ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ color: '#0284c7' }}>Mã: {team.inviteCode}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(team.inviteCode);
                                    toast.success(`Đã sao chép mã mời của đội "${team.name}"!`);
                                  }}
                                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#0284c7', padding: 0 }}
                                  title="Sao chép mã mời"
                                >
                                  <Copy size={13} />
                                </button>
                              </div>
                            ) : (
                              <span>Liên hệ Trưởng nhóm để nhận mã mời</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
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
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>
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
                    <tr style={{ borderBottom: '2px solid #0f172a', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
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
                          <td style={{ padding: '12px 12px', fontWeight: 700, fontSize: 14 }}>
                            {rank === 1 ? '🥇 1' : rank === 2 ? '🥈 2' : rank === 3 ? '🥉 3' : `#${rank}`}
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar user={rUser} size={36} />
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <strong style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
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
                                <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>
                                  {rUser.department || row.department}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            {row.teamName || rUser.teamName || (rUser.Team && rUser.Team.name) ? (
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#0284c7' }}>
                                🛡️ {row.teamName || rUser.teamName || rUser.Team?.name}
                              </span>
                            ) : (
                              <span style={{ fontSize: 12, color: '#94a3b8' }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                            <strong style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                              {fmtNum(row.points || row.score || row.seasonScore || 0)}
                            </strong>
                            <span style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8', marginLeft: 4 }}>PTS</span>
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
      {showCreateTeamModal && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-backdrop-enter"
          style={MODAL_BACKDROP}
          onClick={(e) => {
            if (e.target === e.currentTarget && busyAction !== 'create-team') {
              setShowCreateTeamModal(false);
            }
          }}
        >
          <div
            className="modal-dialog-enter"
            style={MODAL_PANEL}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={MODAL_HEADER}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
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

            <form onSubmit={handleCreateTeam} style={{ padding: 20, overflowY: 'auto', maxHeight: 'calc(90vh - 65px)' }}>
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

              <div style={{ marginBottom: 16 }}>
                <label style={LABEL_STYLE}>Mô Tả Đội (Không bắt buộc)</label>
                <textarea
                  rows={2}
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                  placeholder="Mục tiêu sản xuất, phương châm hoạt động của đội..."
                  style={{ ...INPUT_STYLE, height: 'auto', padding: '8px 12px' }}
                  maxLength={1000}
                />
              </div>

              {/* Chỉ định Trưởng nhóm */}
              <div style={{ marginBottom: 16, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.08)', padding: 12 }}>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newTeamAssignSelf}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setNewTeamAssignSelf(checked);
                        if (checked && authUser?.id) {
                          setNewTeamLeaderId(String(authUser.id));
                        } else {
                          setNewTeamLeaderId('');
                        }
                      }}
                    />
                    <span>👑 Tôi muốn gia nhập và làm Trưởng nhóm của đội này</span>
                  </label>
                </div>

                <div>
                  <label style={{ ...LABEL_STYLE, marginBottom: 4 }}>
                    {newTeamAssignSelf ? 'Trưởng nhóm được chọn: Chính bạn' : 'Chỉ Định Trưởng Nhóm Khác (Leader)'}
                  </label>
                  <select
                    value={newTeamLeaderId}
                    disabled={newTeamAssignSelf}
                    onChange={(e) => setNewTeamLeaderId(e.target.value)}
                    style={{ ...INPUT_STYLE, background: newTeamAssignSelf ? '#e2e8f0' : '#ffffff', cursor: newTeamAssignSelf ? 'not-allowed' : 'pointer' }}
                  >
                    <option value="">-- {newTeamAssignSelf ? 'Chính bạn (Admin)' : 'Chưa chỉ định (Để trống)'} --</option>
                    {memberList.map((m) => {
                      const uId = userIdOf(m) || String(m.id || '');
                      const teamLabel = m.team?.name || m.teamName || (typeof m.team === 'string' ? m.team : null);
                      return (
                        <option key={uId} value={uId}>
                          #{uId} · {m.name} ({m.jobTitle || 'Nhân viên'}) {teamLabel ? `[Đang ở ${teamLabel}]` : '[Chưa có đội]'}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Thêm thành viên ban đầu vào đội */}
              <div style={{ marginBottom: 16, border: '1px solid rgba(15,23,42,0.08)', padding: 12, background: '#ffffff' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ ...LABEL_STYLE, margin: 0 }}>
                    Chỉ Định Thành Viên Ban Đầu Vào Đội (Tùy chọn)
                  </label>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0284c7' }}>
                    Đã chọn: {newTeamMemberIds.length} người
                  </span>
                </div>

                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={newTeamMemberSearch}
                    onChange={(e) => setNewTeamMemberSearch(e.target.value)}
                    placeholder="Tìm theo tên, email, chức danh..."
                    style={{ ...INPUT_STYLE, paddingLeft: 30, fontSize: 12, height: 32 }}
                  />
                </div>

                <div style={{
                  maxHeight: 140,
                  overflowY: 'auto',
                  border: '1px solid rgba(15,23,42,0.1)',
                  background: '#f8fafc',
                  padding: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}>
                  {memberList
                    .filter((m) => {
                      const uId = userIdOf(m) || String(m.id || '');
                      if (newTeamLeaderId && String(newTeamLeaderId) === uId) return false;
                      if (!newTeamMemberSearch.trim()) return true;
                      const q = newTeamMemberSearch.toLowerCase();
                      return (
                        (m.name && m.name.toLowerCase().includes(q)) ||
                        (m.email && m.email.toLowerCase().includes(q)) ||
                        (m.jobTitle && m.jobTitle.toLowerCase().includes(q))
                      );
                    })
                    .slice(0, 50)
                    .map((m) => {
                      const uId = userIdOf(m) || String(m.id || '');
                      const isChecked = newTeamMemberIds.includes(uId);
                      const teamLabel = m.team?.name || m.teamName || (typeof m.team === 'string' ? m.team : null);
                      return (
                        <label
                          key={uId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            padding: '5px 8px',
                            background: isChecked ? '#e0f2fe' : '#ffffff',
                            border: '1px solid rgba(15,23,42,0.06)',
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewTeamMemberIds([...newTeamMemberIds, uId]);
                                } else {
                                  setNewTeamMemberIds(newTeamMemberIds.filter((id) => id !== uId));
                                }
                              }}
                            />
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>{m.name}</span>
                            <span style={{ color: '#64748b', fontSize: 11 }}>({m.jobTitle || 'Nhân viên'})</span>
                          </div>
                          <span style={{ fontSize: 10, color: teamLabel ? '#b45309' : '#16a34a', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {teamLabel ? `[${teamLabel}]` : '[Chưa có đội]'}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* Thông báo phân quyền rõ ràng */}
              <div style={{
                background: myTeam && !newTeamAssignSelf ? '#eff6ff' : '#f8fafc',
                border: '1px solid ' + (myTeam && !newTeamAssignSelf ? 'rgba(2,132,199,0.25)' : 'rgba(15,23,42,0.08)'),
                padding: 12,
                fontSize: 12,
                color: myTeam && !newTeamAssignSelf ? '#0369a1' : '#64748b',
                marginBottom: 20,
              }}>
                👑 <strong>Quản trị viên (Admin):</strong>
                {myTeam && !newTeamAssignSelf ? (
                  <span> Bạn đang tạo đội cho các nhân viên khác. Đội nhóm hiện tại của bạn (<strong>{myTeam.name}</strong>) sẽ <u>không bị ảnh hưởng</u>. Bạn vẫn có thể tiếp tục tạo thêm bao nhiêu đội nhóm tùy thích.</span>
                ) : (
                  <span> Đội nhóm mới sẽ được tạo cùng mã mời và danh sách nhân sự bạn đã chỉ định.</span>
                )}
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
        </div>,
        document.body
      )}

      {/* =========================================================================
          MODAL: SETUP DANH HIỆU & QUYỀN HẠN (TITLE SETUP MODAL - ADMIN ONLY)
          ========================================================================= */}
      {titleModalUser && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-backdrop-enter"
          style={MODAL_BACKDROP}
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingTitle) {
              setTitleModalUser(null);
            }
          }}
        >
          <div
            className="modal-dialog-enter"
            style={{ ...MODAL_PANEL, maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={MODAL_HEADER}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Award size={18} color="#b45309" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  Thiết Lập Danh Hiệu &amp; Chức Danh
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTitleModalUser(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTitle} style={{ padding: 20, overflowY: 'auto', maxHeight: 'calc(90vh - 65px)' }}>
              <div style={{ background: '#f8fafc', border: '1px solid rgba(15,23,42,0.08)', padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                  {titleModalUser.name} <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>(#{userIdOf(titleModalUser)})</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {titleModalUser.email} · Đội hiện tại: <strong>{myTeam?.name || 'Chưa có đội'}</strong>
                </div>
              </div>

              {/* 1. Chức danh công tác */}
              <div style={{ marginBottom: 16 }}>
                <label style={LABEL_STYLE}>
                  Chức Danh / Danh Hiệu Công Tác <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={titleForm.jobTitle}
                  onChange={(e) => setTitleForm({ ...titleForm, jobTitle: e.target.value })}
                  placeholder="Ví dụ: Editor, Content Creator, Trưởng phòng..."
                  style={INPUT_STYLE}
                  list="job-title-suggestions"
                />
                <datalist id="job-title-suggestions">
                  <option value="Editor" />
                  <option value="Content" />
                  <option value="Content Creator" />
                  <option value="Quản lý kênh" />
                  <option value="Trưởng nhóm" />
                  <option value="Trưởng phòng" />
                  <option value="Phó phòng" />
                  <option value="Phó giám đốc" />
                  <option value="Giám đốc" />
                  <option value="Kỹ sư hệ thống" />
                  <option value="Chuyên viên truyền thông" />
                </datalist>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {['Editor', 'Content', 'Quản lý kênh', 'Trưởng nhóm', 'Trưởng phòng'].map((title) => (
                    <button
                      key={title}
                      type="button"
                      onClick={() => setTitleForm({ ...titleForm, jobTitle: title })}
                      style={{
                        padding: '3px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        border: '1px solid rgba(15,23,42,0.12)',
                        background: titleForm.jobTitle === title ? '#0f172a' : '#ffffff',
                        color: titleForm.jobTitle === title ? '#ffffff' : '#334155',
                        cursor: 'pointer',
                      }}
                    >
                      {title}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Vai trò Trưởng nhóm & Tích xanh */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#0f172a', cursor: 'pointer', background: '#fffbeb', border: '1px solid rgba(217,119,6,0.25)', padding: '10px 12px' }}>
                  <input
                    type="checkbox"
                    checked={titleForm.isLeader}
                    onChange={(e) => setTitleForm({ ...titleForm, isLeader: e.target.checked })}
                  />
                  <span>👑 Đặt làm Trưởng nhóm</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#0f172a', cursor: 'pointer', background: '#f0fdf4', border: '1px solid rgba(22,163,74,0.25)', padding: '10px 12px' }}>
                  <input
                    type="checkbox"
                    checked={titleForm.isVerified}
                    onChange={(e) => setTitleForm({ ...titleForm, isVerified: e.target.checked })}
                  />
                  <span>🛡️ Cấp Tích Xanh (Verified)</span>
                </label>
              </div>

              {/* 3. Trao danh hiệu vinh danh mùa giải */}
              <div style={{ marginBottom: 20, border: '1px solid rgba(15,23,42,0.1)', padding: 12, background: '#fafafa' }}>
                <label style={{ ...LABEL_STYLE, marginBottom: 6 }}>
                  Trao Danh Hiệu Vinh Danh Mùa Giải (Tùy chọn)
                </label>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="awardType"
                      checked={titleForm.awardType === 'none'}
                      onChange={() => setTitleForm({ ...titleForm, awardType: 'none' })}
                    />
                    <span>Không trao giải</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: '#7c3aed', fontWeight: 600 }}>
                    <input
                      type="radio"
                      name="awardType"
                      checked={titleForm.awardType === 'MVP'}
                      onChange={() => setTitleForm({ ...titleForm, awardType: 'MVP' })}
                    />
                    <span>⭐ Trao cúp MVP</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: '#b45309', fontWeight: 600 }}>
                    <input
                      type="radio"
                      name="awardType"
                      checked={titleForm.awardType === 'Champion'}
                      onChange={() => setTitleForm({ ...titleForm, awardType: 'Champion' })}
                    />
                    <span>🏆 Trao Quán Quân (Champion)</span>
                  </label>
                </div>
                {titleForm.awardType !== 'none' && (
                  <input
                    type="text"
                    value={titleForm.awardReason}
                    onChange={(e) => setTitleForm({ ...titleForm, awardReason: e.target.value })}
                    placeholder="Lý do khen thưởng / thành tích xuất sắc..."
                    style={INPUT_STYLE}
                  />
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setTitleModalUser(null)}
                  disabled={savingTitle}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingTitle || !titleForm.jobTitle.trim()}
                >
                  {savingTitle ? 'Đang lưu...' : 'Lưu Danh Hiệu & Quyền'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================================================
          MODAL: GIA NHẬP BẰNG MÃ MỜI (JOIN TEAM)
          ========================================================================= */}
      {showJoinModal && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-backdrop-enter"
          style={MODAL_BACKDROP}
          onClick={(e) => {
            if (e.target === e.currentTarget && busyAction !== 'join-team') {
              setShowJoinModal(false);
            }
          }}
        >
          <div
            className="modal-dialog-enter"
            style={MODAL_PANEL}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={MODAL_HEADER}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyRoundIcon size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
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

            <form onSubmit={handleJoinTeam} style={{ padding: 20, overflowY: 'auto', maxHeight: 'calc(90vh - 65px)' }}>
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
                  style={{ ...INPUT_STYLE, letterSpacing: '0.08em', fontWeight: 700 }}
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
        </div>,
        document.body
      )}

      {/* =========================================================================
          MODAL: CHỈNH SỬA THÔNG TIN ĐỘI (EDIT TEAM)
          ========================================================================= */}
      {showEditTeamModal && myTeam && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-backdrop-enter"
          style={MODAL_BACKDROP}
          onClick={(e) => {
            if (e.target === e.currentTarget && busyAction !== 'edit-team') {
              setShowEditTeamModal(false);
            }
          }}
        >
          <div
            className="modal-dialog-enter"
            style={MODAL_PANEL}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={MODAL_HEADER}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
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

            <form onSubmit={handleEditTeam} style={{ padding: 20, overflowY: 'auto', maxHeight: 'calc(90vh - 65px)' }}>
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
        </div>,
        document.body
      )}

      {/* =========================================================================
          MODAL: THÊM THÀNH VIÊN VÀO ĐỘI (LEADER ADD MEMBER DIRECTLY)
          ========================================================================= */}
      {showAddMemberModal && myTeam && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-backdrop-enter"
          style={MODAL_BACKDROP}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddMemberModal(false);
            }
          }}
        >
          <div
            className="modal-dialog-enter"
            style={{ ...MODAL_PANEL, maxWidth: 560 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={MODAL_HEADER}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
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

            <div style={{ padding: 20, overflowY: 'auto', maxHeight: 'calc(90vh - 65px)' }}>
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

              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 10 }}>
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
                              <strong style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                                {colleague.name || colleague.email}
                              </strong>
                              {isVerified(colleague) && <VerifiedBadge size={13} />}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <JobTitleBadge title={colleague.jobTitle} size="sm" />
                              {colleague.department && (
                                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>
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
                          style={{ minHeight: 30, fontSize: 12, fontWeight: 600, padding: '0 12px' }}
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
        </div>,
        document.body
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
  background: 'rgba(15,23,42,0.65)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 99999,
  padding: 16,
  overflowY: 'auto',
};

const MODAL_PANEL = {
  background: '#ffffff',
  width: '100%',
  maxWidth: 480,
  maxHeight: '90vh',
  borderRadius: 10,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid rgba(15,23,42,0.15)',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
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
  fontWeight: 600,
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
