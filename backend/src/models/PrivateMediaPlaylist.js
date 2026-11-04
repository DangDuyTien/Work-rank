'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * PRIVATE MEDIA — PLAYLIST
 *
 * Two kinds share one table:
 *   kind = 'curated' → read-only catalog maintained by the sync script
 *                      (ownerUserId is NULL, slug identifies it)
 *   kind = 'user'    → created by an entitled account
 *
 * `visibility` never grants access by itself. Reading a shared playlist still
 * requires a Private Media entitlement; it only decides who may *see* a user
 * playlist that lives outside the owner's own account.
 */
const PrivateMediaPlaylist = sequelize.define(
  'PrivateMediaPlaylist',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    ownerUserId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'owner_user_id' },
    slug: { type: DataTypes.STRING(64), allowNull: true, unique: true },
    title: { type: DataTypes.STRING(191), allowNull: false },
    description: { type: DataTypes.STRING(512), allowNull: true },
    kind: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'user' },
    visibility: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'private' },
    playbackMode: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'sequential', field: 'playback_mode' },
    repeatMode: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'off', field: 'repeat_mode' },
    sourceType: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'manual', field: 'source_type' },
    sourcePlaylistId: { type: DataTypes.STRING(64), allowNull: true, field: 'source_playlist_id' },
    sourceChannel: { type: DataTypes.STRING(191), allowNull: true, field: 'source_channel' },
    sourceUrl: { type: DataTypes.STRING(512), allowNull: true, field: 'source_url' },
    coverUrl: { type: DataTypes.STRING(512), allowNull: true, field: 'cover_url' },
    itemCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'item_count' },
    expectedCount: { type: DataTypes.INTEGER, allowNull: true, field: 'expected_count' },
    verifiedAt: { type: DataTypes.DATE, allowNull: true, field: 'verified_at' },
  },
  { tableName: 'private_media_playlists', underscored: true, timestamps: true },
);

module.exports = PrivateMediaPlaylist;
