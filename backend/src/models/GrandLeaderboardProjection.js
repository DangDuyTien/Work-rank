'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GrandLeaderboardProjection = sequelize.define(
  'GrandLeaderboardProjection',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    grandId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'grand_id',
    },
    teamId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'team_id',
    },
    rank: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'rank',
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
    completedSeasons: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'completed_seasons',
    },
    trend: {
      type: DataTypes.ENUM('UP', 'DOWN', 'SAME'),
      allowNull: false,
      defaultValue: 'SAME',
      field: 'trend',
    },
    teamName: {
      type: DataTypes.STRING(150),
      allowNull: true,
      field: 'team_name',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: 'grand_leaderboard_projections',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['grand_id', 'team_id'],
        name: 'uniq_grand_team_projection',
      },
      {
        fields: ['grand_id', 'rank'],
        name: 'idx_grand_proj_rank',
      },
    ],
  }
);

module.exports = GrandLeaderboardProjection;
