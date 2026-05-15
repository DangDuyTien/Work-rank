import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  CheckCircle2,
  Database,
  KeyRound,
  Mail,
  Monitor,
  Palette,
  RotateCcw,
  Save,
  ShieldCheck,
  Timer,
  Trash2,
  Trophy,
  UserRound,
  Volume2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UiContext';
import { auth } from '../services/api';
import { removeStoredAvatar } from '../utils/avatar';
import {
  getAppSettings,
  resetAppSettings,
  saveAppSettings,
  subscribeAppSettings,
} from '../utils/settings';

const POMODORO_STORAGE_KEY = 'workrank:pomodoro-state';
const NOTIFICATIONS_CLEARED_EVENT = 'workrank:notifications-cleared';

const POMODORO_PRESETS = [
  { key: 'classic', label: '25 / 5', detail: 'Nhịp Pomodoro phổ biến' },
  { key: 'deep', label: '50 / 10', detail: 'Phiên tập trung sâu' },
  { key: 'sprint', label: '15 / 3', detail: 'Phiên ngắn, dễ bắt đầu' },
];

function roleLabel(role) {
  if (role === 'admin') return 'Quản trị viên';
  if (role === 'manager') return 'Quản lý';
  return 'Người dùng';
}

function statusLabel(status) {
  return status === 'active' ? 'Đang hoạt động' : 'Đã tạm khóa';
}

function settingValue(settings, section, key) {
  return settings?.[section]?.[key];
}

