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
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
      <div className={`h-1 mt-4 rounded-full bg-gradient-to-r ${colors[color] || colors.blue}`} />
    </div>
  );
}
