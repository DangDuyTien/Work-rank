import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { leaderboard as leaderboardApi, groups as groupsApi, users as usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AVATAR_UPDATED_EVENT, getUserAvatar, initialsFromName } from '../utils/avatar';
import { calculateRankScore } from '../utils/scoring';
import { ArrowRight, BadgeCheck, ChevronLeft, ChevronRight, Code, Crown, Flame, Globe2, Medal, Search, ShieldCheck, Sparkles, Trophy, UserCheck, Users } from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';

const RANGES = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'week',  label: 'Tuần này' },
  { key: 'month', label: 'Tháng này' },
  { key: 'year',  label: 'Năm nay' },
];

function fmtNum(n) {
  n = Number(n) || 0;
  if (n >= 1000000000) return (n/1000000000).toFixed(1).replace(/\.0$/,'')+'B';
  if (n >= 1000000) return (n/1000000).toFixed(1).replace(/\.0$/,'')+'M';
  if (n >= 1000) return (n/1000).toFixed(1).replace(/\.0$/,'')+'k';
  return n.toLocaleString();
}
function fmtScore(n) {
  return fmtNum(n);
}

function rankerLevel(user = {}) {
  const level = Number(user.level ?? user.userLevel ?? user.user_level ?? 0);
  return Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
}

function levelBandTheme(level) {
  const band = Math.min(20, Math.floor(Math.max(0, Number(level || 0)) / 10));
  const hue = 205 + band * 2;
  const bgLightness = Math.max(24, 96 - band * 3.4);
  const borderLightness = Math.max(28, 84 - band * 2.6);
  const textLightness = band >= 12 ? 98 : Math.max(23, 36 - band * 0.6);
  return {
    color: `hsl(${hue} 74% ${textLightness}%)`,
    bg: `hsl(${hue} 78% ${bgLightness}%)`,
    border: `hsl(${hue} 66% ${borderLightness}%)`,
  };
}

function LevelText({ user, compact = false }) {
  const level = rankerLevel(user);
  const theme = levelBandTheme(level);
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: compact ? 16 : 18,
      padding: compact ? '0 5px' : '1px 6px',
      border: `1px solid ${theme.border}`,
      background: theme.bg,
      flexShrink: 0,
      color: theme.color,
      fontSize: compact ? 9 : 11,
      fontWeight: 900,
      fontFamily: "'JetBrains Mono',monospace",
      whiteSpace: 'nowrap',
    }}>
      (Level {level})
    </span>
  );
}

const AVATAR_GRADS = [
  '#f59e0b',
  '#64748b',
  '#b45309',
  '#38bdf8',
  '#22c55e',
  '#a78bfa',
];

const BADGE_STYLES = {
  dev: { bg: 'rgba(236,254,255,0.96)', border: 'rgba(34,211,238,0.62)', color: '#075985', icon: Code },
  partner: { bg: 'rgba(236,253,245,0.98)', border: 'rgba(20,184,166,0.5)', color: '#047857', icon: ShieldCheck },
  champion: { bg: 'rgba(245,158,11,0.13)', border: 'rgba(245,158,11,0.3)', color: '#b45309', icon: Crown },
  weekly: { bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.26)', color: '#38bdf8', icon: Medal },
  monthly: { bg: 'rgba(124,58,237,0.12)', border: 'rgba(124,58,237,0.28)', color: '#7c3aed', icon: Sparkles },
  top: { bg: 'rgba(14,165,233,0.11)', border: 'rgba(14,165,233,0.24)', color: '#0284c7', icon: ShieldCheck },
  streak: { bg: 'rgba(234,88,12,0.12)', border: 'rgba(234,88,12,0.26)', color: '#ea580c', icon: Flame },
  volume: { bg: 'rgba(22,163,74,0.12)', border: 'rgba(22,163,74,0.24)', color: '#16a34a', icon: BadgeCheck },
};

function VerifiedMark({ size = 15 }) {
  return <VerifiedBadge size={size} />;
}

