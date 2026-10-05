import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  Building2,
  ChevronRight,
  Copy,
  Crown,
  Eye,
  LogOut,
  RefreshCw,
  Search,
  Shield,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';
import JobTitleBadge from '../components/JobTitleBadge';
import { PageShell, PageHeader, EmptyState, PageState, TabTransition } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useConfirm, useToast } from '../context/UiContext';
import { parseApiError } from '../utils/errors';
import {
  groups as groupsApi,
  users as usersApi,
} from '../services/api';
import { getUserAvatar, initialsFromName } from '../utils/avatar';
import usePageVisibility from '../hooks/usePageVisibility';
import { getCached, fetchWithCache, createCacheKey, CACHE_TTL, isDeepEqual } from '../services/cache';

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

  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'team'

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

  const hasInitialCache = Boolean(cachedMembers.length > 0 || cachedAllTeams.length > 0);

  // Data States
  const [memberList, setMemberList] = useState(() => cachedMembers);
  const [memberPagination, setMemberPagination] = useState({ page: 1, limit: 50, total: cachedMembers.length, totalPages: 1 });
  const [myTeam, setMyTeam] = useState(() => cachedMyTeam);
  const [allTeams, setAllTeams] = useState(() => cachedAllTeams);
  
  // Filter States (Directory)
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [teamStatusFilter, setTeamStatusFilter] = useState('all'); // 'all' | 'has_team' | 'no_team'
  const [allTeamsSearchQuery, setAllTeamsSearchQuery] = useState('');

  // Status & Busy States
  const [loading, setLoading] = useState(!hasInitialCache);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState('');

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinInviteCode, setJoinInviteCode] = useState('');

  // Derived Values
  const isTeamLeader = useMemo(() => {
    if (!myTeam || !authUser) return false;
    return String(myTeam.ownerId || myTeam.owner_id || '') === String(authUser.id || '');
  }, [myTeam, authUser]);

  const isAdmin = authUser?.role === 'admin';

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

      const [usersRes, groupsRes, allTeamsRes] = await Promise.allSettled([
        fetchWithCache(cacheKeyUsers, () => usersApi.list(searchParams), { ttl: CACHE_TTL.MEDIUM, force: background }),
        fetchWithCache('friends:myTeam', () => groupsApi.list(), { ttl: CACHE_TTL.STATIC, force: background }),
        fetchWithCache('friends:allTeams', () => groupsApi.listAll(), { ttl: CACHE_TTL.STATIC, force: background }),
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

  const handleLeaveTeam = async () => {
    if (!myTeam) return;
    if (isTeamLeader) {
      toast.warning('Hãy liên hệ Quản trị viên để chuyển quyền trưởng nhóm trước khi rời đội.');
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
      await groupsApi.leave(myTeam.id);
      toast.success(`Bạn đã rời đội "${myTeam.name}".`);
      await loadData({ background: true });
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể rời đội'));
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

  return (
    <PageShell>
      {/* Header */}
      <PageHeader
        title="Thành Viên & Đội Nhóm"
        subtitle="Danh bạ đồng nghiệp và đội nhóm của bạn"
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
                onClick={() => navigate('/admin/teams-youtube?tab=teams')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                title="Quản lý đội nhóm và phân bổ thành viên"
              >
                <Shield size={14} />
                Quản lý đội nhóm
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
        flexWrap: 'wrap',
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
            transition: 'background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard), transform var(--motion-fast) var(--ease-standard)',
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
            transition: 'background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard), transform var(--motion-fast) var(--ease-standard)',
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
          onClick={() => navigate('/leaderboard?scope=members')}
          style={{
            padding: '12px 18px',
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            borderBottom: '3px solid transparent',
            background: 'transparent',
            color: '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: -2,
            transition: 'background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard), transform var(--motion-fast) var(--ease-standard)',
          }}
        >
          <Trophy size={16} />
          BXH Thành Viên <ChevronRight size={14} />
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
                        transition: 'border-color var(--motion-fast) var(--ease-standard)',
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
                        {isAdmin && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => navigate('/admin/teams-youtube?tab=teams')}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, minHeight: 34 }}
                          >
                            <Shield size={14} /> Quản lý đội
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary"
                          title={isTeamLeader ? 'Liên hệ Quản trị viên để chuyển quyền trưởng nhóm trước khi rời đội' : undefined}
                          onClick={handleLeaveTeam}
                          disabled={busyAction === 'leave-team' || isTeamLeader}
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
                          Rời đội
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
                                onClick={() => navigate('/admin/privileges')}
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
                                title="Quản lý hồ sơ, chức danh và đặc quyền thành viên"
                              >
                                <Award size={13} />
                                Quản lý hồ sơ
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
                      onClick={() => navigate('/admin/teams-youtube?tab=teams')}
                      style={{ minHeight: 40, padding: '0 20px', fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    >
                      <Shield size={16} />
                      Quản lý đội nhóm (Quản trị viên)
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
                      ? 'Các đội nhóm thi đua và sản xuất trong công ty.'
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
                      onClick={() => navigate('/admin/competition/seasons')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        minHeight: 34,
                        padding: '0 12px',
                        fontWeight: 600,
                        background: '#fef3c7',
                        border: '1px solid #fde68a',
                        color: '#92400e',
                        cursor: 'pointer',
                        borderRadius: 4,
                      }}
                      title="Quản lý đội nhóm & cá nhân MVP hiển thị trên Trang Chủ"
                    >
                      <Trophy size={14} color="#b45309" />
                      Vinh danh Trang Chủ
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => navigate('/admin/teams-youtube?tab=teams')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, minHeight: 34 }}
                    >
                      <Shield size={14} />
                      Quản lý đội nhóm
                    </button>
                  )}
                </div>
              </div>

              {allTeams.length === 0 ? (
                <EmptyState
                  icon={Shield}
                  title="Chưa có đội nhóm nào"
                  description="Quản trị viên sẽ tạo và phân bổ đội nhóm cho công ty."
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
                            border: isCurrentTeam
                              ? '2px solid #0284c7'
                              : '1px solid rgba(15,23,42,0.08)',
                            padding: 16,
                            background: isCurrentTeam
                              ? '#f0f9ff'
                              : '#ffffff',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: 12,
                            borderRadius: 6,
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
                                  {team.name}
                                </strong>
                                {isCurrentTeam && (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '1px 6px', borderRadius: 3 }}>
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
                            gap: 8,
                            flexWrap: 'wrap',
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
          </div>
        )}

      </TabTransition>

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
