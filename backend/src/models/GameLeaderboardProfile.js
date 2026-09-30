'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class GameLeaderboardProfile extends Model {}

GameLeaderboardProfile.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true, field: 'user_id' },
    careerMoney: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0, field: 'career_money' },
    gamesPlayed: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'games_played' },
    gamesWon: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'games_won' },
    totalNetWorth: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0, field: 'total_net_worth' },
    bestRank: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 999, field: 'best_rank' },
  },
  {
    sequelize,
    modelName: 'GameLeaderboardProfile',
    tableName: 'game_leaderboard_profiles',
    underscored: true,
    indexes: [
      { fields: ['career_money'], name: 'idx_game_leaderboard_career_money' },
      { fields: ['games_won'], name: 'idx_game_leaderboard_games_won' },
    ],
  }
);

module.exports = GameLeaderboardProfile;
