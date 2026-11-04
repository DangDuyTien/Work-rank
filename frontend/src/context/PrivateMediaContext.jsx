import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { privateMediaApi, setPrivateMediaRoom, codeFrom, messageFrom } from '../services/privateMediaApi';
import { usePrivateMediaAccess, invalidatePrivateMediaAccess } from '../hooks/usePrivateMediaAccess';
import usePrivateMediaVolume from '../hooks/usePrivateMediaVolume';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UiContext';
import PersistentPlayer from '../components/privateMedia/PersistentPlayer';
import { createPlayerOwnership } from '../components/privateMedia/playerOwnership';

/**
 * PRIVATE MEDIA — APPLICATION SHELL CONTROLLER
 *
 * One provider, mounted above the router, owns everything that must survive a
 * route change:
 *
 *   socket connection · session state · YouTube player · local volume
 *   chat feed        · playlist library · active player lease (multi-tab)
 *
 * Pages only read this state and dispatch commands. There is no second player,
 * no second socket and no page-level copy of the session.
 */

const PrivateMediaContext = createContext(null);
const SOCKET_NAMESPACE = '/private-media';
const ROOM_KEY = 'workrank:private-media:room';

function newCommandId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `pm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readRoom() {
  try {
    return localStorage.getItem(ROOM_KEY) === 'shared' ? 'shared' : 'private';
  } catch {
    return 'private';
  }
}

export function PrivateMediaProvider({ children }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const access = usePrivateMediaAccess();
  const toast = useToast();
  const entitled = Boolean(access.entitled);

  // ── Room (private vs shared) ─────────────────────────────────────────────
  const [roomMode, setRoomModeState] = useState(readRoom);
  const modeRef = useRef(roomMode);
  modeRef.current = roomMode;
  setPrivateMediaRoom(roomMode);

  // ── Session ──────────────────────────────────────────────────────────────
  const [session, setSessionRaw] = useState(null);
  const setSession = useCallback((next) => {
    if (!next) return;
    const shared = next.sessionKey === 'room:shared';
    if (shared !== (modeRef.current === 'shared')) return;
    setSessionRaw((previous) => {
      if (previous?.sessionId === next.sessionId
        && (previous.sessionRevision > next.sessionRevision
          || (previous.sessionRevision === next.sessionRevision && previous.serverNow > next.serverNow))) {
        return previous;
      }
      return { ...next, receivedAt: Date.now() };
    });
  }, []);

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [seekSignal, setSeekSignal] = useState(null);
  const [activationNeeded, setActivationNeeded] = useState(false);
  const [playerNotice, setPlayerNotice] = useState(null);
  const activationRef = useRef(null);
  const failureRef = useRef(null);

  const output = usePrivateMediaVolume(user?.id);

  // ── Player lease (multi-tab) ─────────────────────────────────────────────
  const ownershipRef = useRef(null);
  if (!ownershipRef.current && typeof window !== 'undefined') ownershipRef.current = createPlayerOwnership();
  const [lease, setLease] = useState({ isOwner: false, otherTab: false, tabId: null });

  useEffect(() => {
    if (!entitled) return undefined;
    const ownership = ownershipRef.current;
    if (!ownership) return undefined;
    const unsubscribe = ownership.subscribe(setLease);
    ownership.start();
    const onUnload = () => ownership.release();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      unsubscribe();
      ownership.stop();
    };
  }, [entitled]);

  const takeOver = useCallback(() => {
    ownershipRef.current?.claim({ takeover: true });
  }, []);

  // ── Failure toast (unavailable track) ────────────────────────────────────
  useEffect(() => {
    const failure = session?.lastFailure;
    if (failure && failureRef.current !== failure.itemId) {
      failureRef.current = failure.itemId;
      toast.warning(failure.message);
    }
  }, [session?.lastFailure, toast]);

  // ── Status ───────────────────────────────────────────────────────────────
  const refreshStatus = useCallback(async () => {
    if (!entitled) return null;
    try {
      const data = await privateMediaApi.getStatus();
      setStatus(data);
      setSession(data.session);
      setError(null);
      return data;
    } catch (err) {
      if (err?.response?.status === 404) {
        invalidatePrivateMediaAccess();
        navigate('/dashboard', { replace: true });
        return null;
      }
      setError(messageFrom(err, 'Không đọc được trạng thái media.'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [entitled, navigate, setSession]);

  useEffect(() => {
    if (!entitled) return;
    setPrivateMediaRoom(roomMode);
    setLoading(true);
    refreshStatus();
  }, [entitled, refreshStatus, roomMode]);

  // ── Socket (single connection for the whole app) ─────────────────────────
  useEffect(() => {
    if (!entitled) return undefined;
    const token = localStorage.getItem('token');
    if (!token) return undefined;

    const base = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';
    const client = io(`${base}${SOCKET_NAMESPACE}`, {
      auth: { token, clientType: 'web', room: roomMode },
      transports: ['websocket', 'polling'],
    });

    client.on('connect', () => {
      setSocketConnected(true);
      client.emit('private-media:subscribe');
    });
    client.on('disconnect', () => setSocketConnected(false));
    client.on('connect_error', () => setSocketConnected(false));
    client.on('private-media:state', (next) => { if (next) setSession(next); });
    client.on('private-media:access-revoked', () => {
      invalidatePrivateMediaAccess();
      navigate('/dashboard', { replace: true });
    });
    client.on('private-media:chat-message', (message) => {
      if (message) chatPushRef.current?.(message);
    });

    setSocket(client);
    return () => {
      client.removeAllListeners();
      client.disconnect();
      setSocket(null);
      setSocketConnected(false);
    };
  }, [entitled, navigate, roomMode, setSession]);

  // ── Commands ─────────────────────────────────────────────────────────────
  const sendCommand = useCallback(async (action, payload = {}, options = {}) => {
    const permission = action === 'QUEUE_ADD' || action === 'PLAYLIST_QUEUE'
      ? access.permissions.queue
      : access.permissions.control;
    if (!permission) return null;
    if (options.track !== false) setBusyAction(options.busyKey || action);
    try {
      const result = await privateMediaApi.sendCommand({ commandId: newCommandId(), action, payload });
      if (result?.state) setSession(result.state);
      setError(null);
      return result;
    } catch (err) {
      const code = codeFrom(err);
      if (err?.response?.status === 404) {
        invalidatePrivateMediaAccess();
        navigate('/dashboard', { replace: true });
        return null;
      }
      if (code === 'NO_ACTIVE_MEDIA_SESSION') setError('Chưa có video nào đang phát. Hãy chọn một video trước.');
      else if (code === 'NO_NEXT_TRACK') setError('Không còn video tiếp theo trong danh sách.');
      else if (code === 'NO_PREVIOUS_TRACK') setError('Không có video trước đó.');
      else if (code === 'PLAYLIST_EMPTY') setError('Danh sách phát chưa có video nào có thể phát.');
      else setError(messageFrom(err, 'Không thực hiện được lệnh.'));
      return null;
    } finally {
      if (options.track !== false) setBusyAction(null);
    }
  }, [access.permissions.control, access.permissions.queue, navigate, setSession]);

  const seekTo = useCallback((position) => {
    const target = Math.max(0, Math.round(Number(position) || 0));
    setSeekSignal({ position: target, at: Date.now() });
    sendCommand('SEEK', { position: target }, { track: false });
  }, [sendCommand]);

  // ── Player facts ─────────────────────────────────────────────────────────
  const onPlayerFact = useCallback((fact) => {
    if (!fact) return;
    if (fact.type === 'ended') socket?.emit('private-media:player-ended', fact.payload);
    else if (fact.type === 'error') socket?.emit('private-media:player-error', fact.payload);
    else if (fact.type === 'duration') socket?.emit('private-media:player-progress', fact.payload);
  }, [socket]);

  const playerReady = useCallback(() => {
    socket?.emit('private-media:player-hello', {});
  }, [socket]);

  useEffect(() => {
    if (!socketConnected || !lease.isOwner) return;
    socket?.emit('private-media:player-hello', {});
  }, [socketConnected, lease.isOwner, socket]);

  // ── Chat ─────────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState([]);
  const [chatHasMore, setChatHasMore] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [chatUnread, setChatUnread] = useState(0);
  const chatIdsRef = useRef(new Set());
  const chatOpenRef = useRef(true);
  const chatPushRef = useRef(null);

  const chatPush = useCallback((message) => {
    if (!message?.id || chatIdsRef.current.has(message.id)) return;
    chatIdsRef.current.add(message.id);
    setChatMessages((previous) => [...previous, message]);
    if (!chatOpenRef.current) setChatUnread((count) => count + 1);
  }, []);
  chatPushRef.current = chatPush;

  const loadChat = useCallback(async () => {
    if (!entitled) return;
    setChatLoading(true);
    setChatError(null);
    try {
      const data = await privateMediaApi.listChat({ limit: 30 });
      const list = data.messages || [];
      chatIdsRef.current = new Set(list.map((message) => message.id));
      setChatMessages(list);
      setChatHasMore(Boolean(data.hasMore));
      setChatUnread(0);
    } catch (err) {
      setChatError(messageFrom(err, 'Không tải được tin nhắn.'));
    } finally {
      setChatLoading(false);
    }
  }, [entitled]);

  const loadMoreChat = useCallback(async () => {
    if (!entitled || !chatMessages.length || chatLoading) return;
    setChatLoading(true);
    try {
      const data = await privateMediaApi.listChat({ limit: 30, before: chatMessages[0]?.id });
      const list = (data.messages || []).filter((message) => !chatIdsRef.current.has(message.id));
      list.forEach((message) => chatIdsRef.current.add(message.id));
      setChatMessages((previous) => [...list, ...previous]);
      setChatHasMore(Boolean(data.hasMore));
    } catch (err) {
      setChatError(messageFrom(err, 'Không tải thêm được tin nhắn.'));
    } finally {
      setChatLoading(false);
    }
  }, [entitled, chatMessages, chatLoading]);

  const sendChat = useCallback(async (content) => {
    const text = String(content || '').trim();
    if (!text) return { ok: false };
    const clientMessageId = newCommandId();
    // The socket path keeps latency low; the REST fallback keeps chat usable if
    // the realtime channel is reconnecting.
    if (socket?.connected) {
      return new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => { if (!settled) { settled = true; resolve({ ok: false, pending: true }); } }, 6000);
        socket.emit('private-media:chat-send', { content: text, clientMessageId }, (ack) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (ack?.ok) {
            chatPush(ack.message);
            resolve({ ok: true });
          } else {
            setChatError(ack?.message || 'Không gửi được tin nhắn.');
            resolve({ ok: false });
          }
        });
      });
    }
    try {
      const data = await privateMediaApi.sendChat({ content: text, clientMessageId });
      if (data?.message) chatPush(data.message);
      return { ok: true };
    } catch (err) {
      setChatError(messageFrom(err, 'Không gửi được tin nhắn.'));
      return { ok: false };
    }
  }, [socket, chatPush]);

  const markChatRead = useCallback(() => setChatUnread(0), []);
  const setChatOpen = useCallback((open) => {
    chatOpenRef.current = open;
    if (open) setChatUnread(0);
  }, []);

  useEffect(() => {
    if (!entitled) return;
    loadChat();
  }, [entitled, loadChat, roomMode]);

  // ── Playlists ────────────────────────────────────────────────────────────
  const [playlists, setPlaylists] = useState([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [playlistDetail, setPlaylistDetail] = useState(null);
  const [playlistBusy, setPlaylistBusy] = useState(false);

  const refreshPlaylists = useCallback(async () => {
    if (!entitled) return [];
    setPlaylistsLoading(true);
    try {
      const data = await privateMediaApi.listPlaylists();
      setPlaylists(data.playlists || []);
      return data.playlists || [];
    } catch {
      setPlaylists([]);
      return [];
    } finally {
      setPlaylistsLoading(false);
    }
  }, [entitled]);

  useEffect(() => { refreshPlaylists(); }, [refreshPlaylists]);

  const selectPlaylist = useCallback(async (playlistId) => {
    if (!playlistId) { setPlaylistDetail(null); return null; }
    try {
      const data = await privateMediaApi.getPlaylist(playlistId);
      setPlaylistDetail(data.playlist);
      return data.playlist;
    } catch (err) {
      setError(messageFrom(err, 'Không mở được danh sách phát.'));
      return null;
    }
  }, []);

  const playlistAction = useCallback(async (work, fallback) => {
    setPlaylistBusy(true);
    try {
      const result = await work();
      await refreshPlaylists();
      return result;
    } catch (err) {
      setError(messageFrom(err, fallback));
      return null;
    } finally {
      setPlaylistBusy(false);
    }
  }, [refreshPlaylists]);

  const createPlaylist = useCallback((payload) => playlistAction(
    () => privateMediaApi.createPlaylist(payload),
    'Không tạo được danh sách phát.',
  ), [playlistAction]);

  const updatePlaylist = useCallback(async (playlistId, patch) => {
    const result = await playlistAction(() => privateMediaApi.updatePlaylist(playlistId, patch), 'Không cập nhật được danh sách phát.');
    if (result?.playlist && playlistDetail?.id === playlistId) setPlaylistDetail(result.playlist);
    return result;
  }, [playlistAction, playlistDetail]);

  const deletePlaylist = useCallback(async (playlistId) => {
    const result = await playlistAction(() => privateMediaApi.deletePlaylist(playlistId), 'Không xóa được danh sách phát.');
    if (result?.deleted && playlistDetail?.id === playlistId) setPlaylistDetail(null);
    return result;
  }, [playlistAction, playlistDetail]);

  const addPlaylistItems = useCallback(async (playlistId, items) => {
    const result = await playlistAction(() => privateMediaApi.addPlaylistItems(playlistId, items), 'Không thêm được video.');
    if (result?.playlist) setPlaylistDetail(result.playlist);
    return result;
  }, [playlistAction]);

  const removePlaylistItem = useCallback(async (playlistId, itemId) => {
    const result = await playlistAction(() => privateMediaApi.removePlaylistItem(playlistId, itemId), 'Không xóa được video.');
    if (result?.playlist) setPlaylistDetail(result.playlist);
    return result;
  }, [playlistAction]);

  const reorderPlaylistItems = useCallback(async (playlistId, itemIds) => {
    const result = await playlistAction(() => privateMediaApi.reorderPlaylistItems(playlistId, itemIds), 'Không sắp xếp được danh sách phát.');
    if (result?.playlist) setPlaylistDetail(result.playlist);
    return result;
  }, [playlistAction]);

  const importPlaylist = useCallback(async (payload) => {
    const result = await playlistAction(() => privateMediaApi.importPlaylist(payload), 'Không nhập được playlist.');
    if (result?.playlist) setPlaylistDetail(result.playlist);
    return result;
  }, [playlistAction]);

  const playPlaylist = useCallback((playlistId, { mode = 'sequential', startItemId, repeat } = {}) => sendCommand(
    mode === 'shuffle' ? 'PLAYLIST_SHUFFLE' : 'PLAYLIST_PLAY',
    { playlistId, mode, startItemId, repeat },
  ), [sendCommand]);

  const queuePlaylist = useCallback((playlistId) => sendCommand('PLAYLIST_QUEUE', { playlistId }), [sendCommand]);

  // ── Room switch ──────────────────────────────────────────────────────────
  const setRoomMode = useCallback((value) => {
    const next = value === 'shared' ? 'shared' : 'private';
    setSessionRaw(null);
    setPlaylistDetail(null);
    setChatMessages([]);
    chatIdsRef.current = new Set();
    setRoomModeState(next);
    setPrivateMediaRoom(next);
    try { localStorage.setItem(ROOM_KEY, next); } catch { /* private mode */ }
  }, []);

  // ── Value ────────────────────────────────────────────────────────────────
  // No global 1s ticker here on purpose: only the components that display time
  // subscribe to a clock (see useMediaClock), so a chat message or a playlist
  // refresh never re-renders the player tree.
  const value = useMemo(() => ({
    entitled,
    isOwner: Boolean(access.isOwner),
    permissions: access.permissions,
    accessLoading: access.loading,
    session,
    status,
    loading,
    error,
    setError,
    busyAction,
    socket,
    socketConnected,
    roomMode,
    setRoomMode,
    seekSignal,
    seekTo,
    sendCommand,
    refreshStatus,
    player: {
      activationNeeded,
      activationRef,
      notice: playerNotice,
      setNotice: setPlayerNotice,
      isPlayerOwner: lease.isOwner,
      otherTab: lease.otherTab,
      takeOver,
      onPlayerFact,
      onReady: playerReady,
    },
    volume: {
      volume: output.volume,
      muted: output.muted,
      setVolume: output.setVolume,
      toggleMute: output.toggleMute,
    },
    chat: {
      messages: chatMessages,
      unread: chatUnread,
      hasMore: chatHasMore,
      loading: chatLoading,
      error: chatError,
      send: sendChat,
      loadMore: loadMoreChat,
      markRead: markChatRead,
      setOpen: setChatOpen,
    },
    playlists: {
      list: playlists,
      loading: playlistsLoading,
      detail: playlistDetail,
      busy: playlistBusy,
      refresh: refreshPlaylists,
      select: selectPlaylist,
      create: createPlaylist,
      update: updatePlaylist,
      remove: deletePlaylist,
      addItems: addPlaylistItems,
      removeItem: removePlaylistItem,
      reorder: reorderPlaylistItems,
      importFromUrl: importPlaylist,
      play: playPlaylist,
      enqueue: queuePlaylist,
    },
  }), [
    entitled, access.isOwner, access.permissions, access.loading, session, status, loading, error,
    busyAction, socket, socketConnected, roomMode, setRoomMode, seekSignal, seekTo, sendCommand,
    refreshStatus, activationNeeded, playerNotice, lease.isOwner, lease.otherTab, takeOver,
    onPlayerFact, playerReady, output.volume, output.muted, output.setVolume, output.toggleMute,
    chatMessages, chatUnread, chatHasMore, chatLoading, chatError, sendChat, loadMoreChat,
    markChatRead, setChatOpen, playlists, playlistsLoading, playlistDetail, playlistBusy,
    refreshPlaylists, selectPlaylist, createPlaylist, updatePlaylist, deletePlaylist,
    addPlaylistItems, removePlaylistItem, reorderPlaylistItems, importPlaylist, playPlaylist,
    queuePlaylist,
  ]);

  return (
    <PrivateMediaContext.Provider value={value}>
      {children}
      {entitled && (
        <PersistentPlayer
          session={session}
          volume={output.muted ? 0 : output.volume}
          muted={output.muted}
          seekSignal={seekSignal}
          isOwner={lease.isOwner}
          enabled={entitled}
          activationRef={activationRef}
          onCommand={sendCommand}
          onPlayerFact={onPlayerFact}
          onTakeOver={takeOver}
          onActivationNeeded={setActivationNeeded}
          onReady={playerReady}
          onNotice={setPlayerNotice}
          onOpenPage={() => navigate('/private/media')}
        />
      )}
    </PrivateMediaContext.Provider>
  );
}

export function usePrivateMedia() {
  const value = useContext(PrivateMediaContext);
  if (!value) throw new Error('usePrivateMedia must be used inside PrivateMediaProvider');
  return value;
}

export default PrivateMediaProvider;
