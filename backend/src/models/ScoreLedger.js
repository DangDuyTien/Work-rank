'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * ScoreLedger — Immutable append-only scoring record.
 *
 * RULES:
 *   - INSERT ONLY. No UPDATE, no DELETE, ever.
 *   - UNIQUE(idempotency_key, effect_type) prevents duplicate effects.
 *   - Reversal = new row with negative points_delta.
 *   - Adjustment = new row with reconciliation_id set.
 *   - Effective score = SUM(points_delta) for (season_id, user_id/team_id).
 */
class ScoreLedger extends Model {}

ScoreLedger.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    seasonId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'season_id',
    },
    userId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'user_id',
    },
    teamId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'team_id',
    },
    eventId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'event_id',
    },
    ruleVersionId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'rule_version_id',
    },
    idempotencyKey: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'idempotency_key',
    },
    effectType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'effect_type',
    },
    pointsDelta: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'points_delta',
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    reconciliationId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'reconciliation_id',
    },
  },
  {
    sequelize,
    modelName: 'ScoreLedger',
    tableName: 'score_ledger',
    underscored: true,
    // INSERT-ONLY — no updatedAt
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ['idempotency_key', 'effect_type'],
        name: 'score_ledger_idempotency_effect_unique',
      },
      {
        fields: ['season_id', 'user_id'],
        name: 'score_ledger_season_user',
      },
      {
        fields: ['season_id', 'team_id'],
        name: 'score_ledger_season_team',
      },
      {
        fields: ['event_id'],
        name: 'score_ledger_event',
      },
    ],
  },
);

module.exports = ScoreLedger;
