import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp, Cast, Check, Copy, Keyboard, Link2, Loader2, MonitorPlay,
  MonitorSmartphone, PictureInPicture2, Play, Plus, Radio, RefreshCw, Search,
  Send, ShieldCheck, SkipForward, Trash2, UserPlus, Users, X,
} from 'lucide-react';
import {
  PageShell, PageHeader, Card, Button, Notice, AnimatedModal, SegmentedControl,
  Skeleton, AnimatedList, AnimatedListItem,
} from '../components/ui';
import MiniPlayer, { MediaControls, PIP_WIDTH, PIP_HEIGHT } from '../components/privateMedia/MiniPlayer';
import SeekBar from '../components/privateMedia/SeekBar';
import VolumeBar from '../components/privateMedia/VolumeBar';
import ChatPanel from '../components/privateMedia/ChatPanel';
import PlaylistPanel from '../components/privateMedia/PlaylistPanel';
import { formatTime } from '../components/privateMedia/mediaTime';
import useMediaClock from '../hooks/useMediaClock';
import { usePrivateMedia } from '../context/PrivateMediaContext';
import { privateMediaApi, codeFrom, messageFrom } from '../services/privateMediaApi';
import { useAuth } from '../context/AuthContext';
import './privateMedia.css';

/**
 * PRIVATE MEDIA — page
 *
 * This page no longer owns the player, the socket or the session. They live in
 * `PrivateMediaProvider` at the app shell, so leaving the page cannot stop the
 * music. Here we only reserve the slot the player docks into and render the
 * controls, chat and playlist library around it.
 */

const MINI_THEME_KEY = 'workrank:private-media:mini-theme';

function looksLikeYouTubeInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return true;
  return /(youtube\.com|youtu\.be)/i.test(raw);
}

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
  JOIN_LISTENING_SESSION: 'Vào nghe chung',
  LEAVE_LISTENING_SESSION: 'Rời nghe chung',
  QUEUE_ADD: 'Thêm bài vào hàng chờ',
  QUEUE_REMOVE: 'Xóa bài khỏi hàng chờ',
  QUEUE_REORDER: 'Sắp xếp hàng chờ',
  QUEUE_CLEAR: 'Xóa hàng chờ',
  AUTO_ADVANCE: 'Tự chuyển bài',
  PLAYLIST_PLAY: 'Phát danh sách',
  PLAYLIST_SHUFFLE: 'Phát ngẫu nhiên',
  PLAYLIST_QUEUE: 'Đưa danh sách vào hàng chờ',
  PLAYLIST_CREATE: 'Tạo danh sách phát',
  PLAYLIST_DELETE: 'Xóa danh sách phát',
  PLAYLIST_IMPORT: 'Nhập playlist',
};

/**
 * The transport is its own component so the 1s clock only re-renders this bar,
 * never the page, the chat or the playlist library.
 */
function TransportBar({ canControl, activationNeeded, onActivate }) {
  const { session, seekTo, sendCommand, volume } = usePrivateMedia();
  const currentTime = useMediaClock(session);
  const duration = Number(session?.durationSeconds) || Number(session?.video?.durationSeconds) || 0;

  return (
    <div className="pm-inline-bar">
      <SeekBar
        currentTime={currentTime}
        duration={duration}
        canControl={canControl}
        onSeek={seekTo}
      />
      <div className="pm-inline-bar__row">
        <div className="pm-inline-bar__transport">
          <MediaControls
            variant="inline"
            showVolume={false}
            showSeek
            session={session ? { ...session, currentTime } : null}
            canControl={canControl}
            onCommand={(action, payload) => (action === 'SEEK' ? seekTo(payload?.position) : sendCommand(action, payload))}
          />
          <span className="pm-volume-label">Âm lượng của bạn</span>
          <VolumeBar volume={volume.volume} muted={volume.muted} onToggleMute={volume.toggleMute} onVolume={volume.setVolume} />
        </div>
        <span className="pm-inline-bar__state">
          {session?.video
            ? (session.status === 'PLAYING' ? 'Đang phát' : session.status === 'PAUSED' ? 'Tạm dừng' : 'Đã dừng')
            : 'Chưa có video'}
        </span>
      </div>
      {activationNeeded && (
        <button type="button" className="pm-btn pm-btn--accent" onClick={onActivate}>
          <Play size={15} aria-hidden="true" /> Kích hoạt trình phát trên thiết bị này
        </button>
      )}
    </div>
  );
}

