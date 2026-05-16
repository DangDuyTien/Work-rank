import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Activity, BadgeCheck, Bell, Coffee, LogOut, Monitor, Play, Settings, Shield, Square, Trophy, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTracking } from '../context/TrackingContext';
import { AVATAR_UPDATED_EVENT, getUserAvatar, initialsFromName, removeStoredAvatar } from '../utils/avatar';
import { getAppSettings, shouldStoreNotification, subscribeAppSettings } from '../utils/settings';
import BrandMark from './BrandMark';
import FriendsDock from './FriendsDock';
import VerifiedBadge from './VerifiedBadge';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Bảng Điều Khiển', shortLabel: 'Tổng quan', icon: Activity },
  { to: '/leaderboard', label: 'Xếp Hạng', shortLabel: 'Xếp hạng', icon: Trophy },
  { to: '/groups', label: 'Nhóm', shortLabel: 'Nhóm', icon: Users },
  { to: '/tracker', label: 'Theo Dõi', shortLabel: 'Tracker', icon: Monitor },
  { to: '/security', label: 'Bảo Mật', shortLabel: 'Bảo mật', icon: Shield, adminOnly: true },
  { to: '/admin/privileges', label: 'Đặc Quyền', shortLabel: 'Đặc quyền', icon: BadgeCheck, adminOnly: true },
];

const PAGE_TITLES = {
  '/dashboard': 'WorkRank Realtime',
  '/leaderboard': 'WorkRank Realtime',
  '/groups': 'WorkRank Realtime',
  '/friends': 'Bạn Bè',
  '/tracker': 'WorkRank Realtime',
  '/security': 'Bảo Mật & Chống Gian Lận',
  '/admin/privileges': 'Quản Lý Đặc Quyền',
  '/settings': 'Cài Đặt',
};

const WORKRANK_NOTIFICATION_EVENT = 'workrank:notification';
const NOTIFICATIONS_CLEARED_EVENT = 'workrank:notifications-cleared';
const CONTEST_STORAGE_KEY = 'workrank:group-contests:v1';
const ACTION_MILESTONES = [500, 1000, 2500, 5000, 10000, 25000, 50000];

function notificationStorageKey(userId) {
  return `workrank:notifications:${userId || 'guest'}`;
}

