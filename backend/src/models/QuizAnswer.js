'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class QuizAnswer extends Model {}

QuizAnswer.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    roomId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'room_id' },
    questionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'question_id' },
    questionIndex: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'question_index' },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    selectedOption: {
      type: DataTypes.ENUM('A', 'B', 'C', 'D'),
      allowNull: false,
      field: 'selected_option',
    },
    isCorrect: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_correct' },
    responseTimeMs: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'response_time_ms' },
    score: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    submittedAt: { type: DataTypes.BIGINT, allowNull: true, field: 'submitted_at' },
  },
  { sequelize, modelName: 'QuizAnswer', tableName: 'quiz_answers', underscored: true }
);

module.exports = QuizAnswer;
