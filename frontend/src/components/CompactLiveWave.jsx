import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TrendingUp, Activity, Zap, ArrowUp, ArrowDown } from 'lucide-react';

const WIDTH = 760;
const HEIGHT = 160;
const PAD_LEFT = 38;
const PAD_RIGHT = 68;
const PAD_TOP = 20;
const PAD_BOTTOM = 24;

const LINE_COLORS = [
  '#f59e0b', // Amber / Gold (Top 1)
  '#64748b', // Slate / Silver (Top 2)
  '#d97706', // Bronze (Top 3)
  '#10b981', // Emerald (Top 4)
  '#0284c7', // Sky Blue (Top 5)
  '#8b5cf6', // Violet
];

function fmtNum(n) {
  return (Number(n) || 0).toLocaleString();
}

function getShortName(fullName = '') {
  if (!fullName) return 'Thành viên';
  const parts = String(fullName).trim().split(/\s+/);
  if (parts.length <= 2) return fullName;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export default function CompactLiveWave({
  rankings = [],
  liveSnapshot = null,
  currentUser = null,
  onSelectUser = null,
}) {
  const [historySlices, setHistorySlices] = useState([]);
  const [latestOvertake, setLatestOvertake] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const prevRanksRef = useRef(new Map());
  const overtakeTimeoutRef = useRef(null);

  // 1. Ingest real-time snapshot / ranking update (~1s tick)
  useEffect(() => {
    if (!rankings || rankings.length === 0) return;

    const now = Date.now();
    const timeStr = new Date(now).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Build current rank map
    const currentRanks = new Map();
    const currentScoreMap = new Map();
    const nameMap = new Map();

    rankings.forEach((item, idx) => {
      const uid = Number(item.userId || item.user?.id || item.id);
      const rank = Number(item.rank) || idx + 1;
      const score = Number(item.activityScore ?? item.score ?? 0);
      const name = item.user?.fullName || item.user?.name || item.fullName || item.name || `User #${uid}`;

      currentRanks.set(uid, rank);
      currentScoreMap.set(uid, score);
      nameMap.set(uid, name);
    });

    // Detect overtake events compared to previous tick
    const prevRanks = prevRanksRef.current;
    if (prevRanks.size > 0) {
      let detectedOvertake = null;

      for (const [uid, newRank] of currentRanks.entries()) {
        const oldRank = prevRanks.get(uid);
        if (oldRank !== undefined && newRank < oldRank) {
          // User climbed UP in ranks!
          const delta = oldRank - newRank;
          const climberName = nameMap.get(uid);

          // Find who they overtook (the user who was previously at newRank)
          let passedName = null;
          for (const [otherUid, otherOldRank] of prevRanks.entries()) {
            if (otherUid !== uid && otherOldRank === newRank) {
              passedName = nameMap.get(otherUid);
              break;
            }
          }

          detectedOvertake = {
            id: `${uid}-${now}`,
            climberId: uid,
            climberName: getShortName(climberName),
            fullClimberName: climberName,
            passedName: passedName ? getShortName(passedName) : null,
            newRank,
            oldRank,
            delta,
            time: timeStr,
          };
          break; // Keep the primary overtake
        }
      }

      if (detectedOvertake) {
        setLatestOvertake(detectedOvertake);
        if (overtakeTimeoutRef.current) clearTimeout(overtakeTimeoutRef.current);
        overtakeTimeoutRef.current = setTimeout(() => {
          setLatestOvertake(null);
        }, 4500);
      }
    }

    // Update prevRanks reference
    prevRanksRef.current = new Map(currentRanks);

    // Append to rolling history buffer (keep last 25 slices)
    setHistorySlices((prev) => {
      const slice = {
        timestamp: now,
        timeStr,
        ranks: currentRanks,
        scores: currentScoreMap,
      };

      const updated = [...prev, slice];
      if (updated.length > 25) {
        return updated.slice(updated.length - 25);
      }
      return updated;
    });
  }, [rankings, liveSnapshot]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (overtakeTimeoutRef.current) clearTimeout(overtakeTimeoutRef.current);
    };
  }, []);

  // 2. Select top contenders to track (Top 4-5 contenders + Current User if outside top 5)
  const contenders = useMemo(() => {
    if (!rankings || rankings.length === 0) return [];

    const topList = rankings.slice(0, 5);
    const myId = currentUser ? Number(currentUser.id) : null;
    const isMeInTop = topList.some((item) => Number(item.userId || item.user?.id || item.id) === myId);

    if (myId && !isMeInTop) {
      const myItem = rankings.find((item) => Number(item.userId || item.user?.id || item.id) === myId);
      if (myItem) {
        topList.push(myItem);
      }
    }

    return topList.map((item, idx) => {
      const uid = Number(item.userId || item.user?.id || item.id);
      const isMe = uid === myId;
      return {
        userId: uid,
        name: item.user?.fullName || item.user?.name || item.name || `User #${uid}`,
        shortName: getShortName(item.user?.fullName || item.user?.name || item.name),
        currentRank: Number(item.rank) || idx + 1,
        score: Number(item.activityScore ?? item.score ?? 0),
        color: isMe ? '#0284c7' : LINE_COLORS[idx % LINE_COLORS.length],
        isMe,
      };
    });
  }, [rankings, currentUser]);

  // 3. Compute SVG coordinate paths & milestone points
  const { contenderPaths, milestonePoints, minRankScale, maxRankScale } = useMemo(() => {
    if (historySlices.length === 0 || contenders.length === 0) {
      return { contenderPaths: [], milestonePoints: [], minRankScale: 1, maxRankScale: 5 };
    }

    const innerWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
    const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
    const sliceCount = historySlices.length;

    // Determine rank range to scale Y axis gracefully (Rank 1 at top, max rank at bottom)
    let maxRankObserved = 5;
    historySlices.forEach((slice) => {
      contenders.forEach((c) => {
        const r = slice.ranks.get(c.userId);
        if (r && r > maxRankObserved) maxRankObserved = r;
      });
    });
    const maxRank = Math.min(15, Math.max(5, maxRankObserved + 1));
    const minRank = 1;
    const rankRange = maxRank - minRank || 1;

    const getY = (rank) => {
      const normalized = (rank - minRank) / rankRange; // 0 for rank 1, 1 for max rank
      return PAD_TOP + normalized * innerHeight; // Top is rank 1
    };

    const getX = (sliceIdx) => {
      if (sliceCount <= 1) return PAD_LEFT + innerWidth / 2;
      return PAD_LEFT + (sliceIdx / (sliceCount - 1)) * innerWidth;
    };

    const paths = [];
    const milestones = [];

    contenders.forEach((contender) => {
      const points = [];
      let prevSliceRank = null;

      historySlices.forEach((slice, idx) => {
        const rank = slice.ranks.get(contender.userId) ?? contender.currentRank;
        const score = slice.scores.get(contender.userId) ?? contender.score;
        const x = getX(idx);
        const y = getY(rank);

        // Check if rank jumped at this step
        let delta = 0;
        if (prevSliceRank !== null && rank !== prevSliceRank) {
          delta = prevSliceRank - rank; // positive means jumped up
          milestones.push({
            userId: contender.userId,
            name: contender.name,
            shortName: contender.shortName,
            color: contender.color,
            x,
            y,
            rank,
            score,
            delta,
            time: slice.timeStr,
            isMe: contender.isMe,
          });
        }
        prevSliceRank = rank;

        points.push({ x, y, rank, score, time: slice.timeStr });
      });

      if (points.length > 0) {
        // Construct smooth curve path
        let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
        for (let i = 1; i < points.length; i++) {
          const prev = points[i - 1];
          const curr = points[i];
          const cpx = (prev.x + curr.x) / 2;
          d += ` C ${cpx.toFixed(1)} ${prev.y.toFixed(1)}, ${cpx.toFixed(1)} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
        }

        const lastPoint = points[points.length - 1];

        paths.push({
          contender,
          d,
          points,
          lastPoint,
        });
      }
    });

    return {
      contenderPaths: paths,
      milestonePoints: milestones,
      minRankScale: minRank,
      maxRankScale: maxRank,
    };
  }, [historySlices, contenders]);

  // Active status count from liveSnapshot or rankings
  const activeCount = useMemo(() => {
    if (liveSnapshot && typeof liveSnapshot.activeSurfers === 'number') {
      return liveSnapshot.activeSurfers;
    }
    return (rankings || []).filter((r) => r.activeSecondsToday > 0 || r.activityScore > 0).length;
  }, [liveSnapshot, rankings]);

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid rgba(15,23,42,0.08)',
        borderRadius: 6,
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        padding: '14px 18px 12px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── HEADER: TITLE, OVERTAKE TICKER & LIVE BADGE ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 4,
              background: 'rgba(5, 150, 105, 0.08)',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TrendingUp size={15} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                Chuyển Động Thứ Hạng Realtime (Live Wave)
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#059669',
                  background: 'rgba(5, 150, 105, 0.08)',
                  padding: '1px 6px',
                  borderRadius: 3,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: '#059669',
                    boxShadow: '0 0 0 2px rgba(5,150,105,0.25)',
                  }}
                />
                LIVE ~1s
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
              Biểu đồ trực tiếp vị trí đua top & sự kiện vượt hạng toàn hệ thống
            </div>
          </div>

          {/* OVERTAKE / VƯỢT HẠNG SUBTLE RIBBON */}
          {latestOvertake && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                fontWeight: 600,
                color: '#059669',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                padding: '3px 9px',
                borderRadius: 12,
                marginLeft: 10,
                animation: 'fadeIn 0.25s ease-out',
              }}
            >
              <Zap size={12} color="#059669" />
              <span>
                {latestOvertake.climberName}{' '}
                {latestOvertake.passedName
                  ? `vừa vượt ${latestOvertake.passedName}`
                  : `vừa tăng +${latestOvertake.delta} bậc`}{' '}
                (#{latestOvertake.newRank})
              </span>
            </div>
          )}
        </div>

        {/* Right Info: Online count & Time Window */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#64748b' }}>
          <span>
            <strong style={{ color: '#0f172a' }}>{activeCount}</strong> thành viên đang hoạt động
          </span>
          <span style={{ color: '#cbd5e1' }}>•</span>
          <span>Rolling 25s</span>
        </div>
      </div>

      {/* ── CHART SVG: COMPACT LINE & WAVE TRAJECTORIES ── */}
      <div style={{ position: 'relative', width: '100%', height: 160 }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ width: '100%', height: '100%', overflow: 'visible', display: 'block' }}
        >
          {/* Subtle Horizontal Grid lines for Ranks */}
          {[1, 3, 5, 8, 10].map((r) => {
            if (r > maxRankScale) return null;
            const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
            const normalized = (r - minRankScale) / (maxRankScale - minRankScale || 1);
            const y = PAD_TOP + normalized * innerHeight;
            return (
              <g key={r}>
                <line
                  x1={PAD_LEFT}
                  y1={y}
                  x2={WIDTH - PAD_RIGHT}
                  y2={y}
                  stroke="rgba(15, 23, 42, 0.06)"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={PAD_LEFT - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9.5"
                  fontWeight="600"
                  fontFamily="'JetBrains Mono', monospace"
                  fill="#94a3b8"
                >
                  #{r}
                </text>
              </g>
            );
          })}

          {/* Render Contender Trajectory Lines */}
          {contenderPaths.map(({ contender, d, lastPoint }) => (
            <g key={contender.userId}>
              {/* Path Line */}
              <path
                d={d}
                fill="none"
                stroke={contender.color}
                strokeWidth={contender.isMe ? 2.8 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={contender.isMe ? 1 : 0.85}
              />

              {/* End Point Dot */}
              {lastPoint && (
                <circle
                  cx={lastPoint.x}
                  cy={lastPoint.y}
                  r={contender.isMe ? 4 : 3}
                  fill={contender.color}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              )}

              {/* End Point Label on Right Margin */}
              {lastPoint && (
                <text
                  x={lastPoint.x + 8}
                  y={lastPoint.y + 3.5}
                  fontSize="9.5"
                  fontWeight="600"
                  fill={contender.color}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelectUser && onSelectUser(contender)}
                >
                  #{lastPoint.rank} {contender.shortName}
                </text>
              )}
            </g>
          ))}

          {/* CRUCIAL REQUIREMENT: ONLY RENDER MEMBER LABELS AT KEY MOVEMENT MILESTONES */}
          {milestonePoints.map((m, idx) => (
            <g
              key={`${m.userId}-${idx}`}
              transform={`translate(${m.x}, ${m.y})`}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectUser && onSelectUser(m)}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredPoint({
                  name: m.name,
                  rank: m.rank,
                  score: m.score,
                  delta: m.delta,
                  time: m.time,
                  x: m.x,
                  y: m.y - 10,
                });
              }}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              {/* Milestone Pulse Circle */}
              <circle
                r="5"
                fill={m.delta > 0 ? '#10b981' : '#ef4444'}
                stroke="#ffffff"
                strokeWidth="1.5"
              />

              {/* Subtle Milestone Label Tag */}
              <g transform="translate(0, -14)">
                <rect
                  x="-32"
                  y="-9"
                  width="64"
                  height="16"
                  rx="3"
                  fill="#0f172a"
                  fillOpacity="0.88"
                />
                <text
                  x="0"
                  y="2.5"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="9"
                  fontWeight="600"
                >
                  {m.shortName} {m.delta > 0 ? `↑${m.delta}` : `↓${Math.abs(m.delta)}`}
                </text>
              </g>
            </g>
          ))}

          {/* Invisible interactive hover points along the lines */}
          {contenderPaths.map(({ contender, points }) =>
            points.map((p, i) => (
              <circle
                key={`${contender.userId}-${i}`}
                cx={p.x}
                cy={p.y}
                r="7"
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() =>
                  setHoveredPoint({
                    name: contender.name,
                    rank: p.rank,
                    score: p.score,
                    delta: 0,
                    time: p.time,
                    x: p.x,
                    y: p.y,
                  })
                }
                onMouseLeave={() => setHoveredPoint(null)}
              />
            ))
          )}
        </svg>

        {/* ── CLEAN INTERACTIVE TOOLTIP ── */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              left: Math.max(10, Math.min(WIDTH - 140, hoveredPoint.x)),
              top: Math.max(0, hoveredPoint.y - 48),
              background: '#0f172a',
              color: '#ffffff',
              padding: '6px 10px',
              borderRadius: 4,
              fontSize: 11,
              boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
              pointerEvents: 'none',
              zIndex: 20,
              whiteSpace: 'nowrap',
              transform: 'translateX(-50%)',
            }}
          >
            <div style={{ fontSize: 9.5, color: '#94a3b8' }}>{hoveredPoint.time}</div>
            <div style={{ fontWeight: 700, color: '#ffffff', marginTop: 1 }}>{hoveredPoint.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 10.5 }}>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>Hạng #{hoveredPoint.rank}</span>
              <span style={{ color: '#475569' }}>•</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>{fmtNum(hoveredPoint.score)} pts</span>
              {hoveredPoint.delta !== 0 && (
                <span style={{ color: hoveredPoint.delta > 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>
                  {hoveredPoint.delta > 0 ? `+${hoveredPoint.delta}` : hoveredPoint.delta} bậc
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
