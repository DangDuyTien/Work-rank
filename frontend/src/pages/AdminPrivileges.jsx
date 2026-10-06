import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Award,
  BadgeCheck,
  Check,
  Code,
  Edit3,
  Eye,
  Plus,
  PlusCircle,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  UserCheck,
  UserPlus,
  UserRound,
  Upload,
  Users,
  X,
} from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';
import JobTitleBadge, { CATEGORIZED_JOB_TITLES, CATEGORIZED_DEPARTMENTS } from '../components/JobTitleBadge';
import { users as usersApi, groups as groupsApi, competition } from '../services/api';
import { compressImage, getUserAvatar, initialsFromName, removeStoredAvatar, setStoredAvatar } from '../utils/avatar';
import { useToast } from '../context/UiContext';
import { useAuth } from '../context/AuthContext';
import { parseApiError } from '../utils/errors';
import MvpCupAwardModal from '../components/MvpCupAwardModal';
import { AnimatedModal } from '../components/ui';

const PAGE_SIZE = 50;

const JOB_TITLE_SUGGESTIONS = [
  'Nhân viên',
  'Editor',
  'Content Creator',
  'Quản lý kênh',
  'Trưởng phòng',
  'Phó phòng',
  'Phó giám đốc',
  'Giám đốc',
  'Kỹ sư hệ thống',
  'Chuyên viên truyền thông',
];

const DEPARTMENT_SUGGESTIONS = [
  'Media & Content',
  'Engineering Core',
  'Community & Growth',
  'Phòng Sản Xuất Video',
  'Phòng Truyền Thông',
  'Phòng Kỹ Thuật',
  'Ban Giám Đốc',
];

const CARD = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-content)',
  boxShadow: 'var(--shadow-card)',
};

const SEASON_STATUS_LABELS = {
  DRAFT: 'Bản nháp',
  SCHEDULED: 'Đã lên lịch',
  ACTIVE: 'Đang diễn ra',
  PAUSED: 'Tạm dừng',
  CALCULATING: 'Đang chốt',
  FINISHED: 'Đã kết thúc',
  ARCHIVED: 'Lưu trữ',
};

