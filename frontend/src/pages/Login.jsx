import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LogIn,
  UserPlus,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  UserRound,
  Loader2,
  HelpCircle,
  X,
  LogOut,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import usePublicSpotlight from '../hooks/usePublicSpotlight';
import { RecognitionStatus, SpotlightFeedback, displayScore, recognitionState } from '../components/PublicRecognition';
import RecognitionPortraitFrame from '../components/RecognitionPortraitFrame';
import { Reveal } from '../components/ui';
import { auth } from '../services/api';
import { useAuth } from '../context/AuthContext';

function MvpVisualAward({ data, loading, error, retry }) {
  const mvp = data?.mvp;
  const team = data?.championTeam;
  const type = mvp ? 'mvp' : 'champion';
  const championState = recognitionState(data, 'champion');
  const mvpState = recognitionState(data, 'mvp');
  const state = type === 'mvp' ? mvpState : championState;
  const name = type === 'mvp' ? mvp?.name : team?.teamName;
  return (
    <Reveal as="aside" delay={200} className="public-auth-recognition" aria-label="Ghi nhận mùa giải" aria-busy={loading}>
      <Link to="/" className="public-editorial-brand" aria-label="WorkRank — Trang chủ">
        <BrandMark size={28} showLabel={false} /><span>WORKRANK<small>3WIN MEDIA</small></span>
      </Link>
      <div className="public-auth-editorial-heading">
        <h2>Recipients</h2>
        <p>{data?.season?.name || (loading ? 'Đang tải mùa giải…' : error ? 'Chưa tải được mùa giải' : 'Chưa có mùa giải công bố')}</p>
      </div>
      <SpotlightFeedback loading={loading} error={error} retry={retry} />
      <RecognitionPortraitFrame key={`${type}-${data?.season?.id || 'none'}-${name || 'none'}`} type={type} record={type === 'mvp' ? mvp : team} loading={loading} />
      <div className="public-auth-person">
        <div><span className="public-editorial-kicker">{type === 'mvp' ? 'CÁ NHÂN NỔI BẬT' : 'ĐỘI NHÓM NỔI BẬT'}</span><h3>{name || (loading ? 'Đang tải…' : 'Chờ ghi nhận tiếp theo')}</h3><RecognitionStatus state={state} type={type} /></div>
        {(mvp || team) && <p className="public-auth-score"><strong>{displayScore(type === 'mvp' ? mvp?.score : team?.seasonScore)}</strong><span>Điểm mùa giải</span></p>}
      </div>
      {mvp?.reason && <p className="public-auth-reason">{mvp.reason}</p>}
      <Link className="public-editorial-link" to="/">Khám phá vinh danh <ArrowRight size={17} /></Link>
    </Reveal>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser, logout } = useAuth();

  const spotlight = usePublicSpotlight();

  const [isRegister, setIsRegister] = useState(() => new URLSearchParams(location.search).get('mode') === 'register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const passwordHelpRef = useRef(null);

  useEffect(() => {
    if (!showForgotPasswordModal) return undefined;
    const dialog = passwordHelpRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const buttons = dialog.querySelectorAll('button');
    buttons[0]?.focus();
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setShowForgotPasswordModal(false);
      if (event.key !== 'Tab') return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [showForgotPasswordModal]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setIsRegister(params.get('mode') === 'register');
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

  }, [location.search]);

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
    navigate({ search: params.toString() }, { replace: true, state: location.state });
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
          const requested = location.state?.from;
          const from = requested?.pathname?.startsWith('/')
            ? `${requested.pathname}${requested.search || ''}${requested.hash || ''}`
            : '/dashboard';
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
    <main className="login-page-wrapper public-auth-page">
      <div className="public-auth-shell">
        <Reveal delay={0} className={`public-auth-form-panel ${isRegister ? 'is-register' : ''}`}>
          <Link className="public-auth-mobile-brand public-editorial-brand" to="/" aria-label="WorkRank — Trang chủ">
            <BrandMark size={28} showLabel={false} /><span>WORKRANK<small>3WIN MEDIA</small></span>
          </Link>
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
          <div className="public-auth-mode-tabs"
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              background: '#f4f3ef',
              padding: 4,
              borderRadius: 8,
              marginBottom: 24,
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            {/* Sliding Pill Indicator */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 4,
                bottom: 4,
                left: 4,
                width: 'calc(50% - 4px)',
                background: '#ffffff',
                borderRadius: 6,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
                transform: `translateX(${isRegister ? '100%' : '0%'})`,
                transition: 'transform var(--motion-normal) var(--ease-spring)',
                pointerEvents: 'none',
              }}
            />

            <button
              type="button"
              aria-pressed={!isRegister}
              onClick={() => switchMode(false)}
              className="public-auth-mode-tab"
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '9px',
                background: 'transparent',
                color: !isRegister ? '#111111' : '#666666',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'color var(--motion-fast) ease',
              }}
            >
              <LogIn size={15} />
              <span>Đăng nhập</span>
            </button>

            <button
              type="button"
              aria-pressed={isRegister}
              onClick={() => switchMode(true)}
              className="public-auth-mode-tab"
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '9px',
                background: 'transparent',
                color: isRegister ? '#111111' : '#666666',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'color var(--motion-fast) ease',
              }}
            >
              <UserPlus size={15} />
              <span>Đăng ký</span>
            </button>
          </div>

          {/* Form Header with Smooth Crossfade */}
          <div className="public-auth-form-heading" aria-live="polite" style={{ position: 'relative' }}>
            <div
              style={{
                gridRow: '1',
                gridColumn: '1',
                opacity: !isRegister ? 1 : 0,
                transform: !isRegister ? 'none' : 'translateY(-6px)',
                transition: 'opacity var(--motion-normal) var(--ease-spring), transform var(--motion-normal) var(--ease-spring)',
                pointerEvents: !isRegister ? 'auto' : 'none',
              }}
            >
              <h1>Chào mừng trở lại.</h1>
            </div>
            <div
              style={{
                gridRow: '1',
                gridColumn: '1',
                opacity: isRegister ? 1 : 0,
                transform: isRegister ? 'none' : 'translateY(6px)',
                transition: 'opacity var(--motion-normal) var(--ease-spring), transform var(--motion-normal) var(--ease-spring)',
                pointerEvents: isRegister ? 'auto' : 'none',
              }}
            >
              <h1>Tham gia WorkRank.</h1>
            </div>

            <div
              style={{
                gridRow: '2',
                gridColumn: '1',
                opacity: !isRegister ? 1 : 0,
                transform: !isRegister ? 'none' : 'translateY(-4px)',
                transition: 'opacity var(--motion-normal) var(--ease-spring), transform var(--motion-normal) var(--ease-spring)',
                pointerEvents: !isRegister ? 'auto' : 'none',
              }}
            >
              <p>Đăng nhập để tiếp tục hành trình cùng đội của bạn.</p>
            </div>
            <div
              style={{
                gridRow: '2',
                gridColumn: '1',
                opacity: isRegister ? 1 : 0,
                transform: isRegister ? 'none' : 'translateY(4px)',
                transition: 'opacity var(--motion-normal) var(--ease-spring), transform var(--motion-normal) var(--ease-spring)',
                pointerEvents: isRegister ? 'auto' : 'none',
              }}
            >
              <p>Tạo tài khoản để cùng đội ghi dấu những thành tích mới.</p>
            </div>
          </div>

          {/* Flash Notice */}
          {notice && (
            <div
              className="motion-slide-down"
              role="status"
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
              className="motion-slide-down"
              role="alert"
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
          <form className="public-auth-fields" aria-label={isRegister ? 'Đăng ký thành viên' : 'Đăng nhập WorkRank'} onSubmit={handleSubmit}>
            {/* Name Field (Register only) */}
            <div className={`public-auth-field-collapse ${isRegister ? 'is-open' : ''}`} aria-hidden={!isRegister} inert={!isRegister ? '' : undefined}>
              <fieldset disabled={!isRegister} className="public-auth-field-inner">
                <label htmlFor="auth-name" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 6 }}>
                  Họ và tên *
                </label>
                <div style={{ position: 'relative' }}>
                  <UserRound size={16} color="#777777" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    id="auth-name"
                    autoComplete="name"
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
              </fieldset>
            </div>

            {/* Email / Identifier Field */}
            <div>
              <label htmlFor="auth-email" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 6 }}>
                Email hoặc Tên đăng nhập *
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="#777777" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="auth-email"
                  type={isRegister ? 'email' : 'text'}
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
                <label htmlFor="auth-password" style={{ fontSize: 12, fontWeight: 600, color: '#111111' }}>
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
                  id="auth-password"
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
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-pressed={showPassword}
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
            <div className={`public-auth-field-collapse ${isRegister ? 'is-open' : ''}`} aria-hidden={!isRegister} inert={!isRegister ? '' : undefined}>
              <fieldset disabled={!isRegister} className="public-auth-field-inner">
                <label htmlFor="auth-confirm-password" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 6 }}>
                  Xác nhận mật khẩu *
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#777777" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    id="auth-confirm-password"
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
                    aria-label={showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                    aria-pressed={showConfirmPassword}
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
              </fieldset>
            </div>

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
        </Reveal>
        <MvpVisualAward {...spotlight} />
      </div>

      {/* ── FORGOT PASSWORD / ADMIN CONTACT MODAL ── */}
      {showForgotPasswordModal && (
        <div
          onClick={(event) => { if (event.target === event.currentTarget) setShowForgotPasswordModal(false); }}
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
            ref={passwordHelpRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-help-title"
            style={{
              background: '#ffffff',
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.08)',
              padding: 24,
              width: '100%',
              maxWidth: 440,
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              position: 'relative',
              maxHeight: 'calc(100svh - 32px)',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: '#111111' }}>
                <HelpCircle size={20} color="#b45309" />
                <span id="password-help-title">Hướng Dẫn Cấp Lại Mật Khẩu</span>
              </div>
              <button
                type="button"
                aria-label="Đóng hướng dẫn cấp lại mật khẩu"
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
