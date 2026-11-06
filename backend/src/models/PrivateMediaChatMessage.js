'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * PRIVATE MEDIA — CHAT MESSAGE
 *
 * One system-wide channel ("Chat chung"), filed under the Vietnam calendar day
 * it was written on. `channel = 'session'` marks rows from the old session-scoped
 * chat: they are kept forever but never returned by the global feed, so a
 * private conversation cannot leak into the public one.
 *
 * The sender is ALWAYS taken from the authenticated socket/JWT (`userId`), never
 * from a client-supplied field. `content` is stored as plain text and rendered
 * as text by React — no HTML is ever executed, and no markup is stored.
 */
const PrivateMediaChatMessage = sequelize.define(
  'PrivateMediaChatMessage',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    sessionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'session_id' },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    content: { type: DataTypes.STRING(1000), allowNull: false },
    // 'global' = the one public channel. 'session' = legacy, never served.
    channel: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'session' },
    // 'YYYY-MM-DD' in Asia/Ho_Chi_Minh, written by the server at insert time.
    day: { type: DataTypes.STRING(10), allowNull: false, defaultValue: '1970-01-01' },
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
      { fields: ['channel', 'day', 'id'] },
    ],
  },
);

module.exports = PrivateMediaChatMessage;
