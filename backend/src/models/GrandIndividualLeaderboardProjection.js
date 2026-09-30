'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GrandIndividualLeaderboardProjection = sequelize.define(
  'GrandIndividualLeaderboardProjection',
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
    userId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'user_id',
    },
    teamId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
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
    eventsCount: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'events_count',
    },
    trend: {
      type: DataTypes.ENUM('UP', 'DOWN', 'SAME'),
      allowNull: false,
      defaultValue: 'SAME',
      field: 'trend',
    },
    lastScoredAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_scored_at',
    },
    userName: {
      type: DataTypes.STRING(150),
      allowNull: true,
      field: 'user_name',
    },
    userAvatar: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'user_avatar',
    },
    teamName: {
      type: DataTypes.STRING(150),
      allowNull: true,
      field: 'team_name',
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
    tableName: 'grand_individual_leaderboard_projections',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['grand_id', 'user_id'],
        name: 'uniq_grand_user_projection',
      },
      {
        fields: ['grand_id', 'rank'],
        name: 'idx_grand_indiv_rank',
      },
      {
        fields: ['grand_id', 'grand_points'],
        name: 'idx_grand_indiv_points',
      },
      {
        fields: ['team_id', 'grand_points'],
        name: 'idx_grand_indiv_team_points',
      },
    ],
  }
);

module.exports = GrandIndividualLeaderboardProjection;
