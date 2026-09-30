'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class SeasonTeam extends Model {}

SeasonTeam.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    seasonId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'season_id' },
    teamId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'team_id' },
    teamNameSnapshot: { type: DataTypes.STRING(120), allowNull: false, field: 'team_name_snapshot' },
    teamAvatarSnapshot: { type: DataTypes.STRING(255), allowNull: true, field: 'team_avatar_snapshot' },
    teamColorSnapshot: { type: DataTypes.STRING(32), allowNull: true, field: 'team_color_snapshot' },
    isEligible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_eligible' },
    isDisqualified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_disqualified' },
    joinedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'joined_at' },
    leftAt: { type: DataTypes.DATE, allowNull: true, field: 'left_at' },
  },
  { sequelize, modelName: 'SeasonTeam', tableName: 'season_teams', underscored: true },
);

module.exports = SeasonTeam;
