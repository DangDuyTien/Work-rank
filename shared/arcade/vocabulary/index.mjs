/**
 * Computer Rush — vocabulary index.
 *
 * Chuyển các nhóm từ thô thành entry có metadata ổn định:
 *   { id, text, language, category, difficulty, length, family, syllables }
 *
 * Nguyên tắc:
 * - `text` là dạng hiển thị (chữ hoa, NFC) — giống bank cũ để UI/typography không đổi.
 * - `key` là dạng so sánh: NFC + trim + gộp khoảng trắng + uppercase (vi).
 * - KHÔNG tự động dedupe: dữ liệu trùng được báo trong `VOCAB_STATS.duplicates`
 *   để test fail thay vì âm thầm bỏ bớt và làm sai con số.
 */

import { ENGLISH_GROUPS } from './english.mjs';
import { VIETNAMESE_GROUPS } from './vietnamese.mjs';

export const COMPUTER_SEQUENCE_LIMIT = 512;

const VI_LOCALE = 'vi';

export function normalizeKey(value) {
  return String(value ?? '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleUpperCase(VI_LOCALE);
}

function displayText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleUpperCase(VI_LOCALE);
}

function parseGroup(words) {
  return String(words)
    .split(/[,\n]/u)
    .map((item) => item.normalize('NFC').trim().replace(/\s+/gu, ' '))
    .filter(Boolean);
}

function hasDiacritics(text) {
  return /[^\u0000-\u007F]/u.test(text);
}

function syllableCount(text) {
  return text.split(' ').filter(Boolean).length;
}

/**
 * Gốc từ để chặn cụm gần trùng đứng sát nhau (design/designer/designing…).
 * Tiếng Việt: lấy âm tiết đầu ("thiết kế ảnh" → "thiết").
 */
function familyOf(text, language) {
  const first = text.split(' ')[0] || text;
  if (language === 'vi') return first;
  return first.replace(/(ings|ing|ers|er|ed|es|s)$/u, '') || first;
}

function classify(text, language) {
  const chars = Array.from(text).length;
  const words = syllableCount(text);
  const isPhrase = language === 'en' ? words >= 2 : words >= 3 || chars >= 18;
  const length = isPhrase
    ? 'phrase'
    : chars <= 5
      ? 'short'
      : chars <= 9
        ? 'medium'
        : 'long';

  let difficulty;
  if (isPhrase) difficulty = words >= 3 || chars >= 18 ? 'hard' : 'medium';
  else if (chars <= 5 && !hasDiacritics(text)) difficulty = 'easy';
  else if (chars <= 9) difficulty = 'medium';
  else difficulty = 'hard';

  return { chars, words, isPhrase, length, difficulty };
}

function buildEntries(groups, language) {
  const entries = [];
  for (const group of groups) {
    for (const raw of parseGroup(group.words)) {
      const text = displayText(raw);
      const meta = classify(text, language);
      entries.push({
        id: `${language}-${group.category}-${String(entries.length + 1).padStart(4, '0')}`,
        text,
        key: normalizeKey(text),
        language,
        category: group.category,
        difficulty: meta.difficulty,
        length: meta.length,
        family: familyOf(text, language),
        syllables: meta.words,
        chars: meta.chars,
      });
    }
  }
  return entries;
}

export const CHALLENGES = Object.freeze([
  ...buildEntries(ENGLISH_GROUPS, 'en'),
  ...buildEntries(VIETNAMESE_GROUPS, 'vi'),
]);

const byKey = new Map();
const duplicates = [];
for (const entry of CHALLENGES) {
  if (byKey.has(entry.key)) duplicates.push({ key: entry.key, id: entry.id, firstId: byKey.get(entry.key).id });
  else byKey.set(entry.key, entry);
}

function countBy(list, pick) {
  const out = {};
  for (const item of list) {
    const key = pick(item);
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

export const VOCAB_STATS = Object.freeze({
  total: CHALLENGES.length,
  unique: byKey.size,
  duplicates,
  byLanguage: countBy(CHALLENGES, (e) => e.language),
  byCategory: countBy(CHALLENGES, (e) => e.category),
  byDifficulty: countBy(CHALLENGES, (e) => e.difficulty),
  byLength: countBy(CHALLENGES, (e) => e.length),
});

/**
 * Bank tương thích ngược (shape cũ) — chỉ để tham chiếu; engine dùng CHALLENGES.
 */
export const WORD_BANK = Object.freeze({
  easy: Object.freeze(CHALLENGES.filter((e) => e.difficulty === 'easy').map((e) => e.text)),
  medium: Object.freeze(CHALLENGES.filter((e) => e.difficulty === 'medium').map((e) => e.text)),
  hard: Object.freeze(CHALLENGES.filter((e) => e.difficulty === 'hard').map((e) => e.text)),
  vietnamese: Object.freeze(CHALLENGES.filter((e) => e.language === 'vi').map((e) => e.text)),
});

/**
 * Tiến trình độ khó trong một trận 60 giây (tính theo index, thuần tuý):
 * 0–3 làm quen easy → 4–10 easy/medium → 11–23 medium (thỉnh thoảng easy)
 * → 24–35 medium + hard → 36+ medium/hard.
 */
export function tierForIndex(index) {
  if (index < 4) return 'easy';
  if (index < 11) return index % 2 ? 'medium' : 'easy';
  if (index < 24) return index % 4 === 3 ? 'easy' : 'medium';
  if (index < 36) return index % 5 === 4 ? 'hard' : 'medium';
  return index % 3 === 0 ? 'medium' : 'hard';
}

const POOL_CACHE = new Map();

export function entriesForDifficulty(difficulty) {
  const key = ['vietnamese', 'easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'mixed';
  if (POOL_CACHE.has(key)) return POOL_CACHE.get(key);
  const pool = key === 'mixed'
    ? CHALLENGES
    : key === 'vietnamese'
      ? CHALLENGES.filter((entry) => entry.language === 'vi')
      : CHALLENGES.filter((entry) => entry.difficulty === key);
  POOL_CACHE.set(key, pool);
  return pool;
}
