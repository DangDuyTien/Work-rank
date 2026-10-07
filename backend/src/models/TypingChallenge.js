'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class TypingChallenge extends Model {}

TypingChallenge.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING(150), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    language: {
      type: DataTypes.ENUM('VI', 'EN', 'CODE'),
      allowNull: false,
      defaultValue: 'VI',
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'workrank_culture',
    },
    difficulty: {
      type: DataTypes.ENUM('EASY', 'MEDIUM', 'HARD', 'EXPERT'),
      allowNull: false,
      defaultValue: 'MEDIUM',
    },
    wordCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'word_count' },
    characterCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'character_count' },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    createdBy: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'created_by' },
  },
  {
    sequelize,
    modelName: 'TypingChallenge',
    tableName: 'typing_challenges',
    underscored: true,
    timestamps: true,
  }
);

module.exports = TypingChallenge;
