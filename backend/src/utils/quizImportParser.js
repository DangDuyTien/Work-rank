'use strict';

/**
 * Normalizes and validates a single quiz question item
 */
function normalizeAndValidateQuestion(raw, index = 0) {
  const errors = [];
  const warnings = [];

  // Extract Question Text
  const questionText = (
    raw.question ||
    raw.title ||
    raw.prompt ||
    raw.cauHoi ||
    raw['Câu hỏi'] ||
    ''
  ).toString().trim();

  if (!questionText) {
    errors.push('Nội dung câu hỏi không được để trống');
  }

  // Extract Options A, B, C, D
  let optA = '';
  let optB = '';
  let optC = '';
  let optD = '';

  if (Array.isArray(raw.options) || Array.isArray(raw.answers)) {
    const arr = raw.options || raw.answers;
    optA = arr[0] ? String(arr[0]).trim() : '';
    optB = arr[1] ? String(arr[1]).trim() : '';
    optC = arr[2] ? String(arr[2]).trim() : '';
    optD = arr[3] ? String(arr[3]).trim() : '';
  } else {
    optA = (raw.optionA || raw.option_a || raw.a || raw.A || raw['A'] || raw['Đáp án A'] || '').toString().trim();
    optB = (raw.optionB || raw.option_b || raw.b || raw.B || raw['B'] || raw['Đáp án B'] || '').toString().trim();
    optC = (raw.optionC || raw.option_c || raw.c || raw.C || raw['C'] || raw['Đáp án C'] || '').toString().trim();
    optD = (raw.optionD || raw.option_d || raw.d || raw.D || raw['D'] || raw['Đáp án D'] || '').toString().trim();
  }

  if (!optA) errors.push('Thiếu phương án A');
  if (!optB) errors.push('Thiếu phương án B');
  if (!optC) errors.push('Thiếu phương án C');
  if (!optD) errors.push('Thiếu phương án D');

  // Check duplicate answers
  const optionList = [optA, optB, optC, optD].filter(Boolean);
  const uniqueOpts = new Set(optionList.map((o) => o.toLowerCase()));
  if (optionList.length === 4 && uniqueOpts.size < 4) {
    warnings.push('Có các phương án trả lời trùng lặp nội dung');
  }

  // Extract Correct Option
  let correctOption = '';
  const rawCorrect = (
    raw.correctOption ||
    raw.correct_option ||
    raw.correct ||
    raw.answer ||
    raw.dapAn ||
    raw['Đáp án đúng'] ||
    raw['Đáp án'] ||
    ''
  ).toString().trim().toUpperCase();

  if (['A', 'B', 'C', 'D'].includes(rawCorrect)) {
    correctOption = rawCorrect;
  } else if (['0', '1', '2', '3'].includes(String(rawCorrect))) {
    correctOption = ['A', 'B', 'C', 'D'][Number(rawCorrect)];
  } else if (rawCorrect === optA && optA) {
    correctOption = 'A';
  } else if (rawCorrect === optB && optB) {
    correctOption = 'B';
  } else if (rawCorrect === optC && optC) {
    correctOption = 'C';
  } else if (rawCorrect === optD && optD) {
    correctOption = 'D';
  } else if (raw.correctIndex !== undefined && [0, 1, 2, 3].includes(Number(raw.correctIndex))) {
    correctOption = ['A', 'B', 'C', 'D'][Number(raw.correctIndex)];
  } else {
    errors.push('Không tìm thấy đáp án đúng hợp lệ (phải là A, B, C hoặc D)');
  }

  // Image & Audio URLs
  let imageUrl = (raw.imageUrl || raw.image_url || raw.image || raw.hinhAnh || raw['Hình ảnh'] || '').toString().trim();
  let audioUrl = (raw.audioUrl || raw.audio_url || raw.audio || '').toString().trim();

  // Validate image URL format if present
  if (imageUrl) {
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://') && !imageUrl.startsWith('/uploads/')) {
      warnings.push('Đường dẫn hình ảnh không ở định dạng URL thông thường');
    }
  }

  // Time Limit & Points
  const rawTime = parseInt(raw.timeLimit || raw.time_limit || raw.time || raw.thoiGian || raw['Thời gian'] || 15, 10);
  const timeLimit = Math.min(120, Math.max(5, isNaN(rawTime) ? 15 : rawTime));

  const rawPoints = parseInt(raw.points || raw.point || raw.diem || raw['Điểm'] || 1000, 10);
  const points = Math.min(10000, Math.max(100, isNaN(rawPoints) ? 1000 : rawPoints));

  const explanation = (raw.explanation || raw.giaiThich || raw['Giải thích'] || '').toString().trim();
  const category = (raw.category || raw.chuDe || 'Chung').toString().trim().slice(0, 60);

  // Type: IMAGE, MUSIC, TEXT
  let type = 'IMAGE';
  if (audioUrl) {
    type = 'MUSIC';
  } else if (imageUrl) {
    type = 'IMAGE';
  } else if (raw.type && ['IMAGE', 'MUSIC', 'TEXT'].includes(String(raw.type).toUpperCase())) {
    type = String(raw.type).toUpperCase();
  }

  const isValid = errors.length === 0;

  return {
    index: index + 1,
    isValid,
    status: isValid ? (warnings.length > 0 ? 'WARNING' : 'VALID') : 'ERROR',
    errors,
    warnings,
    data: {
      question: questionText,
      optionA: optA.slice(0, 255),
      optionB: optB.slice(0, 255),
      optionC: optC.slice(0, 255),
      optionD: optD.slice(0, 255),
      correctOption: correctOption || 'A',
      imageUrl: imageUrl || null,
      audioUrl: audioUrl || null,
      timeLimit,
      points,
      type,
      category: category || 'Chung',
      explanation: explanation || null,
    },
  };
}

