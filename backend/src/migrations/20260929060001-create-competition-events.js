'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('competition_events', {
      // ─── Immutable identity ───────────────────────────────────────────────
      event_id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      // Unique key provided by the producer (domain service / outbox dispatcher).
      // DB-level protection against duplicate ingestion from Outbox retries.
      idempotency_key: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      event_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      source_module: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'e.g. production, community, youtube',
      },
      aggregate_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'e.g. Video, Task, Comment',
      },
      aggregate_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        comment: 'PK of the domain entity that triggered the event',
      },
      actor_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        comment: 'User who performed the action',
      },
      team_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        comment: "Actor's team at the time of the event (snapshot)",
      },
      // occurred_at: the domain/business time — ALWAYS used for rule version lookup
      occurred_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      // received_at: when the outbox dispatcher ingested into this table
      received_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      // payload: business data — IMMUTABLE after INSERT
      payload: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: {},
      },
      schema_version: {
        type: Sequelize.SMALLINT.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
        comment: 'Payload contract version for forward/backward compat',
      },
      // Traceability
      correlation_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Groups related events across services',
      },
      causation_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'event_id of the parent event that caused this one',
      },

      // ─── Mutable: processing metadata ONLY ────────────────────────────────
      status: {
        type: Sequelize.ENUM('PENDING', 'PROCESSED', 'FAILED', 'IGNORED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      processed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      failed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      attempt_count: {
        type: Sequelize.SMALLINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      last_error: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      // No updated_at — immutable business data table has no semantic for "updated"
    });

    // Fast lookup by type for the Competition Engine dispatcher
    await queryInterface.addIndex('competition_events', ['event_type'], {
      name: 'idx_comp_events_type',
    });

    // Time-based queries (replay, reconciliation)
    await queryInterface.addIndex('competition_events', ['occurred_at'], {
      name: 'idx_comp_events_occurred_at',
    });

    // Worker polling: find PENDING events to process
    await queryInterface.addIndex('competition_events', ['status', 'received_at'], {
      name: 'idx_comp_events_status_received',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('competition_events');
  },
};
