import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { activity, friends as friendsApi, users as usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  avatarHue,
  initialsFromName,
  removeStoredAvatar,
  setStoredAvatar,
} from '../utils/avatar';
import {
  Activity,
  Award,
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  Clock3,
  Code2,
  Crown,
  Flame,
  Gauge,
  Heart,
  ImagePlus,
  Keyboard,
  Map,
  Medal,
  Mouse,
  PawPrint,
  Pencil,
  ShieldCheck,
  Star,
  Target,
  Trophy,
  UserCheck,
  UserPlus,
  UserRound,
  Zap,
} from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';
import ProfileErrorBoundary from '../components/ProfileErrorBoundary';
import usePageVisibility from '../hooks/usePageVisibility';

const UserActivityChart = lazy(() => import('../components/UserActivityChart'));

const STATUS_CONFIG = {
  active: { label: 'Đang hoạt động', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', color: '#16a34a', dot: '#22c55e' },
  online: { label: 'Trực tuyến', bg: 'rgba(8,145,178,0.12)', border: 'rgba(8,145,178,0.35)', color: '#0891b2', dot: '#06b6d4' },
  idle: { label: 'Tạm nghỉ', bg: 'rgba(234,179,8,0.14)', border: 'rgba(234,179,8,0.35)', color: '#ca8a04', dot: '#eab308' },
  offline: { label: 'Ngoại tuyến', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)', color: '#64748b', dot: '#94a3b8' },
};

const PROFILE_GALLERY_IMAGES = Array.from({ length: 6 }, () => '');

const FEATURED_BADGE_LIMIT = 4;
const PROFILE_BADGE_STORAGE_LIMIT = 12;
const DEV_PRIVILEGE_LABEL = 'Dev';
const PRIVILEGE_BADGE_ALIASES = {
  'Dev đặc quyền': DEV_PRIVILEGE_LABEL,
};

const PRIVILEGE_BADGES = [
  { label: DEV_PRIVILEGE_LABEL, desc: 'Huy hiệu Dev do admin cấp', icon: Code2, unlocked: true, privilege: true },
  { label: 'Người đóng góp', desc: 'Đóng góp cho cộng đồng WorkRank', icon: Medal, unlocked: true, privilege: true },
  { label: 'Nhà sáng lập', desc: 'Tài khoản sáng lập hoặc vận hành', icon: Trophy, unlocked: true, privilege: true },
  { label: 'Thành viên VIP', desc: 'Hồ sơ được ưu tiên hiển thị', icon: Crown, unlocked: true, privilege: true },
  { label: 'Đối tác WorkRank', desc: 'Tài khoản đối tác hoặc cộng tác viên', icon: ShieldCheck, unlocked: true, privilege: true },
  { label: 'Người nổi bật', desc: 'Hồ sơ được admin chọn nổi bật', icon: Star, unlocked: true, privilege: true },
];

const PRIVILEGE_BADGE_LABELS = new Set(PRIVILEGE_BADGES.map((badge) => badge.label));

function canonicalPrivilegeBadgeLabel(label) {
  const trimmed = String(label || '').trim();
  return PRIVILEGE_BADGE_ALIASES[trimmed] || trimmed;
}

function isPrivilegeBadgeLabel(label) {
  return PRIVILEGE_BADGE_LABELS.has(canonicalPrivilegeBadgeLabel(label));
}

function isDevProfileUser(user = {}) {
  const id = Number(user.id || user.user_id || user.userId);
  const email = String(user.email || '').trim().toLowerCase();
  const name = String(user.name || '').trim().toLowerCase();
  return email === 'tien@gmail.com' || id === 8 || name === 'dang duy tien';
}

function buildRankTiers() {
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }
  const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
  const GLOW_SCALE = [0.58, 0.76, 1.0, 1.26, 1.56];
  const MAIN_TIERS = [
    {
      name: 'Đồng', title: 'Tân binh tiềm năng',
      levels: [12, 9, 6, 3, 0],
      color: '#b45309', soft: 'rgba(180,83,9,0.12)', accent2: '#d97706', accent3: '#f97316',
      border: 'rgba(180,83,9,0.3)', baseGlow: 16,
    },
    {
      name: 'Bạc', title: 'Người tăng tốc',
      levels: [31, 27, 23, 19, 15],
      color: '#64748b', soft: 'rgba(100,116,139,0.11)', accent2: '#94a3b8', accent3: '#cbd5e1',
      border: 'rgba(100,116,139,0.28)', baseGlow: 17,
    },
    {
      name: 'Vàng', title: 'Chiến binh bền bỉ',
      levels: [55, 50, 45, 40, 35],
      color: '#d97706', soft: 'rgba(217,119,6,0.12)', accent2: '#f59e0b', accent3: '#facc15',
      border: 'rgba(217,119,6,0.32)', baseGlow: 18,
    },
    {
      name: 'Bạch kim', title: 'Cao thủ tập trung',
      levels: [84, 78, 72, 66, 60],
      color: '#2563eb', soft: 'rgba(37,99,235,0.12)', accent2: '#60a5fa', accent3: '#93c5fd',
      border: 'rgba(37,99,235,0.3)', baseGlow: 19,
    },
    {
      name: 'Kim cương', title: 'Đấu sĩ năng suất',
      levels: [122, 114, 106, 98, 90],
      color: '#0891b2', soft: 'rgba(8,145,178,0.12)', accent2: '#38bdf8', accent3: '#67e8f9',
      border: 'rgba(8,145,178,0.3)', baseGlow: 21,
    },
    {
      name: 'Huyền thoại', title: 'Huyền thoại WorkRank',
      levels: [186, 172, 158, 144, 130],
      color: '#7c3aed', soft: 'rgba(124,58,237,0.12)', accent2: '#ec4899', accent3: '#22d3ee',
      border: 'rgba(124,58,237,0.3)', baseGlow: 24,
    },
  ];
  const tiers = [];
  MAIN_TIERS.forEach(({ name, title: baseTitle, levels, color, soft, accent2, accent3, border, baseGlow }) => {
    const rgb = hexToRgb(color);
    const rgb3 = hexToRgb(accent3);
    for (let s = ROMAN.length - 1; s >= 0; s -= 1) {
      const min = levels[ROMAN.length - 1 - s];
      const gs = GLOW_SCALE[s];
      const glowSize = Math.round(baseGlow * gs);
      const glowAlpha = (0.10 + s * 0.018).toFixed(2);
      const cardAlpha = (0.03 + s * 0.005).toFixed(2);
      const badgeAlpha = (0.09 + s * 0.016).toFixed(2);
      const borderAlpha = Math.min(0.48, 0.22 + s * 0.06).toFixed(2);
      tiers.push({
        min: Math.max(0, min),
        tier: `${name} ${ROMAN[s]}`,
        title: `${baseTitle} ${ROMAN[s]}`,
        color,
        soft,
        accent2,
        accent3,
        border: `rgba(${rgb},${borderAlpha})`,
        glow: `0 ${glowSize}px ${Math.round(glowSize * 2)}px rgba(${rgb},${glowAlpha})`,
        heroBg: `linear-gradient(135deg, ${soft} 0%, #ffffff ${44 - s * 2}%, rgba(${rgb3},${(0.08 + s * 0.008).toFixed(2)}) 100%)`,
        cardBg: `linear-gradient(180deg, #ffffff 0%, rgba(${rgb},${cardAlpha}) 100%)`,
        progress: `linear-gradient(90deg, ${color} 0%, ${accent2} ${s >= 3 ? 80 : 100}%)`,
        badgeBg: `rgba(${rgb},${badgeAlpha})`,
      });
    }
  });
  return tiers;
}

const RANK_TIERS = buildRankTiers();
const RANK_TIERS_BY_LEVEL_ASC = [...RANK_TIERS].sort((a, b) => Number(a.min || 0) - Number(b.min || 0));
const RANK_TIERS_BY_LEVEL_DESC = [...RANK_TIERS_BY_LEVEL_ASC].reverse();
const RANK_INDEX_THRESHOLDS = RANK_TIERS_BY_LEVEL_ASC.map((_, index) => index + 1);
const RANK_ACTIVITY_WINDOW_DAYS = 90;

const ANIMAL_COLOR_SEQUENCE = ['#d97706', '#16a34a', '#db2777', '#0891b2', '#7c3aed', '#dc2626'];
const ANIMAL_TRAITS = ['Nhanh nhẹn', 'Bền bỉ', 'Tập trung', 'Bứt tốc', 'Ổn định', 'Tinh anh'];

function buildAchievementTierStyles() {
  const styles = [{
    label: 'Chưa mở',
    color: '#94a3b8',
    accent: '#cbd5e1',
    soft: 'rgba(148,163,184,0.1)',
    border: 'rgba(148,163,184,0.24)',
    glow: '0 8px 18px rgba(148,163,184,0.08)',
  }];
  RANK_TIERS_BY_LEVEL_ASC.forEach((tier) => {
    styles.push({
      label: tier.tier,
      color: tier.color,
      accent: tier.accent2,
      soft: tier.soft,
      border: tier.border,
      glow: tier.glow,
    });
  });
  return styles;
}

const ACHIEVEMENT_TIER_STYLES = buildAchievementTierStyles();

const ANIMAL_LEVEL_NAMES = [
  'Mèo con',
  'Thỏ đồng',
  'Sóc nâu',
  'Chim sẻ',
  'Cá suối',
  'Rùa xanh',
  'Chó săn',
  'Ốc sên bạc',
  'Bọ ánh kim',
  'Chuột nhắt',
  'Sò ngọc',
  'Cáo đỏ',
  'Hươu sao',
  'Gấu trúc',
  'Cú mèo',
  'Hải ly',
  'Linh dương',
  'Sói xám',
  'Báo gấm',
  'Rái cá',
  'Ngựa hoang',
  'Đại bàng',
  'Cá heo',
  'Bò rừng',
  'Lạc đà',
  'Sư tử',
  'Hổ vàng',
  'Gấu trắng',
  'Cá mập',
  'Tê giác',
  'Voi rừng',
  'Khỉ vàng',
  'Báo tuyết',
  'Chim ưng',
  'Cá voi',
  'Gấu xám',
  'Ngựa vằn',
  'Công xanh',
  'Sói tuyết',
  'Bò tót',
  'Rồng Komodo',
  'Kangaroo',
  'Tê tê',
  'Hươu cao cổ',
  'Cá kiếm',
  'Báo đen',
  'Đại bàng vàng',
  'Sư tử trắng',
  'Hổ trắng',
  'Cá voi xanh',
  'Voi ma mút',
];

