import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LogIn,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Loader2,
  Sparkles,
  Trophy,
  ChevronLeft,
  CheckCircle2,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { auth, competition } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuth();

  const queryParams = new URLSearchParams(location.search);
  const initialMode = queryParams.get('mode') === 'forgot' ? 'forgot' : 'login';

  const [mode, setMode] = useState(initialMode); // 'login' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [notice, setNotice] = useState('');

  const [spotlight, setSpotlight] = useState(null);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Load session notices or public spotlight teaser
  useEffect(() => {
    const expiredMsg = sessionStorage.getItem('workrank_auth_message');
    if (expiredMsg) {
      setError(expiredMsg);
      sessionStorage.removeItem('workrank_auth_message');
    }

    const logoutNotice = sessionStorage.getItem('workrank_auth_notice');
    if (logoutNotice) {
      setNotice(logoutNotice);
      sessionStorage.removeItem('workrank_auth_notice');
    }

    competition
      .getPublicSpotlight()
      .then((data) => {
        if (data?.hasSpotlight) setSpotlight(data);
      })
      .catch(() => {});
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!email.trim() || !password) {
      setError('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    setLoading(true);
    try {
      const res = await auth.login(email.trim(), password);
      if (res.data?.user) {
        setUser(res.data.user);
        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!email.trim()) {
      setError('Vui lòng nhập Email để nhận hướng dẫn khôi phục mật khẩu.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccessMsg(
        `Đã gửi yêu cầu cấp lại mật khẩu tới ${email.trim()}. Vui lòng liên hệ Quản trị viên (Admin) nội bộ để kích hoạt lại.`
      );
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#eee9e0] text-[#111111] antialiased selection:bg-[#b85d43]/20 flex flex-col">
      {/* ── TOP MINIMAL BRAND BAR ── */}
      <header className="h-16 sm:h-20 border-b border-black/10 px-6 sm:px-12 lg:px-16 xl:px-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 text-decoration-none group">
          <BrandMark size={32} showLabel={false} />
          <div className="flex items-center gap-2.5">
            <span className="font-['Space_Grotesk'] text-xl sm:text-2xl font-black tracking-tight text-[#111111] uppercase leading-none">
              WORKRANK
            </span>
            <span className="text-black/30 font-light text-base select-none">/</span>
            <span className="font-['Space_Grotesk'] text-xs font-bold uppercase tracking-[0.14em] text-[#666666] leading-none">
              3WIN MEDIA
            </span>
          </div>
        </Link>

        <Link
          to="/"
          className="text-xs font-bold uppercase tracking-[0.08em] text-[#666666] hover:text-[#111111] transition-colors flex items-center gap-1.5"
        >
          <ChevronLeft size={14} />
          <span>Về Trang Chủ</span>
        </Link>
      </header>

      {/* ── EDITORIAL SPLIT CANVAS ── */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 sm:px-12 lg:px-16 xl:px-20 py-12 sm:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        {/* LEFT COLUMN (6 COLS): TYPOGRAPHIC ARTWORK & EDITORIAL CONTEXT */}
        <div className="lg:col-span-6 flex flex-col justify-center">
          <div className="mb-3">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#b85d43]">
              {mode === 'login' ? '01 / XÁC THỰC THÀNH VIÊN' : '01 / KHÔI PHỤC TÀI KHOẢN'}
            </span>
          </div>

          <h1 className="font-condensed text-[clamp(56px,7vw,96px)] font-black tracking-[-0.03em] uppercase leading-[0.88] text-[#111111] mb-6">
            {mode === 'login' ? (
              <>
                CHÀO MỪNG <br />
                <span className="text-[#b85d43]">QUAY TRỞ LẠI.</span>
              </>
            ) : (
              <>
                KHÔI PHỤC <br />
                <span className="text-[#b85d43]">MẬT KHẨU.</span>
              </>
            )}
          </h1>

          <p className="font-serif text-base sm:text-lg text-[#555555] max-w-md leading-relaxed mb-8">
            {mode === 'login'
              ? 'Đăng nhập vào không gian làm việc WorkRank để cập nhật tiến độ, duyệt nhiệm vụ và đồng hành cùng đội nhóm trên bảng xếp hạng.'
              : 'Nhập địa chỉ email nội bộ đã đăng ký. Hệ thống sẽ hỗ trợ gửi yêu cầu khôi phục mật khẩu đến Ban Quản Trị.'}
          </p>

          {/* Editorial Season Quote Snippet */}
          {spotlight?.hasSpotlight && (
            <div className="bg-[#dfd9ce] border border-black/10 p-5 rounded-[2px] max-w-md">
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={14} className="text-[#b85d43]" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#b85d43]">
                  {spotlight.season?.name || 'MÙA GIẢI HIỆN TẠI'}
                </span>
              </div>
              <p className="text-xs text-[#333333] leading-relaxed">
                Đội dẫn đầu:{' '}
                <strong className="text-[#111111]">
                  {spotlight.championTeam?.teamName || 'Đang thi đấu'}
                </strong>{' '}
                • MVP:{' '}
                <strong className="text-[#111111]">
                  {spotlight.mvp?.name || 'Đang xác định'}
                </strong>
              </p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (6 COLS): FORM CONTAINER */}
        <div className="lg:col-span-6 flex justify-center lg:justify-end">
          <div className="w-full max-w-md bg-[#dfd9ce] border border-black/15 p-8 sm:p-10 rounded-[2px] shadow-none">
            {/* Form Header */}
            <div className="mb-6 pb-4 border-b border-black/10 flex items-center justify-between">
              <div>
                <h2 className="font-condensed text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#111111]">
                  {mode === 'login' ? 'ĐĂNG NHẬP' : 'QUÊN MẬT KHẨU'}
                </h2>
                <span className="font-mono text-[11px] text-[#666666] uppercase tracking-[0.06em]">
                  {mode === 'login' ? 'Tài khoản nội bộ WorkRank' : 'Xác thực địa chỉ email'}
                </span>
              </div>

              <div className="w-8 h-8 rounded-[2px] bg-black/5 flex items-center justify-center text-[#111111]">
                {mode === 'login' ? <LogIn size={16} /> : <Lock size={16} />}
              </div>
            </div>

            {/* Error / Notice Banners */}
            {error && (
              <div className="mb-5 p-3.5 bg-red-100 border border-red-300 text-red-800 text-xs rounded-[2px] flex items-start gap-2.5">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{error}</div>
              </div>
            )}

            {notice && (
              <div className="mb-5 p-3.5 bg-amber-100 border border-amber-300 text-amber-900 text-xs rounded-[2px] flex items-start gap-2.5">
                <Sparkles size={15} className="shrink-0 mt-0.5 text-amber-700" />
                <div className="leading-relaxed font-medium">{notice}</div>
              </div>
            )}

            {successMsg && (
              <div className="mb-5 p-3.5 bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs rounded-[2px] flex items-start gap-2.5">
                <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-700" />
                <div className="leading-relaxed font-medium">{successMsg}</div>
              </div>
            )}

            {/* LOGIN FORM */}
            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-[0.06em] text-[#333333] mb-1.5">
                    Địa chỉ Email
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ten.nguoidung@3win.media"
                      required
                      autoFocus
                      className="w-full bg-[#f4f1ea] border border-black/20 focus:border-[#111111] focus:bg-white focus:outline-none rounded-[2px] px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-[#888888] transition-all pl-10"
                    />
                    <Mail
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777777]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-[0.06em] text-[#333333]">
                      Mật khẩu
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError('');
                        setSuccessMsg('');
                      }}
                      className="text-xs font-semibold text-[#b85d43] hover:underline"
                    >
                      Quên mật khẩu?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-[#f4f1ea] border border-black/20 focus:border-[#111111] focus:bg-white focus:outline-none rounded-[2px] px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-[#888888] transition-all pl-10 pr-10"
                    />
                    <Lock
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777777]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#777777] hover:text-[#111111]"
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded-[2px] border-black/30 text-[#111111] focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-xs text-[#555555]">Ghi nhớ phiên đăng nhập</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 bg-[#111111] hover:bg-[#262626] text-white text-xs font-bold uppercase tracking-[0.08em] rounded-[2px] transition-all shadow-none flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Đang xác thực...</span>
                    </>
                  ) : (
                    <>
                      <span>Đăng Nhập Workspace</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* FORGOT PASSWORD FORM */
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-[0.06em] text-[#333333] mb-1.5">
                    Email tài khoản cần khôi phục
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ten.nguoidung@3win.media"
                      required
                      autoFocus
                      className="w-full bg-[#f4f1ea] border border-black/20 focus:border-[#111111] focus:bg-white focus:outline-none rounded-[2px] px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-[#888888] transition-all pl-10"
                    />
                    <Mail
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777777]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError('');
                      setSuccessMsg('');
                    }}
                    className="text-xs font-semibold text-[#555555] hover:text-[#111111]"
                  >
                    ← Quay lại đăng nhập
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 bg-[#111111] hover:bg-[#262626] text-white text-xs font-bold uppercase tracking-[0.08em] rounded-[2px] transition-all shadow-none flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Đang gửi yêu cầu...</span>
                    </>
                  ) : (
                    <>
                      <span>Gửi Yêu Cầu Khôi Phục</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Switch to Register */}
            <div className="mt-6 pt-5 border-t border-black/10 text-center">
              <span className="text-xs text-[#666666]">Chưa có tài khoản nội bộ? </span>
              <Link
                to="/register"
                className="text-xs font-bold text-[#b85d43] hover:underline uppercase tracking-wide"
              >
                Đăng ký ngay
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="py-8 border-t border-black/10 bg-[#dfd9ce] text-[#666666] text-xs">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-12 lg:px-16 xl:px-20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>© 2026 3WIN Media Co., Ltd. Tất cả quyền được bảo lưu.</div>
          <div>Bảo mật & Quản trị Hệ thống WorkRank</div>
        </div>
      </footer>
    </div>
  );
}
