'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class QuizQuestion extends Model {}

QuizQuestion.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    quizSetId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'quiz_set_id' },
    type: {
      type: DataTypes.ENUM('IMAGE', 'MUSIC', 'TEXT'),
      allowNull: false,
      defaultValue: 'IMAGE',
    },
    category: { type: DataTypes.STRING(60), allowNull: false, defaultValue: 'Chung' },
    question: { type: DataTypes.TEXT, allowNull: false },
    imageUrl: { type: DataTypes.TEXT, allowNull: true, field: 'image_url' },
    audioUrl: { type: DataTypes.TEXT, allowNull: true, field: 'audio_url' },
    optionA: { type: DataTypes.STRING(255), allowNull: false, field: 'option_a' },
    optionB: { type: DataTypes.STRING(255), allowNull: false, field: 'option_b' },
    optionC: { type: DataTypes.STRING(255), allowNull: false, field: 'option_c' },
    optionD: { type: DataTypes.STRING(255), allowNull: false, field: 'option_d' },
    correctOption: {
      type: DataTypes.ENUM('A', 'B', 'C', 'D'),
      allowNull: false,
      field: 'correct_option',
    },
    explanation: { type: DataTypes.TEXT, allowNull: true },
    timeLimit: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 15, field: 'time_limit' },
    points: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1000 },
    orderIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'order_index' },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    createdByUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'created_by_user_id' },
  },
  {
    sequelize,
    modelName: 'QuizQuestion',
    tableName: 'quiz_questions',
    underscored: true,
    timestamps: true,
  }
);

module.exports = QuizQuestion;