const ANIMAL_LEVELS = ANIMAL_LEVEL_NAMES.map((name, index) => ({
  name,
  icon: PawPrint,
  iconKey: `animal-${index}`,
}));

const LEVEL_ANIMALS = Array.from({ length: 201 }, (_, level) => {
  const animal = ANIMAL_LEVELS[level % ANIMAL_LEVELS.length];
  return {
    level,
    name: level < ANIMAL_LEVELS.length ? animal.name : `${animal.name} siêu việt`,
    icon: animal.icon,
    iconKey: animal.iconKey,
    color: ANIMAL_COLOR_SEQUENCE[level % ANIMAL_COLOR_SEQUENCE.length],
    trait: ANIMAL_TRAITS[level % ANIMAL_TRAITS.length],
  };
});

const HEAT_COLORS = ['#eef2f7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e'];
const TIMELINE_BUCKET_MINUTES = 15;

function fmtNum(value) {
  const n = Number(value) || 0;
  if (n >= 1000000000) return (n / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toLocaleString();
}

function fmtDur(value) {
  const seconds = Number(value) || 0;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function fmtDate(value) {
  if (!value) return 'Chưa có';
  return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function localDateKey(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function minuteLabel(minuteOfDay) {
  const hour = Math.floor(Number(minuteOfDay || 0) / 60);
  const minute = Number(minuteOfDay || 0) % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function timelineBucketMinute(minuteOfDay) {
  return Math.floor(Number(minuteOfDay || 0) / TIMELINE_BUCKET_MINUTES) * TIMELINE_BUCKET_MINUTES;
}

function dailyStatDate(row = {}) {
  return row.statDate || row.stat_date || row.date || '';
}

function dailyStatKeystrokes(row = {}) {
  return Number(row.keystrokeCount ?? row.keystrokes ?? row.total_keystrokes ?? 0);
}

function dailyStatClicks(row = {}) {
  return Number(row.mouseClickCount ?? row.mouse_clicks ?? row.total_mouse_clicks ?? 0);
}

function dailyStatActiveSeconds(row = {}) {
  return Number(row.activeSeconds ?? row.active_seconds ?? row.total_active_seconds ?? 0);
}

const SUPPORTED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Không đọc được dữ liệu ảnh.'));
    };
    reader.onerror = () => reject(new Error('Không đọc được file ảnh.'));
    reader.readAsDataURL(file);
  });
}

function decodeImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Trình duyệt không decode được ảnh này.'));
    image.src = dataUrl;
  });
}

