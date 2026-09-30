import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, HelpCircle, LogOut, Menu, Settings, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AVATAR_UPDATED_EVENT, getUserAvatar, initialsFromName, removeStoredAvatar } from '../utils/avatar';
import { getAppSettings, shouldStoreNotification, subscribeAppSettings } from '../utils/settings';
import { sendBrowserNotification, vibrateDevice, requestNotificationPermission } from '../utils/notifications';
import BrandMark from './BrandMark';
import FriendsDock from './FriendsDock';
import ProductTour, { PRODUCT_TOUR_EVENT } from './ProductTour';
import VerifiedBadge from './VerifiedBadge';
import Sidebar from './Sidebar';
import { PageTransition, PageTransitionSkeleton } from './ui';

const PAGE_TITLES = {
  '/dashboard': 'Bảng Điều Khiển Tổng Quan',
  '/arena': 'Đấu Trường Mùa Giải',
  '/grand': 'Giải Vô Địch Toàn Năm',
  '/leaderboard': 'Trung Tâm Bảng Xếp Hạng',
  '/rankings': 'Trung Tâm Bảng Xếp Hạng',
  '/friends': 'Bạn Bè & Đội Nhóm',
  '/youtube': 'Số Liệu YouTube & Đội Nhóm',
  '/games': 'Trò Chơi Cờ Tỷ Phú',
  '/games/capital-board': 'Trò Chơi Cờ Tỷ Phú',
  '/admin/privileges': 'Quản Lý Nhân Sự & Đặc Quyền',
  '/admin/teams-youtube': 'Quản Lý Đội Nhóm & Kênh YouTube',
  '/admin/competition/seasons': 'Quản Lý Mùa Giải Thi Đua',
  '/admin/competition/grand': 'Quản Lý Giải Vô Địch Năm',
  '/admin/operations': 'Giám Sát & Nhật Ký Kiểm Toán',
  '/settings': 'Cài Đặt Hệ Thống',
};

const WORKRANK_NOTIFICATION_EVENT = 'workrank:notification';
const NOTIFICATIONS_CLEARED_EVENT = 'workrank:notifications-cleared';

function notificationStorageKey(userId) {
  return `workrank:notifications:${userId || 'guest'}`;
}

function loadNotifications(userId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(notificationStorageKey(userId)) || '[]');
    return Array.isArray(parsed) ? parsed.filter((notification) => notification?.type !== 'contest') : [];
  } catch {
    return [];
  }
}

