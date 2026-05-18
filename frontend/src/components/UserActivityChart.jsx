import React from 'react';

const WIDTH = 720;
const HEIGHT = 220;
const PAD_X = 36;
const PAD_TOP = 18;
const PAD_BOTTOM = 34;

function safeNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pointFor(row, index, total, key, maxValue) {
  const innerWidth = WIDTH - PAD_X * 2;
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const x = PAD_X + (total <= 1 ? innerWidth / 2 : (index / (total - 1)) * innerWidth);
  const y = PAD_TOP + innerHeight - (safeNumber(row[key]) / maxValue) * innerHeight;
  return { x, y };
}

function linePath(rows, key, maxValue) {
  return rows.map((row, index) => {
    const point = pointFor(row, index, rows.length, key, maxValue);
    return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }).join(' ');
}

function areaPath(rows, key, maxValue) {
  if (!rows.length) return '';
  const line = linePath(rows, key, maxValue);
  const first = pointFor(rows[0], 0, rows.length, key, maxValue);
  const last = pointFor(rows[rows.length - 1], rows.length - 1, rows.length, key, maxValue);
  const baseY = HEIGHT - PAD_BOTTOM;
  return `${line} L${last.x.toFixed(1)} ${baseY} L${first.x.toFixed(1)} ${baseY} Z`;
}

function tickRows(rows, interval) {
  const step = Math.max(1, Number(interval || 1));
  return rows.filter((_, index) => index % step === 0 || index === rows.length - 1);
}

export default function UserActivityChart({ chartData = [], chartTickInterval = 1 }) {
  const rows = Array.isArray(chartData) ? chartData : [];
  const maxValue = Math.max(1, ...rows.flatMap((row) => [safeNumber(row.keystrokes), safeNumber(row.clicks)]));
  const yTicks = [0, Math.round(maxValue / 2), maxValue];

  if (!rows.length) {
    return <div className="profile-chart-loading">Chưa có dữ liệu biểu đồ hôm nay.</div>;
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="Biểu đồ hoạt động theo từng khung 15 phút"
      style={{ width: '100%', height: 220, display: 'block' }}
    >
      <defs>
        <linearGradient id="workrank-chart-keys" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0891b2" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#0891b2" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="workrank-chart-clicks" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((tick) => {
        const y = PAD_TOP + (HEIGHT - PAD_TOP - PAD_BOTTOM) - (tick / maxValue) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
        return (
          <g key={tick}>
            <line x1={PAD_X} x2={WIDTH - PAD_X} y1={y} y2={y} stroke="rgba(15,23,42,0.07)" strokeWidth="1" />
            <text x={PAD_X - 10} y={y + 4} textAnchor="end" fill="#64748b" fontSize="10" fontWeight="700">{tick.toLocaleString()}</text>
          </g>
        );
      })}

      <path d={areaPath(rows, 'keystrokes', maxValue)} fill="url(#workrank-chart-keys)" />
      <path d={areaPath(rows, 'clicks', maxValue)} fill="url(#workrank-chart-clicks)" />
      <path d={linePath(rows, 'keystrokes', maxValue)} fill="none" stroke="#0891b2" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d={linePath(rows, 'clicks', maxValue)} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {rows.map((row, index) => {
        const keys = safeNumber(row.keystrokes);
        const clicks = safeNumber(row.clicks);
        if (!keys && !clicks) return null;
        const point = pointFor(row, index, rows.length, keys >= clicks ? 'keystrokes' : 'clicks', maxValue);
        return (
          <circle key={`${row.time}-${index}`} cx={point.x} cy={point.y} r="3" fill={keys >= clicks ? '#0891b2' : '#f59e0b'}>
            <title>{`${row.time}: ${keys.toLocaleString()} gõ, ${clicks.toLocaleString()} click`}</title>
          </circle>
        );
      })}

      {tickRows(rows, chartTickInterval).map((row, index) => {
        const sourceIndex = rows.indexOf(row);
        const point = pointFor(row, sourceIndex, rows.length, 'keystrokes', maxValue);
        return (
          <text key={`${row.time}-${index}`} x={point.x} y={HEIGHT - 12} textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="700">
            {row.time}
          </text>
        );
      })}
    </svg>
  );
}
