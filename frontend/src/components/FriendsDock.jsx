import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ChevronRight, Eye, MessageCircle, Search, Send, UserPlus, Users, X } from 'lucide-react';
import VerifiedBadge from './VerifiedBadge';
import { useAuth } from '../context/AuthContext';
import { chats as chatsApi, friends as friendsApi, users as usersApi } from '../services/api';
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

function chatMessageKey(message = {}) {
  return String(message.id || message.clientMessageId || `${message.senderId || ''}:${message.createdAt || ''}`);
}

function mergeChatMessages(current = [], incoming = []) {
  const byKey = new Map();
  [...current, ...incoming].forEach((message) => {
    const key = chatMessageKey(message);
    if (!key) return;
    const previous = byKey.get(key);
    byKey.set(key, { ...(previous || {}), ...message });
  });
  return [...byKey.values()].sort((a, b) => {
    const idDelta = Number(a.id || 0) - Number(b.id || 0);
    if (Number.isFinite(idDelta) && idDelta !== 0) return idDelta;
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
  });
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
  const [activeChatUser, setActiveChatUser] = useState(null);
  const [messagesByUser, setMessagesByUser] = useState({});
  const [chatMetaByUser, setChatMetaByUser] = useState({});
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [typingByUser, setTypingByUser] = useState({});
  const searchRequestRef = useRef(0);
  const chatScrollRef = useRef(null);
  const skipNextChatScrollRef = useRef(false);
  const typingTimersRef = useRef({});
  const typingLastSentRef = useRef(0);
  const typingStopTimerRef = useRef(null);

  const activeChatUserId = activeChatUser ? userIdOf(activeChatUser) : '';
  const activeChatMessages = activeChatUserId ? (messagesByUser[activeChatUserId] || []) : [];
  const activeChatMeta = activeChatUserId ? (chatMetaByUser[activeChatUserId] || {}) : {};
  const unreadTotal = useMemo(
    () => Object.values(unreadCounts).reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0),
    [unreadCounts]
  );

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

  const loadUnreadCounts = useCallback(async () => {
    try {
      const res = await chatsApi.unreadCounts();
      setUnreadCounts(res.data || {});
    } catch {
      setUnreadCounts({});
    }
  }, []);

  const patchChatMeta = useCallback((targetId, patch) => {
    setChatMetaByUser((prev) => ({
      ...prev,
      [targetId]: { ...(prev[targetId] || {}), ...(typeof patch === 'function' ? patch(prev[targetId] || {}) : patch) },
    }));
  }, []);

  const loadChatMessages = useCallback(async (targetId, { older = false } = {}) => {
    if (!targetId) return;
    const currentMeta = chatMetaByUser[targetId] || {};
    if (older && (!currentMeta.hasMore || currentMeta.loadingMore)) return;
    if (older) skipNextChatScrollRef.current = true;
    patchChatMeta(targetId, older ? { loadingMore: true, error: '' } : { loading: true, error: '' });
    try {
      const res = await chatsApi.messages(targetId, {
        limit: 36,
        beforeId: older ? currentMeta.nextBeforeId : null,
      });
      setMessagesByUser((prev) => ({
        ...prev,
        [targetId]: mergeChatMessages(older ? (res.data || []) : [], older ? (prev[targetId] || []) : (res.data || [])),
      }));
      patchChatMeta(targetId, {
        loading: false,
        loadingMore: false,
        loaded: true,
        hasMore: Boolean(res.pagination?.hasMore),
        nextBeforeId: res.pagination?.nextBeforeId || null,
      });
    } catch (err) {
      patchChatMeta(targetId, {
        loading: false,
        loadingMore: false,
        error: err.response?.data?.message || 'Không tải được tin nhắn.',
      });
    }
  }, [chatMetaByUser, patchChatMeta]);

  const markConversationRead = useCallback((targetId) => {
    if (!targetId) return;
    setUnreadCounts((prev) => ({ ...prev, [targetId]: 0 }));
    if (socket?.connected) {
      socket.emit('chat:read', { friendId: targetId });
    } else {
      chatsApi.markRead(targetId).catch(() => {});
    }
  }, [socket]);

  const openChat = useCallback((targetUser) => {
    const targetId = userIdOf(targetUser);
    if (!targetId) return;
    setActiveChatUser(targetUser);
    setQuery('');
    setError('');
    setChatInput('');
    markConversationRead(targetId);
    const meta = chatMetaByUser[targetId] || {};
    if (!meta.loaded && !meta.loading) {
      void loadChatMessages(targetId);
    }
  }, [chatMetaByUser, loadChatMessages, markConversationRead]);

  useEffect(() => {
    loadData();
    loadUnreadCounts();
  }, [loadData, loadUnreadCounts]);

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
      setActiveChatUser((current) => (current && userIdOf(current) === targetId ? patchUser(current) : current));
    };
    socket.on('user:status:update', updatePresence);
    return () => socket.off('user:status:update', updatePresence);
  }, [socket, pageVisible]);

  useEffect(() => {
    if (!socket || !pageVisible) return undefined;

    const handleMessage = (payload = {}) => {
      const message = chatsApi.normalizeMessage(payload);
      const authId = String(authUser?.id || '');
      const senderId = String(message.senderId || '');
      const receiverId = String(message.receiverId || '');
      const otherId = senderId === authId ? receiverId : senderId;
      if (!otherId) return;

      setMessagesByUser((prev) => ({
        ...prev,
        [otherId]: mergeChatMessages(prev[otherId] || [], [message]),
      }));

      if (senderId !== authId) {
        if (activeChatUserId === otherId) {
          markConversationRead(otherId);
        } else {
          setUnreadCounts((prev) => ({ ...prev, [otherId]: Math.max(0, Number(prev[otherId] || 0)) + 1 }));
        }
      }
    };

    const handleRead = (payload = {}) => {
      const readerId = String(payload.readerId || '');
      if (!readerId) return;
      setMessagesByUser((prev) => {
        const rows = prev[readerId] || [];
        if (!rows.length) return prev;
        return {
          ...prev,
          [readerId]: rows.map((message) => (
            String(message.senderId || '') === String(authUser?.id || '')
              ? { ...message, readAt: message.readAt || payload.readAt || new Date().toISOString() }
              : message
          )),
        };
      });
    };

    const handleTyping = (payload = {}) => {
      const fromId = String(payload.fromUserId || '');
      if (!fromId) return;
      window.clearTimeout(typingTimersRef.current[fromId]);
      setTypingByUser((prev) => ({ ...prev, [fromId]: payload.isTyping !== false }));
      if (payload.isTyping !== false) {
        typingTimersRef.current[fromId] = window.setTimeout(() => {
          setTypingByUser((prev) => ({ ...prev, [fromId]: false }));
        }, 2600);
      }
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:read', handleRead);
    socket.on('chat:typing', handleTyping);
    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:read', handleRead);
      socket.off('chat:typing', handleTyping);
    };
  }, [activeChatUserId, authUser?.id, markConversationRead, pageVisible, socket]);

  useEffect(() => {
    if (!activeChatUserId || !chatScrollRef.current) return;
    if (skipNextChatScrollRef.current) {
      skipNextChatScrollRef.current = false;
      return;
    }
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [activeChatMessages.length, activeChatUserId, typingByUser]);

  useEffect(() => () => {
    Object.values(typingTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    window.clearTimeout(typingStopTimerRef.current);
  }, []);

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

  const emitTyping = (value) => {
    if (!socket?.connected || !activeChatUserId) return;
    socket.emit('chat:typing', { receiverId: activeChatUserId, isTyping: value });
  };

  const handleChatInput = (event) => {
    setChatInput(event.target.value);
    const now = Date.now();
    if (now - typingLastSentRef.current > 1400) {
      typingLastSentRef.current = now;
      emitTyping(true);
    }
    window.clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = window.setTimeout(() => emitTyping(false), 1800);
  };

  const handleChatKeyDown = (event) => {
    if (
      event.key !== 'Enter'
      || event.shiftKey
      || event.metaKey
      || event.ctrlKey
      || event.altKey
      || event.nativeEvent?.isComposing
    ) {
      return;
    }
    event.preventDefault();
    if (!chatInput.trim() || chatBusy) return;
    event.currentTarget.form?.requestSubmit();
  };

  const replaceOptimisticMessage = (targetId, clientMessageId, nextMessage) => {
    setMessagesByUser((prev) => ({
      ...prev,
      [targetId]: mergeChatMessages(
        (prev[targetId] || []).filter((message) => message.clientMessageId !== clientMessageId),
        [nextMessage],
      ),
    }));
  };

  const markOptimisticFailed = (targetId, clientMessageId, messageText) => {
    setMessagesByUser((prev) => ({
      ...prev,
      [targetId]: (prev[targetId] || []).map((message) => (
        message.clientMessageId === clientMessageId
          ? { ...message, pending: false, failed: true, error: messageText }
          : message
      )),
    }));
  };

  const sendChatMessage = async (event) => {
    event.preventDefault();
    const body = chatInput.trim();
    const targetId = activeChatUserId;
    if (!body || !targetId || chatBusy) return;

    const clientMessageId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const optimistic = {
      id: `local:${clientMessageId}`,
      senderId: authUser?.id,
      receiverId: targetId,
      body,
      clientMessageId,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setChatInput('');
    setChatBusy(true);
    setMessagesByUser((prev) => ({
      ...prev,
      [targetId]: mergeChatMessages(prev[targetId] || [], [optimistic]),
    }));
    emitTyping(false);

    const finish = (message) => {
      replaceOptimisticMessage(targetId, clientMessageId, { ...message, pending: false });
      setChatBusy(false);
    };
    const fail = (messageText) => {
      markOptimisticFailed(targetId, clientMessageId, messageText);
      setChatBusy(false);
    };

    if (socket?.connected) {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        fail('Mạng chậm, chưa gửi được.');
      }, 6500);
      socket.emit('chat:send', { receiverId: targetId, body, clientMessageId }, (ack = {}) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if (ack.ok && ack.message) finish(chatsApi.normalizeMessage(ack.message));
        else fail(ack.error || 'Không gửi được tin nhắn.');
      });
      return;
    }

    try {
      const res = await chatsApi.send(targetId, { body, clientMessageId });
      finish(res.data);
    } catch (err) {
      fail(err.response?.data?.message || 'Không gửi được tin nhắn.');
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
        {incoming.length + unreadTotal > 0 && <b>{incoming.length + unreadTotal}</b>}
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

        {activeChatUser ? (
          <div className="friends-chat">
            <div className="friends-chat-head">
              <button type="button" onClick={() => setActiveChatUser(null)} aria-label="Quay lại danh sách bạn bè">
                <ArrowLeft size={15} />
              </button>
              <Avatar user={activeChatUser} />
              <div>
                <strong>{activeChatUser.name || activeChatUser.email || `User #${activeChatUserId}`}</strong>
                <span>{typingByUser[activeChatUserId] ? 'Đang nhập...' : statusMeta(activeChatUser.presence || activeChatUser.status).label}</span>
              </div>
              <button type="button" onClick={() => openProfile(activeChatUser)} aria-label="Mở hồ sơ">
                <Eye size={15} />
              </button>
            </div>

            <div className="friends-chat-messages" ref={chatScrollRef}>
              {activeChatMeta.hasMore && (
                <button type="button" className="friends-chat-load" disabled={activeChatMeta.loadingMore} onClick={() => loadChatMessages(activeChatUserId, { older: true })}>
                  {activeChatMeta.loadingMore ? 'Đang tải...' : 'Tin cũ hơn'}
                </button>
              )}
              {activeChatMeta.loading ? (
                <div className="friends-chat-empty">Đang tải tin nhắn...</div>
              ) : activeChatMessages.length === 0 ? (
                <div className="friends-chat-empty">Chưa có tin nhắn. Bắt đầu bằng một câu ngắn.</div>
              ) : activeChatMessages.map((message) => {
                const mine = String(message.senderId || '') === String(authUser?.id || '');
                return (
                  <div key={chatMessageKey(message)} className={mine ? 'friends-chat-row is-mine' : 'friends-chat-row'}>
                    <div className={message.failed ? 'friends-chat-bubble is-failed' : 'friends-chat-bubble'}>
                      <p>{message.body}</p>
                      <span>
                        {new Date(message.createdAt || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        {message.pending ? ' · Đang gửi' : message.failed ? ` · ${message.error || 'Lỗi'}` : mine && message.readAt ? ' · Đã đọc' : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
              {typingByUser[activeChatUserId] && <div className="friends-chat-typing">Đang nhập...</div>}
              {activeChatMeta.error && <div className="friends-dock-error">{activeChatMeta.error}</div>}
            </div>

            <form className="friends-chat-compose" onSubmit={sendChatMessage}>
              <textarea
                value={chatInput}
                onChange={handleChatInput}
                onKeyDown={handleChatKeyDown}
                placeholder="Nhắn tin..."
                maxLength={2000}
                rows={1}
              />
              <button type="submit" disabled={!chatInput.trim() || chatBusy} aria-label="Gửi tin nhắn">
                <Send size={15} />
              </button>
            </form>
          </div>
        ) : (
          <>
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
                  const disabled = state === 'outgoing' || busyKey === `send:${userIdOf(item)}`;
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
                          onClick={() => {
                            if (state === 'friend') openChat(item);
                            else if (state === 'incoming' && incomingRequest) acceptRequest(incomingRequest);
                            else sendRequest(item);
                          }}
                          aria-label={state === 'friend' ? 'Nhắn tin' : state === 'incoming' ? 'Chấp nhận' : 'Kết bạn'}
                        >
                          {state === 'friend' ? <MessageCircle size={14} /> : state === 'incoming' ? <Check size={14} /> : <UserPlus size={14} />}
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
                    const friendId = userIdOf(row.friend);
                    const meta = statusMeta(row.friend?.presence || row.friend?.status);
                    const unread = Math.max(0, Number(unreadCounts[friendId] || 0));
                    return (
                      <CompactUser
                        key={row.friendshipId}
                        user={row.friend}
                        detail={unread ? `${unread} tin mới` : meta.label}
                        onOpen={openProfile}
                        action={(
                          <button type="button" className="friends-dock-icon-action has-chat" onClick={() => openChat(row.friend)} aria-label="Nhắn tin">
                            <MessageCircle size={14} />
                            {unread > 0 && <b>{unread > 9 ? '9+' : unread}</b>}
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
          </>
        )}
      </div>
    </aside>
  );
}
