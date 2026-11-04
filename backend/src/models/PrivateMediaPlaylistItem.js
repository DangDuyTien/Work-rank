'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * PRIVATE MEDIA — PLAYLIST ITEM
 *
 * `position` is the authoritative manual order (0-based, ascending). `available`
 * is set by the catalog sync when YouTube reports a video as private, deleted or
 * non-embeddable; those rows stay in the table (so the gap is visible) but are
 * skipped by the playback engine.
 */
const PrivateMediaPlaylistItem = sequelize.define(
  'PrivateMediaPlaylistItem',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    playlistId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'playlist_id' },
    videoId: { type: DataTypes.STRING(16), allowNull: false, field: 'video_id' },
    title: { type: DataTypes.STRING(255), allowNull: true },
    channelTitle: { type: DataTypes.STRING(191), allowNull: true, field: 'channel_title' },
    thumbnailUrl: { type: DataTypes.STRING(512), allowNull: true, field: 'thumbnail_url' },
    durationSeconds: { type: DataTypes.INTEGER, allowNull: true, field: 'duration_seconds' },
    episodeNumber: { type: DataTypes.INTEGER, allowNull: true, field: 'episode_number' },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    available: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    unavailableReason: { type: DataTypes.STRING(32), allowNull: true, field: 'unavailable_reason' },
    addedByUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'added_by_user_id' },
  },
  {
    tableName: 'private_media_playlist_items',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['playlist_id', 'position'] },
      { fields: ['playlist_id', 'video_id'] },
    ],
  },
);

module.exports = PrivateMediaPlaylistItem;
