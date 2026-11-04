'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Where a given account stopped inside a playlist.
 *
 * One row per (playlist, user): the latest item that account played. Shared
 * playlists therefore keep a separate bookmark per listener — one person
 * resuming Conan does not move anybody else's place.
 */
const PrivateMediaPlaylistProgress = sequelize.define(
  'PrivateMediaPlaylistProgress',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    playlistId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'playlist_id' },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    itemId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'item_id' },
    videoId: { type: DataTypes.STRING(16), allowNull: true, field: 'video_id' },
    episodeNumber: { type: DataTypes.INTEGER, allowNull: true, field: 'episode_number' },
    updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
  },
  {
    tableName: 'private_media_playlist_progress',
    underscored: true,
    timestamps: true,
    updatedAt: 'updatedAt',
    createdAt: false,
    indexes: [{ unique: true, fields: ['playlist_id', 'user_id'], name: 'pm_progress_unique' }],
  },
);

module.exports = PrivateMediaPlaylistProgress;
