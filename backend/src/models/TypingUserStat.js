'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class TypingUserStat extends Model {}

TypingUserStat.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true, field: 'user_id' },
    totalMatches: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'total_matches' },
    rankedMatches: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'ranked_matches' },
    practiceMatches: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'practice_matches' },
    winsCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'wins_count' },
    teamWinsCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'team_wins_count' },
    bestWpm: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0, field: 'best_wpm' },
    avgWpm: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0, field: 'avg_wpm' },
    bestAccuracy: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0, field: 'best_accuracy' },
    avgAccuracy: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0, field: 'avg_accuracy' },
    totalCharsTyped: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0, field: 'total_chars_typed' },
    totalErrors: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0, field: 'total_errors' },
    perfectRunsCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'perfect_runs_count' },
    currentWinStreak: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'current_win_streak' },
    maxWinStreak: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'max_win_streak' },
    totalWorkRankPointsEarned: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0, field: 'total_workrank_points_earned' },
    dailyRankedCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'daily_ranked_count' },
    dailyPointsEarned: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'daily_points_earned' },
    dailyResetDate: { type: DataTypes.STRING(10), allowNull: true, field: 'daily_reset_date' }, // 'YYYY-MM-DD'
    lastPlayedAt: { type: DataTypes.DATE, allowNull: true, field: 'last_played_at' },
  },
  {
    sequelize,
    modelName: 'TypingUserStat',
    tableName: 'typing_user_stats',
    underscored: true,
    timestamps: true,
  }
);

module.exports = TypingUserStat;
