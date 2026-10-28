'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Command journal. `command_id` is UNIQUE and is the dedupe key: a retried
 * Telegram callback or a double-tapped hotkey executes once, not twice.
 */
const PrivateMediaCommand = sequelize.define(
  'PrivateMediaCommand',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    commandId: { type: DataTypes.STRING(64), allowNull: false, unique: true, field: 'command_id' },
    sessionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'session_id' },
    action: { type: DataTypes.STRING(32), allowNull: false },
    source: { type: DataTypes.ENUM('WEB', 'TELEGRAM', 'HOTKEY', 'SYSTEM'), allowNull: false },
    issuedByUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'issued_by_user_id' },
    payload: { type: DataTypes.JSON, allowNull: true },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'QUEUED' },
    errorCode: { type: DataTypes.STRING(64), allowNull: true, field: 'error_code' },
    executedAt: { type: DataTypes.DATE, allowNull: true, field: 'executed_at' },
  },
  {
    tableName: 'private_media_commands',
    underscored: true,
    timestamps: true,
    indexes: [{ fields: ['session_id', 'created_at'] }],
  },
);

module.exports = PrivateMediaCommand;
