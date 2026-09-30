import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  UserPlus,
  UserRound,
  HelpCircle,
  X,
  Swords,
  Trophy,
  Tv,
  Gamepad2,
  LogIn,
  LogOut,
} from 'lucide-react';
import { auth } from '../services/api';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';

export default function Login() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'register';

  const [isRegister, setIsRegister] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();

  // Sync mode with URL search param
  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'register') {
      setIsRegister(true);
    } else {
      setIsRegister(false);
    }
  }, [searchParams]);

  // Read one-time flash messages
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

  const switchMode = (nextIsRegister) => {
    setIsRegister(nextIsRegister);
    setError('');
    setNotice('');
    setSearchParams(nextIsRegister ? { mode: 'register' } : {});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (isRegister) {
      if (!trimmedName) {
        setError('Vui lòng nhập họ và tên.');
        return;
      }
      if (password.length < 6) {
        setError('Mật khẩu phải có độ dài tối thiểu 6 ký tự.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.');
        return;
      }
    }

    setLoading(true);
    try {
      const fn = isRegister ? auth.register : auth.login;
      const payload = isRegister
        ? { name: trimmedName, email: trimmedEmail, password }
        : { email: trimmedEmail, password };

      const res = await fn(payload);
      const nextUser = res.data.user || res.data;
      if (nextUser) setUser(nextUser);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error;
      if (msg) {
        if (msg.includes('Email already registered')) {
          setError('Email này đã được đăng ký. Vui lòng chuyển sang Đăng nhập.');
        } else if (msg.includes('Invalid email or password')) {
          setError('Email hoặc mật khẩu không chính xác.');
        } else {
          setError(msg);
        }
      } else if (err.request) {
        setError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền mạng.');
      } else {
        setError('Đã có lỗi xảy ra trong quá trình xác thực.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* ── AUTH CONTAINER (VUÔNG VẮN) ── */}
      <div
        style={{
          width: '100%',
          maxWidth: 960,
          background: '#ffffff',
          border: '1px solid rgba(15,23,42,0.16)',
          borderRadius: 0,
          boxShadow: '0 12px 32px rgba(15,23,42,0.06)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          overflow: 'hidden',
        }}
      >
        {/* ── LEFT PANEL: BRAND & PLATFORM OVERVIEW (VUÔNG VẮN) ── */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            padding: '40px 32px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderRight: '1px solid rgba(15,23,42,0.12)',
          }}
        >
          <div>
            {/* Brand Header */}
            <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <BrandMark size={36} showLabel label="3WIN MEDIA" labelStyle={{ color: '#ffffff' }} />
            </Link>

            <h1 style={{ margin: '0 0 10px', fontSize: 24, fontWeight: 900, color: '#ffffff', lineHeight: 1.25 }}>
              Nền tảng Kết nối Hiệu suất & Đội nhóm
            </h1>

            <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
              Không gian làm việc đồng bộ hóa hiệu suất đa kênh, đấu trường mùa giải trực tiếp, bảng vinh danh và giải trí nội bộ.
            </p>

            {/* Core Capabilities List (Vuông vắn) */}
            <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'SẢN XUẤT & YOUTUBE REALTIME', desc: 'Đồng bộ chỉ số kênh media tự động theo chu kỳ', icon: Tv, color: '#ef4444' },
                { label: 'ĐẤU TRƯỜNG MÙA GIẢI & GRAND', desc: 'Thi đấu đối kháng & tính điểm qua Event Store', icon: Swords, color: '#0284c7' },
                { label: 'XẾP HẠNG & CHỨC DANH CHUẨN HÓA', desc: 'Leaderboard đa chiều & phân tầng chức vụ Tier 1-6', icon: Trophy, color: '#d97706' },
                { label: 'TRÒ CHƠI DOANH NGHIỆP', desc: 'Cờ Tỷ Phú & Live Quiz Kahoot giải trí giải lao', icon: Gamepad2, color: '#a855f7' },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 0,
                    }}
                  >
                    <div
                      style={{
                        padding: 6,
                        borderRadius: 0,
                        background: `${item.color}22`,
                        color: item.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 2,
                        border: `1px solid ${item.color}44`,
                      }}
                    >
                      <Icon size={15} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: '#ffffff', letterSpacing: '0.3px' }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{item.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Security Note */}
          <div
            style={{
              marginTop: 32,
              paddingTop: 16,
              borderTop: '1px solid rgba(255,255,255,0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              color: '#94a3b8',
            }}
          >
            <ShieldCheck size={16} color="#38bdf8" />
            <span>Xác thực bảo mật đa tầng • Phân quyền RBAC & Chống IDOR</span>
          </div>
        </div>

        {/* ── RIGHT PANEL: AUTH FORMS & STATE (VUÔNG VẮN) ── */}
        <div
          style={{
            padding: '40px 36px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {/* Active session banner (Vuông vắn) */}
          {user && (
            <div
              style={{
                marginBottom: 20,
                padding: '14px 16px',
                background: 'rgba(2,132,199,0.08)',
                border: '1.5px solid #0284c7',
                borderRadius: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <CheckCircle2 size={18} color="#0284c7" />
                <span style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>
                  Bạn đang đăng nhập
                </span>
              </div>

              <div style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>
                Tài khoản: <strong style={{ color: '#0f172a' }}>{user.name}</strong> ({user.email})
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
                    padding: '8px 14px',
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 0,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
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
                    padding: '8px 12px',
                    background: '#ffffff',
                    color: '#ef4444',
                    border: '1px solid rgba(239,68,68,0.4)',
                    borderRadius: 0,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <LogOut size={13} />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          )}

          {/* Mode Switcher Tabs (Vuông vắn) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              background: 'rgba(15,23,42,0.06)',
              padding: 4,
              borderRadius: 0,
              marginBottom: 24,
              border: '1px solid rgba(15,23,42,0.1)',
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
                padding: '10px',
                background: !isRegister ? '#ffffff' : 'transparent',
                color: !isRegister ? '#0f172a' : '#64748b',
                border: !isRegister ? '1px solid rgba(15,23,42,0.12)' : 'none',
                borderRadius: 0,
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: !isRegister ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
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
                padding: '10px',
                background: isRegister ? '#ffffff' : 'transparent',
                color: isRegister ? '#0f172a' : '#64748b',
                border: isRegister ? '1px solid rgba(15,23,42,0.12)' : 'none',
                borderRadius: 0,
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: isRegister ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <UserPlus size={15} />
              <span>Đăng ký</span>
            </button>
          </div>

          {/* Form Header */}
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
              {isRegister ? 'Tạo Tài Khoản Thành Viên' : 'Đăng Nhập Workspace'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
              {isRegister
                ? 'Nhập thông tin cá nhân để bắt đầu làm việc và thi đấu trên WorkRank'
                : 'Sử dụng email công việc và mật khẩu để truy cập vào hệ thống'}
            </p>
          </div>

          {/* Flash Notice (Vuông vắn) */}
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
                borderRadius: 0,
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              <CheckCircle2 size={16} />
              <span>{notice}</span>
            </div>
          )}

          {/* Flash Error (Vuông vắn) */}
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
                borderRadius: 0,
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

          {/* Auth Form (Vuông vắn) */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Name Field (Register only) */}
            {isRegister && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                  Họ và tên *
                </label>
                <div style={{ position: 'relative' }}>
                  <UserRound size={16} color="#64748b" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ví dụ: Nguyễn Văn A"
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      borderRadius: 0,
                      border: '1px solid rgba(15,23,42,0.25)',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                Email công việc *
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="#64748b" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
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
                    borderRadius: 0,
                    border: '1px solid rgba(15,23,42,0.25)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                  Mật khẩu *
                </label>

                {!isRegister && (
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0284c7',
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
                <Lock size={16} color="#64748b" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
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
                    borderRadius: 0,
                    border: '1px solid rgba(15,23,42,0.25)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
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
                    color: '#64748b',
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
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                  Xác nhận mật khẩu *
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#64748b" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
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
                      borderRadius: 0,
                      border: '1px solid rgba(15,23,42,0.25)',
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
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
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button (Vuông vắn) */}
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 20px',
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: 0,
                fontSize: 14,
                fontWeight: 900,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(15,23,42,0.2)',
                marginTop: 8,
                transition: 'transform 0.1s ease',
              }}
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
          <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: '#64748b' }}>
            {isRegister ? 'Đã có tài khoản thành viên?' : 'Chưa có tài khoản trên hệ thống?'}{' '}
            <button
              type="button"
              onClick={() => switchMode(!isRegister)}
              style={{
                background: 'none',
                border: 'none',
                color: '#0284c7',
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

      {/* ── FORGOT PASSWORD / ADMIN CONTACT MODAL (VUÔNG VẮN) ── */}
      {showForgotPasswordModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.6)',
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
              borderRadius: 0,
              border: '1px solid rgba(15,23,42,0.2)',
              padding: 24,
              width: '100%',
              maxWidth: 440,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                <HelpCircle size={20} color="#0284c7" />
                <span>Hướng Dẫn Cấp Lại Mật Khẩu</span>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 12px' }}>
                Nhằm đảm bảo an toàn dữ liệu và tuân thủ chính sách bảo mật nội bộ của <strong>WorkRank</strong>, mật khẩu tài khoản được quản lý tập trung.
              </p>
              <div style={{ background: '#f8fafc', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 0, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Quy trình hỗ trợ:</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#64748b' }}>
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
                padding: '10px',
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: 0,
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Đã hiểu & Đóng
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
