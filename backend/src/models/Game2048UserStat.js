'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Game2048UserStat extends Model {}

Game2048UserStat.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true, field: 'user_id' },
    bestScore: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'best_score' },
    highestTile: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 2, field: 'highest_tile' },
    totalGames: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'total_games' },
    totalMoves: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0, field: 'total_moves' },
    firstAchievedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'first_achieved_at' },
  },
  { sequelize, modelName: 'Game2048UserStat', tableName: 'game_2048_user_stats', underscored: true }
);

module.exports = Game2048UserStat;
