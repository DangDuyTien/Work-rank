export const GAME_TYPES = Object.freeze({
  TYPING_BATTLE: 'typing_battle',
  COMPUTER_RUSH: 'computer_rush',
  DIRECTION_RUSH: 'direction_rush',
  MEMORY_FLASH: 'memory_flash',
  DRAWING: 'drawing',
});

export const GAME_TYPE_ALIASES = Object.freeze({
  typing: GAME_TYPES.TYPING_BATTLE,
  'computer-rush': GAME_TYPES.COMPUTER_RUSH,
  'direction-rush': GAME_TYPES.DIRECTION_RUSH,
  'memory-flash': GAME_TYPES.MEMORY_FLASH,
});

export function canonicalGameType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return Object.values(GAME_TYPES).includes(normalized)
    ? normalized
    : GAME_TYPE_ALIASES[normalized] || null;
}

export const ARCADE_GAME_REGISTRY = Object.freeze([
  {
    id: GAME_TYPES.COMPUTER_RUSH,
    name: 'Computer Rush',
    subtitle: 'Gõ nhanh · Giữ combo',
    place: 'CÂU LẠC BỘ MÁY TÍNH',
    mark: '01',
    description: 'Ngồi vào máy, bắt lấy từng từ và giữ chuỗi combo của bạn.',
    controls: 'Gõ vào ô nhập. Đúng từ sẽ tự chuyển; Enter để bỏ qua từ sai. Không phân biệt hoa/thường, có phân biệt dấu tiếng Việt.',
    icon: 'Monitor',
  },
  {
    id: GAME_TYPES.DIRECTION_RUSH,
    name: 'Direction Rush',
    subtitle: 'Nhanh mắt · Nhanh tay',
    place: 'SÂN CHƠI PHẢN XẠ',
    mark: '02',
    description: 'Theo mũi tên, lướt đúng hướng. Càng chơi, nhịp càng nhanh!',
    controls: 'Phím mũi tên hoặc WASD khi sân chơi có focus. Điện thoại: vuốt trong sân hoặc bấm bốn nút hướng. Không giữ phím.',
    icon: 'Move',
  },
  {
    id: GAME_TYPES.MEMORY_FLASH,
    name: 'Memory Flash',
    subtitle: 'Nhìn nhanh · Nhớ chuẩn',
    place: 'KHU VƯỜN TRÍ NHỚ',
    mark: '03',
    description: 'Ngắm những ô sao, ghi nhớ rồi tìm lại khi ánh sáng tắt. Càng lên nấc, thời gian nhìn và thời gian chọn càng ngắn.',
    controls: 'Chờ bảng sáng rồi tắt. Chọn đủ số ô sao trong thời gian cho phép; bấm lại để bỏ chọn. Bảng tự chấm sau 220ms khi chọn đủ. Hết giờ chọn = mất vòng.',
    icon: 'Brain',
  },
]);

export const ARCADE_GAME_TYPES = Object.freeze(ARCADE_GAME_REGISTRY.map((game) => game.id));
