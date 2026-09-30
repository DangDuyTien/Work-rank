'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class QuizQuestion extends Model {}

QuizQuestion.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    type: {
      type: DataTypes.ENUM('IMAGE', 'MUSIC'),
      allowNull: false,
      defaultValue: 'IMAGE',
    },
    category: { type: DataTypes.STRING(60), allowNull: false, defaultValue: 'General' },
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
    timeLimit: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 10, field: 'time_limit' },
    points: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1000 },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  },
  { sequelize, modelName: 'QuizQuestion', tableName: 'quiz_questions', underscored: true }
);

module.exports = QuizQuestion;