function persistNotifications(userId, notifications) {
  localStorage.setItem(notificationStorageKey(userId), JSON.stringify(notifications));
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
  if (type === 'warning') return { dot: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
  if (type === 'danger') return { dot: '#dc2626', bg: 'rgba(220,38,38,0.08)' };
  if (type === 'success') return { dot: '#16a34a', bg: 'rgba(22,163,74,0.1)' };
  return { dot: '#38bdf8', bg: 'rgba(56,189,248,0.08)' };
}

function isVerifiedAccount(user) {
  const value = user?.isVerified ?? user?.is_verified ?? user?.verified;
  if (value === true || value === 1 || value === '1') return true;
  return typeof value === 'string' && value.toLowerCase() === 'true';
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, logout } = useAuth();

  const [dropOpen, setDropOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
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
    const handler = (event) => {
      const detail = event.detail || {};
      const allowed = shouldStoreNotification(detail.type || 'info', appSettings);
      if (allowed) {
        addNotification(detail);
        if (document.hidden && ('Notification' in window)) {
          requestNotificationPermission().then((permission) => {
            if (permission === 'granted') {
              sendBrowserNotification(detail.title || '3winmedia', {
                body: detail.message || '',
                tag: detail.dedupeKey || `notif-${Date.now()}`,
                data: { url: detail.actionTo || '/' },
              });
            }
          });
        }
      }
    };
    window.addEventListener(WORKRANK_NOTIFICATION_EVENT, handler);
    return () => window.removeEventListener(WORKRANK_NOTIFICATION_EVENT, handler);
  }, [addNotification, appSettings]);

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

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileDrawerOpen) {
        setMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileDrawerOpen]);

  const pageTitle = PAGE_TITLES[location.pathname]
    || (location.pathname.startsWith('/users') ? 'Hồ Sơ Cá Nhân' : (location.pathname.startsWith('/games') ? 'Trò Chơi Cờ Tỷ Phú' : '3winmedia Realtime'));
  const accountInitials = initialsFromName(user?.name || user?.email || '??');
  const accountVerified = isVerifiedAccount(user);

  return (
    <div
      className="workrank-app-shell"
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        background: '#f8fafc',
        color: '#0f172a',
        fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* Desktop Fixed Sidebar */}
      <aside className="workrank-desktop-sidebar">
        <Sidebar user={user} isAdmin={isAdmin} />
      </aside>

      {/* Mobile Off-Canvas Navigation Drawer */}
      {mobileDrawerOpen && (
        <div
          className="workrank-mobile-drawer-overlay modal-backdrop-enter"
          onClick={() => setMobileDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            backdropFilter: 'blur(2px)',
            zIndex: 300,
            display: 'flex',
          }}
        >
          <aside
            className="workrank-mobile-drawer drawer-slide-enter"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 280,
              maxWidth: '85vw',
              height: '100%',
              background: '#ffffff',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              zIndex: 301,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                zIndex: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Đóng menu"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: '1px solid rgba(15,23,42,0.1)',
                  background: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                <X size={16} />
              </button>
            </div>
            <Sidebar
              user={user}
              isAdmin={isAdmin}
              onNavigate={() => setMobileDrawerOpen(false)}
              isMobile
            />
          </aside>
        </div>
      )}

      {/* Main Content & Header Column */}
      <div className="workrank-main-shell">
        <header
          className="app-header"
          style={{
            height: 56,
            flexShrink: 0,
            background: '#ffffff',
            borderBottom: '1px solid rgba(15,23,42,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          {/* Left: Mobile Menu Toggle Button + Page Title Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button
              type="button"
              className="mobile-menu-toggle"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Mở menu điều hướng"
              style={{
                width: 34,
                height: 34,
                borderRadius: 6,
                border: '1px solid rgba(15,23,42,0.1)',
                background: '#f8fafc',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#0f172a',
                flexShrink: 0,
              }}
            >
              <Menu size={18} />
            </button>

            <div className="mobile-brand-mark">
              <BrandMark size={24} showLabel={false} />
            </div>

            <div
              className="app-header-title"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.2px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {pageTitle}
            </div>
          </div>

          <div data-tour="quick-actions" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap' }}>
            <div ref={notificationRef} style={{ position: 'relative' }}>
              <button
                data-tour="notifications"
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
                  background: notifOpen ? 'rgba(56,189,248,0.08)' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: notifOpen ? '#38bdf8' : '#64748b',
                  borderRadius: 0,
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
                    borderRadius: 0,
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
                  borderRadius: 0,
                  overflow: 'hidden',
                  boxShadow: 'none',
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
                          borderRadius: 0,
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
                        Các thông báo thi đấu, kết quả mùa giải và tin nhắn sẽ xuất hiện ở đây.
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
                            background: notification.read ? '#ffffff' : 'rgba(56,189,248,0.035)',
                            cursor: notification.actionTo ? 'pointer' : 'default',
                            textAlign: 'left',
                            fontFamily: "'JetBrains Mono',monospace",
                          }}
                        >
                          <span style={{
                            width: 26,
                            height: 26,
                            borderRadius: 0,
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
                              <span style={{ display: 'block', marginTop: 6, color: '#38bdf8', fontSize: 11, fontWeight: 900 }}>
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
              data-tour="help"
              type="button"
              className="app-icon-action app-help-tour-button"
              aria-label="Xem hướng dẫn sử dụng"
              title="Xem hướng dẫn sử dụng"
              onClick={() => window.dispatchEvent(new CustomEvent(PRODUCT_TOUR_EVENT))}
              style={{
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b',
                borderRadius: 0,
              }}
            >
              <HelpCircle size={17} />
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
                background: location.pathname === '/settings' ? 'rgba(56,189,248,0.08)' : 'none',
                border: 'none',
                cursor: 'pointer',
                color: location.pathname === '/settings' ? '#38bdf8' : '#64748b',
                borderRadius: 0,
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
                  borderRadius: 0,
                  position: 'relative',
                  background: '#38bdf8',
                  border: '2px solid rgba(56,189,248,0.4)',
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
                    style={{ width: '100%', height: '100%', borderRadius: 0, objectFit: 'cover' }}
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
                  borderRadius: 0,
                  overflow: 'hidden',
                  boxShadow: 'none',
                  animation: 'slide-down 0.15s ease',
                  zIndex: 200,
                }}>
                  <button
                    type="button"
                    onClick={() => { void logout(); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", textAlign: 'left' }}
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
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <Suspense fallback={<PageTransitionSkeleton />}>
              <PageTransition key={location.pathname}>
                <Outlet />
              </PageTransition>
            </Suspense>
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
            <span>© {new Date().getFullYear()} 3winmedia. Đấu Trường Thi Đấu & Bảng Xếp Hạng.</span>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              {['Chính sách bảo mật', 'Điều khoản dịch vụ', 'Tài liệu API'].map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </footer>
        </div>

        <FriendsDock />
        <ProductTour />
      </div>
    </div>
  );
}
