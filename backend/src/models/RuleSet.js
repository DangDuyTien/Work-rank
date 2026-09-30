'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class RuleSet extends Model {}

RuleSet.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    code: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    createdBy: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'created_by' },
  },
  { sequelize, modelName: 'RuleSet', tableName: 'rule_sets', underscored: true },
);

module.exports = RuleSet;
