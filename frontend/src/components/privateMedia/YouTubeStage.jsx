import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MonitorPlay, Play } from 'lucide-react';

/**
 * PRIVATE MEDIA — YOUTUBE STAGE
 *
 * Official YouTube IFrame Player API only. No audio extraction, no download,
 * no ad bypass, no stream proxying: the iframe is the player.
 *
 * The backend session is the source of truth. This component renders that state
 * and reports back what the browser actually did (including an autoplay refusal,
 * which is reported as AUTOPLAY_BLOCKED instead of being faked away).
 */

const YT_PLAYER_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

/**
 * Player error codes that mean "you cannot play this here", not "retry".
 * 101/150 = the uploader disabled embedding.
 */
const PLAYER_ERROR_MESSAGE = {
  2: 'Mã video không hợp lệ.',
  5: 'Trình phát gặp lỗi. Thử tải lại trang.',
  100: 'Video không tồn tại hoặc đã bị xoá.',
  101: 'Video này không cho phép nhúng. Chọn video khác.',
  150: 'Video này không cho phép nhúng. Chọn video khác.',
};

let youtubeApiPromise = null;

function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('NO_WINDOW'));
  if (window.YT && typeof window.YT.Player === 'function') return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous();
      resolve(window.YT);
    };

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => reject(new Error('YOUTUBE_API_LOAD_FAILED'));
    document.head.appendChild(script);

    // Never hang the UI if the network blocks the API.
    setTimeout(() => {
      if (window.YT && typeof window.YT.Player === 'function') resolve(window.YT);
    }, 8000);
  });

  return youtubeApiPromise;
}

// A gap larger than this between the session playhead and the player means a
// SEEK command, not heartbeat lag.
const SEEK_TOLERANCE_SECONDS = 3;

// How long a session position is treated as a possible echo of a seek we just
// performed (a heartbeat that was already in flight carries the old position).
const SEEK_ECHO_GUARD_MS = 2500;

function statusFromPlayerState(playerState) {
  switch (playerState) {
    case YT_PLAYER_STATE.PLAYING: return 'PLAYING';
    case YT_PLAYER_STATE.PAUSED: return 'PAUSED';
    case YT_PLAYER_STATE.BUFFERING: return 'LOADING';
    case YT_PLAYER_STATE.ENDED: return 'STOPPED';
    // CUED = loaded but not started. That is what the user sees when the browser
    // refuses autoplay, so report it as PAUSED instead of an eternal "loading".
    case YT_PLAYER_STATE.CUED: return 'PAUSED';
    default: return null;
  }
}

