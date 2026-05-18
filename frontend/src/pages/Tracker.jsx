import React, { useEffect, useMemo, useState } from 'react';
import { useTracking } from '../context/TrackingContext';
import { useAuth } from '../context/AuthContext';
import { AVATAR_UPDATED_EVENT, getUserAvatar, initialsFromName } from '../utils/avatar';
import BrandMark from '../components/BrandMark';
import PerformanceSummary from '../components/PerformanceSummary';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  Gauge,
  Info,
  Keyboard,
  LogOut,
  Monitor,
  Mouse,
  Play,
  RefreshCw,
  Square,
  Target,
  TimerReset,
  TrendingUp,
  Wifi,
  WifiOff,
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
const TRACKER_DAILY_GOAL_KEY = 'workrank:tracker-daily-goal-minutes';
const TRACKER_BREAK_REMINDER_KEY = 'workrank:tracker-break-reminder-minutes';
const TRACKER_SESSION_FOCUS_KEY = 'workrank:tracker-session-focus';
const TRACKER_SESSION_NOTE_KEY = 'workrank:tracker-session-note';
const DESKTOP_TRACKER_CONSENT_KEY = 'workrank:desktop-tracker-consent:v1';

function getDesktopConsentKey(user) {
  const subject = user?.id || user?.email || 'guest';
  return `${DESKTOP_TRACKER_CONSENT_KEY}:${subject}`;
}

