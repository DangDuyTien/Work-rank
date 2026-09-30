'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class QuizUserStat extends Model {}

QuizUserStat.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true, field: 'user_id' },
    gamesPlayed: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'games_played' },
    gamesWon: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'games_won' },
    totalScore: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0, field: 'total_score' },
    totalCorrect: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'total_correct' },
    totalAnswered: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'total_answered' },
    highestScore: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'highest_score' },
  },
  { sequelize, modelName: 'QuizUserStat', tableName: 'quiz_user_stats', underscored: true }
);

module.exports = QuizUserStat;
