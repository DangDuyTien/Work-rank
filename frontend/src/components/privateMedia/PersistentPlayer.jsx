import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { expectedPosition } from './mediaTime';

/**
 * PRIVATE MEDIA — PERSISTENT AUDIO PLAYER
 *
 * This component owns the ONE YouTube iframe of the whole application. It is
 * mounted by `PrivateMediaProvider` at the app shell, above the router, so
 * navigating between pages never unmounts it.
 *
 * The iframe lives off-screen on purpose: Work Rank Private Media is an
 * audio-only remote (the owner asked for "chỉ nghe", no video surface). Keeping
 * the node mounted with a real 320×180 box — instead of `display:none` — is what
 * keeps Chrome decoding audio across route changes.
 *
 * Trade-off, stated explicitly: hiding the player surface is not what YouTube's
 * display requirements ask for. It is a deliberate product decision for this
 * private, owner-only capability; there is no stream extraction, no ad bypass
 * and no proxying — the official IFrame Player still plays the media.
 *
 * The engine is deliberately dumb: the server owns intent (video, status,
 * reference clock). The player only renders that intent and reports facts
 * (ended / error / duration) back.
 */

let youtubeApiPromise;

function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('NO_WINDOW'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const timer = setTimeout(() => { youtubeApiPromise = null; reject(new Error('YOUTUBE_API_TIMEOUT')); }, 15000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); previous?.(); resolve(window.YT); };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => { clearTimeout(timer); youtubeApiPromise = null; reject(new Error('YOUTUBE_API_LOAD_FAILED')); };
    document.head.appendChild(script);
  });
  return youtubeApiPromise;
}

/**
 * @param {object} props
 * @param {object|null} props.session
 * @param {number} props.volume
 * @param {boolean} props.muted
 * @param {{position:number, at:number}|null} props.seekSignal
 * @param {boolean} props.isOwner  this tab holds the playback lease
 * @param {boolean} props.enabled  capability + entitlement available
 * @param {(fact:{type:string, payload?:object})=>void} props.onPlayerFact
 * @param {()=>void} props.onReady
 * @param {(state:boolean)=>void} props.onActivationNeeded
 * @param {(notice:string|null)=>void} props.onNotice
 * @param {React.Ref} props.activationRef
 */