/**
 * Parses JSON content (WorkRank format, Array of questions, or Quiz Object)
 */
function parseJson(content) {
  let parsed;
  try {
    parsed = typeof content === 'string' ? JSON.parse(content) : content;
  } catch (err) {
    throw new Error('Định dạng JSON không hợp lệ: ' + err.message);
  }

  let title = '';
  let description = '';
  let rawQuestions = [];

  if (Array.isArray(parsed)) {
    rawQuestions = parsed;
  } else if (parsed && typeof parsed === 'object') {
    title = parsed.title || parsed.name || parsed.ten || '';
    description = parsed.description || parsed.moTa || '';
    rawQuestions = parsed.questions || parsed.questionList || parsed.cauHoi || parsed.items || [];
    if (!Array.isArray(rawQuestions) && rawQuestions) {
      rawQuestions = [rawQuestions];
    }
  }

  if (!rawQuestions || rawQuestions.length === 0) {
    throw new Error('Không tìm thấy danh sách câu hỏi nào trong tệp JSON');
  }

  const normalized = rawQuestions.map((q, idx) => normalizeAndValidateQuestion(q, idx));

  return {
    title: title || 'Bộ câu hỏi Import (JSON)',
    description: description || '',
    total: normalized.length,
    validCount: normalized.filter((n) => n.isValid).length,
    errorCount: normalized.filter((n) => !n.isValid).length,
    items: normalized,
  };
}

/**
 * Basic CSV Parser handling quotes and commas/semicolons
 */
function parseCsvLine(line, delimiter = ',') {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parses CSV or TSV string into structured questions
 */
function parseCsv(content) {
  if (!content || !content.trim()) {
    throw new Error('Nội dung CSV trống');
  }

  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('Tệp CSV cần ít nhất 1 dòng tiêu đề và 1 dòng dữ liệu');
  }

  // Detect delimiter (, or ;)
  const firstLine = lines[0];
  const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';

  const rawHeaders = parseCsvLine(firstLine, delimiter).map((h) => h.toLowerCase().replace(/[\s_]+/g, ''));

  // Header mapping
  const findHeaderIndex = (aliases) => {
    return rawHeaders.findIndex((h) => aliases.some((a) => h.includes(a.toLowerCase().replace(/[\s_]+/g, ''))));
  };

  const idxQ = findHeaderIndex(['question', 'cauhoi', 'noidung', 'prompt']);
  const idxA = findHeaderIndex(['optiona', 'dapana', 'a']);
  const idxB = findHeaderIndex(['optionb', 'dapanb', 'b']);
  const idxC = findHeaderIndex(['optionc', 'dapanc', 'c']);
  const idxD = findHeaderIndex(['optiond', 'dapand', 'd']);
  const idxCorrect = findHeaderIndex(['correct', 'dapandung', 'answer', 'key']);
  const idxTime = findHeaderIndex(['time', 'thoigian', 'duration', 'timelimit']);
  const idxPoints = findHeaderIndex(['point', 'points', 'diem']);
  const idxImage = findHeaderIndex(['image', 'hinhanh', 'imageurl', 'anh']);
  const idxExplanation = findHeaderIndex(['explanation', 'giaithich', 'ghichu']);

  if (idxQ === -1) {
    throw new Error('Không tìm thấy cột câu hỏi (tiêu đề cột: "question" hoặc "câu hỏi")');
  }

  const rawQuestions = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    if (cols.length === 0 || !cols.some((c) => c.length > 0)) continue;

    rawQuestions.push({
      question: cols[idxQ] || '',
      optionA: idxA !== -1 ? cols[idxA] : cols[1] || '',
      optionB: idxB !== -1 ? cols[idxB] : cols[2] || '',
      optionC: idxC !== -1 ? cols[idxC] : cols[3] || '',
      optionD: idxD !== -1 ? cols[idxD] : cols[4] || '',
      correctOption: idxCorrect !== -1 ? cols[idxCorrect] : cols[5] || '',
      timeLimit: idxTime !== -1 ? cols[idxTime] : 15,
      points: idxPoints !== -1 ? cols[idxPoints] : 1000,
      imageUrl: idxImage !== -1 ? cols[idxImage] : '',
      explanation: idxExplanation !== -1 ? cols[idxExplanation] : '',
    });
  }

  const normalized = rawQuestions.map((q, idx) => normalizeAndValidateQuestion(q, idx));

  return {
    title: 'Bộ câu hỏi Import (CSV)',
    description: 'Import từ file định dạng bảng CSV',
    total: normalized.length,
    validCount: normalized.filter((n) => n.isValid).length,
    errorCount: normalized.filter((n) => !n.isValid).length,
    items: normalized,
  };
}

