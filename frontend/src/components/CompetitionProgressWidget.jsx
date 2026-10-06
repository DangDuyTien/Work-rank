import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame,
  Target,
  Trophy,
  Users,
  TrendingUp,
  ArrowUpRight,
  Sparkles,
  RefreshCw,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { competition } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Card, Button, AnimatedNumber } from './ui';
import { getCached, fetchWithCache, CACHE_KEYS, CACHE_TTL, isDeepEqual } from '../services/cache';

export default function CompetitionProgressWidget() {
  const navigate = useNavigate();
  const { user, socket } = useAuth();
  const cachedDashboard = getCached(CACHE_KEYS.COMPETITION_DASHBOARD(user?.id, user?.teamId));
  const [data, setData] = useState(() => cachedDashboard || null);
  const [loading, setLoading] = useState(!cachedDashboard);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground && !cachedDashboard) setLoading(true);
      else setRefreshing(true);
      setError(null);
      const res = await fetchWithCache(CACHE_KEYS.COMPETITION_DASHBOARD(user?.id, user?.teamId), () => competition.getDashboard(), {
        ttl: CACHE_TTL.SHORT,
        force: isBackground,
      });
      setData((prev) => (isDeepEqual(prev, res) ? prev : res));
    } catch (err) {
      console.warn('[CompetitionWidget] Error loading dashboard:', err.message);
      setError('Chưa thể tải dữ liệu thi đua tổng quan');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cachedDashboard, user?.id, user?.teamId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Realtime Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleDashboardUpdated = (payload) => {
      if (
        !payload.userId ||
        Number(payload.userId) === Number(user?.id) ||
        (payload.teamId && Number(payload.teamId) === Number(user?.teamId))
      ) {
        fetchDashboard(true);
      }
    };

    const handleActivityCreated = (payload) => {
      setData((prev) => {
        if (!prev) return prev;
        const newAct = payload.activity;
        if (!newAct) return prev;
        const acts = [newAct, ...(prev.recentActivities || []).filter((a) => a.id !== newAct.id)].slice(0, 10);
        return { ...prev, recentActivities: acts };
      });
    };

    socket.on('competition:dashboard_updated', handleDashboardUpdated);
    socket.on('competition:activity_created', handleActivityCreated);
    const handleScoreAwarded = () => fetchDashboard(true);
    socket.on('competition:score_awarded', handleScoreAwarded);

    return () => {
      socket.off('competition:dashboard_updated', handleDashboardUpdated);
      socket.off('competition:activity_created', handleActivityCreated);
      socket.off('competition:score_awarded', handleScoreAwarded);
    };
  }, [socket, user?.id, user?.teamId, fetchDashboard]);

  if (loading && !data) {
    return (
      <Card style={{ padding: 18, marginBottom: 20, background: 'var(--surface)', border: '1px solid rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <RefreshCw size={16} className="spin" color="var(--accent)" />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Đang tải bảng tổng quan thi đấu...</span>
        </div>
      </Card>
    );
  }

  if (error && !data) {
    return (
      <Card style={{ padding: 18, marginBottom: 20, background: 'var(--surface)', border: '1px solid rgba(185,28,28,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}>
            <ShieldAlert size={18} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{error}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => fetchDashboard()}>
            Thử lại
          </Button>
        </div>
      </Card>
    );
  }

  const uSum = data?.userSummary;
  const tSum = data?.teamSummary;
  const activeSeason = data?.activeSeason;
  const grand = data?.grandChampionship;
  const activities = data?.recentActivities || [];

  return (
    <div style={{ marginBottom: 24 }}>
      {/* ── SECTION HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--surface)' }}>
            <Trophy size={15} />
          </div>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.25, color: 'var(--text-primary)', margin: 0 }}>
              Company Competition Overview
            </h2>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Read Model Projection • Cập nhật tức thì
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button variant="outline" size="sm" onClick={() => navigate('/leaderboard?scope=members&period=season')} style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-primary)', border: '1px solid rgba(0,0,0,0.12)' }}>
            <Trophy size={13} color="var(--accent)" /> Trung Tâm BXH <ArrowUpRight size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/arena')} style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}>
            Đấu trường Season <ArrowUpRight size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/grand')} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontWeight: 600 }}>
            Grand Championship <ArrowUpRight size={14} />
          </Button>
        </div>
      </div>

      {/* ── 4 SUMMARY STAT CARDS (UNIFIED NEUTRAL WITH GOLD HIGHLIGHTS) ── */}
      <div className="competition-overview-grid">
        {/* 1. MY SEASON SCORE */}
        <Card
          className="motion-hover-lift"
          onClick={() => navigate('/leaderboard?scope=members&period=season')}
          title="Bấm để xem Bảng Xếp Hạng Cá Nhân"
          style={{
            padding: 16,
            background: 'var(--surface)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 10,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
              Cá Nhân (Season) <ArrowUpRight size={11} color="var(--text-muted)" />
            </span>
            <div style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(180,83,9,0.08)', color: 'var(--accent)', fontSize: 11, fontWeight: 600 }}>
              {uSum?.currentSeasonRank ? `Hạng #${uSum.currentSeasonRank}` : 'Chưa xếp hạng'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
              <AnimatedNumber value={uSum?.currentSeasonScore || 0} />
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>XP</span>
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
            <span>Streak: <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{uSum?.currentStreak || 0} ngày</strong></span>
            {uSum?.recentScoreDelta ? (
              <span style={{ color: uSum.recentScoreDelta > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                {uSum.recentScoreDelta > 0 ? `+${uSum.recentScoreDelta}` : uSum.recentScoreDelta} gần nhất
              </span>
            ) : null}
          </div>
        </Card>

        {/* 2. MY TEAM SEASON */}
        <Card
          className="motion-hover-lift"
          onClick={() => navigate('/leaderboard?scope=teams&period=season')}
          title="Bấm để xem Bảng Xếp Hạng Đội"
          style={{
            padding: 16,
            background: 'var(--surface)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 10,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
              Đội Nhóm (Team) <ArrowUpRight size={11} color="var(--text-muted)" />
            </span>
            <div style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(0,0,0,0.06)', color: 'var(--text-primary)', fontSize: 11, fontWeight: 600 }}>
              {tSum?.currentSeasonRank ? `Hạng #${tSum.currentSeasonRank}` : 'Chưa xếp hạng'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
              <AnimatedNumber value={tSum?.currentSeasonScore || 0} />
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>XP</span>
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
            <span>Đội: <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{tSum?.teamName || data?.user?.team?.name || 'Chưa vào đội'}</strong></span>
            <span>{tSum?.membersCount || 1} thành viên</span>
          </div>
        </Card>

        {/* 3. GRAND CHAMPIONSHIP */}
        <Card
          className="motion-hover-lift"
          onClick={() => navigate('/leaderboard?scope=members&period=grand')}
          title="Bấm để xem Bảng Xếp Hạng Grand Championship"
          style={{
            padding: 16,
            background: 'var(--surface)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 10,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
              Grand Race {grand?.year || '2026'} <ArrowUpRight size={11} color="var(--accent)" />
            </span>
            <div style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(180,83,9,0.08)', color: 'var(--accent)', fontSize: 11, fontWeight: 600 }}>
              {uSum?.grandRank ? `Hạng #${uSum.grandRank}` : (tSum?.grandRank ? `Hạng #${tSum.grandRank}` : '—')}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
              <AnimatedNumber value={uSum?.grandPoints ?? tSum?.grandPoints ?? 0} />
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>GP</span>
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
            <span>Vô địch mùa: <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{uSum?.seasonWins || tSum?.seasonWins || 0}</strong></span>
            <span>Podiums: <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{uSum?.podiumCount || tSum?.podiumCount || 0}</strong></span>
          </div>
        </Card>

        {/* 4. WEEKLY PROGRESS */}
        <Card style={{ padding: 16, background: 'var(--surface)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Tiến Độ Tuần Này
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              {uSum?.weeklyProgress || 0}%
            </span>
          </div>
          {/* Progress Bar */}
          <div style={{ height: 8, background: 'var(--background)', borderRadius: 4, overflow: 'hidden', margin: '10px 0 8px 0' }}>
            <div
              style={{
                width: `${Math.min(100, uSum?.weeklyProgress || 0)}%`,
                height: '100%',
                background: 'var(--primary)',
                borderRadius: 4,
                transition: 'width 0.5s ease',
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Mục tiêu: 500 XP</span>
            <span>{uSum?.currentSeasonScore || 0} / 500</span>
          </div>
        </Card>
      </div>

      {/* ── RECENT COMPETITION ACTIVITIES FEED ── */}
      {activities.length > 0 && (
        <Card style={{ padding: '14px 18px', background: 'var(--surface)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              <Clock size={14} color="var(--text-muted)" />
              <span>Hoạt động thi đua gần nhất</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Realtime projection feed</span>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {activities.slice(0, 5).map((act, idx) => (
              <div
                key={act.id || idx}
                style={{
                  minWidth: 200,
                  maxWidth: 240,
                  padding: '8px 12px',
                  background: 'var(--background)',
                  borderRadius: 6,
                  border: '1px solid rgba(0,0,0,0.06)',
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {act.title}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  {new Date(act.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {act.type}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
