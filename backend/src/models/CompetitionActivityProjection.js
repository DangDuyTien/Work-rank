'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CompetitionActivityProjection = sequelize.define(
  'CompetitionActivityProjection',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    activityKey: {
      type: DataTypes.STRING(191),
      allowNull: false,
      unique: true,
      field: 'activity_key',
    },
    activityType: {
      type: DataTypes.ENUM(
        'SCORE_AWARDED',
        'STREAK_ACHIEVED',
        'SEASON_WON',
        'PODIUM_REACHED',
        'GRAND_POINTS_EARNED',
        'CHALLENGE_COMPLETED',
        'RECONCILIATION'
      ),
      allowNull: false,
      field: 'activity_type',
    },
    actorUserId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'actor_user_id',
    },
    teamId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'team_id',
    },
    seasonId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'season_id',
    },
    grandId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'grand_id',
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'title',
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    occurredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'occurred_at',
    },
  },
  {
    tableName: 'competition_activity_projections',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['occurred_at'], name: 'idx_activity_occurred_at' },
      { fields: ['actor_user_id'], name: 'idx_activity_user' },
      { fields: ['team_id'], name: 'idx_activity_team' },
      { fields: ['season_id'], name: 'idx_activity_season' },
      { fields: ['grand_id'], name: 'idx_activity_grand' },
    ],
  }
);

module.exports = CompetitionActivityProjection;
