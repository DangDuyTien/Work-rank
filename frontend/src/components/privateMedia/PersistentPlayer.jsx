import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { expectedPosition } from './mediaTime';
import {
  ADVANCE_STALL_MS, decidePlayerAction, shouldReportEnded, YT_STATE,
} from './playerSync';

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
  onWaitingAdvance,
  connectionEpoch,
  activationRef,
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const live = useRef({ session, volume, muted });
  live.current = { session, volume, muted };
  const factRef = useRef(onPlayerFact);
  factRef.current = onPlayerFact;
  const noticeRef = useRef(onNotice);
  noticeRef.current = onNotice;

  const loadedRef = useRef(null);
  const loadedAtRef = useRef(0);
  const failedTrackRef = useRef(null);
  const recoveringRef = useRef(false);
  const lastSeekRef = useRef(0);
  const attemptedRef = useRef(null);
  const blockedRef = useRef(false);
  // Which queue item already reported its end, and how many times.
  const endedRef = useRef({ itemId: null, at: 0, attempts: 0 });
  const stallNoticeRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [needsActivation, setNeedsActivation] = useState(false);
  const [waitingAdvance, setWaitingAdvance] = useState(false);
  const [recoveryGeneration, setRecoveryGeneration] = useState(0);

  const reportEnded = useCallback((itemId, eventId) => {
    if (!itemId) return false;
    const now = Date.now();
    if (!shouldReportEnded({ itemId, lastReport: endedRef.current, now })) return false;
    endedRef.current = {
      itemId,
      at: now,
      attempts: (endedRef.current.itemId === itemId ? endedRef.current.attempts : 0) + 1,
    };
    setWaitingAdvance(true);
    // The iframe callbacks are created once per player instance, so they must
    // reach the current reporter through a ref instead of a stale closure.
    factRef.current?.({
      type: 'ended',
      payload: { currentQueueItemId: itemId, eventId },
      // No ack: the report never reached the server. Re-arm and try once more
      // (bounded by shouldReportEnded) instead of waiting for a transition
      // that was never requested. Never touches the player, so it cannot
      // replay the finished track.
      onUndelivered: () => {
        if (endedRef.current.itemId !== itemId) return;
        endedRef.current = { itemId, at: 0, attempts: endedRef.current.attempts };
        setTimeout(() => {
          if (endedRef.current.itemId !== itemId) return;
          if (live.current.session?.currentQueueItemId !== itemId) return;
          reportEnded(itemId, `retry-${itemId}-${Date.now()}`);
        }, 1500);
      },
    });
    return true;
  }, []);

  // ── Intent → player ──────────────────────────────────────────────────────
  const apply = useCallback(() => {
    const player = playerRef.current;
    const state = live.current.session;
    if (!player?.loadVideoById) return;
    const itemId = state?.currentQueueItemId;

    // A failed iframe keeps its identity until the replacement player exists.
    if (state?.video && failedTrackRef.current && failedTrackRef.current !== itemId) {
      if (!recoveringRef.current) {
        recoveringRef.current = true;
        setRecoveryGeneration((value) => value + 1);
      }
      return;
    }

    const decision = decidePlayerAction({
      session: state,
      now: Date.now(),
      loadedItemId: loadedRef.current,
      loadedAt: loadedAtRef.current,
      lastSeekAt: lastSeekRef.current,
      playerState: player.getPlayerState?.(),
      playerTime: player.getCurrentTime?.() || 0,
      endedItemId: endedRef.current.itemId,
      blocked: blockedRef.current,
    });

    switch (decision.type) {
      case 'load':
      case 'cue': {
        loadedRef.current = decision.itemId;
        loadedAtRef.current = Date.now();
        attemptedRef.current = null;
        blockedRef.current = false;
        endedRef.current = { itemId: null, at: 0, attempts: 0 };
        stallNoticeRef.current = 0;
        setNeedsActivation(false);
        setWaitingAdvance(false);
        const method = decision.type === 'load' ? 'loadVideoById' : 'cueVideoById';
        player[method]?.({ videoId: decision.videoId, startSeconds: decision.position });
        break;
      }
      case 'seek':
        lastSeekRef.current = Date.now();
        player.seekTo?.(decision.position, true);
        break;
      case 'play':
        player.playVideo?.();
        break;
      case 'pause':
        player.pauseVideo?.();
        break;
      case 'stop':
        player.stopVideo?.();
        loadedRef.current = null;
        break;
      case 'report-ended':
        reportEnded(decision.itemId, `auto-${decision.itemId}-${Date.now()}`);
        break;
      case 'wait': {
        // The server has not moved on yet. Waiting is the correct behaviour:
        // touching the player here is what replayed the last second.
        const endedAt = endedRef.current.at || Date.now();
        if (Date.now() - endedAt > ADVANCE_STALL_MS && Date.now() - stallNoticeRef.current > ADVANCE_STALL_MS * 4) {
          stallNoticeRef.current = Date.now();
          noticeRef.current?.('Bài đã hết nhưng chưa chuyển được bài tiếp theo. Kiểm tra kết nối rồi bấm “Bài tiếp theo”.');
        }
        break;
      }
      case 'none':
      default:
        if (decision.reason === 'IDLE' || decision.reason === 'NO_MEDIA') {
          if (loadedRef.current) player.stopVideo?.();
          loadedRef.current = null;
          setWaitingAdvance(false);
        }
        break;
    }
  }, [reportEnded]);

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
            if (data === YT_STATE.PLAYING) {
              blockedRef.current = false;
              setNeedsActivation(false);
              setWaitingAdvance(false);
            }
            if (data === YT_STATE.ENDED) {
              // Report the end of the item that is actually in the player, and
              // only while the server still describes that same item.
              const itemId = loadedRef.current;
              const current = live.current.session;
              if (!itemId || !current?.video || current.currentQueueItemId !== itemId) return;
              const playerVideoId = target?.getVideoData?.().video_id;
              if (playerVideoId && playerVideoId !== current.video.videoId) return;
              reportEnded(itemId, `state-${itemId}-${Date.now()}`);
            }
          },
          onError: ({ data }) => {
            if (cancelled) return;
            const itemId = failedTrackRef.current || loadedRef.current;
            if (!itemId) return;
            failedTrackRef.current = itemId;
            factRef.current?.({ type: 'error', payload: { currentQueueItemId: itemId, errorCode: data } });
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
    // An explicit seek is a deliberate restart: the user may replay a finished
    // track, so the "already ended" guard is released here (and only here).
    endedRef.current = { itemId: null, at: 0, attempts: 0 };
    setWaitingAdvance(false);
    playerRef.current?.seekTo?.(seekSignal.position, true);
    lastSeekRef.current = Date.now();
    loadedAtRef.current = Date.now();
  }, [ready, seekSignal]);

  // A dropped socket can swallow the ENDED report. When the transport comes
  // back, re-arm and re-send it for an item that is still finished in the
  // player — otherwise the queue waits forever for an event nobody sends again.
  // This is deterministic (transport state), not a timeout guess.
  useEffect(() => {
    if (!ready || !connectionEpoch) return;
    const itemId = endedRef.current.itemId;
    const state = live.current.session;
    if (!itemId || !state?.video || state.currentQueueItemId !== itemId) return;
    const playerState = playerRef.current?.getPlayerState?.();
    // Only a player that genuinely finished may be re-reported: a cued or
    // unstarted player is a different situation and must not skip a track.
    if (playerState !== YT_STATE.ENDED) return;
    endedRef.current = { itemId, at: 0, attempts: 0 };
    reportEnded(itemId, `reconnect-${itemId}-${Date.now()}`);
  }, [connectionEpoch, ready, reportEnded]);

  // ── Facts: duration + autoplay watchdog ──────────────────────────────────
  useEffect(() => {
    if (!ready) return undefined;
    const timer = setInterval(() => {
      apply();
      const player = playerRef.current;
      const state = live.current.session;
      if (!state?.video) return;
      const duration = player?.getDuration?.();
      const playerState = player?.getPlayerState?.();
      if (duration > 0) {
        // The server still owns time and status; this is only the track length
        // plus a position hint it may use for diagnostics.
        factRef.current?.({
          type: 'duration',
          payload: {
            currentQueueItemId: state.currentQueueItemId,
            durationSeconds: duration,
            position: player?.getCurrentTime?.() || 0,
            playerState,
          },
        });
      }
      if (state.status !== 'PLAYING') return;
      if (playerState === YT_STATE.PLAYING || playerState === YT_STATE.BUFFERING) {
        attemptedRef.current = null;
        return;
      }
      // A finished item must never be treated as a blocked autoplay.
      if (playerState === YT_STATE.ENDED || endedRef.current.itemId === state.currentQueueItemId) return;
      if (attemptedRef.current === state.currentQueueItemId) {
        blockedRef.current = true;
        setNeedsActivation(true);
      }
      attemptedRef.current = state.currentQueueItemId;
    }, 3000);
    return () => clearInterval(timer);
  }, [ready, apply]);

  useEffect(() => { onActivationNeeded?.(needsActivation); }, [needsActivation, onActivationNeeded]);
  useEffect(() => { onWaitingAdvance?.(waitingAdvance); }, [waitingAdvance, onWaitingAdvance]);
  useEffect(() => {
    if (apiError) onNotice?.('Không tải được trình phát YouTube. Kiểm tra mạng rồi tải lại trang.');
  }, [apiError, onNotice]);

  const activate = useCallback(() => {
    blockedRef.current = false;
    setNeedsActivation(false);
    const session = live.current.session;
    // An ended item waits for the server; resuming it would replay the tail.
    if (endedRef.current.itemId && endedRef.current.itemId === session?.currentQueueItemId) return;
    playerRef.current?.seekTo?.(expectedPosition(session), true);
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
