import { Brain, Gamepad2, Images, Keyboard, Monitor, Move, Palette } from 'lucide-react';
import { ARCADE_GAME_REGISTRY, GAME_TYPES } from '../../../../shared/gameRegistry.mjs';

/**
 * GAME REGISTRY — nguồn duy nhất cho mọi thứ người dùng nhìn thấy của Game Center.
 *
 * Một entry chứa cả:
 * - định danh nội bộ (`id`, `gameType`, `catalogKey`) — KHÔNG đổi để không phá DB/socket/BXH;
 * - đường dẫn (`route`, `matchPaths`) — dùng cho menu dọc và trạng thái active;
 * - copy tiếng Việt (`menuNameVi`, `displayNameVi`, `subtitleVi`, `descriptionVi`);
 * - cờ hiển thị (`menuVisible`, `gameCenterVisible`) và icon 2D.
 *
 * Sidebar, Game Center, tiêu đề trang, lobby, kết quả và BXH đều đọc từ đây.
 * Thêm game mới = thêm một entry, không phải sửa 5 nơi.
 */

export const ARCADE_GAMES = Object.freeze(Object.fromEntries(
  ARCADE_GAME_REGISTRY.map(({ id, ...game }) => [id, game]),
));

const ARCADE_BY_ID = Object.freeze(Object.fromEntries(
  ARCADE_GAME_REGISTRY.map((game) => [game.id, game]),
));

