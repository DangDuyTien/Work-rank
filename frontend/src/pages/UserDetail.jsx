import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { activity, users as usersApi } from '../services/api';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';


const STATUS_CONFIG = {
  active:  { label: 'Đang hoạt động', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.4)',  color: '#22c55e', dot: '#22c55e' },
  online:  { label: 'Trực tuyến',     bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.4)', color: '#60a5fa', dot: '#60a5fa' },
  idle:    { label: 'Không HĐ',       bg: 'rgba(234,179,8,0.12)',  border: 'rgba(234,179,8,0.4)',  color: '#eab308', dot: '#eab308' },
  offline: { label: 'Ngoại tuyến',    bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)',color: '#6b7280', dot: '#6b7280' },
};


function fmtNum(n) {
  n = Number(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toLocaleString();
}
function fmtDur(s) {
  s = Number(s) || 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}


const HEAT_COLORS = ['#161b27', '#0d3a26', '#166534', '#15803d', '#22c55e'];


export default function UserDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const [user, setUser]         = useState(null);
  const [stats, setStats]       = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [uRes, sRes, tRes, hRes, sessionRes] = await Promise.all([
          usersApi.get(id),
          activity.userStats(id, 'today'),
          activity.timeline(id),
          activity.heatmap(id),
          activity.sessions(id, 10),
        ]);
        setUser(uRes.data);
        setStats(sRes.data);
        setTimeline(tRes.data || []);
        setHeatmapData(hRes.data || []);
        setSessions(sessionRes.data || []);
      } catch (err) {
        console.error('Failed to fetch user detail:', err);
      }
      setLoading(false);
    };
    fetchAll();
  }, [id]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12, color: '#4b5563' }}>
      <div style={{ width: 18, height: 18, border: '2px solid #374151', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{ fontSize: 14 }}>Loading profile...</span>
    </div>
  );
  if (!user) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12, color: '#4b5563' }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
      <p style={{ fontSize: 14, margin: 0 }}>User not found</p>
    </div>
  );

  const status   = (user.status || 'offline').toLowerCase();
  const sc       = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
  const initials = (user.name || 'U').substring(0, 2).toUpperCase();
  const score    = Number(stats?.score || 0);
  const scoreColor = score >= 90 ? '#22c55e' : score >= 70 ? '#60a5fa' : '#f59e0b';
  // Reshape flat heatmap array into 52-week grid
  const heatmap = (() => {
    const weeks = [];
    // heatmapData is chronological oldest→newest, 365 items
    const data = heatmapData.length === 365 ? heatmapData : Array(365).fill({ date: '', count: 0, level: 0 });
    for (let w = 0; w < 53; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const idx = w * 7 + d;
        if (idx < data.length) week.push(data[idx]);
      }
      if (week.length > 0) weeks.push(week);
    }
    return weeks;
  })();

  // Chart data: convert timeline to 24-hr area chart
  const chartData = Array.from({ length: 17 }, (_, i) => {
    const hour = i + 7;
    const row  = timeline.find(t => Number(t.hour) === hour);
    return {
      time: `${String(hour).padStart(2,'0')}:00`,
      keystrokes: row ? Number(row.keystrokes) : 0,
      clicks:     row ? Number(row.mouse_clicks) : 0,
    };
  });

  const recentSessions = sessions.map((session, index) => {
    const started = session.startedAt ? new Date(session.startedAt) : null;
    const ended = session.endedAt ? new Date(session.endedAt) : null;
    const duration = Number(session.durationSeconds || session.activeSeconds || 0);
    const time = started
      ? `${started.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${ended ? ended.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'đang chạy'} (${fmtDur(duration)})`
      : 'Không rõ thời gian';
    return {
      name: `Phiên hoạt động #${sessions.length - index}`,
      time,
      actions: Number(session.keystrokeCount || 0) + Number(session.mouseClickCount || 0),
      active: session.status === 'running',
    };
  });

  const CARD = { background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6 };

  return (
    <div>
      {/* ── Back ── */}
      <button
        onClick={() => navigate(-1)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#6b7280', fontSize: 13, fontWeight: 600, marginBottom: 22, padding: 0,
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#e2e8f0'}
        onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        Quay lại Bảng Xếp Hạng
      </button>

      {/* ── TOP ROW: Profile + Status ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 14, marginBottom: 14 }}>

        {/* Profile Card */}
        <div style={{ ...CARD, padding: '24px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 6,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 900, color: '#fff',
              boxShadow: '0 8px 24px rgba(59,130,246,0.25)',
            }}>{initials}</div>
            <div style={{
              position: 'absolute', bottom: -4, right: -4,
              width: 18, height: 18, borderRadius: '50%',
              background: sc.dot, border: '3px solid #111827',
            }} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.5px' }}>{user.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#4b5563', fontWeight: 600 }}>ID: WR-{String(id).padStart(4,'0')}</span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#374151' }} />
              <span style={{ fontSize: 12, color: '#4b5563', fontWeight: 600 }}>{user.email}</span>
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10,
              padding: '4px 10px', borderRadius: 4,
              background: sc.bg, border: `1px solid ${sc.border}`,
              fontSize: 11, fontWeight: 700, color: sc.color,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot }} />
              {sc.label}
            </span>
          </div>
        </div>

        {/* Current Status Card */}
        <div style={{ ...CARD, padding: '20px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>
            Trạng Thái Hiện Tại
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: sc.color, letterSpacing: '-0.5px' }}>{sc.label}</div>
            <div style={{ fontSize: 12, color: '#4b5563', fontWeight: 600 }}>
              Phiên: {fmtDur(stats?.total_active_seconds || 0)}
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${Math.min(100, score)}%`,
              background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}aa)`,
              transition: 'width 0.8s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>Điểm Hoạt Động</span>
            <span style={{ fontSize: 11, color: scoreColor, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace" }}>{score.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* ── HEATMAP ── */}
      <div style={{ ...CARD, padding: '20px 22px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 3px' }}>Biểu Đồ Năng Suất</h2>
            <p style={{ fontSize: 11, color: '#4b5563', margin: 0, fontWeight: 500 }}>Khối lượng hoạt động 12 tháng qua (Gõ phím & Click)</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#4b5563', fontWeight: 600 }}>Ít hơn</span>
            {HEAT_COLORS.map((c, i) => (
              <div key={i} style={{ width: 11, height: 11, borderRadius: 2, background: c, border: '1px solid rgba(255,255,255,0.05)' }} />
            ))}
            <span style={{ fontSize: 11, color: '#4b5563', fontWeight: 600 }}>Nhiều hơn</span>
          </div>
        </div>
        {/* Grid */}
        <div style={{ display: 'flex', gap: 3, overflowX: 'auto' }}>
          {heatmap.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {week.map((cell, di) => (
                <div key={di}
                  title={`${cell.date || ''}${cell.count > 0 ? ` — ${cell.count.toLocaleString()} thao tác` : ' — Không có hoạt động'}`}
                  style={{
                    width: 11, height: 11, borderRadius: 2,
                    background: HEAT_COLORS[cell.level] || HEAT_COLORS[0],
                    border: '1px solid rgba(255,255,255,0.04)',
                    cursor: cell.count > 0 ? 'pointer' : 'default',
                    transition: 'transform 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.4)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                />

              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── CHART + PERSONAL BEST ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 14, marginBottom: 14 }}>
        {/* Area Chart */}
        <div style={{ ...CARD, padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 3px' }}>Hoạt Động Theo Giờ Hôm Nay</h2>
              <p style={{ fontSize: 11, color: '#4b5563', margin: 0, fontWeight: 500 }}>Tốc độ gõ phím & click theo giờ</p>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              {[{ color: '#3b82f6', label: 'Gõ phím' }, { color: '#a78bfa', label: 'Clicks' }].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                  <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25}/>
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.2}/>
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="time" tick={{ fill: '#4b5563', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} interval={3} />
              <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 12, color: '#e2e8f0' }}
                cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }}
              />
              <Area type="monotone" dataKey="keystrokes" stroke="#3b82f6" strokeWidth={2} fill="url(#gk)" name="Keystrokes" dot={false} />
              <Area type="monotone" dataKey="clicks"     stroke="#a78bfa" strokeWidth={2} fill="url(#gc)" name="Clicks"     dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Personal Best */}
        <div style={{ ...CARD, padding: '20px 20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Kỷ Lục Cá Nhân</h2>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 38, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-1px', fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>
              {fmtNum((stats?.total_keystrokes || 0) + (stats?.total_mouse_clicks || 0))}
            </div>
            <div style={{ fontSize: 12, color: '#4b5563', fontWeight: 600, marginTop: 8 }}>Thao tác trong một ngày</div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16, marginTop: 16 }}>
            <div style={{ fontSize: 11, color: '#4b5563', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Thực Hiện Lúc</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>
              {new Date().toLocaleDateString('vi-VN', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* ── RECENT SESSIONS ── */}
      <div style={{ ...CARD, padding: '20px 22px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px' }}>Các phiên hoạt động gần đây</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {recentSessions.length === 0 ? (
            <div style={{ padding: '14px 0', color: '#4b5563', fontSize: 13 }}>Chưa có phiên hoạt động nào.</div>
          ) : recentSessions.map((s, i) => (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 0',
                borderBottom: i < recentSessions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}
            >
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: s.active ? '#22c55e' : '#374151',
                boxShadow: s.active ? '0 0 8px #22c55e88' : 'none',
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 2 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: '#4b5563', fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>{s.time}</div>
              </div>
              <div style={{
                padding: '4px 12px', borderRadius: 4,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                fontSize: 12, fontWeight: 700, color: '#94a3b8',
                fontFamily: "'JetBrains Mono',monospace",
                whiteSpace: 'nowrap',
              }}>
                {s.actions.toLocaleString()} Thao tác
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
