import React, { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Bell, LogOut, Monitor, Play, Settings, Shield, Square, Trophy, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTracking } from '../context/TrackingContext';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Bảng Điều Khiển', shortLabel: 'Tổng quan', icon: Activity },
  { to: '/leaderboard', label: 'Xếp Hạng', shortLabel: 'Xếp hạng', icon: Trophy },
  { to: '/groups', label: 'Nhóm', shortLabel: 'Nhóm', icon: Users },
  { to: '/tracker', label: 'Theo Dõi', shortLabel: 'Tracker', icon: Monitor },
  { to: '/security', label: 'Bảo Mật', shortLabel: 'Bảo mật', icon: Shield, adminOnly: true },
];

const PAGE_TITLES = {
  '/dashboard': 'WorkRank Realtime',
  '/leaderboard': 'WorkRank Realtime',
  '/groups': 'WorkRank Realtime',
  '/tracker': 'WorkRank Realtime',
  '/security': 'Bảo Mật & Chống Gian Lận',
};

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, socket, logout } = useAuth();
  const { tracking, trackingPending, seconds, formatTime, startTrack, stopTrack } = useTracking();

  const [pageVisible, setPageVisible] = useState(true);
  const [dropOpen, setDropOpen] = useState(false);
  const [securityAlert, setSecurityAlert] = useState(null);
  const dropRef = useRef(null);

  useEffect(() => {
    setPageVisible(false);
    const t = window.setTimeout(() => setPageVisible(true), 80);
    return () => window.clearTimeout(t);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    let timer = null;
    const handler = (payload) => {
      setSecurityAlert(payload);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setSecurityAlert(null), 12000);
    };
    socket.on('security:device:quarantined', handler);
    return () => {
      if (timer) clearTimeout(timer);
      socket.off('security:device:quarantined', handler);
    };
  }, [socket]);

  const pageTitle = PAGE_TITLES[location.pathname] || 'WorkRank Realtime';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#0d1117',
      color: '#e6edf3',
      fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
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
          height: 56,
          flexShrink: 0,
          background: 'rgba(11,15,26,0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 28px',
          gap: 0,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 24, flexShrink: 0 }}>
          <div style={{
            width: 26,
            height: 26,
            borderRadius: 5,
            background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Activity size={13} color="#fff" strokeWidth={2.5} />
          </div>
          <div className="app-brand-label" style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.3px', lineHeight: 1.1 }}>WorkRank</div>
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
          {NAV_LINKS.filter((link) => !link.adminOnly || isAdmin).map(({ to, label }) => {
            const active = location.pathname === to || location.pathname.startsWith(`${to}/`);
            return (
              <NavLink
                key={to}
                to={to}
                style={{
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? '#fff' : '#6b7280',
                  textDecoration: 'none',
                  borderRadius: 6,
                  background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                  border: active ? '1px solid rgba(59,130,246,0.2)' : '1px solid transparent',
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  flex: '0 0 auto',
                  whiteSpace: 'nowrap',
                  lineHeight: 1,
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
              color: location.pathname.startsWith('/users') ? '#fff' : '#6b7280',
              textDecoration: 'none',
              borderRadius: 6,
              background: location.pathname.startsWith('/users') ? 'rgba(59,130,246,0.15)' : 'transparent',
              border: location.pathname.startsWith('/users') ? '1px solid rgba(59,130,246,0.2)' : '1px solid transparent',
              display: 'inline-flex',
              alignItems: 'center',
              flex: '0 0 auto',
              whiteSpace: 'nowrap',
              lineHeight: 1,
              position: 'relative',
              transition: 'all 0.15s ease',
            }}
          >
            Hồ Sơ Người Dùng
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

          <button
            type="button"
            className="app-icon-action"
            aria-label="Thông báo"
            style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', borderRadius: 5 }}
          >
            <Bell size={17} />
          </button>

          <button
            type="button"
            className="app-icon-action"
            aria-label="Cài đặt"
            onClick={() => navigate('/settings')}
            style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', borderRadius: 5 }}
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
              {(user?.name || user?.email || '??').slice(0, 2).toUpperCase()}
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
            padding: '32px 40px',
            opacity: pageVisible ? 1 : 0,
            transform: pageVisible ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
          }}
        >
          <Outlet />
        </main>

        <footer
          className="app-footer"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '10px 36px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            color: '#94a3b8',
            background: 'rgba(11,15,26,0.95)',
            flexShrink: 0,
          }}
        >
          <span>© 2024 WorkRank Realtime. Giám Sát Hiệu Suất Cao.</span>
          <div style={{ display: 'flex', gap: 20 }}>
            {['Chính sách bảo mật', 'Điều khoản dịch vụ', 'Tài liệu API'].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </footer>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Điều hướng chính trên mobile">
        {NAV_LINKS.filter((link) => !link.adminOnly || isAdmin).map(({ to, shortLabel, icon: Icon }) => {
          const active = location.pathname === to || location.pathname.startsWith(`${to}/`);
          return (
            <NavLink
              key={to}
              to={to}
              aria-label={shortLabel}
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
    </div>
  );
}
