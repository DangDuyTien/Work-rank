import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  BadgeCheck,
  Bell,
  CheckCircle2,
  Code,
  Database,
  Edit3,
  ExternalLink,
  KeyRound,
  Mail,
  Palette,
  Phone,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  UserCheck,
  UserRound,
  Users,
  Volume2,
  X,
  Building2,
  Lightbulb,
  Check,
  Wrench,
  Gamepad2,
  LayoutGrid,
  Club,
  Activity,
  Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UiContext';
import { parseApiError } from '../utils/errors';
import { auth, users as usersApi, competition as compApi, gameCatalogApi } from '../services/api';
import VerifiedBadge from '../components/VerifiedBadge';
import JobTitleBadge, { CATEGORIZED_JOB_TITLES, CATEGORIZED_DEPARTMENTS } from '../components/JobTitleBadge';
import {
  getUserAvatar,
  getStoredAvatar,
  setStoredAvatar,
  removeStoredAvatar,
  compressImage,
  initialsFromName,
} from '../utils/avatar';
import {
  getAppSettings,
  resetAppSettings,
  saveAppSettings,
  subscribeAppSettings,
} from '../utils/settings';

const NOTIFICATIONS_CLEARED_EVENT = 'workrank:notifications-cleared';

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

function roleLabel(role) {
  if (role === 'admin') return 'Quản trị viên';
  if (role === 'manager') return 'Quản lý';
  return 'Nhân viên';
}

function statusLabel(status) {
  return status === 'active' ? 'Đang hoạt động' : 'Đã tạm khóa';
}

function settingValue(settings, section, key) {
  return settings?.[section]?.[key];
}

