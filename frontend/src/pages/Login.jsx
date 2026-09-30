import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LogIn,
  UserPlus,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Tv,
  Swords,
  Trophy,
  Star,
  Crown,
  Sparkles,
  Award,
  Gamepad2,
  Lock,
  Mail,
  UserRound,
  Loader2,
  HelpCircle,
  X,
  LogOut,
  Users,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import VerifiedBadge from '../components/VerifiedBadge';
import { initialsFromName } from '../utils/avatar';
import { auth, competition } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser, logout } = useAuth();

  const [spotlight, setSpotlight] = useState({
    hasSpotlight: false,
    season: null,
    championTeam: null,
    mvp: null,
  });

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('mode') === 'register') {
      setIsRegister(true);
    }
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

    let isMounted = true;
    competition
      .getPublicSpotlight()
      .then((data) => {
        if (isMounted && data) {
          setSpotlight(data);
        }
      })
      .catch((err) => {
        console.warn('Failed to load public spotlight on login page:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [location.search]);

  const { season, championTeam, mvp } = spotlight;

  const switchMode = (mode) => {
    setIsRegister(mode);
    setError('');
    setNotice('');
    const params = new URLSearchParams(location.search);
    if (mode) {
      params.set('mode', 'register');
    } else {
      params.delete('mode');
    }
    navigate({ search: params.toString() }, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (isRegister) {
      if (!name.trim()) {
        setError('Vui lòng nhập họ và tên');
        return;
      }
      if (password.length < 6) {
        setError('Mật khẩu phải có ít nhất 6 ký tự');
        return;
      }
      if (password !== confirmPassword) {
        setError('Mật khẩu xác nhận không khớp');
        return;
      }
    }

    setLoading(true);
    try {
      if (isRegister) {
        const res = await auth.register(email, password, name.trim());
        if (res.data?.user) {
          setUser(res.data.user);
          navigate('/dashboard');
        } else {
          setNotice('Đăng ký thành công! Vui lòng đăng nhập.');
          setIsRegister(false);
        }
      } else {
        const res = await auth.login(email, password);
        if (res.data?.user) {
          setUser(res.data.user);
          const from = location.state?.from?.pathname || '/dashboard';
          navigate(from, { replace: true });
        }
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="login-page-wrapper"
      style={{
        width: '100vw',
        minHeight: '100vh',
        background: '#f4f3ef',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* ── AUTH CONTAINER (Editorial Warm Aesthetic) ── */}
      <div
        style={{
          width: '100%',
          maxWidth: 960,
          background: '#ffffff',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 16,
          boxShadow: '0 16px 40px rgba(0,0,0,0.06)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          overflow: 'hidden',
        }}
      >
        {/* ── LEFT PANEL: SEASON MVP RECOGNITION ── */}
        <div
          style={{
            background: '#141414',
            color: '#ffffff',
            padding: '40px 36px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderRight: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          <div>
            {/* Brand Header */}
            <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <BrandMark size={36} showLabel label="3WIN MEDIA" labelStyle={{ color: '#ffffff' }} />
            </Link>

            {/* Season & MVP Eyebrow Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                background: 'rgba(180, 83, 9, 0.2)',
                border: '1px solid rgba(180, 83, 9, 0.45)',
                borderRadius: 9999,
                marginBottom: 16,
              }}
            >
              <Star size={13} color="#facc15" />
              <span style={{ fontSize: 10, fontWeight: 900, color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                {season?.name ? `${season.name} • MVP MÙA GIẢI` : 'MÙA GIẢI HIỆN TẠI • MVP VINH DANH'}
              </span>
            </div>

            <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 900, color: '#ffffff', lineHeight: 1.25 }}>
              {mvp ? mvp.name : 'Vinh Danh MVP Mùa Giải'}
            </h1>

            <p style={{ margin: 0, fontSize: 13, color: '#a3a3a3', lineHeight: 1.55 }}>
              {mvp?.reason || 'Vinh danh cá nhân có hiệu suất đóng góp cao nhất và chỉ số tăng trưởng ấn tượng nhất trong mùa thi đấu.'}
            </p>

            {/* MVP Featured Spotlight Card */}
            <div
              style={{
                marginTop: 22,
                padding: 18,
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1.5px solid rgba(180, 83, 9, 0.4)',
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Avatar Box */}
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 10,
                    background: '#1f1f1f',
                    border: '2px solid #b45309',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                    position: 'relative',
                    boxShadow: '0 4px 16px rgba(180, 83, 9, 0.3)',
                  }}
                >
                  {mvp?.avatarData ? (
                    <img src={mvp.avatarData} alt={mvp.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : mvp ? (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 900, color: '#facc15' }}>
                      {initialsFromName(mvp.name)}
                    </span>
                  ) : (
                    <UserRound size={30} color="#facc15" strokeWidth={2} />
                  )}
                  {mvp?.isVerified && (
                    <div style={{ position: 'absolute', bottom: 2, right: 2 }}>
                      <VerifiedBadge size={14} />
                    </div>
                  )}
                </div>

                {/* Identity info */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mvp ? mvp.name : 'Chờ vinh danh'}
                    </span>
                    {mvp?.isVerified && <VerifiedBadge size={14} />}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    {mvp?.awardTitle || 'Danh hiệu MVP Cá Nhân'}
                  </div>
                  <div style={{ fontSize: 11, color: '#a3a3a3', marginTop: 2 }}>
                    {mvp ? `${mvp.jobTitle || 'Chuyên viên'} • ${mvp.department || 'Media Team'}` : 'Đang cập nhật'}
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                }}
              >
                <div style={{ padding: '8px 10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#888888', textTransform: 'uppercase' }}>Điểm Mùa Giải</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#facc15', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                    {mvp?.score !== undefined ? `${mvp.score.toLocaleString()} XP` : 'Dẫn Đầu BXH'}
                  </div>
                </div>
                <div style={{ padding: '8px 10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#888888', textTransform: 'uppercase' }}>Đội Quán Quân</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#ffffff', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {championTeam?.teamName || '3Win Studio'}
                  </div>
                </div>
              </div>
            </div>

            {/* Motivational Bullet Points */}
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#d4d4d4' }}>
                <Crown size={15} color="#f59e0b" style={{ flexShrink: 0 }} />
                <span>Thi đấu sản lượng & hoàn thành thử thách tích điểm</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#f59e0b', flexShrink: 0 }}>
                <Trophy size={15} color="#f59e0b" style={{ flexShrink: 0 }} />
                <span style={{ color: '#d4d4d4' }}>Vinh danh MVP & nhận giải thưởng lớn chung cuộc</span>
              </div>
            </div>
          </div>

          {/* Bottom Security Note */}
          <div
            style={{
              marginTop: 28,
              paddingTop: 16,
              borderTop: '1px solid rgba(255,255,255,0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              color: '#a3a3a3',
            }}
          >
            <Sparkles size={15} color="#b45309" />
            <span>Hệ thống vinh danh tự động theo thời gian thực • WorkRank 3Win</span>
          </div>
        </div>

        {/* ── RIGHT PANEL: AUTH FORMS & STATE ── */}
        <div
          style={{
            padding: '40px 36px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            background: '#ffffff',
          }}
        >
          {/* Active session banner */}
          {user && (
            <div
              style={{
                marginBottom: 20,
                padding: '14px 16px',
                background: 'rgba(180,83,9,0.06)',
                border: '1px solid rgba(180,83,9,0.25)',
                borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <CheckCircle2 size={18} color="#b45309" />
                <span style={{ fontSize: 13, fontWeight: 900, color: '#111111' }}>
                  Bạn đang đăng nhập
                </span>
              </div>

              <div style={{ fontSize: 12, color: '#555555', marginBottom: 12 }}>
                Tài khoản: <strong style={{ color: '#111111' }}>{user.name}</strong> ({user.email})
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '9px 14px',
                    background: '#141414',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#2b2b2b'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#141414'; }}
                >
                  <span>Mở Dashboard</span>
                  <ArrowRight size={14} />
                </button>

                <button
                  type="button"
                  onClick={logout}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '9px 12px',
                    background: '#ffffff',
                    color: '#b91c1c',
                    border: '1px solid rgba(185,28,28,0.25)',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(185,28,28,0.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                >
                  <LogOut size={13} />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          )}

          {/* Mode Switcher Tabs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              background: '#f4f3ef',
              padding: 4,
              borderRadius: 8,
              marginBottom: 24,
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <button
              type="button"
              onClick={() => switchMode(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '9px',
                background: !isRegister ? '#ffffff' : 'transparent',
                color: !isRegister ? '#111111' : '#666666',
                border: !isRegister ? '1px solid rgba(0,0,0,0.08)' : 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: !isRegister ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <LogIn size={15} />
              <span>Đăng nhập</span>
            </button>

            <button
              type="button"
              onClick={() => switchMode(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '9px',
                background: isRegister ? '#ffffff' : 'transparent',
                color: isRegister ? '#111111' : '#666666',
                border: isRegister ? '1px solid rgba(0,0,0,0.08)' : 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: isRegister ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <UserPlus size={15} />
              <span>Đăng ký</span>
            </button>
          </div>

          {/* Form Header */}
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#111111' }}>
              {isRegister ? 'Tạo Tài Khoản Thành Viên' : 'Đăng Nhập Workspace'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666666' }}>
              {isRegister
                ? 'Nhập thông tin cá nhân để bắt đầu làm việc và thi đấu trên WorkRank'
                : 'Sử dụng email công việc và mật khẩu để truy cập vào hệ thống'}
            </p>
          </div>

          {/* Flash Notice */}
          {notice && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#15803d',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              <CheckCircle2 size={16} />
              <span>{notice}</span>
            </div>
          )}

          {/* Flash Error */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '10px 14px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                lineHeight: 1.45,
                marginBottom: 16,
              }}
            >
              <AlertCircle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Auth Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Name Field (Register only) */}
            {isRegister && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#111111', marginBottom: 6 }}>
                  Họ và tên *
                </label>
                <div style={{ position: 'relative' }}>
                  <UserRound size={16} color="#777777" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ví dụ: Nguyễn Văn A"
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      borderRadius: 8,
                      border: '1px solid rgba(0,0,0,0.14)',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                      background: '#ffffff',
                      color: '#111111',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#111111', marginBottom: 6 }}>
                Email công việc *
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="#777777" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoComplete="email"
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.14)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: '#ffffff',
                    color: '#111111',
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: '#111111' }}>
                  Mật khẩu *
                </label>

                {!isRegister && (
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#b45309',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Quên mật khẩu?
                  </button>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <Lock size={16} color="#777777" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegister ? 'Tối thiểu 6 ký tự' : 'Nhập mật khẩu của bạn'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 38px',
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.14)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: '#ffffff',
                    color: '#111111',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#777777',
                    cursor: 'pointer',
                    padding: 4,
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password Field (Register only) */}
            {isRegister && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#111111', marginBottom: 6 }}>
                  Xác nhận mật khẩu *
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#777777" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu để xác nhận"
                    autoComplete="new-password"
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 38px',
                      borderRadius: 8,
                      border: '1px solid rgba(0,0,0,0.14)',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                      background: '#ffffff',
                      color: '#111111',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#777777',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 20px',
                background: '#141414',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 900,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                marginTop: 8,
                transition: 'background 0.15s ease, transform 0.1s ease',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#2b2b2b'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#141414'; }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Đang xử lý...</span>
                </>
              ) : isRegister ? (
                <>
                  <span>Tạo Tài Khoản Mới</span>
                  <UserPlus size={16} />
                </>
              ) : (
                <>
                  <span>Đăng Nhập Vào Hệ Thống</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Switch Prompt */}
          <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: '#666666' }}>
            {isRegister ? 'Đã có tài khoản thành viên?' : 'Chưa có tài khoản trên hệ thống?'}{' '}
            <button
              type="button"
              onClick={() => switchMode(!isRegister)}
              style={{
                background: 'none',
                border: 'none',
                color: '#b45309',
                fontWeight: 800,
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              {isRegister ? 'Đăng nhập ngay' : 'Đăng ký tài khoản'}
            </button>
          </div>
        </div>
      </div>

      {/* ── FORGOT PASSWORD / ADMIN CONTACT MODAL ── */}
      {showForgotPasswordModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.08)',
              padding: 24,
              width: '100%',
              maxWidth: 440,
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 900, color: '#111111' }}>
                <HelpCircle size={20} color="#b45309" />
                <span>Hướng Dẫn Cấp Lại Mật Khẩu</span>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(false)}
                style={{ background: 'none', border: 'none', color: '#777777', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: 13, color: '#555555', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 12px' }}>
                Nhằm đảm bảo an toàn dữ liệu và tuân thủ chính sách bảo mật nội bộ của <strong>WorkRank</strong>, mật khẩu tài khoản được quản lý tập trung.
              </p>
              <div style={{ background: '#f4f3ef', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontWeight: 800, color: '#111111', marginBottom: 4 }}>Quy trình hỗ trợ:</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#666666' }}>
                  <li>Liên hệ trực tiếp Quản Trị Viên (Admin) của tổ chức.</li>
                  <li>Hoặc gửi yêu cầu qua kênh Kỹ thuật / Nhân sự nội bộ.</li>
                  <li>Admin sẽ xác thực danh tính và cập nhật mật khẩu mới cho bạn.</li>
                </ul>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowForgotPasswordModal(false)}
              style={{
                width: '100%',
                padding: '11px',
                background: '#141414',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#2b2b2b'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#141414'; }}
            >
              Đã hiểu & Đóng
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