function loadDesktopConsent(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function saveDesktopConsent(key) {
  try {
    localStorage.setItem(key, '1');
  } catch {}
}

function loadNumberPreference(key, fallback, min, max) {
  try {
    const value = Number(localStorage.getItem(key) || fallback);
    if (!Number.isFinite(value)) return fallback;
    return Math.max(min, Math.min(max, value));
  } catch {
    return fallback;
  }
}

function loadTextPreference(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function formatDateTime(value) {
  if (!value) return 'Chưa có';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa rõ';
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default function Tracker() {
  const { user, logout } = useAuth();
  const [desktopConsentOpen, setDesktopConsentOpen] = useState(false);
  const [desktopConsentChecked, setDesktopConsentChecked] = useState(false);
  const [desktopConsentAccepted, setDesktopConsentAccepted] = useState(false);
  const [desktopDownloadStarted, setDesktopDownloadStarted] = useState(false);
  const [desktopDownloadError, setDesktopDownloadError] = useState('');
  const [desktopOpenNoticeOpen, setDesktopOpenNoticeOpen] = useState(false);
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(() => loadNumberPreference(TRACKER_DAILY_GOAL_KEY, 240, 15, 720));
  const [breakReminderMinutes, setBreakReminderMinutes] = useState(() => loadNumberPreference(TRACKER_BREAK_REMINDER_KEY, 50, 15, 180));
  const [sessionFocus, setSessionFocus] = useState(() => loadTextPreference(TRACKER_SESSION_FOCUS_KEY));
  const [sessionNote, setSessionNote] = useState(() => loadTextPreference(TRACKER_SESSION_NOTE_KEY));
  const [copiedLaunchUrl, setCopiedLaunchUrl] = useState(false);
  const avatarUrl = getUserAvatar(user);
  const {
    tracking, seconds,
    activeSecondsToday, totalKeys, totalClicks, score, connected,
    desktopLaunchStatus, desktopLaunchStatusType, scoreHistory, formatNum, formatTime, toggle,
    desktopOnline, desktopTracking, desktopInfo, desktopLaunchUrl, startTrack, stopTrack, trackingState, trackingPending,
    refreshDesktopStatus,
  } = useTracking();

  const maxBar = Math.max(...scoreHistory, 1);
  const displayKeys = totalKeys;
  const displayClicks = totalClicks;
  const totalActions = displayKeys + displayClicks;
  const keysPerHr = activeSecondsToday > 0 ? Math.round((displayKeys / activeSecondsToday) * 3600) : 0;
  const clicksPerHr = activeSecondsToday > 0 ? Math.round((displayClicks / activeSecondsToday) * 3600) : 0;
  const actionsPerHr = activeSecondsToday > 0 ? Math.round((totalActions / activeSecondsToday) * 3600) : 0;
  const actionsPerMin = activeSecondsToday > 0 ? Math.round(totalActions / Math.max(1, activeSecondsToday / 60)) : 0;
  const keysPerHrStr = keysPerHr >= 1000 ? (keysPerHr / 1000).toFixed(1) + 'k' : keysPerHr;
  const showDesktopAction = !desktopOnline || (tracking && desktopOnline && !desktopTracking);
  const activeMinutesToday = Math.round(activeSecondsToday / 60);
  const dailyGoalProgress = clampPercent((activeMinutesToday / Math.max(1, dailyGoalMinutes)) * 100);
  const remainingGoalMinutes = Math.max(0, dailyGoalMinutes - activeMinutesToday);
  const breakTotalSeconds = Math.max(1, breakReminderMinutes * 60);
  const breakProgress = clampPercent((seconds / breakTotalSeconds) * 100);
  const breakDue = tracking && seconds >= breakTotalSeconds;
  const breakRemainingLabel = breakDue ? 'Đến giờ nghỉ' : formatTime(Math.max(0, breakTotalSeconds - seconds));
  const keyShare = totalActions > 0 ? clampPercent((displayKeys / totalActions) * 100) : 0;
  const clickShare = totalActions > 0 ? 100 - keyShare : 0;
  const desktopStatusText = desktopOnline ? (desktopTracking ? 'Đang ghi nhận' : 'Online, tạm dừng') : 'Chưa kết nối';
  const desktopConsentKey = useMemo(() => getDesktopConsentKey(user), [user?.email, user?.id]);
  const canConfirmDesktopConsent = desktopConsentAccepted || desktopConsentChecked;
  const connectionItems = useMemo(() => ([
    {
      label: 'Realtime socket',
      value: connected ? 'Đang kết nối' : 'Mất kết nối',
      ok: connected,
      icon: connected ? Wifi : WifiOff,
    },
    {
      label: 'Desktop Tracker',
      value: desktopStatusText,
      ok: desktopOnline && desktopTracking,
      icon: Monitor,
    },
    {
      label: 'Thiết bị',
      value: desktopInfo?.deviceName || 'Chưa nhận diện',
      ok: Boolean(desktopInfo?.deviceName),
      icon: Gauge,
    },
    {
      label: 'Cập nhật cuối',
      value: formatDateTime(desktopInfo?.lastHeartbeat),
      ok: Boolean(desktopInfo?.lastHeartbeat),
      icon: Activity,
    },
  ]), [connected, desktopInfo?.deviceName, desktopInfo?.lastHeartbeat, desktopOnline, desktopStatusText]);
  const trackerLog = useMemo(() => {
    const rows = [
      {
        title: connected ? 'Realtime đã sẵn sàng' : 'Realtime đang mất kết nối',
        detail: connected ? 'Web nhận cập nhật trực tiếp từ server.' : 'Kiểm tra lại mạng hoặc refresh trang.',
        tone: connected ? 'success' : 'error',
      },
      {
        title: desktopOnline ? 'Desktop Tracker online' : 'Desktop Tracker chưa online',
        detail: desktopOnline
          ? `${desktopInfo?.deviceName || 'Desktop'} · ${desktopTracking ? 'đang ghi dữ liệu' : 'đang tạm dừng'}`
          : 'Bấm mở app đã cài hoặc tải bản Windows nếu chưa cài.',
        tone: desktopOnline ? 'success' : 'warning',
      },
    ];
    if (tracking) {
      rows.push({
        title: 'Phiên theo dõi đang chạy',
        detail: `Đã chạy ${formatTime(seconds)}${sessionFocus.trim() ? ` · ${sessionFocus.trim()}` : ''}`,
        tone: 'info',
      });
    }
    if (desktopLaunchStatus) {
      rows.push({
        title: desktopLaunchStatusType === 'error' ? 'Cần xử lý Desktop' : 'Thông báo Desktop',
        detail: desktopLaunchStatus,
        tone: desktopLaunchStatusType || 'info',
      });
    }
    return rows.slice(-4);
  }, [connected, desktopInfo?.deviceName, desktopLaunchStatus, desktopLaunchStatusType, desktopOnline, desktopTracking, formatTime, seconds, sessionFocus, tracking]);

  useEffect(() => {
    try { localStorage.setItem(TRACKER_DAILY_GOAL_KEY, String(dailyGoalMinutes)); } catch {}
  }, [dailyGoalMinutes]);

  useEffect(() => {
    try { localStorage.setItem(TRACKER_BREAK_REMINDER_KEY, String(breakReminderMinutes)); } catch {}
  }, [breakReminderMinutes]);

  useEffect(() => {
    try { localStorage.setItem(TRACKER_SESSION_FOCUS_KEY, sessionFocus); } catch {}
  }, [sessionFocus]);

  useEffect(() => {
    try { localStorage.setItem(TRACKER_SESSION_NOTE_KEY, sessionNote); } catch {}
  }, [sessionNote]);

  useEffect(() => {
    const refreshAvatars = () => setAvatarRefreshKey((key) => key + 1);
    window.addEventListener(AVATAR_UPDATED_EVENT, refreshAvatars);
    return () => window.removeEventListener(AVATAR_UPDATED_EVENT, refreshAvatars);
  }, []);

  useEffect(() => {
    const accepted = loadDesktopConsent(desktopConsentKey);
    setDesktopConsentAccepted(accepted);
    setDesktopConsentChecked(accepted);
  }, [desktopConsentKey]);

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

  const openDesktopConsentGuide = ({ resetDownload = true } = {}) => {
    setDesktopConsentChecked(desktopConsentAccepted);
    if (resetDownload) {
      setDesktopDownloadStarted(false);
      setDesktopDownloadError('');
    }
    setDesktopConsentOpen(true);
  };

  const rememberDesktopConsent = () => {
    saveDesktopConsent(desktopConsentKey);
    setDesktopConsentAccepted(true);
    setDesktopConsentChecked(true);
  };

  const requestStartTrack = (options = {}) => {
    if (options.launchDesktop && !desktopOnline && !desktopConsentAccepted) {
      openDesktopConsentGuide();
      return false;
    }
    if (options.launchDesktop && !desktopOnline) {
      setDesktopOpenNoticeOpen(true);
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
    setDesktopOpenNoticeOpen(true);
    void startTrack({ launchDesktop: true });
  };

  const confirmConsentAndOpenInstalled = () => {
    if (!canConfirmDesktopConsent) return;
    rememberDesktopConsent();
    openInstalledDesktopTracker();
  };

  const confirmConsentAndDownload = () => {
    if (!canConfirmDesktopConsent) return;
    rememberDesktopConsent();
    void downloadDesktopTracker();
  };

  const handleDesktopDownload = () => {
    if (!desktopConsentAccepted) {
      setDesktopOpenNoticeOpen(false);
      openDesktopConsentGuide();
      return;
    }
    void downloadDesktopTracker();
  };

  const openDesktopTrackerFromNotice = () => {
    setDesktopOpenNoticeOpen(true);
    void startTrack({ launchDesktop: true });
  };

  const copyDesktopLaunchUrl = async () => {
    if (!desktopLaunchUrl) return;
    try {
      await navigator.clipboard.writeText(desktopLaunchUrl);
      setCopiedLaunchUrl(true);
      window.setTimeout(() => setCopiedLaunchUrl(false), 1600);
    } catch {
      setCopiedLaunchUrl(false);
    }
  };

  useEffect(() => {
    if (desktopOpenNoticeOpen && desktopOnline) {
      setDesktopOpenNoticeOpen(false);
    }
  }, [desktopOnline, desktopOpenNoticeOpen]);

  return (
    <div className="tracker-page-shell">
      {/* Widget Card */}
      <div data-tour="tracker-widget" className="tracker-card" style={{
        width: 320,
        background: '#ffffff',
        borderRadius: 0,
        border: '1px solid rgba(15,23,42,0.08)',
        boxShadow: 'none',
        overflow: 'hidden',
        fontFamily: "'JetBrains Mono', monospace",
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              data-no-track="true"
              aria-label="Xem lại hướng dẫn Desktop Tracker"
              title="Xem lại hướng dẫn Desktop Tracker"
              className="tracker-help-button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openDesktopConsentGuide({ resetDownload: false });
              }}
            >
              ?
            </button>
            <span style={{
              padding: '4px 8px',
              borderRadius: 0,
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
        </div>

        {/* Desktop Status Indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px',
          background: desktopOnline && tracking
            ? 'rgba(34,197,94,0.08)'
            : desktopOnline
            ? 'rgba(245,158,11,0.08)'
            : 'rgba(15,23,42,0.03)',
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
                borderRadius: 0,
                border: '1px solid rgba(56,189,248,0.5)',
                background: 'rgba(56,189,248,0.14)',
                color: '#38bdf8',
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
                  position: 'absolute', inset: -6, borderRadius: 0,
                  background: 'rgba(56,189,248,0.15)',
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
                    requestStartTrack({ launchDesktop: true });
                  }
                }}
                disabled={trackingPending}
                style={{
                  width: 112, height: 112, borderRadius: 0, border: 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                  background: tracking
                    ? '#38bdf8'
                    : '#ffffff',
                  boxShadow: 'none',
                  color: tracking ? '#ffffff' : '#38bdf8',
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
                  color: tracking ? 'rgba(255,255,255,0.92)' : '#38bdf8',
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
                letterSpacing: '0.04em', color: tracking ? '#38bdf8' : '#6b7280', transition: 'color 0.3s',
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
                      handleDesktopDownload();
                    }}
                    style={{
                      height: 27,
                      padding: '0 9px',
                      borderRadius: 0,
                      border: '1px solid rgba(56,189,248,0.28)',
                      background: 'rgba(56,189,248,0.1)',
                      color: '#38bdf8',
                      fontSize: 11,
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                  >
                    Tải .exe Windows
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
                      borderRadius: 0,
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
            <div style={{ background: '#f8fafc', borderRadius: 0, padding: '14px 14px 12px', border: '1px solid rgba(15,23,42,0.08)' }}>
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
            <div style={{ background: '#f8fafc', borderRadius: 0, padding: '14px 14px 12px', border: '1px solid rgba(15,23,42,0.08)' }}>
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
            background: 'rgba(15,23,42,0.03)', borderRadius: 0, padding: '14px 14px 12px',
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
                  background: i === scoreHistory.length - 1 ? '#22c55e' : '#38bdf8',
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
              width: 34, height: 34, borderRadius: 0,
              background: '#38bdf8',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              fontSize: 13, fontWeight: 800, flexShrink: 0,
              boxShadow: 'none',
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

      <div className="tracker-dashboard">
        <section className="tracker-panel tracker-panel-wide">
          <div className="tracker-panel-head">
            <div>
              <div className="tracker-panel-kicker">Realtime</div>
              <h2>Tổng quan theo dõi</h2>
            </div>
            <span className={tracking ? 'tracker-live-pill is-on' : 'tracker-live-pill'}>
              {tracking ? 'Đang chạy' : 'Đang chờ'}
            </span>
          </div>
          <div className="tracker-metric-grid">
            <div className="tracker-metric">
              <CalendarDays size={15} />
              <span>Hôm nay</span>
              <strong>{formatTime(activeSecondsToday)}</strong>
            </div>
            <div className="tracker-metric">
              <Activity size={15} />
              <span>Thao tác</span>
              <strong>{formatNum(totalActions)}</strong>
            </div>
            <div className="tracker-metric">
              <TrendingUp size={15} />
              <span>Tốc độ</span>
              <strong>{formatNum(actionsPerHr)}/h</strong>
            </div>
            <div className="tracker-metric">
              <Gauge size={15} />
              <span>Điểm</span>
              <strong>{score}</strong>
            </div>
          </div>
        </section>

        <section className="tracker-panel">
          <div className="tracker-panel-head">
            <div>
              <div className="tracker-panel-kicker">Mục tiêu</div>
              <h2>Tiến độ hôm nay</h2>
            </div>
            <Target size={17} color="#38bdf8" />
          </div>
          <div className="tracker-goal-row">
            <strong>{activeMinutesToday}p</strong>
            <label>
              <input
                type="number"
                min="15"
                max="720"
                step="15"
                value={dailyGoalMinutes}
                onChange={(event) => setDailyGoalMinutes(Math.max(15, Math.min(720, Number(event.target.value || 15))))}
              />
              phút
            </label>
          </div>
          <div className="tracker-progress-bar">
            <span style={{ width: `${dailyGoalProgress}%` }} />
          </div>
          <div className="tracker-panel-note">
            {dailyGoalProgress >= 100 ? 'Đã đạt mục tiêu theo dõi hôm nay.' : `Còn ${remainingGoalMinutes} phút để đạt mục tiêu.`}
          </div>
        </section>

        <section className="tracker-panel">
          <div className="tracker-panel-head">
            <div>
              <div className="tracker-panel-kicker">Phiên hiện tại</div>
              <h2>Nhắc nghỉ</h2>
            </div>
            <TimerReset size={17} color={breakDue ? '#d97706' : '#38bdf8'} />
          </div>
          <div className={breakDue ? 'tracker-break-alert is-due' : 'tracker-break-alert'}>
            <strong>{breakRemainingLabel}</strong>
            <span>{breakDue ? 'Nên đứng dậy hoặc nghỉ mắt 3-5 phút.' : 'Thời gian còn lại trước nhắc nghỉ.'}</span>
          </div>
          <div className="tracker-progress-bar">
            <span style={{ width: `${breakProgress}%`, background: breakDue ? '#d97706' : '#38bdf8' }} />
          </div>
          <label className="tracker-inline-control">
            Nhắc sau
            <input
              type="number"
              min="15"
              max="180"
              step="5"
              value={breakReminderMinutes}
              onChange={(event) => setBreakReminderMinutes(Math.max(15, Math.min(180, Number(event.target.value || 15))))}
            />
            phút
          </label>
        </section>

        <section data-tour="tracker-desktop-install" className="tracker-panel tracker-panel-wide">
          <div className="tracker-panel-head">
            <div>
              <div className="tracker-panel-kicker">Desktop</div>
              <h2>Thiết bị và kết nối</h2>
            </div>
            <button
              type="button"
              data-no-track="true"
              className="tracker-text-button"
              onClick={() => { void refreshDesktopStatus?.(); }}
            >
              <RefreshCw size={13} />
              Cập nhật
            </button>
          </div>
          <div className="tracker-connection-grid">
            {connectionItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="tracker-connection-item">
                  <Icon size={15} />
                  <div>
                    <span>{item.label}</span>
                    <strong className={item.ok ? 'is-ok' : ''}>{item.value}</strong>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="tracker-action-row">
            <button
              type="button"
              data-no-track="true"
              disabled={trackingPending}
              onClick={() => { tracking ? void stopTrack() : requestStartTrack({ launchDesktop: true }); }}
              className="tracker-action-primary"
            >
              {tracking ? <Square size={14} fill="currentColor" strokeWidth={0} /> : <Play size={14} fill="currentColor" strokeWidth={0} />}
              {tracking ? 'Dừng theo dõi' : 'Bắt đầu và mở app'}
            </button>
            <button
              data-tour="tracker-download"
              type="button"
              data-no-track="true"
              onClick={handleDesktopDownload}
              className="tracker-action-secondary"
            >
              <Download size={14} />
              Tải .exe Windows
            </button>
            <button
              type="button"
              data-no-track="true"
              disabled={!desktopLaunchUrl}
              onClick={copyDesktopLaunchUrl}
              className="tracker-action-secondary"
            >
              <Copy size={14} />
              {copiedLaunchUrl ? 'Đã copy' : 'Copy link mở'}
            </button>
          </div>
        </section>

        <section className="tracker-panel">
          <div className="tracker-panel-head">
            <div>
              <div className="tracker-panel-kicker">Hiện tại</div>
              <h2>Tỉ lệ thao tác</h2>
            </div>
            <BarChart3 size={17} color="#38bdf8" />
          </div>
          <div className="tracker-input-split">
            <div>
              <span>Gõ phím</span>
              <strong>{keyShare}%</strong>
            </div>
            <div>
              <span>Click</span>
              <strong>{clickShare}%</strong>
            </div>
          </div>
          <div className="tracker-split-bar">
            <span style={{ width: `${keyShare}%` }} />
          </div>
          <div className="tracker-rate-grid">
            <div><span>Phím/giờ</span><strong>{formatNum(keysPerHr)}</strong></div>
            <div><span>Click/giờ</span><strong>{formatNum(clicksPerHr)}</strong></div>
            <div><span>Thao tác/phút</span><strong>{formatNum(actionsPerMin)}</strong></div>
          </div>
        </section>

        <PerformanceSummary compact className="tracker-panel-wide" />

        <section className="tracker-panel">
          <div className="tracker-panel-head">
            <div>
              <div className="tracker-panel-kicker">Ghi chú</div>
              <h2>Việc đang theo dõi</h2>
            </div>
            <ClipboardList size={17} color="#38bdf8" />
          </div>
          <input
            className="tracker-input"
            value={sessionFocus}
            maxLength={80}
            onChange={(event) => setSessionFocus(event.target.value)}
            placeholder="Việc đang làm"
          />
          <textarea
            className="tracker-note"
            value={sessionNote}
            onChange={(event) => setSessionNote(event.target.value)}
            placeholder="Ghi chú nhanh cho phiên này"
          />
          {(sessionFocus || sessionNote) && (
            <button
              type="button"
              data-no-track="true"
              className="tracker-text-button"
              onClick={() => {
                setSessionFocus('');
                setSessionNote('');
              }}
            >
              Xóa ghi chú
            </button>
          )}
        </section>

        <section className="tracker-panel tracker-panel-wide">
          <div className="tracker-panel-head">
            <div>
              <div className="tracker-panel-kicker">Nhật ký</div>
              <h2>Tín hiệu gần đây</h2>
            </div>
            <Activity size={17} color="#38bdf8" />
          </div>
          <div className="tracker-log-list">
            {trackerLog.map((item, index) => (
              <div key={`${item.title}-${index}`} className={`tracker-log-item is-${item.tone}`}>
                <span />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {desktopOpenNoticeOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="desktop-open-notice-title"
          onClick={() => setDesktopOpenNoticeOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 82,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 18,
            background: 'rgba(15,23,42,0.38)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(430px, calc(100vw - 32px))',
              background: '#ffffff',
              border: '1px solid rgba(15,23,42,0.08)',
              borderRadius: 0,
              boxShadow: '0 20px 45px rgba(15,23,42,0.16)',
              color: '#0f172a',
              overflow: 'hidden',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 14,
              padding: '17px 18px 13px',
              borderBottom: '1px solid rgba(15,23,42,0.08)',
            }}>
              <div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '5px 8px',
                  background: 'rgba(56,189,248,0.1)',
                  color: '#0284c7',
                  fontSize: 11,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}>
                  <Monitor size={13} />
                  Mở Desktop Tracker
                </div>
                <h2 id="desktop-open-notice-title" style={{
                  margin: 0,
                  fontSize: 19,
                  lineHeight: 1.18,
                  fontWeight: 900,
                }}>
                  Cho phép trình duyệt mở app
                </h2>
                <p style={{
                  margin: '8px 0 0',
                  color: '#64748b',
                  fontSize: 13,
                  lineHeight: 1.45,
                  fontWeight: 650,
                }}>
                  WorkRank sẽ mở Desktop Tracker bằng giao thức đã cài trên máy. Bấm nút bên dưới rồi chọn mở app nếu Chrome hỏi quyền.
                </p>
              </div>
              <button
                type="button"
                data-no-track="true"
                aria-label="Đóng thông báo mở app"
                onClick={() => setDesktopOpenNoticeOpen(false)}
                style={{
                  width: 32,
                  height: 32,
                  border: '1px solid rgba(15,23,42,0.1)',
                  borderRadius: 0,
                  background: '#f8fafc',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <XCircle size={16} />
              </button>
            </div>

            <div style={{ padding: 18 }}>
              <div style={{
                border: '1px solid rgba(217,119,6,0.2)',
                background: 'rgba(217,119,6,0.08)',
                color: '#92400e',
                padding: '11px 12px',
                fontSize: 12,
                lineHeight: 1.48,
                fontWeight: 750,
                marginBottom: 12,
              }}>
                Chrome có thể hiện hộp thoại xác nhận mở app liên kết. Đây là hộp thoại bảo mật của trình duyệt nên web không thể thay giao diện trực tiếp.
              </div>
              <div style={{
                border: '1px solid rgba(22,163,74,0.18)',
                background: 'rgba(22,163,74,0.07)',
                color: '#15803d',
                padding: '11px 12px',
                fontSize: 12,
                lineHeight: 1.48,
                fontWeight: 750,
                marginBottom: 14,
              }}>
                Trên Windows/macOS, sau khi app mở lần đầu có thể cần cấp quyền Accessibility/Input Monitoring để đếm phím và click.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                <button
                  type="button"
                  data-no-track="true"
                  onClick={() => setDesktopOpenNoticeOpen(false)}
                  style={{
                    height: 40,
                    border: '1px solid rgba(15,23,42,0.1)',
                    borderRadius: 0,
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  Đã hiểu
                </button>
                <button
                  type="button"
                  data-no-track="true"
                  onClick={openDesktopTrackerFromNotice}
                  style={{
                    height: 40,
                    border: 'none',
                    borderRadius: 0,
                    background: '#38bdf8',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  Mở Desktop Tracker
                </button>
                <button
                  type="button"
                  data-no-track="true"
                  onClick={handleDesktopDownload}
                  style={{
                    gridColumn: '1 / -1',
                    height: 38,
                    border: '1px solid rgba(15,23,42,0.1)',
                    borderRadius: 0,
                    background: '#ffffff',
                    color: '#64748b',
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                  }}
                >
                  <Download size={14} />
                  Tải .exe Windows
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(420px, calc(100vw - 32px))',
              minHeight: 420,
              background: '#ffffff',
              borderRadius: 0,
              border: '1px solid rgba(15,23,42,0.08)',
              boxShadow: 'none',
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
                  borderRadius: 0,
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
                  borderRadius: 0,
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
                  border: '1px solid rgba(56,189,248,0.16)',
                  background: 'rgba(56,189,248,0.06)',
                  borderRadius: 0,
                  padding: 12,
                }}>
                  <div style={{ color: '#38bdf8', marginBottom: 8, display: 'flex' }}>
                    <KeyboardIcon />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 900 }}>Gõ phím</div>
                  <div style={{ marginTop: 4, color: '#64748b', fontSize: 12, lineHeight: 1.35, fontWeight: 600 }}>
                    Chỉ đếm số lần gõ, không đọc nội dung phím.
                  </div>
                </div>
                <div style={{
                  border: '1px solid rgba(56,189,248,0.16)',
                  background: 'rgba(56,189,248,0.06)',
                  borderRadius: 0,
                  padding: 12,
                }}>
                  <div style={{ color: '#38bdf8', marginBottom: 8, display: 'flex' }}>
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
                borderRadius: 0,
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
                borderRadius: 0,
                padding: '11px 12px',
                color: '#92400e',
                fontSize: 12,
                lineHeight: 1.45,
                fontWeight: 700,
                marginBottom: 14,
              }}>
                Nếu máy chưa cài app, hãy bấm tải file .exe trước. Nút mở app đã cài chỉ hoạt động sau khi Windows đã cài WorkRank Tracker và đăng ký giao thức workrank://.
              </div>

              {desktopConsentAccepted ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 9,
                  padding: '11px 12px',
                  borderRadius: 0,
                  border: '1px solid rgba(22,163,74,0.18)',
                  background: 'rgba(22,163,74,0.07)',
                  color: '#15803d',
                  fontSize: 12,
                  lineHeight: 1.45,
                  fontWeight: 800,
                  marginBottom: 14,
                }}>
                  <CheckCircle2 size={15} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span>Bạn đã đồng ý trước đó. Có thể xem lại hướng dẫn hoặc tải lại file .exe khi cần.</span>
                </div>
              ) : (
                <label style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '11px 12px',
                  borderRadius: 0,
                  border: '1px solid rgba(15,23,42,0.1)',
                  background: '#f8fafc',
                  cursor: 'pointer',
                  marginBottom: 14,
                }}>
                  <input
                    type="checkbox"
                    checked={desktopConsentChecked}
                    onChange={(e) => setDesktopConsentChecked(e.target.checked)}
                    style={{ marginTop: 2, width: 16, height: 16, accentColor: '#38bdf8', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 12, lineHeight: 1.45, color: '#334155', fontWeight: 700 }}>
                    Tôi đã đọc cảnh báo và đồng ý cài WorkRank Tracker với phạm vi dữ liệu ở trên.
                  </span>
                </label>
              )}

              {desktopDownloadError && (
                <div style={{
                  marginBottom: 14,
                  border: '1px solid rgba(220,38,38,0.2)',
                  background: 'rgba(254,242,242,0.85)',
                  color: '#b91c1c',
                  borderRadius: 0,
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
                    borderRadius: 0,
                    border: '1px solid rgba(15,23,42,0.1)',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  {desktopConsentAccepted ? 'Đóng' : 'Để sau'}
                </button>
                <button
                  type="button"
                  data-no-track="true"
                  disabled={!canConfirmDesktopConsent}
                  onClick={confirmConsentAndOpenInstalled}
                  style={{
                    height: 40,
                    borderRadius: 0,
                    border: '1px solid rgba(56,189,248,0.22)',
                    background: '#ffffff',
                    color: canConfirmDesktopConsent ? '#38bdf8' : '#cbd5e1',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: canConfirmDesktopConsent ? 'pointer' : 'not-allowed',
                  }}
                >
                  {desktopConsentAccepted ? 'Đã cài, mở app' : 'Đồng ý, mở app'}
                </button>
                <button
                  type="button"
                  data-no-track="true"
                  disabled={!canConfirmDesktopConsent}
                  onClick={confirmConsentAndDownload}
                  style={{
                    gridColumn: '1 / -1',
                    height: 40,
                    borderRadius: 0,
                    border: 'none',
                    background: canConfirmDesktopConsent ? '#38bdf8' : '#cbd5e1',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: canConfirmDesktopConsent ? 'pointer' : 'not-allowed',
                    boxShadow: 'none',
                  }}
                >
                  {desktopConsentAccepted ? 'Tải .exe Windows' : 'Đồng ý và tải .exe'}
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
                      borderRadius: 0,
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
