'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * PRIVATE MEDIA — CHAT READ MARKER
 *
 * One row per (playback session, user). It stores the highest message id that
 * account has actually read, which is what makes the unread counter survive a
 * route change, a refresh, a reconnect and a second device.
 *
 * `lastReadMessageId` only ever moves forward, so two tabs marking read at the
 * same time cannot rewind the marker for each other.
 */
const PrivateMediaChatRead = sequelize.define(
  'PrivateMediaChatRead',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    sessionId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'session_id' },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    lastReadMessageId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'last_read_message_id' },
  },
  {
    tableName: 'private_media_chat_reads',
    underscored: true,
    timestamps: true,
    indexes: [{ unique: true, fields: ['session_id', 'user_id'] }],
  },
);

module.exports = PrivateMediaChatRead;
