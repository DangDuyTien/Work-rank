'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CompetitionUserSummary = sequelize.define(
  'CompetitionUserSummary',
  {
    userId: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      allowNull: false,
      field: 'user_id',
    },
    currentSeasonId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'current_season_id',
    },
    currentSeasonRank: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'current_season_rank',
    },
    currentSeasonScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'current_season_score',
    },
    grandChampionshipId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'grand_championship_id',
    },
    grandRank: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'grand_rank',
    },
    grandPoints: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'grand_points',
    },
    seasonWins: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'season_wins',
    },
    podiumCount: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'podium_count',
    },
    currentStreak: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'current_streak',
    },
    weeklyProgress: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'weekly_progress',
    },
    recentScoreDelta: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'recent_score_delta',
    },
    lastActivityAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_activity_at',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: 'competition_user_summaries',
    underscored: true,
    timestamps: true,
  }
);

module.exports = CompetitionUserSummary;
