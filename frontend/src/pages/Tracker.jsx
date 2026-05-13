import React from 'react';
import { useTracking } from '../context/TrackingContext';
import { useAuth } from '../context/AuthContext';

// Icons
const StopIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="none">
    <rect x="4" y="4" width="16" height="16" rx="3"/>
  </svg>
);
const PlayIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="none">
    <polygon points="5,3 19,12 5,21"/>
  </svg>
);
const KeyboardIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2"/>
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8M6 14h.01M18 14h.01"/>
  </svg>
);
const MouseIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="7"/><path d="M12 2v9"/>
  </svg>
);
const TrendUpIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);
const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const DesktopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);

export default function Tracker() {
  const { user } = useAuth();
  const {
    tracking, seconds, localKeys, localClicks,
    totalKeys, totalClicks, score, connected,
    desktopLaunchStatus, scoreHistory, formatNum, formatTime, toggle,
    desktopOnline, desktopTracking, desktopInfo,
  } = useTracking();

  const maxBar = Math.max(...scoreHistory, 1);
  const displayKeys = totalKeys + localKeys;
  const displayClicks = totalClicks + localClicks;
  const keysPerHr = seconds > 0 ? Math.round((displayKeys / seconds) * 3600) : 0;
  const keysPerHrStr = keysPerHr >= 1000 ? (keysPerHr / 1000).toFixed(1) + 'k' : keysPerHr;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: '1rem',
    }}>
      {/* Widget Card */}
      <div style={{
        width: 320,
        background: '#0f1729',
        borderRadius: 4,
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        fontFamily: "'Space Grotesk', -apple-system, system-ui, sans-serif",
        color: '#fff',
      }}>

        {/* Title Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: connected ? '#22c55e' : '#ef4444',
              boxShadow: connected ? '0 0 8px #22c55e88' : '0 0 8px #ef444488',
            }} />
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.2px' }}>WorkRank</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#374151', cursor: 'pointer' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#374151', cursor: 'pointer' }} />
          </div>
        </div>

        {/* Desktop Status Indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px',
          background: desktopOnline
            ? 'linear-gradient(90deg, rgba(34,197,94,0.08), rgba(34,197,94,0.03))'
            : 'linear-gradient(90deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          <span style={{ color: desktopOnline ? '#22c55e' : '#6b7280', display: 'flex' }}>
            <DesktopIcon />
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: desktopOnline ? '#22c55e' : '#6b7280',
          }}>
            Desktop Tracker: {desktopOnline ? (desktopTracking ? 'Đang chạy' : 'Online (tạm dừng)') : 'Offline'}
          </span>
          {desktopOnline && desktopInfo?.deviceName && (
            <span style={{ fontSize: 10, color: '#4b5563', marginLeft: 'auto' }}>
              {desktopInfo.deviceName}
            </span>
          )}
        </div>

        {/* Main Content */}
        <div style={{ padding: '24px 20px 20px' }}>

          {/* Tracking Button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
            <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {tracking && (
                <div style={{
                  position: 'absolute', inset: -6, borderRadius: 12,
                  background: 'rgba(59,130,246,0.15)',
                  animation: 'pulse 2s ease-in-out infinite',
                }} />
              )}
              <button
                type="button"
                data-no-track="true"
                aria-label={tracking ? 'Dừng theo dõi' : 'Bắt đầu theo dõi'}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggle();
                }}
                style={{
                  width: 112, height: 112, borderRadius: 12, border: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                  background: tracking
                    ? 'linear-gradient(145deg, #3b82f6, #2563eb)'
                    : 'linear-gradient(145deg, #1e2d4a, #192440)',
                  boxShadow: tracking
                    ? '0 8px 32px rgba(59,130,246,0.45), inset 0 1px 0 rgba(255,255,255,0.15)'
                    : '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
                  transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseDown={e => {
                  e.stopPropagation();
                  e.currentTarget.style.transform = 'scale(0.97)';
                }}
                onMouseUp={e => {
                  e.stopPropagation();
                  e.currentTarget.style.transform = 'scale(1.04)';
                }}
              >
                {tracking ? <StopIcon /> : <PlayIcon />}
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: tracking ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
                }}>
                  {tracking ? 'Dừng' : 'Bắt đầu'}
                </span>
              </button>
            </div>

            {/* Session Time */}
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, letterSpacing: '0.05em' }}>Phiên hoạt động</div>
              <div style={{
                fontSize: 28, fontWeight: 800, fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                letterSpacing: '0.04em', color: tracking ? '#fff' : '#4b5563', transition: 'color 0.3s',
              }}>
                {formatTime(seconds)}
              </div>
              {desktopLaunchStatus && (
                <div style={{
                  marginTop: 8,
                  color: '#9ca3af',
                  fontSize: 11,
                  lineHeight: 1.4,
                  maxWidth: 240,
                }}>
                  {desktopLaunchStatus}
                </div>
              )}
            </div>
          </div>

          {/* Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {/* Keystrokes */}
            <div style={{ background: '#131e35', borderRadius: 6, padding: '14px 14px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Gõ phím</span>
                <span style={{ color: '#4b6a9e' }}><KeyboardIcon /></span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1 }}>{formatNum(displayKeys)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                {tracking && keysPerHr > 0 ? (
                  <>
                    <span style={{ color: '#22c55e' }}><TrendUpIcon /></span>
                    <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>+{keysPerHrStr} /hr</span>
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: '#374151', fontWeight: 500 }}>
                    {tracking ? `+${localKeys} session` : '— Paused'}
                  </span>
                )}
              </div>
              {desktopOnline && desktopTracking && (
                <div style={{ fontSize: 10, color: '#22c55e55', marginTop: 4 }}>
                  + Desktop
                </div>
              )}
            </div>

            {/* Clicks */}
            <div style={{ background: '#131e35', borderRadius: 6, padding: '14px 14px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Click chuột</span>
                <span style={{ color: '#4b6a9e' }}><MouseIcon /></span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1 }}>{formatNum(displayClicks)}</div>
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: 11, color: '#374151', fontWeight: 500 }}>
                  {tracking ? `+${localClicks} session` : '— Avg pace'}
                </span>
              </div>
              {desktopOnline && desktopTracking && (
                <div style={{ fontSize: 10, color: '#22c55e55', marginTop: 4 }}>
                  + Desktop
                </div>
              )}
            </div>
          </div>

          {/* Productivity Score */}
          <div style={{
            background: '#131e35', borderRadius: 6, padding: '14px 14px 12px',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e88', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Điểm Năng Suất</div>
                <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{score}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 28 }}>
              {scoreHistory.map((h, i) => (
                <div key={i} style={{
                  width: 6, height: `${(h / maxBar) * 28}px`,
                  borderRadius: '3px 3px 0 0',
                  background: i === scoreHistory.length - 1 ? '#22c55e' : '#3b82f6',
                  opacity: i >= scoreHistory.length - 2 ? 1 : 0.4,
                  transition: 'height 0.4s ease',
                }} />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px 16px', borderTop: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 6,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, flexShrink: 0,
              boxShadow: '0 0 0 2px rgba(59,130,246,0.3)',
            }}>{(user?.name || 'U').substring(0, 1).toUpperCase()}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{user?.name || 'Người dùng'}</div>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{user?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}</div>
            </div>
          </div>
          <span style={{ color: '#4b5563', display: 'flex', padding: 6, cursor: 'pointer' }} onClick={() => {
            localStorage.clear();
            window.location.href = '/login';
          }}><LogoutIcon /></span>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
}
