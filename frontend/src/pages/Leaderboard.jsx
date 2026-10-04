import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { rankings as rankingsApi, youtube as youtubeApi, kpiApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getUserAvatar, initialsFromName } from '../utils/avatar';
import {
  Trophy,
  Users,
  User,
  Crown,
  Tv,
  Award,
  Medal,
  Sparkles,
  Search,
  ChevronRight,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  Eye,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Code2,
  CheckCheck,
  BadgeCheck,
  AlertCircle,
  Video,
  Building2,
  ArrowLeft,
  Filter,
  Target,
  CheckCircle2,
  Clock3,
} from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';
import JobTitleBadge from '../components/JobTitleBadge';
import { TabTransition, TableSkeleton, AnimatedNumber, FlipTableBody } from '../components/ui';
import { getCached, setCached, fetchWithCache, CACHE_KEYS, CACHE_TTL, isDeepEqual } from '../services/cache';

/* =========================================================================
 * STYLES & THEME CONSTANTS (WorkRank Standard)
 * ========================================================================= */

const CARD = {
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.08)',
  borderRadius: 6,
  boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
};

const AVATAR_GRADS = [
  '#b45309',
  '#555555',
  '#15803d',
  '#141414',
  '#777777',
  '#0369a1',
];

function fmtNum(n) {
  n = Number(n) || 0;
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toLocaleString('vi-VN');
}

function rankerLevel(user = {}) {
  const level = Number(user.level ?? user.userLevel ?? user.user_level ?? 1);
  return Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
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
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: compact ? 16 : 18,
        padding: compact ? '0 5px' : '1px 6px',
        border: `1px solid ${theme.border}`,
        background: theme.bg,
        flexShrink: 0,
        color: theme.color,
        fontSize: compact ? 9 : 10,
        fontWeight: 600,
        fontFamily: "'JetBrains Mono',monospace",
        whiteSpace: 'nowrap',
        borderRadius: 4,
      }}
    >
      Lv.{level}
    </span>
  );
}

function AvatarBox({ user, userId, name, size = 36, idx = 0 }) {
  const avatarUrl = getUserAvatar(user || { id: userId }, userId);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          flexShrink: 0,
          background: AVATAR_GRADS[idx % AVATAR_GRADS.length],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: Math.max(10, Math.floor(size * 0.35)),
          fontWeight: 600,
          color: '#fff',
          letterSpacing: 0,
          overflow: 'hidden',
        }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={name || 'Avatar'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          initialsFromName(name || `User #${userId || idx}`)
        )}
      </div>
    </div>
  );
}

function TrendIndicator({ trend, delta }) {
  if (trend === 'UP') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', color: '#16a34a', fontSize: 11, fontWeight: 600 }} title="Tăng hạng">
        <ArrowUp size={12} strokeWidth={2.5} />
      </span>
    );
  }
  if (trend === 'DOWN') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', color: '#dc2626', fontSize: 11, fontWeight: 600 }} title="Giảm hạng">
        <ArrowDown size={12} strokeWidth={2.5} />
      </span>
    );
  }
  const d = Number(delta);
  if (Number.isFinite(d) && d !== 0) {
    if (d > 0) return <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 600 }}>+{d}</span>;
    return <span style={{ color: '#dc2626', fontSize: 11, fontWeight: 600 }}>{d}</span>;
  }
  return <span style={{ color: '#cbd5e1', fontSize: 11, fontWeight: 500 }}>—</span>;
}

/* =========================================================================
 * PODIUM 2 CỘT (Top 3 Bục 2-1-3 + Top 4-8)
 * ========================================================================= */

