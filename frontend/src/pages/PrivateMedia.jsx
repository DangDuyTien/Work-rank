import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Cast,
  Check,
  Copy,
  Keyboard,
  Link2,
  Loader2,
  MonitorPlay,
  MonitorSmartphone,
  PictureInPicture2,
  Play,
  Radio,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  PageShell,
  PageHeader,
  Card,
  Button,
  Notice,
  AnimatedModal,
  SegmentedControl,
  Skeleton,
} from '../components/ui';
import YouTubeStage, { formatTime } from '../components/privateMedia/YouTubeStage';
import MiniPlayer, { MediaControls, PIP_WIDTH, PIP_HEIGHT } from '../components/privateMedia/MiniPlayer';
import SeekBar from '../components/privateMedia/SeekBar';
import VolumeBar from '../components/privateMedia/VolumeBar';
import { privateMediaApi, setPrivateMediaRoom, codeFrom, messageFrom } from '../services/privateMediaApi';
import { usePrivateMediaAccess, invalidatePrivateMediaAccess } from '../hooks/usePrivateMediaAccess';
import { useAuth } from '../context/AuthContext';
import './privateMedia.css';

/**
 * PRIVATE MEDIA — owner-only remote media control.
 *
 * Presentation only. Every action here is re-authorized by the backend; hiding a
 * button is a courtesy, never the security boundary.
 */

const SOCKET_NAMESPACE = '/private-media';
const MINI_THEME_KEY = 'workrank:private-media:mini-theme';
const ROOM_KEY = 'workrank:private-media:room';

