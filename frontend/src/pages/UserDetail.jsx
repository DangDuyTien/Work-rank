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
  Code,
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
  Snowflake,
  Star,
  Target,
  Timer,
  Trophy,
  UserCheck,
  UserPlus,
  UserRound,
  Zap,
} from 'lucide-react';
import { Icon as IconifyIcon } from '@iconify/react';
import notoBearIcon from '@iconify-icons/noto/bear';
import notoBeaverIcon from '@iconify-icons/noto/beaver';
import notoBeetleIcon from '@iconify-icons/noto/beetle';
import notoBisonIcon from '@iconify-icons/noto/bison';
import notoBlackCatIcon from '@iconify-icons/noto/black-cat';
import notoCamelIcon from '@iconify-icons/noto/camel';
import notoCatIcon from '@iconify-icons/noto/cat';
import notoDeerIcon from '@iconify-icons/noto/deer';
import notoDogIcon from '@iconify-icons/noto/dog';
import notoDolphinIcon from '@iconify-icons/noto/dolphin';
import notoEagleIcon from '@iconify-icons/noto/eagle';
import notoElephantIcon from '@iconify-icons/noto/elephant';
import notoFishIcon from '@iconify-icons/noto/fish';
import notoFoxIcon from '@iconify-icons/noto/fox';
import notoGiraffeIcon from '@iconify-icons/noto/giraffe';
import notoHorseIcon from '@iconify-icons/noto/horse';
import notoKangarooIcon from '@iconify-icons/noto/kangaroo';
import notoLeopardIcon from '@iconify-icons/noto/leopard';
import notoLionIcon from '@iconify-icons/noto/lion';
import notoLizardIcon from '@iconify-icons/noto/lizard';
import notoMammothIcon from '@iconify-icons/noto/mammoth';
import notoMonkeyIcon from '@iconify-icons/noto/monkey';
import notoMouseIcon from '@iconify-icons/noto/mouse';
import notoOtterIcon from '@iconify-icons/noto/otter';
import notoOxIcon from '@iconify-icons/noto/ox';
import notoOwlIcon from '@iconify-icons/noto/owl';
import notoOysterIcon from '@iconify-icons/noto/oyster';
import notoPandaIcon from '@iconify-icons/noto/panda';
import notoPeacockIcon from '@iconify-icons/noto/peacock';
import notoPolarBearIcon from '@iconify-icons/noto/polar-bear';
import notoRabbitIcon from '@iconify-icons/noto/rabbit';
import notoRhinocerosIcon from '@iconify-icons/noto/rhinoceros';
import notoSharkIcon from '@iconify-icons/noto/shark';
import notoSnailIcon from '@iconify-icons/noto/snail';
import notoSpoutingWhaleIcon from '@iconify-icons/noto/spouting-whale';
import notoTigerIcon from '@iconify-icons/noto/tiger';
import notoTurtleIcon from '@iconify-icons/noto/turtle';
import notoWhaleIcon from '@iconify-icons/noto/whale';
import notoWolfIcon from '@iconify-icons/noto/wolf';
import notoZebraIcon from '@iconify-icons/noto/zebra';
import {
  GiEagleEmblem,
  GiFalconMoon,
  GiFeline,
  GiLion,
  GiPangolin,
  GiRamProfile,
  GiSparrow,
  GiSquirrel,
  GiTigerHead,
  GiWolfHowl,
} from 'react-icons/gi';
import VerifiedBadge from '../components/VerifiedBadge';
import ProfileErrorBoundary from '../components/ProfileErrorBoundary';

const UserActivityChart = lazy(() => import('../components/UserActivityChart'));

