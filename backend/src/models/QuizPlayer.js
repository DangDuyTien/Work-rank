'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class QuizPlayer extends Model {}

QuizPlayer.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    roomId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'room_id' },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    score: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    correctAnswers: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'correct_answers' },
    totalAnswered: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'total_answered' },
    totalResponseTimeMs: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0, field: 'total_response_time_ms' },
    rank: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
    isReady: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_ready' },
    joinedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'joined_at' },
  },
  { sequelize, modelName: 'QuizPlayer', tableName: 'quiz_players', underscored: true }
);

module.exports = QuizPlayer;
