import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, HelpCircle, LogOut, Menu, Settings, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resolveCurrentTitle } from '../config/navigation';
import BrandMark from './BrandMark';
import Sidebar from './Sidebar';
import VerifiedBadge from './VerifiedBadge';
import ProductTour, { PRODUCT_TOUR_EVENT } from './ProductTour';
import FriendsDock from './FriendsDock';
import { isVerifiedAccount } from '../utils/account';
import { getStoredAvatar, removeStoredAvatar, initialsFromName } from '../utils/avatar';
import { PageTransition, PageTransitionSkeleton } from './ui';
import { sendBrowserNotification } from '../utils/notifications';

const APP_SETTINGS_STORAGE_KEY = 'workrank:app-settings:v1';
const WORKRANK_NOTIFICATION_EVENT = 'workrank:notification';
const NOTIFICATIONS_CLEARED_EVENT = 'workrank:notifications-cleared';

function userNotificationsKey(userId) {
  return `workrank:notifications:${userId || 'guest'}`;
}

function loadStoredNotifications(userId) {
  try {
    const raw = localStorage.getItem(userNotificationsKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistNotifications(userId, list) {
  try {
    localStorage.setItem(userNotificationsKey(userId), JSON.stringify(list.slice(0, 40)));
  } catch {}
}

function formatNotificationTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMinutes = Math.floor((now - date) / 60000);
  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
}

function notificationTone(type) {
  switch (type) {
    case 'battle':
    case 'challenge':
      return { bg: 'rgba(180,83,9,0.08)', dot: '#b45309' };
    case 'achievement':
    case 'level_up':
      return { bg: 'rgba(21,128,61,0.08)', dot: '#15803d' };
    case 'system':
    case 'alert':
      return { bg: 'rgba(185,28,28,0.08)', dot: '#b91c1c' };
    default:
      return { bg: 'rgba(0,0,0,0.06)', dot: '#141414' };
  }
}

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [accountAvatarUrl, setAccountAvatarUrl] = useState('');
  const [notifications, setNotifications] = useState(() => loadStoredNotifications(user?.id));

  const dropRef = useRef(null);
  const notificationRef = useRef(null);

  // Sync avatar
  useEffect(() => {
    setAccountAvatarUrl(user?.avatarUrl || getStoredAvatar(user?.id) || '');
  }, [user]);

  // Load and apply theme appearance settings
  useEffect(() => {
    let appSettings = {};
    try {
      const raw = localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
      if (raw) appSettings = JSON.parse(raw);
    } catch {}

    const root = document.documentElement;
    root.dataset.workrankDensity = appSettings.appearance?.density || 'comfortable';
    root.dataset.workrankReduceMotion = appSettings.appearance?.reduceMotion ? 'true' : 'false';
    root.dataset.workrankContrast = appSettings.appearance?.highContrast ? 'true' : 'false';
  }, []);

  const markNotificationsRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      persistNotifications(user?.id, updated);
      return updated;
    });
  }, [user?.id]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    persistNotifications(user?.id, []);
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CLEARED_EVENT));
  }, [user?.id]);

  // Listen to custom notification events
  useEffect(() => {
    const handleNotification = (e) => {
      const detail = e.detail || {};
      const newNotif = {
        id: detail.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: detail.title || 'Thông báo',
        message: detail.message || '',
        type: detail.type || 'info',
        createdAt: detail.createdAt || new Date().toISOString(),
        read: false,
        actionTo: detail.actionTo || '',
        actionLabel: detail.actionLabel || '',
      };

      setNotifications((prev) => {
        const next = [newNotif, ...prev.filter((n) => n.id !== newNotif.id)].slice(0, 40);
        persistNotifications(user?.id, next);
        return next;
      });

      if (detail.native) {
        sendBrowserNotification(detail.title || 'WorkRank', {
          body: detail.message || '',
          icon: '/3win-mark.png',
        });
      }
    };

    const handleCleared = () => {
      setNotifications([]);
    };

    window.addEventListener(WORKRANK_NOTIFICATION_EVENT, handleNotification);
    window.addEventListener(NOTIFICATIONS_CLEARED_EVENT, handleCleared);

    return () => {
      window.removeEventListener(WORKRANK_NOTIFICATION_EVENT, handleNotification);
      window.removeEventListener(NOTIFICATIONS_CLEARED_EVENT, handleCleared);
    };
  }, [user?.id]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
    setDropOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const pageTitle = resolveCurrentTitle(location.pathname)
    || (location.pathname.startsWith('/users') ? 'Hồ Sơ Cá Nhân' : (location.pathname.startsWith('/games') ? 'Trò Chơi Doanh Nghiệp' : 'WorkRank Realtime'));

  const accountInitials = initialsFromName(user?.name || user?.email || '??');
  const accountVerified = isVerifiedAccount(user);

  return (
    <div
      className="workrank-app-shell"
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        background: '#f4f3ef',
        color: '#111111',
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
            background: 'rgba(0,0,0,0.45)',
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
                  border: '1px solid rgba(0,0,0,0.1)',
                  background: '#f4f3ef',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#555555',
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
            borderBottom: '1px solid rgba(0,0,0,0.08)',
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
                border: '1px solid rgba(0,0,0,0.1)',
                background: '#f4f3ef',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#111111',
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
                fontWeight: 750,
                color: '#111111',
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
                  background: notifOpen ? 'rgba(0,0,0,0.06)' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: notifOpen ? '#111111' : '#666666',
                  borderRadius: 6,
                  transition: 'background 0.15s ease, color 0.15s ease',
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
                    borderRadius: 9999,
                    background: '#141414',
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
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 10,
                  overflow: 'hidden',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.08)',
                  animation: 'slide-down 0.15s ease',
                  zIndex: 220,
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderBottom: '1px solid rgba(0,0,0,0.08)',
                  }}>
                    <div>
                      <div style={{ color: '#111111', fontSize: 13, fontWeight: 900 }}>Thông báo</div>
                      <div style={{ color: '#777777', fontSize: 11, fontWeight: 700 }}>
                        {notifications.length ? `${notifications.length} mục gần nhất` : 'Chưa có thông báo'}
                      </div>
                    </div>
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={clearNotifications}
                        style={{
                          border: '1px solid rgba(0,0,0,0.1)',
                          background: '#f4f3ef',
                          color: '#555555',
                          borderRadius: 6,
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
                      <div style={{ padding: 18, color: '#666666', fontSize: 13, lineHeight: 1.5, fontWeight: 600 }}>
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
                            borderBottom: '1px solid rgba(0,0,0,0.06)',
                            background: notification.read ? '#ffffff' : 'rgba(0,0,0,0.02)',
                            cursor: notification.actionTo ? 'pointer' : 'default',
                            textAlign: 'left',
                            fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
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
                              <strong style={{ color: '#111111', fontSize: 12, fontWeight: 900, lineHeight: 1.25 }}>
                                {notification.title}
                              </strong>
                              <span style={{ color: '#888888', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                {formatNotificationTime(notification.createdAt)}
                              </span>
                            </span>
                            <span style={{ display: 'block', marginTop: 3, color: '#555555', fontSize: 11, fontWeight: 600, lineHeight: 1.4 }}>
                              {notification.message}
                            </span>
                            {notification.actionTo && (
                              <span style={{ display: 'block', marginTop: 6, color: '#b45309', fontSize: 11, fontWeight: 800 }}>
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
                color: '#666666',
                borderRadius: 6,
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
                background: location.pathname === '/settings' ? 'rgba(0,0,0,0.06)' : 'none',
                border: 'none',
                cursor: 'pointer',
                color: location.pathname === '/settings' ? '#111111' : '#666666',
                borderRadius: 6,
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
                  background: '#141414',
                  border: '1px solid rgba(0,0,0,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {accountAvatarUrl ? (
                  <img
                    src={accountAvatarUrl}
                    alt="Ảnh đại diện"
                    style={{ width: '100%', height: '100%', borderRadius: 5, objectFit: 'cover' }}
                    onError={() => {
                      removeStoredAvatar(user?.id);
                      setAccountAvatarUrl('');
                    }}
                  />
                ) : accountInitials}

                {accountVerified && (
                  <div style={{ position: 'absolute', bottom: -5, right: -5, background: '#ffffff', borderRadius: '50%', padding: 2, display: 'flex' }}>
                    <VerifiedBadge size={13} />
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
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 10,
                  overflow: 'hidden',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.08)',
                  animation: 'slide-down 0.15s ease',
                  zIndex: 200,
                }}>
                  <button
                    type="button"
                    onClick={() => { void logout(); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '11px 14px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#555555',
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
                      textAlign: 'left',
                      transition: 'background 0.15s ease, color 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = '#111111'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#555555'; }}
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
              padding: '28px 32px',
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
              borderTop: '1px solid rgba(0,0,0,0.08)',
              padding: '10px 32px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 11,
              color: '#777777',
              background: '#ffffff',
              flexShrink: 0,
            }}
          >
            <span>© {new Date().getFullYear()} 3WIN MEDIA Platform. Đấu Trường Thi Đấu & Bảng Xếp Hạng.</span>
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
