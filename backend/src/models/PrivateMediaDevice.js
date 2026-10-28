'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Paired macOS helper. Only the SHA-256 hash of the device token is persisted,
 * so a database leak cannot be replayed against the command API.
 */
const PrivateMediaDevice = sequelize.define(
  'PrivateMediaDevice',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    name: { type: DataTypes.STRING(120), allowNull: false },
    platform: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'macos' },
    tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'token_hash' },
    tokenPrefix: { type: DataTypes.STRING(16), allowNull: false, field: 'token_prefix' },
    lastSeenAt: { type: DataTypes.DATE, allowNull: true, field: 'last_seen_at' },
    revokedAt: { type: DataTypes.DATE, allowNull: true, field: 'revoked_at' },
  },
  {
    tableName: 'private_media_devices',
    underscored: true,
    timestamps: true,
    indexes: [{ fields: ['user_id', 'revoked_at'] }],
  },
);

module.exports = PrivateMediaDevice;
