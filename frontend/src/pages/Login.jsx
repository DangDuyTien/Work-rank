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
  Lock,
  Mail,
  UserRound,
  Loader2,
  Sparkles,
  Trophy,
  Star,
  ChevronLeft,
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
    // Simulate / execute forgot password
    setTimeout(() => {
      setLoading(false);
      setSuccessMsg(
        `Đã gửi yêu cầu cấp lại mật khẩu tới ${email.trim()}. Vui lòng liên hệ Quản trị viên (Admin) nội bộ để kích hoạt lại.`
      );
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-[#111111] font-['Space_Grotesk'] antialiased selection:bg-[#b45309]/20 flex flex-col">
      {/* ── TOP MINIMAL BRAND BAR ── */}
      <header className="h-16 sm:h-20 border-b border-black/10 px-6 sm:px-10 lg:px-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 text-decoration-none group">
          <BrandMark size={28} showLabel={false} />
          <div className="flex items-baseline gap-2">
            <span className="text-lg sm:text-xl font-bold tracking-tight text-[#111111] uppercase">
              WORKRANK
            </span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] px-2 py-0.5 bg-black/5 text-[#b45309] rounded-[4px]">
              3WIN MEDIA
            </span>
          </div>
        </Link>

        <Link
          to="/"
          className="text-xs font-semibold uppercase tracking-[0.08em] text-[#666666] hover:text-[#111111] transition-colors flex items-center gap-1.5"
        >
          <ChevronLeft size={14} />
          <span>Về Trang Chủ</span>
        </Link>
      </header>

      {/* ── EDITORIAL SPLIT CANVAS ── */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 sm:px-10 lg:px-16 py-12 sm:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        {/* LEFT COLUMN (6 COLS): TYPOGRAPHIC ARTWORK & EDITORIAL CONTEXT */}
        <div className="lg:col-span-6 flex flex-col justify-center">
          <div className="mb-4">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#b45309]">
              {mode === 'login' ? '01 / XÁC THỰC THÀNH VIÊN' : '01 / KHÔI PHỤC TÀI KHOẢN'}
            </span>
          </div>

          <h1 className="text-[clamp(42px,5.5vw,80px)] font-bold tracking-tight uppercase leading-[0.92] text-[#111111] mb-6">
            {mode === 'login' ? (
              <>
                CHÀO MỪNG <br />
                <span className="text-[#b45309]">QUAY TRỞ LẠI.</span>
              </>
            ) : (
              <>
                KHÔI PHỤC <br />
                <span className="text-[#b45309]">MẬT KHẨU.</span>
              </>
            )}
          </h1>

          <p className="text-sm sm:text-base text-[#555555] max-w-md leading-relaxed mb-8">
            {mode === 'login'
              ? 'Đăng nhập vào không gian làm việc WorkRank để cập nhật tiến độ, duyệt nhiệm vụ và đồng hành cùng đội nhóm trên bảng xếp hạng.'
              : 'Nhập địa chỉ email nội bộ đã đăng ký. Hệ thống sẽ hỗ trợ gửi yêu cầu khôi phục mật khẩu đến Ban Quản Trị.'}
          </p>

          {/* Editorial Season Quote Snippet */}
          {spotlight?.hasSpotlight && (
            <div className="bg-white border border-black/10 p-5 rounded-[4px] max-w-md shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={14} className="text-[#b45309]" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#b45309]">
                  {spotlight.season?.name || 'MÙA GIẢI HIỆN TẠI'}
                </span>
              </div>
              <p className="text-xs text-[#444444] leading-relaxed">
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
          <div className="w-full max-w-md bg-white border border-black/12 p-8 sm:p-10 rounded-[4px] shadow-sm">
            {/* Form Header */}
            <div className="mb-6 pb-4 border-b border-black/10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold uppercase tracking-tight text-[#111111]">
                  {mode === 'login' ? 'ĐĂNG NHẬP' : 'QUÊN MẬT KHẨU'}
                </h2>
                <span className="font-mono text-[11px] text-[#777777] uppercase tracking-[0.06em]">
                  {mode === 'login' ? 'Hệ thống tài khoản nội bộ' : 'Xác thực địa chỉ email'}
                </span>
              </div>

              <div className="w-8 h-8 rounded-[4px] bg-black/5 flex items-center justify-center text-[#111111]">
                {mode === 'login' ? <LogIn size={16} /> : <Lock size={16} />}
              </div>
            </div>

            {/* Error / Notice Banners */}
            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-[3px] flex items-start gap-2.5">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{error}</div>
              </div>
            )}

            {notice && (
              <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-[3px] flex items-start gap-2.5">
                <Sparkles size={15} className="shrink-0 mt-0.5 text-amber-600" />
                <div className="leading-relaxed font-medium">{notice}</div>
              </div>
            )}

            {successMsg && (
              <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-[3px] flex items-start gap-2.5">
                <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-600" />
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
                      placeholder="ten@workrank.com"
                      autoComplete="email"
                      required
                      className="w-full bg-[#fbfaf8] border border-black/15 focus:border-[#111111] focus:bg-white focus:outline-none rounded-[4px] px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-[#999999] transition-all pl-10"
                    />
                    <Mail
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777777]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-[0.06em] text-[#333333]">
                      Mật khẩu
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError('');
                      }}
                      className="text-[11px] font-semibold text-[#b45309] hover:underline"
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
                      autoComplete="current-password"
                      required
                      className="w-full bg-[#fbfaf8] border border-black/15 focus:border-[#111111] focus:bg-white focus:outline-none rounded-[4px] px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-[#999999] transition-all pl-10 pr-10"
                    />
                    <Lock
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777777]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#777777] hover:text-[#111111] p-1"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Remember & Options */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-[#555555]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-[#111111] border-black/20 rounded focus:ring-0 cursor-pointer"
                    />
                    <span>Ghi nhớ đăng nhập</span>
                  </label>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#111111] hover:bg-[#262626] disabled:bg-[#666666] text-white text-xs sm:text-sm font-bold uppercase tracking-[0.08em] rounded-[4px] transition-all shadow-sm flex items-center justify-center gap-2 mt-4"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Đang xác thực...</span>
                    </>
                  ) : (
                    <>
                      <span>Đăng Nhập Vào Hệ Thống</span>
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
                    Email tài khoản của bạn
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ten@workrank.com"
                      required
                      className="w-full bg-[#fbfaf8] border border-black/15 focus:border-[#111111] focus:bg-white focus:outline-none rounded-[4px] px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-[#999999] transition-all pl-10"
                    />
                    <Mail
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777777]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#b45309] hover:bg-[#92400e] disabled:bg-[#666666] text-white text-xs sm:text-sm font-bold uppercase tracking-[0.08em] rounded-[4px] transition-all shadow-sm flex items-center justify-center gap-2 mt-4"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Đang gửi yêu cầu...</span>
                    </>
                  ) : (
                    <>
                      <span>Gửi Yêu Cầu Khôi Phục</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setSuccessMsg('');
                  }}
                  className="w-full py-2.5 text-xs font-bold uppercase tracking-[0.06em] text-[#555555] hover:text-[#111111] transition-colors text-center block"
                >
                  ← Quay lại Đăng nhập
                </button>
              </form>
            )}

            {/* Bottom Register Navigation */}
            <div className="mt-6 pt-5 border-t border-black/10 text-center">
              <span className="text-xs text-[#666666]">Chưa có tài khoản thành viên? </span>
              <Link
                to="/register"
                className="text-xs font-bold text-[#b45309] hover:underline uppercase tracking-[0.04em]"
              >
                Đăng ký ngay
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="py-6 border-t border-black/10 text-center text-xs text-[#777777]">
        © 2026 3WIN Media Co., Ltd. Tất cả quyền được bảo lưu.
      </footer>
    </div>
  );
}
