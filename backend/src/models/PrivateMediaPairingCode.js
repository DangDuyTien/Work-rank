'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * One-time pairing codes (Telegram binding + device pairing).
 * Only the hash is stored; codes are short-lived and single-use.
 */
const PrivateMediaPairingCode = sequelize.define(
  'PrivateMediaPairingCode',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    codeHash: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'code_hash' },
    purpose: { type: DataTypes.STRING(16), allowNull: false },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    label: { type: DataTypes.STRING(120), allowNull: true },
    expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
    usedAt: { type: DataTypes.DATE, allowNull: true, field: 'used_at' },
  },
  {
    tableName: 'private_media_pairing_codes',
    underscored: true,
    timestamps: true,
    indexes: [{ fields: ['user_id', 'purpose'] }],
  },
);

module.exports = PrivateMediaPairingCode;
