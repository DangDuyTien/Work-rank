import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Monitor,
  ShieldCheck,
  UserPlus,
  UserRound,
  Wifi,
} from 'lucide-react';
import api, { auth } from '../services/api';
import { useAuth } from '../context/AuthContext';

function fmtNum(value) {
  const number = Number(value) || 0;
  if (number >= 1000000) return `${(number / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return number.toLocaleString('vi-VN');
}

function normalizeLiveStats(payload = {}) {
  const realtime = payload.realtime || {};
  return {
    online: Number(realtime.usersOnline ?? payload.users ?? 0),
    activeToday: Number(realtime.activeUsersToday ?? 0),
    actionsToday: Number(realtime.actionsToday ?? 0),
    sessionsToday: Number(realtime.sessionsToday ?? 0),
    uptime: payload.uptime || '—',
    cycle: payload.cycle || '5s',
    database: payload.database || 'ok',
    timestamp: payload.timestamp || null,
  };
}

function relativeSyncLabel(timestamp) {
  if (!timestamp) return 'đang chờ đồng bộ';
  const diffSeconds = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (diffSeconds < 15) return 'vừa cập nhật';
  if (diffSeconds < 60) return `${diffSeconds}s trước`;
  return `${Math.floor(diffSeconds / 60)}m trước`;
}

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(false);
  const navigate = useNavigate();
  const { user, setUser, loading: authLoading } = useAuth();

  useEffect(() => {
    const message = sessionStorage.getItem('workrank_auth_message');
    const logoutNotice = sessionStorage.getItem('workrank_auth_notice');
    if (message) {
      setError(message);
      sessionStorage.removeItem('workrank_auth_message');
    }
    if (logoutNotice) {
      setNotice(logoutNotice);
      sessionStorage.removeItem('workrank_auth_notice');
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      auth.clearLocalSession();
      setUser(null);
    }
  }, [authLoading, setUser, user]);

  useEffect(() => {
    let mounted = true;

    const loadStats = async () => {
      try {
        const res = await api.get('/api/health', {
          params: { _: Date.now() },
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!mounted) return;
        setStats(res.data || {});
        setStatsError(false);
      } catch {
        if (!mounted) return;
        setStatsError(true);
      }
    };

    loadStats();
    const timer = window.setInterval(loadStats, 10_000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const live = useMemo(() => normalizeLiveStats(stats || {}), [stats]);
  const statItems = [
    { key: 'online', label: 'đang online', value: fmtNum(live.online), detail: '5 phút gần nhất', icon: Wifi },
    { key: 'active', label: 'active hôm nay', value: fmtNum(live.activeToday), detail: `${fmtNum(live.sessionsToday)} phiên`, icon: Monitor },
    { key: 'actions', label: 'thao tác hôm nay', value: fmtNum(live.actionsToday), detail: 'gõ phím + click', icon: Activity },
    { key: 'uptime', label: 'uptime', value: live.uptime, detail: `sync ${live.cycle}`, icon: ShieldCheck },
  ];
  const statusRows = [
    { label: 'Realtime ingest', value: live.database === 'ok' ? 'Sẵn sàng' : 'Gián đoạn', ok: live.database === 'ok' },
    { label: 'Desktop tracker', value: live.online > 0 ? `${fmtNum(live.online)} phiên đang gửi` : 'Chưa có phiên live', ok: live.online > 0 },
    { label: 'Dữ liệu dashboard', value: relativeSyncLabel(live.timestamp), ok: !statsError },
  ];
  const modeTitle = isRegister ? 'Tạo tài khoản WorkRank' : 'Đăng nhập workspace';
  const SubmitIcon = loading ? Loader2 : isRegister ? UserPlus : ArrowRight;

  const switchMode = (nextIsRegister) => {
    setIsRegister(nextIsRegister);
    setError('');
    setNotice('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const fn = isRegister ? auth.register : auth.login;
      const trimmedEmail = email.trim().toLowerCase();
      const data = isRegister ? { name: name.trim(), email: trimmedEmail, password } : { email: trimmedEmail, password };
      const res = await fn(data);
      const nextUser = res.data.user || res.data;
      if (nextUser) setUser(nextUser);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || (err.request ? 'Không kết nối được backend.' : 'Có lỗi xảy ra'));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || user) return null;

  return (
    <main className="login-page">
      <section className="login-shell">
        <div className="login-brand-panel">
          <div className="login-brand-top">
            <span className="login-logo-block">W</span>
            <div>
              <span className="login-kicker">WorkRank Realtime</span>
              <h1>Workspace tracker</h1>
            </div>
          </div>

          <div className="login-stats" aria-label="Thông số realtime WorkRank">
            {statItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="login-stat-item">
                  <div className="login-stat-head">
                    <Icon size={14} strokeWidth={2.4} />
                    <span>{item.label}</span>
                  </div>
                  <strong>{stats ? item.value : '—'}</strong>
                  <small>{stats ? item.detail : 'đang tải'}</small>
                </div>
              );
            })}
          </div>

          <div className="login-live-panel">
            <div className="login-live-head">
              <span>
                <span className={statsError ? 'login-live-dot is-warn' : 'login-live-dot'} />
                Live system
              </span>
              <em>{statsError ? 'offline data' : relativeSyncLabel(live.timestamp)}</em>
            </div>
            <div className="login-live-list">
              {statusRows.map((row) => (
                <div key={row.label} className="login-live-row">
                  {row.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="login-mode-tabs" aria-label="Chọn chế độ đăng nhập">
            <button type="button" className={!isRegister ? 'is-active' : ''} onClick={() => switchMode(false)}>
              Đăng nhập
            </button>
            <button type="button" className={isRegister ? 'is-active' : ''} onClick={() => switchMode(true)}>
              Đăng ký
            </button>
          </div>

          <div className="login-form-head">
            <h2>{modeTitle}</h2>
          </div>

          {notice && (
            <div className="login-notice">
              <CheckCircle2 size={15} />
              {notice}
            </div>
          )}
          {error && (
            <div className="login-error">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            {isRegister && (
              <div className="login-field">
                <label className="login-field-label" htmlFor="login-name">
                  <UserRound size={13} />
                  Họ tên
                </label>
                <input
                  id="login-name"
                  className="login-input"
                  type="text"
                  value={name}
                  required
                  autoComplete="name"
                  placeholder="Nguyễn Văn A"
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            )}

            <div className="login-field">
              <label className="login-field-label" htmlFor="login-email">
                <Mail size={13} />
                Email
              </label>
              <input
                id="login-email"
                className="login-input"
                type="email"
                value={email}
                required
                autoComplete="email"
                placeholder="user@company.com"
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="login-field">
              <label className="login-field-label" htmlFor="login-password">
                <Lock size={13} />
                Mật khẩu
              </label>
              <div className="login-password-wrap">
                <input
                  id="login-password"
                  className="login-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  required
                  minLength={isRegister ? 6 : undefined}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  placeholder={isRegister ? 'Tối thiểu 6 ký tự' : 'Nhập mật khẩu'}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button className="login-submit" type="submit" disabled={loading}>
              <span>{loading ? 'Đang xử lý...' : isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}</span>
              <SubmitIcon size={16} className={loading ? 'login-spin' : undefined} />
            </button>
          </form>

          <div className="login-divider" />

          <p className="login-switch">
            {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
            <button type="button" className="login-switch-btn" onClick={() => switchMode(!isRegister)}>
              {isRegister ? 'Đăng nhập ngay' : 'Tạo tài khoản'}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
