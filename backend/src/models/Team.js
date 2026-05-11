const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Team extends Model {}

Team.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: 'Team', tableName: 'teams' },
);

module.exports = Team;
