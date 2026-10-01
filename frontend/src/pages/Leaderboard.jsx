import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { rankings as rankingsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getUserAvatar, initialsFromName } from '../utils/avatar';
import {
  Trophy,
  Users,
  User,
  Swords,
  Crown,
  Tv,
  Award,
  Medal,
  Sparkles,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  Eye,
  Calendar,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Code2,
  CheckCheck,
  BadgeCheck,
  AlertCircle,
  Flame,
} from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';
import JobTitleBadge from '../components/JobTitleBadge';
import { TabTransition, TableSkeleton, CardSkeleton } from '../components/ui';

/* =========================================================================
 * STYLES & THEME CONSTANTS (Kế thừa trọn vẹn visual design hệ thống cũ)
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

const BADGE_STYLES = {
  dev: {
    bg: 'rgba(0,0,0,0.05)',
    border: 'rgba(0,0,0,0.14)',
    color: '#111111',
    icon: Code2,
  },
  partner: { bg: 'rgba(21,128,61,0.08)', border: 'rgba(21,128,61,0.25)', color: '#15803d', icon: ShieldCheck },
  champion: { bg: 'rgba(180,83,9,0.08)', border: 'rgba(180,83,9,0.25)', color: '#b45309', icon: Crown },
  weekly: { bg: 'rgba(0,0,0,0.05)', border: 'rgba(0,0,0,0.12)', color: '#111111', icon: Medal },
  monthly: { bg: 'rgba(180,83,9,0.08)', border: 'rgba(180,83,9,0.25)', color: '#b45309', icon: Sparkles },
  rankLegend: { bg: 'rgba(180,83,9,0.1)', border: 'rgba(180,83,9,0.3)', color: '#b45309', icon: Crown },
  rankDiamond: { bg: 'rgba(0,0,0,0.05)', border: 'rgba(0,0,0,0.15)', color: '#111111', icon: Sparkles },
  rankGold: { bg: 'rgba(180,83,9,0.08)', border: 'rgba(180,83,9,0.25)', color: '#b45309', icon: Medal },
  rankSilver: { bg: 'rgba(0,0,0,0.05)', border: 'rgba(0,0,0,0.12)', color: '#555555', icon: ShieldCheck },
  rankBronze: { bg: 'rgba(180,83,9,0.06)', border: 'rgba(180,83,9,0.18)', color: '#92400e', icon: BadgeCheck },
  streak: { bg: 'rgba(21,128,61,0.08)', border: 'rgba(21,128,61,0.24)', color: '#15803d', icon: CheckCheck },
};

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
    <span style={{
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
    }}>
      Lv.{level}
    </span>
  );
}

function AvatarBox({ user, userId, name, size = 36, idx = 0 }) {
  const avatarUrl = getUserAvatar(user || { id: userId }, userId);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: AVATAR_GRADS[idx % AVATAR_GRADS.length],
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.max(10, Math.floor(size * 0.35)), fontWeight: 600, color: '#fff',
        letterSpacing: 0, overflow: 'hidden',
      }}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={name || 'Avatar'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : initialsFromName(name || `User #${userId || idx}`)}
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

const TABS = [
  { id: 'overview',       label: 'Tổng Quan',           icon: Trophy,    badge: null },
  { id: 'team',           label: 'BXH Đội Nhóm',        icon: Users,     badge: 'Đội' },
  { id: 'individual',     label: 'BXH Cá Nhân',         icon: User,      badge: 'Cá nhân' },
  { id: 'season',         label: 'BXH Mùa Giải',        icon: Swords,    badge: 'Mùa giải' },
  { id: 'grand',          label: 'BXH Vô Địch Năm',     icon: Crown,     badge: 'Vô địch' },
  { id: 'youtube',        label: 'BXH YouTube',         icon: Tv,        badge: 'Kênh' },
  { id: 'hall-of-fame',   label: 'Bảng Vinh Danh',      icon: Award,     badge: 'Vinh danh' },
];

/* =========================================================================
 * KHỐI PODIUM 2 CỘT CHUẨN ĐẸP (Bục Top 3 + Top 4-8 Runner-Ups)
 * ========================================================================= */