function loadNotifications(userId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(notificationStorageKey(userId)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistNotifications(userId, notifications) {
  localStorage.setItem(notificationStorageKey(userId), JSON.stringify(notifications));
}

function localDateKey(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatNotificationTime(value) {
  const date = value ? new Date(value) : new Date();
  const now = Date.now();
  const diffMinutes = Math.max(0, Math.floor((now - date.getTime()) / 60000));
  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} giờ trước`;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function notificationTone(type) {
  if (type === 'warning' || type === 'security') return { dot: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
  if (type === 'danger') return { dot: '#dc2626', bg: 'rgba(220,38,38,0.08)' };
  if (type === 'success' || type === 'pomodoro') return { dot: '#16a34a', bg: 'rgba(22,163,74,0.1)' };
  if (type === 'contest') return { dot: '#d97706', bg: 'rgba(217,119,6,0.1)' };
  return { dot: '#2563eb', bg: 'rgba(37,99,235,0.08)' };
}

function isVerifiedAccount(user) {
  const value = user?.isVerified ?? user?.is_verified ?? user?.verified;
  if (value === true || value === 1 || value === '1') return true;
  return typeof value === 'string' && value.toLowerCase() === 'true';
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, socket, logout } = useAuth();
  const { tracking, trackingPending, seconds, formatTime, startTrack, stopTrack } = useTracking();

  const [pageVisible, setPageVisible] = useState(true);
  const [dropOpen, setDropOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [securityAlert, setSecurityAlert] = useState(null);
  const [accountAvatarUrl, setAccountAvatarUrl] = useState('');
  const [appSettings, setAppSettings] = useState(getAppSettings);
  const dropRef = useRef(null);
  const notificationRef = useRef(null);

  const addNotification = useCallback((item) => {
    if (!user?.id) return;
    if (!shouldStoreNotification(item.type || 'info', appSettings)) return;
    setNotifications((prev) => {
      if (item.dedupeKey && prev.some((notification) => notification.dedupeKey === item.dedupeKey)) return prev;
      const next = [{
        id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: item.type || 'info',
        title: item.title || 'Thông báo',
        message: item.message || '',
        actionTo: item.actionTo || '',
        actionLabel: item.actionLabel || 'Mở',
        dedupeKey: item.dedupeKey || '',
        createdAt: item.createdAt || new Date().toISOString(),
        read: false,
      }, ...prev].slice(0, 40);
      persistNotifications(user.id, next);
      return next;
    });
  }, [appSettings, user?.id]);

  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.read).length, [notifications]);

  useEffect(() => subscribeAppSettings(setAppSettings), []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.workrankDensity = appSettings.appearance?.density || 'comfortable';
    root.dataset.workrankReduceMotion = appSettings.appearance?.reduceMotion ? 'true' : 'false';
    root.dataset.workrankContrast = appSettings.appearance?.highContrast ? 'true' : 'false';
  }, [appSettings]);

  const markNotificationsRead = useCallback(() => {
    if (!user?.id) return;
    setNotifications((prev) => {
      if (!prev.some((notification) => !notification.read)) return prev;
      const next = prev.map((notification) => ({ ...notification, read: true }));
      persistNotifications(user.id, next);
      return next;
    });
  }, [user?.id]);

  const clearNotifications = useCallback(() => {
    if (!user?.id) return;
    setNotifications([]);
    persistNotifications(user.id, []);
  }, [user?.id]);

  useEffect(() => {
    setPageVisible(false);
    const t = window.setTimeout(() => setPageVisible(true), 80);
    return () => window.clearTimeout(t);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
      if (notificationRef.current && !notificationRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setNotifications(loadNotifications(user?.id));
  }, [user?.id]);

  useEffect(() => {
    const handler = (event) => {
      const targetUserId = String(event.detail?.userId || '');
      if (!targetUserId || targetUserId === String(user?.id || '')) {
        setNotifications([]);
      }
    };
    window.addEventListener(NOTIFICATIONS_CLEARED_EVENT, handler);
    return () => window.removeEventListener(NOTIFICATIONS_CLEARED_EVENT, handler);
  }, [user?.id]);

  useEffect(() => {
    if (!socket) return undefined;
    let timer = null;
    const handler = (payload) => {
      const isOwnAlert = String(payload?.userId || payload?.user_id || '') === String(user?.id || '')
        || (payload?.email && String(payload.email).toLowerCase() === String(user?.email || '').toLowerCase());
      if (!isAdmin && !isOwnAlert) return;
      if (!appSettings.notifications?.security) return;

      setSecurityAlert(payload);
      addNotification({
        type: isAdmin ? 'security' : 'danger',
        title: isAdmin ? 'Thiết bị bị khóa' : 'Tracker của bạn bị khóa',
        message: `${payload.deviceName || payload.deviceUuid || 'Thiết bị'} có ${payload.flaggedEventsInWindow || 0} event nghi vấn cao trong ${payload.windowMinutes || 0} phút.`,
        actionTo: isAdmin ? '/security' : '/tracker',
        actionLabel: isAdmin ? 'Xem bảo mật' : 'Xem tracker',
        dedupeKey: `security:${payload.deviceId || payload.deviceUuid || payload.email || Date.now()}:${payload.createdAt || payload.windowStartedAt || localDateKey()}`,
      });
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setSecurityAlert(null), 12000);
    };
    socket.on('security:device:quarantined', handler);
    return () => {
      if (timer) clearTimeout(timer);
      socket.off('security:device:quarantined', handler);
    };
  }, [addNotification, appSettings.notifications?.security, isAdmin, socket, user?.email, user?.id]);

  useEffect(() => {
    if (!socket || !user?.id) return undefined;
    const handleActivity = (data = {}) => {
      const userId = String(data.userId || data.user_id || '');
      if (userId !== String(user.id)) return;
      const totals = data.totals || data;
      const actions = Number(totals.keystrokeCount || totals.keystrokes || 0)
        + Number(totals.mouseClickCount || totals.clicks || 0);
      const milestone = [...ACTION_MILESTONES].reverse().find((value) => actions >= value);
      if (!milestone) return;
      addNotification({
        type: 'success',
        title: `Đạt ${milestone.toLocaleString()} thao tác`,
        message: `Bạn đã đạt mốc ${milestone.toLocaleString()} thao tác hôm nay. Tiếp tục giữ nhịp để tăng hạng.`,
        actionTo: `/users/${user.id}`,
        actionLabel: 'Xem hồ sơ',
        dedupeKey: `activity:${user.id}:${localDateKey()}:${milestone}`,
      });
    };
    socket.on('activity:user:update', handleActivity);
    return () => socket.off('activity:user:update', handleActivity);
  }, [addNotification, socket, user?.id]);

  useEffect(() => {
    const handler = (event) => {
      addNotification(event.detail || {});
    };
    window.addEventListener(WORKRANK_NOTIFICATION_EVENT, handler);
    return () => window.removeEventListener(WORKRANK_NOTIFICATION_EVENT, handler);
  }, [addNotification]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const checkContests = () => {
      try {
        const contests = JSON.parse(localStorage.getItem(CONTEST_STORAGE_KEY) || '[]');
        if (!Array.isArray(contests)) return;
        contests.forEach((contest) => {
          const inContest = [...(contest.teamA || []), ...(contest.teamB || [])]
            .some((member) => String(member.id) === String(user.id));
          if (!inContest || new Date(contest.endAt).getTime() > Date.now()) return;
          addNotification({
            type: 'contest',
            title: 'Cuộc thi đã kết thúc',
            message: `${contest.name || 'Cuộc thi nhóm'} đã đến giờ chốt điểm. Vào trang Nhóm để cập nhật kết quả.`,
            actionTo: '/groups',
            actionLabel: 'Xem cuộc thi',
            dedupeKey: `contest-ended:${contest.id}:${user.id}`,
          });
        });
      } catch {
        // Ignore malformed local contest cache.
      }
    };
    checkContests();
    const timer = window.setInterval(checkContests, 30000);
    window.addEventListener('storage', checkContests);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', checkContests);
    };
  }, [addNotification, user?.id]);

  useEffect(() => {
    if (!user?.id || tracking || trackingPending || location.pathname === '/tracker' || !appSettings.notifications?.trackerIdle) return undefined;
    const timer = window.setTimeout(() => {
      addNotification({
        type: 'warning',
        title: 'Tracker chưa chạy',
        message: 'Bạn đang mở WorkRank nhưng Desktop Tracker chưa ghi nhận phiên làm việc.',
        actionTo: '/tracker',
        actionLabel: 'Mở tracker',
        dedupeKey: `tracker-idle:${user.id}:${localDateKey()}`,
      });
    }, 90000);
    return () => window.clearTimeout(timer);
  }, [addNotification, appSettings.notifications?.trackerIdle, location.pathname, tracking, trackingPending, user?.id]);

  useEffect(() => {
    const userId = user?.id;
    setAccountAvatarUrl(getUserAvatar(user));
    const handler = (event) => {
      if (String(event.detail?.userId || '') === String(userId || '')) {
        setAccountAvatarUrl(event.detail?.avatarUrl || '');
      }
    };
    window.addEventListener(AVATAR_UPDATED_EVENT, handler);
    return () => window.removeEventListener(AVATAR_UPDATED_EVENT, handler);
  }, [user]);

  const pageTitle = PAGE_TITLES[location.pathname] || 'WorkRank Realtime';
  const accountInitials = initialsFromName(user?.name || user?.email || '??');
  const accountVerified = isVerifiedAccount(user);
  const visibleNavLinks = NAV_LINKS.filter((link) => !link.adminOnly || isAdmin);

  const goToNav = useCallback((event, to) => {
    event.preventDefault();
    event.stopPropagation();
    navigate(to);
  }, [navigate]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#f8fafc',
      color: '#0f172a',
      fontFamily: "'Space Grotesk', -apple-system, system-ui, sans-serif",
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes slide-down { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        .top-nav-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {securityAlert && (
        <div style={{
          position: 'fixed',
          top: 64,
          right: 24,
          width: 360,
          maxWidth: 'calc(100vw - 48px)',
          zIndex: 500,
          background: '#ffffff',
          border: '1px solid rgba(220,38,38,0.28)',
          borderLeft: '4px solid #dc2626',
          borderRadius: 8,
          boxShadow: '0 18px 42px rgba(15,23,42,0.18)',
          padding: '14px 16px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#991b1b', marginBottom: 4 }}>
            {isAdmin ? 'Đã tự khóa thiết bị nghi vấn' : 'Desktop Tracker bị khóa'}
          </div>
          <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.45 }}>
            {securityAlert.deviceName || securityAlert.deviceUuid || 'Thiết bị'} của {securityAlert.email || securityAlert.name || 'người dùng'} có {securityAlert.flaggedEventsInWindow} event nghi vấn cao trong {securityAlert.windowMinutes} phút.
          </div>
          <button
            type="button"
            onClick={() => navigate(isAdmin ? '/security' : '/tracker')}
            style={{
              marginTop: 10,
              border: '1px solid rgba(220,38,38,0.22)',
              background: 'rgba(220,38,38,0.06)',
              color: '#b91c1c',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {isAdmin ? 'Xem Bảo Mật' : 'Xem Tracker'}
          </button>
        </div>
      )}

      <header
        className="app-header"
        style={{
          height: 52,
          flexShrink: 0,
          background: '#ffffff',
          borderBottom: '1px solid rgba(15,23,42,0.08)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: 0,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginRight: 24, flexShrink: 0 }}>
          <BrandMark
            size={28}
            showLabel
            labelStyle={{ fontSize: 14, fontWeight: 900, letterSpacing: '-0.3px' }}
          />
        </div>

        <div
          className="app-header-title"
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#3b82f6',
            marginRight: 24,
            letterSpacing: '-0.2px',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 170,
          }}
        >
          {pageTitle}
        </div>

        <nav
          className="top-nav-scroll app-desktop-nav"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flex: 1,
            minWidth: 0,
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {visibleNavLinks.map(({ to, label }) => {
            const active = location.pathname === to || location.pathname.startsWith(`${to}/`);
            return (
              <NavLink
                key={to}
                to={to}
                title={label}
                aria-label={label}
                onClick={(event) => goToNav(event, to)}
                style={{
                  padding: '6px 14px',
                  minWidth: to === '/friends' ? 74 : 'auto',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? '#2563eb' : '#64748b',
                  textDecoration: 'none',
                  borderRadius: 5,
                  background: active ? 'rgba(37,99,235,0.08)' : 'transparent',
                  border: '1px solid transparent',
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: '0 0 auto',
                  whiteSpace: 'nowrap',
                  lineHeight: 1,
                  zIndex: active ? 2 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                {label}
              </NavLink>
            );
          })}
          <NavLink
            to={`/users/${user?.id || 1}`}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: location.pathname.startsWith('/users') ? 700 : 500,
              color: location.pathname.startsWith('/users') ? '#2563eb' : '#64748b',
              textDecoration: 'none',
              borderRadius: 5,
              background: location.pathname.startsWith('/users') ? 'rgba(37,99,235,0.08)' : 'transparent',
              border: '1px solid transparent',
              display: 'inline-flex',
              alignItems: 'center',
              flex: '0 0 auto',
              whiteSpace: 'nowrap',
              lineHeight: 1,
              position: 'relative',
              transition: 'all 0.15s ease',
            }}
          >
            Hồ Sơ Cá Nhân
          </NavLink>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {tracking && (
            <button
              type="button"
              className="app-tracking-timer"
              onClick={() => navigate('/tracker')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                borderRadius: 5,
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.3)',
                cursor: 'pointer',
                marginRight: 6,
                flexShrink: 0,
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse-dot 1.5s infinite' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', fontFamily: "'JetBrains Mono',monospace" }}>
                {formatTime(seconds)}
              </span>
            </button>
          )}

          {!tracking && (
            <button
              type="button"
              className="app-start-tracking-button"
              disabled={trackingPending}
              onClick={() => { void startTrack(); navigate('/tracker'); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 5,
                background: 'linear-gradient(135deg,#3b82f6,#2563eb)',
                border: 'none',
                cursor: trackingPending ? 'wait' : 'pointer',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                boxShadow: '0 2px 10px rgba(59,130,246,0.3)',
                marginRight: 6,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                opacity: trackingPending ? 0.72 : 1,
              }}
            >
              <Play size={11} fill="currentColor" strokeWidth={0} />
              <span>{trackingPending ? 'Đang Kết Nối' : 'Bắt Đầu Theo Dõi'}</span>
            </button>
          )}

          <div ref={notificationRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="app-icon-action"
              aria-label="Thông báo"
              onClick={() => {
                const nextOpen = !notifOpen;
                setNotifOpen(nextOpen);
                if (nextOpen) markNotificationsRead();
              }}
              style={{
                position: 'relative',
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: notifOpen ? 'rgba(37,99,235,0.08)' : 'none',
                border: 'none',
                cursor: 'pointer',
                color: notifOpen ? '#2563eb' : '#64748b',
                borderRadius: 5,
              }}
            >
              <Bell size={17} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  minWidth: 15,
                  height: 15,
                  padding: '0 4px',
                  borderRadius: 999,
                  background: '#ef4444',
                  color: '#ffffff',
                  border: '2px solid #ffffff',
                  fontSize: 9,
                  fontWeight: 900,
                  lineHeight: '11px',
                  textAlign: 'center',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: -42,
                width: 340,
                maxWidth: 'calc(100vw - 24px)',
                background: '#ffffff',
                border: '1px solid rgba(15,23,42,0.12)',
                borderRadius: 8,
                overflow: 'hidden',
                boxShadow: '0 18px 48px rgba(15,23,42,0.18)',
                animation: 'slide-down 0.15s ease',
                zIndex: 220,
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderBottom: '1px solid rgba(15,23,42,0.08)',
                }}>
                  <div>
                    <div style={{ color: '#0f172a', fontSize: 13, fontWeight: 900 }}>Thông báo</div>
                    <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700 }}>
                      {notifications.length ? `${notifications.length} mục gần nhất` : 'Chưa có thông báo'}
                    </div>
                  </div>
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={clearNotifications}
                      style={{
                        border: '1px solid rgba(15,23,42,0.1)',
                        background: '#f8fafc',
                        color: '#64748b',
                        borderRadius: 5,
                        padding: '5px 8px',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      Xóa hết
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: 18, color: '#64748b', fontSize: 13, lineHeight: 1.5, fontWeight: 600 }}>
                      Các thông báo cá nhân như Pomodoro, mốc thao tác, cuộc thi nhóm và trạng thái tracker sẽ xuất hiện ở đây.
                    </div>
                  ) : notifications.map((notification) => {
                    const tone = notificationTone(notification.type);
                    return (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => {
                          if (notification.actionTo) navigate(notification.actionTo);
                          setNotifOpen(false);
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          padding: '12px 14px',
                          border: 'none',
                          borderBottom: '1px solid rgba(15,23,42,0.06)',
                          background: notification.read ? '#ffffff' : 'rgba(37,99,235,0.035)',
                          cursor: notification.actionTo ? 'pointer' : 'default',
                          textAlign: 'left',
                          fontFamily: "'Space Grotesk',sans-serif",
                        }}
                      >
                        <span style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          background: tone.bg,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: 1,
                        }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: tone.dot }} />
                        </span>
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                            <strong style={{ color: '#0f172a', fontSize: 12, fontWeight: 900, lineHeight: 1.25 }}>
                              {notification.title}
                            </strong>
                            <span style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {formatNotificationTime(notification.createdAt)}
                            </span>
                          </span>
                          <span style={{ display: 'block', marginTop: 3, color: '#64748b', fontSize: 11, fontWeight: 600, lineHeight: 1.4 }}>
                            {notification.message}
                          </span>
                          {notification.actionTo && (
                            <span style={{ display: 'block', marginTop: 6, color: '#2563eb', fontSize: 11, fontWeight: 900 }}>
                              {notification.actionLabel || 'Mở'}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="app-icon-action"
            aria-label="Mời Cà Phê"
            onClick={() => setDonateOpen(true)}
            style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', borderRadius: 5, transition: 'transform 0.15s ease' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            title="Ủng hộ Dev 1 ly cà phê"
          >
            <Coffee size={17} />
          </button>

          <button
            type="button"
            className="app-icon-action"
            aria-label="Cài đặt"
            onClick={() => navigate('/settings')}
            style={{
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: location.pathname === '/settings' ? 'rgba(37,99,235,0.08)' : 'none',
              border: 'none',
              cursor: 'pointer',
              color: location.pathname === '/settings' ? '#2563eb' : '#64748b',
              borderRadius: 5,
            }}
          >
            <Settings size={17} />
          </button>

          <div ref={dropRef} style={{ position: 'relative' }}>
            <button
              type="button"
              aria-label="Mở menu tài khoản"
              onClick={() => setDropOpen((open) => !open)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                position: 'relative',
                background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
                border: '2px solid rgba(59,130,246,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#fff',
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {accountAvatarUrl ? (
                <img
                  src={accountAvatarUrl}
                  alt="Ảnh đại diện"
                  style={{ width: '100%', height: '100%', borderRadius: 4, objectFit: 'cover' }}
                  onError={() => {
                    removeStoredAvatar(user?.id);
                    setAccountAvatarUrl('');
                  }}
                />
              ) : accountInitials}

              {accountVerified && (
                <div style={{ position: 'absolute', bottom: -6, right: -6, background: '#ffffff', borderRadius: '50%', padding: 2, display: 'flex' }}>
                  <VerifiedBadge size={14} />
                </div>
              )}
            </button>

            {dropOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: 180,
                background: '#ffffff',
                border: '1px solid rgba(15,23,42,0.12)',
                borderRadius: 6,
                overflow: 'hidden',
                boxShadow: '0 16px 40px rgba(15,23,42,0.18)',
                animation: 'slide-down 0.15s ease',
                zIndex: 200,
              }}>
                {tracking && (
                  <button
                    type="button"
                    onClick={() => { void stopTrack(); setDropOpen(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '11px 14px', background: 'none', border: 'none', borderBottom: '1px solid rgba(15,23,42,0.08)', cursor: 'pointer', color: '#ef4444', fontSize: 12, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", textAlign: 'left' }}
                  >
                    <Square size={10} fill="currentColor" strokeWidth={0} />
                    Dừng Theo Dõi
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { void logout(); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13, fontWeight: 600, fontFamily: "'Space Grotesk',sans-serif", textAlign: 'left' }}
                >
                  <LogOut size={14} />
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <main
          className="app-main"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '32px 36px',
            opacity: pageVisible ? 1 : 0,
            transform: pageVisible ? 'translateY(0)' : 'translateY(6px)',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
          }}
        >
          <Outlet />
        </main>

        <footer
          className="app-footer"
          style={{
            borderTop: '1px solid rgba(15,23,42,0.06)',
            padding: '10px 36px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            color: '#94a3b8',
            background: '#ffffff',
            flexShrink: 0,
          }}
        >
          <span>© 2024 WorkRank Realtime. Giám Sát Hiệu Suất Cao.</span>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <a href="https://www.facebook.com/ddyn.fz/" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#3b82f6', textDecoration: 'none', fontWeight: 800 }}>
              <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Liên hệ Developer
            </a>
            {['Chính sách bảo mật', 'Điều khoản dịch vụ', 'Tài liệu API'].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </footer>
      </div>

      <FriendsDock />

      <nav className="mobile-bottom-nav" aria-label="Điều hướng chính trên mobile">
        {visibleNavLinks.map(({ to, shortLabel, icon: Icon }) => {
          const active = location.pathname === to || location.pathname.startsWith(`${to}/`);
          return (
            <NavLink
              key={to}
              to={to}
              aria-label={shortLabel}
              title={shortLabel}
              onClick={(event) => goToNav(event, to)}
              className="mobile-bottom-link"
              style={{
                color: active ? '#2563eb' : '#64748b',
                background: active ? 'rgba(37,99,235,0.08)' : 'transparent',
              }}
            >
              <Icon size={18} strokeWidth={2.2} />
              <span>{shortLabel}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Donate Modal */}
      {donateOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }} onClick={() => setDonateOpen(false)}>
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            width: 400,
            maxWidth: '100%',
            overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(15,23,42,0.2)',
            animation: 'slide-down 0.2s ease',
            fontFamily: "'Space Grotesk', sans-serif",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px 24px 16px', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Coffee size={28} />
              </div>
              <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 900, color: '#0f172a' }}>Mời Dev ly cà phê nhé!</h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>
                WorkRank được duy trì hoàn toàn miễn phí. Bất kỳ khoản donate nào của bạn đều giúp server sống khỏe hơn.
              </p>
            </div>
            
            <div style={{ padding: '0 24px 24px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)', borderRadius: 12, padding: 16, textAlign: 'center', marginBottom: 20 }}>
                <div style={{ color: '#0f172a', fontWeight: 800, marginBottom: 8 }}>Quét mã Momo / VNPay</div>
                <div style={{ width: 140, height: 140, background: '#e2e8f0', margin: '0 auto', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>
                  [Hình QR Code]
                </div>
              </div>
              
              <div style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(99,102,241,0.1))', padding: 16, borderRadius: 12, border: '1px solid rgba(59,130,246,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <VerifiedBadge size={18} />
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>Đặc quyền Supporter</span>
                </div>
                <div style={{ color: '#475569', fontSize: 12, lineHeight: 1.5, fontWeight: 600 }}>
                  Sau khi ủng hộ, tên của bạn sẽ có <strong>Tích Xanh</strong> giống hệt Twitter trên Leaderboard và Profile để mọi người cùng chiêm ngưỡng!
                </div>
              </div>

              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <a 
                  href="https://www.facebook.com/ddyn.fz/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '10px 20px', borderRadius: 999,
                    background: '#1877F2', color: '#fff', 
                    fontSize: 14, fontWeight: 800, textDecoration: 'none',
                    boxShadow: '0 4px 12px rgba(24,119,242,0.3)',
                    transition: 'transform 0.2s'
                  }}
                  onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Inbox Developer
                </a>
              </div>
            </div>

            <div style={{ display: 'flex', borderTop: '1px solid rgba(15,23,42,0.06)' }}>
              <button
                type="button"
                onClick={() => setDonateOpen(false)}
                style={{ flex: 1, padding: '16px', background: 'none', border: 'none', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
              >
                Để sau nhé
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
