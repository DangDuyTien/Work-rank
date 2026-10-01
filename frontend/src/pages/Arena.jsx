import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Flame, Clock, Users, BookOpen, RefreshCw, CheckCircle2, Tv, ExternalLink, Crown, Sparkles, ArrowUp, ArrowDown, Minus, Search, Swords, Target, Zap } from 'lucide-react';
import { competition, youtube } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PageShell, PageHeader, Section, Card, EmptyState, PageState, Button, SegmentedControl, TabTransition, Notice, StatCard, PageTransitionSkeleton } from '../components/ui';


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
  SCHEDULED: { label: 'Sắp diễn ra', bg: 'rgba(180,83,9,0.15)', color: '#b45309', border: 'rgba(180,83,9,0.3)' },
  CALCULATING: { label: 'Đang kết toán', bg: 'rgba(168,85,247,0.15)', color: '#9333ea', border: 'rgba(168,85,247,0.3)' },
  FINISHED: { label: 'Đã hoàn thành', bg: 'rgba(100,116,139,0.12)', color: '#475569', border: 'rgba(100,116,139,0.25)' },
  DRAFT: { label: 'Bản nháp', bg: 'rgba(148,163,184,0.1)', color: '#64748b', border: 'rgba(148,163,184,0.2)' },
};

