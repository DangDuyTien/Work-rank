import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function StatsCard({ label, value, color }) {
  const colors = {
    green: 'from-green-500 to-emerald-600',
    blue: 'from-blue-500 to-blue-600',
    yellow: 'from-yellow-500 to-amber-600',
    purple: 'from-purple-500 to-violet-600',
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
      <p className="mb-1 text-sm font-medium text-slate-500">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
      <div className={`h-1 mt-4 rounded-full bg-gradient-to-r ${colors[color] || colors.blue}`} />
    </div>
  );
}
