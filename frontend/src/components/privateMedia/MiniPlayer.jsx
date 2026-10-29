import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, RotateCcw, RotateCw, SkipForward, Square, Volume1, Volume2 } from 'lucide-react';

/**
 * PRIVATE MEDIA — MEDIA CONTROLS
 *
 * One component, two mount points:
 *   variant="inline" → a compact bar inside the page (always available)
 *   variant="mini"   → the floating Picture-in-Picture window (Chrome/Edge 116+)
 *
 * Both share the parent's React tree, so they read the same session state and
 * send commands through the same command bus — there is no second source of
 * truth and no extra connection to configure.
 *
 * Layout is measured, not guessed: `PIP_WIDTH` / `PIP_HEIGHT` below are the
 * single source of truth for the requested window size. Requesting a window
 * smaller than the content clips the buttons (that bug shipped once already).
 */

// ── Sizes ───────────────────────────────────────────────────────────────────
// 5 buttons: 24 + 36 + 30 + 30 + 24 = 144px, gaps 4×6 = 24px, padding 2×8 = 16px
// → 184px of content. The window gets a few extra pixels so Chrome's own
// rounding never clips the last button.
export const PIP_WIDTH = 90;
export const PIP_HEIGHT = 22;
const PIP_CONTENT_WIDTH = 84;
const PIP_CONTENT_HEIGHT = 16;

// ── Theme ───────────────────────────────────────────────────────────────────
// The PiP document does not inherit the app stylesheet, so colours are resolved
// here and inlined. The bar must look like a piece of the current UI: a black
// box over the warm light theme reads as a foreign window and is hard to place
// at a glance, which defeats the point of a discreet mini controller.
const PALETTES = {
  light: {
    bg: '#ffffff',
    border: 'rgba(0, 0, 0, 0.10)',
    text: '#111111',
    muted: '#777777',
    bar: 'rgba(0, 0, 0, 0.08)',
    fill: '#b45309',
    btnBg: '#f0eee9',
    btnBorder: 'rgba(0, 0, 0, 0.10)',
    btnText: '#111111',
    btnHoverBg: '#e6e3dc',
    primaryBg: '#141414',
    primaryText: '#ffffff',
    primaryHover: '#2b2b2b',
    close: 'rgba(0, 0, 0, 0.32)',
    closeHoverBg: 'rgba(0, 0, 0, 0.07)',
    closeHover: '#111111',
    shadow: '0 8px 22px rgba(15, 23, 42, 0.14)',
  },
  dark: {
    bg: 'rgba(18, 18, 18, 0.94)',
    border: 'rgba(255, 255, 255, 0.10)',
    text: 'rgba(255, 255, 255, 0.92)',
    muted: 'rgba(255, 255, 255, 0.50)',
    bar: 'rgba(255, 255, 255, 0.14)',
    fill: '#f59e0b',
    btnBg: 'rgba(255, 255, 255, 0.06)',
    btnBorder: 'rgba(255, 255, 255, 0.12)',
    btnText: 'rgba(255, 255, 255, 0.90)',
    btnHoverBg: 'rgba(255, 255, 255, 0.16)',
    primaryBg: 'rgba(255, 255, 255, 0.92)',
    primaryText: '#141414',
    primaryHover: '#ffffff',
    close: 'rgba(255, 255, 255, 0.38)',
    closeHoverBg: 'rgba(255, 255, 255, 0.16)',
    closeHover: '#ffffff',
    shadow: '0 10px 26px rgba(0, 0, 0, 0.26)',
  },
};

function parseColor(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const body = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
    return [parseInt(body.slice(0, 2), 16), parseInt(body.slice(2, 4), 16), parseInt(body.slice(4, 6), 16)];
  }

  const rgb = raw.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];

  return null;
}