export default function YouTubeStage({ session, socket, canControl, seekSignal }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const loadedVideoIdRef = useRef(null);
  const pendingAckRef = useRef(null);
  const commandAtRef = useRef(0);
  const autoplayTimersRef = useRef([]);
  const appliedStatusRef = useRef(null);
  const needsActivationRef = useRef(false);
  // Last seek we performed: { at, target }. A stale heartbeat that still
  // carries the pre-seek position must not drag the player back.
  const lastSeekRef = useRef({ at: 0, target: 0 });

  const [ready, setReady] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [playerError, setPlayerError] = useState(null);
  const [needsActivation, setNeedsActivation] = useState(false);
  const [localTime, setLocalTime] = useState(0);
  // Bumped every time a *new* player instance becomes ready. React StrictMode
  // mounts effects twice in development, so the player can be recreated while
  // the "already loaded" refs still point at the destroyed instance — which
  // left the stage black. This counter forces a re-sync against the live player.
  const [playerGeneration, setPlayerGeneration] = useState(0);

  const video = session?.video || null;
  const desiredStatus = session?.status || 'IDLE';

  // The player instance is created once and outlives React renders, so its
  // event handlers must read the socket from a ref — a closure over the initial
  // `null` socket would silently drop every progress/hello event.
  const socketRef = useRef(socket);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  const clearAutoplayTimers = useCallback(() => {
    autoplayTimersRef.current.forEach((timer) => clearTimeout(timer));
    autoplayTimersRef.current = [];
  }, []);

  const flagAutoplayBlocked = useCallback((commandId) => {
    needsActivationRef.current = true;
    setNeedsActivation(true);
    if (commandId) {
      const player = playerRef.current;
      if (socket && player?.getPlayerState) {
        socket.emit('private-media:player-ack', {
          commandId,
          errorCode: 'AUTOPLAY_BLOCKED',
          state: {
            status: 'PAUSED',
            currentTime: player.getCurrentTime?.() || 0,
            durationSeconds: player.getDuration?.() || null,
          },
        });
      }
      return;
    }
    if (socket) {
      socket.emit('private-media:player-progress', {
        status: 'PAUSED',
        currentTime: playerRef.current?.getCurrentTime?.() || 0,
        durationSeconds: playerRef.current?.getDuration?.() || null,
      });
    }
  }, [socket]);

  /**
   * Acknowledge a command.
   *
   * The status sent here is the INTENT we just applied, never the player's
   * instantaneous state: `pauseVideo()` does not flip `getPlayerState()` on the
   * same tick, so reporting the live value would ack "still playing" and the
   * backend would immediately undo the pause. The player's real state arrives
   * right after through `onStateChange`, which is what corrects the session.
   */
  const reportAck = useCallback((commandId, errorCode = null, statusOverride = null) => {
    const player = playerRef.current;
    if (!commandId || !socket || !player?.getPlayerState) return;

    socket.emit('private-media:player-ack', {
      commandId,
      errorCode,
      state: {
        status: statusOverride || statusFromPlayerState(player.getPlayerState()) || desiredStatus,
        currentTime: typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 0,
        durationSeconds: typeof player.getDuration === 'function' ? player.getDuration() : null,
        // Volume is NOT echoed back: the player applies `setVolume()` on its next
        // tick, so reporting the instantaneous value here would undo the command
        // that just changed it (same race as the pause ack).
      },
    });
  }, [socket, desiredStatus]);

  // ── Player bootstrap (once) ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !containerRef.current || playerRef.current) return;
        playerRef.current = new YT.Player(containerRef.current, {
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              // A freshly ready player is always empty: forget what the previous
              // instance had loaded so the sync effect reloads the session video.
              loadedVideoIdRef.current = null;
              appliedStatusRef.current = null;
              needsActivationRef.current = false;
              setNeedsActivation(false);
              setPlayerError(null);
              setApiError(null);
              setReady(true);
              setPlayerGeneration((generation) => generation + 1);
              if (socketRef.current) socketRef.current.emit('private-media:player-hello', {});
            },
            onStateChange: (event) => {
              const status = statusFromPlayerState(event.data);

              // End of the video: let the backend advance the queue. This is the
              // only way forward now — there is no "next" button any more.
              if (event.data === YT_PLAYER_STATE.ENDED && socketRef.current) {
                socketRef.current.emit('private-media:player-ended', {});
              }

              if (status === 'PLAYING') {
                needsActivationRef.current = false;
                setNeedsActivation(false);
                clearAutoplayTimers();
              }
              if (status && socketRef.current) {
                socketRef.current.emit('private-media:player-progress', {
                  // While autoplay is blocked the raw player state is meaningless
                  // (BUFFERING forever); report what the viewer actually sees.
                  status: needsActivationRef.current ? 'PAUSED' : status,
                  currentTime: playerRef.current?.getCurrentTime?.() || 0,
                  durationSeconds: playerRef.current?.getDuration?.() || null,
                });
              }
            },
            onError: (event) => {
              const code = Number(event?.data) || 0;
              setPlayerError(code);
              needsActivationRef.current = false;
              setNeedsActivation(false);
              if (socketRef.current) {
                socketRef.current.emit('private-media:player-progress', { status: 'ERROR' });
              }
            },
          },
        });
      })
      .catch((error) => {
        if (!cancelled) setApiError(error.message || 'YOUTUBE_API_LOAD_FAILED');
      });

    return () => {
      cancelled = true;
      clearAutoplayTimers();
      try {
        playerRef.current?.destroy?.();
      } catch {
        // Player may already be detached.
      }
      playerRef.current = null;
    };
    // Intentionally mount-only: the player instance must survive re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-announce on every (re)connect ──────────────────────────────────────
  // Switching between private and the shared room replaces the socket. The
  // player is already ready by then, so `onReady` will not fire again — without
  // this the tab never joins the room's player channel, never receives
  // commands and the room shows "Ngoại tuyến" even though it is playing.
  useEffect(() => {
    if (!socket) return undefined;
    const announce = () => {
      if (!ready || !playerRef.current) return;
      socket.emit('private-media:player-hello', {});
    };
    socket.on('connect', announce);
    // A socket that is already connected when this effect runs (e.g. the room
    // changed but the transport was reused) must announce too.
    if (socket.connected) announce();
    return () => socket.off('connect', announce);
  }, [socket, ready]);

  // ── Command correlation: remember which command we are acknowledging ───────
  useEffect(() => {
    if (!socket) return undefined;
    const onCommand = (command) => {
      if (command?.commandId) {
        pendingAckRef.current = command.commandId;
        commandAtRef.current = Date.now();
      }
    };
    socket.on('private-media:command', onCommand);
    return () => socket.off('private-media:command', onCommand);
  }, [socket]);

  // ── Apply authoritative session state to the player ───────────────────────
  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !player?.loadVideoById) return;

    const targetVideoId = video?.videoId || null;

    if (!targetVideoId) {
      if (loadedVideoIdRef.current) {
        try { player.stopVideo(); } catch { /* detached */ }
        loadedVideoIdRef.current = null;
      }
      return;
    }

    if (loadedVideoIdRef.current !== targetVideoId) {
      loadedVideoIdRef.current = targetVideoId;
      setPlayerError(null);
      player.loadVideoById({ videoId: targetVideoId, startSeconds: Number(session?.currentTime) || 0 });

      // `loadVideoById` normally starts playback, but some uploads end up CUED
      // (loaded, waiting for a gesture) instead of autoplaying. CUED is never a
      // deliberate pause, so it is safe to offer the activation button here.
      clearAutoplayTimers();
      const cueProbe = setTimeout(() => {
        const activePlayer = playerRef.current;
        if (!activePlayer?.getPlayerState) return;
        const playerState = activePlayer.getPlayerState();
        if (playerState !== YT_PLAYER_STATE.CUED && playerState !== YT_PLAYER_STATE.UNSTARTED) return;
        needsActivationRef.current = true;
        setNeedsActivation(true);
        if (socketRef.current) {
          socketRef.current.emit('private-media:player-progress', {
            status: 'PAUSED',
            currentTime: 0,
            durationSeconds: activePlayer.getDuration?.() || null,
          });
        }
      }, 2500);
      autoplayTimersRef.current.push(cueProbe);
    } else if (desiredStatus === 'LOADING' && typeof player.playVideo === 'function') {
      // Same video selected again ("load" while it is already in the player).
      // `loadVideoById` is skipped because the id did not change, so the intent
      // of the command — start playing — has to be expressed explicitly.
      try { player.playVideo(); } catch { /* detached */ }
    }

    const volume = Number(session?.volume);
    if (Number.isFinite(volume) && typeof player.setVolume === 'function') {
      player.setVolume(volume);
    }

    // Seek reconciliation. The server owns the playhead: a SEEK command writes
    // `currentTime` and the player must follow it. Only a LARGE gap is a seek —
    // the 2-second heartbeat keeps the two within a second or two of each other,
    // so a small difference is lag, not an instruction, and seeking on it would
    // make the player fight its own progress reports.
    const serverTime = Number(session?.currentTime);
    if (Number.isFinite(serverTime) && typeof player.getCurrentTime === 'function') {
      const localTime = Number(player.getCurrentTime()) || 0;
      const gap = Math.abs(serverTime - localTime);
      // A tick that was already in flight when we seeked still reports the OLD
      // position. Treating it as an instruction would yank the video back, so a
      // value far from our own last seek target is ignored briefly.
      const sinceSeek = Date.now() - lastSeekRef.current.at;
      const staleEcho = sinceSeek < SEEK_ECHO_GUARD_MS
        && Math.abs(serverTime - lastSeekRef.current.target) > SEEK_TOLERANCE_SECONDS * 2;

      if (gap > SEEK_TOLERANCE_SECONDS && !staleEcho) {
        try {
          player.seekTo(serverTime, true);
          lastSeekRef.current = { at: Date.now(), target: serverTime };
        } catch { /* detached */ }
      }
    }

    // Reconcile against the player's REAL state, not against what we last
    // applied. A stale "already applied" marker would silently swallow a
    // pause/resume whenever the player had drifted (e.g. autoplay kicked in
    // after the fact, or a previous call was dropped while the player reloaded).
    const statusChanged = appliedStatusRef.current !== desiredStatus;
    appliedStatusRef.current = desiredStatus;
    if (statusChanged) commandAtRef.current = Date.now();
    const actualState = typeof player.getPlayerState === 'function' ? player.getPlayerState() : null;

    if (desiredStatus === 'PLAYING') {
      const needsStart = actualState !== YT_PLAYER_STATE.PLAYING && actualState !== YT_PLAYER_STATE.BUFFERING;
      if (needsStart) {
        try { player.playVideo(); } catch { /* detached */ }
      }
      // Only arm the autoplay probes when we actually had to start playback:
      // re-arming them on every buffer cycle would spam timers and could pause
      // a video that is merely slow to start.
      if (statusChanged && needsStart) {
        // Autoplay policy: the browser may refuse (or stall in BUFFERING with a
        // frozen clock). Two probes catch both shapes; if playback really did
        // not start we ask for a real click instead of faking success.
        //
        // The early probe tolerates BUFFERING: a slow first frame must not be
        // mistaken for a blocked autoplay, otherwise we would pause a video
        // that was about to start. The late probe does not tolerate it.
        clearAutoplayTimers();
        [{ delay: 1600, allowBuffering: true }, { delay: 4200, allowBuffering: false }].forEach(({ delay, allowBuffering }) => {
          const timer = setTimeout(() => {
            const activePlayer = playerRef.current;
            if (!activePlayer?.getPlayerState) return;
            const playerState = activePlayer.getPlayerState();
            const time = typeof activePlayer.getCurrentTime === 'function' ? activePlayer.getCurrentTime() : 0;

            if (playerState === YT_PLAYER_STATE.PLAYING) return;
            if (allowBuffering && playerState === YT_PLAYER_STATE.BUFFERING) return;
            if (time > 0.25) return;

            const pending = pendingAckRef.current;
            pendingAckRef.current = null;
            flagAutoplayBlocked(pending);
          }, delay);
          autoplayTimersRef.current.push(timer);
        });
      }
    } else if (desiredStatus === 'PAUSED') {
      if (actualState === YT_PLAYER_STATE.PLAYING || actualState === YT_PLAYER_STATE.BUFFERING) {
        try { player.pauseVideo(); } catch { /* detached */ }
      }
    } else if (desiredStatus === 'STOPPED') {
      if (actualState !== YT_PLAYER_STATE.ENDED) {
        try { player.stopVideo(); } catch { /* detached */ }
      }
    }

    if (pendingAckRef.current) {
      reportAck(pendingAckRef.current, null, desiredStatus);
      pendingAckRef.current = null;
    }
  }, [ready, playerGeneration, session, video, desiredStatus, reportAck, clearAutoplayTimers, flagAutoplayBlocked]);

  // ── Explicit seek (the scrub bar) ─────────────────────────────────────────
  // Applied straight from the UI intent, not from a round-trip: the command
  // response and a heartbeat can arrive in either order, and waiting for the
  // session to settle would make the thumb feel laggy.
  useEffect(() => {
    if (!seekSignal?.position) return;
    const player = playerRef.current;
    if (!player?.seekTo) return;
    const target = Math.max(0, Number(seekSignal.position) || 0);
    try {
      player.seekTo(target, true);
      lastSeekRef.current = { at: Date.now(), target };
    } catch {
      // Detached player: the session reconciliation will catch up.
    }
  }, [seekSignal]);

  // ── Progress heartbeat ────────────────────────────────────────────────────
  // Reports time always, but reports STATUS only when it is a settled state
  // (PLAYING / PAUSED / STOPPED) and no command was issued in the last 2.5s.
  // Without those guards the tick races a fresh command and pushes the stale
  // state back — pausing would resume by itself, and mid-playback buffering
  // would flip the session to LOADING while the video is clearly running.
  useEffect(() => {
    if (!ready || !canControl || !socket) return undefined;
    const timer = setInterval(() => {
      const player = playerRef.current;
      if (!player?.getCurrentTime) return;
      const time = player.getCurrentTime() || 0;
      setLocalTime(time);

      const payload = {
        currentTime: time,
        durationSeconds: player.getDuration?.() || null,
      };

      const settled = statusFromPlayerState(player.getPlayerState?.());
      const quiet = Date.now() - commandAtRef.current > 2500;
      if (quiet && (settled === 'PLAYING' || settled === 'PAUSED' || settled === 'STOPPED')) {
        payload.status = settled;
      }

      socket.emit('private-media:player-progress', payload);
    }, 2000);
    return () => clearInterval(timer);
  }, [ready, canControl, socket]);

  const activate = () => {
    needsActivationRef.current = false;
    setNeedsActivation(false);
    try {
      playerRef.current?.playVideo?.();
    } catch {
      // Detached player: the next state sync rebuilds it.
    }
    clearAutoplayTimers();
    const timer = setTimeout(() => {
      const activePlayer = playerRef.current;
      if (!activePlayer?.getPlayerState) return;
      if (activePlayer.getPlayerState() !== YT_PLAYER_STATE.PLAYING) flagAutoplayBlocked(null);
    }, 2000);
    autoplayTimersRef.current.push(timer);
  };

  const duration = Number(video?.durationSeconds) || 0;
  const progress = duration > 0 ? Math.min(100, (Number(session?.currentTime || localTime) / duration) * 100) : 0;

  return (
    <div className="pm-stage">
      <div className="pm-stage__frame">
        <div ref={containerRef} className="pm-stage__canvas" />

        {!video && (
          <div className="pm-stage__placeholder">
            <MonitorPlay size={30} aria-hidden="true" />
            <p>Chọn một video để bắt đầu</p>
            <small>Tìm ở ô phía trên hoặc dán link YouTube.</small>
          </div>
        )}

        {video && !ready && !apiError && (
          <div className="pm-stage__overlay">
            <Loader2 size={22} className="pm-spin" aria-hidden="true" />
            <span>Đang kết nối trình phát…</span>
          </div>
        )}

        {apiError && (
          <div className="pm-stage__overlay is-error">
            <span>Không tải được trình phát YouTube. Kiểm tra kết nối mạng rồi tải lại trang.</span>
          </div>
        )}

        {playerError && (
          <div className="pm-stage__overlay is-error">
            <span>{PLAYER_ERROR_MESSAGE[playerError] || 'Không phát được video này.'}</span>
          </div>
        )}

        {video && needsActivation && (
          <button type="button" className="pm-stage__activate" onClick={activate}>
            <Play size={18} aria-hidden="true" />
            Kích hoạt trình phát
          </button>
        )}
      </div>

      {video && (
        <div className="pm-stage__meta">
          <div className="pm-stage__meta-copy">
            <strong>{video.title || video.videoId}</strong>
            {video.channelTitle && <span>{video.channelTitle}</span>}
          </div>
          <span className="pm-stage__time">
            {formatTime(session?.currentTime || localTime)}
            {duration > 0 ? ` / ${formatTime(duration)}` : ''}
          </span>
        </div>
      )}

      {video && duration > 0 && (
        <div className="pm-progress" aria-hidden="true">
          <span className="pm-progress__bar" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