function DynamicPodium({ items = [], nameKey = 'name', scoreKey = 'score', scoreSuffix = 'pts', onSelect, isYouTube = false }) {
  if (!items || items.length === 0) return null;

  const top1 = items[0];
  const top2 = items[1];
  const top3 = items[2];
  const runnerUps = items.slice(3, 8);

  const getScore = (item) => {
    if (!item) return 0;
    return item[scoreKey] ?? item.totalScore ?? item.grandPoints ?? item.score ?? item.views ?? 0;
  };

  const getName = (item) => {
    if (!item) return '';
    return item[nameKey] || item.title || item.userName || item.teamName || '—';
  };

  return (
    <div
      className="leaderboard-podium"
      style={{
        ...CARD,
        padding: '24px 20px',
        marginBottom: 20,
        display: 'grid',
        gridTemplateColumns: items.length > 3 ? '1.15fr 0.85fr' : '1fr',
        gap: 20,
        alignItems: 'end',
      }}
    >
      {/* BỤC TOP 3 (2 - 1 - 3) */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, minHeight: 250 }}>
        {/* RANK 2 */}
        {top2 && (
          <div
            onClick={() => onSelect && onSelect(top2)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: onSelect ? 'pointer' : 'default',
              gap: 6,
              flex: 1,
            }}
          >
            <div style={{ position: 'relative' }}>
              {isYouTube ? (
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', overflow: 'hidden' }}>
                  {top2.thumbnailUrl ? <img src={top2.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Tv size={20} />}
                </div>
              ) : (
                <AvatarBox user={top2} name={getName(top2)} userId={top2.userId || top2.id} size={44} idx={1} />
              )}
              <div style={{
                position: 'absolute', bottom: -5, left: -5, width: 18, height: 18,
                borderRadius: '50%', background: '#64748b', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 10,
                fontWeight: 700, color: '#f8fafc', border: '1.5px solid #ffffff',
              }}>
                2
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 95 }}>
              {getName(top2).split(' ').pop().toUpperCase()}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', fontFamily: "'JetBrains Mono',monospace", display: 'flex', alignItems: 'center', gap: 3 }}>
              <AnimatedNumber value={getScore(top2)} duration={700} formatFn={fmtNum} />
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{scoreSuffix}</span>
            </div>
            <div
              className="podium-step-transition"
              style={{
                width: '100%', height: 90,
                background: 'rgba(148,163,184,0.08)',
                border: '1px solid rgba(148,163,184,0.3)',
                borderRadius: '4px 4px 0 0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 700, color: '#64748b' }}>2</span>
            </div>
          </div>
        )}

        {/* RANK 1 (CHAMPION) */}
        {top1 && (
          <div
            onClick={() => onSelect && onSelect(top1)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: onSelect ? 'pointer' : 'default',
              gap: 6,
              flex: 1.25,
              maxWidth: items.length === 1 ? 240 : 'none',
            }}
          >
            <Crown size={24} color="#f59e0b" strokeWidth={2.5} style={{ marginBottom: 2 }} />
            <div style={{ position: 'relative' }}>
              {isYouTube ? (
                <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', overflow: 'hidden' }}>
                  {top1.thumbnailUrl ? <img src={top1.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Tv size={24} />}
                </div>
              ) : (
                <AvatarBox user={top1} name={getName(top1)} userId={top1.userId || top1.id} size={54} idx={0} />
              )}
              <div style={{
                position: 'absolute', bottom: -6, left: -6, width: 22, height: 22,
                borderRadius: '50%', background: '#f59e0b', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 11,
                fontWeight: 700, color: '#000', border: '1.5px solid #ffffff',
              }}>
                1
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 115 }}>
              {getName(top1).split(' ').pop().toUpperCase()}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b', fontFamily: "'JetBrains Mono',monospace", display: 'flex', alignItems: 'center', gap: 4 }}>
              <AnimatedNumber value={getScore(top1)} duration={700} formatFn={fmtNum} />
              <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>{scoreSuffix}</span>
            </div>
            <div
              className="podium-step-transition"
              style={{
                width: '100%', height: 130,
                background: 'rgba(245,158,11,0.08)',
                border: '1.5px solid rgba(245,158,11,0.35)',
                borderRadius: '4px 4px 0 0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }}>1</span>
            </div>
          </div>
        )}

        {/* RANK 3 */}
        {top3 && (
          <div
            onClick={() => onSelect && onSelect(top3)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: onSelect ? 'pointer' : 'default',
              gap: 6,
              flex: 1,
            }}
          >
            <div style={{ position: 'relative' }}>
              {isYouTube ? (
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', overflow: 'hidden' }}>
                  {top3.thumbnailUrl ? <img src={top3.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Tv size={18} />}
                </div>
              ) : (
                <AvatarBox user={top3} name={getName(top3)} userId={top3.userId || top3.id} size={42} idx={2} />
              )}
              <div style={{
                position: 'absolute', bottom: -5, left: -5, width: 18, height: 18,
                borderRadius: '50%', background: '#b45309', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 10,
                fontWeight: 700, color: '#fff', border: '1.5px solid #ffffff',
              }}>
                3
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#d97706', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 95 }}>
              {getName(top3).split(' ').pop().toUpperCase()}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#d97706', fontFamily: "'JetBrains Mono',monospace", display: 'flex', alignItems: 'center', gap: 3 }}>
              <AnimatedNumber value={getScore(top3)} duration={700} formatFn={fmtNum} />
              <span style={{ fontSize: 10, color: '#b45309', fontWeight: 500 }}>{scoreSuffix}</span>
            </div>
            <div
              className="podium-step-transition"
              style={{
                width: '100%', height: 70,
                background: 'rgba(180,83,9,0.08)',
                border: '1px solid rgba(180,83,9,0.25)',
                borderRadius: '4px 4px 0 0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 700, color: '#b45309' }}>3</span>
            </div>
          </div>
        )}
      </div>

      {/* TOP 4 - TOP 8 */}
      {runnerUps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
            Nhóm Bám Đuổi (Top 4 — Top 8)
          </div>
          {runnerUps.map((u, i) => {
            const rank = i + 4;
            const scoreVal = getScore(u);
            return (
              <div
                key={u.id || u.userId || u.teamId || i}
                onClick={() => onSelect && onSelect(u)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  background: 'rgba(15,23,42,0.02)',
                  borderRadius: 4,
                  border: '1px solid rgba(15,23,42,0.06)',
                  cursor: onSelect ? 'pointer' : 'default',
                  transition: 'background var(--motion-fast) ease',
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    background: 'rgba(15,23,42,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#64748b',
                    flexShrink: 0,
                  }}
                >
                  {rank}
                </div>
                {isYouTube ? (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e2e8f0', overflow: 'hidden', flexShrink: 0 }}>
                    {u.thumbnailUrl ? <img src={u.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Tv size={14} />}
                  </div>
                ) : (
                  <AvatarBox user={u} name={getName(u)} userId={u.userId || u.id} size={28} idx={rank - 1} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getName(u)}</span>
                    {u.userLevel && <LevelText user={u} compact />}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#b45309', fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>
                  <AnimatedNumber value={scoreVal} duration={700} formatFn={fmtNum} /> <span style={{ fontSize: 10, color: '#94a3b8' }}>{scoreSuffix}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
 * BANNER HẠNG CỦA BẠN (My Rank Card)
 * ========================================================================= */

function MyRankBanner({ currentUser, items = [], isTeam = false, scoreKey = 'score', scoreSuffix = 'pts', onOpenProfile, serverRank }) {
  if (!currentUser) return null;

  let myEntry = isTeam
    ? (currentUser.teamId ? items.find((r) => Number(r.teamId) === Number(currentUser.teamId)) : null)
    : items.find((r) => Number(r.userId || r.id) === Number(currentUser.id) || r.userName === currentUser.name);

  if (!myEntry && serverRank) {
    myEntry = {
      ...serverRank,
      [scoreKey]: serverRank.score,
    };
  }

  if (!myEntry) {
    return (
      <div style={{ ...CARD, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, color: '#64748b', fontSize: 13 }}>
        <Trophy size={16} color="#94a3b8" />
        {isTeam ? 'Đội của bạn chưa có vị trí xếp hạng trong danh sách này.' : 'Bạn chưa có điểm trong bảng xếp hạng này.'}
      </div>
    );
  }

  const myRank = myEntry.rank || (items.length > 0 ? items.indexOf(myEntry) + 1 : 1);
  const myScore = myEntry[scoreKey] ?? myEntry.totalScore ?? myEntry.grandPoints ?? myEntry.score ?? 0;
  const leader = items[0] || myEntry;
  const leaderScore = leader?.[scoreKey] ?? leader?.totalScore ?? leader?.grandPoints ?? leader?.score ?? 0;
  const gap = myEntry.gap !== undefined ? myEntry.gap : Math.max(0, Number(leaderScore) - Number(myScore));

  return (
    <div
      style={{
        ...CARD,
        padding: '12px 18px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        borderColor: 'rgba(180,83,9,0.3)',
        background: 'rgba(180,83,9,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div
          style={{
            width: 40,
            height: 40,
            background: '#b45309',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            fontWeight: 700,
            flexShrink: 0,
            fontFamily: "'JetBrains Mono',monospace",
            borderRadius: 4,
          }}
        >
          #{myRank}
        </div>
        <AvatarBox user={myEntry || currentUser} name={myEntry.userName || myEntry.teamName || currentUser.name} userId={currentUser.id} size={36} idx={myRank - 1} />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isTeam ? `Vị trí Đội của bạn · ${myEntry.teamName}` : `Vị trí của bạn · ${myEntry.userName || currentUser.name}`}
            </span>
            {!isTeam && <LevelText user={currentUser} compact />}
          </div>
          <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', color: '#64748b', fontSize: 11 }}>
            <span>{fmtNum(myScore)} {scoreSuffix}</span>
            {gap > 0 && <span style={{ color: '#dc2626' }}>(-{fmtNum(gap)} {scoreSuffix} so với #1)</span>}
            {gap === 0 && (
              <span style={{ color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Crown size={12} color="#16a34a" /> Đang dẫn đầu
              </span>
            )}
          </div>
        </div>
      </div>

      {!isTeam && onOpenProfile && (
        <button
          type="button"
          onClick={() => onOpenProfile(currentUser)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid rgba(180,83,9,0.25)',
            background: '#ffffff',
            color: '#b45309',
            borderRadius: 4,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Hồ sơ cá nhân <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

/* =========================================================================
 * MAIN COMPONENT: LEADERBOARD (3-TIER HIERARCHY)
 * ========================================================================= */

export default function Leaderboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user: currentUser, socket } = useAuth();

  // Hierarchy Navigation States
  // Level 1: scopeMode = 'teams' | 'members' | 'youtube' | 'hall-of-fame'
  const rawMode = searchParams.get('mode');
  const rawScope = searchParams.get('scope');
  const rawRanking = searchParams.get('ranking');
  const rawPeriod = searchParams.get('period');

  // Normalize scopeMode
  let scopeMode = 'kpi';
  if (rawScope === 'kpi' || rawMode === 'kpi' || rawRanking === 'kpi') {
    scopeMode = 'kpi';
  } else if (rawMode) {
    scopeMode = (rawMode === 'member' || rawMode === 'individual' || rawMode === 'individuals') ? 'members' : rawMode;
  } else if (rawRanking === 'individual' || rawRanking === 'individuals' || rawRanking === 'member' || rawRanking === 'members') {
    scopeMode = 'members';
  } else if (rawScope === 'members' || rawScope === 'member' || rawScope === 'individual' || rawScope === 'individuals') {
    scopeMode = 'members';
  } else if (rawScope === 'youtube') {
    scopeMode = 'youtube';
  } else if (rawScope === 'hall-of-fame' || rawScope === 'hof') {
    scopeMode = 'hall-of-fame';
  } else if (rawScope === 'teams' || rawScope === 'team') {
    scopeMode = 'teams';
  }

  // Level 2: selectedTeamId (if present, user is drilling down into a Team, supports teamId and groupId)
  const selectedTeamId = searchParams.get('teamId') || searchParams.get('groupId') || null;
  // Team sub-view: 'members' | 'youtube'
  const teamSubView = searchParams.get('teamView') || 'members';

  // Global Preserved Period: 'season' | 'grand' | 'all-time' | 'today' | '7d' | '30d'
  // CANONICAL DEFAULT: When scopeMode is 'members', default period is 'all-time'.
  let currentPeriod;
  if (rawPeriod) {
    currentPeriod = rawPeriod;
  } else if (rawScope === 'season' || rawScope === 'grand' || rawScope === 'all-time' || rawScope === 'today' || rawScope === '7d' || rawScope === '30d') {
    currentPeriod = rawScope;
  } else if (scopeMode === 'members') {
    currentPeriod = 'all-time';
  } else {
    currentPeriod = 'season';
  }

  const urlSeasonId = searchParams.get('seasonId') || '';
  const urlGrandId = searchParams.get('grandId') || '';
  const urlMetric = searchParams.get('metric') || 'views';
  const urlSearch = searchParams.get('search') || '';

  const initialCacheKey = selectedTeamId
    ? CACHE_KEYS.RANKINGS('team_drilldown', { teamId: selectedTeamId, period: currentPeriod, search: urlSearch, metric: urlMetric })
    : CACHE_KEYS.RANKINGS(scopeMode, { period: currentPeriod, seasonId: urlSeasonId, grandId: urlGrandId, metric: urlMetric, search: urlSearch });
  const initialCached = getCached(initialCacheKey);

  const [loading, setLoading] = useState(!initialCached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchKeyword);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  // Helper to normalize ranking responses/cache into { items: [], total: 0 }
  const normalizeRankingObj = (val) => {
    if (!val) return { items: [], total: 0 };
    if (Array.isArray(val)) return { items: val, total: val.length };
    return {
      items: Array.isArray(val.items) ? val.items : (Array.isArray(val.data) ? val.data : []),
      total: Number(val.total || val.count || 0),
    };
  };

  // Data states
  const [teamRankings, setTeamRankings] = useState(() => (scopeMode === 'teams' ? normalizeRankingObj(initialCached) : { items: [], total: 0 }));
  const [memberRankings, setMemberRankings] = useState(() => (scopeMode === 'members' ? normalizeRankingObj(initialCached) : { items: [], total: 0 }));
  const [youtubeRankings, setYoutubeRankings] = useState(() => (scopeMode === 'youtube' ? normalizeRankingObj(initialCached) : { items: [], total: 0 }));
  const [hallOfFameData, setHallOfFameData] = useState(() => (scopeMode === 'hall-of-fame' && initialCached ? initialCached : { seasonMvps: [], championTeams: [] }));
  const [selectedTeamDetails, setSelectedTeamDetails] = useState(null);
  const [teamChannels, setTeamChannels] = useState([]);
  const [kpiResults, setKpiResults] = useState([]);
  const [kpiDepartments, setKpiDepartments] = useState([]);
  const [selectedKpiDeptCode, setSelectedKpiDeptCode] = useState('CONTENT');

  const filteredKpiDepartment = useMemo(() => {
    return kpiDepartments.find((d) => d.code === selectedKpiDeptCode) || kpiDepartments[0] || null;
  }, [kpiDepartments, selectedKpiDeptCode]);

  const kpiUserLeaderboard = useMemo(() => {
    if (!filteredKpiDepartment) return [];
    const deptId = filteredKpiDepartment.id;

    const deptResults = kpiResults.filter(
      (r) => Number(r.departmentId || r.department?.id) === Number(deptId)
    );

    const userMap = new Map();
    deptResults.forEach((r) => {
      const u = r.user;
      if (!u) return;
      const uid = u.id;
      if (!userMap.has(uid)) {
        userMap.set(uid, {
          user: u,
          kpis: [],
          totalProgress: 0,
        });
      }
      const entry = userMap.get(uid);
      entry.kpis.push(r);
      entry.totalProgress += Number(r.progressPct || 0);
    });

    const list = Array.from(userMap.values()).map((item) => {
      const avgProgress = item.kpis.length > 0 ? Math.round(item.totalProgress / item.kpis.length) : 0;
      return {
        ...item,
        avgProgress,
      };
    });

    list.sort((a, b) => b.avgProgress - a.avgProgress || a.user.name.localeCompare(b.user.name));

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      return list.filter((item) => (item.user?.name || '').toLowerCase().includes(q) || (item.user?.email || '').toLowerCase().includes(q));
    }
    return list;
  }, [filteredKpiDepartment, kpiResults, debouncedSearch]);

  // Selectors
  const rawSeasonList = getCached(CACHE_KEYS.RANKINGS_META() + ':seasons');
  const [seasonList, setSeasonList] = useState(() => (Array.isArray(rawSeasonList) ? rawSeasonList : []));
  const rawGrandList = getCached(CACHE_KEYS.RANKINGS_META() + ':grands');
  const [grandList, setGrandList] = useState(() => (Array.isArray(rawGrandList) ? rawGrandList : []));

  const setParam = useCallback((key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value === null || value === undefined) params.delete(key);
    else params.set(key, value);
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  // Load Seasons & Grands once
  useEffect(() => {
    let mounted = true;
    async function loadMeta() {
      try {
        const [seasons, grands] = await Promise.all([
          fetchWithCache(CACHE_KEYS.RANKINGS_META() + ':seasons', () => rankingsApi.getSeasons().catch(() => []), { ttl: CACHE_TTL.STATIC }),
          fetchWithCache(CACHE_KEYS.RANKINGS_META() + ':grands', () => rankingsApi.getGrands().catch(() => []), { ttl: CACHE_TTL.STATIC }),
        ]);
        if (!mounted) return;
        setSeasonList((prev) => (isDeepEqual(prev, seasons) ? prev : seasons));
        setGrandList((prev) => (isDeepEqual(prev, grands) ? prev : grands));
      } catch (err) {
        console.error('Failed to load season/grand list:', err);
      }
    }
    loadMeta();
    return () => { mounted = false; };
  }, []);

  // Fetch ranking data
  const fetchData = useCallback(async (isManual = false) => {
    const cacheKey = selectedTeamId
      ? CACHE_KEYS.RANKINGS('team_drilldown', { teamId: selectedTeamId, period: currentPeriod, search: debouncedSearch, metric: urlMetric })
      : CACHE_KEYS.RANKINGS(scopeMode, { period: currentPeriod, seasonId: urlSeasonId, grandId: urlGrandId, metric: urlMetric, search: debouncedSearch });
    const cachedData = getCached(cacheKey);

    if (cachedData) {
      if (selectedTeamId) {
        if (cachedData.teamMembers) setMemberRankings((prev) => (isDeepEqual(prev, cachedData.teamMembers) ? prev : cachedData.teamMembers));
        if (cachedData.teamChannels) setTeamChannels((prev) => (isDeepEqual(prev, cachedData.teamChannels) ? prev : cachedData.teamChannels));
      } else if (scopeMode === 'teams') {
        setTeamRankings((prev) => (isDeepEqual(prev, cachedData) ? prev : cachedData));
      } else if (scopeMode === 'members') {
        setMemberRankings((prev) => (isDeepEqual(prev, cachedData) ? prev : cachedData));
      } else if (scopeMode === 'youtube') {
        setYoutubeRankings((prev) => (isDeepEqual(prev, cachedData) ? prev : cachedData));
      } else if (scopeMode === 'hall-of-fame') {
        setHallOfFameData((prev) => (isDeepEqual(prev, cachedData) ? prev : cachedData));
      }
      setLoading(false);
      setRefreshing(true);
    } else if (isManual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      if (selectedTeamId) {
        // LEVEL 2: DRILL-DOWN INTO SPECIFIC TEAM
        const numTeamId = Number(selectedTeamId);
        const [teamMembersRes, teamYtRes] = await Promise.all([
          fetchWithCache(
            CACHE_KEYS.RANKINGS('team_members', { teamId: numTeamId, period: currentPeriod, search: debouncedSearch }),
            () => rankingsApi.getIndividuals({
              scope: currentPeriod,
              teamId: numTeamId,
              search: debouncedSearch || undefined,
              limit: 100,
            }),
            { ttl: CACHE_TTL.MEDIUM, force: isManual }
          ),
          fetchWithCache(
            CACHE_KEYS.RANKINGS('team_channels', { teamId: numTeamId, metric: urlMetric }),
            () => youtubeApi.getLeaderboard({
              view: 'channels',
              teamId: numTeamId,
              sortBy: urlMetric,
              limit: 100,
            }).catch(() => ({ items: [] })),
            { ttl: CACHE_TTL.MEDIUM, force: isManual }
          ),
        ]);

        const drilldownData = { teamMembers: teamMembersRes, teamChannels: teamYtRes.items || [] };
        setCached(cacheKey, drilldownData, { ttl: CACHE_TTL.MEDIUM });

        setMemberRankings((prev) => (isDeepEqual(prev, teamMembersRes) ? prev : teamMembersRes));
        setTeamChannels((prev) => (isDeepEqual(prev, teamYtRes.items || []) ? prev : (teamYtRes.items || [])));

        setSelectedTeamDetails((prev) => {
          if (prev && Number(prev.teamId || prev.id) === numTeamId && prev.teamName && !prev.teamName.startsWith('Team #')) {
            return prev;
          }
          const foundName = teamMembersRes.items?.[0]?.teamName;
          return {
            teamId: numTeamId,
            teamName: foundName || prev?.teamName || `Team #${numTeamId}`,
          };
        });
      } else {
        // LEVEL 1: COMPANY / ALL
        if (scopeMode === 'teams') {
          const res = await fetchWithCache(
            cacheKey,
            () => rankingsApi.getTeams({
              scope: currentPeriod,
              seasonId: urlSeasonId || undefined,
              grandId: urlGrandId || undefined,
              limit: 100,
            }),
            { ttl: CACHE_TTL.MEDIUM, force: isManual }
          );
          setTeamRankings((prev) => (isDeepEqual(prev, res) ? prev : res));
        } else if (scopeMode === 'members') {
          const res = await fetchWithCache(
            cacheKey,
            () => rankingsApi.getIndividuals({
              scope: currentPeriod,
              seasonId: urlSeasonId || undefined,
              grandId: urlGrandId || undefined,
              search: debouncedSearch || undefined,
              limit: 100,
            }),
            { ttl: CACHE_TTL.MEDIUM, force: isManual }
          );
          setMemberRankings((prev) => (isDeepEqual(prev, res) ? prev : res));
        } else if (scopeMode === 'youtube') {
          const res = await fetchWithCache(
            cacheKey,
            () => rankingsApi.getYouTube({
              view: 'channels',
              sortBy: urlMetric,
              search: debouncedSearch || undefined,
              limit: 100,
            }),
            { ttl: CACHE_TTL.MEDIUM, force: isManual }
          );
          setYoutubeRankings((prev) => (isDeepEqual(prev, res) ? prev : res));
        } else if (scopeMode === 'hall-of-fame') {
          const res = await fetchWithCache(
            cacheKey,
            () => rankingsApi.getTopPerformers(),
            { ttl: CACHE_TTL.MEDIUM, force: isManual }
          );
          setHallOfFameData((prev) => (isDeepEqual(prev, res) ? prev : res));
        } else if (scopeMode === 'kpi') {
          const [deptsRes, resultsRes] = await Promise.all([
            fetchWithCache(CACHE_KEYS.KPI_DEPARTMENTS(), () => kpiApi.getDepartments(), { ttl: CACHE_TTL.STATIC, force: isManual }),
            fetchWithCache(CACHE_KEYS.KPI_RESULTS(), () => kpiApi.getResults(), { ttl: CACHE_TTL.SHORT, force: isManual }),
          ]);
          const depts = deptsRes?.data || deptsRes || [];
          const resList = resultsRes?.data || resultsRes || [];
          setKpiDepartments(depts);
          setKpiResults(resList);
        }
      }
    } catch (err) {
      console.error('Error fetching rankings:', err);
      setError(err?.response?.data?.message || err?.message || 'Không thể tải dữ liệu bảng xếp hạng');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scopeMode, selectedTeamId, currentPeriod, urlSeasonId, urlGrandId, urlMetric, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Drill-down handlers
  const handleDrillDownTeam = (team) => {
    const tId = team.teamId || team.id;
    setSelectedTeamDetails(team);
    const params = new URLSearchParams(searchParams);
    params.set('teamId', String(tId));
    params.delete('search');
    setSearchKeyword('');
    setSearchParams(params, { replace: true });
  };

  const handleBackToCompany = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('teamId');
    params.delete('groupId');
    params.delete('teamView');
    params.delete('search');
    setSearchKeyword('');
    setSearchParams(params, { replace: true });
  };

  const handleScopeChange = (mode) => {
    const params = new URLSearchParams(searchParams);
    params.set('scope', mode);
    params.delete('mode');
    params.delete('ranking');
    params.delete('teamId');
    params.delete('groupId');
    params.delete('search');
    if (mode === 'members') {
      params.set('period', 'all-time');
    } else if (mode === 'teams') {
      params.set('period', 'season');
    } else if (mode === 'youtube') {
      params.set('metric', 'views');
      params.delete('period');
    } else if (mode === 'hall-of-fame') {
      params.delete('period');
      params.delete('metric');
    }
    setSearchKeyword('');
    setSearchParams(params, { replace: true });
  };

  const handlePeriodChange = (period) => {
    const params = new URLSearchParams(searchParams);
    params.set('period', period);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="leaderboard-page" style={{ maxWidth: 1160, margin: '0 auto', padding: '16px 16px 48px', fontFamily: "'JetBrains Mono', monospace" }}>
      {/* ── HEADER BANNER ── */}
      <div
        style={{
          ...CARD,
          padding: '20px 24px',
          marginBottom: 16,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
            <span
              onClick={handleBackToCompany}
              style={{ color: '#cbd5e1', cursor: selectedTeamId ? 'pointer' : 'default', textDecoration: selectedTeamId ? 'underline' : 'none' }}
            >
              Công Ty (Tất cả)
            </span>
            {selectedTeamId && (
              <>
                <ChevronRight size={13} color="#64748b" />
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>{selectedTeamDetails?.teamName || `Team #${selectedTeamId}`}</span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Trophy size={22} color="#b45309" />
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#ffffff', lineHeight: 1.25 }}>
              {selectedTeamId ? `Xếp Hạng Nội Bộ · ${selectedTeamDetails?.teamName}` : 'Bảng Xếp Hạng Toàn Công Ty'}
            </h1>
            <span style={{ background: 'rgba(180,83,9,0.2)', color: '#b45309', fontSize: 10, fontWeight: 700, padding: '2px 8px', textTransform: 'uppercase' }}>
              Canonical V3.3
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
            {selectedTeamId
              ? 'Phân cấp Đội Nhóm: Theo dõi thành viên thi đấu và danh sách kênh YouTube thuộc đội.'
              : 'Xếp hạng phân cấp: Cấp 1 Công ty → Cấp 2 Đội nhóm → Cấp 3 Cá nhân & Kênh YouTube.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selectedTeamId && (
            <button
              onClick={handleBackToCompany}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.25)',
                padding: '7px 14px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={13} /> Quay lại Toàn Công Ty
            </button>
          )}

          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255,255,255,0.1)',
              color: '#f8fafc',
              border: '1px solid rgba(255,255,255,0.18)',
              padding: '7px 14px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              cursor: refreshing ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>
      </div>

      {/* ── TOP CONTROLS: HIERARCHY SELECTOR & PRESERVED PERIOD IN SINGLE UNIFIED TOOLBAR ── */}
      {!selectedTeamId ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px 10px',
            marginBottom: 16,
            background: '#ffffff',
            border: '1px solid rgba(15,23,42,0.08)',
            padding: '5px 6px',
            borderRadius: 6,
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            transition: 'background-color 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* LEVEL 1: VIEW MODES (LEFT SIDE) */}
          <div
            style={{
              display: 'flex',
              gap: 2,
              alignItems: 'center',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
              flex: '1 1 auto',
              minWidth: 0,
            }}
          >
            {[
              { id: 'kpi', label: 'BXH KPI', icon: Target },
              { id: 'teams', label: 'BXH Đội Nhóm', icon: Users },
              { id: 'members', label: 'BXH Thành Viên', icon: User },
              { id: 'youtube', label: 'BXH Kênh YouTube', icon: Tv },
              { id: 'hall-of-fame', label: 'Bảng Vinh Danh', icon: Award },
            ].map((tab) => {
              const isActive = scopeMode === tab.id;
              const IconComp = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleScopeChange(tab.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '7px 11px',
                    borderRadius: 4,
                    border: 'none',
                    background: isActive
                      ? (tab.id === 'youtube' ? '#dc2626' : '#b45309')
                      : 'transparent',
                    color: isActive ? '#ffffff' : '#64748b',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'background-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard), box-shadow var(--motion-fast) var(--ease-standard)',
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'rgba(15,23,42,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <IconComp size={13} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* RIGHT SIDE: GLOBAL PRESERVED PERIOD & METRICS SELECTOR & SEARCH */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginLeft: 'auto',
              flexShrink: 0,
              flexWrap: 'nowrap',
              transition: 'opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {scopeMode !== 'youtube' && scopeMode !== 'hall-of-fame' && (
              <div style={{ display: 'flex', gap: 2, background: 'rgba(15,23,42,0.04)', padding: 2, borderRadius: 4, border: '1px solid rgba(15,23,42,0.06)' }}>
                {[
                  { id: 'season', label: 'Mùa Giải' },
                  { id: 'grand', label: 'Vô Địch Năm (Grand)' },
                  { id: 'all-time', label: 'Toàn Thời Gian' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePeriodChange(p.id)}
                    style={{
                      border: 'none',
                      background: currentPeriod === p.id ? '#b45309' : 'transparent',
                      color: currentPeriod === p.id ? '#ffffff' : '#64748b',
                      padding: '5px 9px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      borderRadius: 3,
                      whiteSpace: 'nowrap',
                      transition: 'background-color 0.18s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.18s cubic-bezier(0.16, 1, 0.3, 1), color 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            {scopeMode === 'youtube' && (
              <div style={{ display: 'flex', gap: 2, background: 'rgba(15,23,42,0.04)', padding: 2, borderRadius: 4, border: '1px solid rgba(15,23,42,0.06)' }}>
                {[
                  { id: 'views', label: 'Lượt Xem' },
                  { id: 'subscribers', label: 'Subscribers' },
                  { id: 'growth', label: 'Tăng Trưởng' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setParam('metric', m.id)}
                    style={{
                      border: 'none',
                      background: urlMetric === m.id ? '#dc2626' : 'transparent',
                      color: urlMetric === m.id ? '#ffffff' : '#64748b',
                      padding: '5px 9px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      borderRadius: 3,
                      whiteSpace: 'nowrap',
                      transition: 'background-color 0.18s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.18s cubic-bezier(0.16, 1, 0.3, 1), color 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}

            {/* INSTANT SEARCH */}
            {(scopeMode === 'members' || scopeMode === 'youtube') && (
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder={scopeMode === 'youtube' ? 'Tìm kênh...' : 'Tìm thành viên...'}
                  style={{
                    background: '#ffffff',
                    border: '1px solid rgba(15,23,42,0.12)',
                    padding: '5px 8px 5px 24px',
                    fontSize: 11.5,
                    outline: 'none',
                    width: 130,
                    borderRadius: 3,
                    transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s ease',
                  }}
                  onFocus={(e) => { e.currentTarget.style.width = '170px'; e.currentTarget.style.borderColor = '#b45309'; }}
                  onBlur={(e) => { if (!searchKeyword) e.currentTarget.style.width = '130px'; e.currentTarget.style.borderColor = 'rgba(15,23,42,0.12)'; }}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* LEVEL 2: TEAM SCOPE HEADER & SUB-TABS (SINGLE UNIFIED TOOLBAR) */
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px 10px',
            marginBottom: 16,
            background: '#ffffff',
            border: '1px solid rgba(15,23,42,0.08)',
            padding: '5px 6px',
            borderRadius: 6,
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            transition: 'background-color 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <button
              onClick={() => setParam('teamView', 'members')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 12px',
                borderRadius: 4,
                border: 'none',
                background: teamSubView === 'members' ? '#b45309' : 'transparent',
                color: teamSubView === 'members' ? '#ffffff' : '#64748b',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: teamSubView === 'members' ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              <Users size={13} />
              <span>Thành Viên Trong Đội ({memberRankings.items?.length || 0})</span>
            </button>
            <button
              onClick={() => setParam('teamView', 'youtube')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 12px',
                borderRadius: 4,
                border: 'none',
                background: teamSubView === 'youtube' ? '#dc2626' : 'transparent',
                color: teamSubView === 'youtube' ? '#ffffff' : '#64748b',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: teamSubView === 'youtube' ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              <Tv size={13} />
              <span>Kênh YouTube Của Đội ({teamChannels.length})</span>
            </button>
          </div>

          {/* Period selector inside team view (Right aligned) */}
          {teamSubView === 'members' && (
            <div style={{ display: 'flex', gap: 2, background: 'rgba(15,23,42,0.04)', padding: 2, borderRadius: 4, border: '1px solid rgba(15,23,42,0.06)', marginLeft: 'auto' }}>
              {[
                { id: 'season', label: 'Mùa Giải' },
                { id: 'grand', label: 'Grand' },
                { id: 'all-time', label: 'Toàn Thời Gian' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePeriodChange(p.id)}
                  style={{
                    border: 'none',
                    background: currentPeriod === p.id ? '#b45309' : 'transparent',
                    color: currentPeriod === p.id ? '#ffffff' : '#64748b',
                    padding: '5px 9px',
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    borderRadius: 3,
                    whiteSpace: 'nowrap',
                    transition: 'background-color 0.18s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.18s cubic-bezier(0.16, 1, 0.3, 1), color 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BODY CONTENT ── */}
      {loading ? (
        <TableSkeleton rows={8} cols={5} minHeight={420} />
      ) : error ? (
        <div style={{ ...CARD, padding: '40px 20px', textAlign: 'center' }}>
          <AlertCircle size={32} color="#dc2626" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{error}</div>
          <button
            onClick={() => fetchData()}
            style={{ marginTop: 12, background: '#0f172a', color: '#fff', border: 'none', padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 4 }}
          >
            Thử lại
          </button>
        </div>
      ) : (
        <TabTransition key={`${scopeMode}-${selectedTeamId}-${teamSubView}-${currentPeriod}`} minHeight={400}>
          {/* =========================================================================
           * LEVEL 2: TEAM DRILL-DOWN VIEW
           * ========================================================================= */}
          {selectedTeamId ? (
            <div>
              {teamSubView === 'members' ? (
                <div>
                  <MyRankBanner
                    currentUser={currentUser}
                    items={memberRankings.items || []}
                    scoreKey="score"
                    scoreSuffix="XP"
                    serverRank={memberRankings.currentUserRank}
                    onOpenProfile={(u) => navigate(`/users/${u.id || u.userId}`)}
                  />

                  {memberRankings.items?.length >= 1 && !searchKeyword && (
                    <DynamicPodium
                      items={memberRankings.items}
                      nameKey="userName"
                      scoreKey="score"
                      scoreSuffix="XP"
                      onSelect={(u) => navigate(`/users/${u.userId || u.id}`)}
                    />
                  )}

                  {/* Members Table */}
                  <div style={{ ...CARD, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(15,23,42,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                        Thành Viên Thuộc Đội ({memberRankings.items?.length || 0} người)
                      </span>
                    </div>
                    <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: 'rgba(15,23,42,0.02)' }}>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Hạng</th>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Thành Viên</th>
                          <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Cấp Độ</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Điểm Tích Lũy</th>
                        </tr>
                      </thead>
                      <FlipTableBody resetKey={`drilldown:${selectedTeamDetails?.teamId || ''}`}>
                        {memberRankings.items?.length === 0 ? (
                          <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Đội này chưa có thành viên tham gia thi đấu</td></tr>
                        ) : (
                          memberRankings.items.map((m, idx) => {
                            const rank = m.rank || idx + 1;
                            const isMe = Number(m.userId || m.id) === Number(currentUser?.id);
                            return (
                              <tr
                                key={m.userId || m.id || idx}
                                data-flip-id={m.userId || m.id}
                                className="ranking-flip-row"
                                onClick={() => navigate(`/users/${m.userId || m.id}`)}
                                style={{
                                  borderBottom: '1px solid rgba(15,23,42,0.04)',
                                  background: isMe ? 'rgba(180,83,9,0.06)' : 'transparent',
                                  cursor: 'pointer',
                                }}
                              >
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{ width: 24, height: 24, background: rank === 1 ? '#f59e0b' : rank === 2 ? '#64748b' : rank === 3 ? '#b45309' : 'rgba(15,23,42,0.06)', color: rank <= 3 ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, borderRadius: 4 }}>
                                    {rank}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <AvatarBox user={m} name={m.userName} userId={m.userId || m.id} size={30} idx={rank - 1} />
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{m.userName}</span>
                                        {m.jobTitle && <JobTitleBadge jobTitle={m.jobTitle} size="xs" />}
                                        {isMe && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', background: '#b45309', color: '#fff', borderRadius: 2 }}>BẠN</span>}
                                      </div>
                                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{m.userEmail}</div>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                  <LevelText user={m} />
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: '#b45309', fontFamily: "'JetBrains Mono',monospace" }}>
                                    <AnimatedNumber value={m.score ?? m.points ?? m.totalScore ?? 0} duration={700} formatFn={fmtNum} />
                                  </span>
                                  <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 3 }}>XP</span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </FlipTableBody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Team YouTube Channels */
                <div style={{ ...CARD, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(15,23,42,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      Kênh YouTube Thuộc Quyền Sở Hữu ({teamChannels.length} kênh)
                    </span>
                  </div>
                  <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: 'rgba(15,23,42,0.02)' }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Hạng</th>
                        <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Kênh YouTube</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Lượt Xem</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Subscribers</th>
                      </tr>
                    </thead>
                    <FlipTableBody resetKey={`drilldown-yt:${selectedTeamDetails?.teamId || ''}`}>
                      {teamChannels.length === 0 ? (
                        <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Đội này chưa liên kết kênh YouTube nào</td></tr>
                      ) : (
                        teamChannels.map((c, idx) => (
                          <tr
                            key={c.id || c.channelId || idx}
                            data-flip-id={c.id || c.channelId}
                            className="ranking-flip-row"
                            style={{ borderBottom: '1px solid rgba(15,23,42,0.04)' }}
                          >
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ width: 24, height: 24, background: idx === 0 ? '#dc2626' : 'rgba(15,23,42,0.06)', color: idx === 0 ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, borderRadius: 4 }}>
                                {idx + 1}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                  {c.thumbnailUrl ? <img src={c.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Tv size={16} />}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{c.title}</div>
                                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{c.customUrl || c.channelId}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', fontFamily: "'JetBrains Mono',monospace" }}>
                                <AnimatedNumber value={c.views || 0} duration={700} formatFn={fmtNum} />
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                              {fmtNum(c.subscribers)}
                            </td>
                          </tr>
                        ))
                      )}
                    </FlipTableBody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* =========================================================================
             * LEVEL 1: COMPANY / ALL SCOPES
             * ========================================================================= */
            <div>
              {/* 0. BXH KPI THEO PHÒNG BAN */}
              {scopeMode === 'kpi' && (
                <div className="leaderboard-kpi-view">
                  <div className="leaderboard-kpi-intro">
                    <div>
                      <div className="leaderboard-kpi-kicker"><Target size={15} /> Theo dõi tiến độ KPI</div>
                      <h2>Bảng xếp hạng hiệu suất KPI</h2>
                      <p>So sánh tiến độ hoàn thành chỉ tiêu theo từng phòng ban trong kỳ hiện tại.</p>
                    </div>
                    <div className="leaderboard-kpi-summary" aria-label="Tổng quan KPI">
                      <div><strong>{kpiUserLeaderboard.length}</strong><span>thành viên</span></div>
                      <div><strong>{kpiUserLeaderboard.length ? Math.round(kpiUserLeaderboard.reduce((sum, item) => sum + item.avgProgress, 0) / kpiUserLeaderboard.length) : 0}%</strong><span>tiến độ TB</span></div>
                    </div>
                  </div>

                  {kpiDepartments.length > 0 && (
                    <div className="leaderboard-kpi-departments" role="tablist" aria-label="Chọn phòng ban">
                      {kpiDepartments.map((department) => (
                        <button
                          key={department.id || department.code}
                          type="button"
                          role="tab"
                          aria-selected={filteredKpiDepartment?.id === department.id}
                          className={filteredKpiDepartment?.id === department.id ? 'is-active' : ''}
                          onClick={() => setSelectedKpiDeptCode(department.code)}
                        >
                          {department.name || department.code}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="leaderboard-kpi-table-card">
                    <div className="leaderboard-kpi-table-head">
                      <div>
                        <strong>{filteredKpiDepartment?.name || 'Tất cả phòng ban'}</strong>
                        <span>{kpiUserLeaderboard.length ? `${kpiUserLeaderboard.length} thành viên có dữ liệu KPI` : 'Chưa có dữ liệu trong kỳ này'}</span>
                      </div>
                      <span className="leaderboard-kpi-period">Kỳ hiện tại</span>
                    </div>
                    {kpiUserLeaderboard.length === 0 ? (
                      <div className="leaderboard-kpi-empty">
                        <Target size={28} />
                        <strong>Chưa có dữ liệu KPI</strong>
                        <span>Hãy kiểm tra lại phòng ban hoặc kỳ giao chỉ tiêu.</span>
                      </div>
                    ) : (
                      <div className="leaderboard-table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Hạng</th>
                              <th>Thành viên</th>
                              <th>Đội nhóm</th>
                              <th>Tiến độ KPI</th>
                              <th>Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody>
                            {kpiUserLeaderboard.map((item, index) => {
                              const progress = Math.min(100, Math.max(0, Number(item.avgProgress || 0)));
                              const completed = progress >= 100;
                              return (
                                <tr
                                  key={item.user?.id || index}
                                  tabIndex={0}
                                  onClick={() => item.user?.id && navigate(`/users/${item.user.id}`)}
                                  onKeyDown={(event) => {
                                    if ((event.key === 'Enter' || event.key === ' ') && item.user?.id) {
                                      event.preventDefault();
                                      navigate(`/users/${item.user.id}`);
                                    }
                                  }}
                                >
                                  <td><span className={`leaderboard-kpi-rank rank-${Math.min(index + 1, 3)}`}>{index + 1}</span></td>
                                  <td>
                                    <div className="leaderboard-kpi-member">
                                      <AvatarBox user={item.user} name={item.user?.name} userId={item.user?.id} size={34} idx={index} />
                                      <span><strong>{item.user?.name || 'Chưa đặt tên'}</strong><small>{item.user?.email || '—'}</small></span>
                                    </div>
                                  </td>
                                  <td>{item.user?.team?.name || item.user?.teamName || 'Chưa gia nhập đội'}</td>
                                  <td>
                                    <div className="leaderboard-kpi-progress">
                                      <div><span style={{ width: `${progress}%` }} /></div>
                                      <strong>{progress}%</strong>
                                    </div>
                                  </td>
                                  <td><span className={`leaderboard-kpi-status ${completed ? 'is-complete' : ''}`}>{completed ? 'Đã đạt' : 'Đang thực hiện'}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 1. BXH ĐỘI NHÓM */}
              {scopeMode === 'teams' && (
                <div>
                  <MyRankBanner
                    currentUser={currentUser}
                    items={teamRankings.items || []}
                    scoreKey={currentPeriod === 'grand' ? 'grandPoints' : 'totalScore'}
                    scoreSuffix={currentPeriod === 'grand' ? 'GP' : 'pts'}
                    serverRank={teamRankings.currentUserTeamRank}
                    isTeam
                  />

                  {teamRankings.items?.length >= 1 && (
                    <DynamicPodium
                      items={teamRankings.items}
                      nameKey="teamName"
                      scoreKey={currentPeriod === 'grand' ? 'grandPoints' : 'totalScore'}
                      scoreSuffix={currentPeriod === 'grand' ? 'GP' : 'pts'}
                      onSelect={handleDrillDownTeam}
                    />
                  )}

                  <div style={{ ...CARD, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(15,23,42,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                        Danh Sách Thứ Hạng Đội Nhóm ({teamRankings.items?.length || 0} đội)
                      </span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>Click vào đội để xem thành viên & kênh</span>
                    </div>
                    <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: 'rgba(15,23,42,0.02)' }}>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Hạng</th>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Tên Đội</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Điểm Thi Đấu</th>
                          <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Thành Viên</th>
                          <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Mùa Vô Địch</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Hành Động</th>
                        </tr>
                      </thead>
                      <FlipTableBody resetKey={`teams:${currentPeriod}:${searchKeyword}`}>
                        {teamRankings.items?.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ padding: 48, textAlign: 'center' }}>
                              <Users size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
                              <div style={{ fontWeight: 600, color: '#334155', fontSize: 14 }}>
                                Chưa có dữ liệu xếp hạng đội nhóm trong chu kỳ này
                              </div>
                              {currentPeriod !== 'all-time' && (
                                <button
                                  onClick={() => handlePeriodChange('all-time')}
                                  style={{ marginTop: 12, background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#b45309', fontWeight: 600, padding: '6px 14px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
                                >
                                  Xem Toàn Thời Gian
                                </button>
                              )}
                            </td>
                          </tr>
                        ) : (
                          teamRankings.items.map((row, idx) => {
                            const rank = row.rank || idx + 1;
                            const isMyTeam = Number(row.teamId) === Number(currentUser?.teamId);
                            const scoreVal = row[currentPeriod === 'grand' ? 'grandPoints' : 'totalScore'] ?? row.score ?? 0;
                            return (
                              <tr
                                key={row.teamId || idx}
                                data-flip-id={row.teamId}
                                className="ranking-flip-row"
                                onClick={() => handleDrillDownTeam(row)}
                                style={{
                                  borderBottom: '1px solid rgba(15,23,42,0.04)',
                                  background: isMyTeam ? 'rgba(180,83,9,0.06)' : 'transparent',
                                  cursor: 'pointer',
                                }}
                              >
                                <td style={{ padding: '12px 16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 24, height: 24, background: rank === 1 ? '#f59e0b' : rank === 2 ? '#64748b' : rank === 3 ? '#b45309' : 'rgba(15,23,42,0.06)', color: rank <= 3 ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, borderRadius: 4 }}>
                                      {rank}
                                    </span>
                                    <TrendIndicator trend={row.trend} />
                                  </div>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
                                    {row.teamName}
                                    {isMyTeam && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, padding: '1px 5px', background: '#b45309', color: '#fff', borderRadius: 2 }}>ĐỘI BẠN</span>}
                                  </div>
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: '#b45309', fontFamily: "'JetBrains Mono',monospace" }}>
                                    <AnimatedNumber value={scoreVal} duration={700} formatFn={fmtNum} />
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b' }}>
                                  {row.activeMembersCount || '—'}
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                  {(row.seasonsWon || 0) > 0 ? (
                                    <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 6px', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 4 }}>
                                      <Trophy size={11} color="#b45309" /> {row.seasonsWon}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#cbd5e1' }}>—</span>
                                  )}
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                  <span style={{ fontSize: 11, color: '#b45309', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                    Chi tiết <ChevronRight size={13} />
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </FlipTableBody>
                    </table>
                  </div>
                </div>
              )}

              {/* 2. BXH THÀNH VIÊN */}
              {scopeMode === 'members' && (
                <div>
                  <MyRankBanner
                    currentUser={currentUser}
                    items={memberRankings.items || []}
                    scoreKey={currentPeriod === 'all-time' ? 'lifetimeScore' : 'score'}
                    scoreSuffix="XP"
                    serverRank={memberRankings.currentUserRank}
                    onOpenProfile={(u) => navigate(`/users/${u.id || u.userId}`)}
                  />

                  {memberRankings.items?.length >= 1 && !searchKeyword && (
                    <DynamicPodium
                      items={memberRankings.items}
                      nameKey="userName"
                      scoreKey={currentPeriod === 'all-time' ? 'lifetimeScore' : 'score'}
                      scoreSuffix="XP"
                      onSelect={(u) => navigate(`/users/${u.userId || u.id}`)}
                    />
                  )}

                  <div style={{ ...CARD, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(15,23,42,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                        Toàn Bộ Thành Viên ({memberRankings.items?.length || 0} người)
                      </span>
                    </div>
                    <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: 'rgba(15,23,42,0.02)' }}>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Hạng</th>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Thành Viên</th>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Đội Nhóm</th>
                          <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Cấp Độ</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Điểm XP</th>
                        </tr>
                      </thead>
                      <FlipTableBody resetKey={`members:${currentPeriod}:${searchKeyword}`}>
                        {memberRankings.items?.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ padding: 48, textAlign: 'center' }}>
                              <User size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
                              <div style={{ fontWeight: 600, color: '#334155', fontSize: 14 }}>
                                {searchKeyword ? `Không tìm thấy thành viên phù hợp với "${searchKeyword}"` : 'Chưa có dữ liệu thành viên trong chu kỳ này'}
                              </div>
                              {searchKeyword ? (
                                <button
                                  onClick={() => setSearchKeyword('')}
                                  style={{ marginTop: 12, background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', padding: '6px 14px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
                                >
                                  Xóa tìm kiếm
                                </button>
                              ) : currentPeriod !== 'all-time' && (
                                <button
                                  onClick={() => handlePeriodChange('all-time')}
                                  style={{ marginTop: 12, background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#b45309', fontWeight: 600, padding: '6px 14px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
                                >
                                  Xem Toàn Thời Gian
                                </button>
                              )}
                            </td>
                          </tr>
                        ) : (
                          memberRankings.items.map((u, i) => {
                            const rank = u.rank || i + 1;
                            const isMe = currentUser && (Number(u.userId || u.id) === Number(currentUser.id) || u.userName === currentUser.name);
                            const scoreVal = u[currentPeriod === 'all-time' ? 'lifetimeScore' : 'score'] ?? 0;
                            return (
                              <tr
                                key={u.userId || u.id || i}
                                data-flip-id={u.userId || u.id}
                                className="ranking-flip-row"
                                onClick={() => navigate(`/users/${u.userId || u.id}`)}
                                style={{
                                  borderBottom: '1px solid rgba(15,23,42,0.04)',
                                  background: isMe ? 'rgba(180,83,9,0.06)' : 'transparent',
                                  cursor: 'pointer',
                                }}
                              >
                                <td style={{ padding: '12px 16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 24, height: 24, background: rank === 1 ? '#f59e0b' : rank === 2 ? '#64748b' : rank === 3 ? '#b45309' : 'rgba(15,23,42,0.06)', color: rank <= 3 ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, borderRadius: 4 }}>
                                      {rank}
                                    </span>
                                    <TrendIndicator trend={u.trend} />
                                  </div>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <AvatarBox user={u} name={u.userName} userId={u.userId || u.id} size={30} idx={rank - 1} />
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{u.userName}</span>
                                        {u.jobTitle && <JobTitleBadge jobTitle={u.jobTitle} size="xs" />}
                                        {isMe && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', background: '#b45309', color: '#fff', borderRadius: 2 }}>BẠN</span>}
                                      </div>
                                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{u.userEmail}</div>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '12px 16px', color: '#64748b', fontWeight: 500 }}>
                                  {u.teamName ? (
                                    <span
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (u.teamId) handleDrillDownTeam({ teamId: u.teamId, name: u.teamName });
                                      }}
                                      style={{
                                        cursor: u.teamId ? 'pointer' : 'default',
                                        color: u.teamId ? '#0f172a' : '#64748b',
                                        textDecoration: u.teamId ? 'underline' : 'none',
                                      }}
                                    >
                                      {u.teamName}
                                    </span>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                  <LevelText user={u} />
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', fontFamily: "'JetBrains Mono',monospace" }}>
                                    <AnimatedNumber value={scoreVal} duration={700} formatFn={fmtNum} />
                                  </span>
                                  <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 3 }}>XP</span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </FlipTableBody>
                    </table>
                  </div>
                </div>
              )}

              {/* 3. BXH KÊNH YOUTUBE (CÔNG TY - BAO GỒM CẢ CHƯA GÁN TEAM) */}
              {scopeMode === 'youtube' && (
                <div>
                  {youtubeRankings.items?.length >= 1 && !searchKeyword && (
                    <DynamicPodium
                      items={youtubeRankings.items}
                      nameKey="title"
                      scoreKey={urlMetric === 'subscribers' ? 'subscribers' : (urlMetric === 'growth' ? 'viewsGrowth30dPct' : 'views')}
                      scoreSuffix={urlMetric === 'subscribers' ? 'subs' : (urlMetric === 'growth' ? '%' : 'views')}
                      isYouTube
                    />
                  )}

                  <div style={{ ...CARD, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(15,23,42,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                        Toàn Bộ Kênh YouTube ({youtubeRankings.items?.length || 0} kênh)
                      </span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>Bao gồm tất cả kênh có team & kênh chưa gán team</span>
                    </div>
                    <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: 'rgba(15,23,42,0.02)' }}>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Hạng</th>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Kênh YouTube</th>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Đội Sở Hữu</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Lượt Xem</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Subscribers</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Tăng Trưởng (30D)</th>
                        </tr>
                      </thead>
                      <FlipTableBody resetKey={`youtube:${urlMetric}:${searchKeyword}`}>
                        {youtubeRankings.items?.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ padding: 48, textAlign: 'center' }}>
                              <Tv size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
                              <div style={{ fontWeight: 600, color: '#334155', fontSize: 14 }}>
                                {searchKeyword ? `Không tìm thấy kênh YouTube phù hợp với "${searchKeyword}"` : 'Chưa có dữ liệu kênh YouTube'}
                              </div>
                              {searchKeyword && (
                                <button
                                  onClick={() => setSearchKeyword('')}
                                  style={{ marginTop: 12, background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', padding: '6px 14px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
                                >
                                  Xóa tìm kiếm
                                </button>
                              )}
                            </td>
                          </tr>
                        ) : (
                          youtubeRankings.items.map((c, idx) => {
                            const rank = c.rank || idx + 1;
                            return (
                              <tr
                                key={c.id || c.channelId || idx}
                                data-flip-id={c.id || c.channelId}
                                className="ranking-flip-row"
                                style={{ borderBottom: '1px solid rgba(15,23,42,0.04)' }}
                              >
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{ width: 24, height: 24, background: rank === 1 ? '#dc2626' : rank === 2 ? '#64748b' : rank === 3 ? '#b45309' : 'rgba(15,23,42,0.06)', color: rank <= 3 ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, borderRadius: 4 }}>
                                    {rank}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                      {c.thumbnailUrl ? <img src={c.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Tv size={16} />}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{c.title}</div>
                                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{c.customUrl || c.channelId}</div>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  {c.isUnassigned || !c.teamId ? (
                                    <span style={{ padding: '2px 6px', fontSize: 10, fontWeight: 600, background: '#f1f5f9', color: '#64748b', borderRadius: 4 }}>
                                      Chưa gán đội
                                    </span>
                                  ) : (
                                    <span
                                      onClick={() => handleDrillDownTeam({ teamId: c.teamId, name: c.teamName })}
                                      style={{ fontWeight: 600, color: '#0f172a', cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                      {c.teamName}
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', fontFamily: "'JetBrains Mono',monospace" }}>
                                    <AnimatedNumber value={c.views || 0} duration={700} formatFn={fmtNum} />
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                                  {fmtNum(c.subscribers)}
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                  {c.viewsGrowth30dPct !== null && c.viewsGrowth30dPct !== undefined ? (
                                    <span style={{
                                      padding: '2px 6px',
                                      fontSize: 11,
                                      fontWeight: 600,
                                      borderRadius: 4,
                                      background: Number(c.viewsGrowth30dPct) >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(220,38,38,0.12)',
                                      color: Number(c.viewsGrowth30dPct) >= 0 ? '#16a34a' : '#dc2626',
                                    }}>
                                      {Number(c.viewsGrowth30dPct) >= 0 ? '+' : ''}{Number(c.viewsGrowth30dPct).toFixed(1)}%
                                    </span>
                                  ) : (
                                    <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500 }}>
                                      —
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </FlipTableBody>
                    </table>
                  </div>
                </div>
              )}

              {/* 4. BẢNG VINH DANH */}
              {scopeMode === 'hall-of-fame' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* MVPs */}
                  <div style={{ ...CARD, padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <Sparkles size={18} color="#f59e0b" />
                      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                        Ngôi Đền Danh Vọng — MVPs
                      </h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                      {hallOfFameData.seasonMvps?.length > 0 ? (
                        hallOfFameData.seasonMvps.map((mvp, i) => (
                          <div
                            key={mvp.userId || i}
                            onClick={() => navigate(`/users/${mvp.userId}`)}
                            style={{
                              padding: '12px 14px',
                              border: '1px solid rgba(245,158,11,0.25)',
                              background: 'rgba(254,243,199,0.25)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              borderRadius: 4,
                            }}
                          >
                            <div style={{ width: 36, height: 36, background: '#f59e0b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}>
                              <Crown size={18} color="#fff" />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{mvp.userName}</div>
                              <div style={{ fontSize: 10, color: '#64748b' }}>{mvp.teamName || 'Thành viên'}</div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: '#b45309', marginTop: 2 }}>
                                {mvp.mvpCount} Lần MVP · {fmtNum(mvp.lifetimeScore)} XP
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ color: '#94a3b8', fontSize: 12, padding: 16 }}>Chưa có danh hiệu MVP nào</div>
                      )}
                    </div>
                  </div>

                  {/* CHAMPIONS */}
                  <div style={{ ...CARD, padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <Trophy size={18} color="#b45309" />
                      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                        Đội Vô Địch Mùa Giải
                      </h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                      {hallOfFameData.championTeams?.length > 0 ? (
                        hallOfFameData.championTeams.map((t, i) => (
                          <div
                            key={t.teamId || i}
                            onClick={() => handleDrillDownTeam(t)}
                            style={{
                              padding: '12px 14px',
                              border: '1px solid rgba(180,83,9,0.2)',
                              background: 'rgba(180,83,9,0.04)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              cursor: 'pointer',
                              borderRadius: 4,
                            }}
                          >
                            <div style={{ width: 36, height: 36, background: '#b45309', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}>
                              <Trophy size={18} color="#fff" />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{t.teamName}</div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: '#b45309', marginTop: 2 }}>
                                {t.seasonsWon} Mùa Vô Địch · {fmtNum(t.grandPoints)} GP
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ color: '#94a3b8', fontSize: 12, padding: 16 }}>Chưa có đội nào vô địch</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabTransition>
      )}
    </div>
  );
}
