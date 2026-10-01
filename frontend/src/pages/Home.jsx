import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ArrowRight, X, ChevronRight } from 'lucide-react';
import PublicHeader from '../components/PublicHeader';
import BrandMark from '../components/BrandMark';
import { competition } from '../services/api';

export default function Home() {
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

  // Group seasons by year
  const seasonsByYear = useMemo(() => {
    const map = {};
    seasons.forEach((s) => {
      const year = s.year || (s.startAt ? new Date(s.startAt).getFullYear() : 2026);
      if (!map[year]) {
        map[year] = [];
      }
      map[year].push(s);
    });

    const sortedYears = Object.keys(map).sort((a, b) => Number(b) - Number(a));
    return sortedYears.map((year) => ({
      year,
      seasonsList: map[year],
    }));
  }, [seasons]);

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-[#111111] font-['Space_Grotesk'] antialiased selection:bg-[#c25e40]/20 flex flex-col">
      <PublicHeader />

      {/* ── 1. EDITORIAL AWARD ARCHIVE: OPENS DIRECTLY INTO THE HALL OF FAME ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 sm:px-10 lg:px-16 pt-8 sm:pt-14 pb-20 sm:pb-32">
        {/* Giant Display Title: VINH DANH */}
        <div className="mb-6 sm:mb-10">
          <h1 className="text-[clamp(80px,13.5vw,190px)] font-black tracking-tight uppercase leading-[0.88] text-[#c25e40] select-none">
            Vinh danh
          </h1>
        </div>

        {/* Stream of Years & Seasons */}
        {seasonsByYear.length > 0 ? (
          <div className="space-y-24 sm:space-y-36">
            {seasonsByYear.map(({ year, seasonsList }) => (
              <section key={year} className="space-y-16 sm:space-y-24">
                {/* Massive Year Display Header */}
                <div className="border-b-2 border-black pb-3">
                  <h2 className="text-[clamp(64px,9vw,120px)] font-black tracking-tight text-[#111111] leading-none select-none">
                    {year}
                  </h2>
                </div>

                {/* Seasons under this year */}
                <div className="space-y-20 sm:space-y-28">
                  {seasonsList.map((seasonItem, sIdx) => {
                    const featuredTeam = seasonItem.championTeam || seasonItem.teams?.[0] || null;
                    const teamsList = seasonItem.teams || [];

                    return (
                      <div key={seasonItem.id || sIdx} className="space-y-8">
                        {/* Sub-header for season */}
                        <div className="flex items-center justify-between pb-2 border-b border-black/15">
                          <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-[0.18em] text-[#c25e40]">
                            {seasonItem.name}
                          </span>
                          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#777777]">
                            {seasonItem.status === 'ACTIVE' ? 'ĐANG DIỄN RA' : 'CHUNG CUỘC'}
                          </span>
                        </div>

                        {/* 3-Column Editorial Grid matching Windham-Campbell reference */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
                          {/* Column 1 (Left): Graphic Quotation Frame + Large Rectangular Team Visual */}
                          <div className="lg:col-span-4 flex items-center justify-center lg:justify-start">
                            <div className="flex items-center gap-2 sm:gap-3">
                              {/* Giant Left Block Quote Glyph */}
                              <span className="font-['Space_Grotesk'] text-6xl sm:text-8xl lg:text-9xl font-black text-[#111111] select-none leading-none -mr-1">
                                “
                              </span>

                              {/* Large Rectangular Team Image Frame */}
                              <div className="relative aspect-[3/4] w-48 sm:w-56 lg:w-60 bg-[#edeae3] border border-black overflow-hidden shadow-none flex items-center justify-center">
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
                                    <span className="font-bold text-base sm:text-lg uppercase tracking-tight line-clamp-2">
                                      {featuredTeam?.teamName || 'VÔ ĐỊCH'}
                                    </span>
                                    <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/70 mt-1">
                                      CHAMPION TEAM
                                    </span>
                                  </div>
                                )}

                                {/* Floating Team Tag */}
                                <div className="absolute bottom-2 left-2 right-2 bg-black text-white px-2 py-1 text-center font-mono text-[10px] font-bold uppercase tracking-[0.12em]">
                                  {featuredTeam?.teamName || 'CHAMPION'}
                                </div>
                              </div>

                              {/* Giant Right Block Quote Glyph */}
                              <span className="font-['Space_Grotesk'] text-6xl sm:text-8xl lg:text-9xl font-black text-[#111111] select-none leading-none -ml-1">
                                ”
                              </span>
                            </div>
                          </div>

                          {/* Column 2 (Center): Stacked Bold Categories Typography */}
                          <div className="lg:col-span-3 flex flex-col justify-center space-y-1 sm:space-y-2">
                            <span className="text-[clamp(28px,3.8vw,48px)] font-black tracking-tight uppercase leading-[0.98] text-[#111111] block">
                              Champion
                            </span>
                            <span className="text-[clamp(28px,3.8vw,48px)] font-black tracking-tight uppercase leading-[0.98] text-[#111111] block">
                              Finalist
                            </span>
                            <span className="text-[clamp(28px,3.8vw,48px)] font-black tracking-tight uppercase leading-[0.98] text-[#111111] block">
                              Division
                            </span>
                            <span className="text-[clamp(28px,3.8vw,48px)] font-black tracking-tight uppercase leading-[0.98] text-[#111111] block">
                              All-Star
                            </span>
                          </div>

                          {/* Column 3 (Right): Team List with Thin 1px Horizontal Dividers */}
                          <div className="lg:col-span-5 flex flex-col justify-center divide-y divide-black/15 border-t border-black/15">
                            {teamsList.length > 0 ? (
                              teamsList.slice(0, 8).map((team, tIdx) => (
                                <div
                                  key={team.teamId || tIdx}
                                  className="py-3 sm:py-3.5 flex items-center justify-between gap-4 group cursor-pointer hover:bg-black/[0.03] px-2 transition-colors"
                                  onClick={() => handleOpenSeasonDetail(seasonItem.id)}
                                >
                                  <span className="font-bold text-sm sm:text-base text-[#111111] tracking-tight group-hover:text-[#c25e40] transition-colors">
                                    {team.teamName}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs text-[#666666] uppercase">
                                      {team.role || (team.rank === 1 ? 'Champion' : `Finalist #${team.rank || tIdx + 1}`)}
                                    </span>
                                    <ChevronRight size={14} className="text-black/30 group-hover:text-[#c25e40] transition-colors" />
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="py-6 text-sm text-[#777777] italic">
                                Đang tổng hợp dữ liệu đội tuyển cho mùa giải này.
                              </div>
                            )}

                            {/* Minimal Action to View Full Season */}
                            <div className="pt-3">
                              <button
                                type="button"
                                onClick={() => handleOpenSeasonDetail(seasonItem.id)}
                                className="text-xs font-bold uppercase tracking-[0.1em] text-[#c25e40] hover:underline flex items-center gap-1 mt-1"
                              >
                                <span>Xem toàn bộ bảng thành tích {seasonItem.name}</span>
                                <ArrowRight size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : loading ? (
          <div className="py-24 text-center text-[#777777] font-mono text-sm">
            Đang tải dữ liệu niên giám vinh danh...
          </div>
        ) : (
          <div className="py-24 text-center text-[#777777] font-mono text-sm">
            Chưa có mùa giải nào được ghi nhận trong kho lưu trữ.
          </div>
        )}

        {/* ── 2. ABOUT WORKRANK (PLACED AT THE VERY BOTTOM OF THE ARCHIVE) ── */}
        <section className="mt-32 pt-16 border-t-2 border-black max-w-3xl">
          <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#c25e40] block mb-3">
            VỀ WORKRANK 3WIN MEDIA
          </span>
          <h3 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-[#111111] mb-4">
            GHI DẤU THÀNH TÍCH & PHÁT TRIỂN ĐỘI NGŨ.
          </h3>
          <p className="text-sm sm:text-base text-[#555555] leading-relaxed mb-6">
            WorkRank là hệ sinh thái quản trị hiệu suất, thi đua theo mùa giải và vinh danh những tập thể, cá nhân có đóng góp nổi bật tại 3WIN Media. Mọi kết quả đều được đồng bộ và lưu trữ bất biến.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#111111] hover:bg-[#262626] text-white text-xs sm:text-sm font-bold uppercase tracking-wider rounded-[2px] transition-all"
          >
            <span>Truy Cập Workspace</span>
            <ArrowRight size={14} />
          </Link>
        </section>
      </main>

      {/* ── 3. SEASON DETAIL MODAL (CLEAN EDITORIAL TABLES) ── */}
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
              <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#c25e40]">
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
                      <span className="font-mono text-xs text-[#c25e40] font-bold">+{team.grandPoints || 0} GP</span>
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
                  {selectedSeasonDetail.individualRankings.slice(0, 8).map((ind, idx) => (
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
