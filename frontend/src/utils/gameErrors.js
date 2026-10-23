/**
 * Chuyển lỗi kỹ thuật (thường là tiếng Anh từ API/socket) sang câu tiếng Việt
 * người chơi hiểu được. Không bao giờ hiển thị nguyên văn tiếng Anh trên UI.
 */
const VIETNAMESE_DIACRITICS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

const PATTERNS = [
  [/room is full|room.*full|đã đủ người/i, 'Phòng đã đủ người.'],
  [/room (no longer exists|not found|does not exist)|không tìm thấy phòng|phòng không tồn tại/i, 'Phòng này không còn tồn tại.'],
  [/already started|game.*started|trận đấu đã bắt đầu/i, 'Trận đấu đã bắt đầu.'],
  [/not (a )?member|not in (this )?room|forbidden/i, 'Bạn không còn ở trong phòng này.'],
  [/only the host|host only|not the host/i, 'Chỉ chủ phòng mới bắt đầu được ván mới.'],
  [/not ready|chưa sẵn sàng/i, 'Cả phòng cần sẵn sàng trước khi bắt đầu.'],
  [/team.*(unbalanced|not balanced)|cân bằng đội/i, 'Hai đội chưa cân bằng. Hãy chia lại đội trước khi bắt đầu.'],
  [/unauthorized|invalid token|jwt|token expired/i, 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'],
  [/failed to publish|publish.*fail|upload.*fail/i, 'Không thể đăng tranh. Bản nháp của bạn vẫn được giữ.'],
  [/payload too large|entity too large|quá lớn/i, 'Tệp quá lớn. Hãy giảm chi tiết ảnh rồi thử lại.'],
  [/network error|failed to fetch|timeout|econn/i, 'Mất kết nối tới máy chủ. Kiểm tra mạng rồi thử lại.'],
  [/rate limit|too many requests/i, 'Bạn thao tác hơi nhanh. Chờ vài giây rồi thử lại nhé.'],
];

export function gameErrorVi(error, fallback = 'Có lỗi xảy ra. Vui lòng thử lại.') {
  const raw = String(
    error?.response?.data?.message
    || error?.message
    || error
    || '',
  ).trim();

  if (!raw) return fallback;
  if (VIETNAMESE_DIACRITICS.test(raw)) return raw;

  for (const [pattern, message] of PATTERNS) {
    if (pattern.test(raw)) return message;
  }
  return fallback;
}

export default gameErrorVi;
