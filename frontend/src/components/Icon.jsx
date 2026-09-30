import React from 'react';
import {
  Trophy,
  Medal,
  Award,
  Crown,
  Users,
  User,
  Swords,
  Flame,
  Target,
  Tv,
  Video,
  Sparkles,
  Activity,
  Calendar,
  Shield,
  BadgeCheck,
  Settings,
  Bell,
  Clock,
  Layers,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Play,
  Eye,
  Star,
  Plus,
  Pencil,
  Trash2,
  Save,
  Check,
  CheckCircle2,
  X,
  XCircle,
  Search,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  ExternalLink,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  ChevronsUpDown,
  Minus,
  AlertTriangle,
  AlertCircle,
  Info,
  Lock,
  Unlock,
  MoreHorizontal,
  Gamepad2,
  Dice5,
  Coins,
  Building2,
  Building,
  Image,
  Music,
  Headphones,
  AudioLines,
  Timer,
  Radio,
  Volume2,
  VolumeX,
  Zap,
  ThumbsUp,
  MessageSquare,
  Wrench,
  History,
  HelpCircle,
  Lightbulb,
  Pause,
  Triangle,
  Diamond,
  Circle,
  Square,
  Scissors,
  PenLine,
  Briefcase,
  UserRound,
  CircleUserRound,
  UsersRound,
} from 'lucide-react';

/**
 * Standardized Icon Sizes
 * xs = 14px, sm = 16px (default), md = 18px, lg = 20px, xl = 24px
 */
export const ICON_SIZES = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
};

/**
 * Standardized Semantic Color Tones
 */
export const ICON_TONES = {
  default: '#0f172a',
  muted: '#94a3b8',
  primary: '#0284c7',
  success: '#16a34a',
  warning: '#f59e0b',
  danger: '#dc2626',
  accent: '#ea580c',
  gold: '#f59e0b',
  silver: '#94a3b8',
  bronze: '#b45309',
  inherit: 'currentColor',
};

const ICON_MAP = {
  trophy: Trophy,
  medal: Medal,
  award: Award,
  crown: Crown,
  champion: Crown,
  users: Users,
  team: Users,
  user: User,
  swords: Swords,
  arena: Swords,
  flame: Flame,
  fire: Flame,
  target: Target,
  challenge: Target,
  tv: Tv,
  youtube: Tv,
  video: Video,
  sparkles: Sparkles,
  activity: Activity,
  dashboard: Activity,
  calendar: Calendar,
  shield: Shield,
  'badge-check': BadgeCheck,
  settings: Settings,
  bell: Bell,
  clock: Clock,
  pending: Clock,
  layers: Layers,
  'bar-chart': BarChart3,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  play: Play,
  pause: Pause,
  eye: Eye,
  star: Star,
  plus: Plus,
  add: Plus,
  edit: Pencil,
  pencil: Pencil,
  trash: Trash2,
  delete: Trash2,
  save: Save,
  check: Check,
  'check-circle': CheckCircle2,
  success: CheckCircle2,
  x: X,
  close: X,
  'x-circle': XCircle,
  error: AlertCircle,
  search: Search,
  refresh: RefreshCw,
  retry: RotateCcw,
  filter: SlidersHorizontal,
  'external-link': ExternalLink,
  'arrow-left': ArrowLeft,
  back: ArrowLeft,
  'arrow-right': ArrowRight,
  next: ArrowRight,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'chevrons-up-down': ChevronsUpDown,
  minus: Minus,
  'alert-triangle': AlertTriangle,
  warning: AlertTriangle,
  'alert-circle': AlertCircle,
  info: Info,
  lock: Lock,
  unlock: Unlock,
  more: MoreHorizontal,
  gamepad: Gamepad2,
  game: Gamepad2,
  dice: Dice5,
  dice5: Dice5,
  coins: Coins,
  coin: Coins,
  money: Coins,
  building: Building,
  'building-2': Building2,
  image: Image,
  picture: Image,
  music: Music,
  headphones: Headphones,
  audiolines: AudioLines,
  'audio-lines': AudioLines,
  audio: AudioLines,
  timer: Timer,
  radio: Radio,
  volume: Volume2,
  'volume-2': Volume2,
  sound: Volume2,
  'volume-x': VolumeX,
  mute: VolumeX,
  zap: Zap,
  speed: Zap,
  bolt: Zap,
  'thumbs-up': ThumbsUp,
  like: ThumbsUp,
  'message-square': MessageSquare,
  comment: MessageSquare,
  wrench: Wrench,
  maintenance: Wrench,
  history: History,
  'help-circle': HelpCircle,
  question: HelpCircle,
  lightbulb: Lightbulb,
  triangle: Triangle,
  diamond: Diamond,
  circle: Circle,
  square: Square,
  scissors: Scissors,
  cut: Scissors,
  editor: Scissors,
  penline: PenLine,
  'pen-line': PenLine,
  content: PenLine,
  briefcase: Briefcase,
  'briefcase-business': Briefcase,
  'user-round': UserRound,
  'circle-user': CircleUserRound,
  'circle-user-round': CircleUserRound,
  'users-round': UsersRound,
};

/**
 * Standardized WorkRank UI Icon Component
 *
 * @param {string} [name] - Registered icon key (e.g. 'trophy', 'users', 'check')
 * @param {React.ComponentType} [as] - Directly passed Lucide icon component
 * @param {'xs'|'sm'|'md'|'lg'|'xl'|number} [size='sm'] - Standard size token or px number
 * @param {'default'|'muted'|'primary'|'success'|'warning'|'danger'|'accent'|'gold'|'silver'|'bronze'|'inherit'|string} [tone] - Color token or CSS color
 * @param {number} [strokeWidth=2] - SVG stroke width
 * @param {string} [className] - Optional class names
 * @param {React.CSSProperties} [style] - Inline CSS styles
 * @param {string} [ariaLabel] - Accessible label for functional icons
 * @param {boolean} [ariaHidden=true] - Hidden from screen readers if decorative
 */
export default function Icon({
  name,
  as: ComponentOverride,
  size = 'sm',
  tone,
  color,
  strokeWidth = 2,
  className = '',
  style = {},
  ariaLabel,
  ariaHidden = !ariaLabel,
  ...props
}) {
  const IconComponent = ComponentOverride || (name ? ICON_MAP[name.toLowerCase()] : null);

  if (!IconComponent) {
    if (process.env.NODE_ENV !== 'production' && name) {
      console.warn(`[Icon] Unknown icon name: "${name}"`);
    }
    return null;
  }

  // Resolve numerical size
  const resolvedSize = typeof size === 'number' ? size : (ICON_SIZES[size] || 16);

  // Resolve semantic color
  const resolvedColor = color || (tone ? (ICON_TONES[tone] || tone) : undefined);

  return (
    <IconComponent
      size={resolvedSize}
      strokeWidth={strokeWidth}
      color={resolvedColor}
      className={className}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      }}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden ? 'true' : undefined}
      role={ariaLabel ? 'img' : undefined}
      {...props}
    />
  );
}
