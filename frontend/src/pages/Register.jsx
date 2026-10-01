import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  UserPlus,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  UserRound,
  Loader2,
  ChevronLeft,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { auth } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !password) {
      setError('Vui lòng điền đầy đủ các trường thông tin.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.');
      return;
    }

    if (password.length < 6) {
      setError('Mật khẩu cần tối thiểu 6 ký tự để đảm bảo an toàn.');
      return;
    }

    setLoading(true);
    try {
      const res = await auth.register(name.trim(), email.trim(), password);
      if (res.data?.user) {
        setUser(res.data.user);
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Đăng ký tài khoản không thành công. Vui lòng thử lại sau.';
      setError(msg);
    } finally {
      setLoading(false);
    }
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
          to="/login"
          className="text-xs font-bold uppercase tracking-[0.08em] text-[#666666] hover:text-[#111111] transition-colors flex items-center gap-1.5"
        >
          <span>Đã có tài khoản? Đăng nhập</span>
          <ChevronLeft size={14} className="rotate-180" />
        </Link>
      </header>

      {/* ── EDITORIAL SPLIT CANVAS ── */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 sm:px-12 lg:px-16 xl:px-20 py-12 sm:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        {/* LEFT COLUMN (6 COLS): TYPOGRAPHIC ARTWORK & EDITORIAL CONTEXT */}
        <div className="lg:col-span-6 flex flex-col justify-center">
          <div className="mb-3">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#b85d43]">
              01 / ĐĂNG KÝ THÀNH VIÊN
            </span>
          </div>

          <h1 className="font-condensed text-[clamp(56px,7vw,96px)] font-black tracking-[-0.03em] uppercase leading-[0.88] text-[#111111] mb-6">
            GIA NHẬP <br />
            MẠNG LƯỚI <br />
            <span className="text-[#b85d43]">WORKRANK.</span>
          </h1>

          <p className="font-serif text-base sm:text-lg text-[#555555] max-w-md leading-relaxed mb-8">
            Tạo tài khoản thành viên để đồng hành cùng các đội tuyển, tự động ghi nhận nỗ
            lực lao động hàng ngày và tham gia thi đấu các mùa giải tại 3WIN Media.
          </p>

          {/* Core membership benefits list */}
          <div className="space-y-4 max-w-md border-t border-black/10 pt-6 font-serif">
            <div className="flex items-start gap-3">
              <span className="font-mono text-xs font-bold text-[#b85d43] mt-0.5">01</span>
              <div>
                <strong className="font-condensed text-base font-bold uppercase tracking-tight text-[#111111] block">
                  TỰ ĐỘNG THU THẬP HIỆU SUẤT
                </strong>
                <span className="text-xs text-[#555555]">
                  Mọi video và nhiệm vụ duyệt nội dung được ghi nhận tự động vào sổ cái điểm số.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="font-mono text-xs font-bold text-[#b85d43] mt-0.5">02</span>
              <div>
                <strong className="font-condensed text-base font-bold uppercase tracking-tight text-[#111111] block">
                  TRANH TÀI MÙA GIẢI
                </strong>
                <span className="text-xs text-[#555555]">
                  Góp điểm cho đội tuyển và đua top danh hiệu Most Valuable Player (MVP).
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="font-mono text-xs font-bold text-[#b85d43] mt-0.5">03</span>
              <div>
                <strong className="font-condensed text-base font-bold uppercase tracking-tight text-[#111111] block">
                  ĐẤU TRƯỜNG & TRÒ CHƠI
                </strong>
                <span className="text-xs text-[#555555]">
                  Giao lưu sau giờ làm với Cờ Thủ Phủ, 2048, Sâm Lốc và Quiz Battle.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (6 COLS): FORM CONTAINER */}
        <div className="lg:col-span-6 flex justify-center lg:justify-end">
          <div className="w-full max-w-md bg-[#dfd9ce] border border-black/15 p-8 sm:p-10 rounded-[2px] shadow-none">
            {/* Form Header */}
            <div className="mb-6 pb-4 border-b border-black/10 flex items-center justify-between">
              <div>
                <h2 className="font-condensed text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#111111]">
                  TẠO TÀI KHOẢN
                </h2>
                <span className="font-mono text-[11px] text-[#666666] uppercase tracking-[0.06em]">
                  Thành viên nội bộ 3WIN Media
                </span>
              </div>

              <div className="w-8 h-8 rounded-[2px] bg-black/5 flex items-center justify-center text-[#111111]">
                <UserPlus size={16} />
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-5 p-3.5 bg-red-100 border border-red-300 text-red-800 text-xs rounded-[2px] flex items-start gap-2.5">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{error}</div>
              </div>
            )}

            {/* FORM */}
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.06em] text-[#333333] mb-1.5">
                  Họ và tên *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    required
                    className="w-full bg-[#f4f1ea] border border-black/20 focus:border-[#111111] focus:bg-white focus:outline-none rounded-[2px] px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-[#888888] transition-all pl-10"
                  />
                  <UserRound
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777777]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.06em] text-[#333333] mb-1.5">
                  Địa chỉ Email nội bộ *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ten.nguoidung@3win.media"
                    required
                    className="w-full bg-[#f4f1ea] border border-black/20 focus:border-[#111111] focus:bg-white focus:outline-none rounded-[2px] px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-[#888888] transition-all pl-10"
                  />
                  <Mail
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777777]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.06em] text-[#333333] mb-1.5">
                  Mật khẩu *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
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

              <div>
                <label className="block text-xs font-bold uppercase tracking-[0.06em] text-[#333333] mb-1.5">
                  Xác nhận Mật khẩu *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    required
                    className="w-full bg-[#f4f1ea] border border-black/20 focus:border-[#111111] focus:bg-white focus:outline-none rounded-[2px] px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-[#888888] transition-all pl-10"
                  />
                  <Lock
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777777]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-[#111111] hover:bg-[#262626] text-white text-xs font-bold uppercase tracking-[0.08em] rounded-[2px] transition-all shadow-none flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Đang khởi tạo tài khoản...</span>
                  </>
                ) : (
                  <>
                    <span>Đăng Ký Thành Viên</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            {/* Switch to Login */}
            <div className="mt-6 pt-5 border-t border-black/10 text-center">
              <span className="text-xs text-[#666666]">Đã có tài khoản WorkRank? </span>
              <Link
                to="/login"
                className="text-xs font-bold text-[#b85d43] hover:underline uppercase tracking-wide"
              >
                Đăng nhập
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="py-8 border-t border-black/10 bg-[#dfd9ce] text-[#666666] text-xs">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-12 lg:px-16 xl:px-20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>© 2026 3WIN Media Co., Ltd. Tất cả quyền được bảo lưu.</div>
          <div>Quy chuẩn Thành viên & Thi đấu Nội bộ</div>
        </div>
      </footer>
    </div>
  );
}
