import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Eye, Users, Calendar } from 'lucide-react';

const WIDTH = 760;
const HEIGHT = 240;
const PAD_X = 52;
const PAD_TOP = 24;
const PAD_BOTTOM = 38;

function safeNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatChartNumber(n) {
  if (n >= 1000000000) return (n / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toLocaleString();
}

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dateStr;
}

export default function YouTubeTrendChart({
  data = [],
  period = '30d',
  onPeriodChange = null,
  title = 'Biểu đồ tăng trưởng lịch sử',
  metricKey = 'views', // 'views' | 'subscribers'
  onMetricChange = null,
  showControls = true,
}) {
  const [activeMetric, setActiveMetric] = useState(metricKey);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const selectedMetric = onMetricChange ? metricKey : activeMetric;

  const rows = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map((d) => ({
      date: d.date || '',
      views: safeNumber(d.views),
      subscribers: safeNumber(d.subscribers),
    }));
  }, [data]);

  const metricLabel = selectedMetric === 'views' ? 'Lượt xem (Views)' : 'Người đăng ký (Subscribers)';
  const metricColor = selectedMetric === 'views' ? '#b45309' : '#047857'; // Amber vs Emerald
  const gradientId = selectedMetric === 'views' ? 'chart-amber-grad' : 'chart-emerald-grad';

  const maxValue = useMemo(() => {
    if (!rows.length) return 1;
    const max = Math.max(...rows.map((r) => r[selectedMetric]));
    return max > 0 ? max : 1;
  }, [rows, selectedMetric]);

  const minValue = useMemo(() => {
    if (!rows.length) return 0;
    const min = Math.min(...rows.map((r) => r[selectedMetric]));
    return min >= 0 ? min : 0;
  }, [rows, selectedMetric]);

  const valueRange = Math.max(1, maxValue - minValue);

  const points = useMemo(() => {
    const innerWidth = WIDTH - PAD_X * 2;
    const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
    const total = rows.length;

    return rows.map((row, idx) => {
      const x = PAD_X + (total <= 1 ? innerWidth / 2 : (idx / (total - 1)) * innerWidth);
      const val = row[selectedMetric];
      // Normalize between minValue and maxValue for readable scale
      const normalized = (val - minValue) / valueRange;
      const y = PAD_TOP + innerHeight - normalized * innerHeight;
      return { x, y, row, index: idx };
    });
  }, [rows, selectedMetric, minValue, valueRange]);

  const pathLine = useMemo(() => {
    if (points.length === 0) return '';
    return points.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }, [points]);

  const pathArea = useMemo(() => {
    if (points.length === 0) return '';
    const baseY = HEIGHT - PAD_BOTTOM;
    const first = points[0];
    const last = points[points.length - 1];
    return `${pathLine} L${last.x.toFixed(1)} ${baseY} L${first.x.toFixed(1)} ${baseY} Z`;
  }, [points, pathLine]);

  // Y-axis grid ticks
  const yTicks = useMemo(() => {
    return [
      { val: minValue, label: formatChartNumber(minValue) },
      { val: minValue + valueRange / 2, label: formatChartNumber(Math.round(minValue + valueRange / 2)) },
      { val: maxValue, label: formatChartNumber(maxValue) },
    ];
  }, [minValue, valueRange, maxValue]);

  // X-axis label samples (up to 6 dates)
  const xLabels = useMemo(() => {
    if (points.length <= 1) return points;
    const step = Math.max(1, Math.floor(points.length / 5));
    const labels = [];
    for (let i = 0; i < points.length; i += step) {
      labels.push(points[i]);
    }
    if (labels[labels.length - 1].index !== points.length - 1) {
      labels.push(points[points.length - 1]);
    }
    return labels;
  }, [points]);

  // Calculate delta over the period
  const deltaSummary = useMemo(() => {
    if (rows.length < 2) return null;
    const startVal = rows[0][selectedMetric];
    const endVal = rows[rows.length - 1][selectedMetric];
    const diff = endVal - startVal;
    const pct = startVal > 0 ? ((diff / startVal) * 100).toFixed(1) : null;
    return { diff, pct, isPositive: diff >= 0 };
  }, [rows, selectedMetric]);

  const PERIODS = [
    { key: '7d', label: '7 Ngày' },
    { key: '30d', label: '30 Ngày' },
    { key: '90d', label: '90 Ngày' },
    { key: '12m', label: '12 Tháng' },
  ];

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '18px 20px', borderRadius: 0 }}>
      {/* Chart Topline Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{title}</span>
            {deltaSummary && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 12,
                  fontWeight: 600,
                  color: deltaSummary.isPositive ? '#047857' : '#b91c1c',
                  background: deltaSummary.isPositive ? '#ecfdf5' : '#fef2f2',
                  padding: '2px 7px',
                }}
              >
                {deltaSummary.isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                <span>
                  {deltaSummary.diff >= 0 ? '+' : ''}{formatChartNumber(deltaSummary.diff)}
                  {deltaSummary.pct !== null ? ` (${deltaSummary.isPositive ? '+' : ''}${deltaSummary.pct}%)` : ''}
                </span>
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Đang hiển thị {metricLabel} theo thời gian thực
          </div>
        </div>

        {/* Controls: Metric Tabs + Period Selector */}
        {showControls && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Metric Switcher */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: 2 }}>
              <button
                type="button"
                onClick={() => {
                  if (onMetricChange) onMetricChange('views');
                  else setActiveMetric('views');
                }}
                style={{
                  padding: '5px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: selectedMetric === 'views' ? '#ffffff' : 'transparent',
                  color: selectedMetric === 'views' ? '#0f172a' : '#64748b',
                  boxShadow: selectedMetric === 'views' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Eye size={12} />
                <span>Views</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onMetricChange) onMetricChange('subscribers');
                  else setActiveMetric('subscribers');
                }}
                style={{
                  padding: '5px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: selectedMetric === 'subscribers' ? '#ffffff' : 'transparent',
                  color: selectedMetric === 'subscribers' ? '#0f172a' : '#64748b',
                  boxShadow: selectedMetric === 'subscribers' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Users size={12} />
                <span>Subs</span>
              </button>
            </div>

            {/* Period Selector */}
            {onPeriodChange && (
              <div style={{ display: 'flex', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => onPeriodChange(p.key)}
                    style={{
                      padding: '4px 9px',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      borderRight: '1px solid #e2e8f0',
                      background: period === p.key ? '#0f172a' : '#ffffff',
                      color: period === p.key ? '#ffffff' : '#475569',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Empty State vs SVG Graphic */}
      {rows.length === 0 ? (
        <div
          style={{
            height: HEIGHT,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fafafa',
            border: '1px dashed #cbd5e1',
            color: '#64748b',
            fontSize: 13,
            gap: 6,
          }}
        >
          <Calendar size={22} color="#94a3b8" />
          <span>Chưa đủ dữ liệu lịch sử để vẽ biểu đồ</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Dữ liệu sẽ hiển thị khi hệ thống ghi nhận snapshot theo chu kỳ</span>
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label={`${title} - ${metricLabel}`}
            style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 260 }}
          >
            <defs>
              <linearGradient id="chart-amber-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#b45309" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#b45309" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="chart-emerald-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#047857" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#047857" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {yTicks.map((t, idx) => {
              const y = PAD_TOP + (HEIGHT - PAD_TOP - PAD_BOTTOM) - ((t.val - minValue) / valueRange) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
              return (
                <g key={idx}>
                  <line
                    x1={PAD_X}
                    x2={WIDTH - PAD_X}
                    y1={y}
                    y2={y}
                    stroke="rgba(15,23,42,0.08)"
                    strokeWidth="1"
                    strokeDasharray={idx === 1 ? '4 4' : 'none'}
                  />
                  <text
                    x={PAD_X - 10}
                    y={y + 3}
                    textAnchor="end"
                    fill="#64748b"
                    fontSize="10"
                    fontFamily="'JetBrains Mono', monospace"
                    fontWeight="600"
                  >
                    {t.label}
                  </text>
                </g>
              );
            })}

            {/* Filled Area */}
            {pathArea && <path d={pathArea} fill={`url(#${gradientId})`} />}

            {/* Stroke Line */}
            {pathLine && (
              <path
                d={pathLine}
                fill="none"
                stroke={metricColor}
                strokeWidth="2.4"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* Data Points */}
            {points.map((p, idx) => (
              <g
                key={idx}
                onMouseEnter={() => setHoveredPoint(p)}
                onMouseLeave={() => setHoveredPoint(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hoveredPoint?.index === idx ? 5 : points.length > 30 ? 2 : 3.5}
                  fill={hoveredPoint?.index === idx ? '#0f172a' : metricColor}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <title>{`${p.row.date}: ${p.row[selectedMetric].toLocaleString()} ${selectedMetric === 'views' ? 'views' : 'subs'}`}</title>
              </g>
            ))}

            {/* X-axis Date Labels */}
            {xLabels.map((lbl, idx) => (
              <text
                key={idx}
                x={lbl.x}
                y={HEIGHT - 12}
                textAnchor={idx === 0 ? 'start' : idx === xLabels.length - 1 ? 'end' : 'middle'}
                fill="#64748b"
                fontSize="10"
                fontFamily="'JetBrains Mono', monospace"
              >
                {formatDateLabel(lbl.row.date)}
              </text>
            ))}
          </svg>

          {/* Interactive Tooltip on hover */}
          {hoveredPoint && (
            <div
              style={{
                position: 'absolute',
                top: Math.max(8, hoveredPoint.y - 48),
                left: Math.min(WIDTH - 140, Math.max(10, hoveredPoint.x - 60)),
                background: '#0f172a',
                color: '#ffffff',
                padding: '4px 8px',
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                pointerEvents: 'none',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                zIndex: 10,
                whiteSpace: 'nowrap',
              }}
            >
              <div>{hoveredPoint.row.date}</div>
              <div style={{ fontWeight: 700, color: '#fde68a' }}>
                {hoveredPoint.row[selectedMetric].toLocaleString()} {selectedMetric}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
