import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Award,
  BadgeCheck,
  Bell,
  CheckCircle2,
  Code,
  Database,
  ExternalLink,
  KeyRound,
  Mail,
  Palette,
  Phone,
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
  Volume2,
  X,
  Lightbulb,
  Check,
  Wrench,
  Gamepad2,
  Keyboard,
  LayoutGrid,
  Club,
  Activity,
  Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UiContext';
import { parseApiError } from '../utils/errors';
import { auth, users as usersApi, gameCatalogApi } from '../services/api';
import VerifiedBadge from '../components/VerifiedBadge';
import { AnimatedModal } from '../components/ui';
import JobTitleBadge from '../components/JobTitleBadge';
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

function SettingSection({ id, icon: Icon, title, desc, children, className = '', action = null }) {
  return (
    <section id={id} className={`settings-card ${className}`} style={id ? { scrollMarginTop: 80 } : undefined}>
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
  const location = useLocation();
  const toast = useToast();
  const { user, setUser, isAdmin, logout } = useAuth();
  const [settings, setSettings] = useState(getAppSettings);

  const requestedSection = new URLSearchParams(location.search).get('tab');
  useEffect(() => {
    const targetId = requestedSection === 'profile'
      ? 'settings-profile'
      : requestedSection === 'games' && isAdmin ? 'settings-games' : null;
    if (!targetId) return;
    if (location.hash !== `#${targetId}`) {
      navigate({ pathname: location.pathname, search: location.search, hash: `#${targetId}` }, { replace: true, state: location.state });
      return;
    }
    // The lazy page can mount after Layout's initial hash scroll.
    const frame = requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        || document.documentElement.dataset.workrankReduceMotion === 'true';
      document.getElementById(targetId)?.scrollIntoView({
        block: 'start', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [isAdmin, location.hash, location.pathname, location.search, location.state, navigate, requestedSection]);

  // Self-delete account states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Email Change state
  const [emailForm, setEmailForm] = useState({
    newEmail: '',
    confirmEmail: '',
    currentPassword: '',
  });
  const [savingEmail, setSavingEmail] = useState(false);

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

  useEffect(() => subscribeAppSettings(setSettings), []);

  useEffect(() => {
    setProfile({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      bio: user?.bio || '',
      avatarData: user?.avatarData || getStoredAvatar(user?.id) || '',
    });
  }, [user?.avatarData, user?.bio, user?.email, user?.id, user?.name, user?.phone]);

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
    || profile.phone.trim() !== String(user?.phone || '').trim()
    || profile.bio.trim() !== String(user?.bio || '').trim()
    || profile.avatarData !== (user?.avatarData || getStoredAvatar(user?.id) || '')
  ), [profile.avatarData, profile.bio, profile.name, profile.phone, user?.avatarData, user?.bio, user?.id, user?.name, user?.phone]);

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
    if (!profile.name.trim()) {
      toast.warning('Tên hiển thị không được để trống.');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await usersApi.update(user.id, {
        name: profile.name.trim(),
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

  const saveEmail = async (event) => {
    event.preventDefault();
    const newEmail = emailForm.newEmail.trim().toLowerCase();
    const confirmEmail = emailForm.confirmEmail.trim().toLowerCase();
    if (!newEmail) {
      toast.warning('Vui lòng nhập địa chỉ email mới.');
      return;
    }
    if (newEmail === String(user?.email || '').toLowerCase()) {
      toast.warning('Email mới không được trùng với email hiện tại.');
      return;
    }
    if (newEmail !== confirmEmail) {
      toast.warning('Xác nhận email mới không khớp.');
      return;
    }
    if (!emailForm.currentPassword) {
      toast.warning('Vui lòng nhập mật khẩu hiện tại để xác thực đổi email.');
      return;
    }

    setSavingEmail(true);
    try {
      const res = await auth.changeEmail({
        newEmail,
        currentPassword: emailForm.currentPassword,
      });
      if (res?.user) {
        setUser((prev) => ({ ...prev, email: res.user.email }));
        setProfile((prev) => ({ ...prev, email: res.user.email }));
      }
      setEmailForm({ newEmail: '', confirmEmail: '', currentPassword: '' });
      toast.success(res?.message || 'Đổi email đăng nhập thành công!');
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể đổi email. Vui lòng kiểm tra lại mật khẩu hoặc địa chỉ email.'));
    } finally {
      setSavingEmail(false);
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

  const handleSelfDeleteAccount = async (event) => {
    if (event && event.preventDefault) event.preventDefault();
    if (!deletePassword) {
      toast.warning('Vui lòng nhập mật khẩu xác nhận để xóa tài khoản.');
      return;
    }
    setIsDeletingAccount(true);
    try {
      await auth.deleteAccount(deletePassword);
      toast.success('Tài khoản của bạn đã được xóa thành công.');
      setShowDeleteModal(false);
      setDeletePassword('');
      await logout(true);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể xóa tài khoản. Vui lòng kiểm tra lại mật khẩu.'));
    } finally {
      setIsDeletingAccount(false);
    }
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
          <div className="settings-kicker">Cài đặt cá nhân</div>
          <h1>Cài đặt tài khoản</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Hồ sơ cá nhân, bảo mật và tùy chọn trình duyệt.
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
          id="settings-profile"
          icon={UserRound}
          title="Thông tin cá nhân & Liên hệ"
          desc="Thông tin cơ bản hiển thị trên hồ sơ làm việc nội bộ của bạn."
          className="settings-card-wide"
        >
          <form className="settings-form" onSubmit={saveProfile}>
            {/* Ảnh đại diện Avatar */}
            <div style={{ padding: '12px 14px', background: 'var(--surface-soft)', border: '1px solid rgba(15,23,42,0.08)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 4 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '2px solid var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--info-soft)',
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
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>
                    {initialsFromName(profile.name || user?.name || 'U')}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Ảnh Đại Diện (Avatar)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <label style={{ cursor: 'pointer', padding: '5px 12px', background: 'var(--text-primary)', color: 'var(--surface)', fontSize: 12, fontWeight: 600, borderRadius: 'var(--radius-interactive)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span>Email đăng nhập</span>
                  <a
                    href="#sec-change-email"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('sec-change-email')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
                  >
                    Đổi email →
                  </a>
                </div>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  readOnly
                  style={{ background: 'var(--surface-soft)', color: 'var(--text-secondary)', cursor: 'not-allowed' }}
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
                  style={{ background: 'var(--surface-soft)', color: 'var(--text-secondary)' }}
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
                  borderRadius: 'var(--radius-interactive)',
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
            <div style={{ padding: '12px 14px', background: 'var(--surface-soft)', border: '1px solid rgba(15,23,42,0.08)' }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Huy hiệu chức danh</span>
              <div style={{ marginTop: 6 }}>
                <JobTitleBadge jobTitle={user?.jobTitle} size="md" />
              </div>
            </div>

            <div style={{ padding: '12px 14px', background: 'var(--surface-soft)', border: '1px solid rgba(15,23,42,0.08)' }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Phòng ban trực thuộc</span>
              <strong style={{ display: 'block', marginTop: 4, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                {user?.department || 'Media & Content'}
              </strong>
            </div>

            <div style={{ padding: '12px 14px', background: 'var(--surface-soft)', border: '1px solid rgba(15,23,42,0.08)' }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Quyền hệ thống (RBAC)</span>
              <strong style={{ display: 'block', marginTop: 4, fontSize: 15, fontWeight: 600, color: user?.role === 'admin' ? '#dc2626' : 'var(--text-primary)' }}>
                {roleLabel(user?.role)}
              </strong>
            </div>

            <div style={{ padding: '12px 14px', background: 'var(--surface-soft)', border: '1px solid rgba(15,23,42,0.08)' }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Trạng thái tài khoản</span>
              <strong style={{ display: 'block', marginTop: 4, fontSize: 15, fontWeight: 600, color: '#16a34a' }}>
                {statusLabel(user?.status)}
              </strong>
            </div>
          </div>

          {isAdmin ? (
            <div className="settings-actions">
              <button type="button" className="settings-secondary-button" onClick={() => navigate('/admin/privileges')}>
                <ExternalLink size={14} /> Quản lý hồ sơ & phân quyền nhân sự
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.06)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <Lightbulb size={14} color="var(--accent)" />
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
                onClick={() => navigate('/admin/privileges')}
                className="settings-primary-button"
                style={{ fontSize: 11, padding: '0 10px', minHeight: 30 }}
              >
                <ExternalLink size={13} /> Quản lý vinh danh
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
                color: isVerifiedBadge ? 'var(--accent)' : 'var(--text-muted)',
              }}>
                <BadgeCheck size={20} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isVerifiedBadge ? 'var(--accent)' : 'var(--text-primary)' }}>
                  Đã Xác Minh (Verified)
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, fontWeight: 400 }}>
                  {isVerifiedBadge ? 'Tài khoản đã xác thực tích xanh chính thức' : 'Chưa cấp tích xanh'}
                </div>
              </div>
            </div>

            {/* 2. Developer */}
            <div style={{
              padding: 14,
              background: isDevBadge ? 'var(--info-soft)' : 'var(--surface-hover)',
              border: isDevBadge ? '1px solid var(--info-border)' : '1px solid var(--border)',
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isDevBadge ? 'var(--info-border)' : 'var(--surface-active)',
                color: isDevBadge ? 'var(--info)' : 'var(--text-muted)',
              }}>
                <Code size={20} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isDevBadge ? 'var(--info)' : 'var(--text-primary)' }}>
                  Developer (Kỹ Thuật)
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, fontWeight: 400 }}>
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
                color: isChampionBadge ? '#d97706' : 'var(--text-muted)',
              }}>
                <Trophy size={20} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isChampionBadge ? '#d97706' : 'var(--text-secondary)' }}>
                  {isChampionBadge ? `Vô Địch Giải Đấu ${championCount > 1 ? `(x${championCount})` : ''}` : 'Chưa Có Cúp Vô Địch'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, fontWeight: 400 }}>
                  {isChampionBadge ? `Đạt ${championCount} cúp vô địch mùa giải` : 'Chưa tham gia hoặc chưa vô địch mùa giải'}
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
                color: isMvpBadge ? 'var(--accent)' : 'var(--text-muted)',
              }}>
                <Star size={20} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isMvpBadge ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  {isMvpBadge ? `Nhân Viên Xuất Sắc ${mvpCount > 1 ? `(x${mvpCount})` : ''}` : 'Chưa Có Danh Hiệu MVP'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, fontWeight: 400 }}>
                  {isMvpBadge ? `Đã nhận ${mvpCount} danh hiệu MVP xuất sắc` : 'Chưa có danh hiệu vinh danh xuất sắc'}
                </div>
              </div>
            </div>
          </div>

          {/* Lịch sử giải thưởng & Vinh danh */}
          <div style={{ borderTop: '1px solid rgba(15,23,42,0.06)', paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Lịch sử vinh danh & Giải thưởng đạt được</strong>
              <button
                type="button"
                onClick={loadRecognitions}
                disabled={loadingRecognitions}
                style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <RefreshCw size={12} className={loadingRecognitions ? 'spin' : ''} /> Làm mới
              </button>
            </div>

            {awardsList.length === 0 ? (
              <div style={{ padding: '18px 14px', background: 'rgba(15,23,42,0.02)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, fontWeight: 400 }}>
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
                        <strong style={{ fontSize: 12, fontWeight: 600, color: a.awardType === 'champion' ? 'var(--accent)' : '#6d28d9' }}>
                          {a.title}
                        </strong>
                        {a.seasonName && (
                          <span style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(15,23,42,0.06)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            {a.seasonName}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, fontWeight: 400 }}>
                        {a.reason}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', fontWeight: 400 }}>
                      {a.awardedAt ? new Date(a.awardedAt).toLocaleDateString('vi-VN') : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SettingSection>

        {/* KHỐI 4: BẢO MẬT ĐỔI MẬT KHẨU */}
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

        {/* KHỐI 4B: ĐỔI EMAIL ĐĂNG NHẬP */}
        <div id="sec-change-email" style={{ scrollMarginTop: 80 }}>
          <SettingSection
            icon={Mail}
            title="Bảo mật & Đổi Email Đăng Nhập"
            desc="Cập nhật địa chỉ email dùng để đăng nhập và nhận thông báo quan trọng."
          >
            <form className="settings-form" onSubmit={saveEmail}>
              <label>
                <span>Email hiện tại</span>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  readOnly
                  style={{ background: 'var(--surface-soft)', color: 'var(--text-secondary)', cursor: 'not-allowed' }}
                />
              </label>
              <label>
                <span>Địa chỉ Email mới *</span>
                <input
                  type="email"
                  required
                  value={emailForm.newEmail}
                  onChange={(event) => setEmailForm((prev) => ({ ...prev, newEmail: event.target.value }))}
                  placeholder="new-email@workrank.io"
                  autoComplete="email"
                />
              </label>
              <label>
                <span>Xác nhận lại Email mới *</span>
                <input
                  type="email"
                  required
                  value={emailForm.confirmEmail}
                  onChange={(event) => setEmailForm((prev) => ({ ...prev, confirmEmail: event.target.value }))}
                  placeholder="Nhập lại chính xác email mới"
                  autoComplete="email"
                />
              </label>
              <label>
                <span>Mật khẩu tài khoản hiện tại *</span>
                <input
                  type="password"
                  required
                  value={emailForm.currentPassword}
                  onChange={(event) => setEmailForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu để xác thực"
                />
              </label>
              <div className="settings-actions">
                <button
                  type="submit"
                  className="settings-primary-button"
                  disabled={savingEmail || !emailForm.newEmail || !emailForm.currentPassword}
                >
                  <Save size={15} />
                  {savingEmail ? 'Đang cập nhật email...' : 'Lưu Email Mới'}
                </button>
              </div>
            </form>
          </SettingSection>
        </div>

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
            id="settings-games"
            icon={Gamepad2}
            title="Quản Lý Trạng Thái Trò Chơi"
            desc="Cấu hình chế độ phát hành toàn cục cho tất cả trò chơi (Đang hoạt động / Sắp ra mắt). Non-admin không thể vào chơi khi game ở trạng thái Sắp ra mắt."
            className="settings-card-wide"
          >
            {loadingGames ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>Đang tải danh mục game...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                {gameCatalog.map((game) => {
                  const Icon =
                    game.gameKey === 'typing_battle' || game.gameKey === 'typing'
                      ? Keyboard
                      : game.gameKey === 'capital_board'
                      ? Gamepad2
                      : game.gameKey === 'game_2048'
                      ? LayoutGrid
                      : game.gameKey === 'sam'
                      ? Club
                      : Sparkles;
                  const isAvail = game.status === 'AVAILABLE';
                  const isUpdating = updatingGameKey === game.gameKey;
                  return (
                    <div
                      key={game.gameKey}
                      style={{
                        padding: '16px 18px',
                        background: 'var(--surface-soft)',
                        border: '1px solid rgba(15,23,42,0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, background: 'var(--surface)', border: '1px solid rgba(15,23,42,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>
                            <Icon size={18} />
                          </div>
                          <div>
                            <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>{game.name}</strong>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>key: {game.gameKey}</div>
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

                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
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

        {/* KHỐI 10: VÙNG NGUY HIỂM - XÓA TÀI KHOẢN (SELF-DELETE) */}
        <SettingSection
          icon={Trash2}
          title="Vùng Nguy Hiểm — Xóa Tài Khoản"
          desc="Xóa vĩnh viễn quyền truy cập tài khoản của bạn khỏi hệ thống WorkRank."
          className="settings-card-wide"
        >
          <div style={{
            padding: '16px 18px',
            background: 'rgba(239,68,68,0.04)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(239,68,68,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#dc2626',
                flexShrink: 0,
              }}>
                <Trash2 size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>
                  Hành động này không thể hoàn tác
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Khi xóa tài khoản, tất cả phiên đăng nhập sẽ bị vô hiệu hóa ngay lập tức. Thông tin cá nhân (Email, Tên, Avatar) sẽ được ẩn danh. Bạn sẽ rời khỏi các đội nhóm đang tham gia và hủy quyền quản trị kênh YouTube liên kết (kênh YouTube và lịch sử điểm số/thứ hạng của các mùa giải trước vẫn được bảo toàn dữ liệu cho tập thể).
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid rgba(239,68,68,0.1)' }}>
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 18px',
                  background: '#dc2626',
                  color: 'var(--surface)',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background var(--motion-fast) var(--ease-standard)',
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'var(--danger)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#dc2626'; }}
              >
                <Trash2 size={15} />
                Xóa tài khoản của tôi
              </button>
            </div>
          </div>
        </SettingSection>
      </div>

      {/* ── MODAL XÁC NHẬN XÓA TÀI KHOẢN (SELF-DELETE) ── */}
      <AnimatedModal
        isOpen={showDeleteModal}
        onClose={() => !isDeletingAccount && setShowDeleteModal(false)}
        title="Xác Nhận Xóa Tài Khoản Cá Nhân"
        maxWidth={480}
        dialogStyle={{ border: '1px solid rgba(239,68,68,0.3)' }}
      >
        <form onSubmit={handleSelfDeleteAccount}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Bạn đang chuẩn bị xóa tài khoản <strong>{user?.name || user?.email}</strong> (WR ID: <code>{user?.id}</code>).
            </p>

            <div style={{
              padding: '12px 14px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 4,
              fontSize: 12,
              color: '#991b1b',
              lineHeight: 1.5,
              marginBottom: 12,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Lưu ý an toàn quan trọng:</div>
              <ul style={{ margin: 0, paddingLeft: 18, listStyleType: 'disc' }}>
                <li>Tất cả phiên đăng nhập sẽ bị kết thúc và đăng xuất ngay lập tức.</li>
                <li>Email và thông tin định danh sẽ được ẩn danh.</li>
                <li>Nếu bạn là trưởng nhóm, quyền sở hữu nhóm sẽ được giải phóng.</li>
                <li>Kênh YouTube (nếu có) sẽ chuyển sang trạng thái chưa gán người phụ trách.</li>
                <li>Lịch sử thành tích mùa giải vẫn được bảo lưu cho tập thể.</li>
              </ul>
            </div>

            <div style={{ marginTop: 12, marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                Nhập mật khẩu tài khoản hiện tại để xác nhận: *
              </label>
              <input
                type="password"
                required
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Mật khẩu của bạn..."
                autoComplete="current-password"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: 13,
                  border: '1px solid var(--border-2)',
                  borderRadius: 4,
                  outline: 'none',
                  background: 'var(--surface)',
                }}
              />
            </div>

            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Bạn có chắc chắn muốn xóa tài khoản này không?
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button
              type="button"
              disabled={isDeletingAccount}
              onClick={() => {
                setShowDeleteModal(false);
                setDeletePassword('');
              }}
              style={{
                padding: '9px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--border-2)',
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                cursor: isDeletingAccount ? 'not-allowed' : 'pointer',
              }}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isDeletingAccount || !deletePassword}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 18px',
                background: '#dc2626',
                border: 'none',
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--surface)',
                cursor: isDeletingAccount || !deletePassword ? 'not-allowed' : 'pointer',
                opacity: isDeletingAccount || !deletePassword ? 0.7 : 1,
              }}
            >
              <Trash2 size={15} />
              {isDeletingAccount ? 'Đang xử lý xóa...' : 'Đồng ý xóa vĩnh viễn'}
            </button>
          </div>
        </form>
      </AnimatedModal>

    </div>
  );
}
