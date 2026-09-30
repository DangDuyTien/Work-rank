'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * CompetitionEvent — the canonical Event Store record.
 *
 * IMMUTABLE FIELDS (never UPDATE after INSERT):
 *   eventId, idempotencyKey, eventType, sourceModule, aggregateType,
 *   aggregateId, actorId, teamId, occurredAt, receivedAt, payload,
 *   schemaVersion, correlationId, causationId, createdAt
 *
 * MUTABLE FIELDS (processing metadata only):
 *   status, processedAt, failedAt, attemptCount, lastError
 */
class CompetitionEvent extends Model {
  /**
   * Returns only the immutable business payload fields.
   * Use this when passing to Rule Engine to prevent accidental mutation.
   */
  toBusinessPayload() {
    return {
      eventId: this.eventId,
      idempotencyKey: this.idempotencyKey,
      eventType: this.eventType,
      sourceModule: this.sourceModule,
      aggregateType: this.aggregateType,
      aggregateId: this.aggregateId,
      actorId: this.actorId,
      teamId: this.teamId,
      occurredAt: this.occurredAt,
      payload: this.payload,
      schemaVersion: this.schemaVersion,
      correlationId: this.correlationId,
      causationId: this.causationId,
    };
  }
}

CompetitionEvent.init(
  {
    // ─── Immutable business fields ──────────────────────────────────────────
    eventId: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      field: 'event_id',
    },
    idempotencyKey: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: 'idempotency_key',
    },
    eventType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'event_type',
    },
    sourceModule: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'source_module',
    },
    aggregateType: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'aggregate_type',
    },
    aggregateId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'aggregate_id',
    },
    actorId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'actor_id',
    },
    teamId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'team_id',
    },
    occurredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'occurred_at',
    },
    receivedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'received_at',
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    schemaVersion: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
      field: 'schema_version',
    },
    correlationId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'correlation_id',
    },
    causationId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'causation_id',
    },

    // ─── Mutable: processing metadata only ─────────────────────────────────
    status: {
      type: DataTypes.ENUM('PENDING', 'PROCESSED', 'FAILED', 'IGNORED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'processed_at',
    },
    failedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'failed_at',
    },
    attemptCount: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'attempt_count',
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'last_error',
    },
  },
  {
    sequelize,
    modelName: 'CompetitionEvent',
    tableName: 'competition_events',
    underscored: true,
    // No updatedAt — immutable business data table has no semantic for "updated"
    updatedAt: false,
  },
);

module.exports = CompetitionEvent;
