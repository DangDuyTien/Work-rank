import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Activity, Eye, EyeOff, LockKeyhole } from 'lucide-react';

const S = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'stretch',
    background: '#f8fafc', fontFamily: "'Space Grotesk', system-ui, sans-serif",
  },
  left: {
    width: 420, flexShrink: 0, background: 'linear-gradient(180deg,#eff6ff 0%,#ffffff 100%)',
    borderRight: '1px solid rgba(15,23,42,0.08)',
    display: 'flex', flexDirection: 'column',
    padding: '48px 40px', justifyContent: 'space-between',
  },
  right: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '48px 60px',
  },
  formWrap: { width: '100%', maxWidth: 400 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 },
  input: {
    width: '100%', background: '#ffffff',
    border: '1px solid rgba(15,23,42,0.12)',
    borderRadius: 6, padding: '12px 14px',
    color: '#0f172a', fontSize: 14, fontWeight: 500,
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  btn: {
    width: '100%', padding: '13px 0', background: '#3b82f6',
    border: 'none', borderRadius: 6, cursor: 'pointer',
    color: '#fff', fontSize: 14, fontWeight: 700,
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    letterSpacing: '0.01em', transition: 'background 0.2s, transform 0.1s',
  },
  err: {
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 6, padding: '10px 14px', fontSize: 13,
    color: '#dc2626', marginBottom: 20,
  },
};

const statItems = [
  { v: '142', u: 'Người dùng hoạt động' },
  { v: '99.9%', u: 'Thời gian hoạt động' },
  { v: '2.5s', u: 'Chu kỳ ping' },
];

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName]     = useState('');
  const [email, setEmail]   = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, setUser, loading: authLoading } = useAuth();

  useEffect(() => {
    const message = sessionStorage.getItem('workrank_auth_message');
    if (message) {
      setError(message);
      sessionStorage.removeItem('workrank_auth_message');
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) navigate('/dashboard', { replace: true });
  }, [authLoading, navigate, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fn   = isRegister ? auth.register : auth.login;
      const data = isRegister ? { name, email, password } : { email, password };
      const res  = await fn(data);
      const user = res.data.user || res.data;
      if (user) setUser(user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || (err.request ? 'Không kết nối được backend. Hãy bật backend ở http://localhost:5001' : 'Có lỗi xảy ra'));
    }
    setLoading(false);
  };

  if (authLoading || user) return null;

  return (
    <div className="login-page" style={S.page}>
      {/* ── LEFT BRAND PANEL ── */}
      <div className="login-brand-panel" style={S.left}>
        {/* Logo */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 6,
              background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Activity size={16} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>WorkRank</span>
          </div>

          <h2 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1.3, margin: '0 0 14px', letterSpacing: '-0.5px' }}>
            Giám Sát<br />Hiệu Suất<br />Thời Gian Thực
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, margin: 0, fontWeight: 500 }}>
            Theo dõi gõ phím, click chuột và thời gian hoạt động của cả nhóm — trực tiếp.
          </p>
        </div>

        {/* Stats */}
        <div className="login-brand-stats" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {statItems.map(s => (
            <div key={s.u} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 3, height: 32, background: '#3b82f6', borderRadius: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.4px' }}>{s.v}</div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.u}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="login-brand-footer" style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
          © 2024 WorkRank Realtime. High-Performance Monitoring.
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div className="login-form-panel" style={S.right}>
        <div style={S.formWrap}>
          <div style={{ marginBottom: 36 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.4px' }}>
              {isRegister ? 'Tạo Tài Khoản' : 'Truy Cập An Toàn'}
            </h1>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0, fontWeight: 500 }}>
              {isRegister
                ? 'Thiết lập tài khoản WorkRank của bạn.'
                : 'Nhập thông tin đăng nhập để vào bảng điều khiển.'}
            </p>
          </div>

          {error && <div style={S.err}>{error}</div>}

          <form onSubmit={handleSubmit}>
            {isRegister && (
              <div style={{ marginBottom: 18 }}>
                <label style={S.label}>Họ và Tên</label>
                <input
                  style={S.input}
                  type="text" value={name} required
                  placeholder="Nguyễn Văn A"
                  onChange={e => setName(e.target.value)}
                  onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(15,23,42,0.12)'}
                />
              </div>
            )}
            <div style={{ marginBottom: 18 }}>
              <label style={S.label}>Email công việc</label>
              <input
                style={S.input}
                type="email" value={email} required
                placeholder="ten@congty.com"
                onChange={e => setEmail(e.target.value)}
                onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(15,23,42,0.12)'}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ ...S.label, marginBottom: 0 }}>Mật khẩu</label>
                {!isRegister && (
                  <span style={{ fontSize: 12, color: '#3b82f6', cursor: 'pointer', fontWeight: 600 }}>
                    Liên hệ quản trị viên
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...S.input, paddingRight: 44 }}
                  type={showPassword ? 'text' : 'password'} value={password} required
                  placeholder="Nhập mật khẩu"
                  onChange={e => setPassword(e.target.value)}
                  onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(15,23,42,0.12)'}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  onClick={() => setShowPassword((value) => !value)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'transparent',
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    padding: 4,
                  }}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit" style={S.btn} disabled={loading}
              onMouseEnter={e => e.currentTarget.style.background = '#2563eb'}
              onMouseLeave={e => e.currentTarget.style.background = '#3b82f6'}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.99)'}
              onMouseUp={e => e.currentTarget.style.transform = 'none'}
            >
              {loading ? 'Vui lòng đợi...' : (isRegister ? 'Tạo Tài Khoản' : 'Đăng Nhập')}
            </button>
          </form>

          <div style={{ height: 1, background: 'rgba(15,23,42,0.08)', margin: '24px 0' }} />

          <p style={{ textAlign: 'center', fontSize: 13, color: '#64748b', margin: 0 }}>
            {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
            <button
              onClick={() => setIsRegister(!isRegister)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', fontSize: 13, fontWeight: 700, padding: 0 }}
            >
              {isRegister ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 28 }}>
            <LockKeyhole size={12} color="#94a3b8" />
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.04em' }}>KẾT NỐI BẢO MẬT</span>
          </div>
        </div>
      </div>
    </div>
  );
}
