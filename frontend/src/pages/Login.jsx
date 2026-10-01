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
  Medal,
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

function MvpVisualAward({ mvp, championTeam, season }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 580,
        background: '#f5f4f0',
        borderRight: '1px solid rgba(0, 0, 0, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '36px 32px',
        boxSizing: 'border-box',
      }}
    >
      {/* ── Top Header: Brand & Eyebrow & Kinetic Headline (Identical to Homepage) ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <BrandMark size={28} showLabel={false} />
            <span
              style={{
                fontFamily: "'Space Grotesk', -apple-system, sans-serif",
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: '-0.4px',
                color: '#111111',
                textTransform: 'uppercase',
              }}
            >
              WORKRANK <span style={{ color: '#b45309', fontWeight: 700 }}>3WIN MEDIA</span>
            </span>
          </Link>

          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '4px 10px',
              background: 'rgba(0,0,0,0.06)',
              color: '#111111',
              borderRadius: 9999,
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Crown size={12} color="#b45309" />
            {season?.name ? season.name : 'MÙA GIẢI 2026'}
          </span>
        </div>

        {/* Eyebrow */}
        <div className="wr-award-eyebrow" style={{ marginBottom: 12 }}>
          <Star size={14} color="#b45309" />
          <span className="wr-award-eyebrow-accent">
            {season?.name ? `${season.name} • MOST VALUABLE PLAYER` : 'MÙA GIẢI 2026 • DANH HIỆU MVP'}
          </span>
        </div>

        {/* Big Editorial Headline */}
        <h2
          style={{
            fontSize: 'clamp(26px, 3vw, 38px)',
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '-0.035em',
            textTransform: 'uppercase',
            color: '#111111',
            margin: '0 0 14px 0',
          }}
        >
          <span style={{ display: 'block' }}>MVP XUẤT SẮC</span>
          <span style={{ display: 'block' }}>MÙA GIẢI</span>
          <span style={{ display: 'block', color: mvp ? '#111111' : '#888888' }}>
            {mvp ? mvp.name : 'CHỜ CHỦ NHÂN'}
          </span>
        </h2>

        {/* Tagline description */}
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.55,
            color: '#555555',
            margin: '0 0 24px 0',
            fontWeight: 400,
            maxWidth: 420,
          }}
        >
          {mvp
            ? (mvp.reason || 'Vinh danh cá nhân có hiệu suất đóng góp cao nhất và chỉ số tăng trưởng ấn tượng nhất toàn cơ quan.')
            : 'Cá nhân có thành tích bứt phá và đóng góp nổi bật nhất sẽ được xướng tên tại vị trí danh giá này.'}
        </p>
      </div>

      {/* ── Bottom Visual Boxes (Matching Homepage Exact Box 1 & Box 2) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginTop: 'auto' }}>
        {/* Box 1: MVP Portrait & Profile */}
        <div
          className="wr-award-visual-box"
          style={{
            background: '#ffffff',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            padding: 16,
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.6px', color: '#b45309', textTransform: 'uppercase' }}>
              MVP RECOGNITION
            </span>
            <Sparkles size={14} color="#f59e0b" />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0' }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: '#111111',
                border: '2px solid #f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(245,158,11,0.25)',
                overflow: 'hidden',
                position: 'relative',
                flexShrink: 0,
              }}
            >
              {mvp?.avatarData ? (
                <img
                  src={mvp.avatarData}
                  alt={mvp.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : mvp ? (
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 20,
                    fontWeight: 700,
                    color: '#facc15',
                  }}
                >
                  {initialsFromName(mvp.name)}
                </span>
              ) : (
                <UserRound size={26} color="#facc15" strokeWidth={2} />
              )}
              {mvp?.isVerified && (
                <div style={{ position: 'absolute', bottom: 1, right: 1 }}>
                  <VerifiedBadge size={14} />
                </div>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#111111', lineHeight: 1.25 }}>
                  {mvp ? mvp.name : 'Nhân Tố Xuất Sắc'}
                </span>
                {mvp?.isVerified && <VerifiedBadge size={13} />}
              </div>
              <div style={{ fontSize: 10, fontWeight: 500, color: '#777777', textTransform: 'uppercase', marginTop: 3 }}>
                {mvp ? `${mvp.jobTitle || 'Chuyên viên'} • ${mvp.department || 'Media'}` : 'Chờ vinh danh'}
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666666' }}>
            <span>Danh hiệu</span>
            <span style={{ fontWeight: 600, color: '#b45309' }}>
              {mvp ? 'MVP Mùa Giải' : 'Chờ xác định'}
            </span>
          </div>
        </div>

        {/* Box 2: Excellence Award & Score */}
        <div
          className="wr-award-visual-box"
          style={{
            background: '#ffffff',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            padding: 16,
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.6px', color: '#666666', textTransform: 'uppercase' }}>
              EXCELLENCE RECOGNITION
            </span>
            <Medal size={14} color="#111111" />
          </div>

          <div style={{ margin: 'auto 0', textAlign: 'center', padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={36} color="#f59e0b" strokeWidth={1.75} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#b45309', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              {mvp ? 'DANH HIỆU MVP' : 'CHỜ XÁC ĐỊNH'}
            </span>
          </div>

          <div
            style={{
              borderTop: '1px solid rgba(0,0,0,0.06)',
              paddingTop: 8,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
            }}
          >
            <div>
              <div style={{ fontSize: 9, fontWeight: 500, color: '#888888', textTransform: 'uppercase' }}>Điểm Cống Hiến</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#111111', marginTop: 1 }}>
                {mvp ? `${mvp.score.toLocaleString()} XP` : '--- XP'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 500, color: '#888888', textTransform: 'uppercase' }}>Chứng Nhận</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0284c7', marginTop: 1 }}>
                {mvp?.isVerified ? 'Đã Xác Thực' : 'Hệ Thống'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
      if (!password) {
        setError('Vui lòng nhập mật khẩu');
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
        const res = await auth.register({
          name: name.trim(),
          email: email.trim(),
          password,
        });
        if (res.data?.user) {
          setUser(res.data.user);
          navigate('/dashboard');
        } else {
          setNotice('Đăng ký thành công! Vui lòng đăng nhập.');
          setIsRegister(false);
        }
      } else {
        const res = await auth.login({
          email: email.trim(),
          password,
        });
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
          maxWidth: 1040,
          background: '#ffffff',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 10,
          boxShadow: '0 20px 50px rgba(0,0,0,0.08)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          overflow: 'hidden',
        }}
      >
        {/* ── LEFT PANEL: FULL-BLEED MVP ARTWORK & FLOATING CARD ── */}
        <MvpVisualAward mvp={mvp} championTeam={championTeam} season={season} />

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
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111111' }}>
                  Bạn đang đăng nhập
                </span>
              </div>

              <div style={{ fontSize: 12, color: '#555555', marginBottom: 12 }}>
                Tài khoản: <strong style={{ color: '#111111', fontWeight: 600 }}>{user.name}</strong> ({user.email})
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
                    fontWeight: 600,
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
                    fontWeight: 600,
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
                fontWeight: 600,
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
                fontWeight: 600,
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
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.3, color: '#111111' }}>
              {isRegister ? 'Tạo Tài Khoản Thành Viên' : 'Đăng Nhập Workspace'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666666', lineHeight: 1.55, fontWeight: 400 }}>
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
                fontWeight: 500,
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
                fontWeight: 500,
                lineHeight: 1.5,
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
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 6 }}>
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

            {/* Email / Identifier Field */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 6 }}>
                Email hoặc Tên đăng nhập *
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="#777777" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Nhập email hoặc tên đăng nhập"
                  autoComplete="username"
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
                <label style={{ fontSize: 12, fontWeight: 600, color: '#111111' }}>
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
                      fontWeight: 600,
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
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 6 }}>
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
                fontWeight: 600,
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
                fontWeight: 600,
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
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.08)',
              padding: 24,
              width: '100%',
              maxWidth: 440,
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: '#111111' }}>
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
                <div style={{ fontWeight: 600, color: '#111111', marginBottom: 4 }}>Quy trình hỗ trợ:</div>
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
                fontWeight: 600,
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