/** Read the app's actual surface colour, not a hard-coded guess. */
function readThemeKind() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 'light';
  try {
    const root = document.documentElement;
    const declared = window.getComputedStyle(root).getPropertyValue('--background');
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    const rgb = parseColor(declared) || parseColor(bodyBg);
    if (!rgb) return 'light';
    const [r, g, b] = rgb;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.45 ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/**
 * Styles for the PiP document. Every rule is scoped under `.pm-mini` so this
 * stylesheet can never leak into the page (it is appended to the PiP document,
 * but the fallback bar injects it into the page's <head>).
 */
function miniCss(theme) {
  const p = PALETTES[theme] || PALETTES.light;
  return `
.pm-mini {
  font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
  background: ${p.bg};
  border: 1px solid ${p.border};
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 2px;
  padding: 2px 3px;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}
.pm-mini .pm-mini__btn {
  /* Flex, not fixed widths: the buttons always divide the window they are in,
     so a window that ends up narrower than requested shrinks them instead of
     clipping the outer ones (which looked like "there is only a mute button"). */
  flex: 1 1 0;
  min-width: 0;
  display: inline-flex; align-items: center; justify-content: center;
  height: 100%; padding: 0;
  border: 1px solid ${p.btnBorder};
  border-radius: 3px; background: ${p.btnBg}; color: ${p.btnText};
  cursor: pointer; transition: background 0.15s ease, border-color 0.15s ease;
}
.pm-mini .pm-mini__btn svg { width: 10px; height: 10px; }
.pm-mini .pm-mini__btn:hover:not(:disabled) { background: ${p.btnHoverBg}; }
.pm-mini .pm-mini__btn:disabled { opacity: 0.35; cursor: not-allowed; }
.pm-mini .pm-mini__btn.is-narrow { flex: 0.72 1 0; }
.pm-mini .pm-mini__btn.is-primary {
  flex: 1.25 1 0;
  background: ${p.primaryBg}; color: ${p.primaryText}; border-color: transparent;
}
.pm-mini .pm-mini__btn.is-primary:hover:not(:disabled) { background: ${p.primaryHover}; }
.pm-mini__fallback {
  position: fixed; right: 14px; bottom: 14px; z-index: 4000;
  width: ${PIP_CONTENT_WIDTH + 16}px; height: ${PIP_CONTENT_HEIGHT + 12}px;
  border-radius: 7px; overflow: hidden;
  box-shadow: ${p.shadow};
}
`;
}

/** The OS / browser appearance — what Chrome's own window chrome follows. */
function readOsTheme() {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/**
 * Tracks both palettes we care about:
 *   app → the WorkRank page (for the in-page bars)
 *   os  → the operating system / browser chrome (for the separate PiP window)
 */
function useThemePalette() {
  const [palette, setPalette] = useState(() => ({ app: readThemeKind(), os: readOsTheme() }));

  useEffect(() => {
    const update = () => setPalette({ app: readThemeKind(), os: readOsTheme() });
    update();

    const media = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
    media?.addEventListener?.('change', update);

    let observer = null;
    if (typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(update);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    }

    return () => {
      media?.removeEventListener?.('change', update);
      observer?.disconnect();
    };
  }, []);

  return palette;
}

const VOLUME_STEP = 10;

/**
 * Five buttons, nothing else.
 *
 * No title, no clock, no progress bar: the owner knows what is playing, and
 * every extra element makes the bar bigger and more conspicuous. The state is
 * shared with the page, so the play/pause icon always reflects reality.
 */
export function MediaControls({ session, canControl, onCommand, variant = 'mini', showVolume = true, showSeek = false }) {
  const video = session?.video || null;
  const playing = session?.status === 'PLAYING';
  const volume = Math.min(100, Math.max(0, Number(session?.volume ?? 100)));
  const disabled = !canControl || !video;

  // Volume works even with nothing loaded, so it only needs control permission.
  const changeVolume = (delta) => {
    if (!canControl) return;
    onCommand('SET_VOLUME', { volume: Math.min(100, Math.max(0, volume + delta)) });
  };

  // ±10 seconds. Only the page shows these; the floating window stays 5 buttons.
  const seekBy = (delta) => {
    if (disabled) return;
    const duration = Number(session?.durationSeconds) || 0;
    const target = (Number(session?.currentTime) || 0) + delta;
    const clamped = Math.max(0, duration > 0 ? Math.min(duration, target) : target);
    onCommand('SEEK', { position: Math.round(clamped) });
  };

  return (
    <div className={variant === 'inline' ? 'pm-inline' : 'pm-mini'}>
      {showVolume && (
        <button
          type="button"
          className="pm-mini__btn is-narrow"
          onClick={() => changeVolume(-VOLUME_STEP)}
          disabled={!canControl || volume <= 0}
          aria-label="Nhỏ hơn"
          title={`Nhỏ hơn (${volume}%)`}
        >
          <Volume1 size={13} aria-hidden="true" />
        </button>
      )}
      {showSeek && (
        <button
          type="button"
          className="pm-mini__btn is-narrow"
          onClick={() => seekBy(-10)}
          disabled={disabled}
          aria-label="Tua lại 10 giây"
          title="Tua lại 10 giây"
        >
          <RotateCcw size={13} aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        className="pm-mini__btn is-primary"
        onClick={() => onCommand('TOGGLE_PLAY_PAUSE')}
        disabled={disabled}
        aria-label={playing ? 'Tạm dừng' : 'Phát'}
        title={playing ? 'Tạm dừng' : 'Phát'}
      >
        {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
      </button>
      <button
        type="button"
        className="pm-mini__btn"
        onClick={() => onCommand('STOP')}
        disabled={disabled}
        aria-label="Dừng"
        title="Dừng"
      >
        <Square size={11} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="pm-mini__btn"
        onClick={() => onCommand('NEXT')}
        disabled={disabled}
        aria-label="Video tiếp theo"
        title="Video tiếp theo"
      >
        <SkipForward size={13} aria-hidden="true" />
      </button>
      {showSeek && (
        <button
          type="button"
          className="pm-mini__btn is-narrow"
          onClick={() => seekBy(10)}
          disabled={disabled}
          aria-label="Tua tới 10 giây"
          title="Tua tới 10 giây"
        >
          <RotateCw size={13} aria-hidden="true" />
        </button>
      )}
      {showVolume && (
        <button
          type="button"
          className="pm-mini__btn is-narrow"
          onClick={() => changeVolume(VOLUME_STEP)}
          disabled={!canControl || volume >= 100}
          aria-label="To hơn"
          title={`To hơn (${volume}%)`}
        >
          <Volume2 size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/**
 * The floating window renderer.
 *
 * `pipWindow` is owned by the page (it must be requested synchronously inside
 * the click handler, see `openMini`). This component only portals the controls
 * into that window and keeps the palette in sync.
 *
 * Deliberately does NOT close the window on re-render or on unmount of this
 * component: the window belongs to the document, and closing it from a React
 * cleanup is what made it disappear on tab switches before.
 */
export default function MiniPlayer({ open, pipWindow, onClose, session, canControl, onCommand, themeMode = 'auto' }) {
  const palette = useThemePalette();
  const theme = themeMode === 'auto' ? (pipWindow ? palette.os : palette.app) : themeMode;
  const styleRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Inject the palette into the PiP document (it inherits nothing from the app).
  // Depends on `pipWindow` only: `onClose` is read through a ref so a parent
  // re-render does not tear the stylesheet down and rebuild it (which flickered).
  useEffect(() => {
    if (!pipWindow?.document?.head) return undefined;

    const style = pipWindow.document.createElement('style');
    style.textContent = miniCss(theme);
    styleRef.current = style;
    pipWindow.document.head.appendChild(style);
    pipWindow.document.title = 'WorkRank Media';
    // Set on the PiP document only — the same stylesheet is injected into the
    // page for the fallback, so these must not live in `miniCss`.
    pipWindow.document.documentElement.style.height = '100%';
    pipWindow.document.body.style.margin = '0';
    pipWindow.document.body.style.height = '100%';
    pipWindow.document.body.style.overflow = 'hidden';

    return () => {
      try { style.remove(); } catch { /* window already gone */ }
      styleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipWindow]);

  useEffect(() => {
    if (styleRef.current) styleRef.current.textContent = miniCss(theme);
  }, [theme]);

  // Detect the window being closed by the user (the × in the OS title bar).
  // Polling `closed` is deterministic across platforms; `pagehide` alone is not
  // fired consistently for Document PiP documents on Windows.
  useEffect(() => {
    if (!pipWindow) return undefined;
    const timer = setInterval(() => {
      if (pipWindow.closed) {
        clearInterval(timer);
        closeRef.current?.();
      }
    }, 500);
    return () => clearInterval(timer);
  }, [pipWindow]);

  const handleCommand = useCallback((action, payload) => {
    onCommand(action, payload);
  }, [onCommand]);

  if (!open) return null;

  const body = (
    <MediaControls
      session={session}
      canControl={canControl}
      onCommand={handleCommand}
    />
  );

  if (pipWindow?.document?.body) {
    return createPortal(body, pipWindow.document.body);
  }

  // No PiP window: keep a working control surface inside the page as well.
  return createPortal(
    <>
      <style>{miniCss(theme)}</style>
      <div className="pm-mini__fallback">{body}</div>
    </>,
    document.body,
  );
}
