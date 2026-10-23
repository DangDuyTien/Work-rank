/**
 * Kiểm tra kho từ Gõ Nhanh trước khi đưa vào trận.
 *
 * Mục tiêu: không một entry nào có thể tạo ra "từ bất khả thi" — chữ nhìn đúng
 * nhưng không thể gõ đúng bằng bàn phím tiếng Việt, hoặc hai entry trùng nhau
 * sau chuẩn hoá khiến chuỗi/BXH lệch.
 */

import { CHALLENGES } from './index.mjs';
import { normalizeTypingKey } from '../typingText.mjs';

const CONTROL = /[\u0000-\u001F\u007F-\u009F]/u;
const COMBINING = /\p{M}/u;
// Gõ Nhanh chỉ so khớp chữ, số và khoảng trắng. Dấu câu/gạch nối phải được
// quyết định có chủ đích; hiện dataset không dùng nên coi là lỗi dữ liệu.
const UNSUPPORTED_PUNCTUATION = /[^\p{L}\p{N} ]/u;

export function validateVocabulary(entries = CHALLENGES) {
  const malformed = [];
  const duplicates = [];
  const punctuation = [];
  const seen = new Map();
  let nfc = 0;

  for (const entry of entries) {
    const text = String(entry?.text ?? '');
    const problems = [];

    if (!text) problems.push('empty');
    if (text !== text.normalize('NFC')) problems.push('not-nfc');
    else nfc += 1;
    if (COMBINING.test(text)) problems.push('combining-mark');
    if (CONTROL.test(text)) problems.push('control-char');
    if (text !== text.trim()) problems.push('edge-space');
    if (/\s{2,}/u.test(text)) problems.push('double-space');
    if (UNSUPPORTED_PUNCTUATION.test(text)) {
      problems.push('punctuation');
      punctuation.push({ id: entry.id, text });
    }
    if (Array.from(text).length > 120) problems.push('too-long');

    if (problems.length) malformed.push({ id: entry.id, text, problems });

    const key = normalizeTypingKey(text);
    if (seen.has(key)) duplicates.push({ key, first: seen.get(key), second: entry.id });
    else seen.set(key, entry.id);
  }

  return {
    total: entries.length,
    nfc,
    malformed,
    duplicates,
    punctuation,
    byLanguage: entries.reduce((acc, entry) => {
      const language = entry?.language || 'unknown';
      acc[language] = (acc[language] || 0) + 1;
      return acc;
    }, {}),
  };
}

export function formatValidation(report) {
  return [
    `Vietnamese entries: ${report.byLanguage.vi || 0}`,
    `English entries:    ${report.byLanguage.en || 0}`,
    `NFC normalized:     ${report.nfc}/${report.total}`,
    `Malformed entries:  ${report.malformed.length}`,
    `Duplicate canonical entries: ${report.duplicates.length}`,
    `Punctuation entries: ${report.punctuation.length}`,
  ].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = validateVocabulary();
  console.log(formatValidation(report));
  if (report.malformed.length) console.log('Malformed:', report.malformed.slice(0, 20));
  if (report.duplicates.length) console.log('Duplicates:', report.duplicates.slice(0, 20));
  process.exitCode = report.malformed.length || report.duplicates.length ? 1 : 0;
}