function SettingSection({ icon: Icon, title, desc, children, className = '', action = null }) {
  return (
    <section className={`settings-card ${className}`}>
      <div className="settings-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="settings-card-icon">
            <Icon size={18} strokeWidth={2.4} />
          </div>
          <div>
            <h2>{title}</h2>
            {desc && <p>{desc}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ToggleRow({ icon: Icon, title, desc, checked, onChange }) {
  return (
    <label className="settings-toggle-row">
      <span className="settings-toggle-copy">
        {Icon && <Icon size={16} strokeWidth={2.4} />}
        <span>
          <strong>{title}</strong>
          <em>{desc}</em>
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="settings-switch" aria-hidden="true" />
    </label>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, setUser, isAdmin } = useAuth();
  const [settings, setSettings] = useState(getAppSettings);

  // Profile Form state
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    avatarData: user?.avatarData || getStoredAvatar(user?.id) || '',
  });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Recognitions & Badges state
  const [recognitions, setRecognitions] = useState(null);
  const [loadingRecognitions, setLoadingRecognitions] = useState(false);

  // Admin Job Title Form state (Select any employee in the company)
  const [adminJobForm, setAdminJobForm] = useState({
    targetUserId: user?.id || '',
    jobTitle: user?.jobTitle || 'Nhân viên',
    department: user?.department || 'Media & Content',
    role: user?.role || 'user',
    isCustomTitle: false,
    customTitle: '',
    isCustomDept: false,
    customDept: '',
  });
  const [savingJobProfile, setSavingJobProfile] = useState(false);

  // Admin Award Modal state
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [awardForm, setAwardForm] = useState({
    awardType: 'MVP', // MVP | CHAMPION
    targetUserId: '',
    seasonId: '',
    title: '',
    reason: '',
  });
  const [awarding, setAwarding] = useState(false);
  const [userList, setUserList] = useState([]);

  useEffect(() => subscribeAppSettings(setSettings), []);

  useEffect(() => {
    setProfile({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      bio: user?.bio || '',
      avatarData: user?.avatarData || getStoredAvatar(user?.id) || '',
    });
    setAdminJobForm((prev) => ({
      ...prev,
      targetUserId: prev.targetUserId || user?.id || '',
      jobTitle: prev.targetUserId && prev.targetUserId !== user?.id ? prev.jobTitle : (user?.jobTitle || 'Nhân viên'),
      department: prev.targetUserId && prev.targetUserId !== user?.id ? prev.department : (user?.department || 'Media & Content'),
      role: prev.targetUserId && prev.targetUserId !== user?.id ? prev.role : (user?.role || 'user'),
    }));
  }, [user?.avatarData, user?.bio, user?.department, user?.email, user?.id, user?.jobTitle, user?.name, user?.phone, user?.role]);

  // Load user recognitions
  const loadRecognitions = async () => {
    if (!user?.id) return;
    setLoadingRecognitions(true);
    try {
      const data = await usersApi.getRecognitions(user.id);
      setRecognitions(data);
    } catch (err) {
      console.error('Failed to load recognitions:', err);
    } finally {
      setLoadingRecognitions(false);
    }
  };

  useEffect(() => {
    loadRecognitions();
  }, [user?.id]);

  // Load user list for admin dropdowns (employee picker & awards)
  useEffect(() => {
    if (isAdmin && userList.length === 0) {
      usersApi.list({ limit: 200 }).then((res) => {
        setUserList(res.data || []);
      }).catch((e) => console.error(e));
    }
  }, [isAdmin, userList.length]);

  // ── Game Catalog Admin State ──
  const [gameCatalog, setGameCatalog] = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [updatingGameKey, setUpdatingGameKey] = useState(null);

  const loadGameCatalog = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingGames(true);
    try {
      const res = await gameCatalogApi.getCatalog();
      if (res?.games) setGameCatalog(res.games);
    } catch (err) {
      console.warn('Failed to load game catalog:', err);
    } finally {
      setLoadingGames(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      loadGameCatalog();
    }
  }, [isAdmin, loadGameCatalog]);

  const handleToggleGameStatus = async (gameKey, currentStatus) => {
    const nextStatus = currentStatus === 'AVAILABLE' ? 'COMING_SOON' : 'AVAILABLE';
    setUpdatingGameKey(gameKey);
    try {
      const updated = await gameCatalogApi.updateGameStatus(gameKey, { status: nextStatus });
      setGameCatalog((prev) =>
        prev.map((g) => (g.gameKey === gameKey ? { ...g, status: updated.status } : g))
      );
      window.dispatchEvent(new CustomEvent('workrank:game-catalog-updated', { detail: { gameKey, status: updated.status } }));
      toast.success(`Đã cập nhật game ${updated.name || gameKey} thành: ${nextStatus === 'AVAILABLE' ? 'Đang hoạt động' : 'Sắp ra mắt'}`);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể cập nhật trạng thái game.'));
    } finally {
      setUpdatingGameKey(null);
    }
  };

  const handleSelectEmployee = (targetId) => {
    const tId = Number(targetId);
    const selected = userList.find((u) => Number(u.id) === tId) || (tId === Number(user?.id) ? user : null);
    if (!selected) return;
    setAdminJobForm({
      targetUserId: selected.id,
      jobTitle: selected.jobTitle || 'Nhân viên',
      department: selected.department || 'Media & Content',
      role: selected.role || 'user',
      isCustomTitle: false,
      customTitle: '',
      isCustomDept: false,
      customDept: '',
    });
  };

  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressImage(file, 400, 400, 0.85);
      setProfile((current) => ({ ...current, avatarData: base64 }));
    } catch (err) {
      toast.error(parseApiError(err, 'Lỗi khi xử lý hình ảnh avatar'));
    }
  };

  const profileDirty = useMemo(() => (
    profile.name.trim() !== String(user?.name || '').trim()
    || profile.email.trim().toLowerCase() !== String(user?.email || '').trim().toLowerCase()
    || profile.phone.trim() !== String(user?.phone || '').trim()
    || profile.bio.trim() !== String(user?.bio || '').trim()
    || profile.avatarData !== (user?.avatarData || getStoredAvatar(user?.id) || '')
  ), [profile.avatarData, profile.bio, profile.email, profile.name, profile.phone, user?.avatarData, user?.bio, user?.email, user?.id, user?.name, user?.phone]);

  const updateSetting = (section, key, value) => {
    setSettings((current) => saveAppSettings({
      ...current,
      [section]: {
        ...(current[section] || {}),
        [key]: value,
      },
    }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!profile.name.trim() || !profile.email.trim()) {
      toast.warning('Tên và email không được để trống.');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await usersApi.update(user.id, {
        name: profile.name.trim(),
        email: profile.email.trim().toLowerCase(),
        phone: profile.phone.trim(),
        bio: profile.bio.trim(),
        avatarData: profile.avatarData || null,
      });

      if (profile.avatarData) {
        setStoredAvatar(user.id, profile.avatarData);
      } else {
        removeStoredAvatar(user.id);
      }

      const updatedUser = res.data?.user || res.data || {};
      setUser((prev) => ({
        ...(prev || {}),
        ...updatedUser,
        avatarData: profile.avatarData || null,
      }));
      toast.success('Đã cập nhật hồ sơ cá nhân và ảnh đại diện thành công!');
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể cập nhật hồ sơ.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const saveAdminJobProfile = async (event) => {
    event.preventDefault();
    const finalJobTitle = (adminJobForm.isCustomTitle ? adminJobForm.customTitle : adminJobForm.jobTitle).trim();
    const finalDept = (adminJobForm.isCustomDept ? adminJobForm.customDept : adminJobForm.department).trim();
    
    if (!finalJobTitle) {
      toast.warning('Chức danh công tác không được để trống.');
      return;
    }

    const targetId = adminJobForm.targetUserId || user?.id;
    setSavingJobProfile(true);
    try {
      let updatedUser = await usersApi.adminUpdateJobProfile(targetId, {
        jobTitle: finalJobTitle,
        department: finalDept,
      });

      if (adminJobForm.role) {
        try {
          const res = await usersApi.update(targetId, { role: adminJobForm.role });
          if (res?.data) {
            updatedUser = { ...updatedUser, ...res.data };
          }
        } catch (e) {
          console.warn('Role update notice:', e);
        }
      }

      if (Number(targetId) === Number(user?.id)) {
        setUser((prev) => ({ ...prev, ...updatedUser }));
      }
      setUserList((prev) => prev.map((u) => (Number(u.id) === Number(targetId) ? { ...u, ...updatedUser } : u)));
      toast.success(`Đã cập nhật chức danh, phòng ban & huy hiệu cho nhân sự #${targetId}.`);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể cập nhật chức danh.'));
    } finally {
      setSavingJobProfile(false);
    }
  };

  const handleAdminAward = async (event) => {
    event.preventDefault();
    const targetId = Number(awardForm.targetUserId) || user?.id;
    if (!targetId) {
      toast.warning('Hãy chọn nhân viên nhận giải thưởng.');
      return;
    }
    if (!awardForm.reason.trim()) {
      toast.warning('Hãy nhập lý do và căn cứ vinh danh.');
      return;
    }

    setAwarding(true);
    try {
      if (awardForm.awardType === 'MVP') {
        await usersApi.adminAwardMVP({
          userId: targetId,
          seasonId: awardForm.seasonId ? Number(awardForm.seasonId) : null,
          title: awardForm.title.trim() || undefined,
          reason: awardForm.reason.trim(),
        });
        toast.success('Đã trao giải thưởng MVP thành công!');
      } else {
        await usersApi.adminAwardChampion({
          userId: targetId,
          seasonId: awardForm.seasonId ? Number(awardForm.seasonId) : null,
          title: awardForm.title.trim() || undefined,
          reason: awardForm.reason.trim(),
        });
        toast.success('Đã trao danh hiệu Vô Địch (Champion) thành công!');
      }

      setShowAwardModal(false);
      setAwardForm({ awardType: 'MVP', targetUserId: '', seasonId: '', title: '', reason: '' });
      loadRecognitions();
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể trao giải thưởng.'));
    } finally {
      setAwarding(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    if (!password.currentPassword || !password.newPassword) {
      toast.warning('Hãy nhập mật khẩu hiện tại và mật khẩu mới.');
      return;
    }
    if (password.newPassword.length < 6) {
      toast.warning('Mật khẩu mới cần ít nhất 6 ký tự.');
      return;
    }
    if (password.newPassword !== password.confirmPassword) {
      toast.warning('Xác nhận mật khẩu mới chưa khớp.');
      return;
    }

    setSavingPassword(true);
    try {
      await auth.changePassword({
        currentPassword: password.currentPassword,
        newPassword: password.newPassword,
      });
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Đã đổi mật khẩu thành công.');
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể đổi mật khẩu.'));
    } finally {
      setSavingPassword(false);
    }
  };

  const clearNotifications = () => {
    localStorage.removeItem(`workrank:notifications:${user?.id || 'guest'}`);
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CLEARED_EVENT, {
      detail: { userId: String(user?.id || '') },
    }));
    toast.success('Đã xóa thông báo cục bộ.');
  };

  const clearAvatar = () => {
    removeStoredAvatar(user?.id);
    toast.success('Đã xóa ảnh đại diện lưu trên trình duyệt.');
  };

  const restoreDefaults = () => {
    setSettings(resetAppSettings());
    toast.success('Đã khôi phục tùy chọn mặc định.');
  };

  const badges = recognitions?.badges || {};
  const isVerifiedBadge = Boolean(badges.verified?.active || user?.isVerified);
  const isDevBadge = Boolean(badges.dev?.active || user?.isDev);
  const isChampionBadge = Boolean(badges.champion?.active);
  const championCount = badges.champion?.count || 0;
  const isMvpBadge = Boolean(badges.mvp?.active);
  const mvpCount = badges.mvp?.count || 0;
  const awardsList = recognitions?.awards || [];

  return (
    <div className="settings-page">
      {/* ── HEADER / HERO ── */}
      <header className="settings-hero">
        <div>
          <div className="settings-kicker">Cài đặt tài khoản & Hồ sơ nhân sự</div>
          <h1>Trung tâm thông tin cá nhân và định danh</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>
            Quản lý thông tin liên hệ, chức danh công tác, xem huy hiệu chính thức và bảo mật tài khoản.
          </p>
        </div>
        <div className="settings-account-card">
          <div className="settings-account-avatar" style={{ overflow: 'hidden' }}>
            {(profile.avatarData || user?.avatarData || getStoredAvatar(user?.id)) ? (
              <img
                src={profile.avatarData || user?.avatarData || getStoredAvatar(user?.id)}
                alt="Avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              String(user?.name || user?.email || 'U').slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="settings-account-meta">
            <div className="settings-account-name-row">
              <strong>{user?.name || 'Người dùng'}</strong>
              {isVerifiedBadge && <VerifiedBadge size={16} />}
            </div>
            <div className="settings-account-sub-row">
              <JobTitleBadge jobTitle={user?.jobTitle} size="xs" />
              <span className="settings-account-dot">•</span>
              <span className="settings-account-dept">{user?.department || 'Media & Content'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN GRID ── */}
      <div className="settings-grid">
        {/* KHỐI 1: THÔNG TIN CÁ NHÂN */}
        <SettingSection
          icon={UserRound}
          title="Thông tin cá nhân & Liên hệ"
          desc="Thông tin cơ bản hiển thị trên hồ sơ làm việc nội bộ của bạn."
          className="settings-card-wide"
        >
          <form className="settings-form" onSubmit={saveProfile}>
            {/* Ảnh đại diện Avatar */}
            <div style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid rgba(15,23,42,0.08)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 4 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '2px solid #b45309',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#e0f2fe',
                  flexShrink: 0,
                }}
              >
                {profile.avatarData ? (
                  <img
                    src={profile.avatarData}
                    alt="Avatar Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#b45309' }}>
                    {initialsFromName(profile.name || user?.name || 'U')}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>
                  Ảnh Đại Diện (Avatar)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <label style={{ cursor: 'pointer', padding: '5px 12px', background: '#0f172a', color: '#ffffff', fontSize: 12, fontWeight: 600, borderRadius: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFile}
                      style={{ display: 'none' }}
                    />
                    <span>Tải ảnh mới...</span>
                  </label>
                  {profile.avatarData && (
                    <button
                      type="button"
                      onClick={() => setProfile((current) => ({ ...current, avatarData: '' }))}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#dc2626',
                        background: '#fee2e2',
                        border: '1px solid #fecaca',
                        cursor: 'pointer',
                      }}
                    >
                      Xóa ảnh đại diện
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <label>
                <span>Họ và tên hiển thị *</span>
                <input
                  value={profile.name}
                  onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
                  maxLength={120}
                  placeholder="Họ và tên của bạn"
                />
              </label>
              <label>
                <span>Email đăng nhập *</span>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}
                  maxLength={191}
                  placeholder="email@workrank.io"
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <label>
                <span>Số điện thoại liên hệ</span>
                <input
                  type="text"
                  value={profile.phone}
                  onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="09..."
                />
              </label>
              <label>
                <span>Mã nhân viên (ID hệ thống)</span>
                <input
                  disabled
                  value={`WR-${String(user?.id || '').padStart(4, '0')} (ID: #${user?.id})`}
                  style={{ background: '#f8fafc', color: '#64748b' }}
                />
              </label>
            </div>

            <label>
              <span>Giới thiệu / Trách nhiệm chuyên môn (Bio)</span>
              <textarea
                rows={2}
                value={profile.bio}
                onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))}
                placeholder="Tóm tắt trách nhiệm và định hướng công việc..."
                style={{
                  width: '100%',
                  padding: '8px 11px',
                  fontSize: 13,
                  fontWeight: 400,
                  lineHeight: 1.55,
                  border: '1px solid rgba(15,23,42,0.1)',
                  borderRadius: 0,
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </label>

            <div className="settings-actions">
              <button type="submit" className="settings-primary-button" disabled={!profileDirty || savingProfile}>
                <Save size={15} />
                {savingProfile ? 'Đang lưu...' : 'Lưu thông tin cá nhân'}
              </button>
              <button type="button" className="settings-secondary-button" onClick={() => navigate(`/users/${user?.id}`)}>
                <ExternalLink size={14} /> Mở hồ sơ đầy đủ
              </button>
            </div>
          </form>
        </SettingSection>

        {/* KHỐI 2: CHỨC DANH CÔNG TÁC & PHÒNG BAN */}
        <SettingSection
          icon={Shield}
          title="Chức danh công tác & Tổ chức"
          desc="Vị trí chuyên môn và phòng ban công tác chính thức tại 3winmedia."
          className="settings-card-wide"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
            <div style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid rgba(15,23,42,0.08)' }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Huy hiệu chức danh</span>
              <div style={{ marginTop: 6 }}>
                <JobTitleBadge jobTitle={user?.jobTitle} size="md" />
              </div>
            </div>

            <div style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid rgba(15,23,42,0.08)' }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Phòng ban trực thuộc</span>
              <strong style={{ display: 'block', marginTop: 4, fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
                {user?.department || 'Media & Content'}
              </strong>
            </div>

            <div style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid rgba(15,23,42,0.08)' }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Quyền hệ thống (RBAC)</span>
              <strong style={{ display: 'block', marginTop: 4, fontSize: 15, fontWeight: 600, color: user?.role === 'admin' ? '#dc2626' : '#0f172a' }}>
                {roleLabel(user?.role)}
              </strong>
            </div>

            <div style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid rgba(15,23,42,0.08)' }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Trạng thái tài khoản</span>
              <strong style={{ display: 'block', marginTop: 4, fontSize: 15, fontWeight: 600, color: '#16a34a' }}>
                {statusLabel(user?.status)}
              </strong>
            </div>
          </div>

          {isAdmin ? (
            <form onSubmit={saveAdminJobProfile} style={{ padding: 16, background: 'rgba(180,83,9,0.04)', border: '1px solid rgba(180,83,9,0.25)', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#b45309', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Edit3 size={15} /> Điều chỉnh Chức danh & Huy hiệu (Dành cho Quản trị viên)
                </div>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>
                  Chọn nhân viên từ danh sách để phân bổ chức vụ & huy hiệu
                </span>
              </div>

              {/* 1. DROP DOWN CHỌN NHÂN VIÊN */}
              <div style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.12)', padding: '10px 12px' }}>
                <label style={{ display: 'block', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Users size={13} color="#b45309" /> Trỏ xuống chọn nhân viên cần gán chức vụ:
                  </span>
                </label>
                <select
                  value={adminJobForm.targetUserId}
                  onChange={(e) => handleSelectEmployee(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#0f172a',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">-- Bấm để chọn nhân viên trong công ty --</option>
                  {userList.map((u) => (
                    <option key={u.id} value={u.id}>
                      #{u.id} - {u.name} [{u.jobTitle || 'Nhân viên'} • {u.department || 'Chưa phân phòng'} • {u.role === 'admin' ? 'ADMIN' : 'USER'}]
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. CHỌN CHỨC DANH (CATEGORIZED TIERS) & PHÒNG BAN & QUYỀN HẠN */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {/* Dropdown Chức danh */}
                <div style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.12)', padding: '10px 12px' }}>
                  <label style={{ display: 'block', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Award size={13} color="#f59e0b" /> Chức danh & Bậc huy hiệu:
                    </span>
                  </label>
                  <select
                    value={adminJobForm.jobTitle}
                    onChange={(e) => setAdminJobForm({ ...adminJobForm, jobTitle: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: 12,
                      fontWeight: 500,
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {CATEGORIZED_JOB_TITLES.map((group) => (
                      <optgroup key={group.category} label={group.category}>
                        {group.titles.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  {/* Live Badge Preview */}
                  <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(15,23,42,0.03)', border: '1px dashed rgba(15,23,42,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>Huy hiệu hiển thị:</span>
                    <JobTitleBadge
                      jobTitle={adminJobForm.jobTitle}
                      size="sm"
                    />
                  </div>
                </div>

                {/* Dropdown Phòng ban */}
                <div style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.12)', padding: '10px 12px' }}>
                  <label style={{ display: 'block', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Building2 size={13} color="#b45309" /> Phòng ban công tác:
                    </span>
                  </label>
                  <select
                    value={adminJobForm.isCustomDept ? '__custom__' : adminJobForm.department}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setAdminJobForm({ ...adminJobForm, isCustomDept: true, customDept: adminJobForm.department || '' });
                      } else {
                        setAdminJobForm({ ...adminJobForm, isCustomDept: false, department: e.target.value });
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: 12,
                      fontWeight: 500,
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <optgroup label="Phòng ban chính thức">
                      {CATEGORIZED_DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Tùy chọn khác">
                      <option value="__custom__">Nhập phòng ban tùy chỉnh...</option>
                    </optgroup>
                  </select>

                  {adminJobForm.isCustomDept && (
                    <input
                      value={adminJobForm.customDept}
                      onChange={(e) => setAdminJobForm({ ...adminJobForm, customDept: e.target.value, department: e.target.value })}
                      placeholder="Nhập tên phòng ban mới..."
                      style={{ width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #cbd5e1', marginTop: 8, outline: 'none' }}
                    />
                  )}

                  <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(15,23,42,0.03)', border: '1px dashed rgba(15,23,42,0.15)', fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Building2 size={13} color="#b45309" />
                    <span>Phòng ban: <strong style={{ color: '#0f172a', fontWeight: 600 }}>{adminJobForm.isCustomDept ? (adminJobForm.customDept || 'Chưa đặt') : adminJobForm.department}</strong></span>
                  </div>
                </div>

                {/* Dropdown Quyền hệ thống */}
                <div style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.12)', padding: '10px 12px' }}>
                  <label style={{ display: 'block', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <KeyRound size={13} color="#dc2626" /> Quyền hệ thống (RBAC):
                    </span>
                  </label>
                  <select
                    value={adminJobForm.role}
                    onChange={(e) => setAdminJobForm({ ...adminJobForm, role: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: 12,
                      fontWeight: 500,
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="user">Nhân Viên (User)</option>
                    <option value="manager">Quản Lý Bộ Phận (Manager)</option>
                    <option value="admin">Quản Trị Viên Tối Cao (Admin)</option>
                  </select>

                  <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(15,23,42,0.03)', border: '1px dashed rgba(15,23,42,0.15)', fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Shield size={13} color="#dc2626" />
                    <span>Phân quyền: <strong style={{ color: adminJobForm.role === 'admin' ? '#dc2626' : '#b45309', fontWeight: 600 }}>{roleLabel(adminJobForm.role)}</strong></span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="submit" disabled={savingJobProfile} className="settings-primary-button">
                  <Save size={14} /> {savingJobProfile ? 'Đang lưu...' : 'Lưu Thay Đổi Chức Vụ & Huy Hiệu'}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.06)', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
              <Lightbulb size={14} color="#b45309" />
              <em>Chức danh công tác và phân bổ phòng ban được quản lý tập trung bởi Ban Quản Trị / Nhân sự để đảm bảo tính chuẩn hóa tổ chức.</em>
            </div>
          )}
        </SettingSection>

        {/* KHỐI 3: HUY HIỆU & VINH DANH CHÍNH THỨC */}
        <SettingSection
          icon={Award}
          title="Huy hiệu & Vinh danh chính thức"
          desc="Hệ thống định danh thành tích chuẩn mực của 3winmedia (Verified, Dev, Champion, MVP)."
          className="settings-card-wide"
          action={
            isAdmin && (
              <button
                type="button"
                onClick={() => setShowAwardModal(true)}
                className="settings-primary-button"
                style={{ fontSize: 11, padding: '0 10px', minHeight: 30 }}
              >
                <PlusCircle size={13} /> Trao giải MVP / Champion
              </button>
            )
          }
        >
          {/* 4 Official Badges Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
            {/* 1. Verified */}
            <div style={{
              padding: 14,
              background: isVerifiedBadge ? 'rgba(180,83,9,0.06)' : 'rgba(15,23,42,0.02)',
              border: isVerifiedBadge ? '1px solid rgba(180,83,9,0.3)' : '1px solid rgba(15,23,42,0.08)',
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isVerifiedBadge ? 'rgba(180,83,9,0.15)' : 'rgba(15,23,42,0.05)',
                color: isVerifiedBadge ? '#b45309' : '#94a3b8',
              }}>
                <BadgeCheck size={20} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isVerifiedBadge ? '#b45309' : '#0f172a' }}>
                  Đã Xác Minh (Verified)
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: 400 }}>
                  {isVerifiedBadge ? 'Tài khoản đã xác thực tích xanh chính thức' : 'Chưa cấp tích xanh'}
                </div>
              </div>
            </div>

            {/* 2. Developer */}
            <div style={{
              padding: 14,
              background: isDevBadge ? 'rgba(8,145,178,0.06)' : 'rgba(15,23,42,0.02)',
              border: isDevBadge ? '1px solid rgba(8,145,178,0.3)' : '1px solid rgba(15,23,42,0.08)',
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isDevBadge ? 'rgba(8,145,178,0.15)' : 'rgba(15,23,42,0.05)',
                color: isDevBadge ? '#0891b2' : '#94a3b8',
              }}>
                <Code size={20} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isDevBadge ? '#0891b2' : '#0f172a' }}>
                  Developer (Kỹ Thuật)
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: 400 }}>
                  {isDevBadge ? 'Đội ngũ phát triển hệ thống WorkRank' : 'Không thuộc Dev team'}
                </div>
              </div>
            </div>

            {/* 3. Champion */}
            <div style={{
              padding: 14,
              background: isChampionBadge ? 'rgba(245,158,11,0.08)' : 'rgba(15,23,42,0.02)',
              border: isChampionBadge ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(15,23,42,0.08)',
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isChampionBadge ? 'rgba(245,158,11,0.15)' : 'rgba(15,23,42,0.05)',
                color: isChampionBadge ? '#d97706' : '#94a3b8',
              }}>
                <Trophy size={20} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isChampionBadge ? '#d97706' : '#0f172a' }}>
                  Vô Địch Giải Đấu {championCount > 1 && `(x${championCount})`}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: 400 }}>
                  {isChampionBadge ? `Đạt ${championCount} cúp vô địch mùa giải` : 'Chưa có cúp vô địch'}
                </div>
              </div>
            </div>

            {/* 4. MVP */}
            <div style={{
              padding: 14,
              background: isMvpBadge ? 'rgba(180,83,9,0.08)' : 'rgba(0,0,0,0.02)',
              border: isMvpBadge ? '1px solid rgba(180,83,9,0.35)' : '1px solid rgba(0,0,0,0.08)',
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isMvpBadge ? 'rgba(180,83,9,0.15)' : 'rgba(0,0,0,0.05)',
                color: isMvpBadge ? '#b45309' : '#94a3b8',
              }}>
                <Star size={20} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isMvpBadge ? '#b45309' : '#0f172a' }}>
                  Nhân Viên Xuất Sắc {mvpCount > 1 && `(x${mvpCount})`}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: 400 }}>
                  {isMvpBadge ? `Đã nhận ${mvpCount} danh hiệu MVP xuất sắc` : 'Chưa có danh hiệu MVP'}
                </div>
              </div>
            </div>
          </div>

          {/* Lịch sử giải thưởng & Vinh danh */}
          <div style={{ borderTop: '1px solid rgba(15,23,42,0.06)', paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Lịch sử vinh danh & Giải thưởng đạt được</strong>
              <button
                type="button"
                onClick={loadRecognitions}
                disabled={loadingRecognitions}
                style={{ background: 'transparent', border: 'none', color: '#b45309', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <RefreshCw size={12} className={loadingRecognitions ? 'spin' : ''} /> Làm mới
              </button>
            </div>

            {awardsList.length === 0 ? (
              <div style={{ padding: '18px 14px', background: 'rgba(15,23,42,0.02)', textAlign: 'center', color: '#94a3b8', fontSize: 12, fontWeight: 400 }}>
                Chưa ghi nhận giải thưởng vinh danh nào trong hồ sơ.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {awardsList.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      padding: '10px 14px',
                      background: a.awardType === 'champion' ? 'rgba(245,158,11,0.04)' : 'rgba(124,58,237,0.04)',
                      border: a.awardType === 'champion' ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(124,58,237,0.2)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {a.awardType === 'champion' ? <Trophy size={14} color="#d97706" /> : <Star size={14} color="#7c3aed" />}
                        <strong style={{ fontSize: 12, fontWeight: 600, color: a.awardType === 'champion' ? '#b45309' : '#6d28d9' }}>
                          {a.title}
                        </strong>
                        {a.seasonName && (
                          <span style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(15,23,42,0.06)', color: '#475569', fontWeight: 600 }}>
                            {a.seasonName}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2, fontWeight: 400 }}>
                        {a.reason}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right', fontWeight: 400 }}>
                      {a.awardedAt ? new Date(a.awardedAt).toLocaleDateString('vi-VN') : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SettingSection>

        {/* KHỐI 4: BẢO MẬT ĐĂNG NHẬP */}
        <SettingSection
          icon={ShieldCheck}
          title="Bảo mật & Đổi mật khẩu"
          desc="Cập nhật mật khẩu định kỳ để bảo vệ tài khoản làm việc."
        >
          <form className="settings-form" onSubmit={savePassword}>
            <label>
              <span>Mật khẩu hiện tại *</span>
              <input
                type="password"
                value={password.currentPassword}
                onChange={(event) => setPassword((current) => ({ ...current, currentPassword: event.target.value }))}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </label>
            <label>
              <span>Mật khẩu mới *</span>
              <input
                type="password"
                value={password.newPassword}
                onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))}
                autoComplete="new-password"
                placeholder="Tối thiểu 6 ký tự"
              />
            </label>
            <label>
              <span>Xác nhận mật khẩu mới *</span>
              <input
                type="password"
                value={password.confirmPassword}
                onChange={(event) => setPassword((current) => ({ ...current, confirmPassword: event.target.value }))}
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu mới"
              />
            </label>
            <div className="settings-actions">
              <button type="submit" className="settings-primary-button" disabled={savingPassword}>
                <KeyRound size={15} />
                {savingPassword ? 'Đang đổi...' : 'Cập nhật mật khẩu'}
              </button>
            </div>
          </form>
        </SettingSection>

        {/* KHỐI 5: THÔNG BÁO */}
        <SettingSection
          icon={Bell}
          title="Thông báo hệ thống"
          desc="Cấu hình nhận thông báo thi đấu và âm thanh sự kiện."
        >
          <div className="settings-list">
            <ToggleRow
              icon={Trophy}
              title="Thông báo thi đấu"
              desc="Thông báo khi có cập nhật thứ hạng hoặc giải thưởng mùa giải."
              checked={settingValue(settings, 'notifications', 'competition')}
              onChange={(value) => updateSetting('notifications', 'competition', value)}
            />
            <ToggleRow
              icon={Volume2}
              title="Âm báo"
              desc="Phát âm báo nhẹ khi nhận được tin nhắn hoặc thông báo mới."
              checked={settingValue(settings, 'notifications', 'sound')}
              onChange={(value) => updateSetting('notifications', 'sound', value)}
            />
          </div>
        </SettingSection>

        {/* KHỐI 6: GIAO DIỆN */}
        <SettingSection
          icon={Palette}
          title="Tùy chọn giao diện"
          desc="Tối ưu trải nghiệm hiển thị theo sở thích làm việc."
        >
          <div className="settings-list">
            <div className="settings-segment-row">
              <div>
                <strong>Mật độ hiển thị</strong>
                <span>Chọn khoảng cách nội dung trong app.</span>
              </div>
              <div className="settings-segment">
                {[
                  ['comfortable', 'Thoáng'],
                  ['compact', 'Gọn'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={settingValue(settings, 'appearance', 'density') === value ? 'is-active' : ''}
                    onClick={() => updateSetting('appearance', 'density', value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <ToggleRow
              icon={RotateCcw}
              title="Giảm chuyển động"
              desc="Hạn chế animation và transition cho giao diện."
              checked={settingValue(settings, 'appearance', 'reduceMotion')}
              onChange={(value) => updateSetting('appearance', 'reduceMotion', value)}
            />
            <ToggleRow
              icon={CheckCircle2}
              title="Tăng tương phản"
              desc="Làm viền và chữ phụ rõ hơn trên các màn hình khó nhìn."
              checked={settingValue(settings, 'appearance', 'highContrast')}
              onChange={(value) => updateSetting('appearance', 'highContrast', value)}
            />
          </div>
        </SettingSection>

        {/* KHỐI 7: DỮ LIỆU CỤC BỘ & LIÊN KẾT */}
        <SettingSection
          icon={Database}
          title="Dữ liệu trình duyệt"
          desc="Xóa bộ nhớ tạm và cache cục bộ trên trình duyệt hiện tại."
        >
          <div className="settings-tool-grid">
            <button type="button" onClick={clearNotifications}>
              <Trash2 size={16} />
              <span>Xóa thông báo</span>
            </button>
            <button type="button" onClick={clearAvatar}>
              <UserRound size={16} />
              <span>Xóa avatar local</span>
            </button>
            <button type="button" onClick={restoreDefaults}>
              <Palette size={16} />
              <span>Mặc định cài đặt</span>
            </button>
          </div>
        </SettingSection>

        <SettingSection
          icon={Mail}
          title="Liên kết nhanh"
          desc="Truy cập nhanh các phân hệ nghiệp vụ chính."
        >
          <div className="settings-link-grid">
            <button type="button" onClick={() => navigate(`/users/${user?.id}`)}>Hồ sơ cá nhân</button>
            <button type="button" onClick={() => navigate('/arena')}>Đấu trường mùa giải</button>
            <button type="button" onClick={() => navigate('/grand')}>Giải vô địch năm</button>
            <button type="button" onClick={() => navigate('/leaderboard')}>Bảng xếp hạng</button>
            <button type="button" onClick={() => navigate('/youtube')}>Số liệu YouTube</button>
            {isAdmin && <button type="button" onClick={() => navigate('/admin/privileges')}>Phân quyền & Tích xanh</button>}
          </div>
        </SettingSection>

        {/* KHỐI 9: QUẢN LÝ TRẠNG THÁI TRÒ CHƠI (ADMIN ONLY) */}
        {isAdmin && (
          <SettingSection
            icon={Gamepad2}
            title="Quản Lý Trạng Thái Trò Chơi"
            desc="Cấu hình chế độ phát hành toàn cục cho tất cả trò chơi (Đang hoạt động / Sắp ra mắt). Non-admin không thể vào chơi khi game ở trạng thái Sắp ra mắt."
            className="settings-card-wide"
          >
            {loadingGames ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>Đang tải danh mục game...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {gameCatalog.map((game) => {
                  const Icon = game.gameKey === 'capital_board' ? Gamepad2 : game.gameKey === 'game_2048' ? LayoutGrid : game.gameKey === 'sam' ? Club : Sparkles;
                  const isAvail = game.status === 'AVAILABLE';
                  const isUpdating = updatingGameKey === game.gameKey;
                  return (
                    <div
                      key={game.gameKey}
                      style={{
                        padding: '16px 18px',
                        background: '#f8fafc',
                        border: '1px solid rgba(15,23,42,0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, background: '#ffffff', border: '1px solid rgba(15,23,42,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a' }}>
                            <Icon size={18} />
                          </div>
                          <div>
                            <strong style={{ fontSize: 14, color: '#0f172a' }}>{game.name}</strong>
                            <div style={{ fontSize: 11, color: '#64748b' }}>key: {game.gameKey}</div>
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            textTransform: 'uppercase',
                            background: isAvail ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.15)',
                            color: isAvail ? '#16a34a' : '#d97706',
                            border: `1px solid ${isAvail ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
                          }}
                        >
                          {isAvail ? 'Đang hoạt động' : 'Sắp ra mắt'}
                        </span>
                      </div>

                      <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                        {game.description}
                      </p>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleToggleGameStatus(game.gameKey, game.status)}
                          className={isAvail ? 'settings-secondary-button' : 'settings-primary-button'}
                          style={{
                            fontSize: 12,
                            padding: '6px 14px',
                            cursor: isUpdating ? 'not-allowed' : 'pointer',
                            opacity: isUpdating ? 0.6 : 1,
                          }}
                        >
                          {isUpdating ? 'Đang lưu...' : isAvail ? 'Chuyển thành: Sắp ra mắt' : 'Mở hoạt động (Available)'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SettingSection>
        )}
      </div>

      {/* ── MODAL TRAO GIẢI THƯỞNG CHO ADMIN ── */}
      {showAwardModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: '#ffffff', width: '100%', maxWidth: 480,
            padding: 24, border: '1px solid rgba(15,23,42,0.15)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(15,23,42,0.08)', paddingBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Award size={18} color="#b45309" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.35, color: '#0f172a' }}>
                  Trao Thưởng Danh Hiệu Chính Thức
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAwardModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAdminAward} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Loại Danh Hiệu / Giải Thưởng *
                </label>
                <select
                  value={awardForm.awardType}
                  onChange={(e) => setAwardForm({ ...awardForm, awardType: e.target.value })}
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid #cbd5e1' }}
                >
                  <option value="MVP">MVP — Nhân Viên Xuất Sắc</option>
                  <option value="CHAMPION">CHAMPION — Vô Địch Giải Đấu</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Nhân Viên Nhận Giải *
                </label>
                <select
                  value={awardForm.targetUserId}
                  onChange={(e) => setAwardForm({ ...awardForm, targetUserId: e.target.value })}
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid #cbd5e1' }}
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {userList.map((u) => (
                    <option key={u.id} value={u.id}>
                      #{u.id} - {u.name} ({u.jobTitle || 'Nhân viên'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Mã Mùa Giải (Season ID - Tùy chọn)
                </label>
                <input
                  type="number"
                  value={awardForm.seasonId}
                  onChange={(e) => setAwardForm({ ...awardForm, seasonId: e.target.value })}
                  placeholder="Ví dụ: 1"
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Tiêu Đề Vinh Danh (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={awardForm.title}
                  onChange={(e) => setAwardForm({ ...awardForm, title: e.target.value })}
                  placeholder={awardForm.awardType === 'MVP' ? 'Ví dụ: MVP Mùa Giải #1' : 'Ví dụ: Quán Quân Mùa #1'}
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Lý Do & Căn Cứ Vinh Danh *
                </label>
                <textarea
                  rows={3}
                  required
                  value={awardForm.reason}
                  onChange={(e) => setAwardForm({ ...awardForm, reason: e.target.value })}
                  placeholder="Ghi rõ thành tích, đóng góp nổi bật hoặc chỉ số đạt được..."
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid #cbd5e1', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowAwardModal(false)}
                  style={{ padding: '8px 14px', background: '#ffffff', border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={awarding}
                  className="settings-primary-button"
                  style={{ padding: '8px 18px' }}
                >
                  <Award size={14} /> {awarding ? 'Đang trao giải...' : 'Xác Nhận Trao Giải'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
