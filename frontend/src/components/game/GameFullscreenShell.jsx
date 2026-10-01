import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import DefaultAvatar from '../DefaultAvatar';
import JobTitleBadge from '../JobTitleBadge';

/**
 * Universal Game Fullscreen Shell & Transition System for WorkRank.
 *
 * Requirements:
 * - Enter Transition: App contents / sidebar slide & fade away, Game container expands
 *   from scale(0.96) + opacity(0.8) to scale(1) + opacity(1) in 250-450ms.
 * - Exit Transition: Game container scales down (1 -> 0.96, opacity 1 -> 0.85) in 250-350ms,
 *   navigation slides back in, body scroll restored, then navigates to previous page / arena.
 * - State machine: IDLE -> ENTERING -> ACTIVE -> EXITING -> IDLE.
 * - Locks body scroll while mounted, cleanly unlocks on unmount / exit.
 * - Supports prefers-reduced-motion: instant or simple opacity fade, no scale/translate.
 * - Standard WorkRank Editorial Top Bar with exit button, title, badge, actions, and user info.
 */
export default function GameFullscreenShell({
  title,
  icon: Icon,
  badge,
  actions,
  onExit,
  exitLabel = 'Thoát',
  exitTo = '/arena',
  maxWidth = 1180,
  topBar = true,
  children,
  className = '',
}) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Transition state: 'ENTERING' | 'ACTIVE' | 'EXITING'
  const [transitionState, setTransitionState] = useState('ENTERING');
  const isExitingRef = useRef(false);

  // Check reduced motion preference
  const isReducedMotion = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Lock body scroll on mount, restore on unmount
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Enter animation timer
    const enterDuration = isReducedMotion ? 50 : 360;
    const enterTimer = setTimeout(() => {
      setTransitionState('ACTIVE');
    }, enterDuration);

    // Listen for browser back / popstate to ensure clean scroll unlock
    const handlePopState = () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      clearTimeout(enterTimer);
      window.removeEventListener('popstate', handlePopState);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [isReducedMotion]);

  // Handle Exit with reverse transition
  const handleExit = useCallback(() => {
    if (isExitingRef.current) return; // Prevent double-trigger race condition
    isExitingRef.current = true;
    setTransitionState('EXITING');

    const exitDuration = isReducedMotion ? 50 : 300;
    setTimeout(() => {
      // Restore scroll before navigating
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';

      if (typeof onExit === 'function') {
        onExit();
      } else if (exitTo) {
        navigate(exitTo);
      } else {
        navigate(-1);
      }
    }, exitDuration);
  }, [navigate, onExit, exitTo, isReducedMotion]);

  // Compute CSS transition class
  const transitionClass =
    transitionState === 'ENTERING'
      ? 'wr-game-shell-entering'
      : transitionState === 'EXITING'
      ? 'wr-game-shell-exiting'
      : 'wr-game-shell-active';

  return (
    <div
      className={`wr-game-shell-root ${transitionClass} ${className}`}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        zIndex: 1000,
        background: 'var(--background, #f4f3ef)',
        color: 'var(--foreground, #111111)',
        fontFamily: "var(--font-sans, 'Space Grotesk', -apple-system, sans-serif)",
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
        overflowY: 'auto',
      }}
    >
      {/* ── UNIFIED GAME TOP BAR (WorkRank Warm Editorial Design System) ── */}
      {topBar && (
        <header
          style={{
            height: 54,
            minHeight: 54,
            background: '#ffffff',
            borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          {/* Left: Exit button & Game Title / Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <button
              type="button"
              onClick={handleExit}
              disabled={transitionState === 'EXITING'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                background: '#f4f3ef',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: 6,
                color: '#111111',
                fontSize: 12,
                fontWeight: 800,
                cursor: transitionState === 'EXITING' ? 'default' : 'pointer',
                transition: 'background 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#eceae4';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f4f3ef';
              }}
              title="Thoát trò chơi về WorkRank"
            >
              <ArrowLeft size={15} />
              <span>{exitLabel}</span>
            </button>

            <div style={{ height: 18, width: 1, background: 'rgba(0, 0, 0, 0.1)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {Icon && (
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: '#141414',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={16} />
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 900,
                    color: '#111111',
                    letterSpacing: '-0.2px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {title}
                </span>

                {badge && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 9999,
                      background: 'rgba(180, 83, 9, 0.1)',
                      color: '#b45309',
                      letterSpacing: '0.3px',
                      textTransform: 'uppercase',
                      flexShrink: 0,
                    }}
                  >
                    {badge}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Center: Optional Custom Game Action Slots */}
          {actions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {actions}
            </div>
          )}

          {/* Right: User Profile Quick Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DefaultAvatar
                  src={user.avatarUrl || user.avatarData}
                  name={user.name || user.email}
                  userId={user.id}
                  size={28}
                  shape="circle"
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#111111',
                    maxWidth: 140,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user.name || user.email}
                </span>
                {user.jobTitle && (
                  <JobTitleBadge jobTitle={user.jobTitle} size="xs" />
                )}
              </div>
            ) : (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#eceae4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={14} color="#777777" />
              </div>
            )}
          </div>
        </header>
      )}

      {/* ── GAME BODY / CONTENT WORKSPACE ── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          maxWidth: maxWidth || '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
    </div>
  );
}
