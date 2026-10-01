'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { Op } = require('sequelize');
const { QuizQuestion, QuizSet, User, sequelize } = require('../models');
const quizImportParser = require('../utils/quizImportParser');

// Configure multer storage for quiz uploads
const uploadDir = path.resolve(__dirname, '../../uploads/quiz');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `quiz-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận các định dạng ảnh: PNG, JPG, JPEG, WEBP, GIF, SVG'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/**
 * Handle single image upload
 */
const uploadImage = [
  upload.single('image'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn tệp hình ảnh để tải lên' });
    }

    const publicUrl = `/uploads/quiz/${req.file.filename}`;
    return res.json({
      success: true,
      url: publicUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  },
];

/**
 * Helper to generate random 8-character unique share code
 */
function generateShareCode() {
  return 'WR' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

// ── QUESTIONS MANAGEMENT ──

/**
 * List all quiz questions with pagination, search, and filters
 */
async function listQuestions(req, res) {
  const {
    page = 1,
    limit = 50,
    search = '',
    quizSetId,
    type,
    isActive,
    sortBy = 'orderIndex',
    order = 'ASC',
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  const where = {};

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    where[Op.or] = [
      { question: { [Op.like]: term } },
      { optionA: { [Op.like]: term } },
      { optionB: { [Op.like]: term } },
      { optionC: { [Op.like]: term } },
      { optionD: { [Op.like]: term } },
      { explanation: { [Op.like]: term } },
    ];
  }

  if (quizSetId !== undefined && quizSetId !== '') {
    where.quizSetId = quizSetId === 'null' || quizSetId === '0' ? null : Number(quizSetId);
  }

  if (type && ['IMAGE', 'MUSIC', 'TEXT'].includes(type)) {
    where.type = type;
  }

  if (isActive !== undefined && isActive !== '') {
    where.isActive = isActive === 'true' || isActive === true || isActive === '1';
  }

  const validSortCols = ['id', 'orderIndex', 'question', 'type', 'category', 'timeLimit', 'points', 'isActive', 'createdAt'];
  const sortCol = validSortCols.includes(sortBy) ? sortBy : 'orderIndex';
  const sortOrder = String(order).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  const orderClause = sortCol === 'orderIndex'
    ? [['orderIndex', sortOrder], ['id', sortOrder]]
    : [[sortCol, sortOrder]];

  const { count, rows } = await QuizQuestion.findAndCountAll({
    where,
    include: [
      {
        model: QuizSet,
        as: 'quizSet',
        attributes: ['id', 'title', 'category', 'status'],
      },
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'name', 'email'],
      },
    ],
    order: orderClause,
    limit: limitNum,
    offset,
    distinct: true,
  });

  return res.json({
    success: true,
    data: rows,
    pagination: {
      total: count,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(count / limitNum),
    },
  });
}

/**
 * Get single question by ID
 */
async function getQuestion(req, res) {
  const { id } = req.params;
  const question = await QuizQuestion.findByPk(id, {
    include: [
      { model: QuizSet, as: 'quizSet', attributes: ['id', 'title', 'category', 'status'] },
      { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
    ],
  });

  if (!question) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy câu hỏi' });
  }

  return res.json({ success: true, data: question });
}

/**
 * Create a new quiz question
 */
async function createQuestion(req, res) {
  const {
    quizSetId,
    type = 'IMAGE',
    category = 'Chung',
    question,
    imageUrl,
    audioUrl,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
    explanation,
    timeLimit = 15,
    points = 1000,
    isActive = true,
  } = req.body;

  if (!question || !question.trim()) {
    return res.status(400).json({ success: false, message: 'Nội dung câu hỏi không được để trống' });
  }

  if (!optionA || !optionB || !optionC || !optionD) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ 4 phương án A, B, C, D' });
  }

  if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
    return res.status(400).json({ success: false, message: 'Vui lòng chọn một đáp án đúng (A, B, C hoặc D)' });
  }

  const cleanType = ['IMAGE', 'MUSIC', 'TEXT'].includes(type) ? type : (audioUrl ? 'MUSIC' : (imageUrl ? 'IMAGE' : 'IMAGE'));
  const cleanTimeLimit = Math.min(120, Math.max(5, parseInt(timeLimit, 10) || 15));
  const cleanPoints = Math.min(10000, Math.max(100, parseInt(points, 10) || 1000));
  const cleanQuizSetId = quizSetId ? Number(quizSetId) : null;

  // Determine next order_index
  const maxOrderQ = await QuizQuestion.findOne({
    where: { quizSetId: cleanQuizSetId },
    order: [['orderIndex', 'DESC']],
    attributes: ['orderIndex'],
  });
  const nextOrder = (maxOrderQ?.orderIndex || 0) + 1;

  const newQuestion = await QuizQuestion.create({
    quizSetId: cleanQuizSetId,
    type: cleanType,
    category: (category || 'Chung').trim().slice(0, 60),
    question: question.trim(),
    imageUrl: imageUrl ? imageUrl.trim() : null,
    audioUrl: audioUrl ? audioUrl.trim() : null,
    optionA: optionA.trim().slice(0, 255),
    optionB: optionB.trim().slice(0, 255),
    optionC: optionC.trim().slice(0, 255),
    optionD: optionD.trim().slice(0, 255),
    correctOption,
    explanation: explanation ? explanation.trim() : null,
    timeLimit: cleanTimeLimit,
    points: cleanPoints,
    orderIndex: nextOrder,
    isActive: isActive === true || isActive === 'true' || isActive === 1,
    createdByUserId: req.user?.id || null,
  });

  const fullQuestion = await QuizQuestion.findByPk(newQuestion.id, {
    include: [
      { model: QuizSet, as: 'quizSet', attributes: ['id', 'title', 'category', 'status'] },
      { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
    ],
  });

  return res.status(201).json({
    success: true,
    message: 'Tạo câu hỏi thành công',
    data: fullQuestion,
  });
}

/**
 * Update an existing question
 */
async function updateQuestion(req, res) {
  const { id } = req.params;
  const question = await QuizQuestion.findByPk(id);

  if (!question) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy câu hỏi để cập nhật' });
  }

  const {
    quizSetId,
    type,
    category,
    question: questionText,
    imageUrl,
    audioUrl,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
    explanation,
    timeLimit,
    points,
    orderIndex,
    isActive,
  } = req.body;

  if (questionText !== undefined) {
    if (!questionText.trim()) {
      return res.status(400).json({ success: false, message: 'Nội dung câu hỏi không được để trống' });
    }
    question.question = questionText.trim();
  }

  if (optionA !== undefined) question.optionA = optionA.trim().slice(0, 255);
  if (optionB !== undefined) question.optionB = optionB.trim().slice(0, 255);
  if (optionC !== undefined) question.optionC = optionC.trim().slice(0, 255);
  if (optionD !== undefined) question.optionD = optionD.trim().slice(0, 255);

  if (correctOption !== undefined) {
    if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
      return res.status(400).json({ success: false, message: 'Đáp án đúng phải là A, B, C hoặc D' });
    }
    question.correctOption = correctOption;
  }

  if (type !== undefined && ['IMAGE', 'MUSIC', 'TEXT'].includes(type)) {
    question.type = type;
  }

  if (category !== undefined) question.category = category.trim().slice(0, 60);
  if (imageUrl !== undefined) question.imageUrl = imageUrl ? imageUrl.trim() : null;
  if (audioUrl !== undefined) question.audioUrl = audioUrl ? audioUrl.trim() : null;
  if (explanation !== undefined) question.explanation = explanation ? explanation.trim() : null;
  if (timeLimit !== undefined) question.timeLimit = Math.min(120, Math.max(5, parseInt(timeLimit, 10) || 15));
  if (points !== undefined) question.points = Math.min(10000, Math.max(100, parseInt(points, 10) || 1000));
  if (orderIndex !== undefined) question.orderIndex = parseInt(orderIndex, 10) || 0;
  if (quizSetId !== undefined) question.quizSetId = quizSetId ? Number(quizSetId) : null;
  if (isActive !== undefined) question.isActive = isActive === true || isActive === 'true' || isActive === 1;

  await question.save();

  const fullQuestion = await QuizQuestion.findByPk(question.id, {
    include: [
      { model: QuizSet, as: 'quizSet', attributes: ['id', 'title', 'category', 'status'] },
      { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
    ],
  });

  return res.json({
    success: true,
    message: 'Cập nhật câu hỏi thành công',
    data: fullQuestion,
  });
}

/**
 * Duplicate a single question
 */
async function duplicateQuestion(req, res) {
  const { id } = req.params;
  const original = await QuizQuestion.findByPk(id);

  if (!original) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy câu hỏi để nhân bản' });
  }

  const maxOrderQ = await QuizQuestion.findOne({
    where: { quizSetId: original.quizSetId },
    order: [['orderIndex', 'DESC']],
    attributes: ['orderIndex'],
  });
  const nextOrder = (maxOrderQ?.orderIndex || 0) + 1;

  const cloned = await QuizQuestion.create({
    quizSetId: original.quizSetId,
    type: original.type,
    category: original.category,
    question: `${original.question} (Bản sao)`,
    imageUrl: original.imageUrl,
    audioUrl: original.audioUrl,
    optionA: original.optionA,
    optionB: original.optionB,
    optionC: original.optionC,
    optionD: original.optionD,
    correctOption: original.correctOption,
    explanation: original.explanation,
    timeLimit: original.timeLimit,
    points: original.points,
    orderIndex: nextOrder,
    isActive: original.isActive,
    createdByUserId: req.user?.id || null,
  });

  const fullQuestion = await QuizQuestion.findByPk(cloned.id, {
    include: [
      { model: QuizSet, as: 'quizSet', attributes: ['id', 'title', 'category', 'status'] },
      { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
    ],
  });

  return res.status(201).json({
    success: true,
    message: 'Nhân bản câu hỏi thành công',
    data: fullQuestion,
  });
}

/**
 * Delete a single question
 */
async function deleteQuestion(req, res) {
  const { id } = req.params;
  const question = await QuizQuestion.findByPk(id);

  if (!question) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy câu hỏi để xóa' });
  }

  await question.destroy();

  return res.json({
    success: true,
    message: 'Đã xóa câu hỏi thành công',
  });
}

/**
 * Reorder questions within a QuizSet or globally
 */
async function reorderQuestions(req, res) {
  const { questionIds } = req.body;

  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp danh sách ID câu hỏi theo thứ tự mới' });
  }

  await sequelize.transaction(async (t) => {
    for (let i = 0; i < questionIds.length; i++) {
      const qId = Number(questionIds[i]);
      if (qId) {
        await QuizQuestion.update(
          { orderIndex: i + 1 },
          { where: { id: qId }, transaction: t }
        );
      }
    }
  });

  return res.json({
    success: true,
    message: 'Đã cập nhật thứ tự câu hỏi thành công',
  });
}

// ── QUIZ SETS MANAGEMENT ──

/**
 * List all quiz sets with question counts and share code
 */
async function listQuizSets(req, res) {
  const { search = '', status, isActive } = req.query;
  const where = {};

  if (search && search.trim()) {
    where.title = { [Op.like]: `%${search.trim()}%` };
  }

  if (status && ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status)) {
    where.status = status;
  }

  if (isActive !== undefined && isActive !== '') {
    where.isActive = isActive === 'true' || isActive === true || isActive === '1';
  }

  const sets = await QuizSet.findAll({
    where,
    include: [
      {
        model: QuizQuestion,
        as: 'questions',
        attributes: ['id', 'type', 'isActive', 'orderIndex'],
      },
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'name', 'email'],
      },
    ],
    order: [['createdAt', 'DESC']],
  });

  const formattedSets = sets.map((set) => {
    const json = set.toJSON();
    const questions = json.questions || [];
    json.questionCount = questions.length;
    json.activeQuestionCount = questions.filter((q) => q.isActive).length;
    delete json.questions;
    return json;
  });

  return res.json({
    success: true,
    data: formattedSets,
  });
}

/**
 * Get Quiz Set by ID including its questions in order
 */
async function getQuizSet(req, res) {
  const { id } = req.params;
  const set = await QuizSet.findByPk(id, {
    include: [
      {
        model: QuizQuestion,
        as: 'questions',
        include: [{ model: User, as: 'creator', attributes: ['id', 'name'] }],
      },
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'name', 'email'],
      },
    ],
    order: [[{ model: QuizQuestion, as: 'questions' }, 'orderIndex', 'ASC']],
  });

  if (!set) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy bộ câu hỏi' });
  }

  const json = set.toJSON();
  json.questionCount = (json.questions || []).length;
  json.activeQuestionCount = (json.questions || []).filter((q) => q.isActive).length;

  return res.json({
    success: true,
    data: json,
  });
}

/**
 * Create a new quiz set
 */
async function createQuizSet(req, res) {
  const { title, description, category = 'Chung', imageUrl, status = 'PUBLISHED', isActive = true } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, message: 'Tên bộ câu hỏi không được để trống' });
  }

  const shareCode = generateShareCode();
  const cleanStatus = ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status) ? status : 'PUBLISHED';

  const newSet = await QuizSet.create({
    title: title.trim().slice(0, 120),
    description: description ? description.trim() : null,
    category: (category || 'Chung').trim().slice(0, 60),
    imageUrl: imageUrl ? imageUrl.trim() : null,
    shareCode,
    status: cleanStatus,
    isActive: isActive === true || isActive === 'true' || isActive === 1,
    createdByUserId: req.user?.id || null,
  });

  const fullSet = await QuizSet.findByPk(newSet.id, {
    include: [{ model: User, as: 'creator', attributes: ['id', 'name', 'email'] }],
  });

  const json = fullSet.toJSON();
  json.questionCount = 0;
  json.activeQuestionCount = 0;

  return res.status(201).json({
    success: true,
    message: 'Tạo bộ câu hỏi thành công',
    data: json,
  });
}

/**
 * Update an existing quiz set
 */
async function updateQuizSet(req, res) {
  const { id } = req.params;
  const set = await QuizSet.findByPk(id);

  if (!set) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy bộ câu hỏi' });
  }

  const { title, description, category, imageUrl, status, isActive } = req.body;

  if (title !== undefined) {
    if (!title.trim()) {
      return res.status(400).json({ success: false, message: 'Tên bộ câu hỏi không được để trống' });
    }
    set.title = title.trim().slice(0, 120);
  }

  if (description !== undefined) set.description = description ? description.trim() : null;
  if (category !== undefined) set.category = category.trim().slice(0, 60);
  if (imageUrl !== undefined) set.imageUrl = imageUrl ? imageUrl.trim() : null;
  if (status !== undefined && ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status)) set.status = status;
  if (isActive !== undefined) set.isActive = isActive === true || isActive === 'true' || isActive === 1;

  if (!set.shareCode) {
    set.shareCode = generateShareCode();
  }

  await set.save();

  const fullSet = await QuizSet.findByPk(set.id, {
    include: [
      { model: QuizQuestion, as: 'questions', attributes: ['id', 'type', 'isActive'] },
      { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
    ],
  });

  const json = fullSet.toJSON();
  const questions = json.questions || [];
  json.questionCount = questions.length;
  json.activeQuestionCount = questions.filter((q) => q.isActive).length;
  delete json.questions;

  return res.json({
    success: true,
    message: 'Cập nhật bộ câu hỏi thành công',
    data: json,
  });
}

/**
 * Duplicate an entire Quiz Set with all its questions
 */
async function duplicateQuizSet(req, res) {
  const { id } = req.params;
  const original = await QuizSet.findByPk(id, {
    include: [
      {
        model: QuizQuestion,
        as: 'questions',
        order: [['orderIndex', 'ASC']],
      },
    ],
  });

  if (!original) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy bộ câu hỏi để nhân bản' });
  }

  const newShareCode = generateShareCode();

  const clonedSet = await sequelize.transaction(async (t) => {
    const createdSet = await QuizSet.create(
      {
        title: `${original.title} (Bản sao)`,
        description: original.description,
        category: original.category,
        imageUrl: original.imageUrl,
        shareCode: newShareCode,
        status: 'PUBLISHED',
        isActive: original.isActive,
        createdByUserId: req.user?.id || null,
      },
      { transaction: t }
    );

    const questions = original.questions || [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await QuizQuestion.create(
        {
          quizSetId: createdSet.id,
          type: q.type,
          category: q.category,
          question: q.question,
          imageUrl: q.imageUrl,
          audioUrl: q.audioUrl,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctOption: q.correctOption,
          explanation: q.explanation,
          timeLimit: q.timeLimit,
          points: q.points,
          orderIndex: i + 1,
          isActive: q.isActive,
          createdByUserId: req.user?.id || null,
        },
        { transaction: t }
      );
    }

    return createdSet;
  });

  const fullCloned = await QuizSet.findByPk(clonedSet.id, {
    include: [
      { model: QuizQuestion, as: 'questions', attributes: ['id', 'type', 'isActive'] },
      { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
    ],
  });

  const json = fullCloned.toJSON();
  json.questionCount = (json.questions || []).length;
  json.activeQuestionCount = (json.questions || []).filter((q) => q.isActive).length;
  delete json.questions;

  return res.status(201).json({
    success: true,
    message: 'Nhân bản bộ câu hỏi thành công',
    data: json,
  });
}

/**
 * Delete a quiz set and its questions
 */
async function deleteQuizSet(req, res) {
  const { id } = req.params;
  const set = await QuizSet.findByPk(id);

  if (!set) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy bộ câu hỏi để xóa' });
  }

  await sequelize.transaction(async (t) => {
    await QuizQuestion.destroy({ where: { quizSetId: id }, transaction: t });
    await set.destroy({ transaction: t });
  });

  return res.json({
    success: true,
    message: 'Đã xóa bộ câu hỏi và toàn bộ câu hỏi liên quan thành công',
  });
}

// ── IMPORT & EXPORT MANAGEMENT ──

/**
 * Validate and parse incoming quiz import data without saving
 */
async function validateAndParseImport(req, res) {
  const { sourceType, content } = req.body;

  if (!content) {
    return res.status(400).json({ success: false, message: 'Nội dung tệp import không được để trống' });
  }

  try {
    const parseResult = quizImportParser.parseQuizImport(sourceType, content);
    return res.json({
      success: true,
      data: parseResult,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Không thể phân tích dữ liệu import',
    });
  }
}

/**
 * Confirm and save reviewed import data into a QuizSet
 */
async function confirmImport(req, res) {
  const {
    title,
    description,
    category = 'Chung',
    status = 'PUBLISHED',
    targetQuizSetId,
    questions,
  } = req.body;

  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ success: false, message: 'Không có câu hỏi hợp lệ nào để import' });
  }

  const result = await sequelize.transaction(async (t) => {
    let targetSet;

    if (targetQuizSetId) {
      targetSet = await QuizSet.findByPk(targetQuizSetId, { transaction: t });
      if (!targetSet) throw new Error('Bộ câu hỏi đích không tồn tại');
    } else {
      const setShareCode = generateShareCode();
      targetSet = await QuizSet.create(
        {
          title: (title || 'Bộ câu hỏi Import').trim().slice(0, 120),
          description: description ? description.trim() : null,
          category: (category || 'Chung').trim().slice(0, 60),
          shareCode: setShareCode,
          status: ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status) ? status : 'PUBLISHED',
          isActive: true,
          createdByUserId: req.user?.id || null,
        },
        { transaction: t }
      );
    }

    const maxOrderQ = await QuizQuestion.findOne({
      where: { quizSetId: targetSet.id },
      order: [['orderIndex', 'DESC']],
      attributes: ['orderIndex'],
      transaction: t,
    });
    let startOrder = maxOrderQ?.orderIndex || 0;

    const insertedRows = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question || !q.optionA || !q.optionB || !q.optionC || !q.optionD || !q.correctOption) {
        continue; // Skip invalid
      }

      startOrder++;
      const row = await QuizQuestion.create(
        {
          quizSetId: targetSet.id,
          type: q.type || (q.imageUrl ? 'IMAGE' : (q.audioUrl ? 'MUSIC' : 'IMAGE')),
          category: (q.category || targetSet.category || 'Chung').trim().slice(0, 60),
          question: q.question.trim(),
          imageUrl: q.imageUrl ? q.imageUrl.trim() : null,
          audioUrl: q.audioUrl ? q.audioUrl.trim() : null,
          optionA: q.optionA.trim().slice(0, 255),
          optionB: q.optionB.trim().slice(0, 255),
          optionC: q.optionC.trim().slice(0, 255),
          optionD: q.optionD.trim().slice(0, 255),
          correctOption: ['A', 'B', 'C', 'D'].includes(q.correctOption) ? q.correctOption : 'A',
          explanation: q.explanation ? q.explanation.trim() : null,
          timeLimit: Math.min(120, Math.max(5, parseInt(q.timeLimit, 10) || 15)),
          points: Math.min(10000, Math.max(100, parseInt(q.points, 10) || 1000)),
          orderIndex: startOrder,
          isActive: true,
          createdByUserId: req.user?.id || null,
        },
        { transaction: t }
      );
      insertedRows.push(row);
    }

    return { targetSet, insertedCount: insertedRows.length };
  });

  return res.status(201).json({
    success: true,
    message: `Đã import thành công ${result.insertedCount} câu hỏi vào "${result.targetSet.title}"`,
    data: {
      quizSet: result.targetSet,
      importedCount: result.insertedCount,
    },
  });
}

/**
 * Export Quiz Set and its questions as JSON or CSV
 */
async function exportQuizSet(req, res) {
  const { id } = req.params;
  const { format = 'json' } = req.query;

  const set = await QuizSet.findByPk(id, {
    include: [
      {
        model: QuizQuestion,
        as: 'questions',
        order: [['orderIndex', 'ASC']],
      },
    ],
  });

  if (!set) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy bộ câu hỏi để export' });
  }

  const questions = (set.questions || []).map((q, idx) => ({
    order: idx + 1,
    question: q.question,
    type: q.type,
    category: q.category,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    correctOption: q.correctOption,
    explanation: q.explanation || '',
    timeLimit: q.timeLimit,
    points: q.points,
    imageUrl: q.imageUrl || '',
    audioUrl: q.audioUrl || '',
  }));

  if (String(format).toLowerCase() === 'csv') {
    // Generate CSV string
    const headers = [
      'Question',
      'Option A',
      'Option B',
      'Option C',
      'Option D',
      'Correct Option',
      'Time Limit',
      'Points',
      'Image URL',
      'Explanation',
    ];

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = questions.map((q) =>
      [
        escapeCsv(q.question),
        escapeCsv(q.optionA),
        escapeCsv(q.optionB),
        escapeCsv(q.optionC),
        escapeCsv(q.optionD),
        escapeCsv(q.correctOption),
        q.timeLimit,
        q.points,
        escapeCsv(q.imageUrl),
        escapeCsv(q.explanation),
      ].join(',')
    );

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="quiz-${set.id}-${Date.now()}.csv"`);
    return res.send(csvContent);
  }

  // Default JSON export
  const exportPayload = {
    workrankQuizVersion: '1.0',
    title: set.title,
    description: set.description,
    category: set.category,
    shareCode: set.shareCode,
    totalQuestions: questions.length,
    exportedAt: new Date().toISOString(),
    questions,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="quiz-${set.id}-${Date.now()}.json"`);
  return res.json(exportPayload);
}

/**
 * Fetch a shared Quiz Set by share code
 */
async function getSharedQuizSet(req, res) {
  const { code } = req.params;

  if (!code || !code.trim()) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã chia sẻ' });
  }

  const set = await QuizSet.findOne({
    where: { shareCode: code.trim().toUpperCase() },
    include: [
      {
        model: QuizQuestion,
        as: 'questions',
        order: [['orderIndex', 'ASC']],
      },
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'name'],
      },
    ],
  });

  if (!set) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy bộ câu hỏi với mã chia sẻ này' });
  }

  const json = set.toJSON();
  json.questionCount = (json.questions || []).length;

  return res.json({
    success: true,
    data: json,
  });
}

module.exports = {
  uploadImage,
  listQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  duplicateQuestion,
  deleteQuestion,
  reorderQuestions,
  listQuizSets,
  getQuizSet,
  createQuizSet,
  updateQuizSet,
  duplicateQuizSet,
  deleteQuizSet,
  validateAndParseImport,
  confirmImport,
  exportQuizSet,
  getSharedQuizSet,
};
