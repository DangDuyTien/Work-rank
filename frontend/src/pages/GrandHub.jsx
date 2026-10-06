import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trophy, Crown, Flame, Award, Calendar, ChevronRight, RefreshCw, Clock, Star, Sparkles, Tv, ExternalLink, CheckCircle2 } from 'lucide-react';
import { competition } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PageShell, Section, Card, EmptyState, PageState, Button, SegmentedControl, TabTransition, StatCard, PageTransitionSkeleton, AnimatedNumber, FlipList } from '../components/ui';
import { getCached, setCached, fetchWithCache, CACHE_KEYS, CACHE_TTL, isDeepEqual } from '../services/cache';

function formatDaysRemaining(endAt) {
  if (!endAt) return 'Không giới hạn';
  const diff = new Date(endAt).getTime() - Date.now();
  if (diff <= 0) return 'Đã kết thúc';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return `Còn ${days} ngày`;
}

function calculateYearProgress(startAt, endAt) {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
}

export default function GrandHub() {
  const { user, socket } = useAuth();
  const navigate = useNavigate();

  const cachedCurrentGrand = getCached(CACHE_KEYS.GRAND_CURRENT());
  const cachedStandings = cachedCurrentGrand?.id ? getCached(CACHE_KEYS.GRAND_STANDINGS(cachedCurrentGrand.id)) : null;

  const [grand, setGrand] = useState(() => cachedStandings?.grand || cachedCurrentGrand || null);
  const [standings, setStandings] = useState(() => Array.isArray(cachedStandings?.standings) ? cachedStandings.standings : []);
  const [individualStandings, setIndividualStandings] = useState(() => Array.isArray(cachedStandings?.individualStandings) ? cachedStandings.individualStandings : []);
  const [timeline, setTimeline] = useState(() => Array.isArray(cachedStandings?.timeline) ? cachedStandings.timeline : []);
  const [myTeamJourney, setMyTeamJourney] = useState(() => cachedStandings?.myTeamJourney || null);
  const [activeTab, setActiveTab] = useState('standings');
  const [loading, setLoading] = useState(!cachedStandings && !cachedCurrentGrand);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchGrandData = useCallback(async (isManual = false) => {
    try {
      if (!isManual && !cachedStandings) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const currentGrand = await fetchWithCache(CACHE_KEYS.GRAND_CURRENT(), () => competition.getCurrentGrand(), { ttl: CACHE_TTL.SHORT, force: isManual });
      if (!currentGrand) {
        setGrand(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const cacheKey = CACHE_KEYS.GRAND_STANDINGS(currentGrand.id);

      const [standingsRes, indRes, timelineRes] = await Promise.all([
        fetchWithCache(`${cacheKey}:standings`, () => competition.getGrandStandings(currentGrand.id), { ttl: CACHE_TTL.MEDIUM, force: isManual }),
        fetchWithCache(`${cacheKey}:ind`, () => competition.getGrandIndividualStandings(currentGrand.id).catch(() => ({ standings: [], grandIndividualChampion: null })), { ttl: CACHE_TTL.MEDIUM, force: isManual }),
        fetchWithCache(`${cacheKey}:timeline`, () => competition.getGrandTimeline(currentGrand.id), { ttl: CACHE_TTL.MEDIUM, force: isManual }),
      ]);

      let journeyRes = null;
      if (user?.teamId) {
        journeyRes = await fetchWithCache(`${cacheKey}:journey:${user.teamId}`, () => competition.getGrandTeamJourney(currentGrand.id, user.teamId), { ttl: CACHE_TTL.MEDIUM, force: isManual }).catch(() => null);
      }

      const bundle = {
        grand: currentGrand,
        standings: standingsRes.standings || [],
        individualStandings: indRes.standings || [],
        timeline: timelineRes || [],
        myTeamJourney: journeyRes || null,
      };

      setCached(cacheKey, bundle, { ttl: CACHE_TTL.MEDIUM });

      setGrand((prev) => (isDeepEqual(prev, currentGrand) ? prev : currentGrand));
      setStandings((prev) => (isDeepEqual(prev, bundle.standings) ? prev : bundle.standings));
      setIndividualStandings((prev) => (isDeepEqual(prev, bundle.individualStandings) ? prev : bundle.individualStandings));
      setTimeline((prev) => (isDeepEqual(prev, bundle.timeline) ? prev : bundle.timeline));
      if (journeyRes) setMyTeamJourney((prev) => (isDeepEqual(prev, journeyRes) ? prev : journeyRes));
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tải dữ liệu Grand Championship');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cachedStandings, user?.teamId]);

  useEffect(() => {
    fetchGrandData();
  }, [fetchGrandData]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchGrandData();
    socket.on('grand:standings_updated', handleUpdate);
    socket.on('grand:season_settled', handleUpdate);
    socket.on('grand:finished', handleUpdate);
    return () => {
      socket.off('grand:standings_updated', handleUpdate);
      socket.off('grand:season_settled', handleUpdate);
      socket.off('grand:finished', handleUpdate);
    };
  }, [socket, fetchGrandData]);

  const yearProgress = useMemo(() => {
    if (!grand?.startAt || !grand?.endAt) return 0;
    return calculateYearProgress(grand.startAt, grand.endAt);
  }, [grand]);

  const myTeamStandings = useMemo(() => {
    if (!user?.teamId) return null;
    return standings.find((s) => Number(s.teamId) === Number(user.teamId)) || null;
  }, [user?.teamId, standings]);

  const activeSeasons = useMemo(() => timeline.filter((s) => s.status === 'ACTIVE').length, [timeline]);
  const finishedSeasons = useMemo(() => timeline.filter((s) => s.status === 'FINISHED').length, [timeline]);
  const teamPreview = standings.filter((team, index) => index < 5 || Number(team.teamId) === Number(user?.teamId));
  const individualPreview = individualStandings.filter((individual, index) => index < 5 || Number(individual.userId || individual.id) === Number(user?.id));

  if (loading) {
    return (
      <PageShell>
        <PageTransitionSkeleton />
      </PageShell>
    );
  }

  if (error) {
    return <PageState type="error" title="Lỗi tải Grand Hub" description={error} onRetry={fetchGrandData} />;
  }

  if (!grand) {
    return (
      <PageShell narrow>
        <div style={{ padding: '40px 0' }}>
          <EmptyState
            icon={Trophy}
            title="Chưa Có Grand Championship Đang Hoạt Động"
            description="Ban tổ chức chưa khởi tạo giải đấu lớn cho năm nay. Hãy quay lại sau!"
          />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <style>{`
        @media (max-width: 860px) {
          .grand-hero-body { flex-direction: column !important; }
          .grand-hero-team { min-width: 0 !important; width: 100% !important; }
          .grand-stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 560px) {
          .grand-stats-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* HERO GRAND CHAMPIONSHIP BANNER */}
      <section
        style={{
          padding: '28px 32px',
          background: 'var(--primary)',
          color: 'var(--surface)',
          border: '1px solid rgba(180, 83, 9, 0.3)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          className="grand-hero-body"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}
        >
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span
                style={{
                  padding: '3px 12px',
                  fontSize: 10,
                  fontWeight: 600,
                  background: 'var(--accent, var(--accent))',
                  color: 'var(--surface)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Crown size={12} /> NĂM {grand.year}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                <Clock size={12} /> {formatDaysRemaining(grand.endAt)}
              </span>
            </div>

            <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 8px 0', letterSpacing: -0.5, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Trophy size={26} color="var(--accent, var(--accent))" /> {grand.name}
            </h1>
            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, fontWeight: 400, maxWidth: 600 }}>
              {grand.description || 'Giải đấu lớn nhất toàn công ty tích lũy điểm Grand Points từ tất cả các Mùa Giải trong năm.'}
            </p>

            {/* Year Progress Bar */}
            <div style={{ maxWidth: 400 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 5, textTransform: 'uppercase' }}>
                <span>Đường đua năm {grand.year}</span>
                <span>{yearProgress}%</span>
              </div>
              <div style={{ height: 6, width: '100%', background: 'rgba(255,255,255,0.12)' }}>
                <div style={{ height: '100%', width: `${yearProgress}%`, background: 'var(--accent, var(--accent))', transition: 'width 0.4s ease' }} />
              </div>
            </div>
          </div>

          {/* MY TEAM STANDING */}
          {myTeamStandings ? (
            <div
              className="grand-hero-team"
              style={{
                padding: '16px 22px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(180, 83, 9, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  background: 'var(--accent, var(--accent))',
                  color: 'var(--surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                #{myTeamStandings.rank}
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase' }}>Đội của bạn</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{myTeamStandings.teamName}</div>
                <div style={{ fontSize: 13, color: 'var(--accent, var(--accent))', fontWeight: 700, marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                  {myTeamStandings.grandPoints} GP
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: 500 }}>
                  {myTeamStandings.seasonWins} Vô địch • {myTeamStandings.podiumCount} Top 3
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.04)', fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
              Đội của bạn chưa có điểm Grand Points nào trong năm {grand.year}.
            </div>
          )}
        </div>
      </section>

      {/* QUICK STATS */}
      <div className="grand-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <StatCard icon={Trophy} label="Đội tranh tài" value={standings.length} color="var(--accent)" />
        <StatCard icon={Star} label="Cá nhân xếp hạng" value={individualStandings.length} color="var(--primary)" />
        <StatCard icon={Calendar} label="Mùa giải trong năm" value={timeline.length} detail={activeSeasons > 0 ? `${activeSeasons} đang diễn ra` : `${finishedSeasons} đã kết thúc`} color="var(--success)" />
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <SegmentedControl
          ariaLabel="Grand Hub Tabs"
          options={[
            { key: 'standings', label: `BXH Đội (${standings.length})` },
            { key: 'individual', label: `BXH Cá Nhân (${individualStandings.length})` },
            { key: 'timeline', label: `Dòng Thời Gian (${timeline.length})` },
            { key: 'journey', label: 'Hành Trình Đội' },
            { key: 'milestones', label: 'Vinh Danh' },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />

        <Button variant="secondary" size="sm" onClick={fetchGrandData} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={13} /> Cập nhật
        </Button>
      </div>

      <TabTransition key={activeTab} minHeight={420}>
        {/* TAB: TEAM STANDINGS (preview) */}
        {activeTab === 'standings' && (
          <Section
            title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={18} color="var(--accent, var(--accent))" /> Bảng Tổng Sắp Đội Nhóm Năm {grand.year}</span>}
            description="Xếp theo: Điểm tích lũy GP → Số lần Vô địch mùa giải → Top 3"
            actions={
              grand?.id && (
                <Link
                  to={`/leaderboard?scope=teams&period=grand&grandId=${grand.id}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '7px 14px',
                    background: 'var(--primary)',
                    color: 'var(--surface)',
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Xem toàn bộ BXH Grand <ExternalLink size={12} />
                </Link>
              )
            }
          >
            {standings.length === 0 ? (
              <EmptyState title="Chưa có điểm Grand Points" description="Các đội sẽ nhận Grand Points sau khi các Season trong năm được kết thúc." />
            ) : (
              <FlipList resetKey={`grand-standings-${grand?.id || 'default'}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {teamPreview.map((team) => {
                  const isTop1 = team.rank === 1;
                  const isMyTeam = user?.teamId && Number(team.teamId) === Number(user.teamId);
                  return (
                    <div
                      key={team.teamId}
                      data-flip-id={team.teamId}
                      className="ranking-flip-row"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: isMyTeam ? 'rgba(0, 0, 0, 0.02)' : 'var(--surface)',
                        border: isMyTeam ? '1.5px solid rgba(0, 0, 0, 0.2)' : isTop1 ? '1.5px solid rgba(180, 83, 9, 0.25)' : '1px solid var(--border)',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            background: isTop1 ? 'var(--accent)' : team.rank === 2 ? '#78716c' : team.rank === 3 ? '#a8a29e' : 'rgba(0, 0, 0, 0.06)',
                            color: team.rank <= 3 ? 'var(--surface)' : 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 13,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          #{team.rank}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.teamName}</span>
                            {isMyTeam && (
                              <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', background: 'var(--primary)', color: 'var(--surface)', textTransform: 'uppercase' }}>
                                Đội của bạn
                              </span>
                            )}
                            {isTop1 && (
                              <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', background: 'rgba(180, 83, 9, 0.12)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Crown size={10} /> Dẫn đầu năm
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
                            {team.seasonWins} Vô địch • {team.podiumCount} Top 3 • {team.completedSeasons} giải
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>
                          <AnimatedNumber value={team.grandPoints || 0} duration={700} /> <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>GP</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
                          {isTop1 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)' }}>
                              <Crown size={11} color="var(--accent)" /> Vị trí số 1
                            </span>
                          ) : (
                            `Kém top 1: ${standings[0].grandPoints - team.grandPoints} GP`
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </FlipList>
            )}
          </Section>
        )}

        {/* TAB: INDIVIDUAL GRAND STANDINGS (preview) */}
        {activeTab === 'individual' && (
          <Section
            title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Star size={18} color="var(--accent, var(--accent))" /> Bảng Tổng Sắp Cá Nhân Năm {grand.year}</span>}
            description={`Tổng hợp điểm thi đấu cá nhân từ tất cả các Mùa Giải trong năm ${grand.year}`}
            actions={
              grand?.id && (
                <Link
                  to={`/leaderboard?scope=members&period=grand&grandId=${grand.id}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '7px 14px',
                    background: 'var(--primary)',
                    color: 'var(--surface)',
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Xem toàn bộ BXH <ExternalLink size={12} />
                </Link>
              )
            }
          >
            {(() => {
              const filtered = individualPreview;

              if (filtered.length === 0) {
                return <EmptyState title="Không tìm thấy nhân viên" description="Chưa có dữ liệu cá nhân nào được tích lũy trong Grand Championship này." />;
              }

              return (
                <FlipList resetKey={`grand-indiv-${grand?.id || 'default'}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filtered.map((emp) => {
                    const isTop1 = emp.rank === 1;
                    const isMe = user && (Number(emp.userId) === Number(user.id) || Number(emp.id) === Number(user.id));
                    const empKey = emp.userId || emp.id;
                    return (
                      <div
                        key={empKey}
                        data-flip-id={empKey}
                        className="ranking-flip-row"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          background: isMe ? 'rgba(0, 0, 0, 0.02)' : 'var(--surface)',
                          border: isMe ? '1.5px solid rgba(0, 0, 0, 0.2)' : isTop1 ? '1.5px solid rgba(180, 83, 9, 0.25)' : '1px solid var(--border)',
                          gap: 12,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              background: isTop1 ? 'var(--accent)' : emp.rank === 2 ? '#78716c' : emp.rank === 3 ? '#a8a29e' : 'rgba(0, 0, 0, 0.06)',
                              color: emp.rank <= 3 ? 'var(--surface)' : 'var(--text-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 13,
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            #{emp.rank}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</span>
                              {isMe && (
                              <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', background: 'var(--primary)', color: 'var(--surface)', textTransform: 'uppercase' }}>
                                Bạn
                              </span>
                            )}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
                              Đội: <strong style={{ color: 'var(--text-secondary)' }}>{emp.teamName || 'Chưa gán đội'}</strong> • {emp.seasonsCount || 0} mùa giải • {emp.seasonWins || 0} lần vô địch
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent, var(--accent))', fontFamily: "'JetBrains Mono', monospace" }}>
                            <AnimatedNumber value={emp.grandPoints ?? 0} duration={700} /> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>GP</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
                            {isTop1 ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)' }}>
                                <Crown size={11} color="var(--accent)" /> Top 1
                              </span>
                            ) : (
                              `Kém top 1: ${((individualStandings[0]?.grandPoints || 0) - (emp.grandPoints || 0)).toLocaleString()} GP`
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </FlipList>
              );
            })()}
          </Section>
        )}

        {/* TAB: TIMELINE */}
        {activeTab === 'timeline' && (
          <Section
            title="Dòng Thời Gian Mùa Giải"
            description={`Tất cả Mùa Giải trong khuôn khổ Grand Championship Năm ${grand.year}`}
            actions={
              <Button variant="secondary" size="sm" onClick={() => navigate('/arena')}>
                Vào Đấu Trường <ChevronRight size={14} />
              </Button>
            }
          >
            {timeline.length === 0 ? (
              <EmptyState title="Chưa có mùa giải nào" description="Chưa có mùa giải nào được liên kết vào Grand Championship này." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {timeline.map((s) => {
                  const isFinished = s.status === 'FINISHED';
                  const isActive = s.status === 'ACTIVE';
                  return (
                    <div
                      key={s.seasonId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 16,
                        background: 'var(--surface)',
                        border: isActive ? '1.5px solid rgba(21, 128, 61, 0.35)' : '1px solid var(--border)',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 600,
                              padding: '2px 6px',
                              background: isActive ? 'var(--success)' : isFinished ? '#78716c' : 'var(--primary)',
                              color: 'var(--surface)',
                              textTransform: 'uppercase',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            {isActive ? (
                              <><Flame size={9} color="var(--surface)" /> Đang diễn ra</>
                            ) : isFinished ? (
                              <><CheckCircle2 size={9} color="var(--surface)" /> Đã kết thúc</>
                            ) : (
                              <><Clock size={9} color="var(--surface)" /> Sắp diễn ra</>
                            )}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{s.seasonType}</span>
                        </div>
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>{s.name}</h3>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                          {new Date(s.startAt).toLocaleDateString('vi-VN')} — {new Date(s.endAt).toLocaleDateString('vi-VN')}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                        {s.winner ? (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Đội chiến thắng</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Trophy size={13} color="var(--success)" /> {s.winner.teamName}
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Giải thưởng Top 1</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent, var(--accent))', fontFamily: "'JetBrains Mono', monospace" }}>
                              +{(s.grandPointsDistribution?.distribution?.[0]?.points) || 10} GP
                            </div>
                          </div>
                        )}

                        <Button variant="secondary" size="sm" onClick={() => navigate(`/leaderboard?scope=teams&period=season&seasonId=${s.seasonId}`)}>
                          BXH mùa
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {/* TAB: TEAM JOURNEY */}
        {activeTab === 'journey' && (
          <Section
            title={`Hành Trình: ${myTeamStandings?.teamName || 'Đội Của Bạn'}`}
            description="Lịch sử các giải đấu đã tham gia và điểm Grand Points tích lũy"
          >
            {!myTeamJourney || myTeamJourney.history.length === 0 ? (
              <EmptyState title="Chưa có dữ liệu thi đấu" description="Đội của bạn chưa hoàn thành giải đấu nào trong Grand Championship này." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {myTeamJourney.history.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{h.seasonName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
                        Hạng #{h.rankPosition} • {h.reason}
                      </div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                      +{h.grandPointsAwarded} GP
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* TAB: MILESTONES */}
        {activeTab === 'milestones' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {[
              { id: 1, title: 'Khởi Đầu Vinh Quang', desc: 'Đạt mốc 25 Grand Points đầu tiên', target: 25, current: myTeamStandings?.grandPoints || 0, icon: Sparkles },
              { id: 2, title: 'Ứng Cử Viên Vô Địch', desc: 'Vượt mốc 50 Grand Points tích lũy', target: 50, current: myTeamStandings?.grandPoints || 0, icon: Award },
              { id: 3, title: 'Huyền Thoại Tranh Đấu', desc: 'Đạt 100 Grand Points trong cả năm', target: 100, current: myTeamStandings?.grandPoints || 0, icon: Crown },
              { id: 4, title: 'Chuỗi Bất Bại', desc: 'Giành Vô địch tại 3 Mùa Giải', target: 3, current: myTeamStandings?.seasonWins || 0, icon: Trophy },
            ].map((m) => {
              const isUnlocked = m.current >= m.target;
              const pct = Math.min(100, Math.round((m.current / m.target) * 100));
              const Icon = m.icon;
              return (
                <Card
                  key={m.id}
                  style={{
                    padding: 20,
                    background: 'var(--surface)',
                    border: isUnlocked ? '1.5px solid rgba(180, 83, 9, 0.3)' : '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        background: isUnlocked ? 'rgba(180, 83, 9, 0.1)' : 'rgba(0, 0, 0, 0.04)',
                        color: isUnlocked ? 'var(--accent)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '2px 8px',
                        background: isUnlocked ? 'rgba(21, 128, 61, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        color: isUnlocked ? 'var(--success)' : 'var(--text-muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {isUnlocked ? 'Đã mở khóa' : `${m.current} / ${m.target}`}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>{m.title}</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px 0', lineHeight: 1.4, fontWeight: 400 }}>{m.desc}</p>

                  {/* Progress bar */}
                  <div style={{ height: 4, width: '100%', background: 'rgba(0, 0, 0, 0.06)' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: isUnlocked ? 'var(--success)' : 'var(--accent, var(--accent))', transition: 'width 0.3s ease' }} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </TabTransition>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, padding: '12px 0' }}>
        <Link to="/youtube" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}><Tv size={15} /> Số liệu YouTube <ExternalLink size={13} /></Link>
        <Link to="/leaderboard?scope=youtube" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>BXH YouTube <ExternalLink size={13} /></Link>
      </div>
    </PageShell>
  );
}
