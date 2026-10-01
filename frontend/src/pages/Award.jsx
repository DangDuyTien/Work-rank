import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Trophy,
  Star,
  Crown,
  Medal,
  Award as AwardIcon,
  Sparkles,
  Users,
  UserRound,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Flame,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import PublicHeader from '../components/PublicHeader';
import BrandMark from '../components/BrandMark';
import VerifiedBadge from '../components/VerifiedBadge';
import { initialsFromName } from '../utils/avatar';
import { competition } from '../services/api';

export default function Award() {
  const [searchParams, setSearchParams] = useSearchParams();
  const seasonParam = searchParams.get('season');

  const [seasons, setSeasons] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [spotlight, setSpotlight] = useState({
    hasSpotlight: false,
    season: null,
    championTeam: null,
    mvp: null,
  });
  const [seasonDetail, setSeasonDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Fetch seasons archive & spotlight on mount
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      competition.getPublicSeasons().catch(() => []),
      competition.getPublicSpotlight().catch(() => null),
    ]).then(([seasonsList, spotData]) => {
      if (!isMounted) return;
      setSeasons(seasonsList || []);
      if (spotData) setSpotlight(spotData);

      const targetId = seasonParam
        ? Number(seasonParam)
        : spotData?.season?.id || (seasonsList?.[0]?.id ?? null);

      setSelectedSeasonId(targetId);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [seasonParam]);

  // 2. Fetch specific season detail when selection changes
  useEffect(() => {
    if (!selectedSeasonId) return;
    let isMounted = true;
    competition
      .getPublicSeasonDetail(selectedSeasonId)
      .then((data) => {
        if (isMounted) setSeasonDetail(data);
      })
      .catch((err) => {
        console.warn('Could not load season details:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSeasonId]);

  const handleSelectSeason = (id) => {
    setSelectedSeasonId(id);
    setSearchParams({ season: String(id) });
  };

  const currentSeason =
    seasons.find((s) => s.id === selectedSeasonId) || spotlight.season;
  const championTeam = spotlight?.championTeam;
  const mvp = spotlight?.mvp;

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-[#111111] font-['Space_Grotesk'] antialiased selection:bg-[#b45309]/20">
      <PublicHeader activeNav="Vinh Danh Mùa Giải" />

      {/* ── 1. HERO SECTION: EDITORIAL HEADLINE & EYEBROW ── */}
      <section className="pt-12 pb-10 sm:pt-16 sm:pb-14 border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <div className="flex items-center gap-3 mb-4">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#b45309]">
              01 / HONORS & RECIPIENTS
            </span>
            <span className="text-black/30">•</span>
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[#666666]">
              NIÊN GIÁM THÀNH TÍCH 3WIN MEDIA
            </span>
          </div>

          <h1 className="text-[clamp(44px,6.5vw,96px)] font-bold tracking-tight uppercase leading-[0.92] text-[#111111] mb-6">
            VINH DANH <br className="hidden sm:inline" />
            <span className="text-[#b45309]">MÙA GIẢI.</span>
          </h1>

          <p className="text-base sm:text-lg text-[#555555] max-w-2xl leading-relaxed">
            Ghi nhận và vinh danh những đội tuyển và cá nhân đạt thành tích xuất sắc
            nhất trong từng giai đoạn thi đua hiệu suất tại 3WIN Media.
          </p>

          {/* Season Selector Bar */}
          {seasons.length > 0 && (
            <div className="mt-8 pt-6 border-t border-black/10 flex items-center gap-2 sm:gap-4 overflow-x-auto pb-2 scrollbar-none">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#777777] whitespace-nowrap mr-2">
                CHỌN MÙA GIẢI:
              </span>
              {seasons.map((s) => {
                const isSelected = s.id === selectedSeasonId;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleSelectSeason(s.id)}
                    type="button"
                    className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] rounded-[4px] transition-all whitespace-nowrap ${
                      isSelected
                        ? 'bg-[#111111] text-white shadow-sm'
                        : 'bg-black/5 text-[#333333] hover:bg-black/10'
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── 2. SPOTLIGHT SHOWCASE: WINDHAM-CAMPBELL EDITORIAL COMPOSITION ── */}
      <section className="py-12 sm:py-16 border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            {/* Left Column (5 Cols): Framed MVP Portrait Hero */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="mb-4">
                <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#b45309]">
                  02 / CÁ NHÂN XUẤT SẮC
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase text-[#111111] mt-1">
                  MOST VALUABLE PLAYER
                </h2>
              </div>

              {/* Large Rectangular Framed Portrait */}
              <div className="relative bg-white border border-black/12 p-5 sm:p-6 shadow-sm rounded-[4px]">
                {/* Visual Frame / Bracket Graphics */}
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
                        {mvp ? initialsFromName(mvp.name) : 'WR'}
                      </div>
                      <span className="text-sm font-semibold text-[#555555]">
                        {mvp?.name || 'Đang xác định danh hiệu'}
                      </span>
                    </div>
                  )}

                  {/* Top Floating Badge */}
                  <div className="absolute top-3 left-3 bg-[#111111] text-white px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5 shadow-sm">
                    <Star size={11} className="text-[#b45309]" />
                    <span>MVP RECIPIENT</span>
                  </div>

                  {/* Bottom Score Overlay */}
                  {mvp && (
                    <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm border border-black/10 px-3 py-1.5 shadow-sm">
                      <span className="font-mono text-xs font-bold text-[#111111]">
                        +{mvp.score?.toLocaleString() || 0} XP
                      </span>
                    </div>
                  )}
                </div>

                {/* Portrait Caption & Citations */}
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
                    "{mvp?.reason || 'Đạt thành tích dẫn đầu về số điểm cống hiến và đóng góp quan trọng vào chiến thắng chung của mùa giải.'}"
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (7 Cols): Champion Team & Performance Breakdown */}
            <div className="lg:col-span-7 flex flex-col justify-between h-full">
              <div>
                <div className="mb-4">
                  <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#b45309]">
                    03 / ĐỘI TUYỂN VÔ ĐỊCH
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase text-[#111111] mt-1">
                    SEASON CHAMPION TEAM
                  </h2>
                </div>

                {/* Champion Banner Box */}
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
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#b45309]">
                            HẠNG 1 TOÀN MÙA
                          </span>
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-bold uppercase tracking-tight text-[#111111]">
                          {championTeam?.teamName || 'Đội tuyển Vô Địch'}
                        </h3>
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#777777] block">
                        ĐIỂM MÙA GIẢI
                      </span>
                      <span className="text-2xl sm:text-3xl font-bold font-mono text-[#111111]">
                        {championTeam?.seasonScore?.toLocaleString() || 0} XP
                      </span>
                    </div>
                  </div>

                  {/* Metrics Row */}
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
                        THÀNH VIÊN
                      </span>
                      <span className="text-lg font-bold font-mono text-[#111111] mt-0.5 block">
                        {championTeam?.membersCount || 8} Nhân sự
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#777777] block">
                        DANH HIỆU
                      </span>
                      <span className="text-sm font-bold text-[#111111] mt-0.5 block">
                        Chiến Thắng Mùa Giải
                      </span>
                    </div>
                  </div>
                </div>

                {/* Season Performance Categories (Editorial Rows with Thin Dividers) */}
                <div className="border-t border-black/10 divide-y divide-black/10">
                  <div className="py-4 flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#111111] block">
                        TÊN MÙA GIẢI
                      </span>
                      <span className="text-sm text-[#666666]">
                        {currentSeason?.name || 'Season 01 — 2026'}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#111111] uppercase">
                      {currentSeason?.seasonType || 'MONTHLY'}
                    </span>
                  </div>

                  <div className="py-4 flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#111111] block">
                        THỜI GIAN THI ĐẤU
                      </span>
                      <span className="text-sm text-[#666666]">
                        {currentSeason?.startAt
                          ? new Date(currentSeason.startAt).toLocaleDateString('vi-VN')
                          : '01/01/2026'}{' '}
                        —{' '}
                        {currentSeason?.endAt
                          ? new Date(currentSeason.endAt).toLocaleDateString('vi-VN')
                          : '31/12/2026'}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 bg-black/5 text-[#111111] font-mono text-[10px] font-bold uppercase rounded-[2px]">
                      {currentSeason?.status || 'FINISHED'}
                    </span>
                  </div>

                  <div className="py-4 flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#111111] block">
                        QUY CHUẨN XÁC THỰC
                      </span>
                      <span className="text-sm text-[#666666]">
                        Bất biến theo Event Store & Sổ Cái Điểm Số (Zero Drift)
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-700 font-mono text-xs font-bold">
                      <CheckCircle2 size={14} />
                      <span>ĐÃ ĐÓNG BĂNG</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. FULL SEASON STANDINGS (TABLES WITH THIN DIVIDERS) ── */}
      {seasonDetail && (
        <section className="py-12 sm:py-16 border-b border-black/10">
          <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
            <div className="mb-8">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#b45309]">
                04 / BẢNG XẾP HẠNG TOÀN DIỆN
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase text-[#111111] mt-1">
                KẾT QUẢ CHUNG CUỘC MÙA GIẢI
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Teams Table */}
              <div>
                <h3 className="text-lg font-bold uppercase tracking-tight text-[#111111] mb-4 pb-2 border-b border-black/15 flex items-center justify-between">
                  <span>BẢNG XẾP HẠNG ĐỘI NHÓM</span>
                  <span className="font-mono text-xs font-normal text-[#777777]">TOP TEAMS</span>
                </h3>

                <div className="divide-y divide-black/10">
                  {seasonDetail.teamRankings?.length > 0 ? (
                    seasonDetail.teamRankings.map((team, idx) => (
                      <div
                        key={team.teamName + idx}
                        className="py-3.5 flex items-center justify-between hover:bg-black/[0.02] px-2 rounded-[2px] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-6 text-center font-mono text-sm font-bold ${
                              idx === 0
                                ? 'text-[#b45309]'
                                : idx === 1
                                ? 'text-[#555555]'
                                : 'text-[#888888]'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-sm text-[#111111]">
                            {team.teamName}
                          </span>
                        </div>
                        <div className="flex items-center gap-6">
                          <span className="font-mono text-xs text-[#b45309] font-bold">
                            +{team.grandPoints || 0} PTS
                          </span>
                          <span className="font-mono text-sm font-bold text-[#111111]">
                            {team.score?.toLocaleString() || 0} XP
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-sm text-[#777777]">
                      Chưa có dữ liệu đội tuyển cho mùa giải này.
                    </div>
                  )}
                </div>
              </div>

              {/* Individuals Table */}
              <div>
                <h3 className="text-lg font-bold uppercase tracking-tight text-[#111111] mb-4 pb-2 border-b border-black/15 flex items-center justify-between">
                  <span>BẢNG XẾP HẠNG CÁ NHÂN</span>
                  <span className="font-mono text-xs font-normal text-[#777777]">TOP INDIVIDUALS</span>
                </h3>

                <div className="divide-y divide-black/10">
                  {seasonDetail.individualRankings?.length > 0 ? (
                    seasonDetail.individualRankings.map((ind, idx) => (
                      <div
                        key={ind.name + idx}
                        className="py-3.5 flex items-center justify-between hover:bg-black/[0.02] px-2 rounded-[2px] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-6 text-center font-mono text-sm font-bold ${
                              idx === 0
                                ? 'text-[#b45309]'
                                : idx === 1
                                ? 'text-[#555555]'
                                : 'text-[#888888]'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <span className="font-semibold text-sm text-[#111111] block">
                              {ind.name}
                            </span>
                            <span className="font-mono text-[10px] text-[#777777] uppercase tracking-[0.05em]">
                              {ind.jobTitle || 'Thành viên'}
                            </span>
                          </div>
                        </div>
                        <span className="font-mono text-sm font-bold text-[#111111]">
                          {ind.score?.toLocaleString() || 0} XP
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-sm text-[#777777]">
                      Chưa có dữ liệu cá nhân cho mùa giải này.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 4. CALL TO ACTION: PARTICIPATE ── */}
      <section className="py-16 sm:py-20 bg-[#111111] text-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#b45309] block mb-2">
              05 / THAM GIA THI ĐẤU
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold uppercase tracking-tight leading-tight">
              SẴN SÀNG GHI DẤU TÊN BẠN <br className="hidden sm:inline" />
              TRÊN BẢNG VINH DANH?
            </h2>
            <p className="text-sm text-neutral-400 mt-2 max-w-xl">
              Đăng nhập để cập nhật tiến độ công việc, hoàn thành nhiệm vụ và đưa đội
              của bạn chạm tay vào cúp vô địch Grand Championship.
            </p>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <Link
              to="/login"
              className="px-6 py-3.5 bg-[#b45309] hover:bg-[#92400e] text-white text-sm font-bold uppercase tracking-[0.05em] rounded-[4px] transition-all shadow-sm inline-flex items-center gap-2"
            >
              <span>Vào Đấu Trường Ngay</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 5. FOOTER ── */}
      <footer className="py-8 border-t border-black/10 bg-[#f0eee9] text-[#666666] text-xs">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandMark size={20} showLabel={false} />
            <span className="font-bold text-[#111111] uppercase tracking-tight">
              WORKRANK 3WIN MEDIA
            </span>
            <span>•</span>
            <span>Hệ Thống Quản Trị Hiệu Suất Doanh Nghiệp</span>
          </div>
          <div>© 2026 3WIN Media Co., Ltd. Tất cả quyền được bảo lưu.</div>
        </div>
      </footer>
    </div>
  );
}
