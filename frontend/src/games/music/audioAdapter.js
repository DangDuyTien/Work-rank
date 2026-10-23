/**
 * Music playback adapters.
 *
 * The gameplay engine only knows this interface:
 *
 *   load() · play() · pause() · seek(ms) · getCurrentTime() · getDuration()
 *   isBuffering() · hasEnded() · destroy()
 *
 * `HostedAudioAdapter` is the only adapter wired into the game today. It plays
 * a file WorkRank hosts itself, which is what ranked play needs: deterministic
 * pause/resume, no ads, no buffering surprises from a third party.
 *
 * `YouTubeEmbedAdapter` is deliberately NOT implemented. The official embed is
 * allowed by YouTube's terms only through their player, it can serve ads, and
 * its timing is not stable enough to gate a race on. Shipping a half-working
 * adapter would silently break "pause exactly at the line end", so the slot is
 * documented and left closed instead.
 */

export const AUDIO_SOURCE_TYPE = Object.freeze({
  HOSTED_LICENSED: 'HOSTED_LICENSED',
  ROYALTY_FREE: 'ROYALTY_FREE',
  YOUTUBE_EMBED: 'YOUTUBE_EMBED',
});

/** Adapters allowed in ranked / multiplayer play. */
export const RANKED_SAFE_SOURCES = Object.freeze([AUDIO_SOURCE_TYPE.HOSTED_LICENSED, AUDIO_SOURCE_TYPE.ROYALTY_FREE]);

export function createHostedAudioAdapter({ url, preload = 'auto', volume = 0.9 } = {}) {
  if (!url) throw new Error('HostedAudioAdapter cần một URL audio');
  const element = new Audio();
  element.preload = preload;
  element.src = url;
  element.volume = volume;
  element.setAttribute('playsinline', '');
  // Kept in the DOM (hidden) so the browser treats it as a real media element:
  // Safari/iOS are happier, and QA can inspect what is actually playing.
  element.style.display = 'none';
  element.setAttribute('aria-hidden', 'true');
  element.dataset.musicAudio = '1';
  if (typeof document !== 'undefined' && document.body) document.body.appendChild(element);

  let buffering = false;
  let destroyed = false;
  let loadPromise = null;

  const onWaiting = () => { buffering = true; };
  const onPlaying = () => { buffering = false; };
  const onCanPlay = () => { buffering = false; };
  element.addEventListener('waiting', onWaiting);
  element.addEventListener('stalled', onWaiting);
  element.addEventListener('playing', onPlaying);
  element.addEventListener('canplay', onCanPlay);
  element.addEventListener('canplaythrough', onCanPlay);

  function load() {
    if (loadPromise) return loadPromise;
    loadPromise = new Promise((resolve, reject) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const fail = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Không tải được audio bài hát'));
      };
      const cleanup = () => {
        element.removeEventListener('canplay', done);
        element.removeEventListener('loadeddata', done);
        element.removeEventListener('error', fail);
        clearTimeout(timer);
      };
      // A missing asset must fail the ready-gate instead of hanging the lobby.
      const timer = setTimeout(fail, 12000);
      element.addEventListener('canplay', done);
      element.addEventListener('loadeddata', done);
      element.addEventListener('error', fail);
      try { element.load(); } catch { fail(); }
    });
    return loadPromise;
  }

  function play() {
    if (destroyed) return Promise.reject(new Error('Audio đã bị huỷ'));
    const result = element.play();
    // Safari/iOS returns a promise; a rejected autoplay must not throw into the
    // input handler, the engine keeps the run paused and retries on gesture.
    if (result && typeof result.catch === 'function') {
      return result.catch((error) => {
        buffering = false;
        throw error;
      });
    }
    return Promise.resolve();
  }

  function pause() {
    try { element.pause(); } catch { /* element already detached */ }
  }

  function seek(ms) {
    const target = Math.max(0, Number(ms) || 0) / 1000;
    try { element.currentTime = target; } catch { /* not seekable yet */ }
  }

  return {
    kind: AUDIO_SOURCE_TYPE.HOSTED_LICENSED,
    element,
    load,
    play,
    pause,
    seek,
    getCurrentTime: () => (Number.isFinite(element.currentTime) ? element.currentTime * 1000 : 0),
    getDuration: () => (Number.isFinite(element.duration) ? element.duration * 1000 : 0),
    isBuffering: () => buffering,
    hasEnded: () => Boolean(element.ended),
    setVolume: (value) => { element.volume = Math.min(1, Math.max(0, Number(value) || 0)); },
    destroy: () => {
      destroyed = true;
      pause();
      element.removeEventListener('waiting', onWaiting);
      element.removeEventListener('stalled', onWaiting);
      element.removeEventListener('playing', onPlaying);
      element.removeEventListener('canplay', onCanPlay);
      element.removeEventListener('canplaythrough', onCanPlay);
      element.removeAttribute('src');
      try { element.load(); } catch { /* noop */ }
      element.remove();
    },
  };
}

/**
 * Closed slot. Kept so the product decision is visible in code instead of
 * being rediscovered later as "why can't we just paste a YouTube link?".
 */
export function createYouTubeEmbedAdapter() {
  throw new Error('YouTube chưa được bật cho Đua Gõ Theo Nhạc: chỉ dùng audio WorkRank sở hữu để đảm bảo pause/resume chính xác.');
}

export function adapterForSong(song) {
  const type = song?.audioSource?.type;
  if (type === AUDIO_SOURCE_TYPE.HOSTED_LICENSED || type === AUDIO_SOURCE_TYPE.ROYALTY_FREE) {
    return createHostedAudioAdapter({ url: song.audioSource.url });
  }
  if (type === AUDIO_SOURCE_TYPE.YOUTUBE_EMBED) return createYouTubeEmbedAdapter();
  throw new Error(`Nguồn audio không được hỗ trợ: ${type || 'không rõ'}`);
}