/**
 * Parses free-form / structured formatted text (e.g. Question + A. B. C. D. + Answer:)
 */
function parseFormattedText(text) {
  if (!text || !text.trim()) {
    throw new Error('Nội dung văn bản trống');
  }

  const blocks = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n\s*\n+/) // split by empty lines
    .map((b) => b.trim())
    .filter(Boolean);

  const rawQuestions = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    let question = '';
    let optA = '';
    let optB = '';
    let optC = '';
    let optD = '';
    let correct = '';
    let explanation = '';
    let imageUrl = '';

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (/^(câu\s*\d+[:.]|\d+[:.])/i.test(line)) {
        question = line.replace(/^(câu\s*\d+[:.]|\d+[:.])\s*/i, '').trim();
      } else if (/^[aA][:.]\s*/.test(line)) {
        optA = line.replace(/^[aA][:.]\s*/, '').trim();
      } else if (/^[bB][:.]\s*/.test(line)) {
        optB = line.replace(/^[bB][:.]\s*/, '').trim();
      } else if (/^[cC][:.]\s*/.test(line)) {
        optC = line.replace(/^[cC][:.]\s*/, '').trim();
      } else if (/^[dD][:.]\s*/.test(line)) {
        optD = line.replace(/^[dD][:.]\s*/, '').trim();
      } else if (lower.startsWith('đáp án:') || lower.startsWith('answer:') || lower.startsWith('đáp án đúng:')) {
        correct = line.replace(/^(đáp án:|answer:|đáp án đúng:)\s*/i, '').trim();
      } else if (lower.startsWith('giải thích:') || lower.startsWith('explanation:')) {
        explanation = line.replace(/^(giải thích:|explanation:)\s*/i, '').trim();
      } else if (lower.startsWith('ảnh:') || lower.startsWith('image:')) {
        imageUrl = line.replace(/^(ảnh:|image:)\s*/i, '').trim();
      } else if (!question) {
        question = line;
      }
    }

    if (question) {
      rawQuestions.push({
        question,
        optionA: optA,
        optionB: optB,
        optionC: optC,
        optionD: optD,
        correctOption: correct,
        explanation,
        imageUrl,
      });
    }
  }

  if (rawQuestions.length === 0) {
    throw new Error('Không thể nhận diện định dạng câu hỏi từ văn bản cung cấp');
  }

  const normalized = rawQuestions.map((q, idx) => normalizeAndValidateQuestion(q, idx));

  return {
    title: 'Bộ câu hỏi Import (Văn bản)',
    description: 'Import từ văn bản định dạng',
    total: normalized.length,
    validCount: normalized.filter((n) => n.isValid).length,
    errorCount: normalized.filter((n) => !n.isValid).length,
    items: normalized,
  };
}

/**
 * Universal Parser Router
 */
function parseQuizImport(sourceType, content) {
  switch (sourceType) {
    case 'JSON':
      return parseJson(content);
    case 'CSV':
      return parseCsv(content);
    case 'TEXT':
      return parseFormattedText(content);
    default:
      // Auto-detect format
      if (typeof content === 'object' || (typeof content === 'string' && (content.trim().startsWith('{') || content.trim().startsWith('[')))) {
        return parseJson(content);
      }
      if (typeof content === 'string' && content.includes(',') && content.split('\n').length > 1) {
        try {
          return parseCsv(content);
        } catch (_) {
          return parseFormattedText(content);
        }
      }
      return parseFormattedText(content);
  }
}

module.exports = {
  normalizeAndValidateQuestion,
  parseJson,
  parseCsv,
  parseFormattedText,
  parseQuizImport,
};