export const GAME_REGISTRY = Object.freeze([
  {
    id: GAME_TYPES.TYPING_BATTLE,
    gameType: GAME_TYPES.TYPING_BATTLE,
    catalogKey: GAME_TYPES.TYPING_BATTLE,
    kind: 'typing',
    route: '/games/typing/passage',
    hubRoute: '/games/typing',
    matchPaths: ['/games/typing/passage', '/games/typing/room', '/games/typing/spectate'],
    exactPaths: ['/games/typing'],
    menuNameVi: 'Đua Gõ Chữ',
    displayNameVi: 'ĐUA GÕ CHỮ',
    subtitleVi: 'Gõ chính xác · Vượt đối thủ',
    descriptionVi: 'Gõ chính xác và vượt qua đối thủ.',
    longDescriptionVi: 'Đua cả đoạn văn tiếng Việt theo từng ký tự, đo tốc độ và độ chính xác. Chơi một mình để luyện nhịp, hoặc lập phòng 1 chọi 1, 2 chọi 2, 3 chọi 3.',
    place: 'ĐẤU TRƯỜNG GÕ PHÍM',
    mark: '01',
    icon: Keyboard,
    theme: { accent: '#38506f', soft: '#e7ecf4', ink: '#243449', floor: '#ccd7e6' },
    modes: ['SOLO', '1V1', '2V2', '3V3'],
    menuVisible: true,
    gameCenterVisible: true,
  },
  {
    id: GAME_TYPES.COMPUTER_RUSH,
    gameType: GAME_TYPES.COMPUTER_RUSH,
    catalogKey: GAME_TYPES.COMPUTER_RUSH,
    kind: 'arcade',
    route: '/games/typing/words',
    matchPaths: ['/games/typing/words'],
    menuNameVi: 'Gõ Nhanh',
    displayNameVi: 'GÕ NHANH',
    subtitleVi: 'Từ xuất hiện · Gõ thật nhanh',
    descriptionVi: 'Gõ thật nhanh những từ xuất hiện trên màn hình.',
    longDescriptionVi: 'Ngồi vào bàn máy, bắt lấy từng từ và giữ chuỗi ăn điểm. Từ đúng tự chuyển, sai một ký tự là chuỗi bắt đầu lại.',
    place: 'PHÒNG MÁY',
    mark: '02',
    icon: Monitor,
    theme: { accent: '#2f6f4f', soft: '#e2efe4', ink: '#26402f', floor: '#c3ddc0' },
    modes: ['SOLO', '1V1', '2V2', '3V3', 'TRIO'],
    menuVisible: true,
    gameCenterVisible: true,
  },
  {
    id: GAME_TYPES.DIRECTION_RUSH,
    gameType: GAME_TYPES.DIRECTION_RUSH,
    catalogKey: GAME_TYPES.DIRECTION_RUSH,
    kind: 'arcade',
    route: '/games/arcade/direction_rush',
    matchPaths: ['/games/arcade/direction_rush'],
    menuNameVi: 'Phản Xạ Bốn Hướng',
    displayNameVi: 'PHẢN XẠ BỐN HƯỚNG',
    subtitleVi: 'Nhanh mắt · Nhanh tay',
    descriptionVi: 'Nhìn hướng tiếp theo và phản xạ thật nhanh.',
    longDescriptionVi: 'Mũi tên hiện ra, bạn bấm đúng hướng. Nhịp nhanh dần, thỉnh thoảng có biển ĐẢO CHIỀU — bấm ngược lại mới đúng.',
    place: 'SÂN PHẢN XẠ',
    mark: '03',
    icon: Move,
    theme: { accent: '#5d62a8', soft: '#e8e8f7', ink: '#303359', floor: '#d2d3ec' },
    modes: ['SOLO', '1V1', '2V2', '3V3', 'TRIO'],
    menuVisible: true,
    gameCenterVisible: true,
  },
  {
    id: GAME_TYPES.MEMORY_FLASH,
    gameType: GAME_TYPES.MEMORY_FLASH,
    catalogKey: GAME_TYPES.MEMORY_FLASH,
    kind: 'arcade',
    route: '/games/arcade/memory_flash',
    matchPaths: ['/games/arcade/memory_flash'],
    menuNameVi: 'Trí Nhớ Nhanh',
    displayNameVi: 'TRÍ NHỚ NHANH',
    subtitleVi: 'Nhìn nhanh · Nhớ chuẩn',
    descriptionVi: 'Ghi nhớ vị trí trước khi thời gian biến mất.',
    longDescriptionVi: 'Ngắm những ô sao sáng lên, ghi nhớ vị trí rồi tìm lại khi bảng tắt. Càng lên nấc, thời gian nhìn và thời gian chọn càng ngắn.',
    place: 'PHÒNG TRÍ NHỚ',
    mark: '04',
    icon: Brain,
    theme: { accent: '#9a603b', soft: '#f5e7d7', ink: '#4a3323', floor: '#e6d2b5' },
    modes: ['SOLO', '1V1', '2V2', '3V3', 'TRIO'],
    menuVisible: true,
    gameCenterVisible: true,
  },
  {
    id: GAME_TYPES.DRAWING,
    gameType: GAME_TYPES.DRAWING,
    catalogKey: GAME_TYPES.DRAWING,
    kind: 'drawing',
    route: '/games/drawing',
    matchPaths: ['/games/drawing'],
    menuNameVi: 'Xưởng Vẽ',
    displayNameVi: 'XƯỞNG VẼ',
    subtitleVi: 'Vẽ sáng tạo · Chia sẻ tác phẩm',
    descriptionVi: 'Tự do sáng tạo và chia sẻ tác phẩm.',
    longDescriptionVi: 'Bảng vẽ 1200 × 700 với cọ, màu, tẩy và ảnh nền giấy. Tranh lưu nháp ngay trên thiết bị và đăng lên Thư viện tranh khi bạn thấy đủ đẹp.',
    place: 'PHÒNG NGHỆ THUẬT',
    mark: '05',
    icon: Palette,
    theme: { accent: '#a2553f', soft: '#f7e8dd', ink: '#4a2c23', floor: '#e8cbb4' },
    modes: [],
    menuVisible: true,
    gameCenterVisible: true,
  },
]);

export const GAME_BY_ID = Object.freeze(Object.fromEntries(
  GAME_REGISTRY.map((game) => [game.id, game]),
));

/** Menu dọc: đúng 5 trò đang mở, đúng thứ tự sản phẩm. */
export const GAME_MENU_ITEMS = Object.freeze(GAME_REGISTRY.filter((game) => game.menuVisible));

/** Game Center: cùng registry, có thể ẩn một game mà vẫn giữ trong menu. */
export const GAME_CENTER_ITEMS = Object.freeze(GAME_REGISTRY.filter((game) => game.gameCenterVisible));

export const GALLERY_NAV_ITEM = Object.freeze({
  id: 'gallery',
  route: '/creative-corner',
  matchPaths: ['/creative-corner'],
  menuNameVi: 'Thư viện tranh',
  displayNameVi: 'THƯ VIỆN TRANH',
  subtitleVi: 'Tranh của mọi người trong công ty',
  descriptionVi: 'Bộ sưu tập tác phẩm của mọi người — thả tim, tải ảnh, xem chi tiết.',
  icon: Images,
});