function Avatar({ user, userId, name, size = 36, idx = 0, refreshKey = 0 }) {
  const avatarUrl = getUserAvatar(user || { id: userId }, userId);
  return (
    <div data-avatar-refresh={refreshKey} style={{ position: 'relative', width:size, height:size, flexShrink:0 }}>
      <div style={{
        width:size,height:size,borderRadius:0,flexShrink:0,
        background:AVATAR_GRADS[idx%AVATAR_GRADS.length],
        display:'flex',alignItems:'center',justifyContent:'center',
        fontSize:size*.34,fontWeight:900,color:'#fff',letterSpacing:0,overflow:'hidden',
      }}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={`Ảnh đại diện ${name || `User #${userId}`}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : initialsFromName(name || `User #${userId}`)}
      </div>
    </div>
  );
}

function userActions(user = {}) {
  if (!user) return 0;
  return Number(user.keystrokeCount || user.keystrokes || 0) + Number(user.mouseClickCount || user.mouse_clicks || 0);
}

function toVerifiedBool(value) {
  if (value === true || value === 1 || value === '1') return true;
  if (typeof value === 'string' && value.toLowerCase() === 'true') return true;
  return false;
}

function isVerifiedRanker(user) {
  if (!user) return false;
  return toVerifiedBool(user.verified ?? user.isVerified ?? user.is_verified);
}

function isDevRanker(user) {
  if (!user) return false;
  const id = Number(user.id || user.user_id || user.userId);
  const email = String(user.email || '').trim().toLowerCase();
  const name = String(user.name || '').trim().toLowerCase();
  return email === 'tien@gmail.com' || id === 8 || name === 'dang duy tien';
}

function hasFeaturedBadge(user = {}, label) {
  if (!user) return false;
  const badges = Array.isArray(user.featuredBadges)
    ? user.featuredBadges
    : Array.isArray(user.featured_badges)
      ? user.featured_badges
      : [];
  return badges.some((badge) => String(badge || '').trim() === label);
}

function isPartnerRanker(user = {}) {
  if (!user) return false;
  return hasFeaturedBadge(user, 'Đối tác WorkRank');
}

function devRankerStyle(user, variant = 'row') {
  if (!user) return {};
  const isDev = isDevRanker(user);
  const isPartner = isPartnerRanker(user);
  if (!isDev && !isPartner) return {};
  if (isPartner && !isDev) {
    if (variant === 'table') {
      return {
        background: 'rgba(236,253,245,0.98)',
        backgroundSize: '220% 100%',
        boxShadow: 'none',
        animation: 'leaderboard-dev-frame-flow 7s ease-in-out infinite',
      };
    }
    if (variant === 'podium') {
      return {
        padding: '10px 8px 0',
        borderRadius: 0,
        border: '1px solid rgba(20,184,166,0.46)',
        background: 'rgba(236,253,245,0.9)',
        backgroundSize: '160% 160%, 220% 100%',
        boxShadow: 'none',
        animation: 'leaderboard-dev-frame-flow 7s ease-in-out infinite',
      };
    }
    return {
      background: 'rgba(236,253,245,0.96)',
      backgroundSize: '220% 100%',
      border: '1px solid rgba(20,184,166,0.42)',
      boxShadow: 'none',
      animation: 'leaderboard-dev-frame-flow 7s ease-in-out infinite',
    };
  }
  if (variant === 'table') {
    return {
      background: 'rgba(236,254,255,0.98)',
      backgroundSize: '220% 100%',
      boxShadow: 'none',
      animation: 'leaderboard-dev-frame-flow 7s ease-in-out infinite',
    };
  }
  if (variant === 'podium') {
    return {
      padding: '10px 8px 0',
      borderRadius: 0,
      border: '1px solid rgba(34,211,238,0.58)',
      background: 'rgba(236,254,255,0.88)',
      backgroundSize: '160% 160%, 220% 100%',
      boxShadow: 'none',
      animation: 'leaderboard-dev-frame-flow 7s ease-in-out infinite',
    };
  }
  return {
    background: 'rgba(236,254,255,0.94)',
    backgroundSize: '220% 100%',
    border: '1px solid rgba(34,211,238,0.52)',
    boxShadow: 'none',
    animation: 'leaderboard-dev-frame-flow 7s ease-in-out infinite',
  };
}

function rankBadges(user, rank, range) {
  if (!user) return [];
  const actions = userActions(user);
  const badges = [];
  if (isDevRanker(user)) badges.push({ key: 'dev', label: 'Dev', style: 'dev' });
  if (isPartnerRanker(user)) badges.push({ key: 'partner', label: 'Đối tác', style: 'partner' });
  if (rank === 1) {
    if (range === 'week') badges.push({ key: 'weekly', label: 'Nhất tuần', style: 'weekly' });
    else if (range === 'month') badges.push({ key: 'monthly', label: 'Nhất tháng', style: 'monthly' });
    else badges.push({ key: 'champion', label: 'Top 1 ngày', style: 'champion' });
  } else if (rank <= 3) {
    badges.push({ key: 'top3', label: `Top ${rank}`, style: 'top' });
  } else if (rank <= 10) {
    badges.push({ key: 'top10', label: 'Top 10', style: 'top' });
  }
  if (actions >= 10000) badges.push({ key: '10k', label: '10K thao tác', style: 'volume' });
  else if (actions >= 5000) badges.push({ key: '5k', label: '5K thao tác', style: 'volume' });
  if (Number(user.focusScore || 0) >= 90) badges.push({ key: 'focus', label: 'Tập trung', style: 'streak' });
  return badges.slice(0, (isDevRanker(user) || isPartnerRanker(user)) ? 4 : 3);
}

function RankBadge({ badge, compact = false }) {
  const style = BADGE_STYLES[badge.style] || BADGE_STYLES.top;
  const Icon = style.icon;
  return (
    <span
      title={badge.label}
      className={badge.style === 'dev' || badge.style === 'partner' ? 'leaderboard-dev-badge' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 3 : 4,
        maxWidth: '100%',
        padding: compact ? '3px 6px' : '4px 8px',
        borderRadius: 0,
        border: `1px solid ${style.border}`,
        background: style.bg,
        color: style.color,
        fontSize: compact ? 9 : 10,
        fontWeight: 900,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        ...(badge.style === 'dev' || badge.style === 'partner' ? { backgroundSize: '220% 100%', animation: 'leaderboard-dev-badge-flow 5.4s ease-in-out infinite' } : {}),
      }}
    >
      <Icon size={compact ? 10 : 11} strokeWidth={2.6} />
      {badge.label}
    </span>
  );
}

const PAGE_SIZE = 10;

