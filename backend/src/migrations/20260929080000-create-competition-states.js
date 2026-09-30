'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('competition_states', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      season_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        comment: 'NULL = global/cross-season state',
      },
      entity_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        comment: 'user.id or team.id',
      },
      entity_type: {
        type: Sequelize.ENUM('user', 'team'),
        allowNull: false,
      },
      state_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'e.g. daily_streak, weekly_count, shield_active',
      },
      data_json: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: {},
        comment: 'Mutable state payload — structured data for this state_key',
      },
      version: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
        comment: 'Optimistic locking version — increments on every mutation',
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'If set, state is considered expired after this timestamp',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Uniqueness: one state_key per (season, entity_type, entity_id)
    await queryInterface.addIndex('competition_states', ['season_id', 'entity_type', 'entity_id', 'state_key'], {
      unique: true,
      name: 'uidx_comp_state_entity_key',
    });

    // Fast lookup by entity
    await queryInterface.addIndex('competition_states', ['entity_type', 'entity_id'], {
      name: 'idx_comp_state_entity',
    });

    // Admin monitor: list all states for a season
    await queryInterface.addIndex('competition_states', ['season_id'], {
      name: 'idx_comp_state_season',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('competition_states');
  },
};
