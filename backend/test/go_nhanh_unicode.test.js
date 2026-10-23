const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const shared = path.resolve(__dirname, '../../shared/arcade');

async function loadTypingText() {
  return import(path.join(shared, 'typingText.mjs'));
}
async function loadEngine() {
  return import(path.join(shared, 'engine.mjs'));
}
async function loadVocabulary() {
  return import(path.join(shared, 'vocabulary/index.mjs'));
}
async function loadValidator() {
  return import(path.join(shared, 'vocabulary/validate.mjs'));
}

const VI_WORDS = ['nội dung', 'biên tập', 'thiết kế', 'quản lý', 'người dùng', 'chuyển đổi', 'đường dẫn', 'trưởng phòng', 'sáng tạo', 'công nghệ'];
const ACCENTED = ['đường', 'người', 'trường', 'chuyển', 'quản', 'nghiệp', 'thiết', 'biên', 'tưởng', 'hưởng'];

test('normalizeTypingKey: NFC và NFD cho cùng một key', async () => {
  const { normalizeTypingKey } = await loadTypingText();
  for (const word of [...VI_WORDS, ...ACCENTED]) {
    const nfc = word.normalize('NFC');
    const nfd = word.normalize('NFD');
    assert.notEqual(nfc, nfd, `${word}: NFD phải khác NFC ở mức code unit`);
    assert.equal(normalizeTypingKey(nfd), normalizeTypingKey(nfc), `${word}: NFD/NFC phải cùng key`);
  }
});

test('normalizeTypingKey: không phân biệt hoa thường nhưng PHÂN BIỆT DẤU', async () => {
  const { normalizeTypingKey } = await loadTypingText();
  assert.equal(normalizeTypingKey('nội dung'), 'NỘI DUNG');
  assert.equal(normalizeTypingKey('NỘI DUNG'), normalizeTypingKey('nội dung'));
  assert.notEqual(normalizeTypingKey('noi dung'), normalizeTypingKey('nội dung'));
  assert.notEqual(normalizeTypingKey('quan ly'), normalizeTypingKey('quản lý'));
  assert.notEqual(normalizeTypingKey('thu'), normalizeTypingKey('thư'));
  assert.notEqual(normalizeTypingKey('duong dan'), normalizeTypingKey('đường dẫn'));
});

test('normalizeTypingKey: gộp khoảng trắng, trim hai đầu', async () => {
  const { normalizeTypingKey } = await loadTypingText();
  assert.equal(normalizeTypingKey('  nội\t\t dung  '), 'NỘI DUNG');
  assert.equal(normalizeTypingKey('quản   lý'), normalizeTypingKey('QUẢN LÝ'));
});

test('typingState: prefix / complete / mismatch trên chuỗi có dấu', async () => {
  const { typingState } = await loadTypingText();
  assert.equal(typingState('quả', 'QUẢN LÝ'), 'prefix');
  assert.equal(typingState('quản l', 'QUẢN LÝ'), 'prefix');
  assert.equal(typingState('quản lý', 'QUẢN LÝ'), 'complete');
  assert.equal(typingState('quản lý'.normalize('NFD'), 'QUẢN LÝ'), 'complete');
  assert.equal(typingState('quảx', 'QUẢN LÝ'), 'mismatch');
  assert.equal(typingState('', 'QUẢN LÝ'), 'empty');
  assert.equal(typingState('quản lý ', 'QUẢN LÝ'), 'complete');
});

test('graphemes: dấu không bị tách khỏi nguyên âm', async () => {
  const { graphemes, graphemeLength } = await loadTypingText();
  for (const word of ACCENTED) {
    assert.equal(graphemeLength(word), Array.from(word).length, `${word}: NFC là 1 grapheme/ký tự`);
    assert.equal(graphemeLength(word.normalize('NFD')), graphemeLength(word), `${word}: NFD vẫn cùng số grapheme`);
  }
  assert.equal(graphemes('quản lý').length, 7);
  assert.deepEqual(graphemes('đường'), ['đ', 'ư', 'ờ', 'n', 'g']);
});

test('minimumTypingMs: sàn 140ms và tăng theo độ dài grapheme', async () => {
  const { minimumTypingMs } = await loadTypingText();
  assert.equal(minimumTypingMs('a'), 140);
  assert.equal(minimumTypingMs('đường'), 175);
  assert.ok(minimumTypingMs('quản lý dự án') > minimumTypingMs('quản'));
});

test('client/server parity: engine.normalizeWord dùng đúng một contract', async () => {
  const { normalizeTypingKey } = await loadTypingText();
  const { normalizeWord } = await loadEngine();
  const matrix = [
    'nội dung', 'NỘI DUNG', 'nội dung'.normalize('NFD'), '  quản   lý ', 'ĐƯỜNG DẪN',
    'thiết kế'.normalize('NFD'), 'Người Dùng', 'đ', 'Đ', 'a', 'A',
  ];
  for (const value of matrix) {
    assert.equal(normalizeWord(value), normalizeTypingKey(value), `lệch contract ở ${JSON.stringify(value)}`);
  }
});

