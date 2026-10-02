import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { computerActivityApi } from '../services/api';
import { useActivityStats } from '../hooks/useActivityTracker';
import { getUserAvatar, initialsFromName } from '../utils/avatar';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Play,
  Pause,
  RefreshCw,
  Users,
  Activity,
  Wifi,
  WifiOff,
  Clock,
  Monitor,
  Trophy,
  Flame,
  Award,
} from 'lucide-react';
import VerifiedBadge from './VerifiedBadge';
import JobTitleBadge from './JobTitleBadge';

// Helper: Format seconds to hours and minutes
function formatDuration(seconds = 0) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// Category aesthetic tags
const CATEGORY_TAGS = {
  DESIGN_VIDEO: { label: 'Thiết Kế / Video', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  DEVELOPMENT: { label: 'Lập Trình', color: '#0284c7', bg: 'rgba(2,132,199,0.1)' },
  OFFICE: { label: 'Văn Phòng', color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  BROWSER: { label: 'Trình Duyệt', color: '#ea580c', bg: 'rgba(234,88,12,0.1)' },
  SYSTEM: { label: 'Hệ Thống', color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
};

/**
 * LIVE ACTIVITY WAVE COMPONENT
 * Real-time continuous computer activity visualized as surfers riding dynamic ocean waves.
 */
export default function LiveActivityWave({ defaultPeriod = 'today' }) {
  const { user: currentUser, socket } = useAuth();
  const { isTrackingActive, toggleTracking } = useActivityStats();

  const [period, setPeriod] = useState(defaultPeriod);

  useEffect(() => {
    if (defaultPeriod && defaultPeriod !== period) {
      setPeriod(defaultPeriod);
    }
  }, [defaultPeriod]);
  const [waveData, setWaveData] = useState({
    timestamp: new Date().toISOString(),
    totalSurfers: 0,
    activeSurfers: 0,
    idleSurfers: 0,
    offlineSurfers: 0,
    surfers: [],
  });
  const [hoveredSurferId, setHoveredSurferId] = useState(null);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('ALL');
  const [socketConnected, setSocketConnected] = useState(Boolean(socket?.connected));
  const [lastTickTime, setLastTickTime] = useState(Date.now());

  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const surfersRenderStateRef = useRef(new Map());
  const waveDataRef = useRef(waveData);
  waveDataRef.current = waveData;

  // 1. Fetch initial snapshot via REST API
  const fetchSnapshot = useCallback(async (selectedPeriod) => {
    try {
      const res = await computerActivityApi.getLiveWaveState({ period: selectedPeriod });
      if (res && res.surfers) {
        setWaveData(res);
        setLastTickTime(Date.now());
      }
    } catch (err) {
      console.warn('[LiveWave] Snapshot fetch fallback error:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchSnapshot(period);
  }, [period, fetchSnapshot]);

  // 2. Realtime WebSocket Transport via 'activity:wave'
  useEffect(() => {
    if (!socket) return;

    setSocketConnected(socket.connected);

    const onConnect = () => {
      setSocketConnected(true);
      socket.emit('activity:wave:join', { period });
    };

    const onDisconnect = () => {
      setSocketConnected(false);
    };

    const onWaveTick = (snapshot) => {
      if (!snapshot) return;
      setWaveData(snapshot);
      setLastTickTime(Date.now());
      setSocketConnected(true);
    };

    const onWaveInitial = (snapshot) => {
      if (!snapshot) return;
      setWaveData(snapshot);
      setLastTickTime(Date.now());
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('activity:wave:tick', onWaveTick);
    socket.on('activity:wave:initial', onWaveInitial);

    // Join room immediately if already connected
    if (socket.connected) {
      socket.emit('activity:wave:join', { period });
    }

    return () => {
      socket.emit('activity:wave:leave');
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('activity:wave:tick', onWaveTick);
      socket.off('activity:wave:initial', onWaveInitial);
    };
  }, [socket, period]);

  // Fallback poller if socket is disconnected (every 4s)
  useEffect(() => {
    if (socketConnected) return;
    const poller = setInterval(() => {
      fetchSnapshot(period);
    }, 4000);
    return () => clearInterval(poller);
  }, [socketConnected, period, fetchSnapshot]);

  // 3. Filtered Surfers for Ocean & Table
  const filteredSurfers = useMemo(() => {
    let list = waveData.surfers || [];
    if (selectedTeamFilter !== 'ALL') {
      list = list.filter((s) => String(s.teamId || '') === String(selectedTeamFilter));
    }
    return list;
  }, [waveData.surfers, selectedTeamFilter]);

  const uniqueTeams = useMemo(() => {
    const map = new Map();
    (waveData.surfers || []).forEach((s) => {
      if (s.teamId && s.teamName) {
        map.set(String(s.teamId), s.teamName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [waveData.surfers]);

  // Current User Surfer profile
  const mySurfer = useMemo(() => {
    if (!currentUser) return null;
    return (waveData.surfers || []).find((s) => Number(s.userId) === Number(currentUser.id)) || null;
  }, [waveData.surfers, currentUser]);

  // 4. 60FPS Continuous Canvas Wave & Surfer Interpolation Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let startTime = performance.now();

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);

    // Render loop
    const render = (time) => {
      const elapsed = (time - startTime) * 0.001;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      // --- OCEAN ATMOSPHERE BACKGROUND GRADIENT ---
      const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
      oceanGrad.addColorStop(0, '#090e17');
      oceanGrad.addColorStop(0.4, '#0f172a');
      oceanGrad.addColorStop(1, '#020617');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle atmospheric grid lines (sport-tech precision)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // --- WAVE MATHEMATICAL HARMONICS ---
      const baseWaveY = height * 0.62;
      const waveSpeed = 0.8;

      // Harmonic function for main wave
      const getWaveY = (x, t, amp = 26) => {
        const k1 = 0.006;
        const k2 = 0.012;
        const k3 = 0.003;
        return (
          baseWaveY +
          Math.sin(x * k1 - t * waveSpeed * 1.4) * amp +
          Math.sin(x * k2 + t * waveSpeed * 0.9) * (amp * 0.45) +
          Math.cos(x * k3 - t * waveSpeed * 0.5) * (amp * 0.25)
        );
      };

      // Harmonic function for secondary background wave
      const getBackWaveY = (x, t) => {
        return (
          baseWaveY - 14 +
          Math.sin(x * 0.005 + t * waveSpeed * 0.8) * 16 +
          Math.cos(x * 0.009 - t * waveSpeed * 0.6) * 10
        );
      };

      // 1. Draw Secondary Depth Wave
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 10) {
        ctx.lineTo(x, getBackWaveY(x, elapsed));
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      const backGrad = ctx.createLinearGradient(0, baseWaveY - 30, 0, height);
      backGrad.addColorStop(0, 'rgba(14, 116, 144, 0.18)');
      backGrad.addColorStop(1, 'rgba(15, 23, 42, 0.6)');
      ctx.fillStyle = backGrad;
      ctx.fill();

      // 2. Draw Primary Live Wave Body
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 6) {
        ctx.lineTo(x, getWaveY(x, elapsed));
      }
      ctx.lineTo(width, height);
      ctx.closePath();

      const mainWaveGrad = ctx.createLinearGradient(0, baseWaveY - 40, 0, height);
      mainWaveGrad.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
      mainWaveGrad.addColorStop(0.2, 'rgba(2, 132, 199, 0.25)');
      mainWaveGrad.addColorStop(0.7, 'rgba(15, 23, 42, 0.85)');
      mainWaveGrad.addColorStop(1, 'rgba(2, 6, 23, 0.98)');
      ctx.fillStyle = mainWaveGrad;
      ctx.fill();

      // 3. Draw Luminous Crest Edge Line (Foam / Surface)
      ctx.beginPath();
      for (let x = 0; x <= width; x += 6) {
        const y = getWaveY(x, elapsed);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Subtle water spray sheen below crest
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // --- SURFERS INTERPOLATION & RENDERING ---
      const surfers = filteredSurfers.slice(0, 24); // Render top 24 on wave to maintain visual poise
      const renderStates = surfersRenderStateRef.current;

      surfers.forEach((surfer, idx) => {
        const uid = surfer.userId;
        let sState = renderStates.get(uid);

        // Compute target X: distributed according to rank and wave position
        const targetNormalizedX = surfer.wavePosition !== undefined
          ? surfer.wavePosition
          : (idx + 1) / (surfers.length + 1);
        const targetX = targetNormalizedX * width;
        const targetIntensity = surfer.activityState === 'OFFLINE' ? 0 : surfer.intensity;

        if (!sState) {
          sState = {
            x: targetX,
            intensity: targetIntensity,
            score: surfer.score,
          };
          renderStates.set(uid, sState);
        }

        // 60FPS Easing Interpolation
        sState.x += (targetX - sState.x) * 0.05;
        sState.intensity += (targetIntensity - sState.intensity) * 0.08;
        sState.score += (surfer.score - sState.score) * 0.1;

        const curX = sState.x;
        const waveSurfaceY = getWaveY(curX, elapsed);

        // Surfer Y height:
        // High intensity -> climbs high onto the crest (-42px)
        // Active medium -> riding wave face (-20px)
        // Idle -> dipping into the calm water (+8px)
        // Offline -> sinking deeper (+18px)
        let heightOffset = 0;
        if (surfer.activityState === 'ACTIVE') {
          heightOffset = -(20 + sState.intensity * 24);
        } else if (surfer.activityState === 'IDLE') {
          heightOffset = 6;
        } else {
          heightOffset = 18;
        }

        const surferY = waveSurfaceY + heightOffset;
        const isMe = currentUser && Number(currentUser.id) === Number(surfer.userId);
        const isHovered = hoveredSurferId === uid;

        // Save computed position for HTML interactive overlays
        sState.screenX = curX;
        sState.screenY = surferY;

        // A. Draw Sleek Minimalist Surfboard Line
        ctx.save();
        ctx.translate(curX, surferY + 16);

        // Board tilt angle matching wave slope
        const dx = 4;
        const slope = (getWaveY(curX + dx, elapsed) - getWaveY(curX - dx, elapsed)) / (dx * 2);
        const angle = Math.atan(slope) * 0.6;
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.moveTo(-18, 0);
        ctx.lineTo(18, 0);
        ctx.strokeStyle = isMe ? '#38bdf8' : (surfer.activityState === 'ACTIVE' ? '#10b981' : '#64748b');
        ctx.lineWidth = isMe ? 3 : 2;
        ctx.stroke();

        // Water Wake / Spray particle trail if active
        if (surfer.activityState === 'ACTIVE' && sState.intensity > 0.2) {
          ctx.beginPath();
          ctx.moveTo(-18, 2);
          ctx.lineTo(-28 - sState.intensity * 12, 4);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.restore();

        // B. Draw Active Glow Aura
        if (surfer.activityState === 'ACTIVE') {
          ctx.beginPath();
          ctx.arc(curX, surferY, isMe ? 22 : 18, 0, Math.PI * 2);
          ctx.fillStyle = isMe ? 'rgba(56, 189, 248, 0.22)' : 'rgba(16, 185, 129, 0.15)';
          ctx.fill();
        }

        // C. Draw Surfer Circle Base
        ctx.beginPath();
        const radius = isMe ? 15 : 13;
        ctx.arc(curX, surferY, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.strokeStyle = isMe
          ? '#38bdf8'
          : (surfer.activityState === 'ACTIVE' ? '#10b981' : (surfer.activityState === 'IDLE' ? '#f59e0b' : '#475569'));
        ctx.lineWidth = isMe ? 2.5 : 1.8;
        ctx.stroke();

        // D. Draw Avatar or Initials inside circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(curX, surferY, radius - 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = isMe ? '#0284c7' : '#334155';
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${radius > 14 ? '11px' : '10px'} 'Space Grotesk', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initials = initialsFromName(surfer.name || '??');
        ctx.fillText(initials, curX, surferY);
        ctx.restore();

        // E. Rank Badge pill above Avatar
        ctx.save();
        const rankText = `#${surfer.rank}`;
        ctx.font = "700 9px 'JetBrains Mono', monospace";
        const badgeW = ctx.measureText(rankText).width + 8;
        const badgeH = 13;
        const badgeY = surferY - radius - 12;

        ctx.fillStyle = surfer.rank === 1 ? '#eab308' : (surfer.rank === 2 ? '#94a3b8' : (surfer.rank === 3 ? '#b45309' : '#1e293b'));
        ctx.beginPath();
        ctx.roundRect(curX - badgeW / 2, badgeY, badgeW, badgeH, 3);
        ctx.fill();

        ctx.fillStyle = surfer.rank <= 3 ? '#0f172a' : '#94a3b8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rankText, curX, badgeY + badgeH / 2);
        ctx.restore();

        // F. Name Label & Score below Surfer
        ctx.save();
        ctx.font = `600 ${isMe ? '11px' : '10px'} 'Space Grotesk', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = isMe ? '#38bdf8' : (surfer.activityState === 'ACTIVE' ? '#f8fafc' : '#94a3b8');
        const displayName = isMe ? `${surfer.name.split(' ').slice(-1)[0]} (Bạn)` : surfer.name.split(' ').slice(-1)[0];
        ctx.fillText(displayName, curX, surferY + 28);

        // Realtime Score badge
        ctx.font = "500 9px 'JetBrains Mono', monospace";
        ctx.fillStyle = isMe ? '#bae6fd' : '#64748b';
        ctx.fillText(`${Math.round(sState.score)} pts`, curX, surferY + 39);
        ctx.restore();
      });

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      resizeObserver.disconnect();
    };
  }, [filteredSurfers, currentUser, hoveredSurferId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── 1. SPORT-TECH EDITORIAL HERO HEADER ── */}
      <section
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          padding: '20px 24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          {/* Title & Live Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                background: '#0f172a',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
              }}
            >
              <Activity size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
                  ĐỘ NĂNG ĐỘNG
                </h1>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: socketConnected ? '#dcfce7' : '#fef3c7',
                    color: socketConnected ? '#15803d' : '#b45309',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: socketConnected ? '#16a34a' : '#d97706',
                      boxShadow: socketConnected ? '0 0 0 2px rgba(22,163,74,0.3)' : 'none',
                    }}
                  />
                  {socketConnected ? 'LIVE ~1s' : 'RECONNECTING'}
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b' }}>
                Live Computer Activity Ocean — Từng thành viên lướt sóng theo thao tác máy tính thời gian thực
              </p>
            </div>
          </div>

          {/* Quick Controls: Periods & Tracking Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {/* Period Filters */}
            <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: 3, borderRadius: 6 }}>
              {[
                { id: 'today', label: 'Hôm Nay' },
                { id: '7d', label: '7 Ngày' },
                { id: '30d', label: '30 Ngày' },
                { id: 'all-time', label: 'Toàn Thời Gian' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  style={{
                    padding: '5px 12px',
                    fontSize: 12,
                    fontWeight: period === p.id ? 700 : 500,
                    color: period === p.id ? '#0f172a' : '#64748b',
                    background: period === p.id ? '#ffffff' : 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    boxShadow: period === p.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* ONE-CLICK WEB TRACKING TOGGLE */}
            <button
              type="button"
              onClick={() => toggleTracking(currentUser)}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '7px 16px',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
                background: isTrackingActive ? '#dc2626' : '#16a34a',
                color: '#ffffff',
                border: 'none',
                boxShadow: isTrackingActive ? '0 2px 6px rgba(220,38,38,0.25)' : '0 2px 6px rgba(22,163,74,0.25)',
              }}
            >
              {isTrackingActive ? (
                <>
                  <Pause size={14} fill="#ffffff" />
                  <span>Tắt Theo Dõi</span>
                </>
              ) : (
                <>
                  <Play size={14} fill="#ffffff" />
                  <span>Bật Theo Dõi</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Current User Live Pulse Strip */}
        {mySurfer && (
          <div
            style={{
              marginTop: 16,
              padding: '10px 16px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: '#0f172a',
                  color: '#38bdf8',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                CỦA BẠN #{mySurfer.rank}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                {mySurfer.name}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: mySurfer.activityState === 'ACTIVE' ? '#16a34a' : (mySurfer.activityState === 'IDLE' ? '#d97706' : '#64748b'),
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                ● {mySurfer.activityState === 'ACTIVE' ? 'Đang Lướt Sóng' : (mySurfer.activityState === 'IDLE' ? 'Tạm Nghỉ' : 'Ngoại Tuyến')}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div>
                <span style={{ fontSize: 11, color: '#64748b' }}>Điểm năng động: </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#059669', fontFamily: "'JetBrains Mono', monospace" }}>
                  {mySurfer.score.toLocaleString()} pts
                </span>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#64748b' }}>Thời gian hôm nay: </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: "'JetBrains Mono', monospace" }}>
                  {formatDuration(mySurfer.activeSecondsToday)}
                </span>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#64748b' }}>Độ tập trung: </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0284c7', fontFamily: "'JetBrains Mono', monospace" }}>
                  {Math.round(mySurfer.intensity * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── 2. THE HERO: LIVE ACTIVITY OCEAN & SURFERS CANVAS ── */}
      <section
        style={{
          position: 'relative',
          background: '#090e17',
          border: '1px solid #1e293b',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
        }}
      >
        {/* Ocean Top Status Bar */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 20,
            right: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: '#38bdf8',
                background: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(4px)',
                padding: '4px 10px',
                borderRadius: 4,
                border: '1px solid rgba(56, 189, 248, 0.2)',
              }}
            >
              🌊 LIVE ACTIVITY WAVE
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {waveData.activeSurfers} đang lướt sóng · {waveData.idleSurfers} nghỉ ngơi · {waveData.offlineSurfers} offline
            </span>
          </div>

          {/* Team Filter Pills inside Ocean Header */}
          {uniqueTeams.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'auto' }}>
              <button
                type="button"
                onClick={() => setSelectedTeamFilter('ALL')}
                style={{
                  padding: '3px 9px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: selectedTeamFilter === 'ALL' ? '#38bdf8' : 'rgba(15, 23, 42, 0.8)',
                  color: selectedTeamFilter === 'ALL' ? '#0f172a' : '#94a3b8',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                Tất cả đội
              </button>
              {uniqueTeams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTeamFilter(t.id)}
                  style={{
                    padding: '3px 9px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: selectedTeamFilter === t.id ? '#38bdf8' : 'rgba(15, 23, 42, 0.8)',
                    color: selectedTeamFilter === t.id ? '#0f172a' : '#94a3b8',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 60FPS Continuous Ocean Canvas */}
        <div style={{ width: '100%', height: 380, position: 'relative' }}>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>

        {/* Ocean Bottom Legend Bar */}
        <div
          style={{
            padding: '10px 20px',
            background: 'rgba(2, 6, 23, 0.85)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            color: '#64748b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
              <strong style={{ color: '#cbd5e1' }}>Đang lướt sóng (Active):</strong> Ở đỉnh sóng, tạo bọt nước
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
              <strong style={{ color: '#cbd5e1' }}>Tạm nghỉ (Idle):</strong> Lắng xuống vùng nước tĩnh
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#475569' }} />
              <strong style={{ color: '#cbd5e1' }}>Ngoại tuyến (Offline):</strong> Chìm xuống đáy
            </span>
          </div>

          <div style={{ fontFamily: "'JetBrains Mono', monospace", color: '#94a3b8' }}>
            Tick: {new Date(lastTickTime).toLocaleTimeString('vi-VN')}
          </div>
        </div>
      </section>

      {/* ── 3. LIVE RANKING LEADERBOARD TABLE ── */}
      <section
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Trophy size={18} color="#b45309" />
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
              BẢNG XẾP HẠNG NĂNG ĐỘNG ({period === 'today' ? 'HÔM NAY' : (period === '7d' ? '7 NGÀY' : (period === '30d' ? '30 NGÀY' : 'TOÀN THỜI GIAN'))})
            </h2>
          </div>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {filteredSurfers.length} thành viên tham gia
          </span>
        </div>

        {/* Table Data */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                <th style={{ padding: '10px 16px', width: 70, textAlign: 'center' }}>Hạng</th>
                <th style={{ padding: '10px 16px' }}>Thành Viên</th>
                <th style={{ padding: '10px 16px' }}>Đội Nhóm</th>
                <th style={{ padding: '10px 16px' }}>Trạng Thái Live</th>
                <th style={{ padding: '10px 16px', textAlign: 'center' }}>Độ Tập Trung</th>
                <th style={{ padding: '10px 16px' }}>Thời Gian</th>
                <th style={{ padding: '10px 16px', textAlign: 'right' }}>Điểm Năng Động</th>
              </tr>
            </thead>
            <tbody>
              {filteredSurfers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                    Chưa có dữ liệu hoạt động cho bộ lọc này.
                  </td>
                </tr>
              ) : (
                filteredSurfers.map((surfer) => {
                  const isMe = currentUser && Number(currentUser.id) === Number(surfer.userId);
                  const catTag = CATEGORY_TAGS[surfer.appCategory] || CATEGORY_TAGS.SYSTEM;

                  return (
                    <tr
                      key={surfer.userId}
                      onMouseEnter={() => setHoveredSurferId(surfer.userId)}
                      onMouseLeave={() => setHoveredSurferId(null)}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isMe ? '#f0f9ff' : (hoveredSurferId === surfer.userId ? '#f8fafc' : '#ffffff'),
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* Rank & Movement */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              fontFamily: "'JetBrains Mono', monospace",
                              color: surfer.rank === 1 ? '#d97706' : (surfer.rank === 2 ? '#475569' : (surfer.rank === 3 ? '#b45309' : '#0f172a')),
                            }}
                          >
                            #{surfer.rank}
                          </span>
                          {/* Rank Delta indicator */}
                          <div style={{ fontSize: 10, fontWeight: 700, marginTop: 2 }}>
                            {surfer.rankDelta > 0 ? (
                              <span style={{ color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                                <TrendingUp size={10} /> +{surfer.rankDelta}
                              </span>
                            ) : surfer.rankDelta < 0 ? (
                              <span style={{ color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                                <TrendingDown size={10} /> {surfer.rankDelta}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* User Info */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: '50%',
                              background: '#0f172a',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              fontWeight: 700,
                              border: isMe ? '2px solid #0284c7' : '1px solid #cbd5e1',
                              position: 'relative',
                            }}
                          >
                            {initialsFromName(surfer.name)}
                            <span
                              style={{
                                position: 'absolute',
                                bottom: -1,
                                right: -1,
                                width: 9,
                                height: 9,
                                borderRadius: '50%',
                                background: surfer.activityState === 'ACTIVE' ? '#16a34a' : (surfer.activityState === 'IDLE' ? '#f59e0b' : '#94a3b8'),
                                border: '2px solid #ffffff',
                              }}
                            />
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 700, color: '#0f172a' }}>
                                {surfer.name}
                              </span>
                              {surfer.isVerified && <VerifiedBadge size={13} />}
                              {isMe && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    background: '#0284c7',
                                    color: '#ffffff',
                                    padding: '1px 6px',
                                    borderRadius: 3,
                                  }}
                                >
                                  BẠN
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                              {surfer.jobTitle} · {surfer.department}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Team */}
                      <td style={{ padding: '12px 16px', color: '#475569', fontWeight: 500 }}>
                        {surfer.teamName}
                      </td>

                      {/* State & App */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              color: surfer.activityState === 'ACTIVE' ? '#15803d' : (surfer.activityState === 'IDLE' ? '#b45309' : '#64748b'),
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: surfer.activityState === 'ACTIVE' ? '#16a34a' : (surfer.activityState === 'IDLE' ? '#f59e0b' : '#94a3b8'),
                              }}
                            />
                            {surfer.activityState === 'ACTIVE' ? 'Đang Lướt Sóng' : (surfer.activityState === 'IDLE' ? 'Tạm Nghỉ' : 'Ngoại Tuyến')}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: catTag.color,
                              background: catTag.bg,
                              padding: '2px 6px',
                              borderRadius: 3,
                              width: 'fit-content',
                            }}
                          >
                            {catTag.label}
                          </span>
                        </div>
                      </td>

                      {/* Intensity bar */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 80 }}>
                          <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.round(surfer.intensity * 100)}%`,
                                height: '100%',
                                background: surfer.activityState === 'ACTIVE' ? 'linear-gradient(90deg, #10b981, #0284c7)' : '#f59e0b',
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>
                            {Math.round(surfer.intensity * 100)}%
                          </span>
                        </div>
                      </td>

                      {/* Working Time */}
                      <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", color: '#0f172a' }}>
                        {formatDuration(surfer.activeSecondsToday)}
                      </td>

                      {/* Activity Score */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#059669', fontFamily: "'JetBrains Mono', monospace" }}>
                          {surfer.score.toLocaleString()}
                        </span>
                        <span style={{ fontSize: 11, color: '#64748b', marginLeft: 4 }}>pts</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
