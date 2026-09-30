'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class SeasonTeamMember extends Model {}

SeasonTeamMember.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    seasonId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'season_id' },
    teamId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'team_id' },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    roleSnapshot: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'member', field: 'role_snapshot' },
    joinedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'joined_at' },
    leftAt: { type: DataTypes.DATE, allowNull: true, field: 'left_at' },
  },
  { sequelize, modelName: 'SeasonTeamMember', tableName: 'season_team_members', underscored: true },
);

module.exports = SeasonTeamMember;
