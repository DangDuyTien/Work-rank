/**
 * Resolve URL của file tĩnh do backend trả về (ví dụ `/uploads/drawings/xxx.png`).
 *
 * Vì sao cần: API trả đường dẫn tương đối (`/uploads/...`), nhưng frontend có thể
 * chạy ở origin khác backend (dev: 5173 ⇄ 5001, hoặc deploy tách domain). Nếu dùng
 * nguyên đường dẫn tương đối thì trình duyệt sẽ request vào frontend → 404 → ảnh vỡ.
 */
const RAW_API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';

export const API_BASE_URL = String(RAW_API_BASE).replace(/\/+$/, '');

export function resolveAssetUrl(url) {
  if (!url) return '';
  const value = String(url).trim();
  if (!value) return '';

  // Đã là URL tuyệt đối / data URI / blob → giữ nguyên
  if (
    /^(https?:)?\/\//i.test(value) ||
    value.startsWith('data:') ||
    value.startsWith('blob:')
  ) {
    return value;
  }

  // Ảnh upload: ở dev API chạy localhost và Vite đã proxy /uploads → dùng đường
  // dẫn tương đối để ảnh same-origin (tránh CORP + tránh URL localhost lộ ra UI).
  if (value.startsWith('/uploads/')) {
    if (!API_BASE_URL || /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/i.test(API_BASE_URL)) return value;
    return `${API_BASE_URL}${value}`;
  }

  if (!API_BASE_URL) return value;
  return `${API_BASE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
}

export default resolveAssetUrl;
