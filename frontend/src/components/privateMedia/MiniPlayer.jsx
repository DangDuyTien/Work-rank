import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, SkipForward, Square } from 'lucide-react';

/**
 * PRIVATE MEDIA — MINI CONTROLLER (Picture-in-Picture)
 *
 * A small always-on-top window with three controls: play/pause, stop, next.
 * It exists so the owner does NOT need the Mac helper, a device token or any
 * pairing step just to control playback while another app has focus.
 *
 * Uses the Document Picture-in-Picture API (Chrome/Edge 116+): the window is a
 * real OS-level floating window, so it stays above other applications.
 * Where the API is unavailable the same UI renders as a fixed floating bar
 * inside the page, so the feature degrades instead of disappearing.
 *
 * The mini window shares the parent's React tree through a portal, so it reads
 * the same session state and sends commands through the same command bus —
 * there is no second source of truth and no extra connection to configure.
 */

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

function miniCss(theme) {
  const p = PALETTES[theme] || PALETTES.light;
  return `
.pm-mini {
  font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
  background: ${p.bg};
  border: 1px solid ${p.border};
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 8px;
  box-sizing: border-box;
  user-select: none;
  -webkit-user-select: none;
}
.pm-mini__btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 26px; border: 1px solid ${p.btnBorder};
  border-radius: 5px; background: ${p.btnBg}; color: ${p.btnText};
  cursor: pointer; transition: background 0.15s ease, border-color 0.15s ease;
}
.pm-mini__btn:hover:not(:disabled) { background: ${p.btnHoverBg}; }
.pm-mini__btn:disabled { opacity: 0.35; cursor: not-allowed; }
.pm-mini__btn.is-primary { background: ${p.primaryBg}; color: ${p.primaryText}; border-color: transparent; width: 36px; }
.pm-mini__btn.is-primary:hover:not(:disabled) { background: ${p.primaryHover}; }
.pm-mini__fallback {
  position: fixed; right: 14px; bottom: 14px; z-index: 4000;
  width: max-content; height: max-content;
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
 *   app → the WorkRank page (for the in-page floating bar)
 *   os  → the operating system / browser chrome (for the separate PiP window)
 *
 * A floating window sits next to Chrome, not inside the page, so the OS
 * appearance is what it should blend with. Re-reads on colour-scheme changes
 * and on any class/style/data-theme mutation of <html>.
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

/**
 * Three buttons, nothing else.
 *
 * No title, no clock, no progress bar: the owner knows what is playing, and
 * every extra element makes the bar bigger and more conspicuous. The state is
 * still shared with the page, so the play/pause icon always reflects reality.
 */
function MiniControls({ session, canControl, onCommand }) {
  const video = session?.video || null;
  const playing = session?.status === 'PLAYING';
  const disabled = !canControl || !video;

  return (
    <div className="pm-mini">
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
    </div>
  );
}

export default function MiniPlayer({ open, onClose, session, canControl, onCommand, themeMode = 'auto' }) {
  // `themeMode` lets the owner force a palette: a floating window sits next to
  // whatever they are looking at, and no web API can read another site's
  // colour (cross-origin). Forcing it is the only reliable way to blend in.
  const palette = useThemePalette();
  const [pipWindow, setPipWindow] = useState(null);
  const [fallback, setFallback] = useState(false);
  const fallbackRef = useRef(false);
  // The in-page fallback lives inside the page, so it follows the app; the real
  // PiP window is a separate OS window and follows the system appearance.
  const theme = themeMode === 'auto' ? (fallback ? palette.app : palette.os) : themeMode;
  const themeRef = useRef(theme);
  const styleRef = useRef(null);

  const supported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  useEffect(() => {
    if (!open) {
      setPipWindow(null);
      setFallback(false);
      return undefined;
    }

    if (!supported) {
      setFallback(true);
      return undefined;
    }

    let cancelled = false;
    let opened = null;
    let settled = false;

    // Some environments (headless, restricted window managers, kiosk policies)
    // never settle requestWindow. Without a guard the button would silently do
    // nothing, so after 1.5s we fall back to the in-page floating bar.
    const guard = setTimeout(() => {
      if (cancelled || settled) return;
      fallbackRef.current = true;
      setFallback(true);
    }, 1500);

    window.documentPictureInPicture
      .requestWindow({ width: 132, height: 44, disallowReturnToOpener: false })
      .then((win) => {
        settled = true;
        clearTimeout(guard);
        if (cancelled) {
          win.close();
          return;
        }
        opened = win;

        const style = win.document.createElement('style');
        style.textContent = miniCss(themeRef.current);
        styleRef.current = style;
        win.document.head.appendChild(style);
        win.document.title = 'WorkRank Media';
        win.document.body.style.margin = '0';

        win.addEventListener('pagehide', () => {
          setPipWindow(null);
          if (!fallbackRef.current) onClose();
        });

        setPipWindow(win);
      })
      .catch(() => {
        // User gesture missing, policy blocked, or headless environment.
        settled = true;
        clearTimeout(guard);
        fallbackRef.current = true;
        setFallback(true);
      });

    return () => {
      cancelled = true;
      clearTimeout(guard);
      try {
        opened?.close();
      } catch {
        // Already closed.
      }
    };
  }, [open, supported, onClose]);

  useEffect(() => {
    fallbackRef.current = fallback;
  }, [fallback]);

  // Keep the PiP window's palette in sync if the app theme changes while it is
  // open (the injected <style> is a snapshot, not a live stylesheet).
  useEffect(() => {
    themeRef.current = theme;
    if (styleRef.current) styleRef.current.textContent = miniCss(theme);
  }, [theme]);

  const handleCommand = useCallback((action) => {
    onCommand(action);
  }, [onCommand]);

  if (!open) return null;

  const body = (
    <MiniControls
      session={session}
      canControl={canControl}
      onCommand={handleCommand}
    />
  );

  if (pipWindow?.document?.body) {
    return createPortal(body, pipWindow.document.body);
  }

  if (fallback) {
    return createPortal(
      <>
        <style>{miniCss(theme)}</style>
        <div className="pm-mini__fallback">{body}</div>
      </>,
      document.body,
    );
  }

  return null;
}
