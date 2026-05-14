import React from 'react';
import { useTracking } from '../context/TrackingContext';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Keyboard,
  LogOut,
  Monitor,
  Mouse,
  Play,
  Square,
  TrendingUp,
  XCircle,
} from 'lucide-react';

const StopIcon = () => <Square size={28} fill="currentColor" strokeWidth={0} />;
const PlayIcon = () => <Play size={28} fill="currentColor" strokeWidth={0} />;
const KeyboardIcon = () => <Keyboard size={15} />;
const MouseIcon = () => <Mouse size={15} />;
const TrendUpIcon = () => <TrendingUp size={12} strokeWidth={2.5} />;
const LogoutIcon = () => <LogOut size={16} />;
const DesktopIcon = () => <Monitor size={14} />;

export default function Tracker() {
  const { user, logout } = useAuth();
  const {
    tracking, seconds,
    activeSecondsToday, totalKeys, totalClicks, score, connected,
    desktopLaunchStatus, desktopLaunchStatusType, scoreHistory, formatNum, formatTime, toggle,
    desktopOnline, desktopTracking, desktopInfo, startTrack, trackingState, trackingPending,
  } = useTracking();

  const maxBar = Math.max(...scoreHistory, 1);
  const displayKeys = totalKeys;
  const displayClicks = totalClicks;
  const keysPerHr = activeSecondsToday > 0 ? Math.round((displayKeys / activeSecondsToday) * 3600) : 0;
  const keysPerHrStr = keysPerHr >= 1000 ? (keysPerHr / 1000).toFixed(1) + 'k' : keysPerHr;
  const showDesktopAction = !desktopOnline || (tracking && desktopOnline && !desktopTracking);
  const desktopActionLabel = desktopOnline ? 'Bật' : 'Mở';
  const sourceLabel = desktopOnline && desktopTracking ? 'Desktop' : 'Chờ desktop';
  const mainActionLabel = trackingState === 'starting'
    ? 'Đang bật'
    : trackingState === 'stopping'
      ? 'Đang dừng'
      : tracking ? 'Dừng' : 'Bắt đầu';
  const StatusIcon = {
    success: CheckCircle2,
    warning: AlertTriangle,
    error: XCircle,
    info: Info,
  }[desktopLaunchStatusType || 'info'];
  const statusColor = {
    success: '#16a34a',
    warning: '#d97706',
    error: '#dc2626',
    info: '#64748b',
  }[desktopLaunchStatusType || 'info'];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: '1rem',
    }}>
      {/* Widget Card */}
      <div className="tracker-card" style={{
        width: 320,
        background: '#ffffff',
        borderRadius: 4,
        border: '1px solid rgba(15,23,42,0.08)',
        boxShadow: '0 32px 80px rgba(15,23,42,0.14)',
        overflow: 'hidden',
        fontFamily: "'Space Grotesk', -apple-system, system-ui, sans-serif",
        color: '#0f172a',
      }}>

        {/* Title Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px 12px',
          borderBottom: '1px solid rgba(15,23,42,0.06)',
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
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#94a3b8', cursor: 'pointer' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#94a3b8', cursor: 'pointer' }} />
          </div>
        </div>

        {/* Desktop Status Indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px',
          background: desktopOnline
            ? 'linear-gradient(90deg, rgba(34,197,94,0.08), rgba(34,197,94,0.03))'
            : 'linear-gradient(90deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))',
          borderBottom: '1px solid rgba(15,23,42,0.04)',
        }}>
          <span style={{ color: desktopOnline ? '#22c55e' : '#64748b', display: 'flex' }}>
            <DesktopIcon />
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: desktopOnline ? '#22c55e' : '#64748b',
          }}>
            Desktop Tracker: {desktopOnline ? (desktopTracking ? 'Đang chạy' : 'Online (tạm dừng)') : 'Offline'}
          </span>
          {desktopOnline && desktopInfo?.deviceName && (
            <span style={{
              fontSize: 10,
              color: '#64748b',
              marginLeft: showDesktopAction ? 0 : 'auto',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {desktopInfo.deviceName}
            </span>
          )}
          {showDesktopAction && (
            <button
              type="button"
              data-no-track="true"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void startTrack({ launchDesktop: true });
              }}
              style={{
                marginLeft: 'auto',
                flexShrink: 0,
                height: 24,
                padding: '0 10px',
                borderRadius: 6,
                border: '1px solid rgba(59,130,246,0.5)',
                background: 'rgba(59,130,246,0.14)',
                color: '#2563eb',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {desktopActionLabel}
            </button>
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
                  if (trackingPending) return;
                  toggle();
                }}
                disabled={trackingPending}
                style={{
                  width: 112, height: 112, borderRadius: 12, border: 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                  background: tracking
                    ? 'linear-gradient(145deg, #3b82f6, #2563eb)'
                    : 'linear-gradient(145deg, #dbeafe, #bfdbfe)',
                  boxShadow: tracking
                    ? '0 8px 32px rgba(59,130,246,0.45), inset 0 1px 0 rgba(15,23,42,0.16)'
                    : '0 4px 16px rgba(15,23,42,0.12), inset 0 1px 0 rgba(15,23,42,0.06)',
                  color: tracking ? '#ffffff' : '#2563eb',
                  opacity: trackingPending ? 0.72 : 1,
                  cursor: trackingPending ? 'wait' : 'pointer',
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
                  color: tracking ? 'rgba(255,255,255,0.92)' : '#2563eb',
                }}>
                  {mainActionLabel}
                </span>
              </button>
            </div>

            {/* Session Time */}
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, letterSpacing: '0.05em' }}>Phiên từ Desktop</div>
              <div style={{
                fontSize: 28, fontWeight: 800, fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                letterSpacing: '0.04em', color: tracking ? '#2563eb' : '#64748b', transition: 'color 0.3s',
              }}>
                {formatTime(seconds)}
              </div>
              {desktopLaunchStatus && (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  gap: 6,
                  marginTop: 8,
                  color: statusColor,
                  fontSize: 11,
                  lineHeight: 1.4,
                  maxWidth: 240,
                }}>
                  <StatusIcon size={13} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span>{desktopLaunchStatus}</span>
                </div>
              )}
              {!tracking && activeSecondsToday > 0 && (
                <div style={{ marginTop: 7, fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                  Hôm nay: {formatTime(activeSecondsToday)}
                </div>
              )}
            </div>
          </div>

          {/* Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {/* Keystrokes */}
            <div style={{ background: '#f8fafc', borderRadius: 6, padding: '14px 14px 12px', border: '1px solid rgba(15,23,42,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Gõ phím</span>
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
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
                    {tracking || trackingPending ? sourceLabel : '— Tạm dừng'}
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
            <div style={{ background: '#f8fafc', borderRadius: 6, padding: '14px 14px 12px', border: '1px solid rgba(15,23,42,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Click chuột</span>
                <span style={{ color: '#4b6a9e' }}><MouseIcon /></span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1 }}>{formatNum(displayClicks)}</div>
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
                  {tracking || trackingPending ? sourceLabel : '— Tạm dừng'}
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
            background: '#f8fafc', borderRadius: 6, padding: '14px 14px 12px',
            border: '1px solid rgba(15,23,42,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e88', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Điểm Năng Suất</div>
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
          padding: '12px 20px 16px', borderTop: '1px solid rgba(15,23,42,0.06)',
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
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>{user?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}</div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Đăng xuất"
            style={{ color: '#64748b', display: 'flex', padding: 6, cursor: 'pointer', border: 'none', background: 'transparent' }}
            onClick={() => { void logout(); }}
          >
            <LogoutIcon />
          </button>
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
