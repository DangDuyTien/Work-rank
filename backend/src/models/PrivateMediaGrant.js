'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Explicit delegation record. One row per user (unique user_id).
 *
 * There is intentionally NO role/admin column here: a grant is the only thing
 * that turns a Work Rank account into a Private Media participant, and only the
 * root owner can write this table.
 */
const PrivateMediaGrant = sequelize.define(
  'PrivateMediaGrant',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true, field: 'user_id' },
    grantedByUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'granted_by_user_id' },
    canView: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'can_view' },
    canQueue: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'can_queue' },
    canControl: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'can_control' },
    canTelegram: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'can_telegram' },
    canHotkey: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'can_hotkey' },
    note: { type: DataTypes.STRING(191), allowNull: true },
    revokedAt: { type: DataTypes.DATE, allowNull: true, field: 'revoked_at' },
  },
  {
    tableName: 'private_media_grants',
    underscored: true,
    timestamps: true,
    indexes: [{ fields: ['revoked_at'] }],
  },
);

module.exports = PrivateMediaGrant;
