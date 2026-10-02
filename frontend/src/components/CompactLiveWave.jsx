import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TrendingUp, Activity, Zap, Clock, ShieldCheck, ArrowUp } from 'lucide-react';

const WIDTH = 760;
const HEIGHT = 220;
const PAD_LEFT = 52;
const PAD_RIGHT = 32;
const PAD_TOP = 24;
const PAD_BOTTOM = 36;

function formatNumber(n) {
  const num = Number(n) || 0;
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return num.toLocaleString();
}

function formatFullTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatShortTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export default function CompactLiveWave({
  rankings = [],
  liveSnapshot = null,
  currentUser = null,
  embedded = false,
}) {
  const [historyPoints, setHistoryPoints] = useState([]);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [rankJumpNotice, setRankJumpNotice] = useState(null);

  const prevRankRef = useRef(null);
  const jumpTimerRef = useRef(null);

  // Extract current user info & current score
  const myId = currentUser ? Number(currentUser.id || currentUser.userId) : null;

  const currentSummary = useMemo(() => {
    if (!Array.isArray(rankings) || rankings.length === 0) {
      return { score: 0, rank: null, name: currentUser?.name || 'Bạn', clicks: 0, keys: 0 };
    }
    const found = myId
      ? rankings.find((r) => Number(r.userId || r.user?.id || r.id) === myId)
      : rankings[0];

    if (found) {
      return {
        score: Number(found.activityScore ?? found.score ?? 0),
        rank: found.rank ? Number(found.rank) : null,
        name: found.user?.fullName || found.user?.name || found.name || 'Bạn',
        clicks: Number(found.mouseClicks || 0),
        keys: Number(found.keyboardCount || 0),
      };
    }
    return { score: 0, rank: null, name: currentUser?.name || 'Bạn', clicks: 0, keys: 0 };
  }, [rankings, myId, currentUser]);

  // Track rank jumps & notify cleanly
  useEffect(() => {
    if (currentSummary.rank && prevRankRef.current !== null) {
      if (currentSummary.rank < prevRankRef.current) {
        // Climbed UP
        const delta = prevRankRef.current - currentSummary.rank;
        setRankJumpNotice({
          newRank: currentSummary.rank,
          oldRank: prevRankRef.current,
          delta,
          time: new Date().toLocaleTimeString('vi-VN'),
        });

        if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
        jumpTimerRef.current = setTimeout(() => {
          setRankJumpNotice(null);
        }, 4500);
      }
    }
    if (currentSummary.rank) {
      prevRankRef.current = currentSummary.rank;
    }
  }, [currentSummary.rank]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
    };
  }, []);

  // Ingest Real-time Tick into the Rolling History Buffer
  useEffect(() => {
    const now = Date.now();
    const curScore = currentSummary.score;
    const curRank = currentSummary.rank;

    setHistoryPoints((prev) => {
      // If history is empty, populate initial baseline ramp so chart is rich from the start
      if (prev.length === 0) {
        const initial = [];
        const baseScore = Math.max(0, curScore - 8);
        for (let i = 8; i >= 0; i--) {
          const t = now - i * 15000; // 15s intervals back
          const stepScore = Math.round(baseScore + ((curScore - baseScore) * (8 - i)) / 8);
          initial.push({
            timestamp: t,
            score: stepScore,
            rank: curRank,
            timeStr: formatFullTime(t),
            shortTime: formatShortTime(t),
          });
        }
        return initial;
      }

      const last = prev[prev.length - 1];
      // Only append if at least 1.5s has passed or score changed
      if (now - last.timestamp < 1500 && last.score === curScore) {
        return prev;
      }

      const newPoint = {
        timestamp: now,
        score: curScore,
        rank: curRank,
        timeStr: formatFullTime(now),
        shortTime: formatShortTime(now),
      };

      const updated = [...prev, newPoint];
      // Keep up to 35 rolling points (~5-10 minutes window)
      if (updated.length > 35) {
        return updated.slice(updated.length - 35);
      }
      return updated;
    });
  }, [currentSummary.score, currentSummary.rank, liveSnapshot]);

  // Compute Scaled Coordinates, Gridlines, Ticks & Curve Path
  const { points, linePath, areaPath, yTicks, xTicks, minScore, maxScore } = useMemo(() => {
    if (historyPoints.length === 0) {
      return {
        points: [],
        linePath: '',
        areaPath: '',
        yTicks: [],
        xTicks: [],
        minScore: 0,
        maxScore: 100,
      };
    }

    const innerWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
    const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
    const total = historyPoints.length;

    const scores = historyPoints.map((p) => p.score);
    const rawMax = Math.max(...scores);
    const rawMin = Math.min(...scores);

    // Compute nice human-readable Y-axis boundaries
    let computedMax = Math.max(10, Math.ceil(rawMax * 1.15));
    if (computedMax < 50) computedMax = 50;
    const computedMin = 0; // Always anchor at 0 for accurate relative perception
    const range = Math.max(1, computedMax - computedMin);

    // Coordinate mapping
    const pts = historyPoints.map((p, idx) => {
      const x = PAD_LEFT + (total <= 1 ? innerWidth / 2 : (idx / (total - 1)) * innerWidth);
      const normalized = (p.score - computedMin) / range;
      const y = PAD_TOP + innerHeight - normalized * innerHeight;
      return {
        ...p,
        x,
        y,
        index: idx,
      };
    });

    // Construct smooth Cubic Bézier line
    let line = '';
    if (pts.length > 0) {
      line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        const cpX = (prev.x + curr.x) / 2;
        line += ` C ${cpX.toFixed(1)} ${prev.y.toFixed(1)}, ${cpX.toFixed(1)} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
      }
    }

    // Construct shaded area path below the line
    let area = '';
    if (pts.length > 0 && line) {
      const baseY = HEIGHT - PAD_BOTTOM;
      const first = pts[0];
      const last = pts[pts.length - 1];
      area = `${line} L ${last.x.toFixed(1)} ${baseY} L ${first.x.toFixed(1)} ${baseY} Z`;
    }

    // Y-axis 4 ticks
    const tickSteps = 4;
    const yTickList = [];
    for (let i = 0; i <= tickSteps; i++) {
      const val = Math.round(computedMin + (range * i) / tickSteps);
      const y = PAD_TOP + innerHeight - (i / tickSteps) * innerHeight;
      yTickList.push({ val, label: formatNumber(val), y });
    }

    // X-axis 5 sample timestamps
    const xTickList = [];
    if (pts.length > 1) {
      const step = Math.max(1, Math.floor((pts.length - 1) / 4));
      for (let i = 0; i < pts.length; i += step) {
        xTickList.push(pts[i]);
      }
      if (xTickList[xTickList.length - 1].index !== pts.length - 1) {
        xTickList.push(pts[pts.length - 1]);
      }
    } else if (pts.length === 1) {
      xTickList.push(pts[0]);
    }

    return {
      points: pts,
      linePath: line,
      areaPath: area,
      yTicks: yTickList,
      xTicks: xTickList,
      minScore: computedMin,
      maxScore: computedMax,
    };
  }, [historyPoints]);

  const latestPoint = points.length > 0 ? points[points.length - 1] : null;

  return (
    <div
      style={
        embedded
          ? {
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 0,
              padding: '16px 18px 14px',
              position: 'relative',
              marginTop: 14,
            }
          : {
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              padding: '18px 20px 16px',
              position: 'relative',
            }
      }
    >
      {/* ── HEADER: TITLE, STATS SUMMARY & LIVE PULSE ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
              Biểu đồ độ năng động theo thời gian
            </span>

            {/* Rank jump indicator */}
            {rankJumpNotice && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#15803d',
                  background: '#dcfce7',
                  border: '1px solid #86efac',
                  padding: '2px 8px',
                  borderRadius: 4,
                  animation: 'pulse 1.5s infinite',
                }}
              >
                <ArrowUp size={12} />
                <span>
                  Đã tăng lên hạng #{rankJumpNotice.newRank} (+{rankJumpNotice.delta} bậc)
                </span>
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Nhịp độ tích lũy điểm PTS và thao tác của bạn trong phiên làm việc
          </div>
        </div>

        {/* Top Right Controls & Live Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              color: '#047857',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              padding: '4px 10px',
              borderRadius: 4,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 6px #10b981',
                display: 'inline-block',
              }}
            />
            <span>LIVE REALTIME</span>
          </div>
        </div>
      </div>

      {/* ── MAIN SVG LINE CHART ── */}
      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="Realtime Activity Points Chart"
          style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 240 }}
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            {/* Emerald Gradient for shaded area below the line */}
            <linearGradient id="activity-emerald-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.22" />
              <stop offset="85%" stopColor="#059669" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.00" />
            </linearGradient>

            {/* Filter for glowing point */}
            <filter id="glow-emerald" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 1. Horizontal Gridlines & Y-Axis Labels */}
          {yTicks.map((tick, idx) => (
            <g key={`ytick-${idx}`}>
              <line
                x1={PAD_LEFT}
                y1={tick.y}
                x2={WIDTH - PAD_RIGHT}
                y2={tick.y}
                stroke="#f1f5f9"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={PAD_LEFT - 8}
                y={tick.y + 4}
                textAnchor="end"
                fontSize="10"
                fontWeight="500"
                fill="#94a3b8"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Bottom baseline axis line */}
          <line
            x1={PAD_LEFT}
            y1={HEIGHT - PAD_BOTTOM}
            x2={WIDTH - PAD_RIGHT}
            y2={HEIGHT - PAD_BOTTOM}
            stroke="#e2e8f0"
            strokeWidth="1.2"
          />

          {/* 2. Shaded Area Under Curve */}
          {areaPath && (
            <path
              d={areaPath}
              fill="url(#activity-emerald-gradient)"
              style={{ transition: 'all 0.3s ease-out' }}
            />
          )}

          {/* 3. Main Trend Line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#059669"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transition: 'all 0.3s ease-out' }}
            />
          )}

          {/* 4. Interactive Hover Vertical Crosshair */}
          {hoveredPoint && (
            <g>
              <line
                x1={hoveredPoint.x}
                y1={PAD_TOP}
                x2={hoveredPoint.x}
                y2={HEIGHT - PAD_BOTTOM}
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="5"
                fill="#059669"
                stroke="#ffffff"
                strokeWidth="2.5"
                filter="url(#glow-emerald)"
              />
            </g>
          )}

          {/* 5. Latest Active Point Highlight */}
          {latestPoint && !hoveredPoint && (
            <g>
              <circle
                cx={latestPoint.x}
                cy={latestPoint.y}
                r="7"
                fill="#10b981"
                opacity="0.25"
                style={{ animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite' }}
              />
              <circle
                cx={latestPoint.x}
                cy={latestPoint.y}
                r="4.5"
                fill="#059669"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}

          {/* 6. X-Axis Time Labels */}
          {xTicks.map((tick, idx) => (
            <g key={`xtick-${idx}`}>
              <line
                x1={tick.x}
                y1={HEIGHT - PAD_BOTTOM}
                x2={tick.x}
                y2={HEIGHT - PAD_BOTTOM + 4}
                stroke="#cbd5e1"
                strokeWidth="1"
              />
              <text
                x={tick.x}
                y={HEIGHT - PAD_BOTTOM + 16}
                textAnchor="middle"
                fontSize="10"
                fontWeight="500"
                fill="#64748b"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {tick.shortTime || formatShortTime(tick.timestamp)}
              </text>
            </g>
          ))}

          {/* 7. Transparent Hover Target Overlay Rectangles */}
          {points.map((p, idx) => {
            const stepWidth = (WIDTH - PAD_LEFT - PAD_RIGHT) / Math.max(1, points.length);
            const targetX = p.x - stepWidth / 2;
            return (
              <rect
                key={`hover-target-${idx}`}
                x={Math.max(PAD_LEFT, targetX)}
                y={PAD_TOP}
                width={stepWidth}
                height={HEIGHT - PAD_TOP - PAD_BOTTOM}
                fill="transparent"
                style={{ cursor: 'crosshair' }}
                onMouseEnter={() => setHoveredPoint(p)}
              />
            );
          })}
        </svg>

        {/* ── TOOLTIP POPOVER (CLEAN & MINIMALIST) ── */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(
                WIDTH - 140,
                Math.max(10, (hoveredPoint.x / WIDTH) * 100 + (hoveredPoint.x > WIDTH / 2 ? -18 : 2))
              ) + '%',
              top: Math.max(10, (hoveredPoint.y / HEIGHT) * 100 - 24) + '%',
              background: '#0f172a',
              color: '#ffffff',
              borderRadius: 4,
              padding: '6px 10px',
              fontSize: 11,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              pointerEvents: 'none',
              zIndex: 10,
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ color: '#94a3b8', fontSize: 10, marginBottom: 2 }}>
              {hoveredPoint.timeStr || formatFullTime(hoveredPoint.timestamp)}
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#34d399' }}>
              {hoveredPoint.score.toLocaleString()} <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>pts</span>
            </div>
            {hoveredPoint.rank && (
              <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 2 }}>
                Vị trí: #{hoveredPoint.rank} hôm nay
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── BOTTOM METRICS BAR (CLEAN & SUBTLE) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          marginTop: 10,
          paddingTop: 8,
          borderTop: '1px solid #f1f5f9',
          fontSize: 11,
          color: '#64748b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span>
            Điểm hiện tại: <strong style={{ color: '#059669' }}>{currentSummary.score.toLocaleString()} pts</strong>
          </span>
          <span>
            Thứ hạng: <strong style={{ color: '#0f172a' }}>{currentSummary.rank ? `#${currentSummary.rank}` : '—'}</strong>
          </span>
          {currentSummary.clicks > 0 || currentSummary.keys > 0 ? (
            <span>
              Thao tác: <strong>{currentSummary.clicks.toLocaleString()} click • {currentSummary.keys.toLocaleString()} phím</strong>
            </span>
          ) : null}
        </div>

        <div style={{ fontSize: 10, color: '#94a3b8' }}>
          Tự động cập nhật theo thời gian thực (~1s)
        </div>
      </div>
    </div>
  );
}

export { CompactLiveWave };
