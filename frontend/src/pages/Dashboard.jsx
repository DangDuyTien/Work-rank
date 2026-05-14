import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboard, leaderboard } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Keyboard as KeyIcon,
  Mouse as MouseIcon2,
  TrendingDown as TrendDown,
  TrendingUp as TrendUp,
  Users as UsersIcon,
} from 'lucide-react';

const STATUS_CONFIG = {
  active: { label: 'Đang hoạt động', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.4)', color: '#22c55e', dot: '#22c55e' },
  online: { label: 'Trực tuyến', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.4)', color: '#60a5fa', dot: '#60a5fa' },
  idle:   { label: 'Không hoạt động', bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.4)', color: '#eab308', dot: '#eab308' },
  offline:{ label: 'Ngoại tuyến', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)', color: '#64748b', dot: '#64748b' },
};

const RANGES = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'week', label: 'Tuần này' },
  { key: 'month', label: 'Tháng này' },
];

function formatNum(n) {
  n = Number(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toLocaleString();
}
function formatDuration(seconds) {
  seconds = Number(seconds) || 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function calcChange(current, previous) {
  if (!previous || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function localDateKey(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Dashboard() {
  const { socket } = useAuth();
  const [range, setRange] = useState('today');
  const [users, setUsers] = useState([]);
  const [totals, setTotals] = useState({ keystrokes: 0, clicks: 0, activeSeconds: 0, online: 0 });
  const [prevTotals, setPrevTotals] = useState(null);
  const [liveFlash, setLiveFlash] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const prevRef = useRef(null);
  const requestIdRef = useRef(0);

  const fetchData = async (selectedRange) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setUsers([]);
    setLoading(true);
    try {
      const [res, overviewRes] = await Promise.all([
        leaderboard.get(selectedRange),
        dashboard.overview(selectedRange),
      ]);
      if (requestId !== requestIdRef.current) return;
      setUsers(res.data || []);

      const overview = overviewRes.data || {};
      const newTotals = {
        keystrokes: Number(overview.totalKeystrokes || 0),
        clicks: Number(overview.totalMouseClicks || 0),
        activeSeconds: Number(overview.totalActiveSeconds || overview.totalActiveSecondsToday || 0),
        online: Number(overview.activeUsersNow || 0),
      };

      if (prevRef.current) {
        setPrevTotals(prevRef.current);
      }
      prevRef.current = newTotals;
      setTotals(newTotals);
    } catch (err) {
      if (requestId === requestIdRef.current) console.error('Failed to fetch dashboard data:', err);
    }
    if (requestId === requestIdRef.current) setLoading(false);
  };

  // Fetch initial leaderboard data
  useEffect(() => {
    fetchData(range);
  }, [range]);

  // Setup real-time socket listeners
  useEffect(() => {
    if (!socket) return;
    let flashTimer = null;

    const eventBelongsToRange = (data = {}) => {
      if (range !== 'today') return true;
      return !data.statDate || data.statDate === localDateKey();
    };

    const handleActivity = (data) => {
      if (!eventBelongsToRange(data)) return;
      setLiveFlash(true);
      if (flashTimer) window.clearTimeout(flashTimer);
      flashTimer = window.setTimeout(() => setLiveFlash(false), 600);
      const delta = data.delta || {};
      setTotals(prev => ({
        ...prev,
        keystrokes: prev.keystrokes + Number(delta.keystrokeCount ?? data.keystrokes ?? 0),
        clicks: prev.clicks + Number(delta.mouseClickCount ?? data.clicks ?? 0),
        activeSeconds: prev.activeSeconds + Number(delta.activeSeconds ?? 0),
      }));
      setUsers(prev => {
        const userId = String(data.userId || data.user_id);
        const totals = data.totals || null;
        const delta = data.delta || {};
        const deltaKeys = Number(delta.keystrokeCount ?? data.keystrokes ?? 0);
        const deltaClicks = Number(delta.mouseClickCount ?? data.clicks ?? 0);
        const deltaActiveSeconds = Number(delta.activeSeconds ?? data.activeSeconds ?? 0);
        const status = data.presence || data.status || 'active';
        const idx = prev.findIndex(u => String(u.user_id || u.id) === userId);
        if (idx >= 0) {
          const next = [...prev];
          const existing = next[idx];
          next[idx] = { 
            ...existing,
            ...data,
            name: data.name || existing.name,
            keystrokeCount: totals ? Number(totals.keystrokeCount || 0) : (Number(existing.keystrokeCount) || 0) + deltaKeys,
            mouseClickCount: totals ? Number(totals.mouseClickCount || 0) : (Number(existing.mouseClickCount) || 0) + deltaClicks,
            activeSeconds: totals ? Number(totals.activeSeconds || 0) : (Number(existing.activeSeconds) || 0) + deltaActiveSeconds,
            score: totals ? Number(totals.focusScore || data.score || 0) : (Number(existing.score) || 0) + (deltaKeys + deltaClicks) * 0.1,
            status
          };
          return next;
        }
        return [...prev, { 
          ...data, 
          user_id: userId, 
          status,
          name: data.name || `User #${userId}`,
          keystrokeCount: totals ? Number(totals.keystrokeCount || 0) : deltaKeys,
          mouseClickCount: totals ? Number(totals.mouseClickCount || 0) : deltaClicks,
          activeSeconds: totals ? Number(totals.activeSeconds || 0) : deltaActiveSeconds,
          score: totals ? Number(totals.focusScore || data.score || 0) : (deltaKeys + deltaClicks) * 0.1
        }];
      });
    };

    const handleOverview = (overview = {}) => {
      if (range !== 'today') return;
      setTotals({
        keystrokes: Number(overview.totalKeystrokes || 0),
        clicks: Number(overview.totalMouseClicks || 0),
        activeSeconds: Number(overview.totalActiveSeconds || overview.totalActiveSecondsToday || 0),
        online: Number(overview.activeUsersNow || 0),
      });
    };

    const handleStatus = (data) => {
      setUsers(prev => {
        const userId = String(data.userId || data.user_id);
        const idx = prev.findIndex(u => String(u.user_id || u.id) === userId);
        if (idx >= 0) {
          const next = [...prev];
          const nextStatus = data.presence || data.presenceStatus || data.status || 'online';
          next[idx] = {
            ...next[idx],
            status: nextStatus,
            presence: nextStatus,
            presenceStatus: nextStatus,
          };
          return next;
        }
        return prev;
      });
    };

    socket.on('activity:user:update', handleActivity);
    socket.on('user:status:update', handleStatus);
    socket.on('dashboard:overview:update', handleOverview);

    return () => {
      if (flashTimer) window.clearTimeout(flashTimer);
      socket.off('activity:user:update', handleActivity);
      socket.off('user:status:update', handleStatus);
      socket.off('dashboard:overview:update', handleOverview);
    };
  }, [socket, range]);

  const rangeLabel = 'lần cập nhật trước';

  const buildSub = (current, prev) => {
    const pct = calcChange(current, prev);
    if (pct === null) return { text: '— chưa có dữ liệu so sánh', color: '#64748b', icon: null };
    if (pct === 0) return { text: `— ổn định so với ${rangeLabel}`, color: '#64748b', icon: null };
    if (pct > 0) return { text: `+${pct}% so với ${rangeLabel}`, color: '#22c55e', icon: 'up' };
    return { text: `${pct}% so với ${rangeLabel}`, color: '#ef4444', icon: 'down' };
  };

  const onlineSub  = buildSub(totals.online, prevTotals?.online);
  const keysSub    = buildSub(totals.keystrokes, prevTotals?.keystrokes);
  const clicksSub  = buildSub(totals.clicks, prevTotals?.clicks);

  const STAT_CARDS = [
    { label: 'Người dùng đang online', value: totals.online.toLocaleString(), sub: onlineSub, icon: UsersIcon },
    { label: 'Tổng số lần gõ phím',    value: formatNum(totals.keystrokes),   sub: keysSub,  icon: KeyIcon },
    { label: 'Tổng số lần click',      value: formatNum(totals.clicks),       sub: clicksSub,icon: MouseIcon2 },
  ];

  return (
    <div>
      <div className="dashboard-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>Tổng Quan</h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: '3px 0 0', fontWeight: 500 }}>
            Hoạt động thời gian thực của toàn bộ nhóm
          </p>
          <p style={{ fontSize: 11, color: '#94a3b8', margin: '3px 0 0', fontWeight: 600 }}>
            Số liệu hoạt động lấy từ Desktop Tracker; phần so sánh là với lần cập nhật gần nhất trong phiên xem hiện tại.
          </p>
        </div>

        <div style={{
          display: 'flex',
          background: 'rgba(15,23,42,0.04)',
          border: '1px solid rgba(15,23,42,0.08)',
          borderRadius: 6,
          padding: 3,
          gap: 2,
        }}>
          {RANGES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              style={{
                padding: '7px 14px',
                borderRadius: 5,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                background: range === key ? '#3b82f6' : 'transparent',
                color: range === key ? '#fff' : '#64748b',
                transition: 'all 0.15s ease',
                boxShadow: range === key ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="dashboard-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {STAT_CARDS.map((card, i) => (
          <div key={i}
            style={{
              background: '#111827',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 8,
              padding: '20px 22px',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              cursor: 'default',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(59,130,246,0.15)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{card.label}</span>
              <span style={{ color: '#4b5563' }}><card.icon size={16} /></span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px', color: '#0f172a', lineHeight: 1 }}>
              {loading ? <span style={{ color: '#cbd5e1' }}>—</span> : card.value}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: card.sub.color, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
              {card.sub.icon === 'up' && <TrendUp size={11} strokeWidth={2.5} />}
              {card.sub.icon === 'down' && <TrendDown size={11} strokeWidth={2.5} />}
              {card.sub.text}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        background: '#111827',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#f8fafc' }}>Hoạt Động Thời Gian Thực</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#22c55e',
              boxShadow: liveFlash ? '0 0 12px #22c55e' : '0 0 6px rgba(34,197,94,0.5)',
              animation: 'pulse-dot 2s ease infinite',
              transition: 'box-shadow 0.3s',
            }} />
            <span style={{ fontSize: 12, color: '#64748b', fontFamily: "'JetBrains Mono', 'SF Mono', monospace" }}>Cập nhật trực tiếp</span>
          </div>
        </div>

        <div className="dashboard-realtime-table" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                {['Người dùng', 'Trạng thái', 'Gõ phím/phút', 'Click/phút', 'Thời gian hoạt động', 'Điểm'].map(h => (
                  <th key={h} style={{
                    padding: '10px 20px',
                    textAlign: h === 'Người dùng' || h === 'Trạng thái' ? 'left' : 'right',
                    fontSize: 11, fontWeight: 600, color: '#64748b',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Đang tải...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Chưa có hoạt động nào</td></tr>
              ) : users.map((u) => {
                const status = (u.status || 'offline').toLowerCase();
                const sc = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
                const initials = (u.name || 'U').substring(0, 2).toUpperCase();
                const activeSecs = Number(u.activeSeconds || 0);
                const activeMins = Math.max(1, activeSecs / 60);
                const kpm = activeSecs > 0 ? Math.round(Number(u.keystrokeCount || 0) / activeMins) : 0;
                const cpm = activeSecs > 0 ? Math.round(Number(u.mouseClickCount || 0) / activeMins) : 0;
                return (
                  <tr
                    key={u.user_id}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(`/users/${u.user_id}`);
                      }
                    }}
                    style={{ borderBottom: '1px solid rgba(15,23,42,0.04)', cursor: 'pointer', transition: 'background 0.15s' }}
                    onClick={() => navigate(`/users/${u.user_id}`)}
                  >
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 5,
                          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 800, color: '#fff',
                        }}>{initials}</div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '4px 10px', borderRadius: 4,
                        background: sc.bg, border: `1px solid ${sc.border}`,
                        fontSize: 11, fontWeight: 700, color: sc.color,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot }} />
                        {sc.label}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#334155', fontWeight: 600 }}>
                      {kpm.toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#334155', fontWeight: 600 }}>
                      {cpm.toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#64748b' }}>
                      {formatDuration(activeSecs)}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <span style={{
                        fontSize: 14, fontWeight: 800,
                        color: Number(u.score || 0) >= 90 ? '#22c55e' : Number(u.score || 0) >= 70 ? '#60a5fa' : '#f59e0b',
                      }}>
                        {Number(u.score || 0).toFixed(1)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
