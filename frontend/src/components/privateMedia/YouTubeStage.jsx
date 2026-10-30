import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Loader2, MonitorPlay, Play } from 'lucide-react';

let youtubeApiPromise;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const timer = setTimeout(() => { youtubeApiPromise = null; reject(new Error('YOUTUBE_API_TIMEOUT')); }, 15000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); previous?.(); resolve(window.YT); };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api'; script.async = true;
    script.onerror = () => { clearTimeout(timer); youtubeApiPromise = null; reject(new Error('YOUTUBE_API_LOAD_FAILED')); };
    document.head.appendChild(script);
  });
  return youtubeApiPromise;
}
export function expectedPosition(session) {
  const elapsed = session?.status === 'PLAYING' ? Math.max(0, (Date.now() - (session.receivedAt || Date.now())) / 1000) : 0;
  return Math.min(Number(session?.video?.durationSeconds) || 86400, Number(session?.currentTime || 0) + elapsed);
}

// The iframe renders server intent. Output preferences only touch this instance.
export default function YouTubeStage({ session, socket, volume = 70, muted = false, seekSignal, activationRef, onActivationNeeded, onPlayerNotice }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const live = useRef({ session, socket, volume, muted });
  live.current = { session, socket, volume, muted };
  const loadedRef = useRef(null);
  const failedTrackRef = useRef(null);
  const recoveringRef = useRef(false);
  const [recoveryGeneration, setRecoveryGeneration] = useState(0);
  const [ready, setReady] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [needsActivation, setNeedsActivation] = useState(false);
  const blockedRef = useRef(false);
  const attemptedRef = useRef(null);
  const lastSeekRef = useRef(0);

  const apply = useCallback(() => {
    const p = playerRef.current;
    const s = live.current.session;
    if (!p?.loadVideoById) return;
    const itemId = s?.currentQueueItemId;
    if (!s?.video) {
      if (loadedRef.current) p.stopVideo();
      loadedRef.current = null;
      return;
    }
    // YouTube can deliver several delayed errors after a failed load. Keep
    // their original identity and replace that iframe before loading recovery.
    if (failedTrackRef.current && failedTrackRef.current !== itemId) {
      if (!recoveringRef.current) {
        recoveringRef.current = true;
        setRecoveryGeneration((n) => n + 1);
      }
      return;
    }
    const newTrack = loadedRef.current !== itemId;
    const target = expectedPosition(s);
    if (newTrack) {
      loadedRef.current = itemId;
      attemptedRef.current = null;
      blockedRef.current = false; setNeedsActivation(false);
      const method = s.status === 'PLAYING' ? 'loadVideoById' : 'cueVideoById';
      p[method]({ videoId: s.video.videoId, startSeconds: target });
    } else if (Math.abs((p.getCurrentTime?.() || 0) - target) > 2 && Date.now() - lastSeekRef.current > 2500) {
      p.seekTo(target, true); lastSeekRef.current = Date.now();
    }
    const actual = p.getPlayerState?.();
    if (s.status === 'PLAYING' && !blockedRef.current && actual !== 1 && actual !== 3) p.playVideo();
    if (s.status === 'PAUSED' && actual !== 2 && actual !== 5) p.pauseVideo();
    if (s.status === 'STOPPED' && actual !== 0) p.stopVideo();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    loadYouTubeApi().then((YT) => {
      if (cancelled || !containerRef.current) return;
      const host = document.createElement('div');
      containerRef.current.replaceChildren(host);
      failedTrackRef.current = null;
      recoveringRef.current = false;
      playerRef.current = new YT.Player(host, {
        width: '100%', height: '100%',
        playerVars: { autoplay: 0, controls: 0, rel: 0, playsinline: 1, origin: window.location.origin },
        events: {
          onReady: () => {
            if (cancelled) return;
            loadedRef.current = null; setReady(true);
          },
          onAutoplayBlocked: () => { if (cancelled) return; blockedRef.current = true; setNeedsActivation(true); },
          onStateChange: ({ data, target }) => {
            if (cancelled) return;
            if (data === 1) { blockedRef.current = false; setNeedsActivation(false); }
            if (data === 0 && loadedRef.current && target.getVideoData?.().video_id === live.current.session?.video?.videoId) {
              live.current.socket?.emit('private-media:player-ended', { currentQueueItemId: loadedRef.current });
            }
          },
          onError: ({ data }) => {
            if (cancelled) return;
            const itemId = failedTrackRef.current || loadedRef.current;
            if (!itemId) return;
            failedTrackRef.current = itemId;
            live.current.socket?.emit('private-media:player-error', { currentQueueItemId: itemId, errorCode: data });
          },
        },
      });
    }).catch(() => { if (!cancelled) setApiError(true); });
    return () => {
      cancelled = true;
      try { playerRef.current?.destroy?.(); } catch { /* detached */ }
      playerRef.current = null;
    };
  }, [recoveryGeneration]);
  useEffect(() => {
    if (!ready || !socket) return undefined;
    const hello = () => socket.emit('private-media:player-hello', {});
    socket.on('connect', hello);
    if (socket.connected) hello();
    return () => socket.off('connect', hello);
  }, [ready, socket]);
  useEffect(() => {
    if (!ready) return;
    const p = playerRef.current;
    p.setVolume?.(volume);
    if (muted) p.mute?.(); else p.unMute?.();
  }, [ready, volume, muted]);
  useEffect(() => { if (ready) apply(); }, [ready, session, apply]);
  useEffect(() => {
    if (!ready || !seekSignal) return;
    playerRef.current?.seekTo?.(seekSignal.position, true);
    lastSeekRef.current = Date.now();
  }, [ready, seekSignal]);
  useEffect(() => {
    if (!ready) return undefined;
    const timer = setInterval(() => {
      apply();
      const p = playerRef.current;
      const s = live.current.session;
      if (s?.status === 'PLAYING' && s.video && p?.getPlayerState?.() !== 1 && p?.getPlayerState?.() !== 3) {
        if (attemptedRef.current === s.currentQueueItemId) { blockedRef.current = true; setNeedsActivation(true); }
        attemptedRef.current = s.currentQueueItemId;
      }
      live.current.socket?.emit('private-media:player-progress', { currentQueueItemId: s?.currentQueueItemId, durationSeconds: p?.getDuration?.() });
    }, 3000);
    return () => clearInterval(timer);
  }, [ready, apply]);
  useEffect(() => { onActivationNeeded?.(needsActivation); }, [needsActivation, onActivationNeeded]);
  useEffect(() => { if (apiError) onPlayerNotice?.('Không tải được trình phát YouTube. Kiểm tra mạng rồi tải lại trang.'); }, [apiError, onPlayerNotice]);
  const activate = () => {
    blockedRef.current = false; setNeedsActivation(false);
    playerRef.current?.seekTo?.(expectedPosition(live.current.session), true);
    playerRef.current?.playVideo?.();
  };
  useImperativeHandle(activationRef, () => ({ activate }));
  return (
    <div className="pm-stage">
      <div className="pm-stage__frame">
        <div ref={containerRef} className="pm-stage__canvas" />
        {!session?.video && <div className="pm-stage__placeholder"><MonitorPlay size={30} /><p>Chọn một video để bắt đầu</p></div>}
        {session?.video && !ready && !apiError && <div className="pm-stage__overlay"><Loader2 size={22} className="pm-spin" /><span>Đang kết nối trình phát…</span></div>}
        {apiError && <div className="pm-stage__overlay is-error">Không tải được trình phát YouTube. Kiểm tra mạng rồi tải lại trang.</div>}
        {session?.video && needsActivation && <button type="button" className="pm-stage__activate" onClick={activate}><Play size={18} /> Kích hoạt trình phát</button>}
      </div>
    </div>
  );
}
export function formatTime(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600), m = Math.floor(total % 3600 / 60), s = total % 60;
  return `${h > 0 ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(s).padStart(2, '0')}`;
}
