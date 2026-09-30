import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { NAVIGATION_CONFIG, isRouteActive, resolveItemPath } from '../config/navigation';
import BrandMark from './BrandMark';
import VerifiedBadge from './VerifiedBadge';
import JobTitleBadge from './JobTitleBadge';
import { getUserAvatar, initialsFromName } from '../utils/avatar';

/**
 * Sidebar Component for WorkRank V3.3.
 *
 * Implements clean vertical hierarchy:
 * - Top-level groups with clear parent-child structure
 * - Collapsible accordion sections with chevron indicators
 * - Route-aware auto expansion (expanded on active child)
 * - Accessible keyboard navigation and ARIA attributes
 * - Role-based visibility (Admin vs Member)
 * - Compact user profile footer
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
      // By default open if not collapsible, or if has active child, or defaultExpanded
      initial[group.id] = !group.collapsible || group.id === 'competition' || activeGroupIds.has(group.id);
    });
    return initial;
  });

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

  const avatarUrl = user?.avatarUrl || getUserAvatar(user?.id);
  const initials = initialsFromName(user?.name || user?.email || 'U');

  return (
    <div
      className="workrank-sidebar-inner"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: '#ffffff',
        fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          height: 56,
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid rgba(15,23,42,0.08)',
          flexShrink: 0,
        }}
      >
        <BrandMark
          size={28}
          showLabel
          labelStyle={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.3px', color: '#0f172a' }}
        />
        {isAdmin && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: 4,
              background: 'rgba(56,189,248,0.12)',
              color: '#0284c7',
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
            }}
          >
            Admin
          </span>
        )}
      </div>

      {/* Navigation Groups List */}
      <nav
        data-tour="app-nav"
        aria-label="Điều hướng chính"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {NAVIGATION_CONFIG.map((group) => {
          if (group.adminOnly && !isAdmin) return null;

          const isExpanded = Boolean(expandedGroups[group.id]);
          const hasActiveChild = group.items.some((item) => {
            const path = resolveItemPath(item, user?.id);
            return isRouteActive(location.pathname, path);
          });
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
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: hasActiveChild && !isExpanded ? 'rgba(56,189,248,0.06)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: hasActiveChild ? '#0284c7' : '#64748b',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.2px',
                    textAlign: 'left',
                    transition: 'background 0.15s ease, color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!hasActiveChild || isExpanded) e.currentTarget.style.background = 'rgba(15,23,42,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = hasActiveChild && !isExpanded ? 'rgba(56,189,248,0.06)' : 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <GroupIcon size={16} strokeWidth={2.2} style={{ color: hasActiveChild ? '#38bdf8' : '#94a3b8' }} />
                    <span style={{ color: hasActiveChild ? '#0f172a' : '#475569' }}>{group.label}</span>
                    {group.badge && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: group.adminOnly ? 'rgba(239,68,68,0.1)' : 'rgba(56,189,248,0.12)',
                          color: group.adminOnly ? '#ef4444' : '#0284c7',
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
                      color: '#94a3b8',
                      transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 0.15s ease',
                    }}
                  >
                    <ChevronDown size={14} />
                  </span>
                </button>
              ) : (
                <div
                  style={{
                    padding: '4px 10px 6px',
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#94a3b8',
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

              {/* Child Items */}
              {(!group.collapsible || isExpanded) && (
                <div
                  className="workrank-nav-subitems tab-transition"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    marginTop: group.collapsible ? 2 : 0,
                    paddingLeft: group.collapsible ? 12 : 0,
                    borderLeft: group.collapsible ? '1px solid rgba(15,23,42,0.06)' : 'none',
                    marginLeft: group.collapsible ? 16 : 0,
                    minHeight: 'auto',
                  }}
                >
                  {group.items.map((item) => {
                    if (item.adminOnly && !isAdmin) return null;
                    const path = resolveItemPath(item, user?.id);
                    const isActive = isRouteActive(location.pathname, path);
                    const ItemIcon = item.icon;

                    return (
                      <NavLink
                        key={path}
                        to={path}
                        data-tour={item.tourTarget}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={handleLinkClick}
                        title={item.description || item.label}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 9,
                          padding: '7px 10px',
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? '#0284c7' : '#475569',
                          background: isActive ? 'rgba(56,189,248,0.09)' : 'transparent',
                          textDecoration: 'none',
                          lineHeight: 1.3,
                          position: 'relative',
                          transition: 'background 0.15s ease, color 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'rgba(15,23,42,0.04)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <ItemIcon
                          size={15}
                          strokeWidth={isActive ? 2.3 : 1.8}
                          style={{
                            color: isActive ? '#0284c7' : '#94a3b8',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.label}
                        </span>
                        {isActive && (
                          <span
                            style={{
                              marginLeft: 'auto',
                              width: 5,
                              height: 5,
                              borderRadius: '50%',
                              background: '#38bdf8',
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User Profile / Status Footer */}
      <div
        style={{
          padding: '12px 14px',
          borderTop: '1px solid rgba(15,23,42,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#f8fafc',
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
              borderRadius: 6,
              background: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 800,
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
                fontWeight: 700,
                color: '#0f172a',
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
                role={user?.role}
                size="xs"
              />
            </div>
          </div>
        </NavLink>
      </div>
    </div>
  );
}
