import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Clock3,
  Eye,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';
import { Card, EmptyState, PageState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useConfirm, useToast } from '../context/UiContext';
import { friends as friendsApi, users as usersApi } from '../services/api';
import { getUserAvatar, initialsFromName } from '../utils/avatar';

const STATUS_META = {
  active: { label: 'Đang hoạt động', color: '#16a34a', bg: 'rgba(22,163,74,0.1)', border: 'rgba(22,163,74,0.28)', dot: '#22c55e' },
  online: { label: 'Trực tuyến', color: '#2563eb', bg: 'rgba(37,99,235,0.1)', border: 'rgba(37,99,235,0.25)', dot: '#3b82f6' },
  idle: { label: 'Tạm nghỉ', color: '#ca8a04', bg: 'rgba(234,179,8,0.13)', border: 'rgba(234,179,8,0.3)', dot: '#eab308' },
  offline: { label: 'Ngoại tuyến', color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.22)', dot: '#94a3b8' },
};

const BUTTON_BASE = {
  minHeight: 34,
  borderRadius: 6,
  border: '1px solid transparent',
  padding: '0 12px',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 900,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  whiteSpace: 'nowrap',
};

function statusMeta(status) {
  return STATUS_META[String(status || 'offline').toLowerCase()] || STATUS_META.offline;
}

function userIdOf(user = {}) {
  return String(user.id || user.user_id || user.userId || '');
}

function isVerified(user = {}) {
  return user.isVerified === true || user.verified === true || user.isVerified === 1 || user.verified === 1 || user.isVerified === '1' || user.verified === '1';
}

function formatFriendCode(user = {}) {
  const id = user.id || user.user_id || user.userId || '';
  return `WR-${String(id).padStart(4, '0')}`;
}

function Avatar({ user, size = 42 }) {
  const avatar = getUserAvatar(user, userIdOf(user));
  const name = user.name || user.email || 'User';
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: 8,
      overflow: 'hidden',
      background: 'linear-gradient(135deg,#2563eb,#0891b2)',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: Math.max(12, Math.round(size * 0.32)),
      fontWeight: 900,
      flexShrink: 0,
      position: 'relative',
    }}>
      {avatar ? <img src={avatar} alt={`Ảnh ${name}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initialsFromName(name)}
    </div>
  );
}

function PresencePill({ status }) {
  const meta = statusMeta(status);
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      minHeight: 24,
      borderRadius: 999,
      border: `1px solid ${meta.border}`,
      background: meta.bg,
      color: meta.color,
      padding: '0 9px',
      fontSize: 11,
      fontWeight: 900,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.dot }} />
      {meta.label}
    </span>
  );
}

function UserIdentity({ user, subtitle, compact = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
      <Avatar user={user} size={compact ? 36 : 42} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
          <strong style={{ color: '#0f172a', fontSize: compact ? 13 : 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.name || user.email || `User #${userIdOf(user)}`}
          </strong>
          {isVerified(user) && <VerifiedBadge size={15} />}
        </div>
        <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 800, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {subtitle || `${formatFriendCode(user)} · ${user.email || 'Không có email'}`}
        </div>
      </div>
    </div>
  );
}

function FriendCard({ item, busy, onRemove, onOpen }) {
  const user = item.friend;
  return (
    <article style={{
      border: '1px solid rgba(15,23,42,0.08)',
      borderRadius: 8,
      padding: 14,
      display: 'grid',
      gap: 12,
      background: '#ffffff',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <UserIdentity user={user} />
        <PresencePill status={user.presence || user.status} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => onOpen(user)}
          style={{ ...BUTTON_BASE, borderColor: 'rgba(37,99,235,0.18)', background: 'rgba(37,99,235,0.08)', color: '#2563eb' }}
        >
          <Eye size={14} />
          Hồ sơ
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRemove(user)}
          style={{ ...BUTTON_BASE, borderColor: 'rgba(220,38,38,0.18)', background: '#ffffff', color: '#dc2626', opacity: busy ? 0.6 : 1 }}
        >
          <Trash2 size={14} />
          Xóa bạn
        </button>
      </div>
    </article>
  );
}

