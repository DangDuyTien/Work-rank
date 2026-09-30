'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class RuleSetVersion extends Model {}

RuleSetVersion.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    ruleSetId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'rule_set_id' },
    versionNumber: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'version_number' },
    effectiveFrom: { type: DataTypes.DATE, allowNull: false, field: 'effective_from' },
    effectiveTo: { type: DataTypes.DATE, allowNull: true, field: 'effective_to' },
    astPayload: { type: DataTypes.JSON, allowNull: false, field: 'ast_payload' },
    status: {
      type: DataTypes.ENUM('DRAFT', 'PUBLISHED', 'SUPERSEDED'),
      allowNull: false,
      defaultValue: 'DRAFT',
    },
    createdBy: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'created_by' },
    publishedAt: { type: DataTypes.DATE, allowNull: true, field: 'published_at' },
  },
  { sequelize, modelName: 'RuleSetVersion', tableName: 'rule_set_versions', underscored: true },
);

module.exports = RuleSetVersion;
