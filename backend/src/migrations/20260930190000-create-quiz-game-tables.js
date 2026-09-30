'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. quiz_rooms
    const roomsExists = await queryInterface.describeTable('quiz_rooms').then(() => true).catch(() => false);
    if (!roomsExists) {
      await queryInterface.createTable('quiz_rooms', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        code: { type: Sequelize.STRING(20), allowNull: false, unique: true },
        title: { type: Sequelize.STRING(120), allowNull: false, defaultValue: 'Phòng Quiz Thử Thách' },
        host_user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        mode: {
          type: Sequelize.ENUM('ALL', 'IMAGE', 'MUSIC'),
          allowNull: false,
          defaultValue: 'ALL',
        },
        status: {
          type: Sequelize.ENUM('WAITING', 'PLAYING', 'SHOWING_RESULT', 'FINISHED'),
          allowNull: false,
          defaultValue: 'WAITING',
        },
        max_players: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 20 },
        current_question_index: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        total_questions: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 10 },
        current_question_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true },
        question_start_time: { type: Sequelize.BIGINT, allowNull: true },
        question_duration_ms: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 10000 },
        selected_question_ids: { type: Sequelize.JSON, allowNull: true },
        winner_user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        started_at: { type: Sequelize.DATE, allowNull: true },
        finished_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
      await queryInterface.addIndex('quiz_rooms', ['status'], { name: 'idx_quiz_rooms_status' });
      await queryInterface.addIndex('quiz_rooms', ['code'], { name: 'idx_quiz_rooms_code' });
      await queryInterface.addIndex('quiz_rooms', ['host_user_id'], { name: 'idx_quiz_rooms_host' });
    }

    // 2. quiz_players
    const playersExists = await queryInterface.describeTable('quiz_players').then(() => true).catch(() => false);
    if (!playersExists) {
      await queryInterface.createTable('quiz_players', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        room_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'quiz_rooms', key: 'id' },
          onDelete: 'CASCADE',
        },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        score: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        correct_answers: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        total_answered: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        total_response_time_ms: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        rank: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
        is_ready: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        joined_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
      await queryInterface.addIndex('quiz_players', ['room_id', 'user_id'], {
        unique: true,
        name: 'idx_quiz_players_room_user_unique',
      });
      await queryInterface.addIndex('quiz_players', ['room_id', 'score'], {
        name: 'idx_quiz_players_room_score',
      });
    }

    // 3. quiz_questions
    const questionsExists = await queryInterface.describeTable('quiz_questions').then(() => true).catch(() => false);
    if (!questionsExists) {
      await queryInterface.createTable('quiz_questions', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        type: {
          type: Sequelize.ENUM('IMAGE', 'MUSIC'),
          allowNull: false,
          defaultValue: 'IMAGE',
        },
        category: { type: Sequelize.STRING(60), allowNull: false, defaultValue: 'General' },
        question: { type: Sequelize.TEXT, allowNull: false },
        image_url: { type: Sequelize.TEXT, allowNull: true },
        audio_url: { type: Sequelize.TEXT, allowNull: true },
        option_a: { type: Sequelize.STRING(255), allowNull: false },
        option_b: { type: Sequelize.STRING(255), allowNull: false },
        option_c: { type: Sequelize.STRING(255), allowNull: false },
        option_d: { type: Sequelize.STRING(255), allowNull: false },
        correct_option: {
          type: Sequelize.ENUM('A', 'B', 'C', 'D'),
          allowNull: false,
        },
        explanation: { type: Sequelize.TEXT, allowNull: true },
        time_limit: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 10 },
        points: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1000 },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
      await queryInterface.addIndex('quiz_questions', ['type'], { name: 'idx_quiz_questions_type' });
      await queryInterface.addIndex('quiz_questions', ['is_active'], { name: 'idx_quiz_questions_active' });
    }

    // 4. quiz_answers
    const answersExists = await queryInterface.describeTable('quiz_answers').then(() => true).catch(() => false);
    if (!answersExists) {
      await queryInterface.createTable('quiz_answers', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        room_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'quiz_rooms', key: 'id' },
          onDelete: 'CASCADE',
        },
        question_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'quiz_questions', key: 'id' },
          onDelete: 'CASCADE',
        },
        question_index: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        selected_option: {
          type: Sequelize.ENUM('A', 'B', 'C', 'D'),
          allowNull: false,
        },
        is_correct: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        response_time_ms: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        score: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        submitted_at: { type: Sequelize.BIGINT, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
      await queryInterface.addIndex('quiz_answers', ['room_id', 'question_id', 'user_id'], {
        unique: true,
        name: 'idx_quiz_answers_unique_submission',
      });
      await queryInterface.addIndex('quiz_answers', ['room_id', 'question_id'], {
        name: 'idx_quiz_answers_room_question',
      });
    }

    // 5. quiz_user_stats
    const statsExists = await queryInterface.describeTable('quiz_user_stats').then(() => true).catch(() => false);
    if (!statsExists) {
      await queryInterface.createTable('quiz_user_stats', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
          unique: true,
        },
        games_played: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        games_won: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        total_score: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        total_correct: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        total_answered: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        highest_score: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
      await queryInterface.addIndex('quiz_user_stats', ['total_score'], {
        name: 'idx_quiz_user_stats_score',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('quiz_answers').catch(() => {});
    await queryInterface.dropTable('quiz_players').catch(() => {});
    await queryInterface.dropTable('quiz_rooms').catch(() => {});
    await queryInterface.dropTable('quiz_questions').catch(() => {});
    await queryInterface.dropTable('quiz_user_stats').catch(() => {});
  },
};
