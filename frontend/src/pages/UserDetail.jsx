import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { activity, users as usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  avatarHue,
  getStoredAvatar,
  initialsFromName,
  removeStoredAvatar,
  setStoredAvatar,
} from '../utils/avatar';
import {
  Activity,
  Award,
  BadgeCheck,
  CalendarDays,
  Bird,
  Bug,
  Cat,
  ChevronLeft,
  Clock3,
  Crown,
  Dog,
  Flame,
  Fish,
  Gauge,
  Keyboard,
  Medal,
  Mouse,
  PawPrint,
  Pencil,
  Rabbit,
  Rat,
  Shell,
  ShieldCheck,
  Snail,
  Star,
  Squirrel,
  Target,
  Timer,
  Trophy,
  Turtle,
  UserRound,
  Zap,
} from 'lucide-react';

const UserActivityChart = lazy(() => import('../components/UserActivityChart'));

const STATUS_CONFIG = {
  active: { label: 'Đang hoạt động', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', color: '#16a34a', dot: '#22c55e' },
  online: { label: 'Trực tuyến', bg: 'rgba(8,145,178,0.12)', border: 'rgba(8,145,178,0.35)', color: '#0891b2', dot: '#06b6d4' },
  idle: { label: 'Tạm nghỉ', bg: 'rgba(234,179,8,0.14)', border: 'rgba(234,179,8,0.35)', color: '#ca8a04', dot: '#eab308' },
  offline: { label: 'Ngoại tuyến', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)', color: '#64748b', dot: '#94a3b8' },
};

const RANK_TIERS = [
  { min: 45, tier: 'Legend', title: 'Huyền thoại WorkRank', color: '#7c3aed', soft: 'rgba(124,58,237,0.12)' },
  { min: 35, tier: 'Diamond', title: 'Đấu sĩ năng suất', color: '#0891b2', soft: 'rgba(8,145,178,0.12)' },
  { min: 25, tier: 'Platinum', title: 'Cao thủ tập trung', color: '#2563eb', soft: 'rgba(37,99,235,0.12)' },
  { min: 15, tier: 'Gold', title: 'Chiến binh bền bỉ', color: '#d97706', soft: 'rgba(217,119,6,0.14)' },
  { min: 7, tier: 'Silver', title: 'Người tăng tốc', color: '#64748b', soft: 'rgba(100,116,139,0.12)' },
  { min: 0, tier: 'Bronze', title: 'Tân binh tiềm năng', color: '#b45309', soft: 'rgba(180,83,9,0.12)' },
];

const ANIMAL_ICON_SEQUENCE = [Cat, Rabbit, Squirrel, Bird, Fish, Turtle, Dog, Snail, Bug, Rat, Shell, PawPrint];
const ANIMAL_COLOR_SEQUENCE = ['#d97706', '#16a34a', '#db2777', '#0891b2', '#7c3aed', '#dc2626'];
const ANIMAL_TRAITS = ['Nhanh nhẹn', 'Bền bỉ', 'Tập trung', 'Bứt tốc', 'Ổn định', 'Tinh anh'];
const ANIMAL_NAMES = [
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

const LEVEL_ANIMALS = ANIMAL_NAMES.map((name, level) => ({
  level,
  name,
  icon: ANIMAL_ICON_SEQUENCE[level % ANIMAL_ICON_SEQUENCE.length],
  color: ANIMAL_COLOR_SEQUENCE[level % ANIMAL_COLOR_SEQUENCE.length],
  trait: ANIMAL_TRAITS[level % ANIMAL_TRAITS.length],
}));

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

async function resizeAvatarFile(file) {
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

  const size = 320;
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

function buildAnimalCollection(currentLevel, maxLevel = 50) {
  const visibleMax = Math.min(Number(maxLevel || 50), LEVEL_ANIMALS.length - 1);
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
  const badgeSize = Math.max(14, size);
  return (
    <span
      className="profile-verified-mark"
      title="Tích xanh được quản trị viên cấp"
      aria-label="Đã được cấp tích xanh"
      style={{ width: badgeSize, height: badgeSize }}
    >
      <svg
        viewBox="0 0 16 16"
        width={Math.round(badgeSize * 0.72)}
        height={Math.round(badgeSize * 0.72)}
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M6.45 10.55 3.75 7.85 2.55 9.05l3.9 3.9 7-7-1.2-1.2-5.8 5.8Z"
          fill="#ffffff"
        />
      </svg>
    </span>
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
  const { socket, user: authUser } = useAuth();
  const avatarInputRef = useRef(null);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [levelInfo, setLevelInfo] = useState(null);
  const [localAvatarUrl, setLocalAvatarUrl] = useState('');
  const [avatarError, setAvatarError] = useState('');
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
    const timer = window.setInterval(() => setChartNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setLocalAvatarUrl(getStoredAvatar(id));
    setAvatarError('');
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
    const unlockedBadges = badges.filter((badge) => badge.unlocked).length;
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
  const isVerified = Boolean(user.isVerified || user.verified || user.is_verified);
  const featuredBadges = badges.filter((badge) => badge.unlocked).slice(0, 3);
  const canEditAvatar = String(authUser?.id || '') === String(user.id || id);
  const photoUrl = localAvatarUrl || user.avatarUrl || user.photoUrl || user.imageUrl || '';
  const avatarInitials = initialsFromName(user.name || `User #${id}`);
  const avatarHueValue = avatarHue(user.name, user.id || id);
  const CurrentAnimalIcon = currentAnimal.icon;
  const NextAnimalIcon = nextAnimal.icon;
  const currentMinute = chartNow.getHours() * 60 + chartNow.getMinutes();
  const currentBucket = timelineBucketMinute(currentMinute);
  const minuteMap = new Map(timeline.map((row) => [Number(row.minute), row]));
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

    try {
      const dataUrl = await resizeAvatarFile(file);
      setStoredAvatar(user.id || id, dataUrl);
      setLocalAvatarUrl(dataUrl);
      setAvatarError('');
    } catch (error) {
      setAvatarError(error.message || 'Không đổi được ảnh đại diện.');
    } finally {
      event.target.value = '';
    }
  };

  const avatarVisual = (
    <>
      {photoUrl ? (
        <img
          className="profile-photo"
          src={photoUrl}
          alt={`Ảnh đại diện ${user.name || `User #${id}`}`}
          onError={() => {
            if (localAvatarUrl) {
              removeStoredAvatar(user.id || id);
              setLocalAvatarUrl('');
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

  return (
    <div className="profile-page" style={{ '--rank-color': rank.color, '--rank-soft': rank.soft }}>
      <button type="button" className="profile-back-button" onClick={() => navigate(-1)}>
        <ChevronLeft size={15} strokeWidth={2.5} />
        Quay lại
      </button>

      <section className="profile-hero">
        <div className="profile-identity">
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
          <div className="profile-name-block">
            <div className="profile-eyebrow">
              <Crown size={15} />
              {rank.tier}
            </div>
            <div className="profile-name-line">
              <h1>{user.name || `User #${id}`}</h1>
              {isVerified && <VerifiedMark size={23} />}
            </div>
            <div className="profile-meta-row">
              <span>{rank.title}</span>
              <span>ID: WR-{String(user.id || id).padStart(4, '0')}</span>
              <span>{user.email || 'Không có email'}</span>
            </div>
            <div className="profile-chip-row">
              <StatusPill statusConfig={sc} />
              <span className="profile-title-chip"><BadgeCheck size={13} /> {unlockedBadges}/{badges.length} danh hiệu</span>
              <span className="profile-title-chip"><PawPrint size={13} /> {unlockedAnimals}/{animalCollection.length} thú sưu tầm</span>
              <span className="profile-title-chip"><Flame size={13} /> Chuỗi {currentStreak} ngày</span>
            </div>
            {(isVerified || featuredBadges.length > 0) && (
              <div className="profile-achievement-strip">
                {isVerified && (
                  <span className="profile-achievement-pill is-verified">
                    <VerifiedMark size={15} />
                    Đã cấp tích xanh
                  </span>
                )}
                {featuredBadges.map((badge) => {
                  const Icon = badge.icon;
                  return (
                    <span key={badge.label} className="profile-achievement-pill">
                      <Icon size={13} strokeWidth={2.5} />
                      {badge.label}
                    </span>
                  );
                })}
              </div>
            )}
            {avatarError && <div className="profile-avatar-error">{avatarError}</div>}
          </div>
        </div>

        <div className="profile-power-card">
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
              <p>
                Level {levelView.level} với {fmtNum(levelView.totalActions)} thao tác tích lũy. Hệ thống danh hiệu mở khóa theo level, kỷ lục và nhịp làm việc.
              </p>
            </div>
          </div>
          <div className="profile-next-target">
            <Target size={15} />
            Mục tiêu kế tiếp: Level {Math.min(levelView.maxLevel, levelView.level + 1)} trong {fmtNum(levelView.remainingActions)} thao tác.
          </div>
        </div>

        <div className="profile-badge-board">
          {badges.map((badge) => {
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
            <p>
              Mỗi level mở khóa một con vật riêng để sưu tầm. Con hiện tại mang thuộc tính {currentAnimal.trait.toLowerCase()} và đại diện cho mốc level của người dùng.
            </p>
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
  );
}
