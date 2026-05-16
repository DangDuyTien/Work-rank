import React, { useEffect, useState } from 'react';
import { useTracking } from '../context/TrackingContext';
import { useAuth } from '../context/AuthContext';
import { AVATAR_UPDATED_EVENT, getUserAvatar, initialsFromName } from '../utils/avatar';
import { getAppSettings, subscribeAppSettings } from '../utils/settings';
import BrandMark from '../components/BrandMark';
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

const DESKTOP_WINDOWS_DOWNLOAD_URL = import.meta.env.VITE_DESKTOP_WINDOWS_DOWNLOAD_URL || '/downloads/WorkRank%20Tracker-Setup-1.0.0-x64.exe';

export default function Tracker() {
  const { user, logout } = useAuth();
  const [appSettings, setAppSettings] = useState(getAppSettings);
  const [desktopConsentOpen, setDesktopConsentOpen] = useState(false);
  const [desktopConsentChecked, setDesktopConsentChecked] = useState(false);
  const [desktopDownloadStarted, setDesktopDownloadStarted] = useState(false);
  const [desktopDownloadError, setDesktopDownloadError] = useState('');
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);
  const avatarUrl = getUserAvatar(user);
  const {
    tracking, seconds,
    activeSecondsToday, totalKeys, totalClicks, score, connected,
    desktopLaunchStatus, desktopLaunchStatusType, scoreHistory, formatNum, formatTime, toggle,
    desktopOnline, desktopTracking, desktopInfo, desktopLaunchUrl, startTrack, trackingState, trackingPending,
  } = useTracking();

  const maxBar = Math.max(...scoreHistory, 1);
  const displayKeys = totalKeys;
  const displayClicks = totalClicks;
  const keysPerHr = activeSecondsToday > 0 ? Math.round((displayKeys / activeSecondsToday) * 3600) : 0;
  const keysPerHrStr = keysPerHr >= 1000 ? (keysPerHr / 1000).toFixed(1) + 'k' : keysPerHr;
  const showDesktopAction = !desktopOnline || (tracking && desktopOnline && !desktopTracking);

  useEffect(() => {
    const refreshAvatars = () => setAvatarRefreshKey((key) => key + 1);
    window.addEventListener(AVATAR_UPDATED_EVENT, refreshAvatars);
    return () => window.removeEventListener(AVATAR_UPDATED_EVENT, refreshAvatars);
  }, []);
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

  const requestStartTrack = (options = {}) => {
    if (options.launchDesktop && !desktopOnline) {
      setDesktopConsentChecked(false);
      setDesktopDownloadStarted(false);
      setDesktopDownloadError('');
      setDesktopConsentOpen(true);
      return false;
    }
    void startTrack(options);
    return true;
  };

  const closeDesktopConsent = () => {
    setDesktopConsentOpen(false);
  };

  const downloadDesktopTracker = async () => {
    setDesktopDownloadError('');
    const shouldPreflight = DESKTOP_WINDOWS_DOWNLOAD_URL.startsWith('/')
      || DESKTOP_WINDOWS_DOWNLOAD_URL.startsWith(window.location.origin);
    if (shouldPreflight) {
      try {
        const response = await fetch(DESKTOP_WINDOWS_DOWNLOAD_URL, {
          method: 'HEAD',
          cache: 'no-store',
          redirect: 'manual',
        });
        if (response.status >= 400) {
          setDesktopDownloadError('Server chưa có file cài đặt Windows. Admin cần upload file .exe và set DESKTOP_WINDOWS_DOWNLOAD_URL trên Render.');
          return;
        }
      } catch {
        // Some browsers block preflight for cross-origin redirects; still try the actual download.
      }
    }
    setDesktopDownloadStarted(true);
    window.open(DESKTOP_WINDOWS_DOWNLOAD_URL, '_blank', 'noopener,noreferrer');
  };

  const openInstalledDesktopTracker = () => {
    setDesktopConsentOpen(false);
    void startTrack({ launchDesktop: true });
  };

  useEffect(() => subscribeAppSettings(setAppSettings), []);

  return (
    <div className="tracker-page-shell">
      {/* Widget Card */}
      <div className="tracker-card" style={{
        width: 320,
        background: '#ffffff',
        borderRadius: 8,
        border: '1px solid rgba(15,23,42,0.08)',
        boxShadow: '0 18px 50px rgba(15,23,42,0.07)',
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
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <BrandMark
              size={30}
              showLabel
              labelStyle={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.3px' }}
            />
          </div>
          <span style={{
            padding: '4px 8px',
            borderRadius: 5,
            background: connected ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            color: connected ? '#16a34a' : '#dc2626',
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>

        {/* Desktop Status Indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px',
          background: desktopOnline && tracking
            ? 'linear-gradient(90deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))'
            : desktopOnline
            ? 'linear-gradient(90deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))'
            : 'linear-gradient(90deg, rgba(15,23,42,0.06), rgba(255,255,255,0.02))',
          borderBottom: '1px solid rgba(15,23,42,0.04)',
        }}>
          <span style={{ color: desktopOnline && tracking ? '#22c55e' : desktopOnline ? '#f59e0b' : '#6b7280', display: 'flex' }}>
            <DesktopIcon />
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: desktopOnline && tracking ? '#22c55e' : desktopOnline ? '#f59e0b' : '#6b7280',
          }}>
            Desktop: {desktopOnline ? (desktopTracking ? 'Đang chạy' : 'Online (tạm dừng)') : 'Offline'}
            {desktopTracking && <span style={{ marginLeft: 6, display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse-dot 1.5s infinite' }} />}
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
                requestStartTrack({ launchDesktop: true });
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
                  if (tracking) {
                    toggle();
                  } else {
                    requestStartTrack({ launchDesktop: Boolean(appSettings.tracker?.autoLaunchDesktop) });
                  }
                }}
                disabled={trackingPending}
                style={{
                  width: 112, height: 112, borderRadius: 12, border: 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                  background: tracking
                    ? 'linear-gradient(145deg, #3b82f6, #2563eb)'
                    : 'linear-gradient(145deg, #ffffff, #ffffff)',
                  boxShadow: tracking
                    ? '0 8px 32px rgba(59,130,246,0.45), inset 0 1px 0 rgba(15,23,42,0.12)'
                    : '0 4px 16px rgba(15,23,42,0.08), inset 0 1px 0 rgba(15,23,42,0.04)',
                  color: tracking ? '#ffffff' : '#3b82f6',
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
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, letterSpacing: '0.05em' }}>Phiên từ Desktop</div>
              <div style={{
                fontSize: 28, fontWeight: 800, fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                letterSpacing: '0.04em', color: tracking ? '#3b82f6' : '#6b7280', transition: 'color 0.3s',
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
              {desktopLaunchUrl && (desktopLaunchStatusType === 'warning' || desktopLaunchStatusType === 'error') && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    data-no-track="true"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDesktopConsentChecked(false);
                      setDesktopDownloadStarted(false);
                      setDesktopDownloadError('');
                      setDesktopConsentOpen(true);
                    }}
                    style={{
                      height: 27,
                      padding: '0 9px',
                      borderRadius: 6,
                      border: '1px solid rgba(37,99,235,0.28)',
                      background: 'rgba(37,99,235,0.1)',
                      color: '#2563eb',
                      fontSize: 11,
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                  >
                    Tải app Windows
                  </button>
                  <a
                    href={desktopLaunchUrl}
                    data-no-track="true"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      height: 27,
                      padding: '0 9px',
                      borderRadius: 6,
                      border: '1px solid rgba(100,116,139,0.18)',
                      background: '#ffffff',
                      color: '#64748b',
                      fontSize: 11,
                      fontWeight: 900,
                      textDecoration: 'none',
                    }}
                  >
                    Mở app đã cài
                  </a>
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
            background: 'rgba(15,23,42,0.03)', borderRadius: 6, padding: '14px 14px 12px',
            border: '1px solid rgba(15,23,42,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.6)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Điểm Năng Suất</div>
                <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2, color: '#0f172a' }}>{score}</div>
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
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              fontSize: 13, fontWeight: 800, flexShrink: 0,
              boxShadow: '0 0 0 2px rgba(59,130,246,0.3)',
            }} data-avatar-refresh={avatarRefreshKey}>
              {avatarUrl ? (
                <img src={avatarUrl} alt={`Ảnh đại diện ${user?.name || 'Người dùng'}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : initialsFromName(user?.name || 'U')}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, color: '#0f172a' }}>{user?.name || 'Người dùng'}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{user?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}</div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Đăng xuất"
            style={{ color: '#94a3b8', display: 'flex', padding: 6, cursor: 'pointer', border: 'none', background: 'transparent' }}
            onClick={() => { void logout(); }}
          >
            <LogoutIcon />
          </button>
        </div>
      </div>



      {desktopConsentOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="desktop-consent-title"
          onClick={closeDesktopConsent}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 18,
            background: 'rgba(15,23,42,0.48)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(420px, calc(100vw - 32px))',
              minHeight: 420,
              background: '#ffffff',
              borderRadius: 8,
              border: '1px solid rgba(15,23,42,0.08)',
              boxShadow: '0 24px 70px rgba(15,23,42,0.26)',
              color: '#0f172a',
              overflow: 'hidden',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 14,
              padding: '18px 18px 14px',
              borderBottom: '1px solid rgba(15,23,42,0.08)',
            }}>
              <div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '5px 8px',
                  borderRadius: 6,
                  background: 'rgba(217,119,6,0.1)',
                  color: '#b45309',
                  fontSize: 11,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 10,
                }}>
                  <AlertTriangle size={13} />
                  Lưu ý trước khi cài
                </div>
                <h2 id="desktop-consent-title" style={{
                  margin: 0,
                  fontSize: 20,
                  lineHeight: 1.18,
                  fontWeight: 900,
                  letterSpacing: 0,
                }}>
                  Cài WorkRank Tracker cho Windows
                </h2>
                <p style={{
                  margin: '8px 0 0',
                  color: '#64748b',
                  fontSize: 13,
                  lineHeight: 1.45,
                  fontWeight: 600,
                }}>
                  Desktop Tracker cần chạy trên máy để web có thể đếm thao tác ngoài trình duyệt.
                </p>
              </div>
              <button
                type="button"
                data-no-track="true"
                aria-label="Đóng cảnh báo cài đặt"
                onClick={closeDesktopConsent}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 6,
                  border: '1px solid rgba(15,23,42,0.1)',
                  background: '#f8fafc',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <XCircle size={17} />
              </button>
            </div>

            <div style={{ padding: 18 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                marginBottom: 12,
              }}>
                <div style={{
                  border: '1px solid rgba(37,99,235,0.16)',
                  background: 'rgba(37,99,235,0.06)',
                  borderRadius: 8,
                  padding: 12,
                }}>
                  <div style={{ color: '#2563eb', marginBottom: 8, display: 'flex' }}>
                    <KeyboardIcon />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 900 }}>Gõ phím</div>
                  <div style={{ marginTop: 4, color: '#64748b', fontSize: 12, lineHeight: 1.35, fontWeight: 600 }}>
                    Chỉ đếm số lần gõ, không đọc nội dung phím.
                  </div>
                </div>
                <div style={{
                  border: '1px solid rgba(37,99,235,0.16)',
                  background: 'rgba(37,99,235,0.06)',
                  borderRadius: 8,
                  padding: 12,
                }}>
                  <div style={{ color: '#2563eb', marginBottom: 8, display: 'flex' }}>
                    <MouseIcon />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 900 }}>Click chuột</div>
                  <div style={{ marginTop: 4, color: '#64748b', fontSize: 12, lineHeight: 1.35, fontWeight: 600 }}>
                    Chỉ đếm số lượng click để tính phiên làm việc.
                  </div>
                </div>
              </div>

              <div style={{
                border: '1px solid rgba(22,163,74,0.18)',
                background: 'rgba(22,163,74,0.07)',
                borderRadius: 8,
                padding: '12px 13px',
                marginBottom: 12,
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#15803d',
                  fontSize: 13,
                  fontWeight: 900,
                  marginBottom: 8,
                }}>
                  <CheckCircle2 size={16} />
                  Cam kết dữ liệu
                </div>
                <ul style={{
                  margin: 0,
                  paddingLeft: 18,
                  color: '#475569',
                  fontSize: 12,
                  lineHeight: 1.55,
                  fontWeight: 650,
                }}>
                  <li>Không ghi nội dung bạn gõ, mật khẩu, tin nhắn hay file.</li>
                  <li>Không chụp màn hình, không ghi âm, không đọc lịch sử trình duyệt.</li>
                  <li>Chỉ dùng số lần gõ phím và số click để tính điểm hoạt động.</li>
                </ul>
              </div>

              <div style={{
                border: '1px solid rgba(217,119,6,0.2)',
                background: 'rgba(217,119,6,0.08)',
                borderRadius: 8,
                padding: '11px 12px',
                color: '#92400e',
                fontSize: 12,
                lineHeight: 1.45,
                fontWeight: 700,
                marginBottom: 14,
              }}>
                Nếu máy chưa cài app, hãy bấm tải file .exe trước. Nút mở app đã cài chỉ hoạt động sau khi Windows đã cài WorkRank Tracker và đăng ký giao thức workrank://.
              </div>

              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '11px 12px',
                borderRadius: 8,
                border: '1px solid rgba(15,23,42,0.1)',
                background: '#f8fafc',
                cursor: 'pointer',
                marginBottom: 14,
              }}>
                <input
                  type="checkbox"
                  checked={desktopConsentChecked}
                  onChange={(e) => setDesktopConsentChecked(e.target.checked)}
                  style={{ marginTop: 2, width: 16, height: 16, accentColor: '#2563eb', flexShrink: 0 }}
                />
                <span style={{ fontSize: 12, lineHeight: 1.45, color: '#334155', fontWeight: 700 }}>
                  Tôi đã đọc cảnh báo và đồng ý cài WorkRank Tracker với phạm vi dữ liệu ở trên.
                </span>
              </label>

              {desktopDownloadError && (
                <div style={{
                  marginBottom: 14,
                  border: '1px solid rgba(220,38,38,0.2)',
                  background: 'rgba(254,242,242,0.85)',
                  color: '#b91c1c',
                  borderRadius: 8,
                  padding: '10px 11px',
                  fontSize: 12,
                  lineHeight: 1.45,
                  fontWeight: 750,
                }}>
                  {desktopDownloadError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                <button
                  type="button"
                  data-no-track="true"
                  onClick={closeDesktopConsent}
                  style={{
                    height: 40,
                    borderRadius: 7,
                    border: '1px solid rgba(15,23,42,0.1)',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  Để sau
                </button>
                <button
                  type="button"
                  data-no-track="true"
                  onClick={openInstalledDesktopTracker}
                  style={{
                    height: 40,
                    borderRadius: 7,
                    border: '1px solid rgba(37,99,235,0.22)',
                    background: '#ffffff',
                    color: '#2563eb',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  Đã cài, mở app
                </button>
                <button
                  type="button"
                  data-no-track="true"
                  disabled={!desktopConsentChecked}
                  onClick={downloadDesktopTracker}
                  style={{
                    gridColumn: '1 / -1',
                    height: 40,
                    borderRadius: 7,
                    border: 'none',
                    background: desktopConsentChecked ? '#2563eb' : '#cbd5e1',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: desktopConsentChecked ? 'pointer' : 'not-allowed',
                    boxShadow: desktopConsentChecked ? '0 10px 24px rgba(37,99,235,0.28)' : 'none',
                  }}
                >
                  Đồng ý và tải về
                </button>
              </div>

              {desktopDownloadStarted && (
                <div style={{
                  marginTop: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  color: '#15803d',
                  fontSize: 12,
                  lineHeight: 1.4,
                  fontWeight: 750,
                }}>
                  <span>Đã mở link tải. Sau khi cài xong, bấm mở Desktop Tracker.</span>
                  <button
                    type="button"
                    data-no-track="true"
                    onClick={openInstalledDesktopTracker}
                    style={{
                      flexShrink: 0,
                      height: 30,
                      padding: '0 10px',
                      borderRadius: 6,
                      border: '1px solid rgba(22,163,74,0.25)',
                      background: '#ffffff',
                      color: '#15803d',
                      fontSize: 11,
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                  >
                    Mở app
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
}
