'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class CompetitionAuditLog extends Model {}

CompetitionAuditLog.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    actorId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'actor_id' },
    action: { type: DataTypes.STRING(100), allowNull: false },
    entityType: { type: DataTypes.STRING(50), allowNull: false, field: 'entity_type' },
    entityId: { type: DataTypes.STRING(100), allowNull: false, field: 'entity_id' },
    beforeState: { type: DataTypes.JSON, allowNull: true, field: 'before_state' },
    afterState: { type: DataTypes.JSON, allowNull: true, field: 'after_state' },
    reason: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'CompetitionAuditLog',
    tableName: 'competition_audit_logs',
    underscored: true,
    updatedAt: false,
  },
);

module.exports = CompetitionAuditLog;
