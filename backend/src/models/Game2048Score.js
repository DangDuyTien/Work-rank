'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Game2048Score extends Model {}

Game2048Score.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    score: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    maxTile: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 2, field: 'max_tile' },
    moves: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    gameSessionId: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'game_session_id' },
    playedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'played_at' },
  },
  { sequelize, modelName: 'Game2048Score', tableName: 'game_2048_scores', underscored: true }
);

module.exports = Game2048Score;