function PodiumTwoColumns({ items = [], nameKey = 'name', scoreKey = 'score', scoreSuffix = 'pts', onNavigateUser }) {
  if (!items || items.length === 0) return null;

  const top1 = items[0];
  const top2 = items[1];
  const top3 = items[2];
  const runnerUps = items.slice(3, 8);

  return (
    <div
      className="leaderboard-podium"
      style={{
        ...CARD,
        padding: '24px 20px',
        marginBottom: 20,
        display: 'grid',
        gridTemplateColumns: items.length > 3 ? '1.1fr 0.9fr' : '1fr',
        gap: 20,
        alignItems: 'end',
      }}
    >
      {/* CỘT TRÁI: BỤC 3 VỊ TRÍ (2 - 1 - 3) */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, minHeight: 250 }}>
        {/* RANK 2 */}
        {top2 && (
          <div
            onClick={() => onNavigateUser && onNavigateUser(top2)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              cursor: onNavigateUser ? 'pointer' : 'default',
              gap: 6, flex: 1,
            }}
          >
            <div style={{ position: 'relative' }}>
              <AvatarBox user={top2} name={top2[nameKey]} userId={top2.userId || top2.id} size={44} idx={1} />
              <div style={{
                position: 'absolute', bottom: -5, left: -5, width: 18, height: 18,
                borderRadius: '50%', background: '#64748b', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 10,
                fontWeight: 700, color: '#f8fafc', border: '1.5px solid #ffffff',
              }}>
                2
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }}>
              {(top2[nameKey] || '').split(' ').pop().toUpperCase()}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', fontFamily: "'JetBrains Mono',monospace" }}>
              {fmtNum(top2[scoreKey] ?? top2.totalScore ?? top2.grandPoints ?? 0)}
            </div>
            <div style={{
              width: '100%', height: 90,
              background: 'rgba(148,163,184,0.08)',
              border: '1px solid rgba(148,163,184,0.3)',
              borderRadius: '4px 4px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#64748b' }}>2</span>
            </div>
          </div>
        )}

        {/* RANK 1 (CHAMPION) */}
        {top1 && (
          <div
            onClick={() => onNavigateUser && onNavigateUser(top1)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              cursor: onNavigateUser ? 'pointer' : 'default',
              gap: 6, flex: 1.25,
            }}
          >
            <Crown size={24} color="#f59e0b" strokeWidth={2.5} style={{ marginBottom: 2 }} />
            <div style={{ position: 'relative' }}>
              <AvatarBox user={top1} name={top1[nameKey]} userId={top1.userId || top1.id} size={54} idx={0} />
              <div style={{
                position: 'absolute', bottom: -6, left: -6, width: 22, height: 22,
                borderRadius: '50%', background: '#f59e0b', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 11,
                fontWeight: 700, color: '#000', border: '1.5px solid #ffffff',
              }}>
                1
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>
              {(top1[nameKey] || '').split(' ').pop().toUpperCase()}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b', fontFamily: "'JetBrains Mono',monospace" }}>
              {fmtNum(top1[scoreKey] ?? top1.totalScore ?? top1.grandPoints ?? 0)}
            </div>
            <div style={{
              width: '100%', height: 130,
              background: 'rgba(245,158,11,0.08)',
              border: '1.5px solid rgba(245,158,11,0.35)',
              borderRadius: '4px 4px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }}>1</span>
            </div>
          </div>
        )}

        {/* RANK 3 */}
        {top3 && (
          <div
            onClick={() => onNavigateUser && onNavigateUser(top3)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              cursor: onNavigateUser ? 'pointer' : 'default',
              gap: 6, flex: 1,
            }}
          >
            <div style={{ position: 'relative' }}>
              <AvatarBox user={top3} name={top3[nameKey]} userId={top3.userId || top3.id} size={42} idx={2} />
              <div style={{
                position: 'absolute', bottom: -5, left: -5, width: 18, height: 18,
                borderRadius: '50%', background: '#b45309', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 10,
                fontWeight: 700, color: '#fff', border: '1.5px solid #ffffff',
              }}>
                3
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#d97706', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }}>
              {(top3[nameKey] || '').split(' ').pop().toUpperCase()}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#d97706', fontFamily: "'JetBrains Mono',monospace" }}>
              {fmtNum(top3[scoreKey] ?? top3.totalScore ?? top3.grandPoints ?? 0)}
            </div>
            <div style={{
              width: '100%', height: 70,
              background: 'rgba(180,83,9,0.08)',
              border: '1px solid rgba(180,83,9,0.25)',
              borderRadius: '4px 4px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#b45309' }}>3</span>
            </div>
          </div>
        )}
      </div>

      {/* CỘT PHẢI: TOP 4 - TOP 8 RUNNER-UPS */}
      {runnerUps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
            Nhóm Bám Đuổi (Top 4 — Top 8)
          </div>
          {runnerUps.map((u, i) => {
            const rank = i + 4;
            const scoreVal = u[scoreKey] ?? u.totalScore ?? u.grandPoints ?? 0;
            return (
              <div
                key={u.userId || u.teamId || i}
                onClick={() => onNavigateUser && onNavigateUser(u)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px',
                  background: 'rgba(15,23,42,0.02)',
                  borderRadius: 4,
                  border: '1px solid rgba(15,23,42,0.06)',
                  cursor: onNavigateUser ? 'pointer' : 'default',
                  transition: 'background .15s ease',
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: 4,
                  background: 'rgba(15,23,42,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#64748b', flexShrink: 0,
                }}>
                  {rank}
                </div>
                <AvatarBox user={u} name={u[nameKey]} userId={u.userId || u.id} size={28} idx={rank - 1} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u[nameKey]}</span>
                    {u.userLevel && <LevelText user={u} compact />}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#b45309', fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>
                  {fmtNum(scoreVal)} <span style={{ fontSize: 10, color: '#94a3b8' }}>{scoreSuffix}</span>
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
 * KHỐI HẠNG CỦA BẠN (MY RANK CARD CHUẨN CŨ)
 * ========================================================================= */

function MyRankBanner({ currentUser, items = [], nameKey = 'name', scoreKey = 'score', isTeam = false, onNavigateUser }) {
  if (!currentUser || !items.length) return null;

  const myEntry = isTeam
    ? items.find((r) => Number(r.teamId) === Number(currentUser.teamId))
    : items.find((r) => Number(r.userId) === Number(currentUser.id) || r.userName === currentUser.name);

  if (!myEntry) {
    return (
      <div style={{ ...CARD, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, color: '#64748b', fontSize: 13, fontWeight: 500 }}>
        <Trophy size={16} color="#94a3b8" />
        Bạn chưa có điểm trong danh sách xếp hạng này.
      </div>
    );
  }

  const myRank = myEntry.rank || items.indexOf(myEntry) + 1;
  const myScore = myEntry[scoreKey] ?? myEntry.totalScore ?? myEntry.grandPoints ?? myEntry.lifetimeScore ?? 0;
  const leader = items[0];
  const leaderScore = leader?.[scoreKey] ?? leader?.totalScore ?? leader?.grandPoints ?? leader?.lifetimeScore ?? 0;
  const gap = Math.max(0, Number(leaderScore) - Number(myScore));

  return (
    <div
      style={{
        ...CARD,
        padding: '14px 18px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
        borderColor: 'rgba(180,83,9,0.3)',
        background: 'rgba(180,83,9,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {/* Hộp số hạng màu xanh nổi tiếng */}
        <div style={{
          width: 44, height: 44, borderRadius: 0,
          background: '#b45309', color: '#ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, flexShrink: 0,
          fontFamily: "'JetBrains Mono',monospace",
        }}>
          #{myRank}
        </div>
        <AvatarBox user={myEntry || currentUser} name={myEntry[nameKey] || currentUser.name} userId={currentUser.id} size={38} idx={myRank - 1} />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Vị trí của bạn · {myEntry[nameKey] || currentUser.name}
            </span>
            {!isTeam && <LevelText user={currentUser} compact />}
          </div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', color: '#64748b', fontSize: 11, fontWeight: 500 }}>
            <span>{fmtNum(myScore)} điểm tích lũy</span>
            {gap > 0 && <span style={{ color: '#dc2626' }}>(-{fmtNum(gap)} điểm để vào Top 1)</span>}
            {gap === 0 && (
              <span style={{ color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Crown size={14} color="#16a34a" /> Đang dẫn đầu
              </span>
            )}
          </div>
        </div>
      </div>

      {!isTeam && (
        <button
          type="button"
          onClick={() => onNavigateUser && onNavigateUser(currentUser)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            border: '1px solid rgba(180,83,9,0.25)',
            background: '#ffffff', color: '#b45309',
            borderRadius: 0, padding: '8px 14px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Mở hồ sơ cá nhân
          <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}

/* =========================================================================
 * KHỐI TREND BAR REALTIME (CHẤM XANH NHẤP NHÁY)
 * ========================================================================= */

function RealtimeTrendBar({ label = 'XU HƯỚNG HOẠT ĐỘNG', statText = '', lastUpdated }) {
  return (
    <div
      className="leaderboard-trend"
      style={{
        ...CARD,
        padding: '10px 18px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#22c55e',
          animation: 'pulse-dot 2s ease infinite',
        }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
        {statText && (
          <span style={{ fontSize: 11, color: '#64748b', marginLeft: 4 }}>
            {statText}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
        Đồng bộ: <span style={{ color: '#0f172a', fontFamily: "'JetBrains Mono',monospace" }}>{lastUpdated || 'Realtime'}</span>
      </div>
    </div>
  );
}

/* =========================================================================
 * MAIN COMPONENT: LEADERBOARD
 * ========================================================================= */

export default function Leaderboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const currentTab = searchParams.get('scope') || searchParams.get('tab') || 'overview';
  const urlSeasonId = searchParams.get('seasonId') || '';
  const urlGrandId = searchParams.get('grandId') || '';
  const urlRankingType = searchParams.get('ranking') || 'team';
  const urlMetric = searchParams.get('metric') || 'views';
  const urlSearch = searchParams.get('search') || '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState(urlSearch);
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  // Tab Data States
  const [overviewData, setOverviewData] = useState(null);
  const [teamData, setTeamData] = useState({ items: [], total: 0 });
  const [individualData, setIndividualData] = useState({ items: [], total: 0 });
  const [seasonList, setSeasonList] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(urlSeasonId);
  const [seasonRankingType, setSeasonRankingType] = useState(urlRankingType);
  const [seasonRankings, setSeasonRankings] = useState({ items: [], total: 0 });
  const [grandList, setGrandList] = useState([]);
  const [selectedGrandId, setSelectedGrandId] = useState(urlGrandId);
  const [grandRankingType, setGrandRankingType] = useState(urlRankingType);
  const [grandRankings, setGrandRankings] = useState({ items: [], total: 0 });
  const [youtubeData, setYoutubeData] = useState({ items: [], total: 0 });
  const [hallOfFameData, setHallOfFameData] = useState({ seasonMvps: [], highScorers: [], championTeams: [] });

  const setParam = useCallback((key, value) => {
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleTabChange = useCallback((tabId) => {
    const params = new URLSearchParams(searchParams);
    params.set('scope', tabId);
    setSearchParams(params, { replace: true });
    setError(null);
  }, [searchParams, setSearchParams]);

  // Clock update
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTimeStr(d.toLocaleTimeString('vi-VN'));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch selectors
  useEffect(() => {
    let mounted = true;
    async function loadSelectors() {
      try {
        const [seasons, grands] = await Promise.all([
          rankingsApi.getSeasons().catch(() => []),
          rankingsApi.getGrands().catch(() => []),
        ]);
        if (!mounted) return;
        setSeasonList(seasons);
        setGrandList(grands);
        if (!selectedSeasonId && seasons.length > 0) {
          const active = seasons.find((s) => s.status === 'ACTIVE') || seasons[0];
          setSelectedSeasonId(String(active.id));
        }
        if (!selectedGrandId && grands.length > 0) {
          const activeG = grands.find((g) => g.status === 'ACTIVE') || grands[0];
          setSelectedGrandId(String(activeG.id));
        }
      } catch (err) {
        console.error('Failed to load selectors:', err);
      }
    }
    loadSelectors();
    return () => { mounted = false; };
  }, []);

  // Fetch active tab
  const fetchDataForTab = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      if (currentTab === 'overview') {
        const res = await rankingsApi.getOverview();
        setOverviewData(res);
      } else if (currentTab === 'team') {
        const teamScope = searchParams.get('teamScope') || 'season';
        const res = await rankingsApi.getTeams({
          scope: teamScope,
          seasonId: selectedSeasonId || undefined,
          grandId: selectedGrandId || undefined,
        });
        setTeamData(res);
      } else if (currentTab === 'individual') {
        const indScope = searchParams.get('indScope') || 'season';
        const res = await rankingsApi.getIndividuals({
          scope: indScope,
          seasonId: selectedSeasonId || undefined,
          grandId: selectedGrandId || undefined,
          search: searchKeyword || undefined,
        });
        setIndividualData(res);
      } else if (currentTab === 'season') {
        const sid = selectedSeasonId || (seasonList[0]?.id ? String(seasonList[0].id) : '');
        if (sid) {
          const fn = seasonRankingType === 'individual'
            ? rankingsApi.getIndividuals({ scope: 'season', seasonId: sid, search: searchKeyword || undefined })
            : rankingsApi.getTeams({ scope: 'season', seasonId: sid });
          setSeasonRankings(await fn);
        }
      } else if (currentTab === 'grand') {
        const gid = selectedGrandId || (grandList[0]?.id ? String(grandList[0].id) : '');
        if (gid) {
          const fn = grandRankingType === 'individual'
            ? rankingsApi.getIndividuals({ scope: 'grand', grandId: gid, search: searchKeyword || undefined })
            : rankingsApi.getTeams({ scope: 'grand', grandId: gid });
          setGrandRankings(await fn);
        }
      } else if (currentTab === 'youtube') {
        const res = await rankingsApi.getYouTube({ sortBy: urlMetric || 'views' });
        setYoutubeData(res);
      } else if (currentTab === 'hall-of-fame') {
        const res = await rankingsApi.getTopPerformers();
        setHallOfFameData(res);
      }
    } catch (err) {
      console.error(`Failed to load tab ${currentTab}:`, err);
      setError(err?.response?.data?.message || err?.message || 'Không tải được dữ liệu xếp hạng');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    currentTab, selectedSeasonId, selectedGrandId,
    seasonRankingType, grandRankingType,
    urlMetric, searchKeyword, searchParams, seasonList, grandList,
  ]);

  useEffect(() => {
    fetchDataForTab();
  }, [fetchDataForTab]);

  useEffect(() => {
    const handleRealtimeUpdate = () => {
      fetchDataForTab(false);
    };
    window.addEventListener('workrank:user-updated', handleRealtimeUpdate);
    window.addEventListener('workrank:team-updated', handleRealtimeUpdate);
    return () => {
      window.removeEventListener('workrank:user-updated', handleRealtimeUpdate);
      window.removeEventListener('workrank:team-updated', handleRealtimeUpdate);
    };
  }, [fetchDataForTab]);

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '16px 16px 48px', fontFamily: "'JetBrains Mono', monospace" }}>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        .leaderboard-row:hover { background: rgba(15,23,42,0.03) !important; }
        @media (max-width: 640px) {
          .ranking-hide-mobile { display: none !important; }
          .leaderboard-podium { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── BANNER HEADER WORKRANK ── */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Trophy size={22} color="#b45309" />
            <h1 style={{ margin: 0, fontSize: 'var(--text-h1, 24px)', fontWeight: 700, letterSpacing: '-0.02em', color: '#ffffff', lineHeight: 1.25 }}>
              Bảng Xếp Hạng Toàn Hệ Thống
            </h1>
            <span style={{
              background: 'rgba(180,83,9,0.2)', color: '#b45309',
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 0,
              textTransform: 'uppercase',
            }}>
              Canonical Hub V3.3
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.55 }}>
            Tổng hợp thành tích thi đấu: Đội nhóm · Cá nhân XP · Grand Championship · Kênh YouTube
          </p>
        </div>

        <button
          onClick={() => fetchDataForTab(true)}
          disabled={refreshing}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.1)', color: '#f8fafc',
            border: '1px solid rgba(255,255,255,0.18)',
            padding: '7px 14px', borderRadius: 0,
            fontSize: 12, fontWeight: 600, cursor: refreshing ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={13} style={{ animation: refreshing ? 'pulse-dot 1s infinite' : 'none' }} />
          {refreshing ? 'Đang đồng bộ...' : 'Làm mới'}
        </button>
      </div>

      {/* ── NAV TABS ── */}
      <div
        style={{
          display: 'flex', gap: 4,
          background: '#ffffff',
          border: '1px solid rgba(15,23,42,0.08)',
          borderRadius: 0, padding: 6,
          marginBottom: 18, overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {TABS.map((tab) => {
          const isActive = currentTab === tab.id;
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 0, border: 'none',
                background: isActive ? '#b45309' : 'transparent',
                color: isActive ? '#ffffff' : '#64748b',
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <TabIcon size={14} color={isActive ? '#ffffff' : 'currentColor'} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span style={{
                  fontSize: 9, fontWeight: 900, padding: '1px 5px',
                  borderRadius: 0,
                  background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.06)',
                  color: isActive ? '#ffffff' : '#64748b',
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TREND BAR REALTIME ── */}
      <RealtimeTrendBar
        label="XU HƯỚNG HOẠT ĐỘNG"
        statText="Cạnh tranh thứ hạng thời gian thực trên toàn bộ hệ thống"
        lastUpdated={currentTimeStr}
      />

      {/* ── TAB CONTENT BODY ── */}
      {loading ? (
        <TabTransition minHeight={450}>
          {currentTab === 'overview' ? (
            <div>
              <CardSkeleton count={3} />
              <TableSkeleton rows={6} cols={4} minHeight={380} />
            </div>
          ) : (
            <TableSkeleton rows={8} cols={4} minHeight={450} />
          )}
        </TabTransition>
      ) : error ? (
        <div style={{ ...CARD, padding: '40px 20px', textAlign: 'center' }}>
          <AlertCircle size={32} color="#dc2626" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{error}</div>
          <button
            onClick={() => fetchDataForTab()}
            style={{
              marginTop: 12, background: '#0f172a', color: '#fff', border: 'none',
              padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        </div>
      ) : (
        <TabTransition key={currentTab} minHeight={450}>
          {/* 1. OVERVIEW TAB */}
          {currentTab === 'overview' && (
            <OverviewSection data={overviewData} onSelectTab={handleTabChange} navigate={navigate} />
          )}

          {/* 2. TEAM LEADERBOARD TAB */}
          {currentTab === 'team' && (
            <TeamSection
              data={teamData}
              searchParams={searchParams}
              setParam={setParam}
              currentUser={currentUser}
              navigate={navigate}
            />
          )}

          {/* 3. INDIVIDUAL LEADERBOARD TAB */}
          {currentTab === 'individual' && (
            <IndividualSection
              data={individualData}
              searchKeyword={searchKeyword}
              setSearchKeyword={setSearchKeyword}
              onSearchSubmit={() => fetchDataForTab()}
              searchParams={searchParams}
              setParam={setParam}
              currentUser={currentUser}
              navigate={navigate}
            />
          )}

          {/* 4. SEASON LEADERBOARD TAB */}
          {currentTab === 'season' && (
            <SeasonSection
              data={seasonRankings}
              seasons={seasonList}
              selectedSeasonId={selectedSeasonId}
              setSelectedSeasonId={(id) => { setSelectedSeasonId(id); setParam('seasonId', id); }}
              rankingType={seasonRankingType}
              setRankingType={(t) => { setSeasonRankingType(t); setParam('ranking', t); }}
              currentUser={currentUser}
              navigate={navigate}
            />
          )}

          {/* 5. GRAND LEADERBOARD TAB */}
          {currentTab === 'grand' && (
            <GrandSection
              data={grandRankings}
              grands={grandList}
              selectedGrandId={selectedGrandId}
              setSelectedGrandId={(id) => { setSelectedGrandId(id); setParam('grandId', id); }}
              rankingType={grandRankingType}
              setRankingType={(t) => { setGrandRankingType(t); setParam('ranking', t); }}
              currentUser={currentUser}
              navigate={navigate}
            />
          )}

          {/* 6. YOUTUBE LEADERBOARD TAB */}
          {currentTab === 'youtube' && (
            <YouTubeSection
              data={youtubeData}
              metric={urlMetric}
              setMetric={(m) => setParam('metric', m)}
              currentUser={currentUser}
              navigate={navigate}
            />
          )}

          {/* 7. HALL OF FAME TAB */}
          {currentTab === 'hall-of-fame' && (
            <HallOfFameSection data={hallOfFameData} navigate={navigate} />
          )}
        </TabTransition>
      )}
    </div>
  );
}

/* =========================================================================
 * 1. OVERVIEW SECTION
 * ========================================================================= */

function OverviewSection({ data, onSelectTab, navigate }) {
  if (!data) return null;

  const topTeam = data.activeSeason?.topTeams?.[0];
  const topIndividual = data.activeSeason?.topIndividuals?.[0];
  const topYt = data.topYouTubeTeam;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 3 THẺ TÓM TẮT ĐỈNH CAO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        {/* ĐỘI DẪN ĐẦU */}
        <div style={{ ...CARD, padding: 18, borderLeft: '4px solid #b45309' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#b45309', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Users size={14} color="#b45309" /> Đội Dẫn Đầu Mùa Giải
            </span>
            <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', fontSize: 10, fontWeight: 900 }}>
              #1 TOP TEAM
            </span>
          </div>
          {topTeam ? (
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#0f172a' }}>{topTeam.teamName}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#b45309', marginTop: 4 }}>
                {fmtNum(topTeam.totalScore ?? topTeam.score ?? 0)}{' '}
                <span style={{ fontSize: 12, color: '#64748b' }}>pts ({data.activeSeason?.name || 'Mùa giải'})</span>
              </div>
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Chưa có điểm mùa giải</div>
          )}
          <button
            onClick={() => onSelectTab('team')}
            style={{
              marginTop: 14, width: '100%', background: 'rgba(180,83,9,0.06)',
              border: '1px solid rgba(180,83,9,0.2)', color: '#b45309',
              padding: '6px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
          >
            Xem BXH Đội Toàn Bộ <ChevronRight size={13} />
          </button>
        </div>

        {/* CÁ NHÂN MVP */}
        <div style={{ ...CARD, padding: 18, borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#b45309', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Crown size={14} color="#f59e0b" /> Cá Nhân Xuất Sắc (MVP)
            </span>
            <span style={{ background: '#fef3c7', color: '#b45309', padding: '1px 6px', fontSize: 10, fontWeight: 900 }}>
              #1 TOP MVP
            </span>
          </div>
          {topIndividual ? (
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#0f172a' }}>{topIndividual.userName}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#f59e0b', marginTop: 4 }}>
                {fmtNum(topIndividual.score ?? topIndividual.points ?? 0)}{' '}
                <span style={{ fontSize: 12, color: '#64748b' }}>XP ({topIndividual.teamName || 'Thành viên'})</span>
              </div>
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Chưa có cá nhân xếp hạng</div>
          )}
          <button
            onClick={() => onSelectTab('individual')}
            style={{
              marginTop: 14, width: '100%', background: 'rgba(245,158,11,0.06)',
              border: '1px solid rgba(245,158,11,0.2)', color: '#b45309',
              padding: '6px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
          >
            Xem BXH Cá Nhân Toàn Bộ <ChevronRight size={13} />
          </button>
        </div>

        {/* KÊNH YOUTUBE */}
        <div style={{ ...CARD, padding: 18, borderLeft: '4px solid #dc2626' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Tv size={14} color="#dc2626" /> Kênh YouTube Số 1
            </span>
            <span style={{ background: '#fee2e2', color: '#dc2626', padding: '1px 6px', fontSize: 10, fontWeight: 900 }}>
              #1 VIEWS
            </span>
          </div>
          {topYt ? (
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#0f172a' }}>{topYt.teamName}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#dc2626', marginTop: 4 }}>
                {fmtNum(topYt.totalViews)}{' '}
                <span style={{ fontSize: 12, color: '#64748b' }}>views ({fmtNum(topYt.totalSubscribers)} subs)</span>
              </div>
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Chưa có dữ liệu YouTube</div>
          )}
          <button
            onClick={() => onSelectTab('youtube')}
            style={{
              marginTop: 14, width: '100%', background: 'rgba(220,38,38,0.06)',
              border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626',
              padding: '6px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
          >
            Xem BXH YouTube Toàn Bộ <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* DUAL PODIUM PREVIEW: SEASON & GRAND */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 16 }}>
        {/* SEASON PODIUM CARD */}
        <div style={{ ...CARD, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Swords size={18} color="#b45309" />
              <span style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>
                Mùa Giải: {data.activeSeason?.name || 'Hiện tại'}
              </span>
            </div>
            <button
              onClick={() => onSelectTab('season')}
              style={{ border: 'none', background: 'transparent', color: '#b45309', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              Chi tiết <ArrowRight size={13} />
            </button>
          </div>
          {data.activeSeason?.topTeams?.length > 0 ? (
            <PodiumTwoColumns
              items={data.activeSeason.topTeams}
              nameKey="teamName"
              scoreKey="totalScore"
              scoreSuffix="pts"
              onNavigateUser={() => onSelectTab('season')}
            />
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 12, padding: '24px 0', textAlign: 'center' }}>
              Chưa có dữ liệu mùa giải.
            </div>
          )}
        </div>

        {/* GRAND PODIUM CARD */}
        <div style={{ ...CARD, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Crown size={18} color="#f59e0b" />
              <span style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>
                Đua Vô Địch: {data.currentGrand?.name || 'Grand Championship'}
              </span>
            </div>
            <button
              onClick={() => onSelectTab('grand')}
              style={{ border: 'none', background: 'transparent', color: '#f59e0b', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              Chi tiết <ArrowRight size={13} />
            </button>
          </div>
          {data.currentGrand?.topTeams?.length > 0 ? (
            <PodiumTwoColumns
              items={data.currentGrand.topTeams}
              nameKey="teamName"
              scoreKey="grandPoints"
              scoreSuffix="GP"
              onNavigateUser={() => onSelectTab('grand')}
            />
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 12, padding: '24px 0', textAlign: 'center' }}>
              Chưa có bảng tổng sắp Grand.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
 * 2. TEAM SECTION (BXH ĐỘI VỚI PODIUM 2 CỘT & MY TEAM CARD)
 * ========================================================================= */

function TeamSection({ data, searchParams, setParam, currentUser, navigate }) {
  const currentScope = searchParams.get('teamScope') || 'season';
  const items = data.items || [];
  const leader = items[0];

  return (
    <div>
      {/* SCOPE SELECTOR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
            Bảng Xếp Hạng Đội Nhóm
          </h2>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Xếp hạng theo tổng điểm thi đấu của tập thể các phòng ban / đội nhóm
          </span>
        </div>
        <div style={{ display: 'flex', gap: 2, background: 'rgba(15,23,42,0.06)', padding: 3 }}>
          {[
            { id: 'season', label: 'Mùa Giải' },
            { id: 'grand', label: 'Vô Địch Năm' },
            { id: 'all-time', label: 'Toàn Thời Gian' },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setParam('teamScope', s.id)}
              style={{
                border: 'none',
                background: currentScope === s.id ? '#b45309' : 'transparent',
                color: currentScope === s.id ? '#ffffff' : '#64748b',
                padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* MY TEAM BANNER */}
      <MyRankBanner
        currentUser={currentUser}
        items={items}
        nameKey="teamName"
        scoreKey={currentScope === 'grand' ? 'grandPoints' : 'totalScore'}
        isTeam
      />

      {/* PODIUM 2 CỘT */}
      {items.length >= 2 && (
        <PodiumTwoColumns
          items={items}
          nameKey="teamName"
          scoreKey={currentScope === 'grand' ? 'grandPoints' : 'totalScore'}
          scoreSuffix={currentScope === 'grand' ? 'GP' : 'pts'}
        />
      )}

      {/* TABLE CARD */}
      <div className="leaderboard-table-card" style={{ ...CARD, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Danh Sách Thứ Hạng Đội ({items.length} đội)
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: 'rgba(15,23,42,0.02)' }}>
                {['Hạng', 'Tên Đội', 'Điểm Số', 'Thành Viên', 'Mùa Vô Địch'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Điểm Số' ? 'right' : h === 'Thành Viên' || h === 'Mùa Vô Địch' ? 'center' : 'left', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Chưa có dữ liệu</td></tr>
              ) : items.map((row, idx) => {
                const rank = row.rank || idx + 1;
                const isMyTeam = currentUser?.teamId && Number(row.teamId) === Number(currentUser.teamId);
                const scoreVal = row[currentScope === 'grand' ? 'grandPoints' : 'totalScore'] ?? row.score ?? 0;
                const gap = leader && rank > 1 ? Number(leader.totalScore ?? leader.grandPoints ?? 0) - Number(scoreVal) : 0;
                return (
                  <tr
                    key={row.teamId || idx}
                    className="leaderboard-row"
                    style={{
                      borderBottom: '1px solid rgba(15,23,42,0.04)',
                      background: isMyTeam ? 'rgba(180,83,9,0.06)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 24, height: 24, background: rank === 1 ? '#f59e0b' : rank === 2 ? '#64748b' : rank === 3 ? '#b45309' : 'rgba(15,23,42,0.06)',
                          color: rank <= 3 ? '#fff' : '#64748b', fontSize: 11, fontWeight: 900,
                        }}>
                          {rank}
                        </span>
                        <TrendIndicator trend={row.trend} />
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>
                        {row.teamName}
                        {isMyTeam && (
                          <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 900, padding: '2px 5px', background: '#b45309', color: '#fff' }}>
                            ĐỘI BẠN
                          </span>
                        )}
                      </div>
                      {gap > 0 && <div style={{ fontSize: 10, color: '#94a3b8' }}>-{fmtNum(gap)} pts so với #1</div>}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color: currentScope === 'grand' ? '#d97706' : '#b45309', fontFamily: "'JetBrains Mono',monospace" }}>
                        {fmtNum(scoreVal)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>
                      {row.activeMembersCount || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {(row.seasonsWon || 0) > 0 ? (
                        <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 6px', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Trophy size={11} color="#b45309" /> {row.seasonsWon}
                        </span>
                      ) : (
                        <span style={{ color: '#cbd5e1' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
 * 3. INDIVIDUAL SECTION (BXH CÁ NHÂN VỚI BADGES, LEVEL BAND & PODIUM)
 * ========================================================================= */

function IndividualSection({ data, searchKeyword, setSearchKeyword, onSearchSubmit, searchParams, setParam, currentUser, navigate }) {
  const currentScope = searchParams.get('indScope') || 'season';
  const items = data.items || [];
  const leader = items[0];

  return (
    <div>
      {/* HEADER & SEARCH BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
            Bảng Xếp Hạng Cá Nhân
          </h2>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Điểm XP cá nhân · cấp độ thành viên · danh hiệu cống hiến
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 2, background: 'rgba(15,23,42,0.06)', padding: 3 }}>
            {[
              { id: 'season', label: 'Mùa Giải' },
              { id: 'grand', label: 'Grand' },
              { id: 'all-time', label: 'Toàn Thời Gian' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setParam('indScope', s.id)}
                style={{
                  border: 'none',
                  background: currentScope === s.id ? '#b45309' : 'transparent',
                  color: currentScope === s.id ? '#ffffff' : '#64748b',
                  padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); onSearchSubmit(); }} style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tìm người dùng..."
              style={{
                background: 'rgba(15,23,42,0.06)', border: '1px solid rgba(15,23,42,0.1)',
                padding: '6px 10px 6px 28px', fontSize: 11, outline: 'none', width: 170,
                color: '#0f172a',
              }}
            />
          </form>
        </div>
      </div>

      {/* MY RANK BANNER */}
      <MyRankBanner
        currentUser={currentUser}
        items={items}
        nameKey="userName"
        scoreKey={currentScope === 'all-time' ? 'lifetimeScore' : 'score'}
        onNavigateUser={(u) => navigate(`/users/${u.id || u.userId}`)}
      />

      {/* PODIUM 2 CỘT */}
      {items.length >= 2 && !searchKeyword && (
        <PodiumTwoColumns
          items={items}
          nameKey="userName"
          scoreKey={currentScope === 'all-time' ? 'lifetimeScore' : 'score'}
          scoreSuffix="XP"
          onNavigateUser={(u) => navigate(`/users/${u.userId || u.id}`)}
        />
      )}

      {/* TABLE CARD */}
      <div className="leaderboard-table-card" style={{ ...CARD, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Danh Sách Thứ Hạng Cá Nhân ({items.length} người)
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: 'rgba(15,23,42,0.02)' }}>
                {['Hạng', 'Người Dùng', 'Đội Nhóm', 'Cấp Độ', 'Điểm XP'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Điểm XP' ? 'right' : h === 'Cấp Độ' ? 'center' : 'left', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Không tìm thấy thành viên phù hợp</td></tr>
              ) : items.map((u, i) => {
                const rank = u.rank || i + 1;
                const isMe = currentUser && (Number(u.userId) === Number(currentUser.id) || u.userName === currentUser.name);
                const scoreVal = u[currentScope === 'all-time' ? 'lifetimeScore' : 'score'] ?? 0;
                const gap = leader && rank > 1 ? Number(leader.score ?? leader.lifetimeScore ?? 0) - Number(scoreVal) : 0;
                return (
                  <tr
                    key={u.userId || i}
                    className="leaderboard-row"
                    onClick={() => navigate(`/users/${u.userId}`)}
                    style={{
                      borderBottom: '1px solid rgba(15,23,42,0.04)',
                      cursor: 'pointer',
                      background: isMe ? 'rgba(180,83,9,0.06)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 24, height: 24, background: rank === 1 ? '#f59e0b' : rank === 2 ? '#64748b' : rank === 3 ? '#b45309' : 'rgba(15,23,42,0.06)',
                          color: rank <= 3 ? '#fff' : '#64748b', fontSize: 11, fontWeight: 900,
                        }}>
                          {rank}
                        </span>
                        <TrendIndicator trend={u.trend} />
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <AvatarBox user={u} name={u.userName} userId={u.userId} size={30} idx={rank - 1} />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>{u.userName}</span>
                            {u.jobTitle && <JobTitleBadge jobTitle={u.jobTitle} size="xs" />}
                            {isMe && <span style={{ fontSize: 9, fontWeight: 900, padding: '1px 4px', background: '#b45309', color: '#fff' }}>BẠN</span>}
                          </div>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>{u.userEmail}</div>
                          {gap > 0 && <div style={{ fontSize: 10, color: '#dc2626' }}>-{fmtNum(gap)} XP so với #1</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontWeight: 700 }}>
                      {u.teamName || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <LevelText user={u} />
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color: '#f59e0b', fontFamily: "'JetBrains Mono',monospace" }}>
                        {fmtNum(scoreVal)}
                      </span>
                      <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 3 }}>XP</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
 * 4. SEASON SECTION
 * ========================================================================= */

function SeasonSection({ data, seasons, selectedSeasonId, setSelectedSeasonId, rankingType, setRankingType, currentUser, navigate }) {
  const currentSeason = seasons.find((s) => String(s.id) === String(selectedSeasonId));
  const items = data.items || [];
  const leader = items[0];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
            Xếp Hạng Mùa Giải (Season Standings)
          </h2>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Điểm số các đội và cá nhân trong mùa thi đấu Arena
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={selectedSeasonId}
            onChange={(e) => setSelectedSeasonId(e.target.value)}
            style={{
              padding: '6px 12px', border: '1px solid rgba(15,23,42,0.15)',
              fontSize: 12, fontWeight: 700, background: '#fff', color: '#0f172a',
            }}
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 2, background: 'rgba(15,23,42,0.06)', padding: 3 }}>
            <button
              onClick={() => setRankingType('team')}
              style={{
                border: 'none', background: rankingType === 'team' ? '#b45309' : 'transparent',
                color: rankingType === 'team' ? '#fff' : '#64748b', padding: '6px 12px',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Users size={13} /> BXH Đội
            </button>
            <button
              onClick={() => setRankingType('individual')}
              style={{
                border: 'none', background: rankingType === 'individual' ? '#b45309' : 'transparent',
                color: rankingType === 'individual' ? '#fff' : '#64748b', padding: '6px 12px',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <User size={13} /> BXH Cá Nhân
            </button>
          </div>
          <a
            href="/arena"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              border: '1px solid rgba(180,83,9,0.25)', background: 'rgba(180,83,9,0.06)',
              color: '#b45309', padding: '6px 12px', fontSize: 11, fontWeight: 800, textDecoration: 'none',
            }}
          >
            Đấu Trường Arena <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* MY RANK */}
      <MyRankBanner
        currentUser={currentUser}
        items={items}
        nameKey={rankingType === 'individual' ? 'userName' : 'teamName'}
        scoreKey="totalScore"
        isTeam={rankingType === 'team'}
      />

      {/* PODIUM 2 CỘT */}
      {items.length >= 2 && (
        <PodiumTwoColumns
          items={items}
          nameKey={rankingType === 'individual' ? 'userName' : 'teamName'}
          scoreKey="totalScore"
          scoreSuffix="pts"
        />
      )}

      {/* TABLE */}
      <div className="leaderboard-table-card" style={{ ...CARD, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Bảng Tổng Sắp Mùa Giải ({currentSeason?.name || 'Mùa'})
          </span>
        </div>
        <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: 'rgba(15,23,42,0.02)' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Hạng</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{rankingType === 'individual' ? 'Thành Viên' : 'Đội Thi Đấu'}</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Điểm Mùa Giải</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Trạng Thái</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Chưa có dữ liệu</td></tr>
            ) : items.map((r, i) => {
              const rank = r.rank || i + 1;
              const isMine = rankingType === 'team'
                ? Number(r.teamId) === Number(currentUser?.teamId)
                : Number(r.userId) === Number(currentUser?.id);
              const scoreVal = r.totalScore ?? r.score ?? 0;
              const gap = leader && rank > 1 ? Number(leader.totalScore ?? leader.score ?? 0) - Number(scoreVal) : 0;
              return (
                <tr key={r.teamId || r.userId || i} className="leaderboard-row" style={{ borderBottom: '1px solid rgba(15,23,42,0.04)', background: isMine ? 'rgba(180,83,9,0.06)' : 'transparent' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 24, height: 24, background: rank === 1 ? '#f59e0b' : rank === 2 ? '#64748b' : rank === 3 ? '#b45309' : 'rgba(15,23,42,0.06)', color: rank <= 3 ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>
                        {rank}
                      </span>
                      <TrendIndicator trend={r.trend} />
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>
                      {rankingType === 'individual' ? r.userName : r.teamName}
                      {isMine && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 900, padding: '2px 5px', background: '#b45309', color: '#fff' }}>BẠN</span>}
                    </div>
                    {gap > 0 && <div style={{ fontSize: 10, color: '#94a3b8' }}>-{fmtNum(gap)} pts so với #1</div>}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: '#b45309', fontFamily: "'JetBrains Mono',monospace" }}>{fmtNum(scoreVal)}</span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#16a34a' }}>Realtime</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================================
 * 5. GRAND SECTION
 * ========================================================================= */

function GrandSection({ data, grands, selectedGrandId, setSelectedGrandId, rankingType, setRankingType, currentUser, navigate }) {
  const currentGrand = grands.find((g) => String(g.id) === String(selectedGrandId));
  const items = data.items || [];
  const leader = items[0];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
            Bảng Xếp Hạng Vô Địch Năm (Grand)
          </h2>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Cuộc đua danh giá nhất năm — tích lũy điểm Grand Points từ tất cả các mùa giải
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={selectedGrandId}
            onChange={(e) => setSelectedGrandId(e.target.value)}
            style={{
              padding: '6px 12px', border: '1px solid rgba(15,23,42,0.15)',
              fontSize: 12, fontWeight: 700, background: '#fff', color: '#0f172a',
            }}
          >
            {grands.map((g) => (
              <option key={g.id} value={g.id}>{g.name} ({g.year})</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 2, background: 'rgba(15,23,42,0.06)', padding: 3 }}>
            <button
              onClick={() => setRankingType('team')}
              style={{
                border: 'none', background: rankingType === 'team' ? '#b45309' : 'transparent',
                color: rankingType === 'team' ? '#fff' : '#64748b', padding: '6px 12px',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Users size={13} /> Điểm Đội
            </button>
            <button
              onClick={() => setRankingType('individual')}
              style={{
                border: 'none', background: rankingType === 'individual' ? '#b45309' : 'transparent',
                color: rankingType === 'individual' ? '#fff' : '#64748b', padding: '6px 12px',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <User size={13} /> Cá Nhân
            </button>
          </div>
          <a
            href="/grand"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)',
              color: '#b45309', padding: '6px 12px', fontSize: 11, fontWeight: 800, textDecoration: 'none',
            }}
          >
            Tổng Kết Năm <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* MY RANK */}
      <MyRankBanner
        currentUser={currentUser}
        items={items}
        nameKey={rankingType === 'individual' ? 'userName' : 'teamName'}
        scoreKey="grandPoints"
        isTeam={rankingType === 'team'}
      />

      {/* PODIUM 2 CỘT */}
      {items.length >= 2 && (
        <PodiumTwoColumns
          items={items}
          nameKey={rankingType === 'individual' ? 'userName' : 'teamName'}
          scoreKey="grandPoints"
          scoreSuffix="GP"
        />
      )}

      {/* TABLE */}
      <div className="leaderboard-table-card" style={{ ...CARD, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Tổng Sắp Vô Địch ({currentGrand?.year || 'Năm'})
          </span>
        </div>
        <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: 'rgba(15,23,42,0.02)' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Hạng</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{rankingType === 'individual' ? 'Thành Viên' : 'Đội Tuyển'}</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Điểm Năm (GP)</th>
              <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Vị Thế</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Chưa có dữ liệu</td></tr>
            ) : items.map((r, i) => {
              const rank = r.rank || i + 1;
              const isMine = rankingType === 'team'
                ? Number(r.teamId) === Number(currentUser?.teamId)
                : Number(r.userId) === Number(currentUser?.id);
              const scoreVal = r.grandPoints ?? r.score ?? 0;
              const gap = leader && rank > 1 ? Number(leader.grandPoints ?? 0) - Number(scoreVal) : 0;
              return (
                <tr key={r.teamId || r.userId || i} className="leaderboard-row" style={{ borderBottom: '1px solid rgba(15,23,42,0.04)', background: isMine ? 'rgba(180,83,9,0.06)' : 'transparent' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 24, height: 24, background: rank === 1 ? '#f59e0b' : rank === 2 ? '#64748b' : rank === 3 ? '#b45309' : 'rgba(15,23,42,0.06)', color: rank <= 3 ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>
                        {rank}
                      </span>
                      <TrendIndicator trend={r.trend} />
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>
                      {rankingType === 'individual' ? r.userName : r.teamName}
                      {isMine && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 900, padding: '2px 5px', background: '#b45309', color: '#fff' }}>BẠN</span>}
                    </div>
                    {gap > 0 && <div style={{ fontSize: 10, color: '#94a3b8' }}>-{fmtNum(gap)} GP so với #1</div>}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: '#d97706', fontFamily: "'JetBrains Mono',monospace" }}>{fmtNum(scoreVal)}</span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {rank === 1 ? (
                      <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 6px', fontSize: 10, fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Crown size={12} color="#b45309" /> QUÁN QUÂN
                      </span>
                    ) : (
                      <span style={{ color: '#64748b', fontSize: 11 }}>Top {rank}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================================
 * 6. YOUTUBE SECTION
 * ========================================================================= */

function YouTubeSection({ data, metric, setMetric, currentUser, navigate }) {
  const items = data.items || [];
  const METRICS = [
    { id: 'views',       label: 'Lượt Xem',      icon: Eye,        key: 'totalViews',       suffix: 'views' },
    { id: 'subscribers', label: 'Người Đăng Ký',  icon: Users,      key: 'totalSubscribers', suffix: 'subs' },
    { id: 'growth',      label: 'Tăng Trưởng',    icon: TrendingUp, key: 'viewsGrowth30dPct', suffix: '%' },
  ];
  const activeMetric = METRICS.find((m) => m.id === metric) || METRICS[0];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
            Bảng Xếp Hạng YouTube Studio
          </h2>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Sản lượng truyền thông video: Views · Subscribers · Tăng trưởng 30 ngày
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', gap: 2, background: 'rgba(15,23,42,0.06)', padding: 3 }}>
            {METRICS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMetric(m.id)}
                style={{
                  border: 'none', background: metric === m.id ? '#b45309' : 'transparent',
                  color: metric === m.id ? '#fff' : '#64748b', padding: '6px 12px',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <m.icon size={13} /> {m.label}
              </button>
            ))}
          </div>
          <a
            href="/youtube"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              border: '1px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.06)',
              color: '#dc2626', padding: '6px 12px', fontSize: 11, fontWeight: 800, textDecoration: 'none',
            }}
          >
            Studio Chi Tiết <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* MY TEAM BANNER */}
      {currentUser?.teamId && (
        <MyRankBanner
          currentUser={currentUser}
          items={items}
          nameKey="teamName"
          scoreKey={activeMetric.key}
          isTeam
        />
      )}

      {/* PODIUM 2 CỘT */}
      {items.length >= 2 && (
        <PodiumTwoColumns
          items={items}
          nameKey="teamName"
          scoreKey={activeMetric.key}
          scoreSuffix={activeMetric.suffix}
        />
      )}

      {/* TABLE */}
      <div className="leaderboard-table-card" style={{ ...CARD, overflow: 'hidden' }}>
        <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: 'rgba(15,23,42,0.02)' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Hạng</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Đội & Kênh</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Tổng Lượt Xem</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Subscribers</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Tăng Trưởng</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Chưa có dữ liệu</td></tr>
            ) : items.map((row, idx) => {
              const rank = row.rank || idx + 1;
              const isMyTeam = Number(row.teamId) === Number(currentUser?.teamId);
              return (
                <tr key={row.teamId || idx} className="leaderboard-row" style={{ borderBottom: '1px solid rgba(15,23,42,0.04)', background: isMyTeam ? 'rgba(180,83,9,0.06)' : 'transparent' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ width: 24, height: 24, background: rank === 1 ? '#dc2626' : rank === 2 ? '#64748b' : rank === 3 ? '#b45309' : 'rgba(15,23,42,0.06)', color: rank <= 3 ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>
                      {rank}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>
                      {row.teamName}
                      {isMyTeam && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 900, padding: '2px 5px', background: '#b45309', color: '#fff' }}>ĐỘI BẠN</span>}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{row.channelsCount} kênh · {row.videosCount} video</div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: '#dc2626', fontFamily: "'JetBrains Mono',monospace" }}>{fmtNum(row.totalViews)}</span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                    {fmtNum(row.totalSubscribers)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <span style={{
                      padding: '2px 6px', fontSize: 11, fontWeight: 800,
                      background: Number(row.viewsGrowth30dPct || 0) >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(220,38,38,0.12)',
                      color: Number(row.viewsGrowth30dPct || 0) >= 0 ? '#16a34a' : '#dc2626',
                    }}>
                      {Number(row.viewsGrowth30dPct || 0) > 0 ? `+${row.viewsGrowth30dPct}%` : `${row.viewsGrowth30dPct || 0}%`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================================
 * 7. HALL OF FAME SECTION
 * ========================================================================= */

function HallOfFameSection({ data, navigate }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* MVP GRID */}
      <div style={{ ...CARD, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Sparkles size={18} color="#f59e0b" />
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
            Ngôi Đền Danh Vọng — MVPs
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          {data.seasonMvps?.length > 0 ? (
            data.seasonMvps.map((mvp, i) => (
              <div
                key={mvp.userId || i}
                onClick={() => navigate(`/users/${mvp.userId}`)}
                style={{
                  padding: '12px 14px', border: '1px solid rgba(245,158,11,0.25)',
                  background: 'rgba(254,243,199,0.25)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <div style={{ width: 36, height: 36, background: '#f59e0b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Crown size={18} color="#fff" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>{mvp.userName}</div>
                    <JobTitleBadge jobTitle={mvp.jobTitle} size="xs" />
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>{mvp.teamName || 'Thành viên'}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#b45309', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Sparkles size={12} color="#b45309" /> {mvp.mvpCount} Lần MVP · {fmtNum(mvp.lifetimeScore)} XP
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 12, padding: 16 }}>Chưa có danh hiệu MVP nào.</div>
          )}
        </div>
      </div>

      {/* CHAMPION TEAMS */}
      <div style={{ ...CARD, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Trophy size={18} color="#b45309" />
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
            Đội Vô Địch Mùa Giải
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          {data.championTeams?.length > 0 ? (
            data.championTeams.map((t, i) => (
              <div
                key={t.teamId || i}
                style={{
                  padding: '12px 14px', border: '1px solid rgba(180,83,9,0.2)',
                  background: 'rgba(180,83,9,0.04)', display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <div style={{ width: 36, height: 36, background: '#b45309', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trophy size={18} color="#fff" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>{t.teamName}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#b45309', marginTop: 2 }}>
                    {t.seasonsWon} Mùa Vô Địch · {fmtNum(t.grandPoints)} GP
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 12, padding: 16 }}>Chưa có đội nào vô địch.</div>
          )}
        </div>
      </div>
    </div>
  );
}
