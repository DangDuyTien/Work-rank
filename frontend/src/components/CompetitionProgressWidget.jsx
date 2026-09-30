import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame,
  Target,
  Trophy,
  Users,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Sparkles,
  RefreshCw,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { competition } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Card, PageState, Button } from './ui';

export default function CompetitionProgressWidget() {
  const navigate = useNavigate();
  const { user, socket } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      else setRefreshing(true);
      setError(null);
      const res = await competition.getDashboard();
      setData(res);
    } catch (err) {
      console.warn('[CompetitionWidget] Error loading dashboard:', err.message);
      setError('Chưa thể tải dữ liệu thi đua tổng quan');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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
    socket.on('competition:score_awarded', () => fetchDashboard(true));

    return () => {
      socket.off('competition:dashboard_updated', handleDashboardUpdated);
      socket.off('competition:activity_created', handleActivityCreated);
      socket.off('competition:score_awarded');
    };
  }, [socket, user?.id, user?.teamId, fetchDashboard]);

  if (loading && !data) {
    return (
      <Card style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <RefreshCw size={16} className="spin" color="#0284c7" />
          <span style={{ fontSize: 13, color: '#64748b' }}>Đang tải bảng tổng quan thi đấu...</span>
        </div>
      </Card>
    );
  }

  if (error && !data) {
    return (
      <Card style={{ padding: 18, marginBottom: 20, border: '1px solid rgba(239,68,68,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626' }}>
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
      {/* SECTION HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #0284c7, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Trophy size={16} />
          </div>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Company Competition Overview
            </h2>
            <span style={{ fontSize: 11, color: '#64748b' }}>
              Read Model Projection • Cập nhật tức thì
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button variant="outline" size="sm" onClick={() => navigate('/rankings')} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: '#0284c7' }}>
            <Trophy size={13} color="#0284c7" /> Trung Tâm BXH <ArrowUpRight size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/arena')} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            Đấu trường Season <ArrowUpRight size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/grand')} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, color: '#ea580c' }}>
            Grand Championship <ArrowUpRight size={14} />
          </Button>
        </div>
      </div>

      {/* 4 SUMMARY STAT CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }}>
        {/* 1. MY SEASON SCORE */}
        <Card
          onClick={() => navigate('/rankings?scope=individual')}
          title="Bấm để xem Bảng Xếp Hạng Cá Nhân"
          style={{
            padding: 16,
            background: 'linear-gradient(135deg, rgba(2,132,199,0.05), rgba(99,102,241,0.03))',
            border: '1px solid rgba(2,132,199,0.18)',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
              Cá Nhân (Season) <ArrowUpRight size={11} color="#0284c7" />
            </span>
            <div style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(2,132,199,0.12)', color: '#0284c7', fontSize: 11, fontWeight: 800 }}>
              {uSum?.currentSeasonRank ? `Hạng #${uSum.currentSeasonRank}` : 'Chưa xếp hạng'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: '#0f172a' }}>
              {uSum?.currentSeasonScore?.toLocaleString() || 0}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>XP</span>
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
            <span>Streak: <strong>{uSum?.currentStreak || 0} ngày</strong></span>
            {uSum?.recentScoreDelta ? (
              <span style={{ color: uSum.recentScoreDelta > 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                {uSum.recentScoreDelta > 0 ? `+${uSum.recentScoreDelta}` : uSum.recentScoreDelta} gần nhất
              </span>
            ) : null}
          </div>
        </Card>

        {/* 2. MY TEAM SEASON */}
        <Card
          onClick={() => navigate('/rankings?scope=team')}
          title="Bấm để xem Bảng Xếp Hạng Đội"
          style={{
            padding: 16,
            background: 'linear-gradient(135deg, rgba(16,185,129,0.05), rgba(5,150,105,0.03))',
            border: '1px solid rgba(16,185,129,0.18)',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
              Đội Nhóm (Team) <ArrowUpRight size={11} color="#059669" />
            </span>
            <div style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(16,185,129,0.12)', color: '#059669', fontSize: 11, fontWeight: 800 }}>
              {tSum?.currentSeasonRank ? `Hạng #${tSum.currentSeasonRank}` : 'Chưa xếp hạng'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: '#0f172a' }}>
              {tSum?.currentSeasonScore?.toLocaleString() || 0}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>XP</span>
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
            <span>Đội: <strong>{tSum?.teamName || data?.user?.team?.name || 'Chưa vào đội'}</strong></span>
            <span>{tSum?.membersCount || 1} thành viên</span>
          </div>
        </Card>

        {/* 3. GRAND CHAMPIONSHIP */}
        <Card
          onClick={() => navigate('/rankings?scope=grand')}
          title="Bấm để xem Bảng Xếp Hạng Grand Championship"
          style={{
            padding: 16,
            background: 'linear-gradient(135deg, rgba(249,115,22,0.05), rgba(234,88,12,0.03))',
            border: '1px solid rgba(249,115,22,0.18)',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
              Grand Race {grand?.year || '2026'} <ArrowUpRight size={11} color="#ea580c" />
            </span>
            <div style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(249,115,22,0.12)', color: '#ea580c', fontSize: 11, fontWeight: 800 }}>
              {uSum?.grandRank ? `Hạng #${uSum.grandRank}` : (tSum?.grandRank ? `Hạng #${tSum.grandRank}` : '—')}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: '#ea580c' }}>
              {(uSum?.grandPoints ?? tSum?.grandPoints ?? 0).toLocaleString()}
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#ea580c' }}>GP</span>
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
            <span>Vô địch mùa: <strong>{uSum?.seasonWins || tSum?.seasonWins || 0}</strong></span>
            <span>Podiums: <strong>{uSum?.podiumCount || tSum?.podiumCount || 0}</strong></span>
          </div>
        </Card>

        {/* 4. WEEKLY PROGRESS */}
        <Card style={{ padding: 16, background: '#fff', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Tiến Độ Tuần Này
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
              {uSum?.weeklyProgress || 0}%
            </span>
          </div>
          {/* Progress Bar */}
          <div style={{ height: 10, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden', margin: '10px 0 8px 0' }}>
            <div
              style={{
                width: `${Math.min(100, uSum?.weeklyProgress || 0)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #0284c7, #10b981)',
                borderRadius: 6,
                transition: 'width 0.5s ease',
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Mục tiêu tuần: 500 XP</span>
            <span>{uSum?.currentSeasonScore || 0} / 500</span>
          </div>
        </Card>
      </div>

      {/* RECENT COMPETITION ACTIVITIES FEED */}
      {activities.length > 0 && (
        <Card style={{ padding: '14px 18px', background: '#fafafa', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
              <Clock size={14} color="#64748b" />
              <span>Hoạt động thi đua gần nhất</span>
            </div>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Realtime projection feed</span>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {activities.slice(0, 5).map((act, idx) => (
              <div
                key={act.id || idx}
                style={{
                  minWidth: 200,
                  maxWidth: 240,
                  padding: '8px 12px',
                  background: '#fff',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {act.title}
                </div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
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
