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
 * - Enter Transition: game content follows WorkRank's shared page fade/slide rhythm.
 * - Exit Transition: game content fades and moves up slightly before navigating,
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

  // Game pages live inside the normal WorkRank shell so the vertical sidebar
  // and app scroll container remain available while playing.
  useEffect(() => {
    // Enter animation timer
    const enterDuration = isReducedMotion ? 50 : 340;
    const enterTimer = setTimeout(() => {
      setTransitionState('ACTIVE');
    }, enterDuration);

    return () => {
      clearTimeout(enterTimer);
    };
  }, [isReducedMotion]);

  // Saving state during async onExit
  const [isSavingExit, setIsSavingExit] = useState(false);

  // Handle Exit with reverse transition
  const handleExit = useCallback(async () => {
    if (isExitingRef.current || isSavingExit) return; // Prevent double-trigger race condition

    if (typeof onExit === 'function') {
      try {
        setIsSavingExit(true);
        const canExit = await onExit();
        if (canExit === false) {
          setIsSavingExit(false);
          return;
        }
      } catch (err) {
        console.error('Error during onExit execution:', err);
        setIsSavingExit(false);
        return;
      } finally {
        setIsSavingExit(false);
      }
    }

    isExitingRef.current = true;
    setTransitionState('EXITING');

    const exitDuration = isReducedMotion ? 50 : 260;
    setTimeout(() => {
      if (exitTo) {
        navigate(exitTo);
      } else {
        navigate(-1);
      }
    }, exitDuration);
  }, [navigate, onExit, exitTo, isReducedMotion, isSavingExit]);

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
        position: 'relative',
        width: '100%',
        minHeight: '100%',
        zIndex: 1,
        background: 'var(--background)',
        color: 'var(--foreground, var(--text-primary))',
        fontFamily: "var(--font-sans, 'Space Grotesk', -apple-system, sans-serif)",
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
        overflowY: 'visible',
      }}
    >
      {/* ── UNIFIED GAME TOP BAR (WorkRank Warm Editorial Design System) ── */}
      {topBar && (
        <header
          className="wr-game-shell-topbar"
          style={{
            height: 54,
            minHeight: 54,
            background: 'var(--surface)',
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
              className="wr-game-shell-exit-button"
              onClick={handleExit}
              disabled={transitionState === 'EXITING' || isSavingExit}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                background: 'var(--background)',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 800,
                cursor: (transitionState === 'EXITING' || isSavingExit) ? 'default' : 'pointer',
                transition: 'background var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard)',
                opacity: isSavingExit ? 0.75 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isSavingExit && transitionState !== 'EXITING') e.currentTarget.style.background = '#eceae4';
              }}
              onMouseLeave={(e) => {
                if (!isSavingExit && transitionState !== 'EXITING') e.currentTarget.style.background = 'var(--background)';
              }}
              title="Thoát trò chơi về WorkRank"
            >
              <ArrowLeft size={15} />
              <span>{isSavingExit ? 'Đang lưu...' : exitLabel}</span>
            </button>

            <div style={{ height: 18, width: 1, background: 'rgba(0, 0, 0, 0.1)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {Icon && (
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: 'var(--primary)',
                    color: 'var(--surface)',
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
                    color: 'var(--text-primary)',
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
                      color: 'var(--accent)',
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
                    color: 'var(--text-primary)',
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
                <User size={14} color="var(--text-muted)" />
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
