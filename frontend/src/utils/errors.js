/**
 * Standardized API Error Parser for WorkRank
 * Translates HTTP status codes, server error codes, and exception payloads into user-friendly Vietnamese messages.
 */

export function parseApiError(err, fallbackMessage = 'Đã có lỗi xảy ra, vui lòng thử lại.') {
  if (!err) return fallbackMessage;

  // 1. If error is already a string
  if (typeof err === 'string') return err;

  // 2. Check for response data from Axios
  const status = err?.response?.status;
  const data = err?.response?.data;
  const serverCode = data?.error?.code || data?.code;
  const serverMessage = data?.error?.message || data?.message || (typeof data?.error === 'string' ? data.error : null);

  // 3. Known specific server error code overrides (if serverMessage is missing or overly technical)
  const CODE_MESSAGES = {
    // Auth & Permission
    UNAUTHORIZED: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.',
    FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
    CROSS_TEAM_FORBIDDEN: 'Dữ liệu của đội khác được bảo mật. Bạn chỉ có quyền truy cập đội của mình.',
    CROSS_CHANNEL_FORBIDDEN: 'Kênh này thuộc đội khác. Bạn không có quyền truy cập.',
    ACCOUNT_LOCKED: 'Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ Quản trị viên.',

    // YouTube
    YOUTUBE_API_KEY_MISSING: 'Chưa cấu hình API Key YouTube trên máy chủ.',
    CHANNEL_NOT_FOUND: 'Không tìm thấy kênh YouTube yêu cầu.',
    CHANNEL_ALREADY_EXISTS: 'Kênh YouTube này đã được đăng ký trong hệ thống.',
    YOUTUBE_QUOTA_EXCEEDED: 'Đã vượt quá giới hạn lượt gọi API YouTube trong ngày (Quota Exceeded).',
    YOUTUBE_API_UNAVAILABLE: 'Dịch vụ YouTube API hiện không phản hồi. Vui lòng thử lại sau.',
    YOUTUBE_SYNC_FAILED: 'Không thể đồng bộ dữ liệu với YouTube.',

    // Competition & Rules
    SEASON_NOT_FOUND: 'Không tìm thấy thông tin mùa giải thi đấu.',
    SEASON_LOCKED: 'Mùa giải đã kết thúc hoặc đã bị khóa kết quả.',
    INVALID_RULE_SYNTAX: 'Cú pháp quy tắc thi đấu không hợp lệ.',
    OPTIMISTIC_LOCK_CONFLICT: 'Dữ liệu đã bị thay đổi bởi người dùng khác. Vui lòng làm mới trang.',

    // System & Network
    NETWORK_ERROR: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền mạng.',
    RATE_LIMIT_EXCEEDED: 'Bạn đang thao tác quá nhanh. Vui lòng đợi trong giây lát.',
  };

  if (serverCode && CODE_MESSAGES[serverCode]) {
    return CODE_MESSAGES[serverCode];
  }

  // 4. If server returned a clear safe message, use it
  if (serverMessage && typeof serverMessage === 'string' && serverMessage.trim()) {
    // Filter out raw SQL or stack traces if any slipped through
    if (!serverMessage.includes('Sequelize') && !serverMessage.includes('SELECT ') && !serverMessage.includes('at /')) {
      return serverMessage.trim();
    }
  }

  // 5. Generic HTTP Status Code mapping
  if (status) {
    switch (status) {
      case 400:
        return serverMessage || 'Yêu cầu không hợp lệ. Vui lòng kiểm tra lại thông tin.';
      case 401:
        return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      case 403:
        return 'Bạn không có quyền thực hiện thao tác này.';
      case 404:
        return 'Không tìm thấy dữ liệu yêu cầu.';
      case 409:
        return 'Dữ liệu bị xung đột hoặc đã tồn tại trong hệ thống.';
      case 422:
        return serverMessage || 'Thông tin cung cấp không đúng định dạng.';
      case 429:
        return 'Hệ thống đang nhận quá nhiều yêu cầu. Vui lòng thử lại sau giây lát.';
      case 500:
      case 502:
      case 503:
      case 504:
        return 'Máy chủ đang bận hoặc gặp sự cố tạm thời. Vui lòng thử lại sau.';
      default:
        break;
    }
  }

  // 6. Network timeout / offline errors
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
    return 'Yêu cầu quá thời gian chờ (Timeout). Vui lòng thử lại.';
  }
  if (err.message === 'Network Error' || !navigator.onLine) {
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng của bạn.';
  }

  return fallbackMessage;
}