function seasonYear(season = {}) {
  const source = season.startAt || season.start_at || season.endAt || season.end_at;
  const parsedYear = source ? new Date(source).getFullYear() : NaN;
  if (Number.isFinite(parsedYear)) return parsedYear;
  const match = String(season.name || '').match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function seasonOptionLabel(season = {}) {
  const year = seasonYear(season);
  const status = SEASON_STATUS_LABELS[season.status] || season.status || 'Chưa xác định';
  return [
    year ? `Năm ${year}` : null,
    season.name || `Mùa #${season.id}`,
    `Mùa #${season.id}`,
    status,
  ].filter(Boolean).join(' · ');
}

function isVerified(user = {}) {
  return user.isVerified === true || user.verified === true || user.isVerified === 1 || user.verified === 1 || user.isVerified === '1' || user.verified === '1';
}

function isDev(user = {}) {
  return user.isDev === true || user.is_dev === true || user.isDev === 1 || user.is_dev === 1;
}

function Avatar({ user, size = 40 }) {
  const avatar = getUserAvatar(user, user?.id);
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: 'var(--radius-avatar)',
      overflow: 'hidden',
      background: 'var(--accent)',
      color: 'var(--surface)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.35,
      fontWeight: 600,
      flexShrink: 0,
    }}>
      {avatar ? <img src={avatar} alt={`Ảnh ${user?.name}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initialsFromName(user?.name || user?.email || 'U')}
    </div>
  );
}

export default function AdminPrivileges() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedUserId = searchParams.get('userId');
  const toast = useToast();
  const { user: currentUser, setUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | verified | dev | admin | unverified
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const searchTimerRef = useRef(null);
  const loadIdRef = useRef(0);
  const avatarUploadIdRef = useRef(0);

  // Modal States
  const [teamsList, setTeamsList] = useState([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    jobTitle: 'Nhân viên',
    department: 'Media & Content',
    teamId: '',
    isVerified: false,
    isDev: false,
  });
  const [creating, setCreating] = useState(false);

  const [editModalUser, setEditModalUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    bio: '',
    avatarData: '',
    role: 'user',
    jobTitle: 'Nhân viên',
    department: 'Media & Content',
    teamId: '',
    status: 'active',
    isVerified: false,
    isDev: false,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [processingAvatar, setProcessingAvatar] = useState(false);

  const [awardModalUser, setAwardModalUser] = useState(null);
  const [awardType, setAwardType] = useState('MVP');
  const [awardForm, setAwardForm] = useState({ seasonId: '', title: '', reason: '' });
  const [awardSeasons, setAwardSeasons] = useState([]);
  const [awardSeasonsLoading, setAwardSeasonsLoading] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [mvpModalOpen, setMvpModalOpen] = useState(false);

  const [detailDrawerUser, setDetailDrawerUser] = useState(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = async (searchTerm, pageNum) => {
    const id = ++loadIdRef.current;
    setLoading(true);
    try {
      const res = await usersApi.list({ search: searchTerm, page: pageNum, limit: PAGE_SIZE });
      if (id !== loadIdRef.current) return;
      const list = res.data || [];
      setUsers(list);
      setPagination(res.pagination);
    } catch (err) {
      toast.error(parseApiError(err, 'Không tải được danh sách người dùng.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    loadData('', 1);
    groupsApi.listAll().then((res) => setTeamsList(res.data || [])).catch(() => {});

    setAwardSeasonsLoading(true);
    competition.adminListSeasons()
      .then((list) => {
        if (!cancelled) setAwardSeasons(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setAwardSeasons([]);
          toast.error(parseApiError(err, 'Không tải được danh sách mùa giải.'));
        }
      })
      .finally(() => {
        if (!cancelled) setAwardSeasonsLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleUserUpdate = (event) => {
      const payload = event.detail;
      const updatedUser = payload?.user || payload;
      const targetId = String(payload?.userId || updatedUser?.id || '');
      if (!targetId) return;

      setUsers((prev) =>
        prev.map((u) => {
          if (String(u.id) === targetId) {
            return {
              ...u,
              ...updatedUser,
              name: updatedUser.name || u.name,
              jobTitle: updatedUser.jobTitle !== undefined ? updatedUser.jobTitle : u.jobTitle,
              department: updatedUser.department !== undefined ? updatedUser.department : u.department,
              teamId: updatedUser.teamId !== undefined ? updatedUser.teamId : u.teamId,
              teamName: updatedUser.teamName !== undefined ? updatedUser.teamName : u.teamName,
              isVerified: updatedUser.isVerified !== undefined ? updatedUser.isVerified : u.isVerified,
              isDev: updatedUser.isDev !== undefined ? updatedUser.isDev : u.isDev,
              avatarData: updatedUser.avatarData !== undefined ? updatedUser.avatarData : u.avatarData,
            };
          }
          return u;
        })
      );
    };

    const handleUserDeleted = (event) => {
      const payload = event.detail;
      const targetId = String(payload?.userId || payload?.id || '');
      if (!targetId) return;
      setUsers((prev) => prev.filter((u) => String(u.id) !== targetId));
      if (detailDrawerUser && String(detailDrawerUser.id) === targetId) {
        setDetailDrawerUser(null);
      }
    };

    window.addEventListener('workrank:user-updated', handleUserUpdate);
    window.addEventListener('workrank:user-deleted', handleUserDeleted);
    return () => {
      window.removeEventListener('workrank:user-updated', handleUserUpdate);
      window.removeEventListener('workrank:user-deleted', handleUserDeleted);
    };
  }, [detailDrawerUser]);

  const onSearchChange = (event) => {
    const value = event.target.value;
    setQuery(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setPage(1);
      loadData(value, 1);
    }, 400);
  };

  useEffect(() => {
    return () => clearTimeout(searchTimerRef.current);
  }, []);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      const haystack = `${user.name || ''} ${user.email || ''} WR-${String(user.id || '').padStart(4, '0')}`.toLowerCase();
      if (needle && !haystack.includes(needle)) return false;
      if (filter === 'verified') return isVerified(user);
      if (filter === 'dev') return isDev(user);
      if (filter === 'admin') return user.role === 'admin';
      if (filter === 'unverified') return !isVerified(user) && !isDev(user);
      return true;
    });
  }, [filter, query, users]);

  const setUserSaving = (userId, value) => {
    setSaving((current) => ({ ...current, [String(userId)]: value }));
  };

  const toggleVerified = async (user) => {
    const userId = String(user.id);
    const next = !isVerified(user);
    setUserSaving(userId, true);
    setUsers((current) => current.map((item) => (
      String(item.id) === userId ? { ...item, isVerified: next, verified: next } : item
    )));
    try {
      await usersApi.update(user.id, { isVerified: next });
      toast.success(next ? `Đã cấp tích xanh cho ${user.name}.` : `Đã gỡ tích xanh của ${user.name}.`);
    } catch (err) {
      setUsers((current) => current.map((item) => (
        String(item.id) === userId ? { ...item, isVerified: !next, verified: !next } : item
      )));
      toast.error(parseApiError(err, 'Không cập nhật được tích xanh.'));
    } finally {
      setUserSaving(userId, false);
    }
  };

  const toggleDevBadge = async (user) => {
    const userId = String(user.id);
    const next = !isDev(user);
    setUserSaving(userId, true);
    setUsers((current) => current.map((item) => (
      String(item.id) === userId ? { ...item, isDev: next } : item
    )));
    try {
      await usersApi.update(user.id, { isDev: next });
      toast.success(next ? `Đã cấp huy hiệu Dev cho ${user.name}.` : `Đã gỡ huy hiệu Dev của ${user.name}.`);
    } catch (err) {
      setUsers((current) => current.map((item) => (
        String(item.id) === userId ? { ...item, isDev: !next } : item
      )));
      toast.error(parseApiError(err, 'Không cập nhật được huy hiệu Dev.'));
    } finally {
      setUserSaving(userId, false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      toast.warning('Vui lòng điền đầy đủ họ tên, email và mật khẩu.');
      return;
    }
    setCreating(true);
    try {
      await usersApi.create({
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        password: createForm.password.trim(),
        role: createForm.role,
        jobTitle: createForm.jobTitle.trim(),
        department: createForm.department.trim(),
        teamId: createForm.teamId ? Number(createForm.teamId) : undefined,
        isVerified: createForm.isVerified,
        isDev: createForm.isDev,
      });
      toast.success(`Đã tạo thành công nhân sự ${createForm.name}!`);
      setCreateModalOpen(false);
      setCreateForm({
        name: '',
        email: '',
        password: '',
        role: 'user',
        jobTitle: 'Nhân viên',
        department: 'Media & Content',
        teamId: '',
        isVerified: false,
        isDev: false,
      });
      loadData(query, 1);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể tạo nhân sự mới.'));
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = useCallback((user) => {
    avatarUploadIdRef.current += 1;
    setProcessingAvatar(false);
    setEditModalUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      bio: user.bio || '',
      avatarData: user.avatarData || '',
      role: user.role || 'user',
      jobTitle: user.jobTitle || 'Nhân viên',
      department: user.department || 'Media & Content',
      teamId: user.teamId ? String(user.teamId) : '',
      status: user.accountStatus || user.status || 'active',
      isVerified: isVerified(user),
      isDev: isDev(user),
    });
  }, []);

  useEffect(() => {
    if (!requestedUserId) {
      setEditModalUser(null);
      return;
    }
    const targetId = Number(requestedUserId);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      toast.error('Mã nhân sự không hợp lệ.');
      return;
    }
    let cancelled = false;
    usersApi.get(targetId).then((res) => {
      if (!cancelled) openEditModal(res.data);
    }).catch((err) => {
      if (!cancelled) toast.error(parseApiError(err, 'Không tải được hồ sơ nhân sự.'));
    });
    return () => { cancelled = true; };
  }, [openEditModal, requestedUserId, toast]);

  const closeEditModal = () => {
    avatarUploadIdRef.current += 1;
    setProcessingAvatar(false);
    setEditModalUser(null);
    if (!requestedUserId) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('userId');
    setSearchParams(nextParams, { replace: true });
  };

  const handleAvatarFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const uploadId = ++avatarUploadIdRef.current;
    setProcessingAvatar(true);
    try {
      const avatarData = await compressImage(file, 400, 400, 0.85);
      if (uploadId === avatarUploadIdRef.current) {
        setEditForm((prev) => ({ ...prev, avatarData }));
      }
    } catch (err) {
      if (uploadId === avatarUploadIdRef.current) toast.error(parseApiError(err, 'Không thể xử lý ảnh đại diện.'));
    } finally {
      if (uploadId === avatarUploadIdRef.current) setProcessingAvatar(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editModalUser || processingAvatar) return;
    if (!editForm.name.trim() || !editForm.email.trim()) {
      toast.warning('Tên và email không được để trống.');
      return;
    }
    setSavingEdit(true);
    try {
      const res = await usersApi.update(editModalUser.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        bio: editForm.bio.trim(),
        avatarData: editForm.avatarData || null,
        role: editForm.role,
        jobTitle: editForm.jobTitle.trim(),
        department: editForm.department.trim(),
        teamId: editForm.teamId ? Number(editForm.teamId) : null,
        status: editForm.status,
        isVerified: editForm.isVerified,
        isDev: editForm.isDev,
      });
      const updated = { ...(res.data || {}), avatarData: editForm.avatarData || null };
      if (updated.avatarData) setStoredAvatar(editModalUser.id, updated.avatarData);
      else removeStoredAvatar(editModalUser.id);
      if (String(currentUser?.id) === String(editModalUser.id)) {
        setUser((prev) => ({ ...prev, ...updated }));
      }
      const matchedTeam = teamsList.find((t) => String(t.id) === String(editForm.teamId));
      setUsers((current) => current.map((item) => (
        item.id === editModalUser.id ? {
          ...item,
          ...editForm,
          ...updated,
          teamId: editForm.teamId ? Number(editForm.teamId) : null,
          teamName: matchedTeam ? matchedTeam.name : (editForm.teamId ? (updated.teamName || item.teamName) : null),
        } : item
      )));
      if (detailDrawerUser?.id === editModalUser.id) {
        setDetailDrawerUser((prev) => ({
          ...prev,
          ...editForm,
          ...updated,
          teamId: editForm.teamId ? Number(editForm.teamId) : null,
          teamName: matchedTeam ? matchedTeam.name : (editForm.teamId ? (updated.teamName || prev.teamName) : null),
        }));
      }
      toast.success(`Đã cập nhật hồ sơ của ${editForm.name}!`);
      closeEditModal();
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể cập nhật hồ sơ.'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    if (String(deleteConfirmUser.id) === String(currentUser?.id)) {
      toast.error('Admin không thể tự xóa tài khoản của chính mình qua quản trị người dùng. Nếu muốn xóa tài khoản, vui lòng vào Cài đặt.');
      setDeleteConfirmUser(null);
      return;
    }
    setDeleting(true);
    try {
      await usersApi.delete(deleteConfirmUser.id);
      setUsers((current) => current.filter((item) => item.id !== deleteConfirmUser.id));
      if (detailDrawerUser?.id === deleteConfirmUser.id) {
        setDetailDrawerUser(null);
      }
      toast.success(`Đã xóa tài khoản nhân sự ${deleteConfirmUser.name}.`);
      setDeleteConfirmUser(null);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể xóa nhân sự.'));
    } finally {
      setDeleting(false);
    }
  };

  const openAwardModal = (user, type) => {
    setAwardModalUser(user);
    setAwardType(type);
    setAwardForm({ seasonId: '', title: '', reason: '' });
  };

  const submitAward = async (e) => {
    e.preventDefault();
    if (!awardModalUser) return;
    if (!awardForm.seasonId) {
      toast.warning('Vui lòng chọn đúng năm và mùa giải trước khi trao thưởng.');
      return;
    }
    if (!awardForm.reason.trim()) {
      toast.warning('Hãy nhập lý do vinh danh.');
      return;
    }

    setAwarding(true);
    try {
      if (awardType === 'MVP') {
        await usersApi.adminAwardMVP({
          userId: awardModalUser.id,
          seasonId: Number(awardForm.seasonId),
          title: awardForm.title.trim() || undefined,
          reason: awardForm.reason.trim(),
        });
        toast.success(`Đã trao giải MVP cho ${awardModalUser.name}!`);
      } else {
        await usersApi.adminAwardChampion({
          userId: awardModalUser.id,
          seasonId: Number(awardForm.seasonId),
          title: awardForm.title.trim() || undefined,
          reason: awardForm.reason.trim(),
        });
        toast.success(`Đã trao danh hiệu Champion cho ${awardModalUser.name}!`);
      }
      setAwardModalUser(null);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể trao giải thưởng.'));
    } finally {
      setAwarding(false);
    }
  };

  const verifiedCount = users.filter(isVerified).length;
  const devCount = users.filter(isDev).length;
  const adminCount = users.filter((u) => u.role === 'admin').length;

  return (
    <div className="admin-data-page" style={{ width: '100%', maxWidth: 1680, margin: '0 auto', display: 'grid', gap: 16, fontFamily: "'JetBrains Mono', monospace" }}>
      {/* ── HEADER & STATS ── */}
      <section style={{ ...CARD, padding: 22, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', background: 'rgba(180,83,9,0.08)', color: 'var(--accent)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <BadgeCheck size={14} />
            Quản trị nhân sự & Đặc quyền vận hành
          </div>
          <h1 style={{ margin: '12px 0 6px', fontSize: 'var(--text-h1, 24px)', lineHeight: 1.25, color: 'var(--text-primary)', fontWeight: 700 }}>
            Nhân sự, Chức danh & Danh hiệu Vinh danh
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            Quản lý hồ sơ nhân viên, phân quyền RBAC, cấp tích xanh (Verified), Dev badge, chức danh công tác và trao giải thưởng MVP / Champion.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ ...CARD, padding: '10px 14px', minWidth: 100 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Tổng nhân sự</div>
            <strong style={{ display: 'block', marginTop: 3, fontSize: 20, color: 'var(--text-primary)', fontWeight: 700 }}>{pagination?.total ?? users.length}</strong>
          </div>
          <div style={{ ...CARD, padding: '10px 14px', minWidth: 100 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Tích xanh</div>
            <strong style={{ display: 'block', marginTop: 3, fontSize: 20, color: 'var(--accent)', fontWeight: 700 }}>{verifiedCount}</strong>
          </div>
          <div style={{ ...CARD, padding: '10px 14px', minWidth: 100 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Dev Team</div>
            <strong style={{ display: 'block', marginTop: 3, fontSize: 20, color: 'var(--info)', fontWeight: 700 }}>{devCount}</strong>
          </div>
          <div style={{ ...CARD, padding: '10px 14px', minWidth: 100 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Quản trị viên</div>
            <strong style={{ display: 'block', marginTop: 3, fontSize: 20, color: '#dc2626', fontWeight: 700 }}>{adminCount}</strong>
          </div>
          <button
            type="button"
            onClick={() => setMvpModalOpen(true)}
            style={{
              minHeight: 40,
              padding: '0 16px',
              background: '#7c3aed',
              color: 'var(--surface)',
              border: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Trophy size={15} /> Trao Cúp MVP
          </button>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            style={{
              minHeight: 40,
              padding: '0 16px',
              background: 'var(--accent)',
              color: 'var(--surface)',
              border: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <UserPlus size={15} /> Thêm Nhân Sự Mới
          </button>
        </div>
      </section>

      {/* ── SEARCH & FILTERS ── */}
      <section style={{ ...CARD, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', minWidth: 260, flex: '1 1 320px' }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={query}
            onChange={onSearchChange}
            placeholder="Tìm theo tên, email hoặc WR-0001..."
            style={{ width: '100%', minHeight: 38, border: '1px solid rgba(15,23,42,0.1)', padding: '0 12px 0 34px', outline: 'none', fontSize: 12, fontWeight: 500 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            ['all', 'Tất cả'],
            ['verified', 'Có tích xanh'],
            ['dev', 'Developer'],
            ['admin', 'Quản trị viên'],
            ['unverified', 'Chưa định danh'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              style={{
                minHeight: 34,
                border: filter === key ? '1px solid var(--accent)' : '1px solid rgba(15,23,42,0.1)',
                background: filter === key ? 'var(--accent)' : 'var(--surface)',
                color: filter === key ? 'var(--surface)' : 'var(--text-secondary)',
                padding: '0 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => loadData(query, page)}
            disabled={loading}
            style={{ minHeight: 34, border: '1px solid rgba(180,83,9,0.2)', background: 'rgba(180,83,9,0.06)', color: 'var(--accent)', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: loading ? 'wait' : 'pointer' }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            Làm mới
          </button>
        </div>
      </section>

      {/* ── USER LIST ── */}
      <section style={{ display: 'grid', gap: 10 }}>
        {loading ? (
          <div style={{ ...CARD, padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>Đang tải danh sách nhân sự...</div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ ...CARD, padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>Không tìm thấy nhân viên phù hợp.</div>
        ) : filteredUsers.map((u) => {
          const userId = String(u.id);
          const pending = Boolean(saving[userId]);
          const userHasVerified = isVerified(u);
          const userHasDev = isDev(u);
          const isAdmin = u.role === 'admin';

          return (
            <article key={userId} className="admin-privilege-row" style={{ ...CARD, padding: 14, display: 'grid', gridTemplateColumns: 'minmax(220px, 1.2fr) minmax(220px, 1.2fr) auto', alignItems: 'center', gap: 14 }}>
              {/* Cột 1: Thông tin nhân sự */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <Avatar user={u} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || `User #${u.id}`}</span>
                    {userHasVerified && <VerifiedBadge size={14} />}
                    {userHasDev && (
                      <span style={{ fontSize: 10, padding: '1px 5px', background: 'var(--info-soft)', color: 'var(--info)', border: '1px solid var(--info-border)', fontWeight: 700 }}>
                        DEV
                      </span>
                    )}
                    {isAdmin && (
                      <span style={{ fontSize: 10, padding: '1px 5px', background: '#fef2f2', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)', fontWeight: 700 }}>
                        ADMIN
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 2, color: 'var(--text-secondary)', fontSize: 11, fontWeight: 500 }}>
                    WR-{String(u.id).padStart(4, '0')} · {u.email || 'Chưa có email'}
                  </div>
                </div>
              </div>

              {/* Cột 2: Chức danh & Phòng ban */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div>
                    <JobTitleBadge jobTitle={u.jobTitle} size="xs" />
                  </div>
                  <div style={{ marginTop: 3, fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.department || 'Media & Content'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openEditModal(u)}
                  title="Chỉnh sửa toàn bộ hồ sơ nhân sự"
                  style={{ padding: '4px 8px', background: 'rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.1)', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Edit3 size={11} /> Sửa
                </button>
              </div>

              {/* Cột 3: Nút điều khiển Badge & Trao giải */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                {/* Toggle Verified */}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggleVerified(u)}
                  style={{
                    minHeight: 30,
                    border: userHasVerified ? '1px solid rgba(180,83,9,0.3)' : '1px solid rgba(15,23,42,0.1)',
                    background: userHasVerified ? 'rgba(180,83,9,0.08)' : 'var(--surface)',
                    color: userHasVerified ? 'var(--accent)' : 'var(--text-secondary)',
                    padding: '0 9px',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontWeight: 600, cursor: pending ? 'wait' : 'pointer',
                  }}
                >
                  <BadgeCheck size={13} />
                  {userHasVerified ? 'Gỡ Tích Xanh' : 'Cấp Tích Xanh'}
                </button>

                {/* Toggle Dev */}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggleDevBadge(u)}
                  style={{
                    minHeight: 30,
                    border: userHasDev ? '1px solid var(--info-border)' : '1px solid var(--border-2)',
                    background: userHasDev ? 'var(--info-soft)' : 'var(--surface)',
                    color: userHasDev ? 'var(--info)' : 'var(--text-secondary)',
                    padding: '0 9px',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontWeight: 600, cursor: pending ? 'wait' : 'pointer',
                  }}
                >
                  <Code size={13} strokeWidth={2.5} />
                  {userHasDev ? 'Gỡ Dev' : 'Cấp Dev'}
                </button>

                {/* Trao MVP */}
                <button
                  type="button"
                  onClick={() => openAwardModal(u, 'MVP')}
                  title="Trao danh hiệu Nhân Viên Xuất Sắc (MVP)"
                  style={{
                    minHeight: 30,
                    border: '1px solid rgba(124,58,237,0.25)',
                    background: 'rgba(124,58,237,0.06)',
                    color: '#7c3aed',
                    padding: '0 9px',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <Star size={13} />
                  Trao MVP
                </button>

                {/* Trao Champion */}
                <button
                  type="button"
                  onClick={() => openAwardModal(u, 'CHAMPION')}
                  title="Trao cúp Vô Địch Giải Đấu"
                  style={{
                    minHeight: 30,
                    border: '1px solid rgba(245,158,11,0.3)',
                    background: 'rgba(245,158,11,0.08)',
                    color: '#d97706',
                    padding: '0 9px',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <Trophy size={13} />
                  Trao Cúp
                </button>

                {/* Drawer chi tiết nhanh */}
                <button
                  type="button"
                  onClick={() => setDetailDrawerUser(u)}
                  style={{
                    width: 30, height: 30,
                    border: '1px solid rgba(15,23,42,0.1)',
                    background: 'var(--surface)', color: 'var(--text-secondary)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  title="Xem chi tiết nhân sự"
                >
                  <Eye size={14} />
                </button>

                {/* Nút xóa nhân sự (Có bảo vệ không xóa nhầm tài khoản đang đăng nhập) */}
                {String(u.id) === String(currentUser?.id) ? (
                  <button
                    type="button"
                    disabled
                    style={{
                      width: 30, height: 30,
                      border: '1px solid rgba(148,163,184,0.25)',
                      background: 'var(--surface-soft)', color: 'var(--text-muted)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'not-allowed',
                    }}
                    title="Bạn không thể xóa chính tài khoản đang đăng nhập tại đây (vui lòng sử dụng trang Cài đặt)"
                  >
                    <Trash2 size={13} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmUser(u)}
                    style={{
                      width: 30, height: 30,
                      border: '1px solid rgba(239,68,68,0.2)',
                      background: 'rgba(239,68,68,0.04)', color: '#ef4444',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    title="Xóa tài khoản nhân sự"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {/* ── PAGINATION ── */}
      {pagination && pagination.totalPages > 1 && (
        <section style={{ ...CARD, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => { const p = page - 1; setPage(p); loadData(query, p); }}
            style={{ minHeight: 32, border: '1px solid rgba(15,23,42,0.1)', background: 'var(--surface)', color: page <= 1 ? 'var(--border-2)' : 'var(--text-secondary)', padding: '0 12px', fontSize: 12, fontWeight: 600, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
          >
            « Trước
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, padding: '0 8px' }}>
            Trang {page} / {pagination.totalPages} ({pagination.total} nhân sự)
          </span>
          <button
            type="button"
            disabled={page >= pagination.totalPages}
            onClick={() => { const p = page + 1; setPage(p); loadData(query, p); }}
            style={{ minHeight: 32, border: '1px solid rgba(15,23,42,0.1)', background: 'var(--surface)', color: page >= pagination.totalPages ? 'var(--border-2)' : 'var(--text-secondary)', padding: '0 12px', fontSize: 12, fontWeight: 600, cursor: page >= pagination.totalPages ? 'not-allowed' : 'pointer' }}
          >
            Sau »
          </button>
        </section>
      )}

      {/* ── MODAL THÊM NHÂN SỰ MỚI ── */}
      {createModalOpen && (
        <div className="modal-backdrop-enter" style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div className="modal-dialog-enter" style={{ background: 'var(--surface)', width: '100%', maxWidth: 500, padding: 24, border: '1px solid rgba(15,23,42,0.15)', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(15,23,42,0.08)', paddingBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={18} color="var(--accent)" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.3, color: 'var(--text-primary)' }}>
                  Thêm Nhân Sự Mới Vào Hệ Thống
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Họ và Tên Nhân Viên *
                </label>
                <input
                  required
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Email Đăng Nhập *
                  </label>
                  <input
                    required
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="an.nguyen@workrank.vn"
                    style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Mật Khẩu Khởi Tạo *
                  </label>
                  <input
                    required
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="••••••••"
                    style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Chức Danh & Bậc Huy Hiệu
                  </label>
                  <select
                    value={createForm.jobTitle}
                    onChange={(e) => setCreateForm({ ...createForm, jobTitle: e.target.value })}
                    style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)', background: 'var(--surface)', cursor: 'pointer' }}
                  >
                    {CATEGORIZED_JOB_TITLES.map((group) => (
                      <optgroup key={group.category} label={group.category}>
                        {group.titles.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <div style={{ marginTop: 6 }}>
                    <JobTitleBadge jobTitle={createForm.jobTitle} size="xs" />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Phòng Ban Trực Thuộc
                  </label>
                  <select
                    value={createForm.department}
                    onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                    style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)', background: 'var(--surface)', cursor: 'pointer' }}
                  >
                    <optgroup label="Phòng ban chính thức">
                      {CATEGORIZED_DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Đội Nhóm Trực Thuộc (Team)
                </label>
                <select
                  value={createForm.teamId}
                  onChange={(e) => setCreateForm({ ...createForm, teamId: e.target.value })}
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)', background: 'var(--surface)', cursor: 'pointer' }}
                >
                  <option value="">-- Chưa gán đội nhóm (Không có đội) --</option>
                  {teamsList.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.memberCount || 0} thành viên)</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Vai Trò Quyền Hạn (RBAC)
                  </label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)', background: 'var(--surface)' }}
                  >
                    <option value="user">Nhân Viên (User)</option>
                    <option value="admin">Quản Trị Viên (Admin)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={createForm.isVerified}
                      onChange={(e) => setCreateForm({ ...createForm, isVerified: e.target.checked })}
                    />
                    <span>Cấp Tích Xanh (Verified)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={createForm.isDev}
                      onChange={(e) => setCreateForm({ ...createForm, isDev: e.target.checked })}
                    />
                    <span>Huy hiệu Dev (Kỹ thuật)</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  style={{ padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    padding: '8px 18px', background: 'var(--accent)', color: 'var(--surface)', border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <UserPlus size={14} /> {creating ? 'Đang tạo...' : 'Tạo Nhân Sự'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CHỈNH SỬA TOÀN BỘ HỒ SƠ ── */}
      <AnimatedModal
        isOpen={Boolean(editModalUser)}
        onClose={closeEditModal}
        title={editModalUser ? `Chỉnh Sửa Hồ Sơ Nhân Sự #${editModalUser.id}` : 'Chỉnh Sửa Hồ Sơ Nhân Sự'}
        maxWidth={500}
      >
        {editModalUser && (
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <Avatar user={{ ...editModalUser, name: editForm.name, avatarData: editForm.avatarData || null }} size={52} />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: 'var(--surface-soft)', border: '1px solid var(--border-2)', fontSize: 12, color: 'var(--text-secondary)', cursor: savingEdit || processingAvatar ? 'wait' : 'pointer' }}>
                    <Upload size={14} /> {processingAvatar ? 'Đang xử lý ảnh...' : 'Đổi ảnh đại diện'}
                    <input type="file" accept="image/*" aria-label="Ảnh đại diện nhân sự" onChange={handleAvatarFile} disabled={savingEdit || processingAvatar} style={{ display: 'none' }} />
                  </label>
                  {editForm.avatarData && (
                    <button type="button" onClick={() => setEditForm((prev) => ({ ...prev, avatarData: '' }))} disabled={savingEdit || processingAvatar} title="Xóa ảnh đại diện" aria-label="Xóa ảnh đại diện" style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Họ và Tên *
                  </label>
                  <input
                    required
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Email Liên Hệ *
                  </label>
                  <input
                    required
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)' }}
                  />
                </div>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Số điện thoại liên hệ
                <input type="tel" value={editForm.phone} onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))} style={{ width: '100%', padding: 8, fontSize: 12, border: '1px solid var(--border-2)' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Giới thiệu / Trách nhiệm chuyên môn
                <textarea rows={3} value={editForm.bio} onChange={(event) => setEditForm((prev) => ({ ...prev, bio: event.target.value }))} style={{ width: '100%', padding: 8, fontSize: 12, border: '1px solid var(--border-2)', resize: 'vertical' }} />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 10 }}>
                <div>
                  <label htmlFor="person-edit-job-title" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Chức Danh & Bậc Huy Hiệu
                  </label>
                  <input
                    id="person-edit-job-title"
                    list="person-edit-job-titles"
                    value={editForm.jobTitle}
                    onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                    maxLength={120}
                    style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)', background: 'var(--surface)' }}
                  />
                  <datalist id="person-edit-job-titles">
                    {CATEGORIZED_JOB_TITLES.flatMap((group) => group.titles.map((title) => (
                      <option key={`${group.category}-${title}`} value={title} />
                    )))}
                  </datalist>
                  <div style={{ marginTop: 6 }}>
                    <JobTitleBadge jobTitle={editForm.jobTitle} size="xs" />
                  </div>
                </div>
                <div>
                  <label htmlFor="person-edit-department" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Phòng Ban Trực Thuộc
                  </label>
                  <input
                    id="person-edit-department"
                    list="person-edit-departments"
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    maxLength={120}
                    style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)', background: 'var(--surface)' }}
                  />
                  <datalist id="person-edit-departments">
                    {CATEGORIZED_DEPARTMENTS.map((department) => (
                      <option key={department} value={department} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Đội Nhóm Trực Thuộc (Team)
                </label>
                <select
                  value={editForm.teamId}
                  onChange={(e) => setEditForm({ ...editForm, teamId: e.target.value })}
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)', background: 'var(--surface)', cursor: 'pointer' }}
                >
                  <option value="">-- Chưa gán đội nhóm (Không có đội) --</option>
                  {teamsList.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.memberCount || 0} thành viên)</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 10 }}>
                <div>
                  <label htmlFor="person-edit-role" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Phân Quyền Hệ Thống
                  </label>
                  <select
                    id="person-edit-role"
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)', background: 'var(--surface)' }}
                  >
                    <option value="user">Nhân Viên (User)</option>
                    <option value="manager">Quản Lý (Manager)</option>
                    <option value="admin">Quản Trị Viên (Admin)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="person-edit-status" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Trạng Thái Tài Khoản
                  </label>
                  <select
                    id="person-edit-status"
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)', background: 'var(--surface)' }}
                  >
                    <option value="active">Hoạt động (Active)</option>
                    <option value="inactive">Tạm khóa (Inactive)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editForm.isVerified}
                    onChange={(e) => setEditForm({ ...editForm, isVerified: e.target.checked })}
                  />
                  <span>Tích Xanh (Verified)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editForm.isDev}
                    onChange={(e) => setEditForm({ ...editForm, isDev: e.target.checked })}
                  />
                  <span>Huy hiệu Dev Team</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={closeEditModal}
                  style={{ padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || processingAvatar}
                  style={{
                    padding: '8px 18px', background: 'var(--accent)', color: 'var(--surface)', border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: savingEdit ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Check size={14} /> {savingEdit ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
        )}
      </AnimatedModal>

      {/* ── MODAL TRAO GIẢI THƯỞNG ── */}
      <AnimatedModal
        isOpen={Boolean(awardModalUser)}
        onClose={() => {
          if (!awarding) setAwardModalUser(null);
        }}
        title={awardType === 'MVP' ? 'Trao Thưởng Danh Hiệu MVP' : 'Trao Cúp Vô Địch (Champion)'}
        maxWidth={460}
        dialogStyle={{ borderRadius: 8 }}
      >
        {awardModalUser && (
          <>
            <div style={{ padding: '8px 12px', background: 'var(--surface-soft)', border: '1px solid rgba(15,23,42,0.06)', marginBottom: 14, fontSize: 12 }}>
              Trao cho: <strong>{awardModalUser.name}</strong> (#{awardModalUser.id} · {awardModalUser.jobTitle || 'Nhân viên'})
            </div>

            <form onSubmit={submitAward} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label htmlFor="admin-award-season" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Năm &amp; Mùa Giải *
                </label>
                <select
                  id="admin-award-season"
                  required
                  value={awardForm.seasonId}
                  onChange={(e) => setAwardForm({ ...awardForm, seasonId: e.target.value })}
                  disabled={awardSeasonsLoading || awardSeasons.length === 0}
                  style={{ width: '100%', minHeight: 38, padding: '8px', fontSize: 12, border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                >
                  <option value="">
                    {awardSeasonsLoading ? 'Đang tải danh sách mùa giải...' : '-- Chọn năm và tên mùa --'}
                  </option>
                  {awardSeasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {seasonOptionLabel(season)}
                    </option>
                  ))}
                </select>
                {!awardSeasonsLoading && awardSeasons.length === 0 && (
                  <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--danger)' }}>
                    Chưa có mùa giải để gắn danh hiệu.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="admin-award-title" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Tiêu Đề Vinh Danh (Tùy chọn)
                </label>
                <input
                  id="admin-award-title"
                  type="text"
                  value={awardForm.title}
                  onChange={(e) => setAwardForm({ ...awardForm, title: e.target.value })}
                  placeholder={awardType === 'MVP' ? 'Ví dụ: MVP Mùa Giải 2026' : 'Ví dụ: Quán Quân Mùa 2026'}
                  style={{ width: '100%', minHeight: 38, padding: '8px', fontSize: 12, border: '1px solid var(--border-2)' }}
                />
              </div>

              <div>
                <label htmlFor="admin-award-reason" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Lý Do &amp; Căn Cứ Vinh Danh *
                </label>
                <textarea
                  id="admin-award-reason"
                  rows={3}
                  required
                  value={awardForm.reason}
                  onChange={(e) => setAwardForm({ ...awardForm, reason: e.target.value })}
                  placeholder="Ghi rõ thành tích, đóng góp nổi bật hoặc chỉ số đạt được..."
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid var(--border-2)', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setAwardModalUser(null)}
                  disabled={awarding}
                  style={{ padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border-2)', fontSize: 12, fontWeight: 600, cursor: awarding ? 'not-allowed' : 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={awarding || awardSeasonsLoading || awardSeasons.length === 0}
                  style={{
                    padding: '8px 18px',
                    background: awardType === 'MVP' ? '#7c3aed' : '#d97706',
                    color: 'var(--surface)', border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: awarding ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Award size={14} /> {awarding ? 'Đang trao...' : 'Xác Nhận Trao Thưởng'}
                </button>
              </div>
            </form>
          </>
        )}
      </AnimatedModal>

      {/* ── DRAWER CHI TIẾT NHÂN SỰ ── */}
      {detailDrawerUser && (
        <div className="modal-backdrop-enter" style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(3px)',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <div className="drawer-slide-right-enter" style={{
            background: 'var(--surface)', width: '100%', maxWidth: 440, height: '100%',
            overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20,
            boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(15,23,42,0.08)', paddingBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.3, color: 'var(--text-primary)' }}>
                Hồ Sơ Nhân Sự Chi Tiết
              </h3>
              <button
                type="button"
                onClick={() => setDetailDrawerUser(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Avatar user={detailDrawerUser} size={56} />
              <div>
                <div style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, lineHeight: 1.3, color: 'var(--text-primary)' }}>
                  {detailDrawerUser.name}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                  WR-{String(detailDrawerUser.id).padStart(4, '0')} · {detailDrawerUser.email}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12, padding: 14, background: 'var(--surface-soft)', border: '1px solid rgba(15,23,42,0.06)' }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>CHỨC DANH CÔNG TÁC:</span>
                <div style={{ marginTop: 4 }}>
                  <JobTitleBadge jobTitle={detailDrawerUser.jobTitle} size="sm" />
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>PHÒNG BAN:</span>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                  {detailDrawerUser.department || 'Media & Content'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>VAI TRÒ / PHÂN QUYỀN:</span>
                <div style={{ fontSize: 13, fontWeight: 600, color: detailDrawerUser.role === 'admin' ? '#dc2626' : 'var(--accent)', marginTop: 2 }}>
                  {detailDrawerUser.role === 'admin' ? 'Quản Trị Viên (Admin)' : 'Nhân Viên (User)'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>TRẠNG THÁI:</span>
                <div style={{ fontSize: 13, fontWeight: 600, color: (detailDrawerUser.accountStatus || detailDrawerUser.status) === 'inactive' ? '#dc2626' : '#16a34a', marginTop: 2 }}>
                  {(detailDrawerUser.accountStatus || detailDrawerUser.status) === 'inactive' ? 'Tạm khóa (Inactive)' : 'Hoạt động (Active)'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
              <button
                type="button"
                onClick={() => {
                  navigate(`/users/${detailDrawerUser.id}`);
                  setDetailDrawerUser(null);
                }}
                style={{
                  width: '100%', padding: '10px', background: 'var(--accent)', color: 'var(--surface)',
                  border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Eye size={15} /> Xem Trang Cá Nhân Đầy Đủ
              </button>
              <button
                type="button"
                onClick={() => {
                  openEditModal(detailDrawerUser);
                  setDetailDrawerUser(null);
                }}
                style={{
                  width: '100%', padding: '10px', background: 'var(--surface)', color: 'var(--text-primary)',
                  border: '1px solid rgba(15,23,42,0.15)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Edit3 size={15} /> Chỉnh Sửa Hồ Sơ Nhân Sự
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL XÁC NHẬN XÓA NHÂN SỰ ── */}
      {deleteConfirmUser && (
        <div className="modal-backdrop-enter" style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div className="modal-dialog-enter" style={{ background: 'var(--surface)', width: '100%', maxWidth: 460, padding: 24, border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', marginBottom: 14 }}>
              <Trash2 size={20} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>Xác Nhận Xóa Nhân Sự</h3>
            </div>
            
            <div style={{ background: '#fef2f2', border: '1px solid rgba(220,38,38,0.2)', padding: '12px 14px', borderRadius: 4, marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#991b1b', marginBottom: 2 }}>{deleteConfirmUser.name}</div>
              <div style={{ fontSize: 12, color: 'var(--danger)' }}>{deleteConfirmUser.email} · WR-{String(deleteConfirmUser.id).padStart(4, '0')}</div>
              <div style={{ fontSize: 11, color: '#7f1d1d', marginTop: 4 }}>
                {deleteConfirmUser.jobTitle || 'Nhân viên'} · {deleteConfirmUser.department || 'Media & Content'}
                {deleteConfirmUser.teamName && ` · Đội: ${deleteConfirmUser.teamName}`}
              </div>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Hành động này sẽ xóa tài khoản nhân sự và thu hồi toàn bộ phiên đăng nhập của người này ngay lập tức. Dữ liệu lịch sử thi đấu và kênh YouTube của công ty vẫn được bảo toàn an toàn.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                style={{ padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 4 }}
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteUser}
                style={{
                  padding: '8px 18px', background: '#dc2626', color: 'var(--surface)', border: 'none',
                  fontSize: 12, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', borderRadius: 4,
                }}
              >
                {deleting ? 'Đang xóa...' : 'Xác Nhận Xóa Vĩnh Viễn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL TRAO CÚP MVP MÙA GIẢI ── */}
      <MvpCupAwardModal
        isOpen={mvpModalOpen}
        onClose={() => setMvpModalOpen(false)}
        onSuccess={() => loadData(query, page)}
      />

      <style>{`
        @media (max-width: 920px) {
          .admin-privilege-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
