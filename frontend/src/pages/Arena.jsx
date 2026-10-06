import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Flame, Clock, Users, BookOpen, RefreshCw, CheckCircle2, Tv, ExternalLink, Crown, Sparkles, ArrowUp, ArrowDown, Minus, Swords, Target } from 'lucide-react';
import { competition } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PageShell, Section, Card, EmptyState, PageState, Button, SegmentedControl, TabTransition, StatCard, PageTransitionSkeleton, AnimatedNumber, FlipList } from '../components/ui';
import { getCached, setCached, fetchWithCache, CACHE_KEYS, CACHE_TTL, isDeepEqual } from '../services/cache';

function formatCountdown(endAt) {
  if (!endAt) return 'Không giới hạn';
  const diff = new Date(endAt).getTime() - Date.now();
  if (diff <= 0) return 'Đã kết thúc';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  return `${days}d ${hours}h ${minutes}m`;
}

function progressPercent(startAt, endAt) {
  if (!startAt || !endAt) return 0;
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
}

const STATUS_BADGE = {
  ACTIVE: { label: 'Đang diễn ra', bg: 'rgba(34,197,94,0.12)', color: '#16a34a', border: 'rgba(34,197,94,0.3)' },
  PAUSED: { label: 'Tạm dừng', bg: 'rgba(234,179,8,0.15)', color: '#ca8a04', border: 'rgba(234,179,8,0.4)' },
  SCHEDULED: { label: 'Sắp diễn ra', bg: 'rgba(180,83,9,0.15)', color: 'var(--accent)', border: 'rgba(180,83,9,0.3)' },
  CALCULATING: { label: 'Đang kết toán', bg: 'rgba(168,85,247,0.15)', color: '#9333ea', border: 'rgba(168,85,247,0.3)' },
  FINISHED: { label: 'Đã hoàn thành', bg: 'rgba(100,116,139,0.12)', color: 'var(--text-secondary)', border: 'rgba(100,116,139,0.25)' },
  DRAFT: { label: 'Bản nháp', bg: 'rgba(148,163,184,0.1)', color: 'var(--text-secondary)', border: 'rgba(148,163,184,0.2)' },
};

