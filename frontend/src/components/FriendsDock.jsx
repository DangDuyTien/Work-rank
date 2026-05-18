import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Eye, MessageCircle, Search, UserCheck, UserPlus, Users, X } from 'lucide-react';
import VerifiedBadge from './VerifiedBadge';
import { useAuth } from '../context/AuthContext';
import { friends as friendsApi, users as usersApi } from '../services/api';
import { getUserAvatar, initialsFromName } from '../utils/avatar';
import usePageVisibility from '../hooks/usePageVisibility';

const STATUS_META = {
  active: { label: 'Active', color: '#16a34a', dot: '#22c55e' },
  online: { label: 'Online', color: '#38bdf8', dot: '#38bdf8' },
  idle: { label: 'Tạm nghỉ', color: '#ca8a04', dot: '#eab308' },
  offline: { label: 'Offline', color: '#94a3b8', dot: '#94a3b8' },
};

function userIdOf(user = {}) {
  return String(user.id || user.user_id || user.userId || '');
}

function isVerified(user = {}) {
  return user.isVerified === true || user.verified === true || user.isVerified === 1 || user.verified === 1 || user.isVerified === '1' || user.verified === '1';
}

function statusMeta(status) {
  return STATUS_META[String(status || 'offline').toLowerCase()] || STATUS_META.offline;
}

function patchFriendshipRows(rows, patchUser) {
  let changed = false;
  const next = rows.map((row) => {
    const patchedFriend = patchUser(row.friend);
    if (patchedFriend === row.friend) return row;
    changed = true;
    return { ...row, friend: patchedFriend };
  });
  return changed ? next : rows;
}

function patchUserRows(rows, patchUser) {
  let changed = false;
  const next = rows.map((row) => {
    const patched = patchUser(row);
    if (patched === row) return row;
    changed = true;
    return patched;
  });
  return changed ? next : rows;
}

function Avatar({ user }) {
  const avatar = getUserAvatar(user, userIdOf(user));
  const meta = statusMeta(user.presence || user.status);
  return (
    <div className="friends-dock-avatar">
      {avatar ? (
        <img src={avatar} alt={`Ảnh ${user.name || user.email || 'User'}`} />
      ) : (
        <span>{initialsFromName(user.name || user.email || 'U')}</span>
      )}
      <i style={{ background: meta.dot }} />
    </div>
  );
}

function CompactUser({ user, detail, action, onOpen }) {
  return (
    <div className="friends-dock-user">
      <button type="button" className="friends-dock-user-main" onClick={() => onOpen(user)}>
        <Avatar user={user} />
        <span>
          <strong>
            {user.name || user.email || `User #${userIdOf(user)}`}
            {isVerified(user) && <VerifiedBadge size={13} />}
          </strong>
          <em>{detail}</em>
        </span>
      </button>
      {action}
    </div>
  );
}

