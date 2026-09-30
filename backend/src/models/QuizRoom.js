'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class QuizRoom extends Model {}

QuizRoom.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    title: { type: DataTypes.STRING(120), allowNull: false, defaultValue: 'Phòng Quiz Thử Thách' },
    hostUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'host_user_id' },
    mode: {
      type: DataTypes.ENUM('ALL', 'IMAGE', 'MUSIC'),
      allowNull: false,
      defaultValue: 'ALL',
    },
    status: {
      type: DataTypes.ENUM('WAITING', 'PLAYING', 'SHOWING_RESULT', 'FINISHED'),
      allowNull: false,
      defaultValue: 'WAITING',
    },
    maxPlayers: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 20, field: 'max_players' },
    currentQuestionIndex: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'current_question_index' },
    totalQuestions: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 10, field: 'total_questions' },
    currentQuestionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'current_question_id' },
    questionStartTime: { type: DataTypes.BIGINT, allowNull: true, field: 'question_start_time' },
    questionDurationMs: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 10000, field: 'question_duration_ms' },
    selectedQuestionIds: { type: DataTypes.JSON, allowNull: true, field: 'selected_question_ids' },
    winnerUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'winner_user_id' },
    startedAt: { type: DataTypes.DATE, allowNull: true, field: 'started_at' },
    finishedAt: { type: DataTypes.DATE, allowNull: true, field: 'finished_at' },
  },
  { sequelize, modelName: 'QuizRoom', tableName: 'quiz_rooms', underscored: true }
);

module.exports = QuizRoom;
