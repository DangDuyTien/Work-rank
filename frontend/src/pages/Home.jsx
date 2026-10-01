import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Trophy,
  Star,
  Crown,
  Medal,
  Award,
  Sparkles,
  Users,
  UserRound,
  CheckCircle2,
  Tv,
  Swords,
  Gamepad2,
  ShieldCheck,
  Flame,
  ChevronRight,
  Play,
  Zap,
} from 'lucide-react';
import PublicHeader from '../components/PublicHeader';
import BrandMark from '../components/BrandMark';
import VerifiedBadge from '../components/VerifiedBadge';
import { initialsFromName } from '../utils/avatar';
import { useAuth } from '../context/AuthContext';
import { competition } from '../services/api';

export default function Home() {
  const { user } = useAuth();
  const isSignedIn = Boolean(user);

  const [spotlight, setSpotlight] = useState({
    hasSpotlight: false,
    season: null,
    championTeam: null,
    mvp: null,
  });
  const [seasonsArchive, setSeasonsArchive] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      competition.getPublicSpotlight().catch(() => null),
      competition.getPublicSeasons().catch(() => []),
    ]).then(([spotData, archiveList]) => {
      if (!isMounted) return;
      if (spotData) setSpotlight(spotData);
      if (archiveList) setSeasonsArchive(archiveList);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const { season, championTeam, mvp } = spotlight;

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-[#111111] font-['Space_Grotesk'] antialiased selection:bg-[#b45309]/20">
      <PublicHeader activeNav="Trang Chủ" />

      {/* ── 1. HERO SECTION: MASSIVE OVERSIZED EDITORIAL TYPOGRAPHY ── */}
      <section className="pt-14 pb-16 sm:pt-20 sm:pb-24 border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          {/* Eyebrow */}
          <div className="flex items-center gap-3 mb-6">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#b45309]">
              WORKRANK PLATFORM
            </span>
            <span className="text-black/30">•</span>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[#666666]">
              3WIN MEDIA ENTERPRISE
            </span>
          </div>

          {/* Giant Display Headline */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end">
            <div className="lg:col-span-8">
              <h1 className="text-[clamp(46px,7.5vw,104px)] font-bold tracking-tight uppercase leading-[0.92] text-[#111111]">
                MỘT NƠI <br />
                ĐỂ GHI DẤU <br />
                <span className="text-[#b45309]">THÀNH TÍCH.</span>
              </h1>
            </div>

            <div className="lg:col-span-4 flex flex-col justify-end pb-2">
              <p className="text-sm sm:text-base text-[#555555] leading-relaxed mb-6">
                Nền tảng ghi nhận nỗ lực làm việc thời gian thực, đồng bộ chỉ số YouTube
                minh bạch, tổ chức thi đua mùa giải và vinh danh những cá nhân, đội nhóm
                xuất sắc nhất tại 3WIN Media.
              </p>

              <div className="flex items-center gap-3 flex-wrap">
                {isSignedIn ? (
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#111111] hover:bg-[#262626] text-white text-xs sm:text-sm font-semibold rounded-[4px] transition-all shadow-sm"
                  >
                    <span>Vào Không Gian Làm Việc</span>
                    <ArrowRight size={14} />
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-[#111111] hover:bg-[#262626] text-white text-xs sm:text-sm font-semibold rounded-[4px] transition-all shadow-sm"
                    >
                      <span>Đăng Nhập Ngay</span>
                      <ArrowRight size={14} />
                    </Link>
                    <a
                      href="#showcase"
                      className="inline-flex items-center gap-2 px-5 py-3 bg-transparent hover:bg-black/5 text-[#111111] border border-black/20 text-xs sm:text-sm font-semibold rounded-[4px] transition-all"
                    >
                      <span>Xem Vinh Danh</span>
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. SECTION 01: WHAT IS WORKRANK (3-COLUMN EDITORIAL GRID) ── */}
      <section className="py-14 sm:py-20 border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <div className="mb-10">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#b45309]">
              01 / TỔNG QUAN HỆ THỐNG
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase text-[#111111] mt-1">
              NGUYÊN LÝ HOẠT ĐỘNG
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 divide-y md:divide-y-0 md:divide-x divide-black/10">
            {/* Column 1 */}
            <div className="pt-6 md:pt-0 md:pr-8">
              <span className="font-mono text-2xl font-bold text-[#111111] block mb-3">
                01.
              </span>
              <h3 className="text-lg font-bold uppercase tracking-tight text-[#111111] mb-2">
                GHI NHẬN TỰ ĐỘNG
              </h3>
              <p className="text-sm text-[#555555] leading-relaxed">
                Mọi đóng góp sản xuất video, duyệt nội dung và hỗ trợ đồng nghiệp đều được
                ingest tự động qua Outbox pattern vào Event Store bất biến, loại bỏ hoàn
                toàn thao tác chấm điểm thủ công.
              </p>
            </div>

            {/* Column 2 */}
            <div className="pt-6 md:pt-0 md:px-8">
              <span className="font-mono text-2xl font-bold text-[#111111] block mb-3">
                02.
              </span>
              <h3 className="text-lg font-bold uppercase tracking-tight text-[#111111] mb-2">
                THI ĐUA MÙA GIẢI
              </h3>
              <p className="text-sm text-[#555555] leading-relaxed">
                Các đội tuyển tranh tài theo từng Season định kỳ. Điểm số cá nhân và đội
                nhóm được tính toán theo bộ luật AST chuẩn hóa, đóng băng kết quả và trao
                Grand Points minh bạch.
              </p>
            </div>

            {/* Column 3 */}
            <div className="pt-6 md:pt-0 md:pl-8">
              <span className="font-mono text-2xl font-bold text-[#111111] block mb-3">
                03.
              </span>
              <h3 className="text-lg font-bold uppercase tracking-tight text-[#111111] mb-2">
                DỮ LIỆU YOUTUBE THẬT
              </h3>
              <p className="text-sm text-[#555555] leading-relaxed">
                Tích hợp trực tiếp YouTube Data API v3 đo lường lượt xem, số lượng đăng ký
                và tốc độ tăng trưởng của từng kênh, tổng hợp chính xác theo từng đội và
                toàn công ty.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. SECTION 02: SEASON / CHAMPIONSHIP AWARD SHOWCASE (HERO VISUAL) ── */}
      <section id="showcase" className="py-14 sm:py-20 border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 pb-4 border-b border-black/10">
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#b45309]">
                02 / VINH DANH MÙA GIẢI
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight uppercase text-[#111111] mt-1">
                {season?.name || 'SEASON SPOTLIGHT 2026'}
              </h2>
            </div>

            <Link
              to="/award"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#b45309] hover:underline"
            >
              <span>Xem Toàn Bộ Bảng Vinh Danh</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {/* Windham-Campbell Style Split Editorial Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            {/* Left Column (5 Cols): Large Framed MVP Portrait */}
            <div className="lg:col-span-5">
              <div className="bg-white border border-black/12 p-5 sm:p-6 shadow-sm rounded-[4px]">
                {/* Large Framed Image */}
                <div className="relative aspect-[4/4.8] w-full bg-[#edeae3] border border-black/10 overflow-hidden flex items-center justify-center">
                  {mvp?.avatarData ? (
                    <img
                      src={mvp.avatarData}
                      alt={mvp.name}
                      className="w-full h-full object-cover object-top filter grayscale contrast-105"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                      <div className="w-20 h-20 rounded-full bg-[#111111] text-white flex items-center justify-center text-2xl font-bold font-mono mb-4">
                        {mvp ? initialsFromName(mvp.name) : 'MVP'}
                      </div>
                      <span className="text-sm font-semibold text-[#555555]">
                        {mvp?.name || 'Đang cập nhật danh hiệu'}
                      </span>
                    </div>
                  )}

                  {/* Top Badge */}
                  <div className="absolute top-3 left-3 bg-[#111111] text-white px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5 shadow-sm">
                    <Star size={11} className="text-[#b45309]" />
                    <span>MOST VALUABLE PLAYER</span>
                  </div>

                  {/* Score Tag */}
                  {mvp && (
                    <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm border border-black/10 px-3 py-1.5 shadow-sm">
                      <span className="font-mono text-xs font-bold text-[#111111]">
                        +{mvp.score?.toLocaleString() || 0} XP
                      </span>
                    </div>
                  )}
                </div>

                {/* Info block */}
                <div className="mt-5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111111]">
                      {mvp?.name || 'Thành viên xuất sắc'}
                    </h3>
                    {mvp?.isVerified && <VerifiedBadge size={16} />}
                  </div>

                  <p className="font-mono text-xs font-semibold text-[#666666] uppercase tracking-[0.08em] mt-1">
                    {mvp?.jobTitle || 'Chuyên viên'} • {mvp?.department || 'Media Production'}
                  </p>

                  <div className="mt-4 pt-4 border-t border-black/10 text-sm text-[#444444] leading-relaxed italic">
                    "{mvp?.reason || 'Cá nhân có đóng góp nổi bật nhất trong mùa giải, dẫn đầu bảng xếp hạng cá nhân.'}"
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (7 Cols): Category Stack & Team Winner */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              {/* Champion Team Box */}
              <div className="bg-white border border-black/12 p-6 sm:p-8 rounded-[4px] shadow-sm mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-black/10">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-[4px] flex items-center justify-center text-white text-xl font-bold shadow-sm"
                      style={{ backgroundColor: championTeam?.color || '#0284c7' }}
                    >
                      <Trophy size={28} />
                    </div>
                    <div>
                      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#b45309]">
                        ĐỘI VÔ ĐỊCH MÙA GIẢI
                      </span>
                      <h3 className="text-2xl sm:text-3xl font-bold uppercase tracking-tight text-[#111111]">
                        {championTeam?.teamName || 'Đội tuyển Vô Địch'}
                      </h3>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#777777] block">
                      TỔNG ĐIỂM
                    </span>
                    <span className="text-2xl sm:text-3xl font-bold font-mono text-[#111111]">
                      {championTeam?.seasonScore?.toLocaleString() || 0} XP
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-6">
                  <div>
                    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#777777] block">
                      GRAND POINTS
                    </span>
                    <span className="text-lg font-bold font-mono text-[#b45309] mt-0.5 block">
                      +{championTeam?.grandPoints || 10} PTS
                    </span>
                  </div>
                  <div>
                    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#777777] block">
                      QUY MÔ ĐỘI
                    </span>
                    <span className="text-lg font-bold font-mono text-[#111111] mt-0.5 block">
                      {championTeam?.membersCount || 8} Nhân sự
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#777777] block">
                      TRẠNG THÁI
                    </span>
                    <span className="text-sm font-bold text-[#111111] mt-0.5 block">
                      Đã Quyết Toán Kết Quả
                    </span>
                  </div>
                </div>
              </div>

              {/* Editorial Breakdown Rows */}
              <div className="border-t border-black/10 divide-y divide-black/10">
                <div className="py-4 flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#111111]">
                    LOẠI MÙA GIẢI
                  </span>
                  <span className="font-mono text-xs text-[#555555] uppercase">
                    {season?.seasonType || 'MONTHLY TOURNAMENT'}
                  </span>
                </div>

                <div className="py-4 flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#111111]">
                    THỜI ĐIỂM ĐÓNG BĂNG KẾT QUẢ
                  </span>
                  <span className="text-xs text-[#555555]">
                    {season?.frozenAt
                      ? new Date(season.frozenAt).toLocaleDateString('vi-VN')
                      : 'Đang diễn ra'}
                  </span>
                </div>

                <div className="py-4 flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#111111]">
                    SỔ CÁI BẤT BIẾN
                  </span>
                  <span className="font-mono text-xs font-bold text-emerald-700">
                    ZERO DRIFT VERIFIED
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. SECTION 03: SEASON ARCHIVE (EDITORIAL LIST) ── */}
      <section id="archive" className="py-14 sm:py-20 border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <div className="mb-10">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#b45309]">
              03 / KHO LƯU TRỮ MÙA GIẢI
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase text-[#111111] mt-1">
              DANH SÁCH CÁC MÙA THI ĐẤU
            </h2>
          </div>

          <div className="border-t border-black/15 divide-y divide-black/10">
            {seasonsArchive.length > 0 ? (
              seasonsArchive.map((s, idx) => (
                <div
                  key={s.id}
                  className="py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-black/[0.02] px-2 rounded-[2px] transition-colors"
                >
                  <div className="flex items-start md:items-center gap-4">
                    <span className="font-mono text-xs font-bold text-[#888888] w-6 pt-0.5 md:pt-0">
                      {(idx + 1).toString().padStart(2, '0')}
                    </span>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold uppercase tracking-tight text-[#111111]">
                        {s.name}
                      </h3>
                      <span className="font-mono text-[11px] text-[#777777]">
                        {s.startAt ? new Date(s.startAt).getFullYear() : 2026} • {s.seasonType || 'MONTHLY'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm flex-wrap pl-10 md:pl-0">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#777777] block">
                        ĐỘI VÔ ĐỊCH
                      </span>
                      <span className="font-bold text-[#111111]">
                        {s.championTeamName || 'Đang thi đấu'}
                      </span>
                    </div>

                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#777777] block">
                        MVP
                      </span>
                      <span className="font-bold text-[#b45309]">
                        {s.mvpName || 'Đang xác định'}
                      </span>
                    </div>

                    <Link
                      to={`/award?season=${s.id}`}
                      className="px-3.5 py-1.5 bg-black/5 hover:bg-black/10 text-xs font-semibold uppercase tracking-[0.06em] text-[#111111] rounded-[2px] transition-all ml-auto md:ml-4"
                    >
                      Chi tiết
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-sm text-[#777777]">
                Đang nạp dữ liệu các mùa giải...
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 5. SECTION 04: CAPABILITIES & SYSTEM ARCHITECTURE ── */}
      <section id="capabilities" className="py-14 sm:py-20 border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <div className="mb-10">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#b45309]">
              04 / CƠ CHẾ VẬN HÀNH
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase text-[#111111] mt-1">
              KIẾN TRÚC HIỆU SUẤT DOANH NGHIỆP
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white border border-black/10 p-6 rounded-[4px]">
              <span className="font-mono text-xs font-bold text-[#b45309] block mb-2">
                04.01
              </span>
              <h3 className="text-base font-bold uppercase tracking-tight text-[#111111] mb-2">
                EVENT STORE
              </h3>
              <p className="text-xs text-[#555555] leading-relaxed">
                Ghi nhận mọi sự kiện công việc qua cơ chế Outbox, đảm bảo tính toàn vẹn
                và cho phép khôi phục toàn bộ bảng xếp hạng từ lịch sử.
              </p>
            </div>

            <div className="bg-white border border-black/10 p-6 rounded-[4px]">
              <span className="font-mono text-xs font-bold text-[#b45309] block mb-2">
                04.02
              </span>
              <h3 className="text-base font-bold uppercase tracking-tight text-[#111111] mb-2">
                AST RULE ENGINE
              </h3>
              <p className="text-xs text-[#555555] leading-relaxed">
                Định nghĩa công thức cộng điểm minh bạch, hỗ trợ cơ chế Streak Bonus và
                Team Boost công khai trước khi mùa giải khởi tranh.
              </p>
            </div>

            <div className="bg-white border border-black/10 p-6 rounded-[4px]">
              <span className="font-mono text-xs font-bold text-[#b45309] block mb-2">
                04.03
              </span>
              <h3 className="text-base font-bold uppercase tracking-tight text-[#111111] mb-2">
                YOUTUBE REALTIME
              </h3>
              <p className="text-xs text-[#555555] leading-relaxed">
                Hệ thống 3 cấp (Công Ty → Đội Tuyển → Kênh) đồng bộ tự động số liệu
                views, subscribers và đo lường độ tăng trưởng 30 ngày.
              </p>
            </div>

            <div className="bg-white border border-black/10 p-6 rounded-[4px]">
              <span className="font-mono text-xs font-bold text-[#b45309] block mb-2">
                04.04
              </span>
              <h3 className="text-base font-bold uppercase tracking-tight text-[#111111] mb-2">
                GRAND ANNUAL CUP
              </h3>
              <p className="text-xs text-[#555555] leading-relaxed">
                Tích lũy Grand Points qua từng mùa giải để tìm ra Nhà vô địch toàn niên
                Grand Championship với cúp vàng danh giá.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. SECTION 05: ARENA & GAMES ── */}
      <section id="arena" className="py-14 sm:py-20 border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <div className="mb-10">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#b45309]">
              05 / ĐẤU TRƯỜNG & MINIGAMES
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase text-[#111111] mt-1">
              GẮN KẾT & THỬ THÁCH NỘI BỘ
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white border border-black/10 p-6 rounded-[4px] hover:border-black/30 transition-colors">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#b45309] block mb-2">
                BOARD GAME
              </span>
              <h3 className="text-lg font-bold uppercase tracking-tight text-[#111111] mb-1">
                CỜ THỦ PHỦ
              </h3>
              <p className="text-xs text-[#555555] leading-relaxed mb-4">
                Trò chơi chiến thuật kinh tế thời gian thực, đầu tư bất động sản và so tài
                cùng đồng nghiệp.
              </p>
            </div>

            <div className="bg-white border border-black/10 p-6 rounded-[4px] hover:border-black/30 transition-colors">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#b45309] block mb-2">
                LOGIC PUZZLE
              </span>
              <h3 className="text-lg font-bold uppercase tracking-tight text-[#111111] mb-1">
                GAME 2048
              </h3>
              <p className="text-xs text-[#555555] leading-relaxed mb-4">
                Đấu trí ghép số cổ điển, thi đua kỷ lục điểm số và phản xạ nhạy bén.
              </p>
            </div>

            <div className="bg-white border border-black/10 p-6 rounded-[4px] hover:border-black/30 transition-colors">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#b45309] block mb-2">
                TRADITIONAL
              </span>
              <h3 className="text-lg font-bold uppercase tracking-tight text-[#111111] mb-1">
                SÂM LỐC
              </h3>
              <p className="text-xs text-[#555555] leading-relaxed mb-4">
                Sân chơi giải trí tốc độ cao, kết nối trực tiếp phòng chơi nhiều thành viên.
              </p>
            </div>

            <div className="bg-white border border-black/10 p-6 rounded-[4px] hover:border-black/30 transition-colors">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#b45309] block mb-2">
                TRIVIA & KNOWLEDGE
              </span>
              <h3 className="text-lg font-bold uppercase tracking-tight text-[#111111] mb-1">
                QUIZ BATTLE
              </h3>
              <p className="text-xs text-[#555555] leading-relaxed mb-4">
                Thử tài hiểu biết về sản phẩm, quy trình và văn hóa công ty 3WIN Media.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. CALL TO ACTION ── */}
      <section className="py-16 sm:py-24 bg-[#111111] text-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <span className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#b45309] block mb-2">
              06 / THAM GIA WORKRANK
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold uppercase tracking-tight leading-tight">
              BẮT ĐẦU CHẶNG ĐUA <br className="hidden sm:inline" />
              HIỆU SUẤT CÙNG ĐỘI NHÓM.
            </h2>
            <p className="text-sm sm:text-base text-neutral-400 mt-3 max-w-xl">
              Đăng nhập bằng tài khoản nội bộ để cập nhật nhiệm vụ, theo dõi bảng xếp hạng
              và cùng đồng đội chinh phục cúp vô địch.
            </p>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <Link
              to="/login"
              className="px-6 py-3.5 bg-[#b45309] hover:bg-[#92400e] text-white text-sm font-bold uppercase tracking-[0.05em] rounded-[4px] transition-all shadow-sm inline-flex items-center gap-2"
            >
              <span>Đăng Nhập Vào Hệ Thống</span>
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/register"
              className="px-5 py-3.5 bg-transparent hover:bg-white/10 text-white border border-white/20 text-sm font-semibold rounded-[4px] transition-all"
            >
              <span>Đăng Ký Thành Viên</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 8. FOOTER ── */}
      <footer className="py-10 border-t border-black/10 bg-[#f0eee9] text-[#666666] text-xs">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandMark size={20} showLabel={false} />
            <span className="font-bold text-[#111111] uppercase tracking-tight">
              WORKRANK 3WIN MEDIA
            </span>
            <span>•</span>
            <span>Nền Tảng Quản Trị Hiệu Suất & Vinh Danh</span>
          </div>
          <div>© 2026 3WIN Media Company Limited. Tất cả quyền được bảo lưu.</div>
        </div>
      </footer>
    </div>
  );
}
