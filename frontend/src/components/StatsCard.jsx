import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function StatsCard({ label, value, color }) {
  const colors = {
    green: 'green-500',
    blue: 'sky-400',
    yellow: 'yellow-500',
    purple: 'violet-500',
  };

  return (
    <div className="border border-slate-200 bg-white p-6 text-slate-900">
      <p className="mb-1 text-sm font-medium text-slate-500">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
      <div className={`h-1 mt-4 bg-${colors[color] || 'sky-400'}`} />
    </div>
  );
}
