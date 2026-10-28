'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Canonical Private Media owner registry.
 *
 * The bootstrap email in `PRIVATE_MEDIA_BOOTSTRAP_OWNER_EMAIL` is only used to
 * resolve the Work Rank user id ONCE. Every later authorization decision uses
 * `user_id`, never the email.
 */
const PrivateMediaOwner = sequelize.define(
  'PrivateMediaOwner',
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true, field: 'user_id' },
    bootstrapEmail: { type: DataTypes.STRING(191), allowNull: false, field: 'bootstrap_email' },
  },
  { tableName: 'private_media_owners', underscored: true, timestamps: true },
);

module.exports = PrivateMediaOwner;