const STATUS_CONFIG = {
  active: { label: 'Đang hoạt động', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', color: '#16a34a', dot: '#22c55e' },
  online: { label: 'Trực tuyến', bg: 'rgba(8,145,178,0.12)', border: 'rgba(8,145,178,0.35)', color: '#0891b2', dot: '#06b6d4' },
  idle: { label: 'Tạm nghỉ', bg: 'rgba(234,179,8,0.14)', border: 'rgba(234,179,8,0.35)', color: '#ca8a04', dot: '#eab308' },
  offline: { label: 'Ngoại tuyến', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)', color: '#64748b', dot: '#94a3b8' },
};

const PROFILE_GALLERY_IMAGES = [
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=360&q=80',
];

const FEATURED_BADGE_LIMIT = 4;
const PROFILE_BADGE_STORAGE_LIMIT = 12;

const PRIVILEGE_BADGES = [
  { label: 'Dev đặc quyền', desc: 'Huy hiệu dev do admin cấp', icon: Code, unlocked: true, privilege: true },
  { label: 'Người đóng góp', desc: 'Đóng góp cho cộng đồng WorkRank', icon: Medal, unlocked: true, privilege: true },
  { label: 'Nhà sáng lập', desc: 'Tài khoản sáng lập hoặc vận hành', icon: Trophy, unlocked: true, privilege: true },
  { label: 'Thành viên VIP', desc: 'Hồ sơ được ưu tiên hiển thị', icon: Crown, unlocked: true, privilege: true },
  { label: 'Đối tác WorkRank', desc: 'Tài khoản đối tác hoặc cộng tác viên', icon: ShieldCheck, unlocked: true, privilege: true },
  { label: 'Người nổi bật', desc: 'Hồ sơ được admin chọn nổi bật', icon: Star, unlocked: true, privilege: true },
];

const PRIVILEGE_BADGE_LABELS = new Set(PRIVILEGE_BADGES.map((badge) => badge.label));

function isPrivilegeBadgeLabel(label) {
  return PRIVILEGE_BADGE_LABELS.has(String(label || '').trim());
}

function isDevProfileUser(user = {}) {
  const id = Number(user.id || user.user_id || user.userId);
  const email = String(user.email || '').trim().toLowerCase();
  const name = String(user.name || '').trim().toLowerCase();
  return email === 'tien@gmail.com' || id === 8 || name === 'dang duy tien';
}

const RANK_TIERS = [
  {
    min: 130,
    tier: 'Huyền thoại',
    title: 'Huyền thoại WorkRank',
    color: '#7c3aed',
    soft: 'rgba(124,58,237,0.12)',
    accent2: '#ec4899',
    accent3: '#22d3ee',
    border: 'rgba(124,58,237,0.3)',
    glow: '0 18px 46px rgba(124,58,237,0.12)',
    heroBg: 'linear-gradient(135deg, rgba(124,58,237,0.13) 0%, #ffffff 42%, rgba(34,211,238,0.1) 100%)',
    cardBg: 'linear-gradient(180deg, #ffffff 0%, rgba(124,58,237,0.04) 100%)',
    progress: 'linear-gradient(90deg, #7c3aed 0%, #ec4899 58%, #22d3ee 100%)',
    badgeBg: 'rgba(124,58,237,0.13)',
  },
  {
    min: 70,
    tier: 'Kim cương',
    title: 'Đấu sĩ năng suất',
    color: '#0891b2',
    soft: 'rgba(8,145,178,0.12)',
    accent2: '#38bdf8',
    accent3: '#67e8f9',
    border: 'rgba(8,145,178,0.3)',
    glow: '0 18px 46px rgba(8,145,178,0.13)',
    heroBg: 'linear-gradient(135deg, rgba(8,145,178,0.13) 0%, #ffffff 44%, rgba(103,232,249,0.11) 100%)',
    cardBg: 'linear-gradient(180deg, #ffffff 0%, rgba(8,145,178,0.045) 100%)',
    progress: 'linear-gradient(90deg, #0891b2 0%, #38bdf8 100%)',
    badgeBg: 'rgba(8,145,178,0.13)',
  },
  {
    min: 35,
    tier: 'Bạch kim',
    title: 'Cao thủ tập trung',
    color: '#2563eb',
    soft: 'rgba(37,99,235,0.12)',
    accent2: '#60a5fa',
    accent3: '#93c5fd',
    border: 'rgba(37,99,235,0.3)',
    glow: '0 18px 46px rgba(37,99,235,0.14)',
    heroBg: 'linear-gradient(135deg, rgba(37,99,235,0.14) 0%, #ffffff 44%, rgba(147,197,253,0.13) 100%)',
    cardBg: 'linear-gradient(180deg, #ffffff 0%, rgba(37,99,235,0.045) 100%)',
    progress: 'linear-gradient(90deg, #2563eb 0%, #60a5fa 100%)',
    badgeBg: 'rgba(37,99,235,0.13)',
  },
  {
    min: 20,
    tier: 'Vàng',
    title: 'Chiến binh bền bỉ',
    color: '#d97706',
    soft: 'rgba(217,119,6,0.12)',
    accent2: '#f59e0b',
    accent3: '#facc15',
    border: 'rgba(217,119,6,0.32)',
    glow: '0 18px 46px rgba(217,119,6,0.13)',
    heroBg: 'linear-gradient(135deg, rgba(217,119,6,0.13) 0%, #ffffff 45%, rgba(250,204,21,0.12) 100%)',
    cardBg: 'linear-gradient(180deg, #ffffff 0%, rgba(217,119,6,0.045) 100%)',
    progress: 'linear-gradient(90deg, #d97706 0%, #f59e0b 100%)',
    badgeBg: 'rgba(217,119,6,0.13)',
  },
  {
    min: 10,
    tier: 'Bạc',
    title: 'Người tăng tốc',
    color: '#64748b',
    soft: 'rgba(100,116,139,0.11)',
    accent2: '#94a3b8',
    accent3: '#cbd5e1',
    border: 'rgba(100,116,139,0.28)',
    glow: '0 18px 46px rgba(100,116,139,0.12)',
    heroBg: 'linear-gradient(135deg, rgba(100,116,139,0.13) 0%, #ffffff 45%, rgba(203,213,225,0.18) 100%)',
    cardBg: 'linear-gradient(180deg, #ffffff 0%, rgba(100,116,139,0.045) 100%)',
    progress: 'linear-gradient(90deg, #64748b 0%, #94a3b8 100%)',
    badgeBg: 'rgba(100,116,139,0.13)',
  },
  {
    min: 0,
    tier: 'Đồng',
    title: 'Tân binh tiềm năng',
    color: '#b45309',
    soft: 'rgba(180,83,9,0.12)',
    accent2: '#d97706',
    accent3: '#f97316',
    border: 'rgba(180,83,9,0.3)',
    glow: '0 18px 46px rgba(180,83,9,0.13)',
    heroBg: 'linear-gradient(135deg, rgba(180,83,9,0.13) 0%, #ffffff 45%, rgba(249,115,22,0.11) 100%)',
    cardBg: 'linear-gradient(180deg, #ffffff 0%, rgba(180,83,9,0.045) 100%)',
    progress: 'linear-gradient(90deg, #b45309 0%, #d97706 100%)',
    badgeBg: 'rgba(180,83,9,0.13)',
  },
];

const ANIMAL_COLOR_SEQUENCE = ['#d97706', '#16a34a', '#db2777', '#0891b2', '#7c3aed', '#dc2626'];
const ANIMAL_TRAITS = ['Nhanh nhẹn', 'Bền bỉ', 'Tập trung', 'Bứt tốc', 'Ổn định', 'Tinh anh'];

function createNotoAnimalIcon(iconData) {
  return function NotoAnimalIcon({ size = 24, strokeWidth: _strokeWidth, color: _color, style, ...props }) {
    return (
      <IconifyIcon
        {...props}
        icon={iconData}
        width={size}
        height={size}
        style={{ display: 'block', flexShrink: 0, ...style }}
      />
    );
  };
}

function SwordfishIcon({ size = 24, strokeWidth = 2, color: _color, style, ...props }) {
  return (
    <svg
      {...props}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      <path d="M6 31h24" />
      <path d="M29 22c9 0 19 4 25 10-6 6-16 10-25 10-6 0-12-2-16-6 4-1 7-2 10-4-3-2-6-3-10-4 4-4 10-6 16-6Z" />
      <path d="M54 32l8-4" />
      <path d="M54 32l8 4" />
      <path d="M33 22l-5-10" />
      <path d="M34 42l-6 9" />
      <circle cx="43" cy="30" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SnowLeopardIcon({ size = 24, strokeWidth = 2, color: _color, style, ...props }) {
  const markSize = Math.max(8, Math.round(size * 0.36));
  return (
    <span
      {...props}
      style={{
        width: size,
        height: size,
        display: 'inline-grid',
        placeItems: 'center',
        position: 'relative',
        flexShrink: 0,
        ...style,
      }}
    >
      <GiFeline size={size} style={{ gridArea: '1 / 1' }} />
      <Snowflake
        size={markSize}
        strokeWidth={strokeWidth}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          background: 'rgba(255,255,255,0.72)',
          borderRadius: '999px',
        }}
      />
    </span>
  );
}

const ANIMAL_LEVELS = [
  { name: 'Mèo con', icon: createNotoAnimalIcon(notoCatIcon), iconKey: 'noto-cat' },
  { name: 'Thỏ đồng', icon: createNotoAnimalIcon(notoRabbitIcon), iconKey: 'noto-rabbit' },
  { name: 'Sóc nâu', icon: GiSquirrel, iconKey: 'gi-squirrel' },
  { name: 'Chim sẻ', icon: GiSparrow, iconKey: 'gi-sparrow' },
  { name: 'Cá suối', icon: createNotoAnimalIcon(notoFishIcon), iconKey: 'noto-fish' },
  { name: 'Rùa xanh', icon: createNotoAnimalIcon(notoTurtleIcon), iconKey: 'noto-turtle' },
  { name: 'Chó săn', icon: createNotoAnimalIcon(notoDogIcon), iconKey: 'noto-dog' },
  { name: 'Ốc sên bạc', icon: createNotoAnimalIcon(notoSnailIcon), iconKey: 'noto-snail' },
  { name: 'Bọ ánh kim', icon: createNotoAnimalIcon(notoBeetleIcon), iconKey: 'noto-beetle' },
  { name: 'Chuột nhắt', icon: createNotoAnimalIcon(notoMouseIcon), iconKey: 'noto-mouse' },
  { name: 'Sò ngọc', icon: createNotoAnimalIcon(notoOysterIcon), iconKey: 'noto-oyster' },
  { name: 'Cáo đỏ', icon: createNotoAnimalIcon(notoFoxIcon), iconKey: 'noto-fox' },
  { name: 'Hươu sao', icon: createNotoAnimalIcon(notoDeerIcon), iconKey: 'noto-deer' },
  { name: 'Gấu trúc', icon: createNotoAnimalIcon(notoPandaIcon), iconKey: 'noto-panda' },
  { name: 'Cú mèo', icon: createNotoAnimalIcon(notoOwlIcon), iconKey: 'noto-owl' },
  { name: 'Hải ly', icon: createNotoAnimalIcon(notoBeaverIcon), iconKey: 'noto-beaver' },
  { name: 'Linh dương', icon: GiRamProfile, iconKey: 'gi-ram-profile' },
  { name: 'Sói xám', icon: createNotoAnimalIcon(notoWolfIcon), iconKey: 'noto-wolf' },
  { name: 'Báo gấm', icon: createNotoAnimalIcon(notoLeopardIcon), iconKey: 'noto-leopard' },
  { name: 'Rái cá', icon: createNotoAnimalIcon(notoOtterIcon), iconKey: 'noto-otter' },
  { name: 'Ngựa hoang', icon: createNotoAnimalIcon(notoHorseIcon), iconKey: 'noto-horse' },
  { name: 'Đại bàng', icon: createNotoAnimalIcon(notoEagleIcon), iconKey: 'noto-eagle' },
  { name: 'Cá heo', icon: createNotoAnimalIcon(notoDolphinIcon), iconKey: 'noto-dolphin' },
  { name: 'Bò rừng', icon: createNotoAnimalIcon(notoBisonIcon), iconKey: 'noto-bison' },
  { name: 'Lạc đà', icon: createNotoAnimalIcon(notoCamelIcon), iconKey: 'noto-camel' },
  { name: 'Sư tử', icon: createNotoAnimalIcon(notoLionIcon), iconKey: 'noto-lion' },
  { name: 'Hổ vàng', icon: createNotoAnimalIcon(notoTigerIcon), iconKey: 'noto-tiger' },
  { name: 'Gấu trắng', icon: createNotoAnimalIcon(notoPolarBearIcon), iconKey: 'noto-polar-bear' },
  { name: 'Cá mập', icon: createNotoAnimalIcon(notoSharkIcon), iconKey: 'noto-shark' },
  { name: 'Tê giác', icon: createNotoAnimalIcon(notoRhinocerosIcon), iconKey: 'noto-rhinoceros' },
  { name: 'Voi rừng', icon: createNotoAnimalIcon(notoElephantIcon), iconKey: 'noto-elephant' },
  { name: 'Khỉ vàng', icon: createNotoAnimalIcon(notoMonkeyIcon), iconKey: 'noto-monkey' },
  { name: 'Báo tuyết', icon: SnowLeopardIcon, iconKey: 'custom-snow-leopard' },
  { name: 'Chim ưng', icon: GiFalconMoon, iconKey: 'gi-falcon-moon' },
  { name: 'Cá voi', icon: createNotoAnimalIcon(notoWhaleIcon), iconKey: 'noto-whale' },
  { name: 'Gấu xám', icon: createNotoAnimalIcon(notoBearIcon), iconKey: 'noto-bear' },
  { name: 'Ngựa vằn', icon: createNotoAnimalIcon(notoZebraIcon), iconKey: 'noto-zebra' },
  { name: 'Công xanh', icon: createNotoAnimalIcon(notoPeacockIcon), iconKey: 'noto-peacock' },
  { name: 'Sói tuyết', icon: GiWolfHowl, iconKey: 'gi-wolf-howl' },
  { name: 'Bò tót', icon: createNotoAnimalIcon(notoOxIcon), iconKey: 'noto-ox' },
  { name: 'Rồng Komodo', icon: createNotoAnimalIcon(notoLizardIcon), iconKey: 'noto-lizard' },
  { name: 'Kangaroo', icon: createNotoAnimalIcon(notoKangarooIcon), iconKey: 'noto-kangaroo' },
  { name: 'Tê tê', icon: GiPangolin, iconKey: 'gi-pangolin' },
  { name: 'Hươu cao cổ', icon: createNotoAnimalIcon(notoGiraffeIcon), iconKey: 'noto-giraffe' },
  { name: 'Cá kiếm', icon: SwordfishIcon, iconKey: 'custom-swordfish' },
  { name: 'Báo đen', icon: createNotoAnimalIcon(notoBlackCatIcon), iconKey: 'noto-black-cat' },
  { name: 'Đại bàng vàng', icon: GiEagleEmblem, iconKey: 'gi-eagle-emblem' },
  { name: 'Sư tử trắng', icon: GiLion, iconKey: 'gi-lion' },
  { name: 'Hổ trắng', icon: GiTigerHead, iconKey: 'gi-tiger-head' },
  { name: 'Cá voi xanh', icon: createNotoAnimalIcon(notoSpoutingWhaleIcon), iconKey: 'noto-spouting-whale' },
  { name: 'Voi ma mút', icon: createNotoAnimalIcon(notoMammothIcon), iconKey: 'noto-mammoth' },
];

const LEVEL_ANIMALS = Array.from({ length: 200 }, (_, level) => {
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
  const maxLevel = Number(info.maxLevel || 50);
  const totalActions = Number(info.totalActions || 0);
  let level = Number(info.level || 0);

  if (milestones.length) {
    level = milestones.reduce((current, milestone) => (
      totalActions >= Number(milestone.requiredActions || 0) ? Number(milestone.level || current) : current
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

function getRankTier(level) {
  return RANK_TIERS.find((tier) => Number(level || 0) >= tier.min) || RANK_TIERS[RANK_TIERS.length - 1];
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
  const maxLevel = Number(levelInfo.maxLevel || 50);
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
  return LEVEL_ANIMALS.slice(0, visibleMax + 1).map((animal) => ({
    ...animal,
    unlocked: animal.level <= Number(currentLevel || 0),
    current: animal.level === Number(currentLevel || 0),
  }));
}

function buildBadges({ levelView, score, bestDay, currentStreak, peakBucket, sessionRecords }) {
  return [
    { label: 'Tập trung thép', desc: 'Điểm hoạt động từ 90+', icon: ShieldCheck, unlocked: score >= 90 },
    { label: 'Bùng nổ 15 phút', desc: 'Đạt 500+ thao tác trong 1 block', icon: Zap, unlocked: peakBucket.actions >= 500 },
    { label: 'Chuỗi bền bỉ', desc: '7 ngày liên tiếp có hoạt động', icon: Flame, unlocked: currentStreak >= 7 },
    { label: 'Mốc Level 10', desc: 'Vượt level 10', icon: Medal, unlocked: levelView.level >= 10 },
    { label: 'Ngày 10K', desc: 'Một ngày đạt 10k thao tác', icon: Trophy, unlocked: Number(bestDay?.count || 0) >= 10000 },
    { label: 'Phiên marathon', desc: 'Một phiên dài từ 2 giờ', icon: Timer, unlocked: sessionRecords.longest >= 7200 },
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

function buildPowerScore({ levelView, score, currentStreak, todayActions }) {
  const levelScore = Number(levelView.level || 0) * 1000;
  const focusScore = Math.round(Number(score || 0) * 12);
  const volumeScore = Math.round(Math.log10(Number(levelView.totalActions || 0) + 1) * 420);
  const streakScore = Number(currentStreak || 0) * 35;
  const todayScore = Math.min(600, Math.round(Number(todayActions || 0) / 80));
  return levelScore + focusScore + volumeScore + streakScore + todayScore;
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
    <span className="profile-dev-pill" title="Vật phẩm hiếm: Dev" aria-label="Vật phẩm hiếm: Dev">
      <Code className="profile-dev-icon" size={13} strokeWidth={2.8} aria-hidden="true" />
      <span className="profile-dev-label">Dev</span>
    </span>
  );
}

function RankGuide({ items, currentLevel, totalActions }) {
  const nextRank = items.find((item) => !item.unlocked);

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
            <span>Cấp {currentLevel} · {fmtNum(totalActions)} thao tác</span>
          </div>
        </div>
        <p>
          Rank tăng theo cấp. Cấp được tính từ tổng thao tác tích lũy gồm gõ phím và click chuột.
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
                    : `Cần cấp ${item.min}${item.requiredActions > 0 ? ` · ${fmtNum(item.requiredActions)} thao tác` : ''}`}
                </span>
              </div>
              <em>{item.current ? 'Hiện tại' : item.unlocked ? 'Đã mở' : 'Chưa mở'}</em>
            </div>
          ))}
        </div>
        <div className="profile-rank-help-next">
          {nextRank
            ? `Mốc kế tiếp: ${nextRank.tier} ở cấp ${nextRank.min}.`
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
  const avatarInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const gallerySlotRef = useRef(PROFILE_GALLERY_IMAGES.length - 1);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [levelInfo, setLevelInfo] = useState(null);
  const [localAvatarUrl, setLocalAvatarUrl] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [galleryImages, setGalleryImages] = useState(PROFILE_GALLERY_IMAGES);
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

  useEffect(() => {
    let mounted = true;

    const fetchAll = async () => {
      try {
        const today = localDateKey();
        const [userRes, statRes, timelineRes, heatmapRes, sessionRes, levelRes] = await Promise.all([
          usersApi.get(id),
          activity.userStats(id),
          activity.timeline(id, today, 'quarter'),
          activity.heatmap(id),
          activity.sessions(id, 10),
          activity.level(id),
        ]);

        if (!mounted) return;
        setUser(userRes.data);
        setStats(statRes.data);
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
  }, [id]);

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
    const timer = window.setInterval(() => setChartNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;

    setLocalAvatarUrl('');
    setAvatarError('');
    setGalleryImages(PROFILE_GALLERY_IMAGES);
    setGalleryError('');
    setFeaturedBadgeLabels([]);
    setHasFeaturedBadgePreference(false);
    setBadgeEditorError('');
    setBadgeEditorOpen(false);
    setHeartError('');

    const fetchProfileCustomization = async () => {
      const [galleryResult, preferenceResult, likesResult] = await Promise.allSettled([
        usersApi.gallery(id),
        usersApi.profilePreferences(id),
        usersApi.profileLikes(id),
      ]);
      if (!mounted) return;

      if (galleryResult.status === 'fulfilled') {
        setGalleryImages(buildProfileGallery(galleryResult.value.data));
      } else {
        console.error('Failed to fetch profile gallery:', galleryResult.reason);
      }

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
    if (!socket) return undefined;

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
  }, [socket, id]);

  const derived = useMemo(() => {
    const levelView = hydrateLevelInfo(levelInfo || {});
    const todayActions = Number(stats?.total_keystrokes || 0) + Number(stats?.total_mouse_clicks || 0);
    const score = Number(stats?.score || 0);
    const rank = getRankTier(levelView.level);
    const currentStreak = getCurrentStreak(heatmapData);
    const bestDay = getBestDay(heatmapData);
    const peakBucket = getPeakBucket(timeline);
    const sessionRecords = getSessionRecords(sessions);
    const activeSeconds = Number(stats?.total_active_seconds || 0);
    const actionsPerHour = activeSeconds > 0 ? Math.round((todayActions / activeSeconds) * 3600) : 0;
    const badges = buildBadges({ levelView, score, bestDay, currentStreak, peakBucket, sessionRecords });
    const achievementBadges = badges.filter((badge) => !badge.privilege);
    const unlockedBadges = achievementBadges.filter((badge) => badge.unlocked).length;
    const animalCollection = buildAnimalCollection(levelView.level, levelView.maxLevel);
    const currentAnimal = getLevelAnimal(levelView.level);
    const nextAnimal = getLevelAnimal(Math.min(levelView.maxLevel, levelView.level + 1));
    const unlockedAnimals = animalCollection.filter((animal) => animal.unlocked).length;
    const powerScore = buildPowerScore({ levelView, score, currentStreak, todayActions });
    return {
      levelView,
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
      powerScore,
      milestoneTrack: buildMilestoneTrack(levelView),
    };
  }, [heatmapData, levelInfo, sessions, stats, timeline]);

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
  const inferredPrivilegeLabels = isDevProfileUser(user) ? ['Dev đặc quyền'] : [];
  const privilegeLabels = [...inferredPrivilegeLabels, ...normalizeFeaturedBadgeLabels(featuredBadgeLabels).filter(isPrivilegeBadgeLabel)]
    .filter((label, index, list) => list.indexOf(label) === index);
  const privilegeBadges = privilegeLabels
    .map((label) => PRIVILEGE_BADGES.find((badge) => badge.label === label))
    .filter(Boolean);
  const selectableBadgeList = unlockedBadgeList;
  const selectedFeaturedLabels = (hasFeaturedBadgePreference ? featuredBadgeLabels : unlockedBadgeList.slice(0, FEATURED_BADGE_LIMIT).map((badge) => badge.label))
    .filter((label, index, list) => list.indexOf(label) === index)
    .filter((label) => !isPrivilegeBadgeLabel(label))
    .filter((label) => selectableBadgeList.some((badge) => badge.label === label))
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
  const rankGuideItems = [...RANK_TIERS].reverse().map((tier) => {
    const milestone = levelView.milestones.find((item) => Number(item.level) === Number(tier.min));
    return {
      ...tier,
      requiredActions: Number(milestone?.requiredActions || 0),
      unlocked: Number(levelView.level || 0) >= Number(tier.min || 0),
      current: rank.tier === tier.tier,
    };
  });

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
              <div className="profile-privilege-stack" aria-label="Huy hiệu đặc quyền do admin cấp">
                {privilegeBadges.map((badge) => {
                  const Icon = badge.icon;
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
        <div className="profile-gallery-grid" aria-label="Ảnh giới thiệu cá nhân">
          {galleryImages.map((imageUrl, index) => (
            <div key={`${index}-${imageUrl.slice(0, 24)}`} className="profile-gallery-cell">
              <img src={imageUrl} alt={`Ảnh giới thiệu ${index + 1}`} />
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
              <strong>{unlockedAnimals}/{animalCollection.length}</strong>
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
                  <div className="profile-achievement-title">Huy hiệu nổi bật</div>
                  <span>{featuredBadges.length}/{FEATURED_BADGE_LIMIT} slot đang dùng</span>
                </div>
                {canCustomizeProfile && selectableBadgeList.length > 0 && (
                  <button
                    type="button"
                    className="profile-achievement-edit"
                    onClick={() => setBadgeEditorOpen((open) => !open)}
                  >
                    {badgeEditorOpen ? 'Đóng' : 'Chỉnh huy hiệu'}
                  </button>
                )}
              </div>
              <div className="profile-achievement-strip">
                {featuredBadgeSlots.map((badge, index) => {
                  const Icon = badge?.icon;
                  return (
                    <span key={badge?.label || `empty-${index}`} className={badge ? 'profile-achievement-pill' : 'profile-achievement-pill is-empty'}>
                      {badge ? (
                        <>
                          <Icon size={14} strokeWidth={2.5} />
                          {badge.label}
                        </>
                      ) : (
                        <>
                          <Star size={14} strokeWidth={2.5} />
                          Chọn huy hiệu
                        </>
                      )}
                    </span>
                  );
                })}
              </div>
              {badgeEditorOpen && canCustomizeProfile && (
                <div className="profile-badge-editor">
                  <div className="profile-badge-editor-note">Chọn tối đa {FEATURED_BADGE_LIMIT} huy hiệu nhiệm vụ để ghim ở đây. Huy hiệu đặc quyền do admin cấp sẽ nằm ở khung ảnh phía trên.</div>
                  {badgeEditorError && <div className="profile-badge-editor-error">{badgeEditorError}</div>}
                  <div className="profile-badge-editor-grid">
                    {selectableBadgeList.map((badge) => {
                      const Icon = badge.icon;
                      const selected = selectedFeaturedLabels.includes(badge.label);
                      return (
                        <button
                          key={badge.label}
                          type="button"
                          className={selected ? 'profile-badge-choice is-selected' : 'profile-badge-choice'}
                          onClick={() => toggleFeaturedBadge(badge.label)}
                        >
                          <Icon size={15} strokeWidth={2.4} />
                          <span>{badge.label}</span>
                          <em>{selected ? 'Đang ghim' : 'Có thể chọn'}</em>
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
            Tổng hợp từ level, điểm hoạt động, chuỗi ngày và khối lượng hôm nay.
          </div>
        </div>
      </section>

      <section className="profile-metric-grid">
        <MetricCard icon={Trophy} label="Level hiện tại" value={`${levelView.level}/${levelView.maxLevel}`} detail={`Còn ${fmtNum(levelView.remainingActions)} thao tác để lên level`} tone={rank.color} />
        <MetricCard icon={Activity} label="Thao tác hôm nay" value={fmtNum(todayActions)} detail={`${fmtNum(actionsPerHour)} thao tác/giờ active`} tone="#0891b2" />
        <MetricCard icon={Gauge} label="Điểm hoạt động" value={score.toFixed(1)} detail={`${fmtDur(activeSeconds)} active hôm nay`} tone={score >= 90 ? '#16a34a' : '#d97706'} />
        <MetricCard icon={Flame} label="Chuỗi ngày" value={`${currentStreak} ngày`} detail="Duy trì hoạt động liên tục" tone="#ea580c" />
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
              <div key={badge.label} className={badge.unlocked ? 'profile-badge is-unlocked' : 'profile-badge'}>
                <div className="profile-badge-icon"><Icon size={18} strokeWidth={2.4} /></div>
                <div>
                  <strong>{badge.label}</strong>
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
              {levelView.milestones.map((milestone) => {
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
            <RecordCard icon={Target} label="Tốc độ hôm nay" value={fmtNum(actionsPerHour)} detail="Thao tác mỗi giờ active" />
          </div>
        </div>

        <div className="profile-chart-card">
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
          <Suspense fallback={<div className="profile-chart-loading">Đang tải biểu đồ...</div>}>
            <UserActivityChart chartData={chartData} chartTickInterval={chartTickInterval} />
          </Suspense>
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
