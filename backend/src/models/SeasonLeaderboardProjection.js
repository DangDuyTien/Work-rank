'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SeasonLeaderboardProjection = sequelize.define(
  'SeasonLeaderboardProjection',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    seasonId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'season_id',
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
    score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'score',
    },
    wins: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'wins',
    },
    podiums: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'podiums',
    },
    trend: {
      type: DataTypes.ENUM('UP', 'DOWN', 'SAME'),
      allowNull: false,
      defaultValue: 'SAME',
      field: 'trend',
    },
    isEligible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_eligible',
    },
    teamName: {
      type: DataTypes.STRING(150),
      allowNull: true,
      field: 'team_name',
    },
    teamAvatar: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'team_avatar',
    },
    teamColor: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: '#0284c7',
      field: 'team_color',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: 'season_leaderboard_projections',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['season_id', 'team_id'],
        name: 'uniq_season_team_projection',
      },
      {
        fields: ['season_id', 'rank'],
        name: 'idx_season_proj_rank',
      },
    ],
  }
);

module.exports = SeasonLeaderboardProjection;
