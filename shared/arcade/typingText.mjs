/**
 * Hợp đồng chuẩn hoá văn bản gõ — DÙNG CHUNG cho client và server.
 *
 * Vì sao phải tách riêng:
 * - Client so sánh để complete từ; server replay lại để chấm điểm. Nếu hai bên
 *   chuẩn hoá khác nhau (NFC/NFD, hoa/thường, khoảng trắng) thì client thấy
 *   "đúng" nhưng server ghi "sai" — đúng lớp lỗi của Gõ Nhanh với tiếng Việt.
 * - Mọi nơi so sánh chữ phải đi qua đúng một hàm, không tự viết lại.
 *
 * Chính sách đã chọn cho Gõ Nhanh:
 *   Unicode NFC · không phân biệt hoa/thường · PHÂN BIỆT DẤU · gộp khoảng trắng
 *
 * Tuyệt đối KHÔNG bỏ dấu (NFD + strip combining marks). Người chơi phải gõ đúng
 * dấu nếu target có dấu; "quan ly" không được coi là "quản lý".
 */

const VI_LOCALE = 'vi';

/** Chuẩn so sánh cuối cùng: NFC, trim, gộp space, uppercase theo locale VI. */
export function normalizeTypingKey(value) {
  return String(value ?? '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleUpperCase(VI_LOCALE);
}

/**
 * Chuẩn hiển thị khi đang gõ: giữ khoảng trắng cuối (người chơi vừa bấm space)
 * nhưng vẫn NFC + uppercase để cột chữ khớp target.
 */
export function normalizeTypingDisplay(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/\s+/gu, ' ')
    .trimStart()
    .toLocaleUpperCase(VI_LOCALE);
}

/** 'empty' | 'prefix' | 'complete' | 'mismatch' — chỉ dựa trên native value. */
export function typingState(typed, target) {
  const typedKey = normalizeTypingKey(typed);
  if (!typedKey) return 'empty';
  const targetKey = normalizeTypingKey(target);
  if (typedKey === targetKey) return 'complete';
  return targetKey.startsWith(typedKey) ? 'prefix' : 'mismatch';
}

export function typingMatches(typed, target) {
  return typingState(typed, target) === 'complete';
}

const graphemeSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(VI_LOCALE, { granularity: 'grapheme' })
  : null;

/**
 * Tách theo grapheme để highlight không cắt dấu khỏi chữ.
 * NFC thường đã đủ, nhưng IME có thể trả NFD trong lúc composition — segmenter
 * giữ "ệ" là một đơn vị thay vì "e" + dấu rời.
 */
export function graphemes(value) {
  const text = String(value ?? '');
  if (graphemeSegmenter) return Array.from(graphemeSegmenter.segment(text), (part) => part.segment);
  return Array.from(text);
}

export function graphemeLength(value) {
  return graphemes(value).length;
}

/** Thời gian tối thiểu để gõ xong một từ — server dùng cùng công thức. */
export function minimumTypingMs(word) {
  return Math.max(140, graphemeLength(word) * 35);
}
