'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Telegram account ⇄ Work Rank user binding.
 *
 * Telegram identity is never sufficient on its own: every bot command walks
 * binding -> Work Rank user -> entitlement before it is allowed.
 */
const PrivateMediaTelegramBinding = sequelize.define(
  'PrivateMediaTelegramBinding',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true, field: 'user_id' },
    telegramUserId: { type: DataTypes.STRING(32), allowNull: false, field: 'telegram_user_id' },
    telegramChatId: { type: DataTypes.STRING(32), allowNull: false, field: 'telegram_chat_id' },
    telegramUsername: { type: DataTypes.STRING(120), allowNull: true, field: 'telegram_username' },
    revokedAt: { type: DataTypes.DATE, allowNull: true, field: 'revoked_at' },
  },
  {
    tableName: 'private_media_telegram_bindings',
    underscored: true,
    timestamps: true,
    indexes: [{ fields: ['telegram_user_id', 'revoked_at'] }],
  },
);

module.exports = PrivateMediaTelegramBinding;
