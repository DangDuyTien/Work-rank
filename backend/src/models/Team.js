const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Team extends Model {}

Team.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    inviteCode: { type: DataTypes.STRING(32), allowNull: true, unique: true, field: 'invite_code' },
    ownerId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'owner_id' },
  },
  { sequelize, modelName: 'Team', tableName: 'teams' },
);

module.exports = Team;