function RequestRow({ item, type, busy, onAccept, onDecline, onCancel, onOpen }) {
  const user = item.friend;
  return (
    <div style={{
      border: '1px solid rgba(15,23,42,0.08)',
      borderRadius: 8,
      padding: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      background: '#ffffff',
    }}>
      <UserIdentity
        user={user}
        compact
        subtitle={type === 'incoming' ? 'Muốn kết bạn với bạn' : 'Đang chờ phản hồi'}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => onOpen(user)}
          style={{ ...BUTTON_BASE, minHeight: 32, width: 34, padding: 0, borderColor: 'rgba(15,23,42,0.1)', background: '#ffffff', color: '#64748b' }}
          aria-label="Mở hồ sơ"
        >
          <Eye size={14} />
        </button>
        {type === 'incoming' ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAccept(item)}
              style={{ ...BUTTON_BASE, minHeight: 32, borderColor: 'rgba(22,163,74,0.22)', background: 'rgba(22,163,74,0.1)', color: '#16a34a', opacity: busy ? 0.6 : 1 }}
            >
              <Check size={14} />
              Nhận
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecline(item)}
              style={{ ...BUTTON_BASE, minHeight: 32, borderColor: 'rgba(220,38,38,0.18)', background: '#ffffff', color: '#dc2626', opacity: busy ? 0.6 : 1 }}
            >
              <X size={14} />
              Từ chối
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => onCancel(item)}
            style={{ ...BUTTON_BASE, minHeight: 32, borderColor: 'rgba(15,23,42,0.1)', background: '#ffffff', color: '#64748b', opacity: busy ? 0.6 : 1 }}
          >
            <X size={14} />
            Hủy
          </button>
        )}
      </div>
    </div>
  );
}

function SearchResult({ user, state, busy, onSend, onAcceptIncoming, onOpen }) {
  const disabled = busy || state === 'friend' || state === 'outgoing';
  const label = state === 'friend'
    ? 'Bạn bè'
    : state === 'outgoing'
      ? 'Đã gửi'
      : state === 'incoming'
        ? 'Chấp nhận'
        : 'Kết bạn';
  const Icon = state === 'friend' ? UserCheck : state === 'outgoing' ? Clock3 : state === 'incoming' ? Check : UserPlus;

  return (
    <div style={{
      border: '1px solid rgba(15,23,42,0.08)',
      borderRadius: 8,
      padding: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      background: '#ffffff',
    }}>
      <UserIdentity user={user} compact />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => onOpen(user)}
          style={{ ...BUTTON_BASE, minHeight: 32, width: 34, padding: 0, borderColor: 'rgba(15,23,42,0.1)', background: '#ffffff', color: '#64748b' }}
          aria-label="Mở hồ sơ"
        >
          <Eye size={14} />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => (state === 'incoming' ? onAcceptIncoming(user) : onSend(user))}
          style={{
            ...BUTTON_BASE,
            minHeight: 32,
            borderColor: disabled ? 'rgba(15,23,42,0.1)' : 'rgba(37,99,235,0.24)',
            background: disabled ? '#f8fafc' : '#2563eb',
            color: disabled ? '#94a3b8' : '#ffffff',
            opacity: busy ? 0.65 : 1,
          }}
        >
          <Icon size={14} />
          {label}
        </button>
      </div>
    </div>
  );
}