async function resizeSquareImageFile(file, size = 320) {
  if (!file) throw new Error('Chưa chọn ảnh.');
  const lowerName = String(file.name || '').toLowerCase();
  if (file.type.includes('heic') || file.type.includes('heif') || /\.(heic|heif)$/.test(lowerName)) {
    throw new Error('Ảnh HEIC/HEIF chưa được hỗ trợ. Hãy đổi sang JPG, PNG hoặc WebP.');
  }
  const supportedByType = SUPPORTED_AVATAR_TYPES.includes(file.type);
  const supportedByName = /\.(jpe?g|png|webp|gif|avif)$/.test(lowerName);
  if (!supportedByType && !supportedByName) {
    throw new Error('Chỉ hỗ trợ ảnh JPG, PNG, WebP, AVIF hoặc GIF.');
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('Ảnh tối đa 5MB.');

  const dataUrl = await readFileAsDataUrl(file);
  if (file.type === 'image/gif' || /\.gif$/.test(lowerName)) return dataUrl;

  let image;
  try {
    image = await decodeImage(dataUrl);
  } catch {
    return dataUrl;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx || image.width <= 0 || image.height <= 0) {
    return dataUrl;
  }
  const sourceSize = Math.min(image.width, image.height);
  const sourceX = Math.max(0, (image.width - sourceSize) / 2);
  const sourceY = Math.max(0, (image.height - sourceSize) / 2);
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
  try {
    return canvas.toDataURL('image/jpeg', 0.86);
  } catch {
    return dataUrl;
  }
}

function resizeAvatarFile(file) {
  return resizeSquareImageFile(file, 320);
}

function resizeGalleryFile(file) {
  return resizeSquareImageFile(file, 480);
}

function hydrateLevelInfo(info = {}) {
  const milestones = Array.isArray(info.milestones) ? info.milestones : [];
  const maxLevel = Number(info.maxLevel || 200);
  const totalActions = Number(info.totalActions || 0);
  let level = Number(info.level || 0);

  if (milestones.length) {
    level = milestones.reduce((current, milestone) => (
      totalActions >= Number(milestone.requiredActions || 0)
        ? Math.max(current, Number(milestone.level || 0))
        : current
    ), 0);
  }

  const current = milestones.find((milestone) => Number(milestone.level) === level);
  const next = milestones.find((milestone) => Number(milestone.level) === level + 1);
  const currentLevelActions = Number(current?.requiredActions ?? info.currentLevelActions ?? 0);
  const nextLevelActions = Number(next?.requiredActions ?? info.nextLevelActions ?? currentLevelActions);
  const span = Math.max(1, nextLevelActions - currentLevelActions);
  const progressPercent = level >= maxLevel
    ? 100
    : Math.min(100, Math.max(0, ((totalActions - currentLevelActions) / span) * 100));

  return {
    ...info,
    milestones,
    maxLevel,
    level,
    totalActions,
    totalKeystrokes: Number(info.totalKeystrokes || 0),
    totalMouseClicks: Number(info.totalMouseClicks || 0),
    currentLevelActions,
    nextLevelActions,
    remainingActions: Math.max(0, nextLevelActions - totalActions),
    progressPercent,
  };
}

function applyLevelDelta(info, delta = {}, payload = {}) {
  if (!info) return info;
  const deltaKeys = Number(delta.keystrokeCount ?? payload.keystrokes ?? 0);
  const deltaClicks = Number(delta.mouseClickCount ?? payload.clicks ?? 0);
  if (deltaKeys + deltaClicks <= 0) return info;

  return hydrateLevelInfo({
    ...info,
    totalKeystrokes: Number(info.totalKeystrokes || 0) + deltaKeys,
    totalMouseClicks: Number(info.totalMouseClicks || 0) + deltaClicks,
    totalActions: Number(info.totalActions || 0) + deltaKeys + deltaClicks,
  });
}

function rankActivityRequirement(tier) {
  const level = Number(tier?.min || 0);
  if (level <= 0) {
    return {
      activeDays: 0,
      avgActions: 0,
      avgKeystrokes: 0,
      avgClicks: 0,
      avgInput: 0,
    };
  }
  const avgActions = Math.round(120 + level * 45 + Math.pow(level, 1.18) * 8);
  return {
    activeDays: Math.min(RANK_ACTIVITY_WINDOW_DAYS, Math.max(2, Math.ceil(level / 3.8))),
    avgActions,
    avgKeystrokes: Math.round(avgActions * 0.42),
    avgClicks: Math.round(avgActions * 0.28),
    avgInput: Math.round(avgActions * 0.24),
  };
}

function rankAchievementThresholds(selector) {
  return RANK_TIERS_BY_LEVEL_ASC.map((tier) => Math.max(1, Number(selector(rankActivityRequirement(tier), tier)) || 1));
}

function buildDailyProfile(dailyStats = [], heatmapData = [], todayStats = {}) {
  const todayKey = localDateKey();
  const todayKeystrokes = Number(todayStats?.total_keystrokes || 0);
  const todayClicks = Number(todayStats?.total_mouse_clicks || 0);
  const todayActiveSeconds = Number(todayStats?.total_active_seconds || 0);
  const dailyByDate = new globalThis.Map();

  (Array.isArray(dailyStats) ? dailyStats : []).forEach((row) => {
    const date = dailyStatDate(row);
    if (!date) return;
    dailyByDate.set(date, {
      date,
      keystrokes: dailyStatKeystrokes(row),
      clicks: dailyStatClicks(row),
      activeSeconds: dailyStatActiveSeconds(row),
    });
  });

  if (todayKeystrokes + todayClicks + todayActiveSeconds > 0) {
    dailyByDate.set(todayKey, {
      date: todayKey,
      keystrokes: todayKeystrokes,
      clicks: todayClicks,
      activeSeconds: todayActiveSeconds,
    });
  }

  const splitRows = Array.from(dailyByDate.values())
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(-RANK_ACTIVITY_WINDOW_DAYS);
  const splitActiveRows = splitRows.filter((row) => Number(row.keystrokes || 0) + Number(row.clicks || 0) > 0);
  const splitKeystrokes = splitRows.reduce((sum, row) => sum + Number(row.keystrokes || 0), 0);
  const splitClicks = splitRows.reduce((sum, row) => sum + Number(row.clicks || 0), 0);

  const heatRows = (Array.isArray(heatmapData) ? heatmapData : [])
    .slice(-RANK_ACTIVITY_WINDOW_DAYS)
    .map((row) => ({
      date: row.date,
      actions: Number(row.count || 0),
    }));
  const todayHeatRow = heatRows.find((row) => row.date === todayKey);
  if (todayHeatRow) {
    todayHeatRow.actions = Math.max(todayHeatRow.actions, todayKeystrokes + todayClicks);
  }

  const calendarRows = heatRows.length
    ? heatRows
    : splitRows.map((row) => ({
      date: row.date,
      actions: Number(row.keystrokes || 0) + Number(row.clicks || 0),
    }));
  const calendarDays = Math.max(1, calendarRows.length || splitRows.length || 1);
  const activeDays = calendarRows.filter((row) => Number(row.actions || 0) > 0).length || splitActiveRows.length;
  const totalActions = calendarRows.length
    ? calendarRows.reduce((sum, row) => sum + Number(row.actions || 0), 0)
    : splitKeystrokes + splitClicks;
  const splitActiveDays = Math.max(1, splitActiveRows.length);
  const averageActiveDivisor = Math.max(1, activeDays || splitActiveRows.length);

  return {
    windowDays: RANK_ACTIVITY_WINDOW_DAYS,
    sampleDays: calendarRows.length || splitRows.length,
    activeDays,
    totalActions,
    totalKeystrokes: splitKeystrokes,
    totalClicks: splitClicks,
    avgActionsPerCalendarDay: Math.round(totalActions / calendarDays),
    avgActionsPerActiveDay: Math.round(totalActions / averageActiveDivisor),
    avgKeystrokesPerActiveDay: Math.round(splitKeystrokes / splitActiveDays),
    avgClicksPerActiveDay: Math.round(splitClicks / splitActiveDays),
  };
}

function getRankRequiredActions(tier, milestones = []) {
  const milestone = milestones.find((item) => Number(item.level) === Number(tier.min));
  return Number(milestone?.requiredActions || 0);
}

function isRankTierUnlocked(tier, levelView = {}) {
  const requiredActions = getRankRequiredActions(tier, Array.isArray(levelView.milestones) ? levelView.milestones : []);
  const level = Number(levelView.level || 0);
  const totalActions = Number(levelView.totalActions || 0);
  return level >= Number(tier.min || 0) && (requiredActions <= 0 || totalActions >= requiredActions);
}

function getRankTier(levelViewOrLevel) {
  if (typeof levelViewOrLevel === 'object' && levelViewOrLevel !== null) {
    return RANK_TIERS_BY_LEVEL_DESC.find((tier) => isRankTierUnlocked(tier, levelViewOrLevel))
      || RANK_TIERS_BY_LEVEL_ASC[0];
  }
  return RANK_TIERS_BY_LEVEL_DESC.find((tier) => Number(levelViewOrLevel || 0) >= tier.min)
    || RANK_TIERS_BY_LEVEL_ASC[0];
}

function getRankTierIndex(rank) {
  const index = RANK_TIERS_BY_LEVEL_ASC.findIndex((tier) => tier.tier === rank?.tier);
  return index >= 0 ? index + 1 : 0;
}

function buildRankGuideItems(levelView, currentRank) {
  const items = RANK_TIERS_BY_LEVEL_ASC.map((tier) => ({
    ...tier,
    requiredActions: getRankRequiredActions(tier, Array.isArray(levelView.milestones) ? levelView.milestones : []),
    ...rankActivityRequirement(tier),
    unlocked: isRankTierUnlocked(tier, levelView),
    current: currentRank.tier === tier.tier,
  }));
  const currentIndex = Math.max(0, items.findIndex((item) => item.current));
  const nextIndex = items.findIndex((item) => !item.unlocked);
  const minVisible = 6;
  const start = Math.max(0, Math.min(currentIndex - 2, items.length - minVisible));
  const endTarget = nextIndex >= 0 ? nextIndex + 3 : currentIndex + 4;
  const end = Math.min(items.length, Math.max(start + minVisible, endTarget));
  return items.slice(start, end);
}

function getCurrentStreak(heatmapData) {
  let streak = 0;
  for (let index = heatmapData.length - 1; index >= 0; index -= 1) {
    if (Number(heatmapData[index]?.count || 0) <= 0) break;
    streak += 1;
  }
  return streak;
}

function getBestDay(heatmapData) {
  return heatmapData.reduce((best, row) => {
    const count = Number(row?.count || 0);
    return count > Number(best.count || 0) ? { date: row.date, count } : best;
  }, { date: null, count: 0 });
}

function getPeakBucket(timeline) {
  return timeline.reduce((best, row) => {
    const actions = Number(row?.keystrokes || 0) + Number(row?.mouse_clicks || 0);
    return actions > Number(best.actions || 0)
      ? { actions, time: row.time || minuteLabel(row.minute || 0) }
      : best;
  }, { actions: 0, time: '00:00' });
}

function getSessionRecords(sessions) {
  return sessions.reduce((records, session) => {
    const duration = Number(session.durationSeconds || session.activeSeconds || 0);
    const actions = Number(session.keystrokeCount || 0) + Number(session.mouseClickCount || 0);
    return {
      longest: duration > records.longest ? duration : records.longest,
      bestActions: actions > records.bestActions ? actions : records.bestActions,
      running: records.running + (session.status === 'running' ? 1 : 0),
    };
  }, { longest: 0, bestActions: 0, running: 0 });
}

function buildMilestoneTrack(levelInfo) {
  const milestones = levelInfo.milestones || [];
  if (!milestones.length) return [];
  const maxLevel = Number(levelInfo.maxLevel || 200);
  const currentLevel = Number(levelInfo.level || 0);
  const start = currentLevel <= 2 ? 0 : currentLevel >= maxLevel - 3 ? Math.max(0, maxLevel - 5) : currentLevel - 2;
  return Array.from({ length: 6 }, (_, index) => start + index)
    .filter((level) => level <= maxLevel)
    .map((level) => milestones.find((item) => Number(item.level) === level) || { level, requiredActions: 0 });
}

function getLevelAnimal(level) {
  const index = Math.min(LEVEL_ANIMALS.length - 1, Math.max(0, Number(level || 0)));
  return LEVEL_ANIMALS[index] || LEVEL_ANIMALS[0];
}

function buildAnimalCollection(currentLevel, maxLevel = 200) {
  const visibleMax = Math.min(Number(maxLevel || 200), LEVEL_ANIMALS.length - 1);
  const current = Math.min(visibleMax, Math.max(0, Number(currentLevel || 0)));
  const windowSize = 24;
  const start = Math.max(0, Math.min(current - 8, Math.max(0, visibleMax - windowSize + 1)));
  const end = Math.min(visibleMax + 1, start + windowSize);
  return LEVEL_ANIMALS.slice(start, end).map((animal) => ({
    ...animal,
    unlocked: animal.level <= Number(currentLevel || 0),
    current: animal.level === Number(currentLevel || 0),
  }));
}

function animalCollectionTotals(currentLevel, maxLevel = 200) {
  const total = Math.min(Number(maxLevel || 200), LEVEL_ANIMALS.length - 1) + 1;
  const unlocked = Math.min(total, Math.max(0, Number(currentLevel || 0) + 1));
  return { total, unlocked };
}

function resolveAchievementTier(value, thresholds) {
  const tierIndex = thresholds.reduce((tier, threshold, index) => (
    Number(value || 0) >= threshold ? index + 1 : tier
  ), 0);
  return {
    tierIndex,
    nextTarget: thresholds[tierIndex] || null,
    ...ACHIEVEMENT_TIER_STYLES[tierIndex],
  };
}

function buildAchievementBadge({ label, icon, value, thresholds, desc, nextDesc }) {
  const tier = resolveAchievementTier(value, thresholds);
  return {
    label,
    icon,
    unlocked: tier.tierIndex > 0,
    tierIndex: tier.tierIndex,
    tierLabel: tier.label,
    tierColor: tier.color,
    tierAccent: tier.accent,
    tierSoft: tier.soft,
    tierBorder: tier.border,
    tierGlow: tier.glow,
    desc: tier.tierIndex > 0 ? desc(tier) : nextDesc(tier),
  };
}

function achievementStyleVars(badge) {
  return {
    '--badge-color': badge.tierColor || '#94a3b8',
    '--badge-accent': badge.tierAccent || '#cbd5e1',
    '--badge-soft': badge.tierSoft || 'rgba(148,163,184,0.1)',
    '--badge-border': badge.tierBorder || 'rgba(148,163,184,0.24)',
    '--badge-glow': badge.tierGlow || '0 8px 18px rgba(148,163,184,0.08)',
  };
}

function buildBadges({ levelView, currentStreak, dailyProfile, rank }) {
  const rankIndex = getRankTierIndex(rank);
  const averageActionThresholds = rankAchievementThresholds((requirement) => requirement.avgActions);
  const averageKeystrokeThresholds = rankAchievementThresholds((requirement) => requirement.avgKeystrokes);
  const averageClickThresholds = rankAchievementThresholds((requirement) => requirement.avgClicks);
  const streakThresholds = RANK_TIERS_BY_LEVEL_ASC.map((tier) => Math.max(1, Math.ceil((Number(tier.min || 0) + 1) / 3)));
  return [
    buildAchievementBadge({
      label: 'Cấp bậc',
      icon: Medal,
      value: rankIndex,
      thresholds: RANK_INDEX_THRESHOLDS,
      desc: () => `${rank.tier} · Level ${levelView.level} · ${fmtNum(levelView.totalActions)} thao tác`,
      nextDesc: (tier) => `Cần đạt mốc rank ${tier.nextTarget || 1}`,
    }),
    buildAchievementBadge({
      label: 'Trung bình ngày',
      icon: Gauge,
      value: Number(dailyProfile.avgActionsPerActiveDay || 0),
      thresholds: averageActionThresholds,
      desc: () => `TB ${fmtNum(dailyProfile.avgActionsPerActiveDay)} thao tác/ngày active trong ${dailyProfile.windowDays} ngày`,
      nextDesc: (tier) => `Cần TB ${fmtNum(tier.nextTarget || 100)} thao tác/ngày active`,
    }),
    buildAchievementBadge({
      label: 'Gõ phím/ngày',
      icon: Keyboard,
      value: Number(dailyProfile.avgKeystrokesPerActiveDay || 0),
      thresholds: averageKeystrokeThresholds,
      desc: () => `TB ${fmtNum(dailyProfile.avgKeystrokesPerActiveDay)} phím/ngày active`,
      nextDesc: (tier) => `Cần TB ${fmtNum(tier.nextTarget || 50)} phím/ngày active`,
    }),
    buildAchievementBadge({
      label: 'Click/ngày',
      icon: Mouse,
      value: Number(dailyProfile.avgClicksPerActiveDay || 0),
      thresholds: averageClickThresholds,
      desc: () => `TB ${fmtNum(dailyProfile.avgClicksPerActiveDay)} click/ngày active`,
      nextDesc: (tier) => `Cần TB ${fmtNum(tier.nextTarget || 40)} click/ngày active`,
    }),
    buildAchievementBadge({
      label: 'Chuỗi bền bỉ',
      icon: Flame,
      value: currentStreak,
      thresholds: streakThresholds,
      desc: () => `${fmtNum(currentStreak)} ngày liên tiếp có hoạt động`,
      nextDesc: (tier) => `Cần chuỗi ${fmtNum(tier.nextTarget || 1)} ngày`,
    }),
  ];
}

function normalizeFeaturedBadgeLabels(labels) {
  return (Array.isArray(labels) ? labels : [])
    .map((label) => String(label || '').trim())
    .filter(Boolean)
    .filter((label, index, list) => list.indexOf(label) === index)
    .slice(0, PROFILE_BADGE_STORAGE_LIMIT);
}

function buildProfileGallery(images = []) {
  const next = [...PROFILE_GALLERY_IMAGES];
  if (!Array.isArray(images)) return next;
  images.forEach((image) => {
    const slot = Number(image?.slot);
    const imageData = image?.imageData || image?.image_data;
    if (Number.isInteger(slot) && slot >= 0 && slot < next.length && imageData) {
      next[slot] = imageData;
    }
  });
  return next;
}

function profileSaveError(error, fallback) {
  const status = error?.response?.status;
  if (status === 403) return 'Bạn chỉ có thể chỉnh hồ sơ của mình.';
  if (status === 413) return 'Ảnh quá lớn để gửi lên server. Hãy chọn ảnh nhẹ hơn.';
  return error?.response?.data?.message || error?.message || fallback;
}

function buildPowerScore({ levelView, score, currentStreak, todayActions, dailyProfile }) {
  const levelScore = Number(levelView.level || 0) * 1000;
  const focusScore = Math.round(Number(score || 0) * 12);
  const volumeScore = Math.round(Math.log10(Number(levelView.totalActions || 0) + 1) * 420);
  const streakScore = Number(currentStreak || 0) * 35;
  const todayScore = Math.min(600, Math.round(Number(todayActions || 0) / 80));
  const averageScore = Math.round(Math.log10(Number(dailyProfile?.avgActionsPerActiveDay || 0) + 1) * 520);
  const inputScore = Math.round(Math.log10(Number(dailyProfile?.avgKeystrokesPerActiveDay || 0) + Number(dailyProfile?.avgClicksPerActiveDay || 0) + 1) * 180);
  const activeDayScore = Math.min(1200, Number(dailyProfile?.activeDays || 0) * 18);
  return levelScore + focusScore + volumeScore + streakScore + todayScore + averageScore + inputScore + activeDayScore;
}

function StatusPill({ statusConfig }) {
  return (
    <span className="profile-status-pill" style={{ color: statusConfig.color, background: statusConfig.bg, borderColor: statusConfig.border }}>
      <span style={{ background: statusConfig.dot }} />
      {statusConfig.label}
    </span>
  );
}

function VerifiedMark({ size = 20 }) {
  return (
    <span
      title="Tích xanh được quản trị viên cấp"
      aria-label="Đã được cấp tích xanh"
      style={{ display: 'inline-flex', alignItems: 'center' }}
    >
      <VerifiedBadge size={size} />
    </span>
  );
}

function DevPill() {
  return (
    <span className="profile-dev-pill" title="Dev" aria-label="Huy hiệu Dev">
      <Code2 className="profile-dev-mark" size={13} strokeWidth={2.7} aria-hidden="true" />
      <span className="profile-dev-label">Dev</span>
    </span>
  );
}

function RankGuide({ items, currentLevel, totalActions, dailyProfile }) {
  const nextRank = items.find((item) => !item.unlocked);
  const nextRemainingLevel = nextRank
    ? Math.max(0, Number(nextRank.min || 0) - Number(currentLevel || 0))
    : 0;
  const nextRemainingActions = nextRank
    ? Math.max(0, Number(nextRank.requiredActions || 0) - Number(totalActions || 0))
    : 0;
  const nextRequirements = [
    nextRemainingLevel > 0 ? `cần Level ${nextRank.min}` : '',
    nextRemainingActions > 0 ? `còn ${fmtNum(nextRemainingActions)} thao tác` : '',
  ].filter(Boolean).join(' · ');

  return (
    <div className="profile-rank-help">
      <button
        type="button"
        className="profile-rank-help-trigger"
        aria-label="Xem cách lên các bậc rank"
      >
        ?
      </button>
      <div className="profile-rank-help-popover" role="tooltip">
        <div className="profile-rank-help-head">
          <div>
            <strong>Cách lên bậc rank</strong>
            <span>Cấp {currentLevel} · {fmtNum(totalActions)} thao tác · TB {fmtNum(dailyProfile?.avgActionsPerActiveDay)} / ngày active</span>
          </div>
        </div>
        <p>
          Rank xét theo mốc level và tổng thao tác tích lũy. Nhịp trung bình {RANK_ACTIVITY_WINDOW_DAYS} ngày gần nhất chỉ dùng cho huy hiệu phụ.
        </p>
        <div className="profile-rank-guide-list">
          {items.map((item) => (
            <div
              key={item.tier}
              className={item.current ? 'profile-rank-guide-item is-current' : item.unlocked ? 'profile-rank-guide-item is-unlocked' : 'profile-rank-guide-item'}
              style={{ '--tier-color': item.color, '--tier-bg': item.badgeBg }}
            >
              <span className="profile-rank-guide-dot" />
              <div>
                <strong>{item.tier}</strong>
                <span>
                  {item.min === 0
                    ? 'Bắt đầu từ cấp 0'
                    : `Cấp ${item.min}${item.requiredActions > 0 ? ` · ${fmtNum(item.requiredActions)} thao tác` : ''}`}
                </span>
              </div>
              <em>{item.current ? 'Hiện tại' : item.unlocked ? 'Đã mở' : 'Chưa mở'}</em>
            </div>
          ))}
        </div>
        <div className="profile-rank-help-next">
          {nextRank
            ? `Mốc kế tiếp: ${nextRank.tier} · ${nextRequirements || 'đã đủ điều kiện nền'}.`
            : 'Bạn đang ở bậc rank cao nhất.'}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone = '#0891b2' }) {
  return (
    <div className="profile-metric-card">
      <div className="profile-metric-icon" style={{ color: tone, background: `${tone}14` }}>
        <Icon size={18} strokeWidth={2.4} />
      </div>
      <div>
        <div className="profile-metric-label">{label}</div>
        <div className="profile-metric-value">{value}</div>
        <div className="profile-metric-detail">{detail}</div>
      </div>
    </div>
  );
}

function RecordCard({ icon: Icon, label, value, detail, strong }) {
  return (
    <div className={strong ? 'profile-record-card is-strong' : 'profile-record-card'}>
      <div className="profile-record-top">
        <span>{label}</span>
        <Icon size={17} strokeWidth={2.4} />
      </div>
      <div className="profile-record-value">{value}</div>
      <div className="profile-record-detail">{detail}</div>
    </div>
  );
}

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { socket, user: authUser, setUser: setAuthUser } = useAuth();
  const pageVisible = usePageVisibility();
  const avatarInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const galleryContainerRef = useRef(null);
  const chartContainerRef = useRef(null);
  const gallerySlotRef = useRef(PROFILE_GALLERY_IMAGES.length - 1);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [dailyStats, setDailyStats] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [levelInfo, setLevelInfo] = useState(null);
  const [localAvatarUrl, setLocalAvatarUrl] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [galleryImages, setGalleryImages] = useState(PROFILE_GALLERY_IMAGES);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState('');
  const [featuredBadgeLabels, setFeaturedBadgeLabels] = useState([]);
  const [hasFeaturedBadgePreference, setHasFeaturedBadgePreference] = useState(false);
  const [badgeEditorOpen, setBadgeEditorOpen] = useState(false);
  const [badgeEditorError, setBadgeEditorError] = useState('');
  const [profileLikes, setProfileLikes] = useState({ totalCount: 0, todayCount: 0, likedToday: false, canLikeToday: false });
  const [heartPending, setHeartPending] = useState(false);
  const [heartError, setHeartError] = useState('');
  const [friendshipState, setFriendshipState] = useState({ status: 'none', requestId: null });
  const [friendPending, setFriendPending] = useState(false);
  const [friendError, setFriendError] = useState('');
  const [loading, setLoading] = useState(true);
  const [chartNow, setChartNow] = useState(new Date());
  const [chartVisible, setChartVisible] = useState(false);

  useEffect(() => {
    if (!pageVisible) return undefined;
    let mounted = true;

    const fetchAll = async () => {
      try {
        const today = localDateKey();
        const [userRes, statRes, dailyRes, timelineRes, heatmapRes, sessionRes, levelRes] = await Promise.all([
          usersApi.get(id),
          activity.userStats(id),
          activity.daily(id, RANK_ACTIVITY_WINDOW_DAYS),
          activity.timeline(id, today, 'quarter'),
          activity.heatmap(id),
          activity.sessions(id, 10),
          activity.level(id),
        ]);

        if (!mounted) return;
        setUser(userRes.data);
        setStats(statRes.data);
        setDailyStats(dailyRes.data || []);
        setTimeline(timelineRes.data || []);
        setHeatmapData(heatmapRes.data || []);
        setSessions(sessionRes.data || []);
        setLevelInfo(hydrateLevelInfo(levelRes.data));
      } catch (err) {
        console.error('Failed to fetch user detail:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchAll();
    return () => {
      mounted = false;
    };
  }, [id, pageVisible]);

  useEffect(() => {
    let mounted = true;
    setFriendshipState({ status: 'none', requestId: null });
    setFriendError('');

    if (!authUser?.id || String(authUser.id) === String(id)) {
      return () => {
        mounted = false;
      };
    }

    const loadFriendshipState = async () => {
      const [friendResult, requestResult] = await Promise.allSettled([
        friendsApi.list(),
        friendsApi.requests(),
      ]);
      if (!mounted) return;

      const targetId = String(id);
      const friendRows = friendResult.status === 'fulfilled' ? friendResult.value.data || [] : [];
      const requests = requestResult.status === 'fulfilled' ? requestResult.value.data || {} : {};
      const incoming = requests.incoming || [];
      const outgoing = requests.outgoing || [];

      const friend = friendRows.find((row) => String(row.friend?.id || row.friend?.user_id || '') === targetId);
      if (friend) {
        setFriendshipState({ status: 'friend', requestId: friend.friendshipId || friend.id || null });
      } else {
        const incomingRequest = incoming.find((row) => String(row.friend?.id || row.friend?.user_id || '') === targetId);
        const outgoingRequest = outgoing.find((row) => String(row.friend?.id || row.friend?.user_id || '') === targetId);
        if (incomingRequest) {
          setFriendshipState({ status: 'incoming', requestId: incomingRequest.friendshipId || incomingRequest.id || null });
        } else if (outgoingRequest) {
          setFriendshipState({ status: 'outgoing', requestId: outgoingRequest.friendshipId || outgoingRequest.id || null });
        }
      }

      if (friendResult.status === 'rejected' || requestResult.status === 'rejected') {
        setFriendError('Chưa tải được trạng thái kết bạn.');
      }
    };

    loadFriendshipState();
    return () => {
      mounted = false;
    };
  }, [authUser?.id, id]);

  useEffect(() => {
    if (!pageVisible) return undefined;
    const timer = window.setInterval(() => setChartNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [pageVisible]);

  useEffect(() => {
    let observer = null;
    if (loading) return undefined;
    const node = chartContainerRef.current;
    if (!node || chartVisible) return undefined;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setChartVisible(true);
        observer?.disconnect();
      }, { rootMargin: '260px' });
      observer.observe(node);
      return () => observer?.disconnect();
    }
    const timer = window.setTimeout(() => setChartVisible(true), 1000);
    return () => window.clearTimeout(timer);
  }, [chartVisible, loading]);

  useEffect(() => {
    let mounted = true;

    setLocalAvatarUrl('');
    setAvatarError('');
    setGalleryImages(PROFILE_GALLERY_IMAGES);
    setGalleryLoading(false);
    setGalleryError('');
    setFeaturedBadgeLabels([]);
    setHasFeaturedBadgePreference(false);
    setBadgeEditorError('');
    setBadgeEditorOpen(false);
    setHeartError('');

    const fetchProfileCustomization = async () => {
      const [preferenceResult, likesResult] = await Promise.allSettled([
        usersApi.profilePreferences(id),
        usersApi.profileLikes(id),
      ]);
      if (!mounted) return;

      if (preferenceResult.status === 'fulfilled') {
        const preferences = preferenceResult.value.data || {};
        setLocalAvatarUrl(preferences.avatarData || '');
        if (preferences.avatarData) {
          setStoredAvatar(id, preferences.avatarData);
        } else {
          removeStoredAvatar(id);
        }
        setFeaturedBadgeLabels(normalizeFeaturedBadgeLabels(preferences.featuredBadges));
        setHasFeaturedBadgePreference(Boolean(preferences.hasFeaturedBadgesPreference));
      } else {
        console.error('Failed to fetch profile preferences:', preferenceResult.reason);
      }

      if (likesResult.status === 'fulfilled') {
        setProfileLikes({
          totalCount: Number(likesResult.value.data?.totalCount || 0),
          todayCount: Number(likesResult.value.data?.todayCount || 0),
          likedToday: Boolean(likesResult.value.data?.likedToday),
          canLikeToday: Boolean(likesResult.value.data?.canLikeToday),
        });
      } else {
        console.error('Failed to fetch profile likes:', likesResult.reason);
      }
    };

    fetchProfileCustomization();
    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    let mounted = true;
    let observer = null;
    let timer = null;
    if (loading) return undefined;

    const loadGallery = async () => {
      if (!mounted) return;
      setGalleryLoading(true);
      try {
        const res = await usersApi.gallery(id);
        if (!mounted) return;
        setGalleryImages(buildProfileGallery(res.data));
        setGalleryError('');
      } catch (error) {
        if (mounted) {
          console.error('Failed to fetch profile gallery:', error);
          setGalleryError('Chưa tải được ảnh giới thiệu.');
        }
      } finally {
        if (mounted) setGalleryLoading(false);
      }
    };

    const node = galleryContainerRef.current;
    if ('IntersectionObserver' in window && node) {
      observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer?.disconnect();
        void loadGallery();
      }, { rootMargin: '240px' });
      observer.observe(node);
    } else {
      timer = window.setTimeout(() => {
        void loadGallery();
      }, 800);
    }

    return () => {
      mounted = false;
      observer?.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [id, loading]);

  useEffect(() => {
    if (!socket || !pageVisible) return undefined;

    const sameUser = (payload = {}) => String(payload.userId || payload.user_id || payload.id) === String(id);
    const updatePresence = (payload = {}) => {
      if (!sameUser(payload)) return;
      const nextStatus = payload.presence || payload.presenceStatus || payload.status || 'online';
      setUser((prev) => prev ? {
        ...prev,
        ...payload,
        id: prev.id,
        user_id: prev.user_id,
        status: nextStatus,
        presence: nextStatus,
        presenceStatus: nextStatus,
      } : prev);
    };

    const updateActivity = (payload = {}) => {
      if (!sameUser(payload)) return;
      updatePresence(payload);

      if (payload.totals) {
        setStats((prev) => ({
          ...(prev || {}),
          total_active_seconds: Number(payload.totals.activeSeconds || 0),
          total_idle_seconds: Number(payload.totals.idleSeconds || 0),
          total_keystrokes: Number(payload.totals.keystrokeCount || 0),
          total_mouse_clicks: Number(payload.totals.mouseClickCount || 0),
          score: Number(payload.totals.focusScore || payload.score || 0),
        }));
      }

      const delta = payload.delta || {};
      setLevelInfo((prev) => applyLevelDelta(prev, delta, payload));
      const todayKey = localDateKey();
      setDailyStats((prev) => {
        const next = [...prev];
        const idx = next.findIndex((row) => dailyStatDate(row) === todayKey);
        const current = idx >= 0 ? next[idx] : { statDate: todayKey, keystrokeCount: 0, mouseClickCount: 0, activeSeconds: 0, idleSeconds: 0 };
        const updated = {
          ...current,
          statDate: todayKey,
          keystrokeCount: dailyStatKeystrokes(current) + Number(delta.keystrokeCount || payload.keystrokes || 0),
          mouseClickCount: dailyStatClicks(current) + Number(delta.mouseClickCount || payload.clicks || 0),
          activeSeconds: dailyStatActiveSeconds(current) + Number(delta.activeSeconds || 0),
        };
        if (idx >= 0) next[idx] = updated;
        else next.unshift(updated);
        return next.slice(0, RANK_ACTIVITY_WINDOW_DAYS);
      });
      const eventTime = payload.lastEventAt ? new Date(payload.lastEventAt) : new Date();
      const minute = timelineBucketMinute(eventTime.getHours() * 60 + eventTime.getMinutes());
      setTimeline((prev) => {
        const next = [...prev];
        const idx = next.findIndex((row) => Number(row.minute) === minute);
        const current = idx >= 0 ? next[idx] : {
          minute,
          hour: Math.floor(minute / 60),
          time: minuteLabel(minute),
          keystrokes: 0,
          mouse_clicks: 0,
          active_seconds: 0,
          idle_seconds: 0,
        };
        const updated = {
          ...current,
          keystrokes: Number(current.keystrokes || 0) + Number(delta.keystrokeCount || payload.keystrokes || 0),
          mouse_clicks: Number(current.mouse_clicks || 0) + Number(delta.mouseClickCount || payload.clicks || 0),
          active_seconds: Number(current.active_seconds || 0) + Number(delta.activeSeconds || 0),
          idle_seconds: Number(current.idle_seconds || 0) + Number(delta.idleSeconds || 0),
        };
        if (idx >= 0) next[idx] = updated;
        else next.push(updated);
        return next.sort((a, b) => Number(a.minute || 0) - Number(b.minute || 0));
      });
    };

    socket.on('user:status:update', updatePresence);
    socket.on('activity:user:update', updateActivity);
    return () => {
      socket.off('user:status:update', updatePresence);
      socket.off('activity:user:update', updateActivity);
    };
  }, [socket, id, pageVisible]);

  const derived = useMemo(() => {
    const levelView = hydrateLevelInfo(levelInfo || {});
    const todayActions = Number(stats?.total_keystrokes || 0) + Number(stats?.total_mouse_clicks || 0);
    const score = Number(stats?.score || 0);
    const dailyProfile = buildDailyProfile(dailyStats, heatmapData, stats || {});
    const rank = getRankTier(levelView);
    const currentStreak = getCurrentStreak(heatmapData);
    const bestDay = getBestDay(heatmapData);
    const peakBucket = getPeakBucket(timeline);
    const sessionRecords = getSessionRecords(sessions);
    const activeSeconds = Number(stats?.total_active_seconds || 0);
    const actionsPerHour = activeSeconds > 0 ? Math.round((todayActions / activeSeconds) * 3600) : 0;
    const badges = buildBadges({ levelView, currentStreak, dailyProfile, rank });
    const achievementBadges = badges.filter((badge) => !badge.privilege);
    const unlockedBadges = achievementBadges.filter((badge) => badge.unlocked).length;
    const animalCollection = buildAnimalCollection(levelView.level, levelView.maxLevel);
    const currentAnimal = getLevelAnimal(levelView.level);
    const nextAnimal = getLevelAnimal(Math.min(levelView.maxLevel, levelView.level + 1));
    const animalTotals = animalCollectionTotals(levelView.level, levelView.maxLevel);
    const powerScore = buildPowerScore({ levelView, score, currentStreak, todayActions, dailyProfile });
    return {
      levelView,
      dailyProfile,
      todayActions,
      score,
      rank,
      currentStreak,
      bestDay,
      peakBucket,
      sessionRecords,
      activeSeconds,
      actionsPerHour,
      badges,
      achievementBadges,
      unlockedBadges,
      animalCollection,
      currentAnimal,
      nextAnimal,
      unlockedAnimals: animalTotals.unlocked,
      totalAnimals: animalTotals.total,
      powerScore,
      milestoneTrack: buildMilestoneTrack(levelView),
    };
  }, [dailyStats, heatmapData, levelInfo, sessions, stats, timeline]);

  if (loading) {
    return (
      <div className="profile-page-state">
        <div className="profile-loading-spinner" />
        <span>Đang tải hồ sơ...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile-page-state">
        <UserRound size={40} strokeWidth={1.5} />
        <span>Không tìm thấy người dùng</span>
      </div>
    );
  }

  const {
    levelView,
    dailyProfile,
    todayActions,
    score,
    rank,
    currentStreak,
    bestDay,
    peakBucket,
    sessionRecords,
    activeSeconds,
    actionsPerHour,
    badges,
    achievementBadges,
    unlockedBadges,
    animalCollection,
    currentAnimal,
    nextAnimal,
    unlockedAnimals,
    totalAnimals,
    powerScore,
    milestoneTrack,
  } = derived;

  const status = (user.presence || user.presenceStatus || user.status || 'offline').toLowerCase();
  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
  const isVerified = user.isVerified === true || user.verified === true || user.is_verified === true || user.isVerified === 1 || user.verified === 1 || user.is_verified === 1 || user.isVerified === '1' || user.verified === '1' || user.is_verified === '1';
  const canEditAvatar = String(authUser?.id || '') === String(user.id || id);
  const canCustomizeProfile = canEditAvatar || authUser?.role === 'admin';
  const canHeartProfile = Boolean(authUser?.id) && String(authUser.id) !== String(user.id || id);
  const canFriendProfile = Boolean(authUser?.id) && String(authUser.id) !== String(user.id || id);
  const unlockedBadgeList = achievementBadges.filter((badge) => badge.unlocked);
  const inferredPrivilegeLabels = isDevProfileUser(user) ? [DEV_PRIVILEGE_LABEL] : [];
  const privilegeLabels = [...inferredPrivilegeLabels, ...normalizeFeaturedBadgeLabels(featuredBadgeLabels).filter(isPrivilegeBadgeLabel)]
    .map(canonicalPrivilegeBadgeLabel)
    .filter((label, index, list) => list.indexOf(label) === index);
  const privilegeBadges = privilegeLabels
    .map((label) => PRIVILEGE_BADGES.find((badge) => badge.label === label))
    .filter(Boolean);
  const selectableBadgeList = unlockedBadgeList;
  const normalizedFeaturedLabels = normalizeFeaturedBadgeLabels(featuredBadgeLabels)
    .filter((label) => !isPrivilegeBadgeLabel(label));
  const validFeaturedLabels = normalizedFeaturedLabels
    .filter((label) => selectableBadgeList.some((badge) => badge.label === label));
  const shouldFallbackFeaturedLabels = !hasFeaturedBadgePreference || (normalizedFeaturedLabels.length > 0 && validFeaturedLabels.length === 0);
  const selectedFeaturedLabels = (shouldFallbackFeaturedLabels ? unlockedBadgeList.slice(0, FEATURED_BADGE_LIMIT).map((badge) => badge.label) : validFeaturedLabels)
    .filter((label, index, list) => list.indexOf(label) === index)
    .slice(0, FEATURED_BADGE_LIMIT);
  const featuredBadges = selectedFeaturedLabels
    .map((label) => selectableBadgeList.find((badge) => badge.label === label))
    .filter(Boolean);
  const featuredBadgeSlots = Array.from({ length: FEATURED_BADGE_LIMIT }, (_, index) => featuredBadges[index] || null);
  const photoUrl = localAvatarUrl || user.avatarData || user.avatarUrl || user.photoUrl || user.imageUrl || '';
  const avatarInitials = initialsFromName(user.name || `User #${id}`);
  const avatarHueValue = avatarHue(user.name, user.id || id);
  const CurrentAnimalIcon = currentAnimal.icon;
  const NextAnimalIcon = nextAnimal.icon;
  const currentMinute = chartNow.getHours() * 60 + chartNow.getMinutes();
  const currentBucket = timelineBucketMinute(currentMinute);
  const minuteMap = new globalThis.Map(timeline.map((row) => [Number(row.minute), row]));
  const chartData = Array.from({ length: Math.floor(currentBucket / TIMELINE_BUCKET_MINUTES) + 1 }, (_, index) => {
    const minute = index * TIMELINE_BUCKET_MINUTES;
    const row = minuteMap.get(minute);
    return {
      time: minuteLabel(minute),
      keystrokes: row ? Number(row.keystrokes) : 0,
      clicks: row ? Number(row.mouse_clicks) : 0,
    };
  });
  const chartTickInterval = Math.max(1, Math.floor(chartData.length / 6));
  const heatmap = (() => {
    const weeks = [];
    const data = heatmapData.length === 365 ? heatmapData : Array(365).fill({ date: '', count: 0, level: 0 });
    for (let weekIndex = 0; weekIndex < 53; weekIndex += 1) {
      const week = [];
      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const idx = weekIndex * 7 + dayIndex;
        if (idx < data.length) week.push(data[idx]);
      }
      if (week.length) weeks.push(week);
    }
    return weeks;
  })();

  const recentSessions = sessions.map((session, index) => {
    const started = session.startedAt ? new Date(session.startedAt) : null;
    const ended = session.endedAt ? new Date(session.endedAt) : null;
    const duration = Number(session.durationSeconds || session.activeSeconds || 0);
    const time = started
      ? `${started.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${ended ? ended.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'đang chạy'} (${fmtDur(duration)})`
      : 'Không rõ thời gian';
    return {
      name: `Phiên hoạt động #${sessions.length - index}`,
      time,
      actions: Number(session.keystrokeCount || 0) + Number(session.mouseClickCount || 0),
      active: session.status === 'running',
    };
  });

  const handleAvatarPick = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const previousAvatar = localAvatarUrl;
    const profileUserId = user.id || id;

    try {
      const dataUrl = await resizeAvatarFile(file);
      setLocalAvatarUrl(dataUrl);
      setStoredAvatar(profileUserId, dataUrl);
      setUser((current) => (current ? { ...current, avatarData: dataUrl } : current));
      if (canEditAvatar) {
        setAuthUser((current) => (current ? { ...current, avatarData: dataUrl } : current));
      }
      await usersApi.updateProfilePreferences(user.id || id, { avatarData: dataUrl });
      setAvatarError('');
    } catch (error) {
      setLocalAvatarUrl(previousAvatar);
      if (previousAvatar) {
        setStoredAvatar(profileUserId, previousAvatar);
      } else {
        removeStoredAvatar(profileUserId);
      }
      setUser((current) => (current ? { ...current, avatarData: previousAvatar || null } : current));
      if (canEditAvatar) {
        setAuthUser((current) => (current ? { ...current, avatarData: previousAvatar || null } : current));
      }
      setAvatarError(profileSaveError(error, 'Không đổi được ảnh đại diện.'));
    } finally {
      event.target.value = '';
    }
  };

  const toggleFeaturedBadge = async (label) => {
    if (!canCustomizeProfile) return;
    const storedLabels = normalizeFeaturedBadgeLabels(featuredBadgeLabels);
    const storedPrivilegeLabels = storedLabels.filter(isPrivilegeBadgeLabel);
    const base = normalizeFeaturedBadgeLabels(hasFeaturedBadgePreference ? featuredBadgeLabels : selectedFeaturedLabels)
      .filter((item) => !isPrivilegeBadgeLabel(item))
      .filter((item) => selectableBadgeList.some((badge) => badge.label === item));
    const exists = base.includes(label);
    const nextAchievements = exists
      ? base.filter((item) => item !== label)
      : base.length >= FEATURED_BADGE_LIMIT ? base : [...base, label];
    const next = [...storedPrivilegeLabels, ...nextAchievements];

    setFeaturedBadgeLabels(next);
    setHasFeaturedBadgePreference(true);
    setBadgeEditorError('');
    try {
      await usersApi.updateProfilePreferences(user.id || id, { featuredBadges: next });
    } catch (error) {
      setFeaturedBadgeLabels(base);
      setHasFeaturedBadgePreference(hasFeaturedBadgePreference);
      setBadgeEditorError(profileSaveError(error, 'Không lưu được huy hiệu nổi bật.'));
    }
  };

  const openGalleryPicker = (index) => {
    if (!canCustomizeProfile) return;
    gallerySlotRef.current = index;
    galleryInputRef.current?.click();
  };

  const handleGalleryPick = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const slot = gallerySlotRef.current;
    const previousImages = galleryImages;

    try {
      const dataUrl = await resizeGalleryFile(file);
      setGalleryImages((current) => current.map((imageUrl, index) => (index === slot ? dataUrl : imageUrl)));
      await usersApi.updateGalleryImage(user.id || id, slot, dataUrl);
      setGalleryError('');
    } catch (error) {
      setGalleryImages(previousImages);
      setGalleryError(profileSaveError(error, 'Không thêm được ảnh giới thiệu.'));
    } finally {
      event.target.value = '';
    }
  };

  const handleHeartProfile = async () => {
    if (!canHeartProfile || !profileLikes.canLikeToday || heartPending) return;
    setHeartPending(true);
    setHeartError('');
    try {
      const res = await usersApi.likeProfile(user.id || id);
      setProfileLikes({
        totalCount: Number(res.data?.totalCount || 0),
        todayCount: Number(res.data?.todayCount || 0),
        likedToday: Boolean(res.data?.likedToday),
        canLikeToday: Boolean(res.data?.canLikeToday),
      });
    } catch (error) {
      setHeartError(error.response?.data?.message || error.message || 'Không tim được hồ sơ này.');
    } finally {
      setHeartPending(false);
    }
  };

  const handleFriendProfile = async () => {
    if (!canFriendProfile || friendPending || ['friend', 'outgoing'].includes(friendshipState.status)) return;
    setFriendPending(true);
    setFriendError('');
    try {
      if (friendshipState.status === 'incoming' && friendshipState.requestId) {
        await friendsApi.accept(friendshipState.requestId);
        setFriendshipState((current) => ({ ...current, status: 'friend' }));
      } else {
        const res = await friendsApi.sendRequest(user.id || id);
        setFriendshipState({
          status: res.data?.status === 'accepted' ? 'friend' : 'outgoing',
          requestId: res.data?.friendshipId || res.data?.id || null,
        });
      }
    } catch (error) {
      setFriendError(error.response?.data?.message || error.message || 'Không gửi được lời mời kết bạn.');
    } finally {
      setFriendPending(false);
    }
  };

  const FriendIcon = friendshipState.status === 'friend' ? UserCheck : friendshipState.status === 'outgoing' ? Clock3 : UserPlus;
  const friendLabel = friendPending
    ? 'Đang xử lý...'
    : friendshipState.status === 'friend'
      ? 'Bạn bè'
      : friendshipState.status === 'outgoing'
        ? 'Đã gửi lời mời'
        : friendshipState.status === 'incoming'
          ? 'Chấp nhận kết bạn'
          : 'Kết bạn';

  const avatarVisual = (
    <>
      {photoUrl ? (
        <img
          className="profile-photo"
          src={photoUrl}
          alt={`Ảnh đại diện ${user.name || `User #${id}`}`}
          onError={() => {
            if (localAvatarUrl) {
              setLocalAvatarUrl('');
              removeStoredAvatar(user.id || id);
              setUser((current) => (current ? { ...current, avatarData: null } : current));
              if (canEditAvatar) {
                setAuthUser((current) => (current ? { ...current, avatarData: null } : current));
              }
              if (canEditAvatar) {
                usersApi.updateProfilePreferences(user.id || id, { avatarData: null }).catch(() => {});
              }
            }
            setAvatarError('Ảnh này không hiển thị được trong trình duyệt. Hãy thử JPG hoặc PNG khác.');
          }}
        />
      ) : (
        <div className="profile-photo-fallback" role="img" aria-label={`Ảnh đại diện ${user.name || `User #${id}`}`}>
          <span>{avatarInitials}</span>
        </div>
      )}
      {canEditAvatar && (
        <span className="profile-photo-edit">
          <Pencil size={13} />
          Đổi ảnh
        </span>
      )}
      <span className="profile-photo-status" style={{ background: sc.dot }} />
    </>
  );

  const rankThemeStyle = {
    '--rank-color': rank.color,
    '--rank-soft': rank.soft,
    '--rank-accent-2': rank.accent2,
    '--rank-accent-3': rank.accent3,
    '--rank-border': rank.border,
    '--rank-glow': rank.glow,
    '--rank-hero-bg': rank.heroBg,
    '--rank-card-bg': rank.cardBg,
    '--rank-progress': rank.progress,
    '--rank-badge-bg': rank.badgeBg,
  };
  const rankGuideItems = buildRankGuideItems(levelView, rank);

  return (
    <ProfileErrorBoundary>
    <div className="profile-page" style={rankThemeStyle}>
      <button type="button" className="profile-back-button" onClick={() => navigate(-1)} style={{ marginBottom: 4 }}>
        <ChevronLeft size={15} strokeWidth={2.5} />
        Quay lại
      </button>

      <section className="profile-hero">
        <div className="profile-hero-profile">
          <div className="profile-photo-shell">
            {canEditAvatar ? (
              <button
                type="button"
                className="profile-photo-frame is-editable"
                style={{ '--avatar-hue': avatarHueValue }}
                onClick={() => avatarInputRef.current?.click()}
                aria-label="Đổi ảnh đại diện"
              >
                {avatarVisual}
              </button>
            ) : (
              <div className="profile-photo-frame" style={{ '--avatar-hue': avatarHueValue }}>
                {avatarVisual}
              </div>
            )}
            {canEditAvatar && (
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                className="profile-avatar-input"
                onChange={handleAvatarPick}
              />
            )}
            {privilegeBadges.length > 0 && (
              <div className="profile-privilege-stack" aria-label="Huy hiệu riêng do admin cấp">
                {privilegeBadges.map((badge) => {
                  const Icon = badge.icon;
                  if (badge.label === DEV_PRIVILEGE_LABEL) {
                    return <DevPill key={badge.label} />;
                  }
                  return (
                    <span
                      key={badge.label}
                      className={`profile-privilege-pill${badge.label === 'Đối tác WorkRank' ? ' is-partner' : ''}`}
                      title={badge.desc}
                    >
                      <Icon size={13} strokeWidth={2.6} />
                      {badge.label}
                    </span>
                  );
                })}
              </div>
            )}
            {avatarError && <div className="profile-avatar-error">{avatarError}</div>}
          </div>

          <div className="profile-identity-copy">
            <div className="profile-rank-strip">
              <div className="profile-eyebrow">
                <Crown size={15} />
                {rank.tier}
              </div>
              <RankGuide
                items={rankGuideItems}
                currentLevel={levelView.level}
                totalActions={levelView.totalActions}
                dailyProfile={dailyProfile}
              />
            </div>
            <div className="profile-name-line">
              <h1>{user.name || `User #${id}`}</h1>
              {isVerified && <VerifiedMark size={23} />}
            </div>
            <div className="profile-identity-meta">
              <span className="profile-rank-title">{rank.title}</span>
              <span>|</span>
              <span>ID: WR-{String(user.id || id).padStart(4, '0')}</span>
            </div>
            <div className="profile-presence-row">
              <StatusPill statusConfig={sc} />
              {canFriendProfile && (
                <button
                  type="button"
                  className={`profile-friend-button is-${friendshipState.status}`}
                  disabled={friendPending || ['friend', 'outgoing'].includes(friendshipState.status)}
                  onClick={handleFriendProfile}
                >
                  <FriendIcon size={14} strokeWidth={2.6} />
                  {friendLabel}
                </button>
              )}
              {canHeartProfile ? (
                <button
                  type="button"
                  className={profileLikes.likedToday ? 'profile-heart-button is-liked' : 'profile-heart-button'}
                  disabled={heartPending || !profileLikes.canLikeToday}
                  onClick={handleHeartProfile}
                  title={profileLikes.likedToday ? 'Hôm nay bạn đã tim hồ sơ này' : 'Tim hồ sơ này'}
                >
                  <Heart size={14} fill={profileLikes.likedToday ? 'currentColor' : 'none'} strokeWidth={2.6} />
                  {heartPending ? 'Đang tim...' : profileLikes.likedToday ? 'Đã tim' : 'Tim'}
                </button>
              ) : (
                <span className="profile-heart-readonly">
                  <Heart size={14} fill="currentColor" strokeWidth={2.6} />
                  Lượt tim
                </span>
              )}
              <span className="profile-heart-count">{fmtNum(profileLikes.totalCount)} lượt tim</span>
            </div>
            {friendError && <div className="profile-friend-error">{friendError}</div>}
            {heartError && <div className="profile-heart-error">{heartError}</div>}
          </div>
        </div>

        {/* ── GIỚI THIỆU BẢN THÂN (GALLERY) ── */}
        <div ref={galleryContainerRef} className="profile-gallery-grid" aria-label="Ảnh giới thiệu cá nhân">
          {galleryImages.map((imageUrl, index) => (
            <div key={`${index}-${imageUrl.slice(0, 24)}`} className="profile-gallery-cell">
              {imageUrl ? (
                <img loading="lazy" decoding="async" src={imageUrl} alt={`Ảnh giới thiệu ${index + 1}`} />
              ) : (
                <div className="profile-gallery-placeholder">
                  <ImagePlus size={18} strokeWidth={2.4} />
                  <span>{galleryLoading ? 'Đang tải' : `Ảnh ${index + 1}`}</span>
                </div>
              )}
              {canCustomizeProfile && (
                <button
                  type="button"
                  className="profile-gallery-change"
                  onClick={() => openGalleryPicker(index)}
                >
                  <ImagePlus size={16} strokeWidth={2.5} />
                  <span>Thay ảnh</span>
                </button>
              )}
            </div>
          ))}
          {canCustomizeProfile && (
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              className="profile-avatar-input"
              onChange={handleGalleryPick}
            />
          )}
          {galleryLoading && <div className="profile-gallery-error">Đang tải ảnh giới thiệu...</div>}
          {galleryError && <div className="profile-gallery-error">{galleryError}</div>}
        </div>
      </section>

      {/* ── THÔNG TIN ĐƯỢC ĐẨY XUỐNG DƯỚI ── */}
      <section className="profile-summary-card">
        <div className="profile-summary-main">
          <div className="profile-summary-head">
            <div>
              <div className="profile-section-kicker">Tổng quan năng lực</div>
              <h2>Huy hiệu và nhịp duy trì</h2>
            </div>
            <span>Cấp {levelView.level}</span>
          </div>

          <div className="profile-summary-stat-grid">
            <div className="profile-summary-stat">
              <BadgeCheck size={17} strokeWidth={2.4} />
              <span>Danh hiệu</span>
              <strong>{unlockedBadges}/{achievementBadges.length}</strong>
            </div>
            <div className="profile-summary-stat">
              <PawPrint size={17} strokeWidth={2.4} />
              <span>Thú sưu tầm</span>
              <strong>{unlockedAnimals}/{totalAnimals}</strong>
            </div>
            <div className="profile-summary-stat">
              <Flame size={17} strokeWidth={2.4} />
              <span>Chuỗi ngày</span>
              <strong>{currentStreak}</strong>
            </div>
          </div>

          {(featuredBadges.length > 0 || canCustomizeProfile) && (
            <div className="profile-achievement-panel">
              <div className="profile-achievement-header">
                <div>
                  <div className="profile-achievement-title">Thành tích nổi bật</div>
                  <span>{featuredBadges.length}/{FEATURED_BADGE_LIMIT} slot đang dùng</span>
                </div>
                {canCustomizeProfile && selectableBadgeList.length > 0 && (
                  <button
                    type="button"
                    className="profile-achievement-edit"
                    onClick={() => setBadgeEditorOpen((open) => !open)}
                  >
                    {badgeEditorOpen ? 'Đóng' : 'Chỉnh thành tích'}
                  </button>
                )}
              </div>
              <div className="profile-achievement-strip">
                {featuredBadgeSlots.map((badge, index) => {
                  const Icon = badge?.icon;
                  return (
                    <span
                      key={badge?.label || `empty-${index}`}
                      className={badge ? `profile-achievement-pill achievement-tier-${badge.tierIndex}` : 'profile-achievement-pill is-empty'}
                      style={badge ? achievementStyleVars(badge) : undefined}
                      title={badge ? `${badge.label} · ${badge.tierLabel}` : 'Chọn thành tích'}
                      data-achievement-tier={badge?.tierIndex}
                    >
                      {badge ? (
                        <>
                          <Icon size={14} strokeWidth={2.5} />
                          <span>{badge.label}</span>
                          <em>{badge.tierLabel}</em>
                        </>
                      ) : (
                        <>
                          <Star size={14} strokeWidth={2.5} />
                          Chọn thành tích
                        </>
                      )}
                    </span>
                  );
                })}
              </div>
              {badgeEditorOpen && canCustomizeProfile && (
                <div className="profile-badge-editor">
                  <div className="profile-badge-editor-note">Chọn tối đa {FEATURED_BADGE_LIMIT} thành tích chính để ghim ở đây. Mốc cao hơn sẽ tự đổi màu và hiệu ứng trên cùng thành tích.</div>
                  {badgeEditorError && <div className="profile-badge-editor-error">{badgeEditorError}</div>}
                  <div className="profile-badge-editor-grid">
                    {selectableBadgeList.map((badge) => {
                      const Icon = badge.icon;
                      const selected = selectedFeaturedLabels.includes(badge.label);
                      return (
                        <button
                          key={badge.label}
                          type="button"
                          className={selected ? `profile-badge-choice is-selected achievement-tier-${badge.tierIndex}` : `profile-badge-choice achievement-tier-${badge.tierIndex}`}
                          style={achievementStyleVars(badge)}
                          onClick={() => toggleFeaturedBadge(badge.label)}
                        >
                          <Icon size={15} strokeWidth={2.4} />
                          <span>{badge.label}</span>
                          <em>{selected ? 'Đang ghim' : badge.tierLabel}</em>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="profile-power-card" style={{ flexShrink: 0, margin: 0 }}>
          <div className="profile-power-label">Điểm đấu hạng</div>
          <div className="profile-power-value">{powerScore.toLocaleString()}</div>
          <div className="profile-power-note">
            Tổng hợp từ level, tổng thao tác, chuỗi ngày và trung bình gõ/click mỗi ngày.
          </div>
        </div>
      </section>

      <section className="profile-metric-grid">
        <MetricCard icon={Trophy} label="Level hiện tại" value={`${levelView.level}/${levelView.maxLevel}`} detail={`Còn ${fmtNum(levelView.remainingActions)} thao tác để lên level`} tone={rank.color} />
        <MetricCard icon={Activity} label="Thao tác hôm nay" value={fmtNum(todayActions)} detail={`${fmtNum(actionsPerHour)} thao tác/giờ active`} tone="#0891b2" />
        <MetricCard icon={Keyboard} label="TB gõ/ngày" value={fmtNum(dailyProfile.avgKeystrokesPerActiveDay)} detail={`${dailyProfile.activeDays}/${dailyProfile.windowDays} ngày có hoạt động`} tone="#2563eb" />
        <MetricCard icon={Mouse} label="TB click/ngày" value={fmtNum(dailyProfile.avgClicksPerActiveDay)} detail={`TB ${fmtNum(dailyProfile.avgActionsPerActiveDay)} thao tác/ngày active`} tone="#d97706" />
      </section>

      <section className="profile-title-panel">
        <div className="profile-title-card">
          <div className="profile-section-kicker">Danh hiệu chính</div>
          <div className="profile-title-main">
            <Award size={34} />
            <div>
              <h2>{rank.title}</h2>
            </div>
          </div>
          <div className="profile-next-target">
            <Target size={15} />
            Mục tiêu kế tiếp: Level {Math.min(levelView.maxLevel, levelView.level + 1)} trong {fmtNum(levelView.remainingActions)} thao tác.
          </div>
        </div>

        <div className="profile-badge-board">
          {achievementBadges.map((badge) => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.label}
                className={badge.unlocked ? `profile-badge is-unlocked achievement-tier-${badge.tierIndex}` : 'profile-badge'}
                style={achievementStyleVars(badge)}
                data-achievement-tier={badge.tierIndex}
              >
                <div className="profile-badge-icon"><Icon size={18} strokeWidth={2.4} /></div>
                <div>
                  <strong>
                    {badge.label}
                    <em>{badge.tierLabel}</em>
                  </strong>
                  <span>{badge.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="profile-animal-card" style={{ '--animal-color': currentAnimal.color }}>
        <div className="profile-animal-current">
          <div className="profile-animal-emblem">
            <CurrentAnimalIcon size={38} strokeWidth={2.2} />
          </div>
          <div>
            <div className="profile-section-kicker">Thú đồng hành level {currentAnimal.level}</div>
            <h2>{currentAnimal.name}</h2>
          </div>
        </div>

        <div className="profile-animal-next">
          <div className="profile-animal-next-icon">
            <NextAnimalIcon size={22} strokeWidth={2.3} />
          </div>
          <div>
            <span>Mở khóa kế tiếp</span>
            <strong>Level {nextAnimal.level}: {nextAnimal.name}</strong>
          </div>
        </div>

        <div className="profile-animal-collection" aria-label="Bộ sưu tập thú theo level">
          {animalCollection.map((animal) => {
            const Icon = animal.icon;
            return (
              <div key={animal.level} className={animal.current ? 'profile-animal-token is-current' : animal.unlocked ? 'profile-animal-token is-unlocked' : 'profile-animal-token'}>
                <div className="profile-animal-token-icon" style={{ color: animal.unlocked ? animal.color : '#94a3b8' }}>
                  <Icon size={20} strokeWidth={2.4} />
                </div>
                <strong>{animal.name}</strong>
                <span>Level {animal.level}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="profile-level-card">
        <div className="profile-level-summary">
          <div>
            <div className="profile-section-kicker">Đường đua level</div>
            <h2>Level {levelView.level}</h2>
            <p>{Math.round(levelView.progressPercent)}% tiến độ tới level kế tiếp</p>
          </div>
          <div className="profile-level-actions">
            <span>{fmtNum(levelView.totalKeystrokes)} gõ phím</span>
            <span>{fmtNum(levelView.totalMouseClicks)} click</span>
          </div>
        </div>

        <div className="profile-progress-bar">
          <span style={{ width: `${levelView.progressPercent}%` }} />
        </div>

        <div className="profile-milestone-track">
          {milestoneTrack.map((milestone) => {
            const milestoneLevel = Number(milestone.level || 0);
            const reached = levelView.totalActions >= Number(milestone.requiredActions || 0);
            const current = milestoneLevel === levelView.level;
            return (
              <div key={milestoneLevel} className={current ? 'profile-milestone is-current' : reached ? 'profile-milestone is-reached' : 'profile-milestone'}>
                <div className="profile-milestone-dot">{milestoneLevel}</div>
                <strong>Level {milestoneLevel}</strong>
                <span>{fmtNum(milestone.requiredActions)} thao tác</span>
              </div>
            );
          })}
        </div>

        <div className="profile-level-table">
          <table>
            <thead>
              <tr>
                <th>Level</th>
                <th>Mốc cần đạt</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {milestoneTrack.map((milestone) => {
                const milestoneLevel = Number(milestone.level || 0);
                const requiredActions = Number(milestone.requiredActions || 0);
                const reached = levelView.totalActions >= requiredActions;
                const current = milestoneLevel === levelView.level;
                return (
                  <tr key={milestoneLevel} className={current ? 'is-current' : reached ? 'is-reached' : ''}>
                    <td>Level {milestoneLevel}</td>
                    <td>{requiredActions.toLocaleString()}</td>
                    <td>{current ? 'Hiện tại' : reached ? 'Đã đạt' : `Còn ${fmtNum(requiredActions - levelView.totalActions)}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="profile-competitive-grid">
        <div className="profile-record-board">
          <div className="profile-section-header">
            <div>
              <div className="profile-section-kicker">Kỷ lục cá nhân</div>
              <h2>Những mốc nổi bật</h2>
            </div>
            <Star size={20} fill="#f59e0b" color="#f59e0b" />
          </div>
          <div className="profile-record-grid">
            <RecordCard icon={CalendarDays} label="Ngày mạnh nhất" value={fmtNum(bestDay.count)} detail={fmtDate(bestDay.date)} strong />
            <RecordCard icon={Zap} label="Burst 15 phút" value={fmtNum(peakBucket.actions)} detail={`Khung ${peakBucket.time}`} />
            <RecordCard icon={Clock3} label="Phiên dài nhất" value={fmtDur(sessionRecords.longest)} detail={`${fmtNum(sessionRecords.bestActions)} thao tác tốt nhất/phiên`} />
            <RecordCard icon={Target} label="TB ngày active" value={fmtNum(dailyProfile.avgActionsPerActiveDay)} detail={`${fmtNum(dailyProfile.avgKeystrokesPerActiveDay)} gõ · ${fmtNum(dailyProfile.avgClicksPerActiveDay)} click`} />
          </div>
        </div>

        <div ref={chartContainerRef} className="profile-chart-card">
          <div className="profile-section-header">
            <div>
              <div className="profile-section-kicker">Nhịp thi đấu hôm nay</div>
              <h2>Hoạt động mỗi 15 phút</h2>
            </div>
            <div className="profile-chart-legend">
              <span style={{ color: '#0891b2' }}><Keyboard size={12} /> Gõ</span>
              <span style={{ color: '#d97706' }}><Mouse size={12} /> Click</span>
            </div>
          </div>
          {chartVisible ? (
            <Suspense fallback={<div className="profile-chart-loading">Đang tải biểu đồ...</div>}>
              <UserActivityChart chartData={chartData} chartTickInterval={chartTickInterval} />
            </Suspense>
          ) : (
            <div className="profile-chart-loading">Cuộn tới đây để tải biểu đồ chi tiết...</div>
          )}
        </div>
      </section>

      <section className="profile-heatmap-card">
        <div className="profile-section-header">
          <div>
            <div className="profile-section-kicker">Lịch sử thi đấu</div>
            <h2>Heatmap 12 tháng</h2>
          </div>
          <div className="profile-heat-legend">
            <span>Ít</span>
            {HEAT_COLORS.map((color) => <i key={color} style={{ background: color }} />)}
            <span>Nhiều</span>
          </div>
        </div>
        <div className="profile-heatmap-grid">
          {heatmap.map((week, weekIndex) => (
            <div key={weekIndex} className="profile-heatmap-week">
              {week.map((cell, dayIndex) => (
                <span
                  key={`${weekIndex}-${dayIndex}`}
                  title={`${cell.date || ''}${Number(cell.count || 0) > 0 ? ` - ${Number(cell.count || 0).toLocaleString()} thao tác` : ' - Không có hoạt động'}`}
                  style={{ background: HEAT_COLORS[cell.level] || HEAT_COLORS[0] }}
                />
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="profile-session-card">
        <div className="profile-section-header">
          <div>
            <div className="profile-section-kicker">Lịch sử gần đây</div>
            <h2>Các phiên hoạt động</h2>
          </div>
          <span className="profile-session-count">{recentSessions.length} phiên</span>
        </div>
        <div className="profile-session-list">
          {recentSessions.length === 0 ? (
            <div className="profile-empty-row">Chưa có phiên hoạt động nào.</div>
          ) : recentSessions.map((session) => (
            <div key={`${session.name}-${session.time}`} className="profile-session-row">
              <span className={session.active ? 'profile-session-dot is-active' : 'profile-session-dot'} />
              <div>
                <strong>{session.name}</strong>
                <span>{session.time}</span>
              </div>
              <em>{session.actions.toLocaleString()} thao tác</em>
            </div>
          ))}
        </div>
      </section>
    </div>
    </ProfileErrorBoundary>
  );
}
