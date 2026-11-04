'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * PRIVATE MEDIA — CHAT MESSAGE
 *
 * Persistent, scoped to one playback session. The sender is ALWAYS taken from
 * the authenticated socket/JWT (`userId`), never from a client-supplied field.
 * `content` is stored as plain text and rendered as text by React — no HTML is
 * ever executed, and no markup is stored.
 */
const PrivateMediaChatMessage = sequelize.define(
  'PrivateMediaChatMessage',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    sessionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'session_id' },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    content: { type: DataTypes.STRING(1000), allowNull: false },
    // Client-generated idempotency key: a retry after reconnect must not duplicate.
    clientMessageId: { type: DataTypes.STRING(64), allowNull: true, field: 'client_message_id' },
    deletedAt: { type: DataTypes.DATE, allowNull: true, field: 'deleted_at' },
  },
  {
    tableName: 'private_media_chat_messages',
    underscored: true,
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['session_id', 'id'] },
      { unique: true, fields: ['session_id', 'user_id', 'client_message_id'] },
    ],
  },
);

module.exports = PrivateMediaChatMessage;
