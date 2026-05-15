import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getStoredAvatar, initialsFromName } from '../utils/avatar';

const statusColors = {
  active: 'bg-green-500',
  online: 'bg-blue-500',
  idle: 'bg-yellow-500',
  offline: 'bg-gray-500',
};

export default function UserRow({ user, formatDuration, showRank }) {
  const navigate = useNavigate();
  const status = user.status || 'offline';
  const userId = user.user_id || user.id;
  const avatarUrl = getStoredAvatar(userId);

  return (
    <tr className="cursor-pointer border-b border-slate-200 hover:bg-slate-50" onClick={() => navigate(`/users/${user.user_id}`)}>
      <td className="px-6 py-4 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-sm font-bold text-white">
          {avatarUrl ? (
            <img src={avatarUrl} alt={`Ảnh đại diện ${user.name || `User #${userId}`}`} className="h-full w-full object-cover" />
          ) : initialsFromName(user.name || `User #${userId}`)}
        </div>
        <span className="font-medium text-slate-900">{user.name}</span>
      </td>
      <td className="px-6 py-4">
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
          <span className="text-sm capitalize text-slate-600">{status}</span>
        </span>
      </td>
      <td className="px-6 py-4 text-right font-mono text-slate-800">{Number(user.keystrokes || user.total_keystrokes || 0).toLocaleString()}</td>
      <td className="px-6 py-4 text-right font-mono text-slate-800">{Number(user.mouse_clicks || user.total_mouse_clicks || 0).toLocaleString()}</td>
      <td className="px-6 py-4 text-right font-mono text-slate-800">{formatDuration(user.active_seconds || user.total_active_seconds || 0)}</td>
      <td className="px-6 py-4 text-right">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 font-bold text-blue-700">
          {user.score || 0}
        </span>
      </td>
    </tr>
  );
}