export default function PersistentPlayer({
  session,
  volume,
  muted,
  seekSignal,
  isOwner,
  enabled,
  onPlayerFact,
  onReady,
  onActivationNeeded,
  onNotice,
  activationRef,
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const live = useRef({ session, volume, muted });
  live.current = { session, volume, muted };

  const loadedRef = useRef(null);
  const loadedAtRef = useRef(0);
  const failedTrackRef = useRef(null);
  const recoveringRef = useRef(false);
  const lastSeekRef = useRef(0);
  const attemptedRef = useRef(null);
  const blockedRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [needsActivation, setNeedsActivation] = useState(false);
  const [recoveryGeneration, setRecoveryGeneration] = useState(0);

  // ── Intent → player ──────────────────────────────────────────────────────
  const apply = useCallback(() => {
    const player = playerRef.current;
    const state = live.current.session;
    if (!player?.loadVideoById) return;
    const itemId = state?.currentQueueItemId;

    if (!state?.video) {
      if (loadedRef.current) player.stopVideo?.();
      loadedRef.current = null;
      return;
    }
    // A failed iframe keeps its identity until the replacement player exists.
    if (failedTrackRef.current && failedTrackRef.current !== itemId) {
      if (!recoveringRef.current) {
        recoveringRef.current = true;
        setRecoveryGeneration((value) => value + 1);
      }
      return;
    }

    const isNewTrack = loadedRef.current !== itemId;
    const target = expectedPosition(state);

    if (isNewTrack) {
      loadedRef.current = itemId;
      loadedAtRef.current = Date.now();
      attemptedRef.current = null;
      blockedRef.current = false;
      setNeedsActivation(false);
      const method = state.status === 'PLAYING' ? 'loadVideoById' : 'cueVideoById';
      player[method]?.({ videoId: state.video.videoId, startSeconds: target });
    } else if (state.status === 'PLAYING'
      && Date.now() - loadedAtRef.current > 3000
      && Date.now() - lastSeekRef.current > 4000
      && player.getPlayerState?.() === 1) {
      // Drift correction: only when the gap is real, never while buffering.
      const actual = player.getCurrentTime?.() || 0;
      if (Math.abs(actual - target) > 2.5) {
        lastSeekRef.current = Date.now();
        player.seekTo(target, true);
      }
    }

    const actualState = player.getPlayerState?.();
    if (state.status === 'PLAYING' && !blockedRef.current && actualState !== 1 && actualState !== 3) player.playVideo?.();
    if (state.status === 'PAUSED' && actualState !== 2 && actualState !== 5) player.pauseVideo?.();
    if (state.status === 'STOPPED' && actualState !== 0) player.stopVideo?.();
  }, []);

  // ── Create the player exactly once per recovery ──────────────────────────
  useEffect(() => {
    if (!enabled || !isOwner) return undefined;
    let cancelled = false;
    setReady(false);

    loadYouTubeApi().then((YT) => {
      if (cancelled || !containerRef.current) return;
      const host = document.createElement('div');
      host.className = 'pm-player__host';
      containerRef.current.replaceChildren(host);
      failedTrackRef.current = null;
      recoveringRef.current = false;

      playerRef.current = new YT.Player(host, {
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 0, controls: 0, rel: 0, playsinline: 1, origin: window.location.origin },
        events: {
          onReady: () => {
            if (cancelled) return;
            loadedRef.current = null;
            setReady(true);
            onReady?.();
          },
          onAutoplayBlocked: () => {
            if (cancelled) return;
            blockedRef.current = true;
            setNeedsActivation(true);
          },
          onStateChange: ({ data, target }) => {
            if (cancelled) return;
            if (data === 1) { blockedRef.current = false; setNeedsActivation(false); }
            if (data === 0 && loadedRef.current) {
              const currentId = target?.getVideoData?.().video_id;
              if (currentId === live.current.session?.video?.videoId) {
                onPlayerFact?.({ type: 'ended', payload: { currentQueueItemId: loadedRef.current } });
              }
            }
          },
          onError: ({ data }) => {
            if (cancelled) return;
            const itemId = failedTrackRef.current || loadedRef.current;
            if (!itemId) return;
            failedTrackRef.current = itemId;
            onPlayerFact?.({ type: 'error', payload: { currentQueueItemId: itemId, errorCode: data } });
          },
        },
      });
    }).catch(() => { if (!cancelled) setApiError(true); });

    return () => {
      cancelled = true;
      try { playerRef.current?.destroy?.(); } catch { /* detached */ }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isOwner, recoveryGeneration]);

  // ── Local output preferences (never shared) ──────────────────────────────
  useEffect(() => {
    if (!ready) return;
    const player = playerRef.current;
    player?.setVolume?.(volume);
    if (muted) player?.mute?.(); else player?.unMute?.();
  }, [ready, volume, muted]);

  useEffect(() => { if (ready) apply(); }, [ready, session, apply]);

  useEffect(() => {
    if (!ready || !seekSignal) return;
    playerRef.current?.seekTo?.(seekSignal.position, true);
    lastSeekRef.current = Date.now();
    loadedAtRef.current = Date.now();
  }, [ready, seekSignal]);

  // ── Facts: duration + autoplay watchdog ──────────────────────────────────
  useEffect(() => {
    if (!ready) return undefined;
    const timer = setInterval(() => {
      apply();
      const player = playerRef.current;
      const state = live.current.session;
      if (!state?.video) return;
      const duration = player?.getDuration?.();
      if (duration > 0) {
        onPlayerFact?.({ type: 'duration', payload: { currentQueueItemId: state.currentQueueItemId, durationSeconds: duration } });
      }
      if (state.status === 'PLAYING' && player?.getPlayerState?.() !== 1 && player?.getPlayerState?.() !== 3) {
        if (attemptedRef.current === state.currentQueueItemId) {
          blockedRef.current = true;
          setNeedsActivation(true);
        }
        attemptedRef.current = state.currentQueueItemId;
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [ready, apply, onPlayerFact]);

  useEffect(() => { onActivationNeeded?.(needsActivation); }, [needsActivation, onActivationNeeded]);
  useEffect(() => {
    if (apiError) onNotice?.('Không tải được trình phát YouTube. Kiểm tra mạng rồi tải lại trang.');
  }, [apiError, onNotice]);

  const activate = useCallback(() => {
    blockedRef.current = false;
    setNeedsActivation(false);
    playerRef.current?.seekTo?.(expectedPosition(live.current.session), true);
    playerRef.current?.playVideo?.();
  }, []);

  // The transport bar on the page can trigger activation too.
  useImperativeHandle(activationRef, () => ({ activate }), [activate]);

  // ── Render: an off-screen host, never a visible surface ──────────────────
  return (
    <div
      className={`pm-audio-host${enabled && isOwner ? '' : ' is-idle'}`}
      aria-hidden="true"
      data-pm-player="audio-only"
    >
      {/* This node is the iframe host and is never re-created on navigation. */}
      <div ref={containerRef} className="pm-player__canvas" />
    </div>
  );
}
