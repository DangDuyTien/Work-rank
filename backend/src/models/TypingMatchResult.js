'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class TypingMatchResult extends Model {}

TypingMatchResult.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    roomId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'room_id' },
    mode: {
      type: DataTypes.ENUM('SOLO', '1V1', '2V2', '3V3'),
      allowNull: false,
      defaultValue: '1V1',
    },
    matchType: {
      type: DataTypes.ENUM('PRACTICE', 'RANKED', 'TOURNAMENT'),
      allowNull: false,
      defaultValue: 'RANKED',
      field: 'match_type',
    },
    seasonId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'season_id' },
    winnerUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'winner_user_id' },
    winnerTeam: {
      type: DataTypes.ENUM('A', 'B', 'DRAW', 'NONE'),
      allowNull: false,
      defaultValue: 'NONE',
      field: 'winner_team',
    },
    teamAScore: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0, field: 'team_a_score' },
    teamBScore: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0, field: 'team_b_score' },
    results: { type: DataTypes.JSON, allowNull: false },
    playedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'played_at' },
  },
  {
    sequelize,
    modelName: 'TypingMatchResult',
    tableName: 'typing_match_results',
    underscored: true,
    timestamps: true,
  }
);

module.exports = TypingMatchResult;
