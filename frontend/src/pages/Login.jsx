import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { auth } from '../services/api';
import { useAuth } from '../context/AuthContext';

const statItems = [
  { key: 'users', label: 'users online' },
  { key: 'uptime', label: 'uptime' },
  { key: 'cycle', label: 'sync cycle' },
];

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
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
    if (!authLoading && user) {
      auth.clearLocalSession();
      setUser(null);
    }
  }, [authLoading, setUser, user]);

  useEffect(() => {
    api.get('/api/health').then((res) => {
      if (res.data) setStats(res.data);
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fn = isRegister ? auth.register : auth.login;
      const trimmedEmail = email.trim().toLowerCase();
      const data = isRegister ? { name: name.trim(), email: trimmedEmail, password } : { email: trimmedEmail, password };
      const res = await fn(data);
      const user = res.data.user || res.data;
      if (user) setUser(user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || (err.request ? 'Không kết nối được backend.' : 'Có lỗi xảy ra'));
    }
    setLoading(false);
  };

  if (authLoading || user) return null;

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="login-hero-content">
          <div className="login-brand-block">
            <span className="login-logo-block">W</span>
          </div>

          <h1 className="login-heading">
            <span className="login-prompt">$</span>
            <span className="login-title">WorkRank</span>
            <span className="login-heading-sub">realtime workspace tracker</span>
          </h1>

          <p className="login-lead">
            Dashboard, tracker, bảng xếp hạng và nhóm trong một giao diện gọn.
          </p>

          <div className="login-stats">
            {statItems.map((s) => (
              <div key={s.key} className="login-stat-item">
                <span className="login-stat-value">
                  {stats?.[s.key] ?? '—'}
                </span>
                <span className="login-stat-label">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="login-form-box">
            {error && <div className="login-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              {isRegister && (
                <div className="login-field">
                  <label className="login-field-label">&gt; Họ tên</label>
                  <input className="login-input" type="text" value={name} required placeholder="Nguyễn Văn A" onChange={e => setName(e.target.value)} />
                </div>
              )}
              <div className="login-field">
                <label className="login-field-label">&gt; Email</label>
                <input className="login-input" type="email" value={email} required placeholder="user@company.com" onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="login-field">
                <label className="login-field-label">&gt; Mật khẩu</label>
                <input className="login-input" type="password" value={password} required placeholder="Nhập mật khẩu" onChange={e => setPassword(e.target.value)} />
              </div>

              <button className="login-submit" type="submit" disabled={loading}>
                {loading ? 'Đang xử lý...' : (isRegister ? 'Tạo tài khoản' : 'Đăng nhập')}
                <span className="login-arrow">→</span>
              </button>
            </form>

            <div className="login-divider" />

            <p className="login-switch">
              {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
              <button className="login-switch-btn" onClick={() => { setIsRegister(!isRegister); setError(''); }}>
                {isRegister ? 'Đăng nhập' : 'Đăng ký'}
              </button>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
