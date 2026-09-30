'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CompetitionTeamSummary = sequelize.define(
  'CompetitionTeamSummary',
  {
    teamId: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      allowNull: false,
      field: 'team_id',
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
    membersCount: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'members_count',
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
    tableName: 'competition_team_summaries',
    underscored: true,
    timestamps: true,
  }
);

module.exports = CompetitionTeamSummary;
