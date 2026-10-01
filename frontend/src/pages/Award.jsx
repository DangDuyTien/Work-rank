import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trophy, ArrowRight, ChevronRight, X, Search } from 'lucide-react';
import PublicHeader from '../components/PublicHeader';
import BrandMark from '../components/BrandMark';
import { competition } from '../services/api';

export default function Award() {
  const [searchParams, setSearchParams] = useSearchParams();
  const seasonParam = searchParams.get('season');

  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('ALL');

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

          if (seasonParam) {
            handleOpenSeasonDetail(Number(seasonParam));
          }
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [seasonParam]);

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

  // Extract distinct years
  const availableYears = useMemo(() => {
    const years = new Set();
    seasons.forEach((s) => {
      const y = s.year || (s.startAt ? new Date(s.startAt).getFullYear() : 2026);
      years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [seasons]);

  // Filter seasons & group by year
  const seasonsByYear = useMemo(() => {
    const map = {};
    const filtered = seasons.filter((s) => {
      const y = s.year || (s.startAt ? new Date(s.startAt).getFullYear() : 2026);
      if (selectedYear !== 'ALL' && y !== Number(selectedYear)) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = s.name?.toLowerCase().includes(query);
        const matchTeam = s.teams?.some((t) => t.teamName?.toLowerCase().includes(query));
        return matchName || matchTeam;
      }
      return true;
    });

    filtered.forEach((s) => {
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
  }, [seasons, selectedYear, searchQuery]);

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-[#111111] font-['Space_Grotesk'] antialiased selection:bg-[#c25e40]/20 flex flex-col">
      <PublicHeader />

      {/* ── 1. EDITORIAL AWARD ARCHIVE ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 sm:px-10 lg:px-16 pt-8 sm:pt-14 pb-20 sm:pb-32">
        {/* Giant Display Title */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-[clamp(80px,13.5vw,190px)] font-black tracking-tight uppercase leading-[0.88] text-[#c25e40] select-none">
            Vinh danh
          </h1>
        </div>

        {/* Minimal Search & Year Filter Toolbar */}
        <div className="mb-14 sm:mb-20 pb-4 border-b border-black/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Year Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#777777] mr-1">
              NĂM:
            </span>
            <button
              type="button"
              onClick={() => setSelectedYear('ALL')}
              className={`px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider rounded-[2px] transition-colors ${
                selectedYear === 'ALL'
                  ? 'bg-[#111111] text-white'
                  : 'bg-black/5 text-[#555555] hover:bg-black/10'
              }`}
            >
              TẤT CẢ
            </button>
            {availableYears.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setSelectedYear(yr)}
                className={`px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider rounded-[2px] transition-colors ${
                  selectedYear === yr
                    ? 'bg-[#111111] text-white'
                    : 'bg-black/5 text-[#555555] hover:bg-black/10'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>

          {/* Keyword Search */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Tìm mùa giải hoặc tên đội..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-black/20 text-xs font-mono px-3 py-2 pl-8 text-[#111111] placeholder:text-[#888888] focus:outline-none focus:border-black rounded-[2px]"
            />
            <Search size={14} className="absolute left-2.5 top-2.5 text-[#888888]" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 p-0.5 text-[#888888] hover:text-[#111111]"
              >
                <X size={14} />
              </button>
            )}
          </div>
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
            Không tìm thấy mùa giải phù hợp với bộ lọc.
          </div>
        )}
      </main>

      {/* ── 2. SEASON DETAIL MODAL ── */}
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

      {/* ── 3. MINIMAL FOOTER ── */}
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
