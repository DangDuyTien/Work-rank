import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Trophy, Sparkles, X, LayoutDashboard, ChevronRight } from 'lucide-react';
import PublicHeader from '../components/PublicHeader';
import BrandMark from '../components/BrandMark';
import { useAuth } from '../context/AuthContext';
import { competition } from '../services/api';

export default function Home() {
  const { user } = useAuth();
  const isSignedIn = Boolean(user);

  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeasonDetail, setSelectedSeasonDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    competition
      .getPublicSeasons()
      .then((data) => {
        if (isMounted) {
          setSeasons(data || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenSeasonDetail = async (seasonId) => {
    setDetailLoading(true);
    try {
      const data = await competition.getPublicSeasonDetail(seasonId);
      setSelectedSeasonDetail(data);
    } catch (err) {
      console.warn('Cannot load season detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Group seasons by year if available, or list sequentially
  const latestSeason = seasons[0] || null;

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-[#111111] font-['Space_Grotesk'] antialiased selection:bg-[#b45309]/20 flex flex-col">
      <PublicHeader activeNav="Trang Chủ" />

      {/* ── 1. HERO SECTION: ULTRA-MINIMAL EDITORIAL ── */}
      <section className="pt-16 pb-14 sm:pt-24 sm:pb-20 border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <div className="max-w-3xl">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#b45309] block mb-4">
              WORKRANK • 3WIN MEDIA
            </span>

            <h1 className="text-[clamp(52px,8.5vw,110px)] font-black tracking-tight uppercase leading-[0.9] text-[#111111] mb-6">
              MỘT NƠI <br />
              ĐỂ GHI DẤU <br />
              <span className="text-[#b45309]">THÀNH TÍCH.</span>
            </h1>

            <p className="text-base sm:text-lg text-[#555555] leading-relaxed max-w-xl mb-8">
              Nền tảng nội bộ ghi nhận thành tích, đội nhóm và hành trình thi đua của WorkRank 3WIN Media.
            </p>

            <div>
              {isSignedIn ? (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#111111] hover:bg-[#262626] text-white text-sm font-bold uppercase tracking-[0.05em] rounded-[2px] transition-all shadow-sm"
                >
                  <LayoutDashboard size={16} />
                  <span>Vào Không Gian Làm Việc</span>
                  <ArrowRight size={15} />
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#111111] hover:bg-[#262626] text-white text-sm font-bold uppercase tracking-[0.05em] rounded-[2px] transition-all shadow-sm"
                >
                  <span>Vào Workspace Ngay</span>
                  <ArrowRight size={15} />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. EDITORIAL AWARD ARCHIVE (WINDHAM-CAMPBELL COMPOSITION) ── */}
      <section className="py-16 sm:py-24 flex-1">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          {/* Giant Section Display Header */}
          <div className="mb-14 sm:mb-20">
            <h2 className="text-[clamp(64px,11vw,150px)] font-black tracking-tight uppercase leading-[0.88] text-[#c25e40]">
              Vinh danh
            </h2>
          </div>

          {/* Seasons Stream */}
          {seasons.length > 0 ? (
            <div className="space-y-24 sm:space-y-36">
              {seasons.map((seasonItem, sIdx) => {
                const year = seasonItem.year || (seasonItem.startAt ? new Date(seasonItem.startAt).getFullYear() : 2026);
                const featuredTeam = seasonItem.championTeam || seasonItem.teams?.[0] || null;
                const teamsList = seasonItem.teams || [];

                return (
                  <div key={seasonItem.id || sIdx} className="space-y-8">
                    {/* Big Year / Season Title */}
                    <div className="flex items-baseline justify-between border-b-2 border-black pb-2">
                      <h3 className="text-[clamp(42px,6vw,84px)] font-black tracking-tight text-[#111111] leading-none">
                        {year}
                      </h3>
                      <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-[0.14em] text-[#777777]">
                        {seasonItem.name}
                      </span>
                    </div>

                    {/* 3-Column Editorial Grid matching Reference */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
                      {/* Column 1 (Left): Graphic Frame + Large Featured Team Image */}
                      <div className="lg:col-span-4 flex items-center justify-center">
                        <div className="flex items-center gap-2 sm:gap-3">
                          {/* Giant Left Quote Glyph */}
                          <span className="font-['Space_Grotesk'] text-6xl sm:text-8xl lg:text-9xl font-black text-black select-none leading-none -mr-1">
                            “
                          </span>

                          {/* Large Team Image Rectangular Frame */}
                          <div className="relative aspect-[3/4] w-48 sm:w-56 lg:w-60 bg-[#edeae3] border border-black overflow-hidden shadow-sm flex items-center justify-center">
                            {featuredTeam?.avatarUrl ? (
                              <img
                                src={featuredTeam.avatarUrl}
                                alt={featuredTeam.teamName}
                                className="w-full h-full object-cover filter grayscale contrast-105"
                              />
                            ) : (
                              <div
                                className="w-full h-full flex flex-col items-center justify-center text-white p-4 text-center"
                                style={{ backgroundColor: featuredTeam?.color || '#1a1a1a' }}
                              >
                                <Trophy size={48} className="text-[#facc15] mb-3" />
                                <span className="font-bold text-base sm:text-lg uppercase tracking-tight">
                                  {featuredTeam?.teamName || 'VÔ ĐỊCH'}
                                </span>
                                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/70 mt-1">
                                  CHAMPION TEAM
                                </span>
                              </div>
                            )}

                            {/* Caption Badge */}
                            <div className="absolute bottom-2 left-2 right-2 bg-black/85 backdrop-blur-sm text-white px-2.5 py-1 text-center font-mono text-[10px] font-bold uppercase tracking-[0.12em]">
                              {featuredTeam?.teamName || 'CHAMPION'}
                            </div>
                          </div>

                          {/* Giant Right Quote Glyph */}
                          <span className="font-['Space_Grotesk'] text-6xl sm:text-8xl lg:text-9xl font-black text-black select-none leading-none -ml-1">
                            ”
                          </span>
                        </div>
                      </div>

                      {/* Column 2 (Center): Major Category / Championship Stacks */}
                      <div className="lg:col-span-3 flex flex-col justify-center space-y-2">
                        <span className="text-[clamp(26px,3.4vw,44px)] font-black tracking-tight uppercase leading-[1.02] text-[#111111] block">
                          CHAMPION
                        </span>
                        <span className="text-[clamp(26px,3.4vw,44px)] font-black tracking-tight uppercase leading-[1.02] text-[#111111] block">
                          FINALIST
                        </span>
                        <span className="text-[clamp(26px,3.4vw,44px)] font-black tracking-tight uppercase leading-[1.02] text-[#111111] block">
                          DIVISION
                        </span>
                        <span className="text-[clamp(26px,3.4vw,44px)] font-black tracking-tight uppercase leading-[1.02] text-[#111111] block">
                          ALL-STAR
                        </span>
                      </div>

                      {/* Column 3 (Right): Team List with Thin Dividers */}
                      <div className="lg:col-span-5 flex flex-col justify-center divide-y divide-black/15 border-t border-black/15">
                        {teamsList.length > 0 ? (
                          teamsList.slice(0, 6).map((team, tIdx) => (
                            <div
                              key={team.teamId || tIdx}
                              className="py-3.5 flex items-center justify-between gap-4 group cursor-pointer hover:bg-black/[0.03] px-2 transition-colors"
                              onClick={() => handleOpenSeasonDetail(seasonItem.id)}
                            >
                              <span className="font-bold text-sm sm:text-base text-[#111111] tracking-tight group-hover:text-[#b45309] transition-colors">
                                {team.teamName}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-[#666666] uppercase">
                                  {team.role || `RANK #${team.rank || tIdx + 1}`}
                                </span>
                                <ChevronRight size={14} className="text-black/30 group-hover:text-[#b45309] transition-colors" />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-6 text-sm text-[#777777] italic">
                            Chưa có dữ liệu đội tuyển hoàn tất cho mùa giải này.
                          </div>
                        )}

                        {/* View Full Season Link */}
                        <div className="pt-3">
                          <button
                            type="button"
                            onClick={() => handleOpenSeasonDetail(seasonItem.id)}
                            className="text-xs font-bold uppercase tracking-[0.1em] text-[#b45309] hover:underline flex items-center gap-1 mt-1"
                          >
                            <span>Xem chi tiết xếp hạng & thông số {seasonItem.name}</span>
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center text-[#777777] font-mono text-sm">
              Đang tải danh mục vinh danh mùa giải...
            </div>
          )}
        </div>
      </section>

      {/* ── 3. SEASON DETAIL DRAWER / MODAL ── */}
      {selectedSeasonDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
          <div className="bg-[#f7f5f0] border border-black w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[2px] p-6 sm:p-8 shadow-2xl relative">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedSeasonDetail(null)}
              className="absolute top-6 right-6 p-2 text-[#111111] hover:bg-black/10 rounded-[2px] transition-colors"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="border-b border-black/15 pb-4 mb-6">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#b45309]">
                CHI TIẾT MÙA GIẢI
              </span>
              <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#111111] mt-1">
                {selectedSeasonDetail.season?.name}
              </h3>
              <p className="text-xs text-[#666666] font-mono mt-1">
                {selectedSeasonDetail.season?.startAt ? new Date(selectedSeasonDetail.season.startAt).toLocaleDateString('vi-VN') : ''} —{' '}
                {selectedSeasonDetail.season?.endAt ? new Date(selectedSeasonDetail.season.endAt).toLocaleDateString('vi-VN') : ''}
              </p>
            </div>

            {/* Team Rankings Table */}
            <div className="mb-8">
              <h4 className="font-bold uppercase tracking-tight text-sm text-[#111111] mb-3 pb-2 border-b border-black/10 flex justify-between">
                <span>BẢNG XẾP HẠNG ĐỘI TUYỂN</span>
                <span className="font-mono text-xs text-[#777777]">FINAL TEAMS</span>
              </h4>
              <div className="divide-y divide-black/10">
                {selectedSeasonDetail.teamRankings?.map((team, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-xs w-5 text-[#888888]">#{idx + 1}</span>
                      <span className="font-semibold text-[#111111]">{team.teamName}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs text-[#b45309] font-bold">+{team.grandPoints || 0} GP</span>
                      <span className="font-mono font-bold text-xs">{team.score?.toLocaleString() || 0} XP</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Individual Rankings Table */}
            {selectedSeasonDetail.individualRankings?.length > 0 && (
              <div>
                <h4 className="font-bold uppercase tracking-tight text-sm text-[#111111] mb-3 pb-2 border-b border-black/10 flex justify-between">
                  <span>CÁ NHÂN XUẤT SẮC (TOP INDIVIDUALS)</span>
                  <span className="font-mono text-xs text-[#777777]">TOP PERFORMERS</span>
                </h4>
                <div className="divide-y divide-black/10">
                  {selectedSeasonDetail.individualRankings.slice(0, 5).map((ind, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-xs w-5 text-[#888888]">#{idx + 1}</span>
                        <div>
                          <span className="font-semibold text-[#111111] block">{ind.name}</span>
                          <span className="font-mono text-[10px] text-[#777777]">{ind.jobTitle || 'Chuyên viên'}</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-xs">{ind.score?.toLocaleString() || 0} XP</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 4. MINIMAL FOOTER ── */}
      <footer className="py-10 border-t border-black/10 bg-[#f0eee9] text-[#666666] text-xs">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandMark size={20} showLabel={false} />
            <span className="font-bold text-[#111111] uppercase tracking-tight">
              WORKRANK 3WIN MEDIA
            </span>
            <span>•</span>
            <span>Niên Giám Vinh Danh & Thành Tích Doanh Nghiệp</span>
          </div>
          <div>© 2026 3WIN Media Co., Ltd. Tất cả quyền được bảo lưu.</div>
        </div>
      </footer>
    </div>
  );
}