export default function Arena() {
  const { user, socket } = useAuth();
  const cachedActive = getCached(CACHE_KEYS.ARENA_ACTIVE());
  const cachedDetails = cachedActive?.id ? getCached(CACHE_KEYS.ARENA_SEASON_DETAILS(cachedActive.id)) : null;

  const [season, setSeason] = useState(() => cachedDetails?.season || cachedActive || null);
  const [myTeam, setMyTeam] = useState(() => cachedDetails?.myTeam || null);
  const [leaderboard, setLeaderboard] = useState(() => Array.isArray(cachedDetails?.leaderboard) ? cachedDetails.leaderboard : []);
  const [individualLeaderboard, setIndividualLeaderboard] = useState(() => Array.isArray(cachedDetails?.individualLeaderboard) ? cachedDetails.individualLeaderboard : []);
  const [challenges, setChallenges] = useState(() => Array.isArray(cachedDetails?.challenges) ? cachedDetails.challenges : []);
  const [seasonRules, setSeasonRules] = useState(() => cachedDetails?.seasonRules || null);
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [loading, setLoading] = useState(!cachedDetails && !cachedActive);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchActiveArena = useCallback(async (isManual = false) => {
    try {
      if (!isManual && !cachedDetails) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const active = await fetchWithCache(CACHE_KEYS.ARENA_ACTIVE(), () => competition.getActiveSeason(), { ttl: CACHE_TTL.SHORT, force: isManual });
      if (!active) {
        setSeason(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const cacheKey = CACHE_KEYS.ARENA_SEASON_DETAILS(active.id);

      const [detailRes, lbRes, indRes, chRes, rulesRes] = await Promise.all([
        fetchWithCache(`${cacheKey}:detail`, () => competition.getSeasonDetail(active.id), { ttl: CACHE_TTL.MEDIUM, force: isManual }),
        fetchWithCache(`${cacheKey}:lb`, () => competition.getSeasonLeaderboard(active.id), { ttl: CACHE_TTL.MEDIUM, force: isManual }),
        fetchWithCache(`${cacheKey}:ind`, () => competition.getSeasonIndividualLeaderboard(active.id).catch(() => ({ rankings: [], individualChampion: null })), { ttl: CACHE_TTL.MEDIUM, force: isManual }),
        fetchWithCache(`${cacheKey}:ch`, () => competition.getSeasonChallenges(active.id), { ttl: CACHE_TTL.MEDIUM, force: isManual }),
        fetchWithCache(`${cacheKey}:rules`, () => competition.getSeasonRules(active.id).catch(() => null), { ttl: CACHE_TTL.MEDIUM, force: isManual }),
      ]);

      const bundle = {
        season: detailRes.season || active,
        myTeam: detailRes.myTeam || null,
        leaderboard: lbRes.rankings || [],
        individualLeaderboard: indRes.rankings || [],
        challenges: chRes || [],
        seasonRules: rulesRes,
      };

      setCached(cacheKey, bundle, { ttl: CACHE_TTL.MEDIUM });

      setSeason((prev) => (isDeepEqual(prev, bundle.season) ? prev : bundle.season));
      setMyTeam((prev) => (isDeepEqual(prev, bundle.myTeam) ? prev : bundle.myTeam));
      setLeaderboard((prev) => (isDeepEqual(prev, bundle.leaderboard) ? prev : bundle.leaderboard));
      setIndividualLeaderboard((prev) => (isDeepEqual(prev, bundle.individualLeaderboard) ? prev : bundle.individualLeaderboard));
      setChallenges((prev) => (isDeepEqual(prev, bundle.challenges) ? prev : bundle.challenges));
      setSeasonRules((prev) => (isDeepEqual(prev, bundle.seasonRules) ? prev : bundle.seasonRules));
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tải dữ liệu Đấu Trường Arena');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cachedDetails]);

  useEffect(() => {
    fetchActiveArena();
  }, [fetchActiveArena]);

  useEffect(() => {
    if (!socket) return;

    const handleRefresh = () => {
      fetchActiveArena();
    };

    socket.on('season:leaderboard_updated', handleRefresh);
    socket.on('season:challenge_updated', handleRefresh);
    socket.on('season:paused', handleRefresh);
    socket.on('season:resumed', handleRefresh);
    socket.on('competition:score_awarded', handleRefresh);

    return () => {
      socket.off('season:leaderboard_updated', handleRefresh);
      socket.off('season:challenge_updated', handleRefresh);
      socket.off('season:paused', handleRefresh);
      socket.off('season:resumed', handleRefresh);
      socket.off('competition:score_awarded', handleRefresh);
    };
  }, [socket, fetchActiveArena]);

  if (loading) {
    return (
      <PageShell>
        <PageTransitionSkeleton />
      </PageShell>
    );
  }

  if (error) {
    return <PageState type="error" title="Lỗi tải Arena" description={error} onRetry={fetchActiveArena} />;
  }

  if (!season) {
    return (
      <PageShell narrow>
        <div style={{ padding: '40px 0' }}>
          <EmptyState
            icon={Trophy}
            title="Chưa có Mùa Giải Đang Diễn Ra"
            description="Hiện tại ban quản trị chưa kích hoạt mùa giải mới. Hãy quay lại sau hoặc liên hệ Admin để cập nhật lịch thi đấu!"
          />
        </div>
      </PageShell>
    );
  }

  const badge = STATUS_BADGE[season.status] || STATUS_BADGE.DRAFT;
  const myRankObj = leaderboard.find((r) => myTeam && Number(r.teamId) === Number(myTeam.teamId));
  const progress = progressPercent(season.startAt, season.endAt);

  const activeChallenges = challenges.filter((c) => c.status !== 'COMPLETED').length;
  const completedChallenges = challenges.filter((c) => c.status === 'COMPLETED').length;
  const teamPreview = leaderboard.filter((team, index) => index < 5 || (myTeam && Number(team.teamId) === Number(myTeam.teamId)));
  const individualPreview = individualLeaderboard.filter((individual, index) => index < 5 || Number(individual.userId || individual.id) === Number(user?.id));

  return (
    <PageShell>
      <style>{`
        @media (max-width: 860px) {
          .arena-hero-body { flex-direction: column !important; }
          .arena-hero-team { min-width: 0 !important; width: 100% !important; }
          .arena-stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 560px) {
          .arena-stats-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* HERO BANNER */}
      <section
        style={{
          padding: '24px 28px',
          background: 'var(--primary)',
          color: 'var(--surface)',
          border: '1px solid rgba(180, 83, 9, 0.3)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
        }}
      >
        <div
          className="arena-hero-body"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}
        >
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span
                style={{
                  padding: '3px 10px',
                  fontSize: 10,
                  fontWeight: 600,
                  background: 'rgba(255,255,255,0.12)',
                  color: 'var(--surface)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {badge.label}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                <Clock size={12} /> {formatCountdown(season.endAt)}
              </span>
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px 0', lineHeight: 1.3, letterSpacing: -0.5, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Flame size={24} color="var(--accent, var(--accent))" /> {season.name}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.7)', maxWidth: 600, lineHeight: 1.55, fontWeight: 400 }}>
              {season.description || 'Giải đấu YouTube Production & Quality Battle giữa các Content Creators và Video Editors.'}
            </p>

            {/* Progress bar */}
            <div style={{ maxWidth: 400, marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 5, textTransform: 'uppercase' }}>
                <span>Tiến độ mùa giải</span>
                <span>{progress}%</span>
              </div>
              <div style={{ height: 6, width: '100%', background: 'rgba(255,255,255,0.12)' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent, var(--accent))', transition: 'width 0.4s ease' }} />
              </div>
            </div>
          </div>

          {/* MY TEAM CARD */}
          {myTeam ? (
            <div
              className="arena-hero-team"
              style={{
                padding: '14px 18px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(180, 83, 9, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  background: 'var(--accent, var(--accent))',
                  color: 'var(--surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                {myTeam.teamNameSnapshot?.slice(0, 2).toUpperCase() || 'TM'}
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase' }}>Đội của bạn</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{myTeam.teamNameSnapshot}</div>
                <div style={{ fontSize: 12, color: 'var(--accent, var(--accent))', fontWeight: 600, marginTop: 2 }}>
                  Hạng #{myRankObj?.rank || '-'} • {(myRankObj?.score || 0).toLocaleString()} XP
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
              Bạn chưa thuộc Team nào tham gia mùa giải này.
            </div>
          )}
        </div>
      </section>

      {/* QUICK STATS */}
      <div className="arena-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <StatCard icon={Users} label="Đội thi đấu" value={leaderboard.length} color="var(--accent)" />
        <StatCard icon={Swords} label="Cá nhân tranh tài" value={individualLeaderboard.length} color="var(--primary)" />
        <StatCard icon={Target} label="Thử thách đang mở" value={activeChallenges} detail={completedChallenges > 0 ? `${completedChallenges} đã hoàn thành` : undefined} color="var(--accent)" />
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <SegmentedControl
          ariaLabel="Arena Tabs"
          options={[
            { key: 'leaderboard', label: `BXH Đội (${leaderboard.length})` },
            { key: 'individual', label: `BXH Cá Nhân (${individualLeaderboard.length})` },
            { key: 'challenges', label: `Thử Thách (${challenges.length})` },
            { key: 'rules', label: 'Luật Chơi' },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />

        <Button variant="secondary" size="sm" onClick={fetchActiveArena} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={13} /> Cập nhật
        </Button>
      </div>

      <TabTransition key={activeTab} minHeight={420}>
        {/* TAB: TEAM LEADERBOARD (preview) */}
        {activeTab === 'leaderboard' && (
          <Section
            title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={18} color="var(--accent, var(--accent))" /> BXH Đội Nhóm Mùa Giải</span>}
            description="Xếp hạng dựa trên Điểm Đội từ Sổ Cái Điểm Số (Score Ledger)"
            actions={
              season?.id && (
                <Link
                  to={`/leaderboard?scope=teams&period=season&seasonId=${season.id}`}
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
            {leaderboard.length === 0 ? (
              <EmptyState title="Chưa có điểm thi đấu" description="Chưa có đội nào ghi nhận điểm số trong mùa giải này." />
            ) : (
              <FlipList resetKey={`arena-teams:${season?.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {teamPreview.map((team) => {
                  const isTop1 = team.rank === 1;
                  const isMyTeam = myTeam && Number(team.teamId) === Number(myTeam.teamId);
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
                            width: 30,
                            height: 30,
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

                        <div
                          style={{
                            width: 36,
                            height: 36,
                            background: team.color || 'var(--accent)',
                            color: 'var(--surface)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: 13,
                            flexShrink: 0,
                          }}
                        >
                          {team.teamName?.slice(0, 2).toUpperCase()}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.teamName}</span>
                            {isMyTeam && (
                              <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', background: 'var(--primary)', color: 'var(--surface)', textTransform: 'uppercase' }}>
                                Đội của bạn
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
                            {team.isEligible ? 'Đủ điều kiện tranh giải' : 'Tạm dừng xếp hạng'}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                          <AnimatedNumber value={team.score || 0} duration={700} /> <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'inherit', fontWeight: 400 }}>XP</span>
                        </div>
                        <div style={{ fontSize: 11, color: isTop1 ? 'var(--success)' : 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>
                          {isTop1 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--success)' }}>
                              <Crown size={11} color="var(--success)" /> Dẫn đầu
                            </span>
                          ) : (
                            `Cách top 1: ${(leaderboard[0].score - team.score).toLocaleString()} XP`
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

        {/* TAB: INDIVIDUAL LEADERBOARD (preview) */}
        {activeTab === 'individual' && (
          <Section
            title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Users size={18} color="var(--accent)" /> BXH Cá Nhân Mùa Giải</span>}
            description="Điểm cá nhân được tính độc lập theo Mùa Giải hiện tại"
            actions={
              season?.id && (
                <Link
                  to={`/leaderboard?scope=members&period=season&seasonId=${season.id}`}
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
                return <EmptyState title="Chưa có điểm cá nhân" description="Chưa có dữ liệu cá nhân trong mùa giải này." />;
              }

              return (
                <FlipList resetKey={`arena-ind:${season?.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filtered.map((emp) => {
                    const isTop1 = emp.rank === 1;
                    const isMe = user && (Number(emp.userId) === Number(user.id) || Number(emp.id) === Number(user.id));
                    return (
                      <div
                        key={emp.userId || emp.id}
                        data-flip-id={emp.userId || emp.id}
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
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.userName || emp.name}</span>
                              {isMe && (
                                <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', background: 'var(--primary)', color: 'var(--surface)', textTransform: 'uppercase' }}>
                                  Bạn
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
                              Đội: <strong style={{ color: 'var(--text-secondary)' }}>{emp.teamName || 'Chưa gán đội'}</strong> {emp.eventsCount ? `• ${emp.eventsCount} sự kiện` : ''}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent, var(--accent))', fontFamily: "'JetBrains Mono', monospace" }}>
                            <AnimatedNumber value={emp.points ?? emp.score ?? 0} duration={700} /> <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>XP</span>
                          </div>
                          {emp.trend && (
                            <div style={{ fontSize: 11, color: emp.trend === 'UP' ? 'var(--success)' : emp.trend === 'DOWN' ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>
                              {emp.trend === 'UP' ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <ArrowUp size={11} strokeWidth={2.5} /> Tăng
                                </span>
                              ) : emp.trend === 'DOWN' ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <ArrowDown size={11} strokeWidth={2.5} /> Giảm
                                </span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <Minus size={11} /> Ổn định
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </FlipList>
              );
            })()}
          </Section>
        )}

        {/* TAB: CHALLENGES */}
        {activeTab === 'challenges' && (
          <div>
            {challenges.length === 0 ? (
              <Section>
                <EmptyState title="Chưa có thử thách nào" description="Mùa giải này chưa mở thử thách đặc biệt. Hãy theo dõi các thông báo mới!" />
              </Section>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
                {challenges.map((ch) => {
                  const isCompleted = ch.status === 'COMPLETED';
                  return (
                    <Card
                      key={ch.id}
                      style={{
                        padding: 20,
                        background: 'var(--surface)',
                        border: isCompleted ? '1px solid rgba(21, 128, 61, 0.3)' : '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '3px 8px',
                            background: isCompleted ? 'rgba(21, 128, 61, 0.1)' : 'rgba(180, 83, 9, 0.1)',
                            color: isCompleted ? 'var(--success)' : 'var(--accent)',
                            textTransform: 'uppercase',
                          }}
                        >
                          {ch.type} • {ch.status}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                          Mục tiêu: {ch.targetValue}
                        </span>
                      </div>

                      <h3 style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>{ch.title}</h3>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px 0', lineHeight: 1.55, fontWeight: 400 }}>{ch.description}</p>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                        <span>Trạng thái</span>
                        <span style={{ fontWeight: 600, color: isCompleted ? 'var(--success)' : 'var(--text-primary)' }}>
                          {isCompleted ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={13} color="var(--success)" /> Hoàn thành
                            </span>
                          ) : (
                            'Đang mở'
                          )}
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: RULES */}
        {activeTab === 'rules' && (
          <Section
            title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BookOpen size={18} color="var(--accent, var(--accent))" /> Luật Mùa Giải Đang Áp Dụng</span>}
          >
            <div style={{ marginBottom: 16, padding: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Bộ luật: {seasonRules?.ruleSetName || season.ruleSet?.name || 'YouTube Production Championship Rules'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>
                Phiên bản: <strong style={{ color: 'var(--text-secondary)' }}>#{seasonRules?.versionNumber || season.activeRuleVersion?.versionNumber || '1.0'}</strong> — Bất biến trong suốt thời gian diễn ra giải đấu
              </div>
            </div>

            {seasonRules?.rules && seasonRules.rules.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {seasonRules.rules.map((r, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 14,
                      borderLeft: `3px solid ${r.effectType === 'TEAM_SCORE' ? 'var(--accent)' : 'var(--success)'}`,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderLeftWidth: 3,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{idx + 1}. {r.name}</strong>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', background: r.effectType === 'TEAM_SCORE' ? 'rgba(180, 83, 9, 0.1)' : 'rgba(21, 128, 61, 0.1)', color: r.effectType === 'TEAM_SCORE' ? 'var(--accent)' : 'var(--success)' }}>
                        {r.effectType === 'TEAM_SCORE' ? 'Điểm Đội' : 'Điểm Cá Nhân'}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 400, lineHeight: 1.55 }}>
                      {r.humanSummary}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <div style={{ padding: 14, borderLeft: '3px solid var(--success)', background: 'var(--surface)', border: '1px solid var(--border)', borderLeftWidth: 3 }}>
                  <strong>1. Video Hợp Lệ:</strong> Mỗi video được duyệt (APPROVED) sẽ cộng <strong>+100 XP</strong> cho cá nhân và đóng góp điểm vào Team.
                </div>
                <div style={{ padding: 14, borderLeft: '3px solid var(--accent)', background: 'var(--surface)', border: '1px solid var(--border)', borderLeftWidth: 3 }}>
                  <strong>2. Thưởng Chuỗi (Streak Bonus):</strong> Hoàn thành liên tiếp 3 video đạt chuẩn nhận thêm <strong>+150 XP</strong> mốc.
                </div>
                <div style={{ padding: 14, borderLeft: '3px solid var(--accent)', background: 'var(--surface)', border: '1px solid var(--border)', borderLeftWidth: 3 }}>
                  <strong>3. Hệ Số Cuối Tuần (Weekend Multiplier):</strong> Video hoàn thành trong Thứ 7 & Chủ Nhật tự động được nhân <strong>x2 XP</strong>.
                </div>
              </div>
            )}
          </Section>
        )}
      </TabTransition>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, padding: '12px 0' }}>
        <Link to="/youtube" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}><Tv size={15} /> Số liệu YouTube <ExternalLink size={13} /></Link>
        <Link to="/leaderboard?scope=youtube" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>BXH YouTube <ExternalLink size={13} /></Link>
      </div>
    </PageShell>
  );
}
