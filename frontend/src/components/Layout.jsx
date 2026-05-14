import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../services/api';
import { useTracking } from '../context/TrackingContext';
import { useAuth } from '../context/AuthContext';

/* ── tiny SVGs ── */
const BellIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const GearIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const PlayIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
);

const NAV_LINKS = [
  { to: '/dashboard',   label: 'Bảng Điều Khiển' },
  { to: '/leaderboard', label: 'Xếp Hạng' },
  { to: '/groups',      label: 'Nhóm' },
  { to: '/tracker',     label: 'Theo Dõi' },
  { to: '/security',    label: 'Bảo Mật', adminOnly: true },
];

export default function Layout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, isAdmin } = useAuth();
  const { tracking, seconds, formatTime, startTrack, stopTrack } = useTracking();

  const [pageVisible, setPageVisible] = useState(true);
  const [dropOpen, setDropOpen]       = useState(false);
  const dropRef = useRef(null);

  // Page transition
  useEffect(() => {
    setPageVisible(false);
    const t = setTimeout(() => setPageVisible(true), 80);
    return () => clearTimeout(t);
  }, [location.pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    try {
      await auth.logout();
    } catch (err) {
      console.warn('Logout request failed:', err);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  // Get page title for topbar subtitle
  const PAGE_TITLES = {
    '/dashboard':   'WorkRank Realtime',
    '/leaderboard': 'WorkRank Realtime',
    '/groups':      'WorkRank Realtime',
    '/tracker':     'WorkRank Realtime',
    '/security':    'Security & Anti-cheat',
  };
  const pageTitle = PAGE_TITLES[location.pathname] || 'WorkRank Realtime';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', background: '#f8fafc',
      color: '#0f172a',
      fontFamily: "'Space Grotesk', -apple-system, system-ui, sans-serif",
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes slide-down { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        .top-nav-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ─── TOP NAVBAR ─── */}
      <header style={{
        height: 52, flexShrink: 0,
        background: '#ffffff',
        borderBottom: '1px solid rgba(15,23,42,0.08)',
        display: 'flex', alignItems: 'center',
        padding: '0 24px', gap: 0,
        position: 'relative', zIndex: 100,
        overflow: 'hidden',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 24, flexShrink: 0 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 5,
            background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px', lineHeight: 1.1 }}>WorkRank</div>
          </div>
        </div>

        {/* Page name label */}
        <div style={{
          fontSize: 13, fontWeight: 700, color: '#3b82f6',
          marginRight: 24, letterSpacing: '-0.2px', flexShrink: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          maxWidth: 170,
        }}>
          {pageTitle}
        </div>

        {/* Nav Links */}
        <nav
          className="top-nav-scroll"
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
          {NAV_LINKS.filter(link => !link.adminOnly || isAdmin).map(({ to, label }) => {
            const active = location.pathname === to || location.pathname.startsWith(to + '/');
            return (
              <NavLink
                key={to}
                to={to}
                style={{
                  padding: '6px 14px',
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  color: active ? '#2563eb' : '#64748b',
                  textDecoration: 'none',
                  borderRadius: 5,
                  background: active ? 'rgba(37,99,235,0.08)' : 'transparent',
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  flex: '0 0 auto',
                  whiteSpace: 'nowrap',
                  lineHeight: 1,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#475569'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#64748b'; }}
              >
                {label}
                {/* Active underline */}
                {active && (
                  <div style={{
                    position: 'absolute', bottom: -14, left: 0, right: 0,
                    height: 2, background: '#3b82f6',
                    borderRadius: '2px 2px 0 0',
                  }} />
                )}
              </NavLink>
            );
          })}
          <NavLink
            to={`/users/${user?.id || 1}`}
            style={({ isActive }) => ({
              padding: '6px 14px',
              fontSize: 13, fontWeight: isActive ? 700 : 500,
              color: location.pathname.startsWith('/users') ? '#2563eb' : '#64748b',
              textDecoration: 'none', borderRadius: 5,
              background: location.pathname.startsWith('/users') ? 'rgba(37,99,235,0.08)' : 'transparent',
              display: 'inline-flex',
              alignItems: 'center',
              flex: '0 0 auto',
              whiteSpace: 'nowrap',
              lineHeight: 1,
              position: 'relative', transition: 'color 0.15s',
            })}
            onMouseEnter={e => { if (!location.pathname.startsWith('/users')) e.currentTarget.style.color = '#475569'; }}
            onMouseLeave={e => { if (!location.pathname.startsWith('/users')) e.currentTarget.style.color = '#64748b'; }}
          >
            Hồ Sơ Người Dùng
            {location.pathname.startsWith('/users') && (
              <div style={{ position: 'absolute', bottom: -14, left: 0, right: 0, height: 2, background: '#3b82f6', borderRadius: '2px 2px 0 0' }} />
            )}
          </NavLink>
        </nav>

        {/* Right side actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap' }}>

          {/* Tracking status pill */}
          {tracking && (
            <div
              onClick={() => navigate('/tracker')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 5,
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.3)',
                cursor: 'pointer', transition: 'background 0.15s',
                marginRight: 6,
                flexShrink: 0,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.18)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(34,197,94,0.1)'}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse-dot 1.5s infinite' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', fontFamily: "'JetBrains Mono',monospace" }}>
                {formatTime(seconds)}
              </span>
            </div>
          )}

          {/* Start Tracking btn (when not active) */}
          {!tracking && (
            <button
              onClick={() => { startTrack(); navigate('/tracker'); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 5,
                background: 'linear-gradient(135deg,#3b82f6,#2563eb)',
                border: 'none', cursor: 'pointer',
                color: '#fff', fontSize: 12, fontWeight: 700,
                boxShadow: '0 2px 10px rgba(59,130,246,0.3)',
                transition: 'all 0.2s',
                marginRight: 6,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,130,246,0.45)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 10px rgba(59,130,246,0.3)'; e.currentTarget.style.transform = 'none'; }}
            >
              <PlayIcon /> Bắt Đầu Theo Dõi
            </button>
          )}

          {/* Bell */}
          <button style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', borderRadius: 5, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#1e293b'; e.currentTarget.style.background = 'rgba(15,23,42,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'none'; }}
          ><BellIcon /></button>

          {/* Settings */}
          <button
            onClick={() => navigate('/settings')}
            style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', borderRadius: 5, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#1e293b'; e.currentTarget.style.background = 'rgba(15,23,42,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'none'; }}
          ><GearIcon /></button>

          {/* Avatar + Dropdown */}
          <div ref={dropRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setDropOpen(o => !o)}
              style={{
                width: 32, height: 32, borderRadius: 6,
                background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
                border: '2px solid rgba(59,130,246,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#fff',
                fontSize: 12, fontWeight: 800,
              }}
            >
              {(user?.name || user?.email || '??').slice(0, 2).toUpperCase()}
            </button>

            {dropOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                width: 180, background: '#ffffff',
                border: '1px solid rgba(15,23,42,0.12)',
                borderRadius: 6, overflow: 'hidden',
                boxShadow: '0 16px 40px rgba(15,23,42,0.18)',
                animation: 'slide-down 0.15s ease',
                zIndex: 200,
              }}>
                {tracking && (
                  <button
                    onClick={() => { stopTrack(); setDropOpen(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '11px 14px', background: 'none', border: 'none', borderBottom: '1px solid rgba(15,23,42,0.08)', cursor: 'pointer', color: '#ef4444', fontSize: 12, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >■ Dừng Theo Dõi</button>
                )}
                <button
                  onClick={handleLogout}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13, fontWeight: 600, fontFamily: "'Space Grotesk',sans-serif", textAlign: 'left' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'none'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── CONTENT ─── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <main style={{
          flex: 1, overflowY: 'auto',
          padding: '32px 36px',
          opacity:    pageVisible ? 1 : 0,
          transform:  pageVisible ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}>
          <Outlet />
        </main>

        {/* Footer */}
        <footer style={{
          borderTop: '1px solid rgba(15,23,42,0.06)',
          padding: '10px 36px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 11, color: '#94a3b8',
          background: '#ffffff', flexShrink: 0,
        }}>
          <span>© 2024 WorkRank Realtime. Giám Sát Hiệu Suất Cao.</span>
          <div style={{ display: 'flex', gap: 20 }}>
            {['Chính sách bảo mật', 'Điều khoản dịch vụ', 'Tài liệu API'].map(t => (
              <span key={t} style={{ cursor: 'pointer', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#475569'}
                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
              >{t}</span>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