function newCommandId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `pm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function looksLikeYouTubeInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return true;
  return /(youtube\.com|youtu\.be)/i.test(raw);
}

const AUDIT_LABEL = {
  GRANT_ACCESS: 'Cấp quyền',
  REVOKE_ACCESS: 'Thu hồi quyền',
  ACCESS_DENIED: 'Từ chối truy cập',
  TELEGRAM_BOUND: 'Liên kết Telegram',
  TELEGRAM_UNBOUND: 'Hủy liên kết Telegram',
  DEVICE_PAIRED: 'Ghép nối thiết bị',
  DEVICE_REVOKED: 'Thu hồi thiết bị',
  VIDEO_SELECTED: 'Chọn video',
  PLAY: 'Phát',
  PAUSE: 'Tạm dừng',
  TOGGLE_PLAY_PAUSE: 'Đảo phát/tạm dừng',
  STOP: 'Dừng',
  NEXT: 'Video tiếp theo',
  PREVIOUS: 'Video trước',
  SEEK: 'Tua',
  SET_VOLUME: 'Đổi âm lượng',
};

function relativeTime(value) {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

export default function PrivateMedia() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const access = usePrivateMediaAccess();

  const [session, setSession] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [error, setError] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const [miniOpen, setMiniOpen] = useState(false);
  const [miniWindow, setMiniWindow] = useState(null);
  const [miniNote, setMiniNote] = useState(null);
  // Bumped on every scrub so the hidden player jumps immediately instead of
  // waiting for the command round-trip (and possibly a stale heartbeat).
  const [seekSignal, setSeekSignal] = useState(null);


  // The mini window cannot read the colour of other tabs (cross-origin), so the
  // owner picks a palette once and it is remembered.
  // Private by default. 'shared' joins the one listening room, which behaves
  // like the original single session: same video, same playhead, same volume.
  const [roomMode, setRoomMode] = useState(() => {
    try {
      return localStorage.getItem(ROOM_KEY) === 'shared' ? 'shared' : 'private';
    } catch {
      return 'private';
    }
  });

  // Keep the API client in sync before any request is made.
  setPrivateMediaRoom(roomMode);

  const changeRoomMode = useCallback((value) => {
    const next = value === 'shared' ? 'shared' : 'private';
    setRoomMode(next);
    setPrivateMediaRoom(next);
    try { localStorage.setItem(ROOM_KEY, next); } catch { /* private mode */ }
  }, []);

  const [miniTheme, setMiniTheme] = useState(() => {
    try {
      const stored = localStorage.getItem(MINI_THEME_KEY);
      return stored === 'light' || stored === 'dark' ? stored : 'auto';
    } catch {
      return 'auto';
    }
  });

  const changeMiniTheme = useCallback((value) => {
    setMiniTheme(value);
    try { localStorage.setItem(MINI_THEME_KEY, value); } catch { /* private mode */ }
  }, []);

  const miniWindowRef = useRef(null);

  const closeMini = useCallback(() => {
    setMiniOpen(false);
    const win = miniWindowRef.current;
    miniWindowRef.current = null;
    setMiniWindow(null);
    try { win?.close(); } catch { /* already closed */ }
  }, []);

  /**
   * Open the floating controller.
   *
   * `requestWindow()` MUST run synchronously inside the click handler: the API
   * requires transient user activation, and awaiting anything first makes it
   * reject — that is why the window previously fell back to an in-page bar and
   * "would not follow to other tabs".
   *
   * The window is requested at exactly the size the controls need. Requesting
   * less than the content width clips the last buttons, which is what made the
   * controller look like it had "no buttons" on Windows.
   */
  const openMini = useCallback(async () => {
    setMiniNote(null);

    if (miniOpen) {
      closeMini();
      return;
    }

    if (typeof window === 'undefined' || !window.isSecureContext) {
      setMiniNote('Cửa sổ nổi cần HTTPS hoặc localhost. Trang đang chạy qua HTTP nên chỉ dùng thanh điều khiển trong trang (vẫn đủ 5 nút).');
      return;
    }

    if (!('documentPictureInPicture' in window)) {
      setMiniNote('Trình duyệt này không hỗ trợ cửa sổ nổi (cần Chrome/Edge 116+). Dùng thanh điều khiển trong trang — vẫn đủ 5 nút.');
      return;
    }

    try {
      const win = await window.documentPictureInPicture.requestWindow({
        width: PIP_WIDTH,
        height: PIP_HEIGHT,
        disallowReturnToOpener: false,
      });
      miniWindowRef.current = win;

      // Chrome treats width/height as hints and remembers the geometry per
      // origin, so a window that was once opened larger stays larger. Resize
      // explicitly, and retry: the first call can land before the window has
      // finished being created.
      const enforceSize = () => {
        try { win.resizeTo(PIP_WIDTH, PIP_HEIGHT); } catch { /* not supported */ }
      };
      enforceSize();
      setTimeout(enforceSize, 120);
      setTimeout(enforceSize, 500);
      setMiniWindow(win);
      setMiniOpen(true);
    } catch (error) {
      setMiniNote(`Không mở được cửa sổ nổi (${error?.name || 'lỗi'}). Dùng thanh điều khiển trong trang.`);
    }
  }, [miniOpen, closeMini]);

  // Leaving the page stops the audio host, so a floating controller would only
  // show dead buttons — close it with the page.
  useEffect(() => () => {
    const win = miniWindowRef.current;
    miniWindowRef.current = null;
    try { win?.close(); } catch { /* already closed */ }
  }, []);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState(null);


  // ── Data loading ──────────────────────────────────────────────────────────
  const refreshStatus = useCallback(async () => {
    try {
      const data = await privateMediaApi.getStatus();
      setStatus(data);
      setSession(data.session);
      setError(null);
    } catch (err) {
      if (err?.response?.status === 404) {
        invalidatePrivateMediaAccess();
        navigate('/dashboard', { replace: true });
        return;
      }
      setError(messageFrom(err, 'Không đọc được trạng thái media.'));
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!access.entitled) return;
    setPrivateMediaRoom(roomMode);
    refreshStatus();
    // The recent list belongs to a session too, so it must follow the room.
    loadRecent?.();
  }, [access.entitled, refreshStatus, roomMode]);

  // ── Realtime channel (dedicated namespace) ────────────────────────────────
  useEffect(() => {
    if (!access.entitled) return undefined;
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

    client.on('private-media:state', (next) => {
      if (next) setSession(next);
    });
    client.on('private-media:player-online', () => {
      setSession((prev) => (prev ? { ...prev, playerOnline: true } : prev));
    });
    client.on('private-media:player-offline', () => {
      setSession((prev) => (prev ? { ...prev, playerOnline: false } : prev));
    });
    client.on('private-media:access-revoked', () => {
      invalidatePrivateMediaAccess();
      navigate('/dashboard', { replace: true });
    });

    setSocket(client);

    return () => {
      client.removeAllListeners();
      client.disconnect();
      setSocket(null);
      setSocketConnected(false);
    };
  }, [access.entitled, navigate, roomMode]);

  // ── Commands ──────────────────────────────────────────────────────────────
  const sendCommand = useCallback(async (action, payload = {}, options = {}) => {
    if (!access.permissions.control) return null;
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
      if (code === 'NO_ACTIVE_MEDIA_SESSION') {
        setError('Chưa có video nào đang phát. Hãy chọn một video trước.');
      } else if (code === 'NO_NEXT_TRACK') {
        setError('Không còn video tiếp theo trong danh sách.');
      } else if (code === 'NO_PREVIOUS_TRACK') {
        setError('Không có video trước đó.');
      } else {
        setError(messageFrom(err, 'Không thực hiện được lệnh.'));
      }
      return null;
    } finally {
      if (options.track !== false) setBusyAction(null);
    }
  }, [access.permissions.control, navigate]);

  // Seek is issued through one helper: the player jumps immediately (no waiting
  // for the round-trip) and the command keeps the session in sync.
  const seekTo = useCallback((position) => {
    const target = Math.max(0, Math.round(Number(position) || 0));
    setSeekSignal({ position: target, at: Date.now() });
    sendCommand('SEEK', { position: target }, { track: false });
  }, [sendCommand]);

  const loadVideo = useCallback(async (video, queue = [], options = {}) => {
    if (!video?.videoId) return;
    await sendCommand('LOAD_VIDEO', {
      videoId: video.videoId,
      title: video.title || null,
      channelTitle: video.channelTitle || null,
      thumbnailUrl: video.thumbnailUrl || null,
      durationSeconds: video.durationSeconds ?? null,
      queue,
      // In the shared room this marks a deliberate list: it is appended to the
      // pool (and rotated) instead of replacing what other people queued.
      append: Boolean(options.append),
    }, { busyKey: `load:${video.videoId}` });
  }, [sendCommand]);

  // ── Search / paste link(s) ────────────────────────────────────────────────
  const runSearch = useCallback(async (event) => {
    event?.preventDefault?.();
    const term = query.trim();
    if (!term) return;

    setSearching(true);
    setSearchNote(null);
    setResults([]);

    try {
      // Accept one link, or a whole list — one per line — to build a queue.
      const tokens = term.split(/[\s,]+/).map((token) => token.trim()).filter(Boolean);
      const allLinks = tokens.length > 0 && tokens.every(looksLikeYouTubeInput);

      if (allLinks) {
        const resolved = [];
        for (const token of tokens.slice(0, 20)) {
          try {
            const { video } = await privateMediaApi.resolveYouTube(token);
            if (video?.videoId && !resolved.some((item) => item.videoId === video.videoId)) {
              resolved.push(video);
            }
          } catch {
            // Skip a broken link instead of failing the whole batch.
          }
        }

        if (!resolved.length) {
          setSearchNote('Không đọc được link nào. Kiểm tra lại link YouTube.');
          return;
        }

        setResults(resolved);
        await loadVideo(resolved[0], resolved, { append: resolved.length > 1 });
        setSearchNote(resolved.length > 1
          ? `Đã nạp ${resolved.length} video vào danh sách phát — hết bài sẽ tự chuyển bài.`
          : 'Đã nạp video từ link.');
        return;
      }

      const data = await privateMediaApi.searchYouTube(term);
      setResults(data.items || []);
      if (!data.items?.length) setSearchNote('Không tìm thấy video phù hợp.');
    } catch (err) {
      const code = codeFrom(err);
      if (code === 'YOUTUBE_SEARCH_UNAVAILABLE') {
        setSearchNote('Tìm kiếm cần YOUTUBE_API_KEY trên máy chủ. Bạn vẫn có thể dán link YouTube (mỗi dòng một link) để phát.');
      } else if (code === 'INVALID_VIDEO') {
        setSearchNote('Link YouTube không hợp lệ.');
      } else {
        setSearchNote(messageFrom(err, 'Không tìm được video.'));
      }
    } finally {
      setSearching(false);
    }
  }, [query, loadVideo]);

  const playFromResults = useCallback((item) => {
    const queue = results.map((entry) => ({
      videoId: entry.videoId,
      title: entry.title,
      channelTitle: entry.channelTitle,
      thumbnailUrl: entry.thumbnailUrl,
      durationSeconds: entry.durationSeconds,
    }));
    loadVideo(item, queue);
  }, [results, loadVideo]);

  // ── Recent videos (keyless quick replay) ──────────────────────────────────
  const [recentVideos, setRecentVideos] = useState([]);

  const loadRecent = useCallback(async () => {
    try {
      const data = await privateMediaApi.getRecent(10);
      setRecentVideos(data.videos || []);
    } catch {
      setRecentVideos([]);
    }
  }, []);

  useEffect(() => {
    if (!access.entitled) return;
    loadRecent();
  }, [access.entitled, loadRecent, session?.video?.videoId]);

  const currentVideoId = session?.video?.videoId || null;


  // ── Owner: access management ──────────────────────────────────────────────
  const [grants, setGrants] = useState([]);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [grantTarget, setGrantTarget] = useState(null);
  const [grantDraft, setGrantDraft] = useState({ view: true, control: true, telegram: false, hotkey: false });
  const [grantSaving, setGrantSaving] = useState(false);
  const [grantError, setGrantError] = useState(null);

  const loadGrants = useCallback(async () => {
    if (!access.permissions.manageAccess) return;
    setGrantsLoading(true);
    try {
      const data = await privateMediaApi.listGrants();
      setGrants(data.grants || []);
    } catch {
      setGrants([]);
    } finally {
      setGrantsLoading(false);
    }
  }, [access.permissions.manageAccess]);

  useEffect(() => {
    loadGrants();
  }, [loadGrants]);

  useEffect(() => {
    if (!access.permissions.manageAccess) return undefined;
    const term = peopleQuery.trim();
    if (term.length < 2) {
      setPeople([]);
      return undefined;
    }
    let active = true;
    setPeopleLoading(true);
    const timer = setTimeout(() => {
      privateMediaApi.searchUsers(term)
        .then((data) => { if (active) setPeople(data.users || []); })
        .catch(() => { if (active) setPeople([]); })
        .finally(() => { if (active) setPeopleLoading(false); });
    }, 280);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [peopleQuery, access.permissions.manageAccess]);

  const openGrantDialog = (person) => {
    setGrantTarget(person);
    setGrantError(null);
    const existing = grants.find((grant) => String(grant.userId) === String(person.id) && grant.active);
    setGrantDraft(existing
      ? { ...existing.permissions }
      : { view: true, control: true, telegram: false, hotkey: false });
  };

  const submitGrant = async () => {
    if (!grantTarget) return;
    setGrantSaving(true);
    setGrantError(null);
    try {
      await privateMediaApi.createGrant({ userId: grantTarget.id, permissions: grantDraft });
      setGrantTarget(null);
      setPeopleQuery('');
      setPeople([]);
      await loadGrants();
    } catch (err) {
      setGrantError(messageFrom(err, 'Không cấp được quyền.'));
    } finally {
      setGrantSaving(false);
    }
  };

  const revokeGrant = async (userId) => {
    try {
      await privateMediaApi.revokeGrant(userId);
      await loadGrants();
    } catch (err) {
      setError(messageFrom(err, 'Không thu hồi được quyền.'));
    }
  };

  // ── Telegram binding ──────────────────────────────────────────────────────
  const [telegramCode, setTelegramCode] = useState(null);
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [telegramNote, setTelegramNote] = useState(null);

  const createTelegramCode = async () => {
    setTelegramBusy(true);
    setTelegramNote(null);
    try {
      const data = await privateMediaApi.createTelegramCode();
      setTelegramCode(data);
    } catch (err) {
      if (codeFrom(err) === 'TELEGRAM_DISABLED') {
        setTelegramNote('Bot Telegram chưa được cấu hình trên máy chủ (TELEGRAM_BOT_TOKEN).');
      } else {
        setTelegramNote(messageFrom(err, 'Không tạo được mã liên kết.'));
      }
    } finally {
      setTelegramBusy(false);
    }
  };

  const unlinkTelegram = async () => {
    setTelegramBusy(true);
    try {
      await privateMediaApi.unbindTelegram();
      setTelegramCode(null);
      await refreshStatus();
    } catch (err) {
      setTelegramNote(messageFrom(err, 'Không hủy được liên kết.'));
    } finally {
      setTelegramBusy(false);
    }
  };

  // ── Devices ───────────────────────────────────────────────────────────────
  const [deviceCode, setDeviceCode] = useState(null);
  const [deviceNote, setDeviceNote] = useState(null);
  const [deviceBusy, setDeviceBusy] = useState(false);

  const createDeviceCode = async () => {
    setDeviceBusy(true);
    setDeviceNote(null);
    try {
      const data = await privateMediaApi.createDeviceCode();
      setDeviceCode(data);
    } catch (err) {
      setDeviceNote(messageFrom(err, 'Không tạo được mã ghép nối.'));
    } finally {
      setDeviceBusy(false);
    }
  };

  const revokeDevice = async (id) => {
    try {
      await privateMediaApi.revokeDevice(id);
      await refreshStatus();
    } catch (err) {
      setDeviceNote(messageFrom(err, 'Không thu hồi được thiết bị.'));
    }
  };

  // ── Audit ─────────────────────────────────────────────────────────────────
  const [auditEntries, setAuditEntries] = useState([]);

  const loadAudit = useCallback(async () => {
    if (!access.permissions.manageAccess) return;
    try {
      const data = await privateMediaApi.listAudit(30);
      setAuditEntries(data.entries || []);
    } catch {
      setAuditEntries([]);
    }
  }, [access.permissions.manageAccess]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard may be blocked; the value stays selectable on screen.
    }
  };

  const telegramBinding = status?.telegram?.binding || null;
  const activeDevices = useMemo(
    () => (status?.devices || []).filter((device) => device.active),
    [status?.devices],
  );

  const playerOnline = Boolean(session?.playerOnline) && socketConnected;
  // Assume search works until the server says otherwise, so the UI does not
  // flicker from "paste a link" to "search" on first paint.
  const searchAvailable = status ? Boolean(status.youtube?.search) : true;

  if (!access.entitled) return null;

  return (
    <PageShell className="pm-page">
      <PageHeader
        eyebrow="RIÊNG TƯ"
        title="Điều khiển media"
        description="Tìm và điều khiển video từ xa bằng Telegram hoặc bàn phím."
        actions={(
          <>
            <Button variant="secondary" size="sm" onClick={refreshStatus} disabled={loading}>
              <RefreshCw size={14} aria-hidden="true" />
              Làm mới
            </Button>
            <Button variant={miniOpen ? 'primary' : 'accent'} size="sm" onClick={openMini}>
              <PictureInPicture2 size={14} aria-hidden="true" />
              {miniOpen ? 'Đóng cửa sổ nhỏ' : 'Cửa sổ nhỏ'}
            </Button>
          </>
        )}
      />

      {miniNote && (
        <div className="pm-inline-notice">
          <Notice type="info" icon={PictureInPicture2}>{miniNote}</Notice>
        </div>
      )}

      {error && (
        <div className="pm-inline-notice">
          <Notice type="error" icon={X}>{error}</Notice>
        </div>
      )}

      <div className="pm-layout">
        <div className="pm-main">
          <Card className="pm-search">
            <form onSubmit={runSearch} className="pm-search__form">
              <div className="pm-search__field">
                <Search size={16} aria-hidden="true" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchAvailable
                    ? 'Tìm video YouTube hoặc dán link…'
                    : 'Dán link YouTube — nhiều link cách nhau bởi dấu cách…'}
                  aria-label="Tìm video YouTube hoặc dán link"
                  spellCheck={false}
                />
                {query && (
                  <button
                    type="button"
                    className="pm-search__clear"
                    onClick={() => { setQuery(''); setResults([]); setSearchNote(null); }}
                    aria-label="Xóa nội dung tìm kiếm"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
              <Button type="submit" variant="primary" disabled={searching || !query.trim()}>
                {searching ? <Loader2 size={15} className="pm-spin" aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
                {searchAvailable ? 'Tìm' : 'Phát'}
              </Button>
            </form>

            {searchNote && <p className="pm-search__note">{searchNote}</p>}

            {!searchAvailable && !searchNote && (
              <p className="pm-search__note">
                Chưa cấu hình <code>YOUTUBE_API_KEY</code> nên chưa tìm kiếm trong app được — dán link vẫn phát bình thường.
              </p>
            )}

            {searching && (
              <div className="pm-results" aria-busy="true">
                {[0, 1, 2].map((key) => (
                  <div key={key} className="pm-result is-skeleton">
                    <Skeleton width={104} height={60} radius={4} />
                    <div className="pm-result__body">
                      <Skeleton height={13} width="70%" />
                      <Skeleton height={11} width="40%" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!searching && results.length > 0 && (
              <ul className="pm-results">
                {results.map((item, index) => (
                  <li key={item.videoId} className={`pm-result pm-result--text${currentVideoId === item.videoId ? ' is-current' : ''}`}>
                    <span className="pm-result__index" aria-hidden="true">{index + 1}</span>
                    <div className="pm-result__body">
                      <strong title={item.title || item.videoId}>{item.title || item.videoId}</strong>
                      <span>
                        {item.channelTitle || 'YouTube'}
                        {item.durationSeconds ? ` · ${formatTime(item.durationSeconds)}` : ''}
                      </span>
                    </div>
                    <Button
                      variant={currentVideoId === item.videoId ? 'secondary' : 'accent'}
                      size="sm"
                      onClick={() => playFromResults(item)}
                      disabled={!access.permissions.control || busyAction === `load:${item.videoId}`}
                    >
                      {busyAction === `load:${item.videoId}` ? <Loader2 size={14} className="pm-spin" aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
                      Phát
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {!searching && !query && results.length === 0 && recentVideos.length > 0 && (
              <div className="pm-recent">
                <div className="pm-recent__head">
                  <span>Đã phát gần đây</span>
                  <button type="button" onClick={loadRecent} aria-label="Làm mới danh sách gần đây">
                    <RefreshCw size={13} aria-hidden="true" />
                  </button>
                </div>
                <ul className="pm-results">
                  {recentVideos.map((item, index) => (
                    <li key={item.videoId} className={`pm-result pm-result--text${currentVideoId === item.videoId ? ' is-current' : ''}`}>
                      <span className="pm-result__index" aria-hidden="true">{index + 1}</span>
                      <div className="pm-result__body">
                        <strong title={item.title || item.videoId}>{item.title || item.videoId}</strong>
                        <span>
                          {item.channelTitle || 'YouTube'}
                          {item.lastPlayedAt ? ` · ${relativeTime(item.lastPlayedAt)}` : ''}
                        </span>
                      </div>
                      <Button
                        variant={currentVideoId === item.videoId ? 'secondary' : 'accent'}
                        size="sm"
                        onClick={() => playFromResults(item)}
                        disabled={!access.permissions.control || busyAction === `load:${item.videoId}`}
                      >
                        {busyAction === `load:${item.videoId}` ? <Loader2 size={14} className="pm-spin" aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
                        Phát
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Controls are always available on the page itself — the floating
              window is an extra, never the only way to pause or change volume. */}
          <div className="pm-inline-bar">
            <SeekBar
              currentTime={session?.currentTime || 0}
              duration={session?.durationSeconds || session?.video?.durationSeconds || 0}
              canControl={access.permissions.control}
              onSeek={seekTo}
            />
            <div className="pm-inline-bar__row">
              <div className="pm-inline-bar__transport">
                <MediaControls
                  variant="inline"
                  showVolume={false}
                  showSeek
                  session={session}
                  canControl={access.permissions.control}
                  onCommand={(action, payload) => (
                    action === 'SEEK' ? seekTo(payload?.position) : sendCommand(action, payload)
                  )}
                />
                <VolumeBar
                  volume={session?.volume ?? 100}
                  canControl={access.permissions.control}
                  onVolume={(value) => sendCommand('SET_VOLUME', { volume: value }, { track: false })}
                />
              </div>
              <span className="pm-inline-bar__state">
                {session?.video
                  ? (session.status === 'PLAYING' ? 'Đang phát' : session.status === 'PAUSED' ? 'Tạm dừng' : 'Đã dừng')
                  : 'Chưa có video'}
              </span>
            </div>
          </div>

          {/* The player stays mounted but out of view: audio keeps playing
              while nothing about the video is shown on the page. */}
          <div className="pm-audio-host" aria-hidden="true">
            <YouTubeStage
              session={session}
              socket={socket}
              canControl={access.permissions.control}
              seekSignal={seekSignal}
            />
          </div>
        </div>

        <aside className="pm-rail">
          <Card className="pm-status">
            <h2 className="pm-rail__title">Kết nối</h2>
            <ul className="pm-status__list">
              <li className={playerOnline ? 'is-on' : 'is-off'}>
                <MonitorPlay size={16} aria-hidden="true" />
                <span>Trình phát</span>
                <b>{playerOnline ? 'Đã kết nối' : 'Ngoại tuyến'}</b>
              </li>
              <li className={telegramBinding ? 'is-on' : 'is-off'}>
                <Send size={16} aria-hidden="true" />
                <span>Telegram</span>
                <b>{telegramBinding ? 'Đã liên kết' : 'Chưa liên kết'}</b>
              </li>
              <li className={activeDevices.length ? 'is-on' : 'is-off'}>
                <Keyboard size={16} aria-hidden="true" />
                <span>Mac Hotkey</span>
                <b>{activeDevices.length ? 'Đang hoạt động' : 'Chưa ghép nối'}</b>
              </li>
            </ul>
            {session?.video && (
              <p className="pm-status__hint">
                Đang phát: <strong>{session.video.title || session.video.videoId}</strong>
              </p>
            )}
          </Card>

          <Card className="pm-rail-card">
            <h2 className="pm-rail__title">
              <Users size={15} aria-hidden="true" />
              Chế độ nghe
            </h2>
            <SegmentedControl
              ariaLabel="Chế độ nghe"
              value={roomMode}
              onChange={changeRoomMode}
              options={[
                { key: 'private', label: 'Nghe riêng' },
                { key: 'shared', label: 'Nghe chung' },
              ]}
            />
            <p className="pm-rail__note">
              {roomMode === 'shared'
                ? 'Đang ở phòng nghe chung: ai có quyền cũng thấy cùng video, cùng vị trí và cùng âm lượng.'
                : 'Mặc định mỗi tài khoản nghe riêng — video, vị trí và âm lượng của bạn không ảnh hưởng người khác.'}
            </p>
          </Card>

          <Card className="pm-rail-card">
            <h2 className="pm-rail__title">
              <PictureInPicture2 size={15} aria-hidden="true" />
              Màu cửa sổ nhỏ
            </h2>
            <SegmentedControl
              ariaLabel="Màu cửa sổ nhỏ"
              value={miniTheme}
              onChange={changeMiniTheme}
              options={[
                { key: 'auto', label: 'Tự động' },
                { key: 'light', label: 'Sáng' },
                { key: 'dark', label: 'Tối' },
              ]}
            />
            <p className="pm-rail__note">
              <strong>Tự động</strong> theo giao diện sáng/tối của máy — giống thanh tab Chrome.
              Trình duyệt chặn đọc màu của tab khác nên không khớp chính xác trang đang mở được;
              khi làm việc cạnh trang nền tối, chọn <strong>Tối</strong>. Lựa chọn được ghi nhớ.
            </p>
          </Card>

          {access.permissions.telegram && (
            <Card className="pm-rail-card">
              <h2 className="pm-rail__title">
                <Send size={15} aria-hidden="true" />
                Telegram
              </h2>

              {telegramBinding ? (
                <>
                  <p className="pm-rail__text">
                    Đã liên kết với <strong>@{telegramBinding.username || telegramBinding.telegramUserId}</strong>.
                  </p>
                  <Button variant="danger" size="sm" onClick={unlinkTelegram} disabled={telegramBusy}>
                    <Trash2 size={14} aria-hidden="true" />
                    Hủy liên kết
                  </Button>
                </>
              ) : telegramCode ? (
                <>
                  <p className="pm-rail__text">
                    Gửi lệnh sau cho bot {telegramCode.botUsername ? `@${telegramCode.botUsername}` : 'Telegram'} trong{' '}
                    {Math.round(telegramCode.expiresInSeconds / 60)} phút:
                  </p>
                  <div className="pm-code">
                    <code>/start {telegramCode.code}</code>
                    <button type="button" onClick={() => copy(`/start ${telegramCode.code}`)} aria-label="Sao chép mã">
                      <Copy size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <Button variant="secondary" size="sm" onClick={refreshStatus}>
                    <Check size={14} aria-hidden="true" />
                    Tôi đã liên kết
                  </Button>
                </>
              ) : (
                <>
                  <p className="pm-rail__text">Tạo mã một lần để liên kết tài khoản Telegram với Work Rank.</p>
                  <Button variant="secondary" size="sm" onClick={createTelegramCode} disabled={telegramBusy || !status?.telegram?.enabled}>
                    <Link2 size={14} aria-hidden="true" />
                    Tạo mã liên kết
                  </Button>
                  {!status?.telegram?.enabled && (
                    <p className="pm-rail__note">Bot chưa được cấu hình trên máy chủ (TELEGRAM_BOT_TOKEN).</p>
                  )}
                </>
              )}

              {telegramNote && <p className="pm-rail__note">{telegramNote}</p>}
            </Card>
          )}

          {access.permissions.hotkey && (
            <Card className="pm-rail-card">
              <h2 className="pm-rail__title">
                <Keyboard size={15} aria-hidden="true" />
                Phím tắt toàn hệ thống
                <em className="pm-rail__optional">tùy chọn</em>
              </h2>

              <p className="pm-rail__note pm-rail__note--top">
                Không bắt buộc. Nếu chỉ cần bấm nút, dùng <strong>cửa sổ nhỏ</strong> (biểu tượng
                cạnh nút âm lượng) — nó luôn nổi trên các ứng dụng khác, không cần ghép nối.
              </p>

              <ul className="pm-devices">
                {activeDevices.length === 0 && <li className="pm-devices__empty">Chưa có thiết bị nào được ghép nối.</li>}
                {activeDevices.map((device) => (
                  <li key={device.id}>
                    <MonitorSmartphone size={15} aria-hidden="true" />
                    <div>
                      <strong>{device.name}</strong>
                      <span>{device.lastSeenAt ? `Hoạt động ${relativeTime(device.lastSeenAt)}` : 'Chưa hoạt động'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => revokeDevice(device.id)}
                      aria-label={`Thu hồi ${device.name}`}
                      title="Thu hồi thiết bị"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>

              {deviceCode ? (
                <>
                  <div className="pm-code">
                    <code>{deviceCode.code}</code>
                    <button type="button" onClick={() => copy(deviceCode.code)} aria-label="Sao chép mã ghép nối">
                      <Copy size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <p className="pm-rail__note">
                    Chạy trong thư mục <code>mac-helper</code>: <br />
                    <code>{deviceCode.helperCommand}</code>
                  </p>
                </>
              ) : (
                <Button variant="secondary" size="sm" onClick={createDeviceCode} disabled={deviceBusy}>
                  <Radio size={14} aria-hidden="true" />
                  Tạo mã ghép nối
                </Button>
              )}

              {deviceNote && <p className="pm-rail__note">{deviceNote}</p>}
            </Card>
          )}

          {access.permissions.manageAccess && (
            <Card className="pm-rail-card pm-access">
              <h2 className="pm-rail__title">
                <ShieldCheck size={15} aria-hidden="true" />
                Quản lý quyền truy cập
              </h2>

              <div className="pm-access__search">
                <Search size={15} aria-hidden="true" />
                <input
                  type="text"
                  value={peopleQuery}
                  onChange={(event) => setPeopleQuery(event.target.value)}
                  placeholder="Tìm theo tên hoặc email"
                  aria-label="Tìm người dùng để cấp quyền"
                />
                {peopleLoading && <Loader2 size={14} className="pm-spin" aria-hidden="true" />}
              </div>

              {people.length > 0 && (
                <ul className="pm-people">
                  {people.map((person) => {
                    const existing = grants.find((grant) => String(grant.userId) === String(person.id) && grant.active);
                    return (
                      <li key={person.id}>
                        <div>
                          <strong>{person.name}</strong>
                          <span>{person.email}</span>
                        </div>
                        <Button variant={existing ? 'secondary' : 'accent'} size="sm" onClick={() => openGrantDialog(person)}>
                          {existing ? 'Sửa quyền' : <><UserPlus size={14} aria-hidden="true" /> Cấp quyền</>}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="pm-grants">
                {grantsLoading ? (
                  <Skeleton height={44} />
                ) : grants.length === 0 ? (
                  <p className="pm-rail__note">Chưa cấp quyền cho ai. Chỉ bạn — chủ sở hữu — đang có quyền truy cập.</p>
                ) : (
                  grants.map((grant) => (
                    <div key={grant.id} className={`pm-grant${grant.active ? '' : ' is-revoked'}`}>
                      <div className="pm-grant__who">
                        <strong>{grant.user?.name || `#${grant.userId}`}</strong>
                        <span>{grant.user?.email || ''}</span>
                      </div>
                      <div className="pm-grant__tags">
                        {grant.isOwner && <em className="is-owner">Chủ sở hữu</em>}
                        {!grant.isOwner && grant.active && (
                          <>
                            {grant.permissions.view && <em>Xem</em>}
                            {grant.permissions.control && <em>Điều khiển</em>}
                            {grant.permissions.telegram && <em>Telegram</em>}
                            {grant.permissions.hotkey && <em>Hotkey</em>}
                          </>
                        )}
                        {!grant.active && <em className="is-revoked">Đã thu hồi</em>}
                      </div>
                      {!grant.isOwner && grant.active && (
                        <button
                          type="button"
                          className="pm-grant__revoke"
                          onClick={() => revokeGrant(grant.userId)}
                          aria-label={`Thu hồi quyền của ${grant.user?.name || grant.userId}`}
                          title="Thu hồi quyền"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}

          {access.permissions.manageAccess && (
            <Card className="pm-rail-card">
              <h2 className="pm-rail__title">
                <Cast size={15} aria-hidden="true" />
                Nhật ký gần đây
              </h2>
              {auditEntries.length === 0 ? (
                <p className="pm-rail__note">Chưa có hoạt động nào.</p>
              ) : (
                <ul className="pm-audit">
                  {auditEntries.map((entry) => (
                    <li key={entry.id}>
                      <span className={`pm-audit__dot${entry.action === 'ACCESS_DENIED' ? ' is-denied' : ''}`} aria-hidden="true" />
                      <div>
                        <strong>{AUDIT_LABEL[entry.action] || entry.action}</strong>
                        <span>
                          {entry.actor?.name || 'Hệ thống'}
                          {entry.target && entry.target.id !== entry.actor?.id ? ` → ${entry.target.name || entry.target.id}` : ''}
                          {' · '}
                          {relativeTime(entry.createdAt)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </aside>
      </div>

      <MiniPlayer
        open={miniOpen}
        pipWindow={miniWindow}
        onClose={closeMini}
        session={session}
        canControl={access.permissions.control}
        onCommand={(action, payload) => sendCommand(action, payload)}
        themeMode={miniTheme}
      />

      <AnimatedModal
        isOpen={Boolean(grantTarget)}
        onClose={() => setGrantTarget(null)}
        title={grantTarget ? `Quyền của ${grantTarget.name}` : ''}
        maxWidth={460}
        actions={(
          <>
            <Button variant="secondary" onClick={() => setGrantTarget(null)} disabled={grantSaving}>Hủy</Button>
            <Button variant="primary" onClick={submitGrant} disabled={grantSaving}>
              {grantSaving ? <Loader2 size={15} className="pm-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
              Lưu quyền
            </Button>
          </>
        )}
      >
        <p className="pm-modal__lead">
          {grantTarget?.email}
        </p>
        <div className="pm-perms">
          {[
            { key: 'view', label: 'Xem', hint: 'Mở trang và theo dõi trạng thái phát' },
            { key: 'control', label: 'Điều khiển', hint: 'Phát, tạm dừng, dừng, đổi video' },
            { key: 'telegram', label: 'Telegram', hint: 'Liên kết Telegram để điều khiển từ xa' },
            { key: 'hotkey', label: 'Hotkey', hint: 'Ghép nối Mac helper và dùng F8' },
          ].map((permission) => (
            <label key={permission.key} className={`pm-perm${grantDraft[permission.key] ? ' is-on' : ''}`}>
              <input
                type="checkbox"
                checked={Boolean(grantDraft[permission.key])}
                onChange={(event) => setGrantDraft((prev) => ({ ...prev, [permission.key]: event.target.checked }))}
              />
              <span>
                <strong>{permission.label}</strong>
                <small>{permission.hint}</small>
              </span>
            </label>
          ))}
        </div>
        {grantError && <Notice type="error" icon={X}>{grantError}</Notice>}
      </AnimatedModal>
    </PageShell>
  );
}