export default function Friends() {
  const { user, socket } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [friendRows, setFriendRows] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');

  const loadData = useCallback(async (options = {}) => {
    const background = options.background === true;
    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [friendRes, requestRes, userRes] = await Promise.all([
        friendsApi.list(),
        friendsApi.requests(),
        usersApi.list(),
      ]);
      setFriendRows(friendRes.data || []);
      setIncoming(requestRes.data?.incoming || []);
      setOutgoing(requestRes.data?.outgoing || []);
      setAllUsers(userRes.data || []);
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || 'Không tải được dữ liệu bạn bè';
      setError(message);
      toast(message, { type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!socket) return undefined;
    const updateUserPresence = (payload = {}) => {
      const targetId = String(payload.userId || payload.user_id || payload.id || '');
      if (!targetId) return;
      const nextStatus = payload.presence || payload.presenceStatus || payload.status || 'online';
      const patchUser = (itemUser = {}) => (
        userIdOf(itemUser) === targetId
          ? { ...itemUser, status: nextStatus, presence: nextStatus, presenceStatus: nextStatus, lastSeenAt: payload.lastSeenAt || itemUser.lastSeenAt }
          : itemUser
      );
      setFriendRows((rows) => rows.map((row) => ({ ...row, friend: patchUser(row.friend) })));
      setIncoming((rows) => rows.map((row) => ({ ...row, friend: patchUser(row.friend) })));
      setOutgoing((rows) => rows.map((row) => ({ ...row, friend: patchUser(row.friend) })));
      setAllUsers((rows) => rows.map(patchUser));
    };
    socket.on('user:status:update', updateUserPresence);
    return () => socket.off('user:status:update', updateUserPresence);
  }, [socket]);

  const connectionMaps = useMemo(() => {
    const friends = new Set(friendRows.map((row) => userIdOf(row.friend)));
    const incomingByUser = new Map(incoming.map((row) => [userIdOf(row.friend), row]));
    const outgoingByUser = new Map(outgoing.map((row) => [userIdOf(row.friend), row]));
    return { friends, incomingByUser, outgoingByUser };
  }, [friendRows, incoming, outgoing]);

  const onlineCount = useMemo(() => (
    friendRows.filter((row) => ['active', 'online', 'idle'].includes(String(row.friend?.presence || row.friend?.status || '').toLowerCase())).length
  ), [friendRows]);

  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allUsers
      .filter((item) => userIdOf(item) && userIdOf(item) !== String(user?.id || ''))
      .filter((item) => String(item.accountStatus || 'active') === 'active')
      .filter((item) => {
        if (!needle) return false;
        const haystack = `${item.name || ''} ${item.email || ''} ${formatFriendCode(item)}`.toLowerCase();
        return haystack.includes(needle);
      })
      .slice(0, 12);
  }, [allUsers, query, user?.id]);

  const openProfile = (targetUser) => {
    const targetId = userIdOf(targetUser);
    if (targetId) navigate(`/users/${targetId}`);
  };

  const runAction = async (key, action, successMessage) => {
    setBusyKey(key);
    try {
      await action();
      if (successMessage) toast(successMessage, { type: 'success' });
      await loadData({ background: true });
    } catch (err) {
      toast(err.response?.data?.message || err.response?.data?.error || 'Thao tác thất bại', { type: 'error' });
    } finally {
      setBusyKey('');
    }
  };

  const sendRequest = (targetUser) => {
    const targetId = userIdOf(targetUser);
    runAction(`send:${targetId}`, () => friendsApi.sendRequest(targetId), 'Đã gửi lời mời kết bạn.');
  };

  const acceptRequest = (request) => {
    runAction(`accept:${request.friendshipId}`, () => friendsApi.accept(request.friendshipId), 'Đã chấp nhận lời mời kết bạn.');
  };

  const acceptIncomingFromSearch = (targetUser) => {
    const request = connectionMaps.incomingByUser.get(userIdOf(targetUser));
    if (request) acceptRequest(request);
  };

  const declineRequest = (request) => {
    runAction(`decline:${request.friendshipId}`, () => friendsApi.decline(request.friendshipId), 'Đã từ chối lời mời.');
  };

  const cancelRequest = (request) => {
    runAction(`cancel:${request.friendshipId}`, () => friendsApi.cancel(request.friendshipId), 'Đã hủy lời mời.');
  };

  const removeFriend = async (targetUser) => {
    const ok = await confirm({
      title: 'Xóa khỏi bạn bè?',
      message: `${targetUser.name || targetUser.email || 'Người dùng này'} sẽ không còn nằm trong danh sách bạn bè của bạn.`,
      confirmText: 'Xóa bạn',
      tone: 'danger',
    });
    if (!ok) return;
    const targetId = userIdOf(targetUser);
    runAction(`remove:${targetId}`, () => friendsApi.remove(targetId), 'Đã xóa khỏi danh sách bạn bè.');
  };

  const connectionStateFor = (targetUser) => {
    const targetId = userIdOf(targetUser);
    if (connectionMaps.friends.has(targetId)) return 'friend';
    if (connectionMaps.incomingByUser.has(targetId)) return 'incoming';
    if (connectionMaps.outgoingByUser.has(targetId)) return 'outgoing';
    return 'none';
  };

  if (loading) {
    return <PageState type="loading" title="Đang tải danh sách bạn bè..." />;
  }

  if (error && !friendRows.length && !incoming.length && !outgoing.length) {
    return <PageState type="error" title="Không tải được bạn bè" description={error} onRetry={() => loadData()} />;
  }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gap: 16 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 860px) {
          .friends-main-grid { grid-template-columns: 1fr !important; }
          .friends-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 560px) {
          .friends-page-head { align-items: stretch !important; }
          .friends-stat-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <section
        className="friends-page-head"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>
            <Users size={14} />
            Kết nối cá nhân
          </div>
          <h1 style={{ margin: '10px 0 6px', color: '#0f172a', fontSize: 28, lineHeight: 1.1 }}>Bạn bè</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13, fontWeight: 700 }}>
            Theo dõi nhanh ai đang online, đang active hoặc đã offline.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadData({ background: true })}
          disabled={refreshing}
          style={{ ...BUTTON_BASE, background: '#ffffff', borderColor: 'rgba(15,23,42,0.1)', color: '#475569', opacity: refreshing ? 0.65 : 1 }}
        >
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          Làm mới
        </button>
      </section>

      <section className="friends-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        {[
          ['Bạn bè', friendRows.length, '#2563eb'],
          ['Đang online', onlineCount, '#16a34a'],
          ['Lời mời đến', incoming.length, '#d97706'],
          ['Đã gửi', outgoing.length, '#64748b'],
        ].map(([label, value, color]) => (
          <Card key={label} style={{ padding: 14, boxShadow: '0 10px 28px rgba(15,23,42,0.045)' }}>
            <div style={{ color: '#94a3b8', fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}>{label}</div>
            <strong style={{ display: 'block', color, fontSize: 24, marginTop: 4 }}>{Number(value).toLocaleString()}</strong>
          </Card>
        ))}
      </section>

      <div className="friends-main-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(330px, 0.95fr)', gap: 16, alignItems: 'start' }}>
        <Card style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: 0, color: '#0f172a', fontSize: 17, fontWeight: 900 }}>Danh sách bạn bè</h2>
              <div style={{ marginTop: 4, color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>
                {friendRows.length ? `${onlineCount}/${friendRows.length} người có tín hiệu hiện tại` : 'Chưa có bạn bè'}
              </div>
            </div>
          </div>

          {friendRows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Chưa có bạn bè"
              description="Tìm người dùng bằng tên, email hoặc mã WR để gửi lời mời kết bạn."
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {friendRows.map((row) => (
                <FriendCard
                  key={row.friendshipId}
                  item={row}
                  busy={busyKey === `remove:${userIdOf(row.friend)}`}
                  onRemove={removeFriend}
                  onOpen={openProfile}
                />
              ))}
            </div>
          )}
        </Card>

        <div style={{ display: 'grid', gap: 16 }}>
          <Card style={{ padding: 16 }}>
            <h2 style={{ margin: '0 0 12px', color: '#0f172a', fontSize: 17, fontWeight: 900 }}>Tìm và kết bạn</h2>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nhập tên, email hoặc WR-0001..."
                style={{ width: '100%', minHeight: 40, border: '1px solid rgba(15,23,42,0.1)', borderRadius: 6, padding: '0 12px 0 36px', outline: 'none', color: '#0f172a', fontSize: 13, fontWeight: 700 }}
              />
            </div>

            {!query.trim() ? (
              <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5, fontWeight: 700 }}>
                Gõ tên, email hoặc mã người dùng để gửi lời mời kết bạn.
              </div>
            ) : searchResults.length === 0 ? (
              <EmptyState icon={Search} title="Không tìm thấy người dùng" description="Thử nhập đúng tên, email hoặc mã WR của họ." />
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {searchResults.map((item) => {
                  const state = connectionStateFor(item);
                  const incomingRow = connectionMaps.incomingByUser.get(userIdOf(item));
                  const busy = busyKey === `send:${userIdOf(item)}`
                    || busyKey === `accept:${incomingRow?.friendshipId}`;
                  return (
                    <SearchResult
                      key={userIdOf(item)}
                      user={item}
                      state={state}
                      busy={busy}
                      onSend={sendRequest}
                      onAcceptIncoming={acceptIncomingFromSearch}
                      onOpen={openProfile}
                    />
                  );
                })}
              </div>
            )}
          </Card>

          <Card style={{ padding: 16 }}>
            <h2 style={{ margin: '0 0 12px', color: '#0f172a', fontSize: 17, fontWeight: 900 }}>Lời mời kết bạn</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {incoming.length === 0 ? (
                <div style={{ border: '1px dashed rgba(15,23,42,0.12)', borderRadius: 8, padding: 14, color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>
                  Chưa có lời mời mới.
                </div>
              ) : incoming.map((row) => (
                <RequestRow
                  key={row.friendshipId}
                  item={row}
                  type="incoming"
                  busy={busyKey === `accept:${row.friendshipId}` || busyKey === `decline:${row.friendshipId}`}
                  onAccept={acceptRequest}
                  onDecline={declineRequest}
                  onOpen={openProfile}
                />
              ))}
            </div>

            <div style={{ height: 1, background: 'rgba(15,23,42,0.08)', margin: '14px 0' }} />

            <h3 style={{ margin: '0 0 10px', color: '#475569', fontSize: 13, fontWeight: 900 }}>Đã gửi</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              {outgoing.length === 0 ? (
                <div style={{ border: '1px dashed rgba(15,23,42,0.12)', borderRadius: 8, padding: 14, color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>
                  Không có lời mời đang chờ.
                </div>
              ) : outgoing.map((row) => (
                <RequestRow
                  key={row.friendshipId}
                  item={row}
                  type="outgoing"
                  busy={busyKey === `cancel:${row.friendshipId}`}
                  onCancel={cancelRequest}
                  onOpen={openProfile}
                />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
