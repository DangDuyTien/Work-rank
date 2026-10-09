import {
  Activity,
  Trophy,
  Users,
  Swords,
  Crown,
  Flame,
  Calendar,
  Award,
  Shield,
  BadgeCheck,
  User,
  Tv,
  Building2,
  Gamepad2,
  Keyboard,
  Sparkles,
  LayoutGrid,
  Club,
  Palette,
  Target,
  Settings as SettingsIcon,
  Sliders,
} from 'lucide-react';

/**
 * Authoritative Navigation Hierarchy for WorkRank V3.3.
 *
 * Groups all active platform routes into clean, logical parent-child categories:
 * - Overview (Dashboard, YouTube Analytics, Leaderboard)
 * - Competition (Arena, Grand Championship)
 * - Collaboration (Members / Teams)
 * - Games (Capital Board Game, 2048, Guess Quiz)
 * - Admin (People & Privileges, Teams & YouTube, Seasons, Grand Championship, Operations & Logs)
 * - Account (Profile, Settings)
 */
export const NAVIGATION_CONFIG = [
  {
    id: 'overview',
    label: 'Công việc',
    icon: Target,
    collapsible: false,
    items: [
      {
        to: '/dashboard',
        label: 'Tổng quan',
        shortLabel: 'Tổng quan',
        icon: Target,
        tourTarget: 'nav-dashboard',
        description: 'Theo dõi kết quả công việc và chỉ tiêu KPI theo bộ phận',
      },
      {
        to: '/youtube',
        label: 'Số liệu YouTube',
        shortLabel: 'YouTube',
        icon: Tv,
        tourTarget: 'nav-youtube',
        description: 'Phân tích hiệu suất kênh và đội nhóm',
      },
      {
        to: '/leaderboard',
        label: 'Bảng xếp hạng',
        shortLabel: 'BXH',
        icon: Trophy,
        tourTarget: 'nav-leaderboard',
        description: 'Xếp hạng KPI, đội nhóm, thành viên, YouTube và vinh danh',
      },
    ],
  },

  {
    id: 'competition',
    label: 'Giải Đấu & Thi Đua',
    icon: Swords,
    collapsible: true,
    badge: 'Thi Đua',
    items: [
      {
        to: '/arena',
        label: 'Đấu Trường Mùa Giải',
        shortLabel: 'Mùa giải',
        icon: Swords,
        tourTarget: 'nav-arena',
        description: 'Đấu trường mùa giải, thử thách và tiến độ điểm thi đua',
      },
      {
        to: '/grand',
        label: 'Giải Vô Địch Năm (Grand)',
        shortLabel: 'Vô địch năm',
        icon: Crown,
        tourTarget: 'nav-grand',
        description: 'Cuộc đua vô địch năm và bảng xếp hạng điểm tích lũy',
      },
    ],
  },
  {
    id: 'collaboration',
    label: 'Cộng tác',
    icon: Users,
    collapsible: true,
    items: [
      {
        to: '/friends',
        label: 'Thành Viên & Đội Nhóm',
        shortLabel: 'Thành viên',
        icon: Users,
        description: 'Danh bạ đồng nghiệp, kết nối và thành viên đội nhóm',
      },
    ],
  },
  {
    id: 'games',
    label: 'Trò Chơi',
    icon: Gamepad2,
    collapsible: true,
    badge: 'Giải Trí',
    items: [
      {
        to: '/games',
        label: 'Danh mục trò chơi',
        shortLabel: 'Trò chơi',
        icon: Gamepad2,
        description: 'Danh sách trò chơi và trạng thái mở chơi',
      },
      {
        to: '/games/typing',
        label: 'WorkRank Typing Battle',
        shortLabel: 'Typing Battle',
        icon: Keyboard,
        badge: 'Mới',
        tourTarget: 'nav-typing-battle',
        description: 'Đấu trường thi đấu đánh máy tốc độ cao 1v1, 2v2, 3v3',
      },
      {
        to: '/games/capital-board',
        label: 'Cờ Tỷ Phú',
        shortLabel: 'Cờ Tỷ Phú',
        icon: Gamepad2,
        tourTarget: 'nav-capital-board',
        description: 'Trò chơi bàn cờ tỷ phú kinh doanh và đầu tư bất động sản',
      },
      {
        to: '/games/2048',
        label: '2048',
        shortLabel: '2048',
        icon: LayoutGrid,
        tourTarget: 'nav-game-2048',
        description: 'Trò chơi ghép số 2048 trí tuệ & bảng xếp hạng công ty',
      },
      {
        to: '/games/sam',
        label: 'Đánh Sâm',
        shortLabel: 'Đánh Sâm',
        icon: Club,
        badge: 'Mới',
        tourTarget: 'nav-sam-game',
        description: 'Trò chơi bài dân gian Đánh Sâm 2–4 người thời gian thực',
      },
      {
        to: '/games/quiz',
        label: 'Đoán Hình & Đoán Nhạc',
        shortLabel: 'Đoán Hình & Nhạc',
        icon: Sparkles,
        badge: 'Live',
        tourTarget: 'nav-guess-quiz',
        description: 'Mini game đoán hình ảnh & đoán bài hát tốc độ cao',
      },
      {
        to: '/games/drawing',
        label: 'Góc Sáng Tạo (Game Vẽ)',
        shortLabel: 'Game Vẽ Tranh',
        icon: Palette,
        badge: 'Mới',
        tourTarget: 'nav-drawing-game',
        description: 'Không gian vẽ tranh nghệ thuật & chia sẻ lên trang chủ WorkRank',
      },
    ],
  },
  {
    id: 'admin',
    label: 'Quản Trị Hệ Thống',
    icon: Shield,
    adminOnly: true,
    collapsible: true,
    badge: 'Quản Trị',
    items: [
      {
        to: '/admin/kpi',
        label: 'Quản Lý KPI & Phòng Ban',
        shortLabel: 'KPI & Ban',
        icon: Target,
        adminOnly: true,
        badge: 'Mới',
        description: 'Cấu hình phòng ban, thiết lập chỉ tiêu KPI và quản lý kết quả thực hiện',
      },
      {
        to: '/admin/quiz',
        label: 'Quản Lý Quiz Game',
        shortLabel: 'Quiz Game',
        icon: Sparkles,
        adminOnly: true,
        description: 'Tạo câu hỏi, upload hình ảnh, quản lý bộ câu hỏi Đoán Hình & Đoán Nhạc',
      },
      {
        to: '/admin/privileges',
        label: 'Quản Lý Nhân Sự & Đặc Quyền',
        shortLabel: 'Nhân sự',
        icon: User,
        adminOnly: true,
        description: 'Danh sách nhân viên, gán team/chức danh, cấp tích xanh & trao thưởng',
      },
      {
        to: '/admin/teams-youtube',
        label: 'Quản Lý Đội Nhóm & Kênh YouTube',
        shortLabel: 'Đội & Kênh',
        icon: Building2,
        adminOnly: true,
        description: 'Cấu hình teams, phân bổ phòng ban, kết nối & đồng bộ kênh YouTube',
      },
      {
        to: '/admin/competition/seasons',
        label: 'Quản Lý Mùa Giải',
        shortLabel: 'Mùa giải',
        icon: Calendar,
        adminOnly: true,
        description: 'Cấu hình thời gian, kích hoạt, tạm dừng và kết toán mùa giải',
      },
      {
        to: '/admin/competition/rules',
        label: 'Rule Builder & Mô Phỏng',
        shortLabel: 'Luật & Mô phỏng',
        icon: Sliders,
        adminOnly: true,
        description: 'Kiểm tra, mô phỏng và phát hành phiên bản luật đã được kiểm duyệt',
      },
      {
        to: '/admin/competition/grand',
        label: 'Quản Lý Giải Vô Địch Năm',
        shortLabel: 'Vô địch năm',
        icon: Award,
        adminOnly: true,
        description: 'Thiết lập giải đấu năm và kết toán điểm tích lũy',
      },
      {
        to: '/admin/operations',
        label: 'Giám Sát & Nhật Ký Kiểm Toán',
        shortLabel: 'Giám sát & Logs',
        icon: Flame,
        adminOnly: true,
        description: 'Sức khỏe hệ thống, hàng đợi sự kiện, đồng bộ BXH & Audit Logs',
      },
    ],
  },
  {
    id: 'account',
    label: 'Tài Khoản & Cài Đặt',
    icon: User,
    collapsible: true,
    items: [
      {
        to: (userId) => `/users/${userId || 1}`,
        label: 'Hồ Sơ Cá Nhân',
        shortLabel: 'Hồ sơ',
        icon: User,
        dynamicTo: true,
        description: 'Thông tin cá nhân, vị trí công tác và lịch sử vinh danh',
      },
      {
        to: '/settings',
        label: 'Cài đặt tài khoản',
        shortLabel: 'Cài đặt',
        icon: SettingsIcon,
        description: 'Tùy chỉnh thông báo, âm thanh và đổi mật khẩu bảo mật',
      },
    ],
  },
];