export default function PrivateMedia() {
  const { user } = useAuth();
  const pm = usePrivateMedia();
  const { session, status, accessLoading, permissions, playlists } = pm;

  // ── Search / paste link ──────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState(null);
  const [recentVideos, setRecentVideos] = useState([]);

  const searchAvailable = status ? Boolean(status.youtube?.search) : true;
  const currentVideoId = session?.video?.videoId || null;
  const canControl = permissions.control;
  const canQueue = permissions.queue;

  const loadRecent = useCallback(async () => {
    try {
      const data = await privateMediaApi.getRecent(10);
      setRecentVideos(data.videos || []);
    } catch {
      setRecentVideos([]);
    }
  }, []);

  useEffect(() => { loadRecent(); }, [loadRecent, pm.roomMode, session?.video?.videoId]);

  const loadVideo = useCallback(async (video, queue = [], options = {}) => {
    if (!video?.videoId) return null;
    const enqueue = !options.playNow && pm.roomMode === 'shared';
    return pm.sendCommand(enqueue ? 'QUEUE_ADD' : 'LOAD_VIDEO', { ...video, queue }, { busyKey: `load:${video.videoId}` });
  }, [pm]);

  const runSearch = useCallback(async (event) => {
    event?.preventDefault?.();
    const term = query.trim();
    if (!term) return;
    setSearching(true);
    setSearchNote(null);
    setResults([]);
    try {
      const tokens = term.split(/[\s,]+/).map((token) => token.trim()).filter(Boolean);
      const allLinks = tokens.length > 0 && tokens.every(looksLikeYouTubeInput);

      if (allLinks) {
        const resolved = [];
        for (const token of tokens.slice(0, 20)) {
          try {
            const { video } = await privateMediaApi.resolveYouTube(token);
            if (video?.videoId && !resolved.some((item) => item.videoId === video.videoId)) resolved.push(video);
          } catch { /* skip a broken link */ }
        }
        if (!resolved.length) { setSearchNote('Không đọc được link nào. Kiểm tra lại link YouTube.'); return; }
        setResults(resolved);
        await loadVideo(resolved[0], resolved);
        setSearchNote(resolved.length > 1
          ? `Đã nạp ${resolved.length} video vào danh sách phát — hết bài sẽ tự chuyển bài.`
          : 'Đã thêm video. Nếu đang có bài phát, bài mới nằm trong hàng chờ.');
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

  const addResultToPlaylist = useCallback(async (item) => {
    if (!playlists.detail?.editable) return;
    const result = await playlists.addItems(playlists.detail.id, [item]);
    if (result) setSearchNote(`Đã thêm “${item.title || item.videoId}” vào ${playlists.detail.title}.`);
  }, [playlists]);

  // ── Mini window (Document Picture-in-Picture) ────────────────────────────
  const [miniOpen, setMiniOpen] = useState(false);
  const [miniWindow, setMiniWindow] = useState(null);
  const [miniNote, setMiniNote] = useState(null);
  const miniWindowRef = useRef(null);
  const [miniTheme, setMiniTheme] = useState(() => {
    try {
      const stored = localStorage.getItem(MINI_THEME_KEY);
      return stored === 'light' || stored === 'dark' ? stored : 'auto';
    } catch {
      return 'auto';
    }
  });

  const closeMini = useCallback(() => {
    setMiniOpen(false);
    const win = miniWindowRef.current;
    miniWindowRef.current = null;
    setMiniWindow(null);
    try { win?.close(); } catch { /* already closed */ }
  }, []);

  const openMini = useCallback(async () => {
    setMiniNote(null);
    if (miniOpen) { closeMini(); return; }
    if (typeof window === 'undefined' || !window.isSecureContext) {
      setMiniNote('Cửa sổ nổi cần HTTPS hoặc localhost. Trang đang chạy qua HTTP nên chỉ dùng thanh điều khiển trong trang (vẫn đủ 5 nút).');
      return;
    }
    if (!('documentPictureInPicture' in window)) {
      setMiniNote('Trình duyệt này không hỗ trợ cửa sổ nổi (cần Chrome/Edge 116+). Dùng thanh điều khiển trong trang — vẫn đủ 5 nút.');
      return;
    }
    try {
      const win = await window.documentPictureInPicture.requestWindow({ width: PIP_WIDTH, height: PIP_HEIGHT, disallowReturnToOpener: false });
      miniWindowRef.current = win;
      const enforceSize = () => { try { win.resizeTo(PIP_WIDTH, PIP_HEIGHT); } catch { /* unsupported */ } };
      enforceSize();
      setTimeout(enforceSize, 120);
      setTimeout(enforceSize, 500);
      setMiniWindow(win);
      setMiniOpen(true);
    } catch (error) {
      setMiniNote(`Không mở được cửa sổ nổi (${error?.name || 'lỗi'}). Dùng thanh điều khiển trong trang.`);
    }
  }, [miniOpen, closeMini]);

  // The controller belongs to the shell now, so the window survives navigation.
  useEffect(() => () => {
    const win = miniWindowRef.current;
    miniWindowRef.current = null;
    try { win?.close(); } catch { /* already closed */ }
  }, []);

  const changeMiniTheme = (value) => {
    setMiniTheme(value);
    try { localStorage.setItem(MINI_THEME_KEY, value); } catch { /* private mode */ }
  };

  // ── Owner: access management ─────────────────────────────────────────────
  const [grants, setGrants] = useState([]);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [grantTarget, setGrantTarget] = useState(null);
  const [grantDraft, setGrantDraft] = useState({ view: true, queue: true, control: true, telegram: false, hotkey: false });
  const [grantSaving, setGrantSaving] = useState(false);
  const [grantError, setGrantError] = useState(null);
  const [auditEntries, setAuditEntries] = useState([]);
  const [telegramCode, setTelegramCode] = useState(null);
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [telegramNote, setTelegramNote] = useState(null);
  const [deviceCode, setDeviceCode] = useState(null);
  const [deviceNote, setDeviceNote] = useState(null);
  const [deviceBusy, setDeviceBusy] = useState(false);

  const loadGrants = useCallback(async () => {
    if (!permissions.manageAccess) return;
    setGrantsLoading(true);
    try {
      const data = await privateMediaApi.listGrants();
      setGrants(data.grants || []);
    } catch {
      setGrants([]);
    } finally {
      setGrantsLoading(false);
    }
  }, [permissions.manageAccess]);

  const loadAudit = useCallback(async () => {
    if (!permissions.manageAccess) return;
    try {
      const data = await privateMediaApi.listAudit(30);
      setAuditEntries(data.entries || []);
    } catch {
      setAuditEntries([]);
    }
  }, [permissions.manageAccess]);

  useEffect(() => { loadGrants(); }, [loadGrants]);
  useEffect(() => { loadAudit(); }, [loadAudit]);

  useEffect(() => {
    if (!permissions.manageAccess) return undefined;
    const term = peopleQuery.trim();
    if (term.length < 2) { setPeople([]); return undefined; }
    let active = true;
    setPeopleLoading(true);
    const timer = setTimeout(() => {
      privateMediaApi.searchUsers(term)
        .then((data) => { if (active) setPeople(data.users || []); })
        .catch(() => { if (active) setPeople([]); })
        .finally(() => { if (active) setPeopleLoading(false); });
    }, 280);
    return () => { active = false; clearTimeout(timer); };
  }, [peopleQuery, permissions.manageAccess]);

  const openGrantDialog = (person) => {
    setGrantTarget(person);
    setGrantError(null);
    const existing = grants.find((grant) => String(grant.userId) === String(person.id) && grant.active);
    setGrantDraft(existing ? { ...existing.permissions } : { view: true, queue: true, control: true, telegram: false, hotkey: false });
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
      pm.setError(messageFrom(err, 'Không thu hồi được quyền.'));
    }
  };

  const createTelegramCode = async () => {
    setTelegramBusy(true);
    setTelegramNote(null);
    try {
      setTelegramCode(await privateMediaApi.createTelegramCode());
    } catch (err) {
      setTelegramNote(codeFrom(err) === 'TELEGRAM_DISABLED'
        ? 'Bot Telegram chưa được cấu hình trên máy chủ (TELEGRAM_BOT_TOKEN).'
        : messageFrom(err, 'Không tạo được mã liên kết.'));
    } finally {
      setTelegramBusy(false);
    }
  };

  const unlinkTelegram = async () => {
    setTelegramBusy(true);
    try {
      await privateMediaApi.unbindTelegram();
      setTelegramCode(null);
      await pm.refreshStatus();
    } catch (err) {
      setTelegramNote(messageFrom(err, 'Không hủy được liên kết.'));
    } finally {
      setTelegramBusy(false);
    }
  };

  const createDeviceCode = async () => {
    setDeviceBusy(true);
    setDeviceNote(null);
    try {
      setDeviceCode(await privateMediaApi.createDeviceCode());
    } catch (err) {
      setDeviceNote(messageFrom(err, 'Không tạo được mã ghép nối.'));
    } finally {
      setDeviceBusy(false);
    }
  };

  const revokeDevice = async (id) => {
    try {
      await privateMediaApi.revokeDevice(id);
      await pm.refreshStatus();
    } catch (err) {
      setDeviceNote(messageFrom(err, 'Không thu hồi được thiết bị.'));
    }
  };

  const copy = async (value) => {
    try { await navigator.clipboard.writeText(value); } catch { /* clipboard blocked */ }
  };

  const telegramBinding = status?.telegram?.binding || null;
  const activeDevices = useMemo(() => (status?.devices || []).filter((device) => device.active), [status?.devices]);
  const playerOnline = Boolean(session?.playerOnline) && pm.socketConnected;

  if (accessLoading) return null;
  // The route guard owns the "no access" presentation; this is only a render
  // guard so the page never mounts against a missing entitlement.
  if (!pm.entitled) return null;

  return (
    <PageShell className="pm-page">
      <PageHeader
        eyebrow="RIÊNG TƯ"
        title="Điều khiển media"
        description="Tìm và điều khiển video từ xa bằng Telegram hoặc bàn phím."
        actions={(
          <>
            <Button variant="secondary" size="sm" onClick={pm.refreshStatus} disabled={pm.loading}>
              <RefreshCw size={14} aria-hidden="true" /> Làm mới
            </Button>
            <Button variant={miniOpen ? 'primary' : 'accent'} size="sm" onClick={openMini}>
              <PictureInPicture2 size={14} aria-hidden="true" />
              {miniOpen ? 'Đóng cửa sổ nhỏ' : 'Cửa sổ nhỏ'}
            </Button>
          </>
        )}
      />

      {miniNote && <div className="pm-inline-notice"><Notice type="info" icon={PictureInPicture2}>{miniNote}</Notice></div>}
      {pm.error && <div className="pm-inline-notice"><Notice type="error" icon={X}>{pm.error}</Notice></div>}

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
                  placeholder={searchAvailable ? 'Tìm video YouTube hoặc dán link…' : 'Dán link YouTube — nhiều link cách nhau bởi dấu cách…'}
                  aria-label="Tìm video YouTube hoặc dán link"
                  spellCheck={false}
                />
                {query && (
                  <button type="button" className="pm-search__clear" onClick={() => { setQuery(''); setResults([]); setSearchNote(null); }} aria-label="Xóa nội dung tìm kiếm">
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
              <Button type="submit" variant="primary" disabled={searching || !query.trim()}>
                {searching ? <Loader2 size={15} className="pm-spin" aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
                {searchAvailable ? 'Tìm' : pm.roomMode === 'shared' ? 'Thêm bài' : 'Phát'}
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
                    <div className="pm-result__body"><Skeleton height={13} width="70%" /><Skeleton height={11} width="40%" /></div>
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
                    {playlists.detail?.editable && (
                      <Button size="sm" variant="secondary" aria-label={`Thêm ${item.title} vào ${playlists.detail.title}`} onClick={() => addResultToPlaylist(item)} disabled={playlists.busy}>
                        <Plus size={14} aria-hidden="true" />
                      </Button>
                    )}
                    <Button
                      variant={currentVideoId === item.videoId ? 'secondary' : 'accent'}
                      size="sm"
                      onClick={() => loadVideo(item)}
                      disabled={!(pm.roomMode === 'shared' ? canQueue : canControl) || pm.busyAction === `load:${item.videoId}`}
                    >
                      {pm.busyAction === `load:${item.videoId}` ? <Loader2 size={14} className="pm-spin" aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
                      {pm.roomMode === 'shared' ? 'Thêm vào hàng chờ' : 'Phát'}
                    </Button>
                    {pm.roomMode === 'shared' && (
                      <Button size="sm" variant="secondary" disabled={!canControl || Boolean(pm.busyAction)} onClick={() => loadVideo(item, [], { playNow: true })}>
                        Phát ngay
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!searching && !query && results.length === 0 && recentVideos.length > 0 && (
              <div className="pm-recent">
                <div className="pm-recent__head">
                  <span>Đã phát gần đây</span>
                  <button type="button" onClick={loadRecent} aria-label="Làm mới danh sách gần đây"><RefreshCw size={13} aria-hidden="true" /></button>
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
                        onClick={() => loadVideo(item)}
                        disabled={!(pm.roomMode === 'shared' ? canQueue : canControl) || pm.busyAction === `load:${item.videoId}`}
                      >
                        {pm.busyAction === `load:${item.videoId}` ? <Loader2 size={14} className="pm-spin" aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
                        {pm.roomMode === 'shared' ? 'Thêm vào hàng chờ' : 'Phát'}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Audio-only: there is no video surface. The iframe lives off-screen
              in the app shell and keeps playing across routes. */}
          <Card className="pm-now">
            <div className="pm-now__head">
              <div className="pm-now__art" aria-hidden="true">
                <Radio size={20} />
              </div>
              <div className="pm-now__meta">
                <span className="pm-now__eyebrow">
                  <span className={`pm-now__dot${session?.status === 'PLAYING' ? ' is-live' : ''}`} aria-hidden="true" />
                  Chỉ phát âm thanh
                </span>
                <h2 title={session?.video?.title || ''}>
                  {session?.video?.title || 'Chưa có video nào đang phát'}
                </h2>
                <p>
                  {session?.video
                    ? (session.video.channelTitle || 'YouTube')
                    : 'Chọn video từ ô tìm kiếm, danh sách phát hoặc hàng chờ bên dưới.'}
                </p>
              </div>
              <span className="pm-now__state">
                {session?.video
                  ? (session.status === 'PLAYING' ? 'Đang phát' : session.status === 'PAUSED' ? 'Tạm dừng' : 'Đã dừng')
                  : 'Chưa có video'}
              </span>
            </div>

            <TransportBar
              canControl={canControl}
              activationNeeded={pm.player.activationNeeded}
              onActivate={() => pm.player.activationRef.current?.activate()}
            />

            {pm.player.otherTab && (
              <p className="pm-now__handoff">
                Tab này đang tắt tiếng để tránh trùng âm thanh.
                {' '}
                <button type="button" className="pm-link" onClick={pm.player.takeOver}>Phát ở tab này</button>
              </p>
            )}
            {pm.player.notice && <p className="pm-search__note" role="status">{pm.player.notice}</p>}
          </Card>

          <PlaylistPanel canPlay={canControl} canQueue={canQueue} />

          <Card className="pm-queue-card">
            <div className="pm-queue-card__head">
              <h2>Đang chờ · {session?.queue?.length || 0}</h2>
              {session?.playlist && (
                <span className="pm-queue-card__source">
                  {session.playlist.title} · {session.playlist.mode === 'shuffle' ? 'ngẫu nhiên' : 'tuần tự'} · còn {session.playlist.remaining}/{session.playlist.total}
                </span>
              )}
            </div>

            {session?.playlist?.next && (
              <p className="pm-queue-card__next">
                <strong>Tiếp theo từ danh sách:</strong> {session.playlist.next.title || session.playlist.next.videoId}
              </p>
            )}

            {session?.queue?.length ? (
              <AnimatedList className="pm-queue">
                {session.queue.map((item, index) => (
                  <AnimatedListItem key={item.id} index={index} className="pm-queue__row">
                    <span>{index + 1}</span>
                    <strong>{item.title || item.videoId}</strong>
                    {item.source === 'playlist' && <em className="pm-queue__tag">playlist</em>}
                    {canControl && (
                      <>
                        <button
                          type="button"
                          disabled={index === 0 || Boolean(pm.busyAction)}
                          aria-label={`Đưa ${item.title} lên trước`}
                          onClick={() => {
                            const ids = session.queue.map((entry) => entry.id);
                            [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                            pm.sendCommand('QUEUE_REORDER', { itemIds: ids });
                          }}
                        >
                          <ArrowUp size={16} aria-hidden="true" />
                        </button>
                        <button type="button" disabled={Boolean(pm.busyAction)} aria-label={`Xóa ${item.title} khỏi hàng chờ`} onClick={() => pm.sendCommand('QUEUE_REMOVE', { itemId: item.id })}>
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </AnimatedListItem>
                ))}
              </AnimatedList>
            ) : (
              <p className="pm-rail__note">Hàng chờ đang trống. Bài thêm thủ công luôn phát trước danh sách đang chạy.</p>
            )}

            <div className="pm-queue-card__actions">
              <Button size="sm" variant="secondary" disabled={!canControl || !session?.video || Boolean(pm.busyAction)} onClick={() => pm.sendCommand('NEXT')}>
                <SkipForward size={15} aria-hidden="true" /> Bài tiếp theo
              </Button>
              {canControl && session?.queue?.length > 0 && (
                <Button size="sm" variant="secondary" disabled={Boolean(pm.busyAction)} onClick={() => pm.sendCommand('QUEUE_CLEAR')}>
                  Xóa hàng chờ
                </Button>
              )}
            </div>
          </Card>
        </div>

        <aside className="pm-rail">
          <ChatPanel userId={user?.id} />

          <Card className="pm-status">
            <h2 className="pm-rail__title">Kết nối</h2>
            <ul className="pm-status__list">
              <li className={playerOnline ? 'is-on' : 'is-off'}>
                <MonitorPlay size={16} aria-hidden="true" /><span>Trình phát</span>
                <b>{playerOnline ? 'Đã kết nối' : 'Ngoại tuyến'}</b>
              </li>
              <li className={telegramBinding ? 'is-on' : 'is-off'}>
                <Send size={16} aria-hidden="true" /><span>Telegram</span>
                <b>{telegramBinding ? 'Đã liên kết' : 'Chưa liên kết'}</b>
              </li>
              <li className={activeDevices.length ? 'is-on' : 'is-off'}>
                <Keyboard size={16} aria-hidden="true" /><span>Mac Hotkey</span>
                <b>{activeDevices.length ? 'Đang hoạt động' : 'Chưa ghép nối'}</b>
              </li>
            </ul>
            {session?.video && (
              <p className="pm-status__hint">Đang phát: <strong>{session.video.title || session.video.videoId}</strong></p>
            )}
            {pm.player.otherTab && (
              <p className="pm-status__hint">
                Tab này không phát âm thanh. <button type="button" className="pm-link" onClick={pm.player.takeOver}>Phát ở tab này</button>
              </p>
            )}
          </Card>

          <Card className="pm-rail-card">
            <h2 className="pm-rail__title"><Users size={15} aria-hidden="true" /> Chế độ nghe</h2>
            <SegmentedControl
              ariaLabel="Chế độ nghe"
              value={pm.roomMode}
              onChange={pm.setRoomMode}
              options={[{ key: 'private', label: 'Nghe riêng' }, { key: 'shared', label: 'Nghe chung' }]}
            />
            <p className="pm-rail__note">
              {pm.roomMode === 'shared'
                ? 'Bài hát, timeline, hàng chờ và chat dùng chung. Âm lượng và tắt tiếng chỉ áp dụng cho bạn.'
                : 'Phiên nghe riêng của bạn. Âm lượng được ghi nhớ trên thiết bị này.'}
            </p>
          </Card>

          <Card className="pm-rail-card">
            <h2 className="pm-rail__title"><PictureInPicture2 size={15} aria-hidden="true" /> Màu cửa sổ nhỏ</h2>
            <SegmentedControl
              ariaLabel="Màu cửa sổ nhỏ"
              value={miniTheme}
              onChange={changeMiniTheme}
              options={[{ key: 'auto', label: 'Tự động' }, { key: 'light', label: 'Sáng' }, { key: 'dark', label: 'Tối' }]}
            />
            <p className="pm-rail__note">
              <strong>Tự động</strong> theo giao diện sáng/tối của máy — giống thanh tab Chrome.
              Trình duyệt chặn đọc màu của tab khác nên không khớp chính xác trang đang mở được.
            </p>
          </Card>

          {permissions.telegram && (
            <Card className="pm-rail-card">
              <h2 className="pm-rail__title"><Send size={15} aria-hidden="true" /> Telegram</h2>
              {telegramBinding ? (
                <>
                  <p className="pm-rail__text">Đã liên kết với <strong>@{telegramBinding.username || telegramBinding.telegramUserId}</strong>.</p>
                  <Button variant="danger" size="sm" onClick={unlinkTelegram} disabled={telegramBusy}><Trash2 size={14} aria-hidden="true" /> Hủy liên kết</Button>
                </>
              ) : telegramCode ? (
                <>
                  <p className="pm-rail__text">
                    Gửi lệnh sau cho bot {telegramCode.botUsername ? `@${telegramCode.botUsername}` : 'Telegram'} trong {Math.round(telegramCode.expiresInSeconds / 60)} phút:
                  </p>
                  <div className="pm-code">
                    <code>/start {telegramCode.code}</code>
                    <button type="button" onClick={() => copy(`/start ${telegramCode.code}`)} aria-label="Sao chép mã"><Copy size={14} aria-hidden="true" /></button>
                  </div>
                  <Button variant="secondary" size="sm" onClick={pm.refreshStatus}><Check size={14} aria-hidden="true" /> Tôi đã liên kết</Button>
                </>
              ) : (
                <>
                  <p className="pm-rail__text">Tạo mã một lần để liên kết tài khoản Telegram với Work Rank.</p>
                  <Button variant="secondary" size="sm" onClick={createTelegramCode} disabled={telegramBusy || !status?.telegram?.enabled}>
                    <Link2 size={14} aria-hidden="true" /> Tạo mã liên kết
                  </Button>
                  {!status?.telegram?.enabled && <p className="pm-rail__note">Bot chưa được cấu hình trên máy chủ (TELEGRAM_BOT_TOKEN).</p>}
                </>
              )}
              {telegramNote && <p className="pm-rail__note">{telegramNote}</p>}
            </Card>
          )}

          {permissions.hotkey && (
            <Card className="pm-rail-card">
              <h2 className="pm-rail__title"><Keyboard size={15} aria-hidden="true" /> Phím tắt toàn hệ thống <em className="pm-rail__optional">tùy chọn</em></h2>
              <p className="pm-rail__note pm-rail__note--top">
                Không bắt buộc. Nếu chỉ cần bấm nút, dùng <strong>cửa sổ nhỏ</strong> — nó luôn nổi trên các ứng dụng khác, không cần ghép nối.
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
                    <button type="button" onClick={() => revokeDevice(device.id)} aria-label={`Thu hồi ${device.name}`} title="Thu hồi thiết bị">
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              {deviceCode ? (
                <>
                  <div className="pm-code">
                    <code>{deviceCode.code}</code>
                    <button type="button" onClick={() => copy(deviceCode.code)} aria-label="Sao chép mã ghép nối"><Copy size={14} aria-hidden="true" /></button>
                  </div>
                  <p className="pm-rail__note">Chạy trong thư mục <code>mac-helper</code>:<br /><code>{deviceCode.helperCommand}</code></p>
                </>
              ) : (
                <Button variant="secondary" size="sm" onClick={createDeviceCode} disabled={deviceBusy}><Radio size={14} aria-hidden="true" /> Tạo mã ghép nối</Button>
              )}
              {deviceNote && <p className="pm-rail__note">{deviceNote}</p>}
            </Card>
          )}

          {permissions.manageAccess && (
            <Card className="pm-rail-card pm-access">
              <h2 className="pm-rail__title"><ShieldCheck size={15} aria-hidden="true" /> Quản lý quyền truy cập</h2>
              <div className="pm-access__search">
                <Search size={15} aria-hidden="true" />
                <input type="text" value={peopleQuery} onChange={(event) => setPeopleQuery(event.target.value)} placeholder="Tìm theo tên hoặc email" aria-label="Tìm người dùng để cấp quyền" />
                {peopleLoading && <Loader2 size={14} className="pm-spin" aria-hidden="true" />}
              </div>
              {people.length > 0 && (
                <ul className="pm-people">
                  {people.map((person) => {
                    const existing = grants.find((grant) => String(grant.userId) === String(person.id) && grant.active);
                    return (
                      <li key={person.id}>
                        <div><strong>{person.name}</strong><span>{person.email}</span></div>
                        <Button variant={existing ? 'secondary' : 'accent'} size="sm" onClick={() => openGrantDialog(person)}>
                          {existing ? 'Sửa quyền' : <><UserPlus size={14} aria-hidden="true" /> Cấp quyền</>}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="pm-grants">
                {grantsLoading ? <Skeleton height={44} /> : grants.length === 0 ? (
                  <p className="pm-rail__note">Chưa cấp quyền cho ai. Chỉ bạn — chủ sở hữu — đang có quyền truy cập.</p>
                ) : grants.map((grant) => (
                  <div key={grant.id} className={`pm-grant${grant.active ? '' : ' is-revoked'}`}>
                    <div className="pm-grant__who">
                      <strong>{grant.user?.name || `#${grant.userId}`}</strong>
                      <span>{grant.user?.email || ''}</span>
                    </div>
                    <div className="pm-grant__tags">
                      {grant.isOwner && <em className="is-owner">Chủ sở hữu</em>}
                      {!grant.isOwner && grant.active && (
                        <>
                          {grant.permissions.view && <em>Nghe</em>}
                          {grant.permissions.queue && <em>Thêm bài</em>}
                          {grant.permissions.control && <em>Điều khiển</em>}
                          {grant.permissions.telegram && <em>Telegram</em>}
                          {grant.permissions.hotkey && <em>Hotkey</em>}
                        </>
                      )}
                      {!grant.active && <em className="is-revoked">Đã thu hồi</em>}
                    </div>
                    {!grant.isOwner && grant.active && (
                      <button type="button" className="pm-grant__revoke" onClick={() => revokeGrant(grant.userId)} aria-label={`Thu hồi quyền của ${grant.user?.name || grant.userId}`} title="Thu hồi quyền">
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {permissions.manageAccess && (
            <Card className="pm-rail-card">
              <h2 className="pm-rail__title"><Cast size={15} aria-hidden="true" /> Nhật ký gần đây</h2>
              {auditEntries.length === 0 ? <p className="pm-rail__note">Chưa có hoạt động nào.</p> : (
                <ul className="pm-audit">
                  {auditEntries.map((entry) => (
                    <li key={entry.id}>
                      <span className={`pm-audit__dot${entry.action === 'ACCESS_DENIED' ? ' is-denied' : ''}`} aria-hidden="true" />
                      <div>
                        <strong>{AUDIT_LABEL[entry.action] || entry.action}</strong>
                        <span>
                          {entry.actor?.name || 'Hệ thống'}
                          {entry.target && entry.target.id !== entry.actor?.id ? ` → ${entry.target.name || entry.target.id}` : ''}
                          {' · '}{relativeTime(entry.createdAt)}
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
        volume={pm.volume.muted ? 0 : pm.volume.volume}
        onVolume={pm.volume.setVolume}
        session={session}
        canControl={canControl}
        onCommand={(action, payload) => pm.sendCommand(action, payload)}
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
              {grantSaving ? <Loader2 size={15} className="pm-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />} Lưu quyền
            </Button>
          </>
        )}
      >
        <p className="pm-modal__lead">{grantTarget?.email}</p>
        <div className="pm-perms">
          {[
            { key: 'view', label: 'Xem', hint: 'Mở trang và theo dõi trạng thái phát' },
            { key: 'queue', label: 'Thêm bài', hint: 'Thêm video vào hàng chờ chung' },
            { key: 'control', label: 'Điều khiển', hint: 'Phát, tạm dừng, dừng, đổi video' },
            { key: 'telegram', label: 'Telegram', hint: 'Liên kết Telegram để điều khiển từ xa' },
            { key: 'hotkey', label: 'Hotkey', hint: 'Ghép nối Mac helper và dùng F8' },
          ].map((permission) => (
            <label key={permission.key} className={`pm-perm${grantDraft[permission.key] ? ' is-on' : ''}`}>
              <input
                type="checkbox"
                checked={Boolean(grantDraft[permission.key])}
                onChange={(event) => setGrantDraft((previous) => ({ ...previous, [permission.key]: event.target.checked }))}
              />
              <span><strong>{permission.label}</strong><small>{permission.hint}</small></span>
            </label>
          ))}
        </div>
        {grantError && <Notice type="error" icon={X}>{grantError}</Notice>}
      </AnimatedModal>
    </PageShell>
  );
}