function localDateKey(value = new Date()) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { socket, isAdmin, user } = useAuth();
  const searchParams = new URLSearchParams(location.search);
  const initialGroupId = searchParams.get('groupId');

  const [activeTab, setActiveTab] = useState(initialGroupId ? 'group' : 'global');
  const [range, setRange]   = useState('today');
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  const [now, setNow]       = useState(new Date());
  const [verificationPending, setVerificationPending] = useState({});
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);
  const [currentUserRank, setCurrentUserRank] = useState(null);
  const [totalRanked, setTotalRanked] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);

  const [myGroups, setMyGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId || '');
  const requestIdRef = useRef(0);
  const realtimeRefreshRef = useRef(null);

  useEffect(() => { const t=setInterval(()=>setNow(new Date()),30000); return ()=>clearInterval(t); }, []);

  useEffect(() => {
    const refreshAvatars = () => setAvatarRefreshKey((key) => key + 1);
    window.addEventListener(AVATAR_UPDATED_EVENT, refreshAvatars);
    return () => window.removeEventListener(AVATAR_UPDATED_EVENT, refreshAvatars);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Fetch groups for the dropdown
  useEffect(() => {
    const fetchMyGroups = async () => {
      try {
        const res = await groupsApi.list();
        setMyGroups(res.data || []);
        if (res.data?.length > 0 && !selectedGroupId && activeTab === 'group') {
          setSelectedGroupId(res.data[0].id);
        }
      } catch (err) { console.error(err); }
    };
    fetchMyGroups();
  }, [activeTab]);

  const fetchData = async ({ silent = false } = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (!silent) {
      setUsers([]);
      setLoading(true);
    }
    try {
      let res;
      const query = { page, limit: PAGE_SIZE, search };
      if (activeTab === 'global') {
        res = await leaderboardApi.get(range, query);
      } else if (activeTab === 'friends') {
        res = await leaderboardApi.friends(range, query);
      } else if (selectedGroupId) {
        res = await leaderboardApi.group(selectedGroupId, range, query);
      }
      if (res) {
        if (requestId !== requestIdRef.current) return;
        const data = res.data || [];
        setUsers(data);
        let myRank = res.currentUserRank || null;
        if (!myRank && user?.id) {
          const idx = data.findIndex(u => String(u.user_id || u.id) === String(user.id));
          if (idx !== -1) {
            myRank = { ...data[idx], rankPosition: idx + 1 };
          }
        }
        setCurrentUserRank(myRank);
        setTotalRanked(Number(res.totalRanked || data.length || 0));
        setServerTotalPages(Math.max(1, Number(res.totalPages || 1)));
      }
    } catch (err) {
      if (requestId === requestIdRef.current) console.error(err);
    }
    if (!silent && requestId === requestIdRef.current) setLoading(false);
  };

  const scheduleRealtimeRefresh = (delayMs = 6000) => {
    if (realtimeRefreshRef.current) return;
    realtimeRefreshRef.current = window.setTimeout(() => {
      realtimeRefreshRef.current = null;
      fetchData({ silent: true });
    }, delayMs);
  };

  useEffect(() => {
    fetchData();
  }, [range, activeTab, selectedGroupId, page, search]);

  useEffect(() => {
    if (realtimeRefreshRef.current) {
      window.clearTimeout(realtimeRefreshRef.current);
      realtimeRefreshRef.current = null;
    }
  }, [range, activeTab, selectedGroupId, page, search]);

  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [range, activeTab, selectedGroupId, page, search]);

  useEffect(() => () => {
    if (realtimeRefreshRef.current) {
      window.clearTimeout(realtimeRefreshRef.current);
      realtimeRefreshRef.current = null;
    }
  }, []);

  const updateLocalVerification = (userId, nextVerified) => {
    const id = String(userId);
    setUsers((prev) => prev.map((row) => (
      String(row.user_id || row.id) === id
        ? { ...row, isVerified: nextVerified, verified: nextVerified }
        : row
    )));
    setCurrentUserRank((prev) => (
      prev && String(prev.user_id || prev.id) === id
        ? { ...prev, isVerified: nextVerified, verified: nextVerified }
        : prev
    ));
  };

  const toggleVerifiedUser = async (event, user) => {
    event.stopPropagation();
    const userId = user.user_id || user.id;
    if (!userId || verificationPending[String(userId)]) return;

    const previousVerified = isVerifiedRanker(user);
    const nextVerified = !previousVerified;
    updateLocalVerification(userId, nextVerified);
    setVerificationPending((prev) => ({ ...prev, [String(userId)]: true }));
    try {
      const res = await usersApi.update(userId, { isVerified: nextVerified });
      const savedVerified = toVerifiedBool(res.data?.isVerified ?? res.data?.verified ?? nextVerified);
      updateLocalVerification(userId, savedVerified);
    } catch (err) {
      console.error('Could not update user verification:', err);
      updateLocalVerification(userId, previousVerified);
    } finally {
      setVerificationPending((prev) => {
        const next = { ...prev };
        delete next[String(userId)];
        return next;
      });
    }
  };

  // Real-time socket listener
  useEffect(() => {
    if (!socket) return;
    const eventBelongsToCurrentView = (data = {}) => {
      if (range === 'today' && data.statDate && data.statDate !== localDateKey()) return false;
      if (activeTab === 'group') {
        if (!selectedGroupId) return false;
        return String(data.teamId || '') === String(selectedGroupId);
      }
      return true;
    };

    const handleActivity = (data) => {
      if (!eventBelongsToCurrentView(data)) return;
      scheduleRealtimeRefresh();
      const currentAuthUserId = String(user?.id || '');
      setUsers(prev => {
        const userId = String(data.userId || data.user_id);
        const totals = range === 'today' ? data.totals || null : null;
        const delta = data.delta || {};
        const deltaKeys = Number(delta.keystrokeCount ?? data.keystrokes ?? 0);
        const deltaClicks = Number(delta.mouseClickCount ?? data.clicks ?? 0);
        const deltaActiveSeconds = Number(delta.activeSeconds ?? data.activeSeconds ?? 0);
        const deltaIdleSeconds = Number(delta.idleSeconds ?? data.idleSeconds ?? 0);
        const idx = prev.findIndex(u => String(u.user_id || u.id) === userId);
        if (idx >= 0) {
          const next = [...prev];
          const existing = next[idx];
          const status = data.presence || data.presenceStatus || data.status || existing.status || 'active';
          const keystrokeCount = totals ? Number(totals.keystrokeCount || 0) : (Number(existing.keystrokeCount) || 0) + deltaKeys;
          const mouseClickCount = totals ? Number(totals.mouseClickCount || 0) : (Number(existing.mouseClickCount) || 0) + deltaClicks;
          const activeSeconds = totals ? Number(totals.activeSeconds || 0) : (Number(existing.activeSeconds || existing.total_active_seconds) || 0) + deltaActiveSeconds;
          const idleSeconds = totals ? Number(totals.idleSeconds || 0) : (Number(existing.idleSeconds || existing.total_idle_seconds) || 0) + deltaIdleSeconds;
          const focusScore = totals ? Number(totals.focusScore || 0) : Number(data.focusScore ?? existing.focusScore ?? 0);
          const score = calculateRankScore({ activeSeconds, idleSeconds, keystrokeCount, mouseClickCount, focusScore });
          next[idx] = { 
            ...existing,
            ...data,
            name: data.name || existing.name,
            status,
            presence: status,
            presenceStatus: status,
            keystrokeCount,
            mouseClickCount,
            activeSeconds,
            idleSeconds,
            total_active_seconds: activeSeconds,
            total_idle_seconds: idleSeconds,
            focusScore,
            score,
          };
          return next;
        }
        return prev;
      });
      if (currentAuthUserId && String(data.userId || data.user_id) === currentAuthUserId) {
        setCurrentUserRank((prev) => {
          const totals = range === 'today' ? data.totals || null : null;
          const delta = data.delta || {};
          const deltaKeys = Number(delta.keystrokeCount ?? data.keystrokes ?? 0);
          const deltaClicks = Number(delta.mouseClickCount ?? data.clicks ?? 0);
          const deltaActiveSeconds = Number(delta.activeSeconds ?? data.activeSeconds ?? 0);
          const deltaIdleSeconds = Number(delta.idleSeconds ?? data.idleSeconds ?? 0);
          const status = data.presence || data.presenceStatus || data.status || prev?.status || 'active';
          const keystrokeCount = totals ? Number(totals.keystrokeCount || 0) : (Number(prev?.keystrokeCount) || 0) + deltaKeys;
          const mouseClickCount = totals ? Number(totals.mouseClickCount || 0) : (Number(prev?.mouseClickCount) || 0) + deltaClicks;
          const activeSeconds = totals ? Number(totals.activeSeconds || 0) : (Number(prev?.activeSeconds || prev?.total_active_seconds) || 0) + deltaActiveSeconds;
          const idleSeconds = totals ? Number(totals.idleSeconds || 0) : (Number(prev?.idleSeconds || prev?.total_idle_seconds) || 0) + deltaIdleSeconds;
          const focusScore = totals ? Number(totals.focusScore || 0) : Number(data.focusScore ?? prev?.focusScore ?? 0);
          const score = calculateRankScore({ activeSeconds, idleSeconds, keystrokeCount, mouseClickCount, focusScore });
          const base = prev || { user_id: currentAuthUserId, name: data.name || `User #${currentAuthUserId}` };
          return {
            ...base,
            ...data,
            status,
            presence: status,
            presenceStatus: status,
            keystrokeCount,
            mouseClickCount,
            activeSeconds,
            idleSeconds,
            total_active_seconds: activeSeconds,
            total_idle_seconds: idleSeconds,
            focusScore,
            score,
          };
        });
      }
    };
    const handleStatus = (data) => {
      if (activeTab === 'group' && selectedGroupId && data.teamId && String(data.teamId) !== String(selectedGroupId)) return;
      const nextStatus = data.presence || data.presenceStatus || data.status || 'online';
      setUsers(prev => {
        const userId = String(data.userId || data.user_id);
        const idx = prev.findIndex(u => String(u.user_id || u.id) === userId);
        if (idx < 0) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          status: nextStatus,
          presence: nextStatus,
          presenceStatus: nextStatus,
        };
        return next;
      });
      if (String(data.userId || data.user_id) === String(user?.id || '')) {
        setCurrentUserRank((prev) => prev ? {
          ...prev,
          status: nextStatus,
          presence: nextStatus,
          presenceStatus: nextStatus,
        } : prev);
      }
    };
    socket.on('activity:user:update', handleActivity);
    socket.on('user:status:update', handleStatus);
    return () => {
      socket.off('activity:user:update', handleActivity);
      socket.off('user:status:update', handleStatus);
    };
  }, [socket, activeTab, selectedGroupId, range, page, search, user?.id]);

  const top1 = page === 1 && !search ? users[0] : null;
  const top2 = page === 1 && !search ? users[1] : null;
  const top3 = page === 1 && !search ? users[2] : null;
  const totalPages = serverTotalPages;
  const paginated  = users;
  const avgScore   = users.length ? Math.round(users.reduce((a,u)=>a+Number(u.score||0),0)/users.length) : 0;
  const timeStr = now.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const CARD = {
    background: '#ffffff',
    border: '1px solid rgba(15,23,42,0.08)',
    borderRadius: 0,
    boxShadow: 'none',
  };
  const activeTabLabel = activeTab === 'global' ? 'Toàn Cầu' : activeTab === 'friends' ? 'Bạn Bè' : 'Nhóm';

  return (
    <div className="leaderboard-page" style={{fontFamily:"'JetBrains Mono', monospace",maxWidth:1100,margin:'0 auto'}}>
      
      {/* ── HEADER ── */}
      <div style={{marginBottom:28}}>
        <div style={{display:'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16}}>
          <div>
            <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'3px 10px',borderRadius:0,background:'rgba(56,189,248,0.12)',border:'1px solid rgba(56,189,248,0.25)',marginBottom:12}}>
              <div style={{width:5,height:5,borderRadius:'50%',background:'#38bdf8',animation:'pulse-dot 2s ease infinite'}}/>
              <span style={{fontSize:10,fontWeight:800,color:'#38bdf8',letterSpacing:'0.1em'}}>HỆ THỐNG XẾP HẠNG</span>
            </div>
            <h1 style={{fontSize:32,fontWeight:900,margin:'0 0 6px',letterSpacing:'-0.8px',lineHeight:1}}>
              Bảng Xếp Hạng <span style={{color:'#38bdf8',fontStyle:'italic'}}>{activeTabLabel}</span>
            </h1>
          </div>

          <div className="leaderboard-controls" style={{display: 'flex', gap: 20, alignItems: 'center'}}>
            {/* Tab Switcher */}
            <div style={{display:'flex',background:'rgba(15,23,42,0.04)',border:'1px solid rgba(15,23,42,0.1)',borderRadius:0,padding:3,gap:2}}>
              <button onClick={() => { setActiveTab('global'); setPage(1); }} style={{
                padding:'7px 18px',borderRadius:0,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                background:activeTab==='global'?'#38bdf8':'transparent',
                color:activeTab==='global'?'#fff':'#64748b',transition:'all .15s',
                display:'flex',alignItems:'center',gap:6,
              }}><Globe2 size={14} /> Toàn Cầu</button>
              <button onClick={() => { setActiveTab('friends'); setPage(1); }} style={{
                padding:'7px 18px',borderRadius:0,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                background:activeTab==='friends'?'#38bdf8':'transparent',
                color:activeTab==='friends'?'#fff':'#64748b',transition:'all .15s',
                display:'flex',alignItems:'center',gap:6,
              }}><UserCheck size={14} /> Bạn Bè</button>
              <button onClick={() => { setActiveTab('group'); setPage(1); }} style={{
                padding:'7px 18px',borderRadius:0,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                background:activeTab==='group'?'#38bdf8':'transparent',
                color:activeTab==='group'?'#fff':'#64748b',transition:'all .15s',
                display:'flex',alignItems:'center',gap:6,
              }}><Users size={14} /> Nhóm</button>
            </div>

            {/* Time Range Filter */}
            <div style={{display:'flex',background:'rgba(15,23,42,0.04)',border:'1px solid rgba(15,23,42,0.1)',borderRadius:0,padding:3,gap:2}}>
              {RANGES.map(({key,label})=>(
                <button key={key} onClick={()=>{ setRange(key); setPage(1); }} style={{
                  padding:'7px 18px',borderRadius:0,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                  background:range===key?'#38bdf8':'transparent',
                  color:range===key?'#fff':'#64748b',transition:'all .15s',
                  boxShadow:'none',
                }}>{label}</button>
              ))}
            </div>

            {/* Verified Badge Rule Tooltip Button */}
            <div style={{ position: 'relative', display: 'inline-block', marginLeft: 4 }}>
              <button
                type="button"
                onClick={() => setShowRuleModal(true)}
                style={{
                  display:'flex',alignItems:'center',justifyContent:'center',
                  width:28,height:28,borderRadius:'50%',
                  background:'rgba(56,189,248,0.1)',border:'1px solid rgba(56,189,248,0.2)',
                  color:'#38bdf8',fontSize:14,fontWeight:900,cursor:'pointer',
                  padding: 0, outline: 'none', transition: 'transform 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                ?
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RENDER RULE MODAL */}
      {showRuleModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999,
          background: 'rgba(15, 23, 42, 0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div 
            style={{
              background: '#ffffff', borderRadius: 0, width: '100%', maxWidth: 420,
              boxShadow: 'none', overflow: 'hidden',
              animation: 'modal-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            {/* Modal Header */}
            <div style={{ position: 'relative', padding: '32px 24px 24px', textAlign: 'center', background: 'rgba(56,189,248,0.1)' }}>
              <button 
                onClick={() => setShowRuleModal(false)}
                style={{
                  position: 'absolute', top: 16, right: 16, width: 32, height: 32,
                  borderRadius: '50%', background: 'rgba(15,23,42,0.05)', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#64748b'
                }}
              >
                ✕
              </button>
              
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: '#fff', boxShadow: 'none', marginBottom: 16 }}>
                <Crown size={32} color="#f59e0b" strokeWidth={2.5} />
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>Đặc Quyền Tích Xanh</h2>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '0 24px 32px' }}>
              <div style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ marginTop: 2 }}>
                    <VerifiedBadge size={24} />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: '#1e293b' }}>Top 3 BXH Tháng</h3>
                    <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                      Hệ thống sẽ <strong>tự động cấp Tích Xanh miễn phí</strong> vĩnh viễn cho 3 người dùng đứng đầu danh sách (Top 1, 2 và 3) tổng kết vào cuối mỗi tháng.
                    </p>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => setShowRuleModal(false)}
                style={{
                  width: '100%', marginTop: 20, padding: '12px', borderRadius: 0,
                  background: '#0f172a', color: '#fff', border: 'none',
                  fontSize: 14, fontWeight: 800, cursor: 'pointer'
                }}
              >
                Đã Rõ Luật Chơi
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'group' && (
        <div className="leaderboard-group-filter" style={{...CARD, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16}}>
          <span style={{fontSize: 13, fontWeight: 700, color: '#64748b'}}>CHỌN NHÓM:</span>
          {myGroups.length > 0 ? (
            <select 
              value={selectedGroupId} 
              onChange={e => { setSelectedGroupId(e.target.value); setPage(1); }}
              style={{
                background: '#ffffff', border: '1px solid rgba(15,23,42,0.12)',
                color: '#0f172a', padding: '8px 12px', borderRadius: 0, outline: 'none',
                fontSize: 14, fontWeight: 600, minWidth: 200
              }}
            >
              {myGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          ) : (
            <div style={{fontSize: 13, color: '#64748b'}}>Bạn chưa tham gia nhóm nào. <span onClick={() => navigate('/groups')} style={{display:'inline-flex',alignItems:'center',gap:4,color: '#38bdf8', cursor: 'pointer', fontWeight: 700}}>Đến trang Nhóm <ArrowRight size={13} /></span></div>
          )}
        </div>
      )}

      {!loading && (
        <div
          style={{
            ...CARD,
            padding: '14px 18px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            borderColor: currentUserRank ? 'rgba(56,189,248,0.22)' : 'rgba(15,23,42,0.08)',
            background: currentUserRank ? 'rgba(56,189,248,0.06)' : '#ffffff',
            ...devRankerStyle(currentUserRank),
          }}
        >
          {currentUserRank ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div style={{
                  width: 46,
                  height: 46,
                  borderRadius: 0,
                  background: '#38bdf8',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 900,
                  flexShrink: 0,
                }}>
                  #{currentUserRank.rankPosition || currentUserRank.rank || '--'}
                </div>
                <Avatar
                  user={currentUserRank}
                  userId={currentUserRank.user_id || currentUserRank.id}
                  name={currentUserRank.name}
                  size={38}
                  idx={Number(currentUserRank.rankPosition || 1) - 1}
                  refreshKey={avatarRefreshKey}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Hạng của bạn · {currentUserRank.name}
                    </span>
                    {isVerifiedRanker(currentUserRank) && <VerifiedMark size={14} />}
                  </div>
                  <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', color: '#64748b', fontSize: 11, fontWeight: 800 }}>
                    <span>{fmtNum(currentUserRank.keystrokeCount)} phím</span>
                    <span>{fmtNum(currentUserRank.mouseClickCount)} click</span>
                    <span>{fmtScore(currentUserRank.score)} điểm</span>
                    {Number(totalRanked || 0) > 0 && <span>/ {Number(totalRanked).toLocaleString()} người có điểm</span>}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/users/${currentUserRank.user_id || currentUserRank.id}`)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  border: '1px solid rgba(56,189,248,0.18)',
                  background: '#ffffff',
                  color: '#38bdf8',
                  borderRadius: 0,
                  padding: '9px 12px',
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Mở hồ sơ
                <ArrowRight size={14} />
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#64748b', fontSize: 13, fontWeight: 800 }}>
              <Trophy size={17} color="#94a3b8" />
              Bạn chưa có điểm trong khoảng thời gian này.
            </div>
          )}
        </div>
      )}

      {/* ── TREND BAR ── */}
      <div className="leaderboard-trend" style={{...CARD,padding:'12px 20px',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:'#22c55e',boxShadow:'none',animation:'pulse-dot 2s ease infinite'}}/>
          <span style={{fontSize:11,fontWeight:700,color:'#22c55e',textTransform:'uppercase',letterSpacing:'0.08em'}}>Xu Hướng Hoạt Động</span>
          <span style={{fontSize:11,color:'#64748b',marginLeft:6}}>
            ĐIỂM CẠNH TRANH TB: <span style={{color:'#0f172a',fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{Number(avgScore).toLocaleString()} điểm</span>
          </span>
        </div>
        <div style={{fontSize:11,color:'#64748b',fontWeight:600}}>
          Cập nhật lúc: <span style={{color:'#1e293b',fontFamily:"'JetBrains Mono',monospace"}}>{timeStr}</span>
        </div>
      </div>

      {/* ── PODIUM ── */}
      {!loading && page === 1 && !search && users.length >= 1 && (
        <div className="leaderboard-podium" style={{...CARD,padding:'28px 24px',marginBottom:20,display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,alignItems:'end'}}>
          <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:10,minHeight:260}}>
            {top2 && (
              <div role="button" tabIndex={0} onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); navigate(`/users/${top2.user_id}`); } }} onClick={()=>navigate(`/users/${top2.user_id}`)} style={{display:'flex',flexDirection:'column',alignItems:'center',cursor:'pointer',gap:8,flex:1,...devRankerStyle(top2, 'podium')}}>
                <div style={{position:'relative'}}>
                  <Avatar user={top2} userId={top2.user_id || top2.id} name={top2.name} size={44} idx={1} refreshKey={avatarRefreshKey}/>
                  <div style={{position:'absolute',bottom:-6,left:-6,width:16,height:16,borderRadius:0,background:'#64748b',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:900,color:'#f8fafc'}}>2</div>
                </div>
                <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:4,fontSize:11,fontWeight:700,color:'#64748b',textAlign:'center'}}>
                  {(top2.name||'').split(' ').pop().toUpperCase().slice(0,6)}
                  {isVerifiedRanker(top2) && <VerifiedMark size={13} />}
                  <LevelText user={top2} compact />
                </div>
                <div style={{display:'flex',justifyContent:'center',gap:4,flexWrap:'wrap',minHeight:18}}>
                  {rankBadges(top2, 2, range).slice(0, 2).map((badge) => <RankBadge key={badge.key} badge={badge} compact />)}
                </div>
                <div style={{fontSize:14,fontWeight:900,color:'#64748b',fontFamily:"'JetBrains Mono',monospace"}}>{fmtScore(top2.score)}</div>
                <div style={{width:'100%',height:90,background:'rgba(148,163,184,0.05)',border:'1px solid rgba(148,163,184,0.2)',borderRadius:0}}/>
              </div>
            )}
            {top1 && (
              <div role="button" tabIndex={0} onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); navigate(`/users/${top1.user_id}`); } }} onClick={()=>navigate(`/users/${top1.user_id}`)} style={{display:'flex',flexDirection:'column',alignItems:'center',cursor:'pointer',gap:8,flex:1.2,...devRankerStyle(top1, 'podium')}}>
                <Crown size={22} color="#f59e0b" strokeWidth={2.5} style={{ marginBottom: 4 }} />
                <div style={{position:'relative'}}>
                  <Avatar user={top1} userId={top1.user_id || top1.id} name={top1.name} size={52} idx={0} refreshKey={avatarRefreshKey}/>
                  <div style={{position:'absolute',bottom:-6,left:-6,width:18,height:18,borderRadius:0,background:'#f59e0b',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:900,color:'#f8fafc'}}>1</div>
                </div>
                <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:4,fontSize:12,fontWeight:700,color:'#f59e0b',textAlign:'center'}}>
                  {(top1.name||'').split(' ').pop().toUpperCase().slice(0,6)}
                  {isVerifiedRanker(top1) && <VerifiedMark size={14} />}
                  <LevelText user={top1} compact />
                </div>
                <div style={{display:'flex',justifyContent:'center',gap:4,flexWrap:'wrap',minHeight:18}}>
                  {rankBadges(top1, 1, range).slice(0, 2).map((badge) => <RankBadge key={badge.key} badge={badge} compact />)}
                </div>
                <div style={{fontSize:18,fontWeight:900,color:'#f59e0b',fontFamily:"'JetBrains Mono',monospace"}}>{fmtScore(top1.score)}</div>
                <div style={{width:'100%',height:130,background:'rgba(245,158,11,0.05)',border:'1px solid rgba(245,158,11,0.25)',borderRadius:0}}/>
              </div>
            )}
            {top3 && (
              <div role="button" tabIndex={0} onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); navigate(`/users/${top3.user_id}`); } }} onClick={()=>navigate(`/users/${top3.user_id}`)} style={{display:'flex',flexDirection:'column',alignItems:'center',cursor:'pointer',gap:8,flex:1,...devRankerStyle(top3, 'podium')}}>
                <div style={{position:'relative'}}>
                  <Avatar user={top3} userId={top3.user_id || top3.id} name={top3.name} size={40} idx={2} refreshKey={avatarRefreshKey}/>
                  <div style={{position:'absolute',bottom:-6,left:-6,width:16,height:16,borderRadius:0,background:'#b45309',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:900,color:'#fff'}}>3</div>
                </div>
                <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:4,fontSize:11,fontWeight:700,color:'#d97706',textAlign:'center'}}>
                  {(top3.name||'').split(' ').pop().toUpperCase().slice(0,6)}
                  {isVerifiedRanker(top3) && <VerifiedMark size={13} />}
                  <LevelText user={top3} compact />
                </div>
                <div style={{display:'flex',justifyContent:'center',gap:4,flexWrap:'wrap',minHeight:18}}>
                  {rankBadges(top3, 3, range).slice(0, 2).map((badge) => <RankBadge key={badge.key} badge={badge} compact />)}
                </div>
                <div style={{fontSize:14,fontWeight:900,color:'#d97706',fontFamily:"'JetBrains Mono',monospace"}}>{fmtScore(top3.score)}</div>
                <div style={{width:'100%',height:70,background:'rgba(180,83,9,0.05)',border:'1px solid rgba(180,83,9,0.2)',borderRadius:0}}/>
              </div>
            )}
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {users.slice(3, 8).map((u,i)=>{
              const rank = Number(u.rankPosition || u.rank || i + 4);
              const devStyle = devRankerStyle(u);
              return (
                <div key={u.user_id} role="button" tabIndex={0} onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); navigate(`/users/${u.user_id}`); } }} onClick={()=>navigate(`/users/${u.user_id}`)}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'rgba(15,23,42,0.03)',borderRadius:0,border:'1px solid rgba(15,23,42,0.08)',cursor:'pointer',transition:'background .15s',...devStyle}}
                >
                  <div style={{width:22,height:22,borderRadius:0,background:'rgba(15,23,42,0.06)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'#64748b',flexShrink:0}}>{rank}</div>
                  <Avatar user={u} userId={u.user_id || u.id} name={u.name} size={28} idx={rank-1} refreshKey={avatarRefreshKey}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:5,fontSize:13,fontWeight:600,color:'#1e293b',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                      <span style={{overflow:'hidden',textOverflow:'ellipsis'}}>{u.name}</span>
                      {isVerifiedRanker(u) && <VerifiedMark size={12} />}
                      <LevelText user={u} compact />
                    </div>
                    <div style={{display:'flex',gap:4,marginTop:4,overflow:'hidden'}}>
                      {rankBadges(u, rank, range).slice(0, 2).map((badge) => <RankBadge key={badge.key} badge={badge} compact />)}
                    </div>
                  </div>
                  <div style={{fontSize:14,fontWeight:800,color:'#60a5fa',fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>{fmtScore(u.score)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── BOTTOM TABLE ── */}
      <div className="leaderboard-table-card" style={{...CARD,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px',borderBottom:'1px solid rgba(15,23,42,0.06)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.08em'}}>Danh Sách Thứ Hạng</span>
            {isAdmin && (
              <span style={{fontSize:11,fontWeight:700,color:'#1877f2',background:'rgba(24,119,242,0.08)',border:'1px solid rgba(24,119,242,0.18)',borderRadius:0,padding:'4px 8px'}}>
                Tích xanh do admin cấp
              </span>
            )}
          </div>
          <div style={{position:'relative'}}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              aria-label="Tìm kiếm người dùng"
              value={searchInput}
              onChange={e=>setSearchInput(e.target.value)}
              placeholder="Tìm người dùng..."
              style={{background:'rgba(15,23,42,0.06)',border:'1px solid rgba(15,23,42,0.1)',borderRadius:0,padding:'7px 12px 7px 30px',fontSize:12,color:'#1e293b',outline:'none',width:200}}
            />
          </div>
        </div>
        <div className="leaderboard-table-scroll">
          <table style={{width:'100%',minWidth:720,borderCollapse:'collapse'}}>
            <thead>
              <tr style={{borderBottom:'1px solid rgba(15,23,42,0.06)'}}>
                {['Hạng','Người Dùng','Gõ Phím','Click','Điểm Tổng'].map(h=>(
                  <th key={h} style={{padding:'10px 18px',textAlign:(h==='Hạng' || h==='Người Dùng')?'left':'right',fontSize:10,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{padding:'52px',textAlign:'center',color:'#94a3b8'}}>Đang tải...</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={5} style={{padding:'52px',textAlign:'center',color:'#94a3b8'}}>Không có người dùng phù hợp</td></tr>
              ) : paginated.map((u,i)=>{
                const rank = Number(u.rankPosition || u.rank || (page-1)*PAGE_SIZE + i + 1);
                const sc = Number(u.score||0);
                const verified = isVerifiedRanker(u);
                const badges = rankBadges(u, rank, range);
                const userId = u.user_id || u.id;
                const isUpdatingVerification = Boolean(verificationPending[String(userId)]);
                return (
                  <tr key={u.user_id} role="button" tabIndex={0} onKeyDown={(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); navigate(`/users/${u.user_id}`); } }} onClick={()=>navigate(`/users/${u.user_id}`)} style={{borderBottom:'1px solid rgba(15,23,42,0.04)',cursor:'pointer',...devRankerStyle(u, 'table')}}>
                    <td style={{padding:'12px 18px'}}><div style={{fontSize:11,fontWeight:800,color:'#64748b'}}>{rank}</div></td>
                    <td style={{padding:'12px 18px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0}}>
                        <Avatar user={u} userId={u.user_id || u.id} name={u.name} size={30} idx={rank-1} refreshKey={avatarRefreshKey}/>
                        <div style={{minWidth:0,display:'flex',flexDirection:'column',gap:5}}>
                          <div style={{display:'flex',alignItems:'center',gap:5,minWidth:0}}>
                            <span style={{fontSize:13,fontWeight:700,color:'#1e293b',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:190}}>{u.name}</span>
                            {verified && <VerifiedMark size={13} />}
                            <LevelText user={u} />
                          </div>
                          {badges.length > 0 && (
                            <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
                              {badges.map((badge) => <RankBadge key={badge.key} badge={badge} />)}
                            </div>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              data-no-track="true"
                              disabled={isUpdatingVerification}
                              onClick={(event) => toggleVerifiedUser(event, u)}
                              style={{
                                alignSelf: 'flex-start',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 8px',
                                borderRadius: 0,
                                border: verified ? '1px solid rgba(24,119,242,0.24)' : '1px solid rgba(100,116,139,0.22)',
                                background: verified ? 'rgba(24,119,242,0.08)' : 'rgba(15,23,42,0.04)',
                                color: verified ? '#1877f2' : '#64748b',
                                fontSize: 10,
                                fontWeight: 900,
                                cursor: isUpdatingVerification ? 'wait' : 'pointer',
                                opacity: isUpdatingVerification ? 0.65 : 1,
                              }}
                            >
                              <BadgeCheck size={11} strokeWidth={2.8} />
                              {verified ? 'Gỡ tích xanh' : 'Cấp tích xanh'}
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{padding:'12px 18px',textAlign:'right'}}><div style={{fontSize:13,fontWeight:800,color:'#1e293b',fontFamily:"'JetBrains Mono',monospace"}}>{fmtNum(u.keystrokeCount)}</div></td>
                    <td style={{padding:'12px 18px',textAlign:'right'}}><div style={{fontSize:13,color:'#64748b',fontFamily:"'JetBrains Mono',monospace"}}>{fmtNum(u.mouseClickCount)}</div></td>
                    <td style={{padding:'12px 18px',textAlign:'right'}}><span style={{fontSize:15,fontWeight:900,color:'#38bdf8'}}>{fmtScore(sc)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div style={{padding:'12px 18px',borderTop:'1px solid rgba(15,23,42,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:12,color:'#64748b'}}>Trang {page} / {totalPages}</span>
          <div style={{display:'flex',gap:8}}>
            <button aria-label="Trang trước" disabled={page<=1} onClick={()=>setPage(p=>p-1)} style={{padding:'5px 12px',borderRadius:0,background:'rgba(15,23,42,0.06)',border:'1px solid rgba(15,23,42,0.08)',color:'#0f172a',cursor:page<=1?'not-allowed':'pointer',opacity:page<=1?0.4:1,display:'flex',alignItems:'center'}}><ChevronLeft size={15} /></button>
            <button aria-label="Trang sau" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)} style={{padding:'5px 12px',borderRadius:0,background:'rgba(15,23,42,0.06)',border:'1px solid rgba(15,23,42,0.08)',color:'#0f172a',cursor:page>=totalPages?'not-allowed':'pointer',opacity:page>=totalPages?0.4:1,display:'flex',alignItems:'center'}}><ChevronRight size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