/**
 * Returns true if a given path matches the item's target path.
 */
export function isRouteActive(currentPath, targetPath) {
  if (!targetPath || typeof targetPath !== 'string') return false;
  if (targetPath === '/games') return currentPath === '/games';
  if (targetPath === '/dashboard') return currentPath === '/dashboard' || currentPath === '/kpi';
  if (targetPath === '/leaderboard' || targetPath === '/rankings') {
    return currentPath === '/leaderboard' || currentPath.startsWith('/leaderboard/') ||
           currentPath === '/rankings' || currentPath.startsWith('/rankings');
  }
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

/**
 * Resolves the target URL for navigation items (handles dynamic functions).
 */
export function resolveItemPath(item, userId) {
  if (typeof item.to === 'function') {
    return item.to(userId);
  }
  return item.to;
}

/**
 * Resolves the display title for the current route path.
 */
export function resolveCurrentTitle(pathname) {
  if (!pathname) return 'WorkRank';
  if (pathname === '/dashboard' || pathname === '/kpi') return 'Tổng quan';
  if (pathname.startsWith('/leaderboard') || pathname.startsWith('/rankings')) return 'Bảng Xếp Hạng';
  if (pathname.startsWith('/youtube')) return 'Số liệu YouTube';
  if (pathname.startsWith('/arena')) return 'Đấu Trường Mùa Giải';
  if (pathname.startsWith('/grand')) return 'Giải Vô Địch Năm (Grand)';
  if (pathname.startsWith('/friends')) return 'Thành Viên & Đội Nhóm';
  if (pathname.startsWith('/games/typing')) return 'WorkRank Typing Battle';
  if (pathname.startsWith('/games/2048')) return 'Game 2048';
  if (pathname.startsWith('/games/capital-board')) return 'Cờ Tỷ Phú';
  if (pathname.startsWith('/games/sam')) return 'Đánh Sâm';
  if (pathname.startsWith('/games/quiz')) return 'Đoán Hình & Đoán Nhạc';
  if (pathname.startsWith('/admin/kpi')) return 'Quản Lý KPI & Phòng Ban';
  if (pathname.startsWith('/admin/privileges')) return 'Quản Lý Nhân Sự & Đặc Quyền';
  if (pathname.startsWith('/admin/teams-youtube')) return 'Quản Lý Đội Nhóm & Kênh YouTube';
  if (pathname.startsWith('/admin/competition/seasons')) return 'Quản Lý Mùa Giải';
  if (pathname.startsWith('/admin/competition/rules')) return 'Rule Builder & Mô Phỏng';
  if (pathname.startsWith('/admin/competition/grand')) return 'Quản Lý Giải Vô Địch Năm';
  if (pathname.startsWith('/admin/operations')) return 'Giám Sát & Nhật Ký Kiểm Toán';
  if (pathname.startsWith('/users')) return 'Hồ Sơ Cá Nhân';
  if (pathname.startsWith('/settings')) return 'Cài đặt tài khoản';

  for (const group of NAVIGATION_CONFIG) {
    for (const item of group.items) {
      if (typeof item.to === 'string' && isRouteActive(pathname, item.to)) {
        return item.label;
      }
    }
  }
  return 'WorkRank';
}
