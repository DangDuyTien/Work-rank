import React from 'react';
import { useNavigate } from 'react-router-dom';

const statusColors = {
  active: 'bg-green-500',
  online: 'bg-blue-500',
  idle: 'bg-yellow-500',
  offline: 'bg-gray-500',
};

export default function UserRow({ user, formatDuration, showRank }) {
  const navigate = useNavigate();
  const status = user.status || 'offline';

  return (
    <tr className="border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer" onClick={() => navigate(`/users/${user.user_id}`)}>
      <td className="px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-bold">
          {user.name?.charAt(0).toUpperCase()}
        </div>
        <span className="font-medium">{user.name}</span>
      </td>
      <td className="px-6 py-4">
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
          <span className="text-sm capitalize">{status}</span>
        </span>
      </td>
      <td className="px-6 py-4 text-right font-mono">{Number(user.keystrokes || user.total_keystrokes || 0).toLocaleString()}</td>
      <td className="px-6 py-4 text-right font-mono">{Number(user.mouse_clicks || user.total_mouse_clicks || 0).toLocaleString()}</td>
      <td className="px-6 py-4 text-right font-mono">{formatDuration(user.active_seconds || user.total_active_seconds || 0)}</td>
      <td className="px-6 py-4 text-right">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-600/20 text-primary-400 font-bold">
          {user.score || 0}
        </span>
      </td>
    </tr>
  );
}
