'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class SamUserStat extends Model {}

SamUserStat.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true, field: 'user_id' },
    gamesPlayed: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'games_played' },
    gamesWon: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'games_won' },
    samDeclared: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'sam_declared' },
    samWon: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'sam_won' },
    totalPoints: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'total_points' },
    winStreak: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'win_streak' },
    maxWinStreak: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'max_win_streak' },
  },
  {
    sequelize,
    modelName: 'SamUserStat',
    tableName: 'sam_user_stats',
    underscored: true,
    timestamps: true,
  }
);

module.exports = SamUserStat;
