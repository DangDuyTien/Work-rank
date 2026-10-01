import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trophy, ArrowRight, X, Search } from 'lucide-react';
import PublicHeader from '../components/PublicHeader';
import { competition } from '../services/api';

/**
 * Geometric Block Quote SVG Glyphs matching Windham-Campbell Reference
 */
function BlockQuoteLeft({ className = 'w-14 sm:w-18 lg:w-24 h-auto' }) {
  return (
    <svg viewBox="0 0 110 200" className={`fill-black flex-shrink-0 select-none ${className}`} aria-hidden="true">
      <polygon points="38,0 110,0 110,120 55,200 0,200 38,120" />
    </svg>
  );
}

function BlockQuoteRight({ className = 'w-14 sm:w-18 lg:w-24 h-auto' }) {
  return (
    <svg viewBox="0 0 110 200" className={`fill-black flex-shrink-0 select-none ${className}`} aria-hidden="true">
      <polygon points="0,0 72,0 110,80 55,200 0,200 38,120 0,120" />
    </svg>
  );
}

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
    <div className="min-h-screen bg-[#eee9e0] text-[#111111] antialiased selection:bg-[#b85d43]/20 flex flex-col">
      <PublicHeader />

      {/* ── MAIN EDITORIAL CANVAS ── */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-6 sm:px-12 lg:px-16 xl:px-20 pt-8 sm:pt-12 pb-24 sm:pb-36">
        {/* Giant Title */}
        <div className="mb-1 sm:mb-2">
          <h1 className="font-condensed text-[clamp(96px,14.5vw,210px)] font-black tracking-[-0.03em] text-[#b85d43] leading-[0.84] select-none">
            Vinh danh
          </h1>
        </div>

        {/* Minimal Search & Year Filter Toolbar */}
        <div className="mb-10 sm:mb-14 pb-4 border-b border-[#b85d43]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
          <div className="space-y-20 sm:space-y-28">
            {seasonsByYear.map(({ year, seasonsList }) => (
              <div key={year} className="space-y-8 sm:space-y-12">
                {/* Year Header */}
                <div>
                  <h2 className="font-condensed text-[clamp(68px,8.5vw,125px)] font-black tracking-[-0.02em] text-[#111111] leading-none select-none">
                    {year}
                  </h2>
                </div>

                {/* Seasons under this year */}
                <div className="space-y-16 sm:space-y-20">
                  {seasonsList.map((seasonItem, sIdx) => {
                    const featuredTeam = seasonItem.championTeam || seasonItem.teams?.[0] || null;
                    const teamsList = seasonItem.teams || [];

                    return (
                      <div key={seasonItem.id || sIdx} className="space-y-4">
                        {/* 3-Column Editorial Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16 items-center">
                          {/* Column 1 (Left ~32%): Team Image framed by solid polygonal block quotes */}
                          <div className="lg:col-span-4 flex items-center justify-center lg:justify-start">
                            <div className="flex items-center gap-3 sm:gap-4">
                              {/* Left Solid Polygonal Quote */}
                              <BlockQuoteLeft className="w-12 sm:w-16 lg:w-20" />

                              {/* Large Rectangular Team Image Frame */}
                              <div className="relative aspect-[3/3.8] w-48 sm:w-56 lg:w-64 bg-[#dfd9ce] border border-black/80 overflow-hidden shadow-none flex items-center justify-center">
                                {featuredTeam?.avatarUrl ? (
                                  <img
                                    src={featuredTeam.avatarUrl}
                                    alt={featuredTeam.teamName}
                                    className="w-full h-full object-cover filter grayscale contrast-105"
                                  />
                                ) : (
                                  <div
                                    className="w-full h-full flex flex-col items-center justify-center text-white p-5 text-center"
                                    style={{ backgroundColor: featuredTeam?.color || '#18181b' }}
                                  >
                                    <Trophy size={48} className="text-[#facc15] mb-2" />
                                    <span className="font-condensed text-xl sm:text-2xl font-black uppercase tracking-tight line-clamp-2">
                                      {featuredTeam?.teamName || 'VÔ ĐỊCH'}
                                    </span>
                                    <span className="font-condensed text-xs uppercase tracking-[0.16em] text-white/70 mt-1 font-bold">
                                      CHAMPION TEAM
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Right Solid Polygonal Quote */}
                              <BlockQuoteRight className="w-12 sm:w-16 lg:w-20" />
                            </div>
                          </div>

                          {/* Column 2 (Middle ~28%): Stacked Condensed Categories */}
                          <div className="lg:col-span-3 flex flex-col justify-center space-y-0 sm:space-y-0.5">
                            <span className="font-condensed text-[clamp(36px,4.5vw,62px)] font-black tracking-[-0.02em] leading-[0.95] text-[#111111] block select-none">
                              Drama
                            </span>
                            <span className="font-condensed text-[clamp(36px,4.5vw,62px)] font-black tracking-[-0.02em] leading-[0.95] text-[#111111] block select-none">
                              Fiction
                            </span>
                            <span className="font-condensed text-[clamp(36px,4.5vw,62px)] font-black tracking-[-0.02em] leading-[0.95] text-[#111111] block select-none">
                              Nonfiction
                            </span>
                            <span className="font-condensed text-[clamp(36px,4.5vw,62px)] font-black tracking-[-0.02em] leading-[0.95] text-[#111111] block select-none">
                              Poetry
                            </span>
                          </div>

                          {/* Column 3 (Right ~40%): Editorial Serif Roster with Thin Terracotta Lines */}
                          <div className="lg:col-span-5 flex flex-col justify-center divide-y divide-[#b85d43]/35 border-t border-b border-[#b85d43]/35">
                            {teamsList.length > 0 ? (
                              teamsList.slice(0, 8).map((team, tIdx) => (
                                <div
                                  key={team.teamId || tIdx}
                                  className="py-2 sm:py-2.5 flex items-baseline justify-between gap-4 cursor-pointer hover:bg-black/[0.02] px-1 transition-colors group"
                                  onClick={() => handleOpenSeasonDetail(seasonItem.id)}
                                >
                                  <span className="font-serif text-[15px] sm:text-[17px] text-[#111111] tracking-normal group-hover:text-[#b85d43] transition-colors">
                                    {team.teamName}
                                  </span>
                                  <span className="font-serif text-[13px] sm:text-[15px] text-[#444444] text-right">
                                    {team.role || (team.rank === 1 ? 'Vô địch' : `Hạng #${team.rank || tIdx + 1}`)}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="py-6 text-sm font-serif text-[#777777] italic">
                                Đang tổng hợp dữ liệu đội tuyển cho mùa giải này.
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Thin Bottom Full-width Divider */}
                        <div className="pt-8 border-b border-[#b85d43]/30" />
                      </div>
                    );
                  })}
                </div>
              </div>
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
          <div className="bg-[#eee9e0] border border-black w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[2px] p-6 sm:p-8 shadow-2xl relative">
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
              <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#b85d43]">
                CHI TIẾT MÙA GIẢI
              </span>
              <h3 className="font-condensed text-3xl sm:text-4xl font-black tracking-tight text-[#111111] mt-1">
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
                      <span className="font-mono text-xs text-[#b85d43] font-bold">+{team.grandPoints || 0} GP</span>
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
      <footer className="py-10 border-t border-black/10 bg-[#dfd9ce] text-[#666666] text-xs">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-12 lg:px-16 xl:px-20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-bold text-[#111111] uppercase tracking-tight">
              WORKRANK / 3WIN MEDIA
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
