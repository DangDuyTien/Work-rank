import React, { useState, useEffect, useMemo } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { NAVIGATION_CONFIG, isRouteActive, resolveItemPath } from '../config/navigation';
import BrandMark from './BrandMark';
import VerifiedBadge from './VerifiedBadge';
import JobTitleBadge from './JobTitleBadge';
import { getUserAvatar, initialsFromName } from '../utils/avatar';
import { gameCatalogApi } from '../services/api';

const GAME_ROUTE_TO_KEY = {
  '/games/capital-board': 'capital_board',
  '/games/2048': 'game_2048',
  '/games/sam': 'sam',
  '/games/quiz': 'quiz',
};

/**
 * Sidebar Component for WorkRank V3.3.
 *
 * Implements clean vertical hierarchy:
 * - Top-level groups with clear parent-child structure
 * - Collapsible accordion sections with chevron indicators
 * - Route-aware auto expansion (expanded on active child)
 * - Accessible keyboard navigation and ARIA attributes
 * - Role-based visibility (Admin vs Member)
 * - Warm editorial neutral aesthetic synced with public homepage
 */
export default function Sidebar({ user, isAdmin, onNavigate, isMobile = false }) {
  const location = useLocation();

  // Compute which groups should be open by default based on active route
  const activeGroupIds = useMemo(() => {
    const ids = new Set();
    NAVIGATION_CONFIG.forEach((group) => {
      const hasActiveChild = group.items.some((item) => {
        const path = resolveItemPath(item, user?.id);
        return isRouteActive(location.pathname, path);
      });
      if (hasActiveChild || !group.collapsible) {
        ids.add(group.id);
      }
    });
    return ids;
  }, [location.pathname, user?.id]);

  // State of manually expanded/collapsed groups
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const initial = {};
    NAVIGATION_CONFIG.forEach((group) => {
      initial[group.id] = !group.collapsible || group.id === 'competition' || activeGroupIds.has(group.id);
    });
    return initial;
  });

  const [catalogMap, setCatalogMap] = useState({});

  useEffect(() => {
    let mounted = true;
    const fetchCatalog = () => {
      gameCatalogApi.getCatalog().then((res) => {
        if (!mounted) return;
        const list = res?.games || (Array.isArray(res) ? res : []);
        const map = {};
        list.forEach((g) => {
          const key = g.gameKey || g.game_key;
          if (key) {
            map[key] = g.status;
          }
        });
        setCatalogMap(map);
      }).catch(() => {});
    };

    fetchCatalog();

    const handleCatalogUpdate = () => {
      fetchCatalog();
    };

    window.addEventListener('workrank:game-catalog-updated', handleCatalogUpdate);
    return () => {
      mounted = false;
      window.removeEventListener('workrank:game-catalog-updated', handleCatalogUpdate);
    };
  }, []);

  // Auto-expand parent whenever route changes to a child within it
  useEffect(() => {
    setExpandedGroups((prev) => {
      let changed = false;
      const next = { ...prev };
      activeGroupIds.forEach((groupId) => {
        if (!next[groupId]) {
          next[groupId] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [activeGroupIds]);

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const handleLinkClick = (event) => {
    if (onNavigate) {
      onNavigate(event);
    }
  };

  const avatarUrl = getUserAvatar(user, user?.id);
  const initials = initialsFromName(user?.name || user?.email || 'U');

  return (
    <div
      className="workrank-sidebar-inner"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--surface)',
        fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* ── 1. BRAND HEADER (Editorial Warm Style) ── */}
      <div
        style={{
          height: 56,
          padding: '0 18px',
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          flexShrink: 0,
        }}
      >
        <Link
          to="/"
          onClick={handleLinkClick}
          aria-label="3WIN MEDIA — Trang chủ vinh danh"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            minWidth: 0,
            color: 'inherit',
            textDecoration: 'none',
          }}
        >
          <BrandMark
            size={28}
            showLabel
            label="3WIN MEDIA"
            labelStyle={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.2px', color: 'var(--text-primary)' }}
          />
        </Link>
        {isAdmin && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 4,
              background: 'rgba(180,83,9,0.08)',
              color: 'var(--accent)',
              border: '1px solid rgba(180,83,9,0.2)',
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
            }}
          >
            Admin
          </span>
        )}
      </div>

      {/* ── 2. NAVIGATION GROUPS LIST ── */}
      <nav
        data-tour="app-nav"
        aria-label="Điều hướng chính"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {NAVIGATION_CONFIG.map((group) => {
          if (group.adminOnly && !isAdmin) return null;
          const isExpanded = !!expandedGroups[group.id];
          const hasActiveChild = activeGroupIds.has(group.id);
          const GroupIcon = group.icon;

          return (
            <div key={group.id} className="workrank-nav-group" style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Group Header */}
              {group.collapsible ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isExpanded}
                  className="workrank-group-toggle"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '7px 9px',
                    borderRadius: 6,
                    background: hasActiveChild && !isExpanded ? 'rgba(0,0,0,0.04)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: hasActiveChild ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.2px',
                    textAlign: 'left',
                    transition: 'background var(--motion-fast) ease, color var(--motion-fast) ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!hasActiveChild || isExpanded) e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = hasActiveChild && !isExpanded ? 'rgba(0,0,0,0.04)' : 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <GroupIcon size={15} strokeWidth={2.2} style={{ color: hasActiveChild ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                    <span
                      style={{
                        minWidth: 0,
                        overflow: 'hidden',
                        color: hasActiveChild ? 'var(--text-primary)' : 'var(--text-secondary)',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {group.label}
                    </span>
                    {group.badge && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: group.adminOnly ? 'rgba(185,28,28,0.08)' : 'rgba(180,83,9,0.08)',
                          color: group.adminOnly ? 'var(--danger)' : 'var(--accent)',
                          flexShrink: 0,
                        }}
                      >
                        {group.badge}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      color: 'var(--text-muted)',
                      flexShrink: 0,
                      transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform var(--motion-normal) var(--ease-spring)',
                    }}
                  >
                    <ChevronDown size={14} />
                  </span>
                </button>
              ) : (
                <div
                  style={{
                    padding: '4px 9px 6px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>{group.label}</span>
                </div>
              )}

              {/* Child Items — AnimatedCollapse: CSS grid-template-rows trick */}
              <div
                className={`animated-collapse${isExpanded ? ' is-open' : ''}`}
                aria-hidden={!isExpanded}
                inert={!isExpanded ? '' : undefined}
              >
                <div
                  className="animated-collapse__inner workrank-nav-subitems"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    marginTop: group.collapsible ? 2 : 0,
                    paddingLeft: group.collapsible ? 10 : 0,
                    borderLeft: group.collapsible ? '1px solid rgba(0,0,0,0.06)' : 'none',
                    marginLeft: group.collapsible ? 14 : 0,
                  }}
                >
                  {group.items.map((item) => {
                    if (item.adminOnly && !isAdmin) return null;
                    const path = resolveItemPath(item, user?.id);
                    const isActive = isRouteActive(location.pathname, path);
                    const ItemIcon = item.icon;

                    const gameKey = GAME_ROUTE_TO_KEY[path];
                    const isGameComingSoon = gameKey && catalogMap[gameKey] === 'COMING_SOON';
                    const effectiveBadge = isGameComingSoon ? 'Sắp ra mắt' : item.badge;
                    const isBadgeWarning = isGameComingSoon || item.comingSoon;

                    return (
                      <NavLink
                        key={path}
                        to={path}
                        data-tour={item.tourTarget}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={handleLinkClick}
                        title={item.description || item.label}
                        tabIndex={isExpanded ? 0 : -1}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 9,
                          padding: '7px 9px',
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: isActive ? 600 : 500,
                          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                          background: isActive ? 'rgba(0,0,0,0.06)' : 'transparent',
                          textDecoration: 'none',
                          lineHeight: 1.3,
                          position: 'relative',
                          transition: 'background var(--motion-fast) ease, color var(--motion-fast) ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <ItemIcon
                          size={15}
                          strokeWidth={isActive ? 2.3 : 1.8}
                          style={{
                            color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.label}
                        </span>
                        {effectiveBadge && (
                          <span
                            style={{
                              marginLeft: 'auto',
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '1.5px 5px',
                              borderRadius: 4,
                              background: isGameComingSoon
                                ? 'rgba(217, 119, 6, 0.12)'
                                : isBadgeWarning
                                  ? 'rgba(180,83,9,0.08)'
                                  : 'rgba(0,0,0,0.06)',
                              color: isGameComingSoon ? '#d97706' : isBadgeWarning ? 'var(--accent)' : 'var(--text-primary)',
                              border: isGameComingSoon ? '1px solid rgba(217, 119, 6, 0.3)' : 'none',
                              letterSpacing: '0.2px',
                              flexShrink: 0,
                              textTransform: 'uppercase',
                            }}
                          >
                            {effectiveBadge}
                          </span>
                        )}
                        {isActive && !effectiveBadge && (
                          <span
                            style={{
                              marginLeft: 'auto',
                              width: 5,
                              height: 5,
                              borderRadius: '50%',
                              background: 'var(--accent)',
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── 3. USER PROFILE / STATUS FOOTER ── */}
      <div
        style={{
          padding: '12px 14px',
          borderTop: '1px solid rgba(0,0,0,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--surface-soft)',
          flexShrink: 0,
        }}
      >
        <NavLink
          to={`/users/${user?.id || 1}`}
          onClick={handleLinkClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flex: 1,
            minWidth: 0,
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--surface)',
              fontSize: 13,
              fontWeight: 600,
              flexShrink: 0,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              initials
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>{user?.name || user?.email || 'Thành viên'}</span>
              {user?.isVerified && <VerifiedBadge size={13} />}
            </div>
            <div
              style={{
                marginTop: 3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <JobTitleBadge
                jobTitle={user?.jobTitle}
                size="xs"
              />
            </div>
          </div>
        </NavLink>
      </div>
    </div>
  );
}