export const GAME_CENTER_NAV_ITEM = Object.freeze({
  id: 'game-center',
  route: '/games',
  matchPaths: ['/games'],
  menuNameVi: 'Trung tâm trò chơi',
  displayNameVi: 'TRUNG TÂM TRÒ CHƠI',
  descriptionVi: 'Toàn bộ trò chơi, trạng thái mở chơi và lối vào nhanh.',
  icon: Gamepad2,
});

/** Nhãn chế độ phòng — chỉ dùng cho hiển thị, enum nội bộ giữ nguyên. */
export const MODE_LABELS_VI = Object.freeze({
  SOLO: 'Chơi một mình',
  '1V1': 'Đấu 1 chọi 1',
  '2V2': 'Đấu đội 2 chọi 2',
  '3V3': 'Đấu đội 3 chọi 3',
  TRIO: 'Ba người tự do',
});

export const MODE_SHORT_VI = Object.freeze({
  SOLO: 'Một mình',
  '1V1': '1 chọi 1',
  '2V2': '2 chọi 2',
  '3V3': '3 chọi 3',
  TRIO: 'Ba người',
});

export const MODE_DETAIL_VI = Object.freeze({
  SOLO: '1 người · phá kỷ lục',
  '1V1': '2 người · 1 chọi 1',
  '2V2': '4 người · 2 chọi 2',
  '3V3': '6 người · 3 chọi 3',
  TRIO: '3 người · tranh hạng',
});

export const ROOM_STATUS_LABELS_VI = Object.freeze({
  WAITING: 'Đang chờ',
  READY: 'Sẵn sàng',
  STARTING: 'Chuẩn bị bắt đầu',
  PLAYING: 'Đang chơi',
  ACTIVE: 'Đang chơi',
  FINISHED: 'Đã kết thúc',
  CLOSED: 'Đã đóng',
});

export const GAME_STATUS_LABELS_VI = Object.freeze({
  AVAILABLE: 'Sẵn sàng',
  COMING_SOON: 'Sắp ra mắt',
});

const MODE_ALIASES = Object.freeze({ DUO: '1V1' });

/** Chuẩn hoá mode để tra nhãn; không đổi giá trị gửi lên server. */
export function canonicalModeId(mode) {
  const raw = String(mode ?? '').trim().toUpperCase();
  return MODE_ALIASES[raw] || raw;
}

export function modeLabelVi(mode) {
  const id = canonicalModeId(mode);
  return MODE_LABELS_VI[id] || String(mode ?? '');
}

export function modeShortVi(mode) {
  const id = canonicalModeId(mode);
  return MODE_SHORT_VI[id] || String(mode ?? '');
}

export function modeDetailVi(mode) {
  const id = canonicalModeId(mode);
  return MODE_DETAIL_VI[id] || '';
}

export function roomStatusVi(status) {
  return ROOM_STATUS_LABELS_VI[String(status ?? '').toUpperCase()] || '';
}

export function teamNameVi(team) {
  return `Đội ${String(team ?? '').toUpperCase()}`;
}

export function gameById(id) {
  return GAME_BY_ID[id] || null;
}

export function gameDisplayName(id) {
  return GAME_BY_ID[id]?.displayNameVi || ARCADE_BY_ID[id]?.name || 'Trò chơi';
}

export function gameMenuName(id) {
  return GAME_BY_ID[id]?.menuNameVi || gameDisplayName(id);
}

export function gameSubtitle(id) {
  return GAME_BY_ID[id]?.subtitleVi || ARCADE_BY_ID[id]?.subtitle || '';
}

/** Đơn vị đếm của từng game, dùng cho BXH/kết quả. */
export function gameUnitLabel(id) {
  if (id === GAME_TYPES.COMPUTER_RUSH) return 'từ';
  if (id === GAME_TYPES.MEMORY_FLASH) return 'vòng';
  if (id === GAME_TYPES.DIRECTION_RUSH) return 'hướng';
  return 'lượt';
}

/** Tìm game theo URL hiện tại (khớp dài nhất để không nhầm /games/typing với /games/typing/words). */
export function gameByPath(pathname) {
  if (!pathname) return null;
  let best = null;
  for (const game of GAME_REGISTRY) {
    const paths = [...(game.matchPaths || []), ...(game.exactPaths || [])];
    for (const path of paths) {
      const exact = (game.exactPaths || []).includes(path);
      const matches = exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
      if (matches && (!best || path.length > best.path.length)) best = { game, path };
    }
  }
  return best?.game || null;
}
