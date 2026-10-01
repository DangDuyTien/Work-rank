'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const {
  sequelize,
  User,
  QuizSet,
  QuizRoom,
  QuizPlayer,
  QuizQuestion,
  QuizAnswer,
  QuizUserStat,
} = require('../src/models');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');

test('Comprehensive Quiz Admin Management & Question Pipeline E2E Test Suite', async (t) => {
  let adminUser, memberUser;
  let adminToken, memberToken;
  let createdSetId = null;
  let createdQuestionId1 = null;
  let createdQuestionId2 = null;
  let createdQuestionId3 = null;
  let generatedShareCode = null;

  before(async () => {
    // Purge any lingering demo data
    await QuizAnswer.destroy({ where: {} });
    await QuizPlayer.destroy({ where: {} });
    await QuizRoom.destroy({ where: {} });
    await QuizQuestion.destroy({ where: {} });
    await QuizSet.destroy({ where: {} });

    const ts = Date.now();
    adminUser = await User.create({
      name: `Admin Quiz Master ${ts}`,
      email: `admin_quiz_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'admin',
      jobTitle: 'Admin',
      department: 'Ban Điều Hành',
    });

    memberUser = await User.create({
      name: `Regular Member ${ts}`,
      email: `member_quiz_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Engineer',
      department: 'Phòng Kỹ Thuật',
    });

    adminToken = jwt.sign({ sub: adminUser.id, role: adminUser.role }, env.jwtSecret);
    memberToken = jwt.sign({ sub: memberUser.id, role: memberUser.role }, env.jwtSecret);
  });

  after(async () => {
    await QuizAnswer.destroy({ where: {} });
    await QuizPlayer.destroy({ where: {} });
    await QuizRoom.destroy({ where: {} });
    await QuizQuestion.destroy({ where: {} });
    await QuizSet.destroy({ where: {} });
  });

  await t.test('1. Database Empty State: 0 demo questions and 0 demo sets exist', async () => {
    const qCount = await QuizQuestion.count();
    const sCount = await QuizSet.count();
    assert.equal(qCount, 0, 'Must have 0 demo questions in database');
    assert.equal(sCount, 0, 'Must have 0 demo sets in database');

    const adminListRes = await request(app)
      .get('/api/admin/quiz/questions')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(adminListRes.status, 200);
    assert.equal(adminListRes.body.data.length, 0, 'Admin questions list must be empty');
  });

  await t.test('2. RBAC Enforcement: Non-admins receive 403 Forbidden on all admin endpoints', async () => {
    // Member tries to list questions
    const qRes = await request(app)
      .get('/api/admin/quiz/questions')
      .set('Authorization', `Bearer ${memberToken}`);
    assert.equal(qRes.status, 403, 'Member must receive 403 Forbidden');

    // Member tries to create set
    const setRes = await request(app)
      .post('/api/admin/quiz/sets')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'Hacking Quiz' });
    assert.equal(setRes.status, 403, 'Member must receive 403 Forbidden');

    // Member tries to validate import
    const impRes = await request(app)
      .post('/api/admin/quiz/import/validate')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ sourceType: 'JSON', content: '[]' });
    assert.equal(impRes.status, 403, 'Member must receive 403 Forbidden');
  });

  await t.test('3. Quiz Set CRUD: Admin creates, edits, and reads QuizSet with share code', async () => {
    // 1. Create QuizSet
    const createRes = await request(app)
      .post('/api/admin/quiz/sets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Bộ Quiz Kiến Thức Chung 2026',
        description: 'Bộ câu hỏi tuyển chọn cho nhân viên',
        category: 'Văn Hóa',
        status: 'PUBLISHED',
      });

    assert.equal(createRes.status, 201);
    assert.ok(createRes.body.data.id);
    assert.equal(createRes.body.data.title, 'Bộ Quiz Kiến Thức Chung 2026');
    assert.ok(createRes.body.data.shareCode, 'Must generate unique share code');
    createdSetId = createRes.body.data.id;
    generatedShareCode = createRes.body.data.shareCode;

    // 2. Get QuizSet Detail
    const getRes = await request(app)
      .get(`/api/admin/quiz/sets/${createdSetId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.data.id, createdSetId);
    assert.equal(getRes.body.data.questionCount, 0);

    // 3. Update QuizSet
    const updateRes = await request(app)
      .put(`/api/admin/quiz/sets/${createdSetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Bộ Quiz Kiến Thức Chung 2026 (Cập nhật)',
        category: 'Công nghệ',
      });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.data.title, 'Bộ Quiz Kiến Thức Chung 2026 (Cập nhật)');
    assert.equal(updateRes.body.data.category, 'Công nghệ');
  });

  await t.test('4. Question CRUD & Order Index: Admin creates 3 questions, verifies sequence', async () => {
    // 1. Question 1
    const q1Res = await request(app)
      .post('/api/admin/quiz/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        quizSetId: createdSetId,
        type: 'IMAGE',
        category: 'Công nghệ',
        question: 'Ngôn ngữ lập trình nào phổ biến nhất cho web frontend?',
        optionA: 'JavaScript',
        optionB: 'C++',
        optionC: 'Pascal',
        optionD: 'Fortran',
        correctOption: 'A',
        explanation: 'JavaScript là ngôn ngữ chính chạy trên các trình duyệt web.',
        timeLimit: 15,
        points: 1000,
      });
    assert.equal(q1Res.status, 201);
    assert.equal(q1Res.body.data.orderIndex, 1);
    createdQuestionId1 = q1Res.body.data.id;

    // 2. Question 2
    const q2Res = await request(app)
      .post('/api/admin/quiz/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        quizSetId: createdSetId,
        type: 'IMAGE',
        category: 'Công nghệ',
        question: 'Giao thức bảo mật mã hóa trên web là gì?',
        optionA: 'HTTP',
        optionB: 'HTTPS',
        optionC: 'FTP',
        optionD: 'SMTP',
        correctOption: 'B',
        explanation: 'HTTPS sử dụng SSL/TLS để mã hóa dữ liệu.',
        timeLimit: 20,
        points: 1500,
      });
    assert.equal(q2Res.status, 201);
    assert.equal(q2Res.body.data.orderIndex, 2);
    createdQuestionId2 = q2Res.body.data.id;

    // 3. Question 3
    const q3Res = await request(app)
      .post('/api/admin/quiz/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        quizSetId: createdSetId,
        type: 'TEXT',
        category: 'Công nghệ',
        question: 'Hệ quản trị cơ sở dữ liệu quan hệ mã nguồn mở phổ biến?',
        optionA: 'MySQL',
        optionB: 'MS Word',
        optionC: 'Notepad',
        optionD: 'Photoshop',
        correctOption: 'A',
        explanation: 'MySQL là RDBMS quan hệ phổ biến nhất.',
        timeLimit: 15,
        points: 1000,
      });
    assert.equal(q3Res.status, 201);
    assert.equal(q3Res.body.data.orderIndex, 3);
    createdQuestionId3 = q3Res.body.data.id;

    // Verify QuizSet question count updated
    const setRes = await request(app)
      .get(`/api/admin/quiz/sets/${createdSetId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(setRes.body.data.questionCount, 3);
    assert.equal(setRes.body.data.questions.length, 3);
  });

  await t.test('5. Reorder Questions: Admin changes question sequence, backend saves canonical order', async () => {
    // Current order: Q1 (1), Q2 (2), Q3 (3)
    // New desired order: Q3, Q1, Q2
    const reorderRes = await request(app)
      .post('/api/admin/quiz/questions/reorder')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        questionIds: [createdQuestionId3, createdQuestionId1, createdQuestionId2],
      });

    assert.equal(reorderRes.status, 200);

    // Verify DB order
    const updatedQ3 = await QuizQuestion.findByPk(createdQuestionId3);
    const updatedQ1 = await QuizQuestion.findByPk(createdQuestionId1);
    const updatedQ2 = await QuizQuestion.findByPk(createdQuestionId2);

    assert.equal(updatedQ3.orderIndex, 1, 'Q3 should now have orderIndex 1');
    assert.equal(updatedQ1.orderIndex, 2, 'Q1 should now have orderIndex 2');
    assert.equal(updatedQ2.orderIndex, 3, 'Q2 should now have orderIndex 3');
  });

  await t.test('6. Duplicate & Delete Question: Clones question and deletes cleanly', async () => {
    // Duplicate Q1
    const dupRes = await request(app)
      .post(`/api/admin/quiz/questions/${createdQuestionId1}/duplicate`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(dupRes.status, 201);
    assert.match(dupRes.body.data.question, /\(Bản sao\)/);
    const clonedId = dupRes.body.data.id;

    // Delete cloned question
    const delRes = await request(app)
      .delete(`/api/admin/quiz/questions/${clonedId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(delRes.status, 200);

    const checkQ = await QuizQuestion.findByPk(clonedId);
    assert.equal(checkQ, null, 'Deleted question must not exist in DB');
  });

  await t.test('7. Import Validation Pipeline: Validates JSON, CSV, and formatted text', async () => {
    // 1. Valid JSON Import validation
    const validJsonContent = JSON.stringify({
      title: 'Imported Quiz JSON',
      questions: [
        {
          question: 'Trái Đất có hình dạng gì?',
          optionA: 'Hình cầu',
          optionB: 'Hình vuông',
          optionC: 'Hình tam giác',
          optionD: 'Hình nón',
          correctOption: 'A',
          timeLimit: 15,
          points: 1000,
        },
        {
          question: 'Nước sôi ở bao nhiêu độ C ở áp suất tiêu chuẩn?',
          optionA: '50 độ C',
          optionB: '100 độ C',
          optionC: '200 độ C',
          optionD: '0 độ C',
          correctOption: 'B',
          timeLimit: 10,
          points: 1000,
        },
      ],
    });

    const valJsonRes = await request(app)
      .post('/api/admin/quiz/import/validate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sourceType: 'JSON', content: validJsonContent });

    assert.equal(valJsonRes.status, 200);
    assert.equal(valJsonRes.body.data.total, 2);
    assert.equal(valJsonRes.body.data.validCount, 2);
    assert.equal(valJsonRes.body.data.errorCount, 0);

    // 2. Valid CSV Import validation
    const validCsvContent = `Question,Option A,Option B,Option C,Option D,Correct Option,Time Limit,Points
Thủ đô nước Pháp là gì?,Paris,London,Berlin,Rome,A,15,1000
1 năm có bao nhiêu quý?,2 quý,3 quý,4 quý,5 quý,C,15,1000`;

    const valCsvRes = await request(app)
      .post('/api/admin/quiz/import/validate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sourceType: 'CSV', content: validCsvContent });

    assert.equal(valCsvRes.status, 200);
    assert.equal(valCsvRes.body.data.total, 2);
    assert.equal(valCsvRes.body.data.validCount, 2);

    // 3. Error detection on invalid input
    const invalidJsonContent = JSON.stringify({
      questions: [
        {
          question: '', // Missing question
          optionA: 'A',
          optionB: 'B',
          optionC: 'C',
          optionD: 'D',
          correctOption: 'A',
        },
        {
          question: 'Câu hỏi thiếu phương án D?',
          optionA: 'A',
          optionB: 'B',
          optionC: 'C',
          optionD: '', // Missing D
          correctOption: 'A',
        },
        {
          question: 'Câu hỏi không có đáp án đúng?',
          optionA: 'A',
          optionB: 'B',
          optionC: 'C',
          optionD: 'D',
          correctOption: 'Z', // Invalid
        },
      ],
    });

    const valErrRes = await request(app)
      .post('/api/admin/quiz/import/validate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sourceType: 'JSON', content: invalidJsonContent });

    assert.equal(valErrRes.status, 200);
    assert.equal(valErrRes.body.data.total, 3);
    assert.equal(valErrRes.body.data.errorCount, 3);
  });

  await t.test('8. Confirm Import: Persists reviewed import data into a new QuizSet', async () => {
    const importPayload = {
      title: 'Bộ Quiz Khoa Học Tự Nhiên (Imported)',
      category: 'Khoa Học',
      questions: [
        {
          question: 'Mặt trời mọc ở hướng nào?',
          optionA: 'Hướng Đông',
          optionB: 'Hướng Tây',
          optionC: 'Hướng Nam',
          optionD: 'Hướng Bắc',
          correctOption: 'A',
          timeLimit: 15,
          points: 1000,
        },
        {
          question: 'Công thức hóa học của nước là gì?',
          optionA: 'CO2',
          optionB: 'H2O',
          optionC: 'NaCl',
          optionD: 'O2',
          correctOption: 'B',
          timeLimit: 15,
          points: 1000,
        },
      ],
    };

    const confirmRes = await request(app)
      .post('/api/admin/quiz/import/confirm')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(importPayload);

    assert.equal(confirmRes.status, 201);
    assert.equal(confirmRes.body.data.importedCount, 2);
    assert.ok(confirmRes.body.data.quizSet.id);
  });

  await t.test('9. Export & Share: Export JSON/CSV and retrieve shared quiz by shareCode', async () => {
    // 1. JSON Export
    const jsonExpRes = await request(app)
      .get(`/api/admin/quiz/sets/${createdSetId}/export?format=json`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(jsonExpRes.status, 200);
    assert.equal(jsonExpRes.body.totalQuestions, 3);
    assert.ok(jsonExpRes.body.questions.length === 3);

    // 2. CSV Export
    const csvExpRes = await request(app)
      .get(`/api/admin/quiz/sets/${createdSetId}/export?format=csv`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(csvExpRes.status, 200);
    assert.match(csvExpRes.text, /Question,Option A,Option B/);

    // 3. Share Code lookup
    assert.ok(generatedShareCode);
    const shareRes = await request(app)
      .get(`/api/admin/quiz/share/${generatedShareCode}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(shareRes.status, 200);
    assert.equal(shareRes.body.data.id, createdSetId);
    assert.equal(shareRes.body.data.questionCount, 3);
  });

  await t.test('10. Gameplay Integration: Room serves real questions in canonical sequence', async () => {
    // Host creates room with createdSetId
    const roomRes = await request(app)
      .post('/api/games/quiz/rooms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Trận Đấu Quiz Thực Tế',
        mode: 'ALL',
        maxPlayers: 10,
        totalQuestions: 3,
        quizSetId: createdSetId,
      });
    assert.equal(roomRes.status, 201);
    const roomId = roomRes.body.data.room.id;

    // Start match
    const startRes = await request(app)
      .post(`/api/games/quiz/rooms/${roomId}/start`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(startRes.status, 200);
    assert.equal(startRes.body.data.room.status, 'PLAYING');

    // Canonical order check: Q3 was ordered #1 in test 5
    assert.equal(startRes.body.data.room.currentQuestionId, createdQuestionId3);

    // Client sanitized question check: correctOption must be stripped
    assert.equal(startRes.body.data.currentQuestion.correctOption, undefined);
    assert.equal(startRes.body.data.currentQuestion.correct_option, undefined);
  });
});
