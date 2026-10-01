'use strict';

const express = require('express');
const controller = require('../controllers/quizAdmin.controller');
const { auth, requireRole } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Require authenticated admin for all /api/admin/quiz endpoints
router.use(auth);
router.use(requireRole('admin'));

// Image Upload
router.post('/upload-image', controller.uploadImage);

// Questions Management
router.get('/questions', asyncHandler(controller.listQuestions));
router.post('/questions', asyncHandler(controller.createQuestion));
router.post('/questions/reorder', asyncHandler(controller.reorderQuestions));
router.get('/questions/:id', asyncHandler(controller.getQuestion));
router.put('/questions/:id', asyncHandler(controller.updateQuestion));
router.post('/questions/:id/duplicate', asyncHandler(controller.duplicateQuestion));
router.delete('/questions/:id', asyncHandler(controller.deleteQuestion));

// Quiz Sets Management
router.get('/sets', asyncHandler(controller.listQuizSets));
router.post('/sets', asyncHandler(controller.createQuizSet));
router.get('/sets/:id', asyncHandler(controller.getQuizSet));
router.put('/sets/:id', asyncHandler(controller.updateQuizSet));
router.post('/sets/:id/duplicate', asyncHandler(controller.duplicateQuizSet));
router.delete('/sets/:id', asyncHandler(controller.deleteQuizSet));
router.get('/sets/:id/export', asyncHandler(controller.exportQuizSet));

// Share & Import Management
router.get('/share/:code', asyncHandler(controller.getSharedQuizSet));
router.post('/import/validate', asyncHandler(controller.validateAndParseImport));
router.post('/import/confirm', asyncHandler(controller.confirmImport));

module.exports = router;