export default function FriendsDock() {
  const { user: authUser, socket } = useAuth();
  const navigate = useNavigate();
  const pageVisible = usePageVisibility();
  const [open, setOpen] = useState(() => localStorage.getItem('workrank:friends-dock-open') !== '0');
  const [friendRows, setFriendRows] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');
  const searchRequestRef = useRef(0);

  const loadData = useCallback(async () => {
    setError('');
    const [friendRes, requestRes] = await Promise.allSettled([
      friendsApi.list(),
      friendsApi.requests(),
    ]);

    if (friendRes.status === 'fulfilled') setFriendRows(friendRes.value.data || []);
    else setError(friendRes.reason?.response?.data?.message || 'Chưa tải được danh sách bạn bè.');

    if (requestRes.status === 'fulfilled') {
      setIncoming(requestRes.value.data?.incoming || []);
      setOutgoing(requestRes.value.data?.outgoing || []);
    } else {
      setError(requestRes.reason?.response?.data?.message || 'Chưa tải được lời mời kết bạn.');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    localStorage.setItem('workrank:friends-dock-open', open ? '1' : '0');
  }, [open]);

  useEffect(() => {
    if (!socket || !pageVisible) return undefined;
    const updatePresence = (payload = {}) => {
      const targetId = String(payload.userId || payload.user_id || payload.id || '');
      if (!targetId) return;
      const nextStatus = payload.presence || payload.presenceStatus || payload.status || 'online';
      const patchUser = (itemUser = {}) => (
        userIdOf(itemUser) === targetId
          ? { ...itemUser, status: nextStatus, presence: nextStatus, presenceStatus: nextStatus, lastSeenAt: payload.lastSeenAt || itemUser.lastSeenAt }
          : itemUser
      );
      setFriendRows((rows) => patchFriendshipRows(rows, patchUser));
      setIncoming((rows) => patchFriendshipRows(rows, patchUser));
      setOutgoing((rows) => patchFriendshipRows(rows, patchUser));
      setSearchResults((rows) => patchUserRows(rows, patchUser));
    };
    socket.on('user:status:update', updatePresence);
    return () => socket.off('user:status:update', updatePresence);
  }, [socket, pageVisible]);

  const connectionMaps = useMemo(() => {
    const friends = new Set(friendRows.map((row) => userIdOf(row.friend)));
    const incomingByUser = new Map(incoming.map((row) => [userIdOf(row.friend), row]));
    const outgoingByUser = new Map(outgoing.map((row) => [userIdOf(row.friend), row]));
    return { friends, incomingByUser, outgoingByUser };
  }, [friendRows, incoming, outgoing]);

  const visibleFriends = useMemo(() => [...friendRows].sort((a, b) => {
    const aOnline = ['active', 'online', 'idle'].includes(String(a.friend?.presence || a.friend?.status || '').toLowerCase()) ? 1 : 0;
    const bOnline = ['active', 'online', 'idle'].includes(String(b.friend?.presence || b.friend?.status || '').toLowerCase()) ? 1 : 0;
    return bOnline - aOnline || String(a.friend?.name || '').localeCompare(String(b.friend?.name || ''));
  }).slice(0, 12), [friendRows]);

  useEffect(() => {
    const needle = query.trim().toLowerCase();
    searchRequestRef.current += 1;
    const requestId = searchRequestRef.current;

    if (!needle || !open || !pageVisible) {
      setSearchResults([]);
      setSearchLoading(false);
      return undefined;
    }

    let cancelled = false;
    setSearchLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await usersApi.list({ search: needle, limit: 8, withCount: false, withProfile: false });
        if (cancelled || requestId !== searchRequestRef.current) return;
        setSearchResults((res.data || [])
          .filter((item) => userIdOf(item) && userIdOf(item) !== String(authUser?.id || ''))
          .filter((item) => String(item.accountStatus || 'active') === 'active')
          .slice(0, 7));
      } catch (err) {
        if (!cancelled && requestId === searchRequestRef.current) {
          setError(err.response?.data?.message || 'Không tìm kiếm được người dùng.');
        }
      } finally {
        if (!cancelled && requestId === searchRequestRef.current) setSearchLoading(false);
      }
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [authUser?.id, open, pageVisible, query]);

  const openProfile = (targetUser) => {
    const targetId = userIdOf(targetUser);
    if (targetId) navigate(`/users/${targetId}`);
  };

  const sendRequest = async (targetUser) => {
    const targetId = userIdOf(targetUser);
    setBusyKey(`send:${targetId}`);
    setError('');
    try {
      await friendsApi.sendRequest(targetId);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Không gửi được lời mời kết bạn.');
    } finally {
      setBusyKey('');
    }
  };

  const acceptRequest = async (request) => {
    setBusyKey(`accept:${request.friendshipId}`);
    setError('');
    try {
      await friendsApi.accept(request.friendshipId);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Không chấp nhận được lời mời.');
    } finally {
      setBusyKey('');
    }
  };

  const declineRequest = async (request) => {
    setBusyKey(`decline:${request.friendshipId}`);
    setError('');
    try {
      await friendsApi.decline(request.friendshipId);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Không từ chối được lời mời.');
    } finally {
      setBusyKey('');
    }
  };

  const stateFor = (targetUser) => {
    const targetId = userIdOf(targetUser);
    if (connectionMaps.friends.has(targetId)) return 'friend';
    if (connectionMaps.incomingByUser.has(targetId)) return 'incoming';
    if (connectionMaps.outgoingByUser.has(targetId)) return 'outgoing';
    return 'none';
  };

  return (
    <aside className={open ? 'friends-dock is-open' : 'friends-dock'}>
      <button type="button" className="friends-dock-tab" onClick={() => setOpen((value) => !value)} aria-label="Mở danh sách bạn bè">
        <Users size={18} />
        {incoming.length > 0 && <b>{incoming.length}</b>}
      </button>

      <div className="friends-dock-panel">
        <div className="friends-dock-head">
          <div>
            <strong>Bạn bè</strong>
            <span>{friendRows.length ? `${friendRows.length} kết nối` : 'Tìm người để kết bạn'}</span>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Thu gọn bạn bè">
            <ChevronRight size={17} />
          </button>
        </div>

        <label className="friends-dock-search">
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, email, WR-0001..." />
        </label>

        {error && <div className="friends-dock-error">{error}</div>}

        {query.trim() ? (
          <div className="friends-dock-section">
            <div className="friends-dock-section-title">Kết quả tìm kiếm</div>
            {searchLoading ? (
              <div className="friends-dock-empty">Đang tìm người dùng...</div>
            ) : searchResults.length === 0 ? (
              <div className="friends-dock-empty">Không tìm thấy người dùng.</div>
            ) : searchResults.map((item) => {
              const state = stateFor(item);
              const incomingRequest = connectionMaps.incomingByUser.get(userIdOf(item));
              const disabled = state === 'friend' || state === 'outgoing' || busyKey === `send:${userIdOf(item)}`;
              return (
                <CompactUser
                  key={userIdOf(item)}
                  user={item}
                  detail={item.email || `WR-${String(item.id || '').padStart(4, '0')}`}
                  onOpen={openProfile}
                  action={(
                    <button
                      type="button"
                      className={state === 'friend' ? 'friends-dock-icon-action is-done' : 'friends-dock-icon-action'}
                      disabled={disabled}
                      onClick={() => state === 'incoming' && incomingRequest ? acceptRequest(incomingRequest) : sendRequest(item)}
                      aria-label={state === 'incoming' ? 'Chấp nhận' : 'Kết bạn'}
                    >
                      {state === 'friend' ? <UserCheck size={14} /> : state === 'incoming' ? <Check size={14} /> : <UserPlus size={14} />}
                    </button>
                  )}
                />
              );
            })}
          </div>
        ) : (
          <>
            {incoming.length > 0 && (
              <div className="friends-dock-section">
                <div className="friends-dock-section-title">Lời mời</div>
                {incoming.slice(0, 4).map((row) => (
                  <CompactUser
                    key={row.friendshipId}
                    user={row.friend}
                    detail="Muốn kết bạn"
                    onOpen={openProfile}
                    action={(
                      <span className="friends-dock-request-actions">
                        <button type="button" disabled={busyKey === `accept:${row.friendshipId}`} onClick={() => acceptRequest(row)} aria-label="Nhận lời mời">
                          <Check size={13} />
                        </button>
                        <button type="button" disabled={busyKey === `decline:${row.friendshipId}`} onClick={() => declineRequest(row)} aria-label="Từ chối">
                          <X size={13} />
                        </button>
                      </span>
                    )}
                  />
                ))}
              </div>
            )}

            <div className="friends-dock-section">
              <div className="friends-dock-section-title">Đang hoạt động</div>
              {visibleFriends.length === 0 ? (
                <div className="friends-dock-empty">Chưa có bạn bè. Dùng ô tìm kiếm phía trên để kết bạn.</div>
              ) : visibleFriends.map((row) => {
                const meta = statusMeta(row.friend?.presence || row.friend?.status);
                return (
                  <CompactUser
                    key={row.friendshipId}
                    user={row.friend}
                    detail={meta.label}
                    onOpen={openProfile}
                    action={(
                      <button type="button" className="friends-dock-icon-action" onClick={() => openProfile(row.friend)} aria-label="Mở hồ sơ">
                        <Eye size={14} />
                      </button>
                    )}
                  />
                );
              })}
            </div>
          </>
        )}

        <button type="button" className="friends-dock-full" onClick={() => navigate('/friends')}>
          <MessageCircle size={14} />
          Mở trang bạn bè
        </button>
      </div>
    </aside>
  );
}
