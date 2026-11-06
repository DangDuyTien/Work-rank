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
import {
  isStaleDay, mergeMessages, msUntilBoundary,
} from '../components/privateMedia/chatFeed';
import {
  bindAudioUnlock, notificationPermission, playNotificationTing, readNotifyPrefs,
  requestNotificationPermission, setTabBadge, showDesktopNotification, writeNotifyPrefs,
} from '../utils/mediaNotifications';

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
  // Bumped on every (re)connect. The player uses it to re-send an ENDED report
  // that a dropped socket may have swallowed.
  const [connectionEpoch, setConnectionEpoch] = useState(0);
  const [seekSignal, setSeekSignal] = useState(null);
  const [activationNeeded, setActivationNeeded] = useState(false);
  const [playerNotice, setPlayerNotice] = useState(null);
  const [waitingAdvance, setWaitingAdvance] = useState(false);
  const activationRef = useRef(null);
  const failureRef = useRef(null);

  const output = usePrivateMediaVolume(user?.id);

  // ── Shared listening presence ────────────────────────────────────────────
  // Distinct accounts in the shared room, pushed by the server on every
  // join/leave. Declared before `refreshStatus` so the first paint already has
  // the avatars instead of an empty strip that fills in a second later.
  const [participants, setParticipants] = useState([]);
  const chatMetaRef = useRef(null);
  const chatDayEventRef = useRef(null);

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
      setParticipants(Array.isArray(data.participants) ? data.participants : []);
      chatMetaRef.current?.(data.chat);
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

    socketRef.current = client;
    client.on('connect', () => {
      setSocketConnected(true);
      setConnectionEpoch((value) => value + 1);
      client.emit('private-media:subscribe');
      // Reconnect repair: fetch only what this tab missed while offline.
      chatSyncRef.current?.();
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
    // Who is listening together, deduplicated per account by the server.
    client.on('private-media:participants', (payload) => {
      if (payload) setParticipants(Array.isArray(payload.participants) ? payload.participants : []);
    });
    // Authoritative 00:00 switch (and the connect snapshot). The handler is a
    // ref because the chat feed is declared further down in this component.
    client.on('private-media:chat-day', (payload) => {
      if (payload) chatDayEventRef.current?.(payload);
    });
    // A read marker set in another tab of this account clears the badge here.
    client.on('private-media:chat-read', () => setChatUnread(0));

    setSocket(client);
    return () => {
      client.removeAllListeners();
      client.disconnect();
      if (socketRef.current === client) socketRef.current = null;
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
  // ENDED is the one fact that must actually arrive: if the packet is dropped
  // (a link that dies mid-track, a socket that looks connected but is not) the
  // queue would wait forever. socket.io's ack-with-timeout tells us honestly
  // whether the server received it, and the player retries when it did not.
  // The server is idempotent per queue item, so a retry can never skip a track.
  const onPlayerFact = useCallback((fact) => {
    if (!fact) return;
    if (fact.type === 'ended') {
      if (!socket) { fact.onUndelivered?.(); return; }
      socket.timeout(6000).emit('private-media:player-ended', fact.payload, (err, ack) => {
        if (err) fact.onUndelivered?.(err);
        else fact.onDelivered?.(ack);
      });
    } else if (fact.type === 'error') socket?.emit('private-media:player-error', fact.payload);
    else if (fact.type === 'duration') socket?.emit('private-media:player-progress', fact.payload);
  }, [socket]);

  const playerReady = useCallback(() => {
    socket?.emit('private-media:player-hello', {});
  }, [socket]);

  useEffect(() => {
    if (!socketConnected || !lease.isOwner) return;
    socket?.emit('private-media:player-hello', {});
  }, [socketConnected, lease.isOwner, socket]);

  // ── Chat chung ───────────────────────────────────────────────────────────
  // ONE feed for the whole system: Nghe riêng and Nghe chung read and write the
  // same channel, so switching mode never clears it. The feed lives here, above
  // the router, so a route change cannot drop it either.
  //
  // The server owns the day (Asia/Ho_Chi_Minh) and stamps every message with it.
  // The client keeps `chatDay` + `chatDayEndsAt` only to schedule the midnight
  // switch and to ignore a message that crossed the boundary in flight.
  const [chatMessages, setChatMessages] = useState([]);
  const [chatHasMore, setChatHasMore] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [chatUnread, setChatUnread] = useState(0);
  const [chatVisible, setChatVisible] = useState(false);
  const [chatDay, setChatDay] = useState(null);
  const [chatDayEndsAt, setChatDayEndsAt] = useState(null);
  const [chatClockTick, setChatClockTick] = useState(0);
  const chatIdsRef = useRef(new Set());
  const chatLastIdRef = useRef(0);
  const chatMessagesRef = useRef([]);
  const chatOpenRef = useRef(false);
  const chatPushRef = useRef(null);
  const chatSyncRef = useRef(null);
  const chatMarkTimerRef = useRef(null);
  const socketRef = useRef(null);
  // Day bookkeeping is kept in refs as well: a socket callback or a timer must
  // read the CURRENT day, not the value captured when it was created.
  const chatDayRef = useRef(null);
  const chatDayEndsAtRef = useRef(null);
  const chatSkewRef = useRef(0);
  const chatLoadRef = useRef(null);

  /**
   * Adopt the server's day metadata. Returns true when the day actually changed,
   * which is the only case where the feed must be emptied.
   */
  const applyChatMeta = useCallback((meta) => {
    if (!meta) return false;
    const serverNow = Number(meta.serverNow);
    if (Number.isFinite(serverNow)) chatSkewRef.current = serverNow - Date.now();
    if (meta.dayEndsAt) {
      chatDayEndsAtRef.current = meta.dayEndsAt;
      setChatDayEndsAt(meta.dayEndsAt);
    }
    if (!meta.day) return false;
    if (chatDayRef.current === meta.day) return false;
    chatDayRef.current = meta.day;
    setChatDay(meta.day);
    return true;
  }, []);
  chatMetaRef.current = applyChatMeta;

  /**
   * Single writer for the feed. The ref is the source of truth so a socket
   * message that lands while a REST page is in flight cannot be overwritten by
   * that page — the union is recomputed from the ref, not from stale React state.
   */
  const commitChat = useCallback((next) => {
    const list = Array.isArray(next) ? next : [];
    chatMessagesRef.current = list;
    chatIdsRef.current = new Set(list.map((message) => Number(message.id)));
    chatLastIdRef.current = list.reduce((max, message) => Math.max(max, Number(message.id) || 0), 0);
    setChatMessages(list);
  }, []);

  /** Empty the feed without touching the server (used at 00:00 and on rollover). */
  const resetChatFeed = useCallback(() => {
    commitChat([]);
    setChatHasMore(false);
    setChatUnread(0);
  }, [commitChat]);

  /**
   * Switch to a new day: drop yesterday from the screen immediately, then load
   * the (usually empty) new day. No page reload, no stale message left behind.
   */
  const rolloverChat = useCallback((nextDay = null) => {
    if (nextDay && nextDay !== chatDayRef.current) {
      chatDayRef.current = nextDay;
      setChatDay(nextDay);
    }
    resetChatFeed();
    chatLoadRef.current?.();
  }, [resetChatFeed]);

  const onChatDayEvent = useCallback((payload) => {
    if (!payload?.day) return;
    // The connect snapshot only teaches this tab which day it is; the initial
    // page load already fetches it. A LATER day change is the real rollover.
    const hadDay = Boolean(chatDayRef.current);
    const changed = applyChatMeta(payload);
    if (changed && hadDay) rolloverChat(payload.day);
  }, [applyChatMeta, rolloverChat]);
  chatDayEventRef.current = onChatDayEvent;

  // ── Notification preferences (per user, per device) ──────────────────────
  const [notifyPrefs, setNotifyPrefs] = useState(() => readNotifyPrefs(user?.id));
  const notifyRef = useRef(notifyPrefs);
  notifyRef.current = notifyPrefs;

  useEffect(() => { setNotifyPrefs(readNotifyPrefs(user?.id)); }, [user?.id]);
  useEffect(() => bindAudioUnlock(), []);

  const saveNotifyPrefs = useCallback((patch) => {
    setNotifyPrefs((previous) => {
      const next = writeNotifyPrefs(user?.id, { ...previous, ...patch });
      return next;
    });
  }, [user?.id]);

  // The tab badge is the one place that reflects "somebody wrote to me".
  useEffect(() => {
    setTabBadge(notifyPrefs.notify ? chatUnread : 0);
  }, [chatUnread, notifyPrefs.notify]);
  useEffect(() => () => setTabBadge(0), []);

  const isChatOnScreen = useCallback(() => (
    chatOpenRef.current
    && typeof document !== 'undefined'
    && document.visibilityState === 'visible'
  ), []);

  const markChatRead = useCallback((messageId = null) => {
    setChatUnread(0);
    const id = messageId ?? (chatLastIdRef.current || null);
    if (socketRef.current?.connected) {
      socketRef.current.emit('private-media:chat-read', { messageId: id }, () => {});
    } else {
      privateMediaApi.markChatRead(id).catch(() => {});
    }
  }, []);

  const scheduleMarkRead = useCallback(() => {
    if (chatMarkTimerRef.current) return;
    chatMarkTimerRef.current = setTimeout(() => {
      chatMarkTimerRef.current = null;
      markChatRead();
    }, 350);
  }, [markChatRead]);

  const chatPush = useCallback((message, { live = true } = {}) => {
    if (!message?.id || chatIdsRef.current.has(message.id)) return;
    // A message written at 23:59:59 can land after this tab switched to the new
    // day. It belongs to yesterday's feed, so it is dropped rather than shown
    // on top of an empty morning.
    if (isStaleDay(message.day, chatDayRef.current)) return;
    commitChat(mergeMessages(chatMessagesRef.current, [message]));

    const mine = Number(message.user?.id) === Number(user?.id);
    // Own messages, history loads and reconnect catch-up never notify.
    if (!live || mine) return;
    if (isChatOnScreen()) { scheduleMarkRead(); return; }

    setChatUnread((count) => count + 1);
    const prefs = notifyRef.current;
    if (prefs.sound) playNotificationTing(prefs.volume);
    if (prefs.notify) {
      showDesktopNotification({
        title: '3WIN MEDIA · Chat chung',
        body: `${message.user?.name || 'Thành viên'}: ${String(message.content || '').slice(0, 140)}`,
        tag: 'pm-chat-global',
        onClick: () => navigate('/private/media'),
      });
    }
  }, [commitChat, isChatOnScreen, navigate, scheduleMarkRead, user?.id]);
  chatPushRef.current = chatPush;

  const mergeChat = useCallback((list) => {
    const fresh = (list || []).filter((message) => (
      message?.id
      && !chatIdsRef.current.has(message.id)
      && !isStaleDay(message.day, chatDayRef.current)
    ));
    if (!fresh.length) return 0;
    // Sorted by id, never by arrival: a catch-up page and a live socket message
    // can race, and the reader must still see them in the order they were sent.
    commitChat(mergeMessages(chatMessagesRef.current, fresh));
    return fresh.length;
  }, [commitChat]);

  const loadChat = useCallback(async () => {
    if (!entitled) return;
    setChatLoading(true);
    setChatError(null);
    try {
      const data = await privateMediaApi.listChat({ limit: 40 });
      const changed = applyChatMeta(data);
      const list = data.messages || [];
      // Union, not replace: a message delivered by the socket while this request
      // was in flight is already in the ref and must survive.
      commitChat(mergeMessages(changed ? [] : chatMessagesRef.current, list));
      setChatHasMore(Boolean(data.hasMore));
      setChatUnread(Number(data.unread) || 0);
      // Opening the page while the chat is on screen means these are read.
      if (isChatOnScreen()) scheduleMarkRead();
    } catch (err) {
      setChatError(messageFrom(err, 'Không tải được tin nhắn.'));
    } finally {
      setChatLoading(false);
    }
  }, [applyChatMeta, commitChat, entitled, isChatOnScreen, scheduleMarkRead]);
  chatLoadRef.current = loadChat;

  /**
   * Reconnect repair: ask only for what this tab does not have. Idempotent by
   * message id, so a socket that redelivers the same message cannot duplicate
   * it and cannot ring twice. Pages until caught up, so a tab that slept through
   * more than one page of messages still loses nothing.
   */
  const syncChat = useCallback(async () => {
    if (!entitled) return;
    try {
      let cursor = chatLastIdRef.current;
      if (!cursor) {
        // No cursor yet: fall back to a normal page.
        await loadChat();
        return;
      }
      let added = 0;
      for (let page = 0; page < 5; page += 1) {
        // eslint-disable-next-line no-await-in-loop
        const data = await privateMediaApi.listChat({ limit: 100, after: cursor });
        // The tab was offline across midnight: today is a different feed.
        if (applyChatMeta(data)) {
          await loadChat();
          return;
        }
        added += mergeChat(data.messages);
        const next = Number(data.nextAfterId) || cursor;
        if (!data.hasMore || next === cursor) break;
        cursor = next;
      }
      if (!added) return;
      if (isChatOnScreen()) scheduleMarkRead();
      else setChatUnread((count) => count + added);
    } catch { /* the next reconnect retries */ }
  }, [applyChatMeta, entitled, isChatOnScreen, loadChat, mergeChat, scheduleMarkRead]);
  chatSyncRef.current = syncChat;

  const loadMoreChat = useCallback(async () => {
    if (!entitled || !chatMessages.length || chatLoading) return;
    setChatLoading(true);
    try {
      const data = await privateMediaApi.listChat({ limit: 30, before: chatMessages[0]?.id });
      applyChatMeta(data);
      const list = (data.messages || []).filter((message) => !chatIdsRef.current.has(message.id));
      commitChat(mergeMessages(list, chatMessagesRef.current));
      setChatHasMore(Boolean(data.hasMore));
    } catch (err) {
      setChatError(messageFrom(err, 'Không tải thêm được tin nhắn.'));
    } finally {
      setChatLoading(false);
    }
  }, [commitChat, entitled, chatMessages, chatLoading]);

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
            chatPush(ack.message, { live: false });
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
      if (data?.message) chatPush(data.message, { live: false });
      return { ok: true };
    } catch (err) {
      setChatError(messageFrom(err, 'Không gửi được tin nhắn.'));
      return { ok: false };
    }
  }, [socket, chatPush]);

  const setChatOpen = useCallback((open) => {
    chatOpenRef.current = Boolean(open);
    setChatVisible(Boolean(open));
    if (open) {
      setChatUnread(0);
      if (document.visibilityState === 'visible') scheduleMarkRead();
    }
  }, [scheduleMarkRead]);

  // Returning to the tab with the chat already open counts as reading. It is
  // also the cheapest moment to notice that midnight passed while the tab slept
  // (browsers throttle timers in background tabs).
  useEffect(() => {
    const onVisibility = () => {
      const boundary = new Date(chatDayEndsAtRef.current || 0).getTime();
      if (Number.isFinite(boundary) && boundary > 0 && Date.now() + chatSkewRef.current >= boundary) {
        rolloverChat();
        return;
      }
      if (isChatOnScreen()) { setChatUnread(0); scheduleMarkRead(); }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  }, [isChatOnScreen, rolloverChat, scheduleMarkRead]);

  /**
   * The midnight switch. `chatDayEndsAt` is the server's own instant, corrected
   * for a wrong device clock, so every tab flips at the same moment without a
   * reload. The server also pushes `private-media:chat-day`; whichever arrives
   * first wins and the other is a no-op.
   */
  useEffect(() => {
    if (!entitled || !chatDayEndsAt) return undefined;
    const clientNow = Date.now();
    const delay = msUntilBoundary(chatDayEndsAt, {
      serverNow: clientNow + chatSkewRef.current,
      clientNow,
    });
    if (delay == null) return undefined;
    // +900ms so the first fetch after the boundary cannot still be "yesterday".
    const timer = setTimeout(() => {
      rolloverChat();
      setChatClockTick((value) => value + 1);
    }, Math.min(delay + 900, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [chatDayEndsAt, chatClockTick, entitled, rolloverChat]);

  useEffect(() => {
    if (!entitled) return;
    loadChat();
  }, [entitled, loadChat]);

  // Desktop notification permission, only from an explicit user action.
  const enableDesktopNotifications = useCallback(async () => {
    const result = await requestNotificationPermission();
    if (result === 'granted') saveNotifyPrefs({ notify: true });
    return result;
  }, [saveNotifyPrefs]);

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
    // Chat is deliberately NOT reset: it is one system-wide feed, so switching
    // between Nghe riêng and Nghe chung must not wipe today's conversation.
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
      waitingForAdvance: waitingAdvance,
      waitingForAdvance: waitingAdvance,
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
      visible: chatVisible,
      hasMore: chatHasMore,
      loading: chatLoading,
      error: chatError,
      day: chatDay,
      dayEndsAt: chatDayEndsAt,
      send: sendChat,
      loadMore: loadMoreChat,
      markRead: markChatRead,
      setOpen: setChatOpen,
      sync: syncChat,
      reload: loadChat,
    },
    room: {
      participants,
      count: participants.length,
    },
    notifications: {
      prefs: notifyPrefs,
      setPrefs: saveNotifyPrefs,
      permission: notificationPermission(),
      requestPermission: enableDesktopNotifications,
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
    refreshStatus, activationNeeded, playerNotice, waitingAdvance, lease.isOwner, lease.otherTab, takeOver,
    onPlayerFact, playerReady, output.volume, output.muted, output.setVolume, output.toggleMute,
    chatMessages, chatUnread, chatVisible, chatHasMore, chatLoading, chatError, chatDay, chatDayEndsAt,
    sendChat, loadMoreChat, loadChat, markChatRead, setChatOpen, syncChat, participants,
    notifyPrefs, saveNotifyPrefs, enableDesktopNotifications,
    playlists, playlistsLoading, playlistDetail, playlistBusy,
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
          onWaitingAdvance={setWaitingAdvance}
          connectionEpoch={connectionEpoch}
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