function SettingSection({ icon: Icon, title, desc, children, className = '' }) {
  return (
    <section className={`settings-card ${className}`}>
      <div className="settings-card-head">
        <div className="settings-card-icon">
          <Icon size={18} strokeWidth={2.4} />
        </div>
        <div>
          <h2>{title}</h2>
          <p>{desc}</p>
        </div>
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
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '' });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => subscribeAppSettings(setSettings), []);

  useEffect(() => {
    setProfile({ name: user?.name || '', email: user?.email || '' });
  }, [user?.email, user?.name]);

  const profileDirty = useMemo(() => (
    profile.name.trim() !== String(user?.name || '').trim()
    || profile.email.trim().toLowerCase() !== String(user?.email || '').trim().toLowerCase()
  ), [profile.email, profile.name, user?.email, user?.name]);

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
      toast('Tên và email không được để trống.', { type: 'warning' });
      return;
    }

    setSavingProfile(true);
    try {
      const res = await auth.updateProfile({
        name: profile.name.trim(),
        email: profile.email.trim().toLowerCase(),
      });
      setUser(res.data?.user || res.data);
      toast('Đã cập nhật hồ sơ tài khoản.', { type: 'success' });
    } catch (err) {
      const message = err.response?.status === 409
        ? 'Email này đã được tài khoản khác sử dụng.'
        : err.response?.data?.message || 'Không thể cập nhật hồ sơ.';
      toast(message, { type: 'error' });
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    if (!password.currentPassword || !password.newPassword) {
      toast('Hãy nhập mật khẩu hiện tại và mật khẩu mới.', { type: 'warning' });
      return;
    }
    if (password.newPassword.length < 6) {
      toast('Mật khẩu mới cần ít nhất 6 ký tự.', { type: 'warning' });
      return;
    }
    if (password.newPassword !== password.confirmPassword) {
      toast('Xác nhận mật khẩu mới chưa khớp.', { type: 'warning' });
      return;
    }

    setSavingPassword(true);
    try {
      await auth.changePassword({
        currentPassword: password.currentPassword,
        newPassword: password.newPassword,
      });
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast('Đã đổi mật khẩu.', { type: 'success' });
    } catch (err) {
      const message = err.response?.status === 400
        ? 'Mật khẩu hiện tại không đúng.'
        : err.response?.data?.message || 'Không thể đổi mật khẩu.';
      toast(message, { type: 'error' });
    } finally {
      setSavingPassword(false);
    }
  };

  const clearNotifications = () => {
    localStorage.removeItem(`workrank:notifications:${user?.id || 'guest'}`);
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CLEARED_EVENT, {
      detail: { userId: String(user?.id || '') },
    }));
    toast('Đã xóa thông báo cục bộ.', { type: 'success' });
  };

  const resetPomodoro = () => {
    localStorage.removeItem(POMODORO_STORAGE_KEY);
    toast('Đã đặt lại Pomodoro về mặc định.', { type: 'success' });
  };

  const clearAvatar = () => {
    removeStoredAvatar(user?.id);
    toast('Đã xóa ảnh đại diện lưu trên trình duyệt.', { type: 'success' });
  };

  const restoreDefaults = () => {
    setSettings(resetAppSettings());
    toast('Đã khôi phục tùy chọn mặc định.', { type: 'success' });
  };

  return (
    <div className="settings-page">
      <header className="settings-hero">
        <div>
          <div className="settings-kicker">Trung tâm cài đặt</div>
          <h1>Cài đặt tài khoản và trải nghiệm</h1>
          <p>
            Quản lý hồ sơ, bảo mật, thông báo, tracker, Pomodoro và dữ liệu lưu cục bộ của WorkRank.
          </p>
        </div>
        <div className="settings-account-card">
          <div className="settings-account-avatar">{String(user?.name || user?.email || 'U').slice(0, 2).toUpperCase()}</div>
          <div>
            <strong>{user?.name || 'Người dùng'}</strong>
            <span>{roleLabel(user?.role)} · {statusLabel(user?.status)}</span>
          </div>
        </div>
      </header>

      <div className="settings-grid">
        <SettingSection
          icon={UserRound}
          title="Hồ sơ tài khoản"
          desc="Thông tin này hiển thị trên dashboard, bảng xếp hạng và hồ sơ cá nhân."
          className="settings-card-wide"
        >
          <form className="settings-form" onSubmit={saveProfile}>
            <label>
              <span>Tên hiển thị</span>
              <input
                value={profile.name}
                onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
                maxLength={120}
                placeholder="Tên của bạn"
              />
            </label>
            <label>
              <span>Email đăng nhập</span>
              <input
                type="email"
                value={profile.email}
                onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}
                maxLength={191}
                placeholder="email@example.com"
              />
            </label>
            <div className="settings-readonly-grid">
              <div><span>Vai trò</span><strong>{roleLabel(user?.role)}</strong></div>
              <div><span>Trạng thái</span><strong>{statusLabel(user?.status)}</strong></div>
              <div><span>Tích xanh</span><strong>{user?.isVerified ? 'Đã cấp' : 'Chưa cấp'}</strong></div>
            </div>
            <div className="settings-actions">
              <button type="submit" className="settings-primary-button" disabled={!profileDirty || savingProfile}>
                <Save size={15} />
                {savingProfile ? 'Đang lưu...' : 'Lưu hồ sơ'}
              </button>
              <button type="button" className="settings-secondary-button" onClick={() => navigate(`/users/${user?.id}`)}>
                Mở hồ sơ
              </button>
            </div>
          </form>
        </SettingSection>

        <SettingSection
          icon={ShieldCheck}
          title="Bảo mật đăng nhập"
          desc="Đổi mật khẩu định kỳ nếu bạn dùng WorkRank trên nhiều thiết bị."
        >
          <form className="settings-form" onSubmit={savePassword}>
            <label>
              <span>Mật khẩu hiện tại</span>
              <input
                type="password"
                value={password.currentPassword}
                onChange={(event) => setPassword((current) => ({ ...current, currentPassword: event.target.value }))}
                autoComplete="current-password"
              />
            </label>
            <label>
              <span>Mật khẩu mới</span>
              <input
                type="password"
                value={password.newPassword}
                onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))}
                autoComplete="new-password"
              />
            </label>
            <label>
              <span>Nhập lại mật khẩu mới</span>
              <input
                type="password"
                value={password.confirmPassword}
                onChange={(event) => setPassword((current) => ({ ...current, confirmPassword: event.target.value }))}
                autoComplete="new-password"
              />
            </label>
            <div className="settings-actions">
              <button type="submit" className="settings-primary-button" disabled={savingPassword}>
                <KeyRound size={15} />
                {savingPassword ? 'Đang đổi...' : 'Đổi mật khẩu'}
              </button>
            </div>
          </form>
        </SettingSection>

        <SettingSection
          icon={Bell}
          title="Thông báo"
          desc="Chọn những loại thông báo bạn muốn WorkRank lưu và hiển thị ở thanh trên."
        >
          <div className="settings-list">
            <ToggleRow
              icon={Trophy}
              title="Mốc thao tác"
              desc="Thông báo khi đạt 500, 1k, 2.5k thao tác trong ngày."
              checked={settingValue(settings, 'notifications', 'activityMilestones')}
              onChange={(value) => updateSetting('notifications', 'activityMilestones', value)}
            />
            <ToggleRow
              icon={Monitor}
              title="Nhắc tracker"
              desc="Nhắc khi web mở nhưng Desktop Tracker chưa ghi nhận phiên."
              checked={settingValue(settings, 'notifications', 'trackerIdle')}
              onChange={(value) => updateSetting('notifications', 'trackerIdle', value)}
            />
            <ToggleRow
              icon={Timer}
              title="Pomodoro"
              desc="Thông báo khi hết phiên tập trung hoặc hết giờ nghỉ."
              checked={settingValue(settings, 'notifications', 'pomodoro')}
              onChange={(value) => updateSetting('notifications', 'pomodoro', value)}
            />
            <ToggleRow
              icon={BadgeCheck}
              title="Cuộc thi nhóm"
              desc="Thông báo khi cuộc thi nhóm đến giờ chốt điểm."
              checked={settingValue(settings, 'notifications', 'contests')}
              onChange={(value) => updateSetting('notifications', 'contests', value)}
            />
            <ToggleRow
              icon={AlertTriangle}
              title="Cảnh báo bảo mật"
              desc="Thông báo khi thiết bị bị khóa hoặc có hoạt động nghi vấn."
              checked={settingValue(settings, 'notifications', 'security')}
              onChange={(value) => updateSetting('notifications', 'security', value)}
            />
            <ToggleRow
              icon={Volume2}
              title="Âm báo"
              desc="Phát âm báo nhẹ khi Pomodoro chuyển phiên."
              checked={settingValue(settings, 'notifications', 'sound')}
              onChange={(value) => updateSetting('notifications', 'sound', value)}
            />
          </div>
        </SettingSection>

        <SettingSection
          icon={Monitor}
          title="Tracker và Pomodoro"
          desc="Điều chỉnh cách web phối hợp với Desktop Tracker và bộ đếm Pomodoro."
        >
          <div className="settings-list">
            <ToggleRow
              icon={Monitor}
              title="Tự mở Desktop Tracker"
              desc="Khi bấm bắt đầu theo dõi, web sẽ thử mở app desktop qua workrank://."
              checked={settingValue(settings, 'tracker', 'autoLaunchDesktop')}
              onChange={(value) => updateSetting('tracker', 'autoLaunchDesktop', value)}
            />
            <ToggleRow
              icon={Timer}
              title="Pomodoro tự bật tracker"
              desc="Khi bắt đầu phiên tập trung, tracker cũng được bật nếu đang dừng."
              checked={settingValue(settings, 'tracker', 'autoStartWithPomodoro')}
              onChange={(value) => updateSetting('tracker', 'autoStartWithPomodoro', value)}
            />
            <label className="settings-select-row">
              <span>
                <strong>Preset Pomodoro mặc định</strong>
                <em>Dùng cho phiên Pomodoro mới sau khi reset.</em>
              </span>
              <select
                value={settingValue(settings, 'pomodoro', 'defaultPreset')}
                onChange={(event) => updateSetting('pomodoro', 'defaultPreset', event.target.value)}
              >
                {POMODORO_PRESETS.map((preset) => (
                  <option key={preset.key} value={preset.key}>{preset.label} · {preset.detail}</option>
                ))}
              </select>
            </label>
          </div>
        </SettingSection>

        <SettingSection
          icon={Palette}
          title="Giao diện"
          desc="Các tùy chọn này lưu trên trình duyệt hiện tại và áp dụng ngay khi đổi."
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

        <SettingSection
          icon={Database}
          title="Dữ liệu trên trình duyệt"
          desc="Các mục này chỉ xóa dữ liệu cục bộ ở máy hiện tại, không xóa thống kê trên server."
        >
          <div className="settings-tool-grid">
            <button type="button" onClick={clearNotifications}>
              <Trash2 size={16} />
              <span>Xóa thông báo</span>
            </button>
            <button type="button" onClick={resetPomodoro}>
              <RotateCcw size={16} />
              <span>Reset Pomodoro</span>
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
          desc="Các khu vực liên quan đến cài đặt tài khoản trong WorkRank."
        >
          <div className="settings-link-grid">
            <button type="button" onClick={() => navigate(`/users/${user?.id}`)}>Hồ sơ cá nhân</button>
            <button type="button" onClick={() => navigate('/tracker')}>Desktop Tracker</button>
            <button type="button" onClick={() => navigate('/groups')}>Nhóm làm việc</button>
            {isAdmin && <button type="button" onClick={() => navigate('/security')}>Bảo mật hệ thống</button>}
          </div>
        </SettingSection>
      </div>
    </div>
  );
}