test('kho từ: toàn bộ NFC, không trùng canonical, không dấu câu lạ', async () => {
  const { validateVocabulary } = await loadValidator();
  const report = validateVocabulary();
  assert.equal(report.total, 2817);
  assert.equal(report.byLanguage.vi, 1050);
  assert.equal(report.nfc, report.total);
  assert.deepEqual(report.malformed, []);
  assert.deepEqual(report.duplicates, []);
  assert.deepEqual(report.punctuation, []);
});

test('validator bắt được entry lỗi (double space, NFD, trùng, dấu câu)', async () => {
  const { validateVocabulary } = await loadValidator();
  const report = validateVocabulary([
    { id: 'a', text: 'NỘI  DUNG', language: 'vi' },
    { id: 'b', text: 'THIẾT KẾ'.normalize('NFD'), language: 'vi' },
    { id: 'c', text: 'QUẢN LÝ', language: 'vi' },
    { id: 'd', text: 'quản lý', language: 'vi' },
    { id: 'e', text: 'SẴN SÀNG!', language: 'vi' },
  ]);
  assert.ok(report.malformed.some((entry) => entry.problems.includes('double-space')));
  assert.ok(report.malformed.some((entry) => entry.problems.includes('not-nfc')));
  assert.ok(report.malformed.some((entry) => entry.problems.includes('punctuation')));
  assert.equal(report.duplicates.length, 1);
});

async function seedWithVietnamese(difficulty = 'mixed', min = 3) {
  const { challenge } = await loadEngine();
  for (let i = 0; i < 400; i++) {
    const seed = `vi-${i}`;
    const words = Array.from({ length: 12 }, (_, index) => challenge('computer_rush', seed, index, difficulty).word);
    if (words.filter((word) => /[^\u0000-\u007F]/u.test(word)).length >= min) return { seed, words };
  }
  throw new Error('Không tìm được seed có từ tiếng Việt');
}

async function eventsFor(words, { nfd = false, strip = false, speed = 1 } = {}) {
  const { minimumTypingMs } = await loadTypingText();
  let at = 0;
  return words.map((word, index) => {
    at += Math.ceil(minimumTypingMs(word) * speed) + 20;
    const value = strip
      ? word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
      : nfd ? word.normalize('NFD') : word.toLocaleLowerCase('vi');
    return { index, at, value, errors: 0 };
  });
}

test('hot path: 10.000 lần so sánh không chuẩn hoá lại cả kho từ', async () => {
  const { typingState } = await loadTypingText();
  const target = 'QUẢN LÝ DỰ ÁN';
  const typed = 'quản lý dự';
  const start = performance.now();
  for (let i = 0; i < 10000; i++) typingState(typed, target);
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 400, `10k lần mất ${elapsed.toFixed(1)}ms`);
});

test('replay: chấp nhận NFC, NFD và lowercase; từ chối chuỗi mất dấu', async () => {
  const { replay } = await loadEngine();
  const { seed, words } = await seedWithVietnamese('mixed', 2);

  const nfc = replay('computer_rush', seed, await eventsFor(words), { difficulty: 'mixed' });
  assert.equal(nfc.correct, words.length);

  const nfd = replay('computer_rush', seed, await eventsFor(words, { nfd: true }), { difficulty: 'mixed' });
  assert.equal(nfd.correct, words.length);

  const stripped = replay('computer_rush', seed, await eventsFor(words, { strip: true }), { difficulty: 'mixed' });
  assert.ok(stripped.correct < words.length, 'mất dấu phải bị tính sai');
});

test('replay: chặn hoàn thành từ quá nhanh theo đúng minimumTypingMs', async () => {
  const { replay, challenge } = await loadEngine();
  const word = challenge('computer_rush', 'speed-seed', 0, 'mixed').word;
  assert.throws(
    () => replay('computer_rush', 'speed-seed', [{ index: 0, at: 50, value: word, errors: 0 }], { difficulty: 'mixed' }),
    /quá nhanh/,
  );
});

test('replay: chuỗi trộn Anh – Việt hoàn thành đúng từng từ', async () => {
  const { replay } = await loadEngine();
  const { seed, words } = await seedWithVietnamese('mixed', 3);
  const mixed = words.slice(0, 10);
  assert.ok(mixed.some((word) => !/[^\u0000-\u007F]/u.test(word)), 'phải có ít nhất một từ tiếng Anh');
  const metrics = replay('computer_rush', seed, await eventsFor(mixed), { difficulty: 'mixed' });
  assert.equal(metrics.correct, mixed.length);
  assert.equal(metrics.wrongCount, 0);
  assert.equal(metrics.combo, mixed.length);
});
