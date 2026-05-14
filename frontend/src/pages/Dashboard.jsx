import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboard, leaderboard } from '../services/api';
import { useAuth } from '../context/AuthContext';

// Icons
const UsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const KeyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2"/>
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>
  </svg>
);
const MouseIcon2 = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="7"/><path d="M12 2v9"/>
  </svg>
);
const TrendUp = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);
const TrendDown = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
    <polyline points="17 18 23 18 23 12"/>
  </svg>
);

const STATUS_CONFIG = {
  active: { label: 'Đang hoạt động', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.4)', color: '#22c55e', dot: '#22c55e' },
  online: { label: 'Trực tuyến', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.4)', color: '#60a5fa', dot: '#60a5fa' },
  idle:   { label: 'Không hoạt động', bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.4)', color: '#eab308', dot: '#eab308' },
  offline:{ label: 'Ngoại tuyến', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)', color: '#6b7280', dot: '#6b7280' },
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

// Module-level cache to preserve realtime stats across component remounts
let globalUsersCache = [];

export default function Dashboard() {
  const { socket } = useAuth();
  const [range, setRange] = useState('today');
  const [users, setUsers] = useState(globalUsersCache);
  const [totals, setTotals] = useState({ keystrokes: 0, clicks: 0, activeSeconds: 0, online: 0 });
  const [prevTotals, setPrevTotals] = useState(null);
  const [liveFlash, setLiveFlash] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const prevRef = useRef(null);

  // Sync state to cache
  useEffect(() => {
    globalUsersCache = users;
  }, [users]);

  const fetchData = async (selectedRange) => {
    setLoading(true);
    try {
      const [res, overviewRes] = await Promise.all([
        leaderboard.get(selectedRange),
        dashboard.overview(selectedRange),
      ]);
      const fetchedData = res.data || [];
      
      let mergedData = [];
      setUsers(prevUsers => {
        const fetchedMap = new Map(fetchedData.map(u => [String(u.user_id || u.id), u]));
        const prevMap = new Map(prevUsers.map(u => [String(u.user_id || u.id), u]));
        
        const allUserIds = new Set([...fetchedMap.keys(), ...prevMap.keys()]);
        mergedData = Array.from(allUserIds).map(id => {
          const u = fetchedMap.get(id) || {};
          const existing = prevMap.get(id);
          
          if (!existing) return u;
          if (!fetchedMap.has(id)) return existing; // Keep realtime-only users
          
          return {
            ...u,
            status: u.status || existing.status || 'offline',
            presence: u.presence || u.status || existing.presence || existing.status || 'offline',
            presenceStatus: u.presenceStatus || u.presence || u.status || existing.presenceStatus || existing.status || 'offline',
            keystrokeCount: Math.max(Number(existing.keystrokeCount || 0), Number(u.keystrokeCount || 0)),
            mouseClickCount: Math.max(Number(existing.mouseClickCount || 0), Number(u.mouseClickCount || 0)),
            activeSeconds: Math.max(Number(existing.activeSeconds || 0), Number(u.activeSeconds || 0)),
            score: Math.max(Number(existing.score || 0), Number(u.score || 0)),
          };
        });
        return mergedData;
      });

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
      console.error('Failed to fetch dashboard data:', err);
    }
    setLoading(false);
  };

  // Fetch initial leaderboard data
  useEffect(() => {
    fetchData(range);
  }, [range]);

  // Setup real-time socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleActivity = (data) => {
      setLiveFlash(true);
      setTimeout(() => setLiveFlash(false), 600);
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

    return () => {
      socket.off('activity:user:update', handleActivity);
      socket.off('user:status:update', handleStatus);
    };
  }, [socket, range]);

  const rangeLabel = range === 'today' ? 'giờ trước' : range === 'week' ? 'tuần trước' : 'tháng trước';

  const buildSub = (current, prev) => {
    const pct = calcChange(current, prev);
    if (pct === null) return { text: '— chưa có dữ liệu so sánh', color: '#6b7280', icon: null };
    if (pct === 0) return { text: `— ổn định so với ${rangeLabel}`, color: '#6b7280', icon: null };
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>Tổng Quan</h1>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0', fontWeight: 500 }}>
            Hoạt động thời gian thực của toàn bộ nhóm
          </p>
        </div>

        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
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
                color: range === key ? '#fff' : '#6b7280',
                transition: 'all 0.15s ease',
                boxShadow: range === key ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {STAT_CARDS.map((card, i) => (
          <div key={i} style={{
            background: '#161b27',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 6,
            padding: '20px 22px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{card.label}</span>
              <span style={{ color: '#374151' }}><card.icon /></span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px', color: '#f9fafb', lineHeight: 1 }}>
              {loading ? <span style={{ color: '#1f2937' }}>—</span> : card.value}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: card.sub.color, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
              {card.sub.icon === 'up' && <TrendUp />}
              {card.sub.icon === 'down' && <TrendDown />}
              {card.sub.text}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        background: '#161b27',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 6,
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Hoạt Động Thời Gian Thực</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#22c55e',
              boxShadow: liveFlash ? '0 0 10px #22c55e' : '0 0 6px #22c55e66',
              transition: 'box-shadow 0.3s',
            }} />
            <span style={{ fontSize: 12, color: '#6b7280', fontFamily: "'JetBrains Mono', 'SF Mono', monospace" }}>Cập nhật trực tiếp</span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['Người dùng', 'Trạng thái', 'Gõ phím/phút', 'Click/phút', 'Thời gian hoạt động', 'Điểm'].map(h => (
                  <th key={h} style={{
                    padding: '10px 20px',
                    textAlign: h === 'Người dùng' || h === 'Trạng thái' ? 'left' : 'right',
                    fontSize: 11, fontWeight: 600, color: '#4b5563',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#374151', fontSize: 14 }}>Đang tải...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#374151', fontSize: 14 }}>Chưa có hoạt động nào</td></tr>
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
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.15s' }}
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
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{u.name}</span>
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
                    <td style={{ padding: '14px 20px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#cbd5e1', fontWeight: 600 }}>
                      {kpm.toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#cbd5e1', fontWeight: 600 }}>
                      {cpm.toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#94a3b8' }}>
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