export default function Arena() {
  const { user, socket } = useAuth();
  const [season, setSeason] = useState(null);
  const [myTeam, setMyTeam] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [individualLeaderboard, setIndividualLeaderboard] = useState([]);
  const [individualChampion, setIndividualChampion] = useState(null);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [challenges, setChallenges] = useState([]);
  const [seasonRules, setSeasonRules] = useState(null);
  const [youtubeLeaderboard, setYoutubeLeaderboard] = useState([]);
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchActiveArena = useCallback(async () => {
    try {
      setError(null);
      const active = await competition.getActiveSeason();
      if (!active) {
        setSeason(null);
        setLoading(false);
        return;
      }

      const [detailRes, lbRes, indRes, chRes, rulesRes, ytRes] = await Promise.all([
        competition.getSeasonDetail(active.id),
        competition.getSeasonLeaderboard(active.id),
        competition.getSeasonIndividualLeaderboard(active.id).catch(() => ({ rankings: [], individualChampion: null })),
        competition.getSeasonChallenges(active.id),
        competition.getSeasonRules(active.id).catch(() => null),
        youtube.getLeaderboard({ sortBy: 'views', limit: 20 }).catch(() => ({ items: [] })),
      ]);

      setSeason(detailRes.season || active);
      setMyTeam(detailRes.myTeam || null);
      setLeaderboard(lbRes.rankings || []);
      setIndividualLeaderboard(indRes.rankings || []);
      setIndividualChampion(indRes.individualChampion || (indRes.rankings?.[0] || null));
      setChallenges(chRes || []);
      setSeasonRules(rulesRes);
      setYoutubeLeaderboard(ytRes.items || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tải dữ liệu Đấu Trường Arena');
    } finally {
      setLoading(false);
    }
  }, []);


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
          background: '#141414',
          color: '#ffffff',
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
                  color: '#ffffff',
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
              <Flame size={24} color="var(--accent, #b45309)" /> {season.name}
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
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent, #b45309)', transition: 'width 0.4s ease' }} />
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
                  background: 'var(--accent, #b45309)',
                  color: '#ffffff',
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
                <div style={{ fontSize: 12, color: 'var(--accent, #b45309)', fontWeight: 600, marginTop: 2 }}>
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
      <div className="arena-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        <StatCard icon={Users} label="Đội thi đấu" value={leaderboard.length} color="#b45309" />
        <StatCard icon={Swords} label="Cá nhân tranh tài" value={individualLeaderboard.length} color="#141414" />
        <StatCard icon={Target} label="Thử thách đang mở" value={activeChallenges} detail={completedChallenges > 0 ? `${completedChallenges} đã hoàn thành` : undefined} color="#b45309" />
        <StatCard icon={Tv} label="Kênh YouTube" value={youtubeLeaderboard.length} color="#b91c1c" />
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <SegmentedControl
          ariaLabel="Arena Tabs"
          options={[
            { key: 'leaderboard', label: `BXH Đội (${leaderboard.length})` },
            { key: 'individual', label: `BXH Cá Nhân (${individualLeaderboard.length})` },
            { key: 'youtube', label: `YouTube (${youtubeLeaderboard.length})` },
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
            title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={18} color="var(--accent, #b45309)" /> BXH Đội Nhóm Mùa Giải</span>}
            description="Xếp hạng dựa trên Điểm Đội từ Sổ Cái Điểm Số (Score Ledger)"
            actions={
              season?.id && (
                <Link
                  to={`/rankings?scope=season&seasonId=${season.id}&ranking=team`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '7px 14px',
                    background: '#141414',
                    color: '#ffffff',
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {leaderboard.map((team) => {
                  const isTop1 = team.rank === 1;
                  const isMyTeam = myTeam && Number(team.teamId) === Number(myTeam.teamId);
                  return (
                    <div
                      key={team.teamId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: isMyTeam ? 'rgba(0, 0, 0, 0.02)' : '#ffffff',
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
                            background: isTop1 ? '#b45309' : team.rank === 2 ? '#78716c' : team.rank === 3 ? '#a8a29e' : 'rgba(0, 0, 0, 0.06)',
                            color: team.rank <= 3 ? '#ffffff' : '#111111',
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
                            background: team.color || '#b45309',
                            color: '#fff',
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
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#111111', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.teamName}</span>
                            {isMyTeam && (
                              <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', background: '#141414', color: '#fff', textTransform: 'uppercase' }}>
                                Đội của bạn
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: '#777777', marginTop: 2, fontWeight: 500 }}>
                            {team.isEligible ? 'Đủ điều kiện tranh giải' : 'Tạm dừng xếp hạng'}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 17, fontWeight: 700, color: '#111111', fontFamily: "'JetBrains Mono', monospace" }}>
                          {(team.score || 0).toLocaleString()} <span style={{ fontSize: 11, color: '#777777', fontFamily: 'inherit', fontWeight: 400 }}>XP</span>
                        </div>
                        <div style={{ fontSize: 11, color: isTop1 ? '#15803d' : '#777777', fontWeight: 500, marginTop: 2 }}>
                          {isTop1 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#15803d' }}>
                              <Crown size={11} color="#15803d" /> Dẫn đầu
                            </span>
                          ) : (
                            `Cách top 1: ${(leaderboard[0].score - team.score).toLocaleString()} XP`
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {/* TAB: INDIVIDUAL LEADERBOARD (preview) */}
        {activeTab === 'individual' && (
          <Section
            title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Users size={18} color="#b45309" /> BXH Cá Nhân Mùa Giải</span>}
            description="Điểm cá nhân được tính độc lập theo Mùa Giải hiện tại"
            actions={
              season?.id && (
                <Link
                  to={`/rankings?scope=season&seasonId=${season.id}&ranking=individual`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '7px 14px',
                    background: '#141414',
                    color: '#ffffff',
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
            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 200px', display: 'flex', alignItems: 'center' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, color: '#777777', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Tìm nhân viên..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 32px',
                    border: '1px solid var(--border)',
                    fontSize: 13,
                    fontWeight: 400,
                    outline: 'none',
                    background: '#ffffff',
                  }}
                />
              </div>
              <select
                value={selectedTeamFilter}
                onChange={(e) => setSelectedTeamFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  fontSize: 13,
                  fontWeight: 500,
                  background: '#fff',
                }}
              >
                <option value="all">Tất cả đội</option>
                {leaderboard.map((t) => (
                  <option key={t.teamId} value={t.teamId}>{t.teamName}</option>
                ))}
              </select>
            </div>

            {(() => {
              const filtered = individualLeaderboard.filter((u) => {
                if (selectedTeamFilter !== 'all' && String(u.teamId) !== String(selectedTeamFilter)) return false;
                if (searchQuery.trim()) {
                  const q = searchQuery.toLowerCase();
                  const nameStr = u.userName || u.name || '';
                  const emailStr = u.userEmail || u.email || '';
                  return nameStr.toLowerCase().includes(q) || emailStr.toLowerCase().includes(q);
                }
                return true;
              });

              if (filtered.length === 0) {
                return <EmptyState title="Không tìm thấy nhân viên" description="Chưa có dữ liệu cá nhân phù hợp với bộ lọc hiện tại." />;
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filtered.map((emp) => {
                    const isTop1 = emp.rank === 1;
                    const isMe = user && (Number(emp.userId) === Number(user.id) || Number(emp.id) === Number(user.id));
                    return (
                      <div
                        key={emp.userId || emp.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          background: isMe ? 'rgba(0, 0, 0, 0.02)' : '#ffffff',
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
                              background: isTop1 ? '#b45309' : emp.rank === 2 ? '#78716c' : emp.rank === 3 ? '#a8a29e' : 'rgba(0, 0, 0, 0.06)',
                              color: emp.rank <= 3 ? '#ffffff' : '#111111',
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
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#111111', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.userName || emp.name}</span>
                              {isMe && (
                                <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', background: '#141414', color: '#fff', textTransform: 'uppercase' }}>
                                  Bạn
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: '#777777', marginTop: 2, fontWeight: 500 }}>
                              Đội: <strong style={{ color: '#555555' }}>{emp.teamName || 'Chưa gán đội'}</strong> {emp.eventsCount ? `• ${emp.eventsCount} sự kiện` : ''}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent, #b45309)', fontFamily: "'JetBrains Mono', monospace" }}>
                            {(emp.points ?? emp.score ?? 0).toLocaleString()} <span style={{ fontSize: 11, color: '#777777', fontWeight: 400 }}>XP</span>
                          </div>
                          {emp.trend && (
                            <div style={{ fontSize: 11, color: emp.trend === 'UP' ? '#15803d' : emp.trend === 'DOWN' ? '#b91c1c' : '#777777', fontWeight: 500, marginTop: 2 }}>
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
                </div>
              );
            })()}
          </Section>
        )}

        {/* TAB: YOUTUBE PREVIEW */}
        {activeTab === 'youtube' && (
          <Section
            title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Tv size={18} color="#b91c1c" /> BXH YouTube Teams</span>}
            description="Xếp hạng sản lượng thực tế (Views, Subscribers, Growth) từ các kênh YouTube"
            actions={
              <Link
                to="/leaderboard"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '7px 14px',
                  background: '#141414',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Xem toàn bộ BXH <ExternalLink size={12} />
              </Link>
            }
          >
            <Notice type="info" icon={Zap}>
              <strong>Tách biệt hệ thống:</strong> YouTube Views & Subscribers phản ánh thành tích kinh doanh. Điểm XP Mùa Giải chỉ được cộng thông qua Luật Mùa Giải (Rule Engine).
            </Notice>

            <div style={{ marginTop: 16 }}>
              {youtubeLeaderboard.length === 0 ? (
                <EmptyState title="Chưa có dữ liệu YouTube" description="Chưa có kênh YouTube nào được liên kết và đồng bộ số liệu." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {youtubeLeaderboard.map((team, idx) => {
                    const isPodium = idx < 3;
                    const isMyTeam = myTeam && Number(team.teamId) === Number(myTeam.teamId);
                    return (
                      <div
                        key={team.teamId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          border: isMyTeam ? '1.5px solid rgba(185, 28, 28, 0.35)' : '1px solid var(--border)',
                          background: '#ffffff',
                          gap: 12,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              background: idx === 0 ? '#b45309' : idx === 1 ? '#78716c' : idx === 2 ? '#a8a29e' : 'rgba(0, 0, 0, 0.06)',
                              color: idx < 3 ? '#ffffff' : '#111111',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: 13,
                              flexShrink: 0,
                            }}
                          >
                            #{idx + 1}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.teamName}</span>
                              {isMyTeam && (
                                <span style={{ padding: '2px 6px', background: 'rgba(185, 28, 28, 0.1)', color: '#b91c1c', fontSize: 9, fontWeight: 600, textTransform: 'uppercase' }}>
                                  Đội của bạn
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: '#777777', marginTop: 2, fontWeight: 400 }}>
                              {team.channelsCount} kênh
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#b91c1c', fontFamily: "'JetBrains Mono', monospace" }}>
                            {(team.totalViews || 0).toLocaleString()} <span style={{ fontSize: 11, color: '#777777', fontWeight: 400 }}>views</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#15803d', fontWeight: 500, marginTop: 2 }}>
                            {(team.totalSubscribers || 0).toLocaleString()} subs • +{team.viewsGrowth30dPct || 0}% 30D
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
                        background: '#ffffff',
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
                            color: isCompleted ? '#15803d' : '#b45309',
                            textTransform: 'uppercase',
                          }}
                        >
                          {ch.type} • {ch.status}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#b45309' }}>
                          Mục tiêu: {ch.targetValue}
                        </span>
                      </div>

                      <h3 style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, color: '#111111', margin: '0 0 6px 0' }}>{ch.title}</h3>
                      <p style={{ fontSize: 12, color: '#777777', margin: '0 0 14px 0', lineHeight: 1.55, fontWeight: 400 }}>{ch.description}</p>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#555555', fontWeight: 500 }}>
                        <span>Trạng thái</span>
                        <span style={{ fontWeight: 600, color: isCompleted ? '#15803d' : '#111111' }}>
                          {isCompleted ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={13} color="#15803d" /> Hoàn thành
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
            title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BookOpen size={18} color="var(--accent, #b45309)" /> Luật Mùa Giải Đang Áp Dụng</span>}
          >
            <div style={{ marginBottom: 16, padding: 14, background: '#ffffff', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111111' }}>
                Bộ luật: {seasonRules?.ruleSetName || season.ruleSet?.name || 'YouTube Production Championship Rules'}
              </div>
              <div style={{ fontSize: 12, color: '#777777', marginTop: 4, fontWeight: 500 }}>
                Phiên bản: <strong style={{ color: '#555555' }}>#{seasonRules?.versionNumber || season.activeRuleVersion?.versionNumber || '1.0'}</strong> — Bất biến trong suốt thời gian diễn ra giải đấu
              </div>
            </div>

            {seasonRules?.rules && seasonRules.rules.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
                {seasonRules.rules.map((r, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 14,
                      borderLeft: `3px solid ${r.effectType === 'TEAM_SCORE' ? '#b45309' : '#15803d'}`,
                      background: '#ffffff',
                      border: '1px solid var(--border)',
                      borderLeftWidth: 3,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong style={{ color: '#111111', fontWeight: 600 }}>{idx + 1}. {r.name}</strong>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', background: r.effectType === 'TEAM_SCORE' ? 'rgba(180, 83, 9, 0.1)' : 'rgba(21, 128, 61, 0.1)', color: r.effectType === 'TEAM_SCORE' ? '#b45309' : '#15803d' }}>
                        {r.effectType === 'TEAM_SCORE' ? 'Điểm Đội' : 'Điểm Cá Nhân'}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#555555', fontWeight: 400, lineHeight: 1.55 }}>
                      {r.humanSummary}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
                <div style={{ padding: 14, borderLeft: '3px solid #15803d', background: '#ffffff', border: '1px solid var(--border)', borderLeftWidth: 3 }}>
                  <strong>1. Video Hợp Lệ:</strong> Mỗi video được duyệt (APPROVED) sẽ cộng <strong>+100 XP</strong> cho cá nhân và đóng góp điểm vào Team.
                </div>
                <div style={{ padding: 14, borderLeft: '3px solid #b45309', background: '#ffffff', border: '1px solid var(--border)', borderLeftWidth: 3 }}>
                  <strong>2. Thưởng Chuỗi (Streak Bonus):</strong> Hoàn thành liên tiếp 3 video đạt chuẩn nhận thêm <strong>+150 XP</strong> mốc.
                </div>
                <div style={{ padding: 14, borderLeft: '3px solid #b45309', background: '#ffffff', border: '1px solid var(--border)', borderLeftWidth: 3 }}>
                  <strong>3. Hệ Số Cuối Tuần (Weekend Multiplier):</strong> Video hoàn thành trong Thứ 7 & Chủ Nhật tự động được nhân <strong>x2 XP</strong>.
                </div>
              </div>
            )}
          </Section>
        )}
      </TabTransition>
    </PageShell>
  );
}
