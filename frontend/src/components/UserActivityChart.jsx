import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

export default function UserActivityChart({ chartData, chartTickInterval }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="gk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0891b2" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#0891b2" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.04)" vertical={false} />
        <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} interval={chartTickInterval} minTickGap={28} />
        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
        <Tooltip
          contentStyle={{ background: '#f8fafc', border: '1px solid rgba(15,23,42,0.12)', borderRadius: 0, fontSize: 12, color: '#1e293b' }}
          cursor={{ stroke: 'rgba(15,23,42,0.1)', strokeWidth: 1 }}
        />
        <Area type="monotone" dataKey="keystrokes" stroke="#0891b2" strokeWidth={2} fill="url(#gk)" name="Gõ phím" dot={false} />
        <Area type="monotone" dataKey="clicks" stroke="#f59e0b" strokeWidth={2} fill="url(#gc)" name="Clicks" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
