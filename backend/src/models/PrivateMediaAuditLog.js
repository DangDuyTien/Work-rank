'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Append-only audit trail for the Private Media capability.
 * Secrets (bot token, device token, pairing code) are never written here.
 */
const PrivateMediaAuditLog = sequelize.define(
  'PrivateMediaAuditLog',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    action: { type: DataTypes.STRING(48), allowNull: false },
    actorUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'actor_user_id' },
    targetUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'target_user_id' },
    source: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'WEB' },
    metadata: { type: DataTypes.JSON, allowNull: true },
  },
  {
    tableName: 'private_media_audit_logs',
    underscored: true,
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ['action', 'created_at'] }, { fields: ['actor_user_id', 'created_at'] }],
  },
);

module.exports = PrivateMediaAuditLog;
