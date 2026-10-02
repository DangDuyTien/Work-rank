'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const describeRooms = await queryInterface.describeTable('sam_rooms').catch(() => null);
    if (describeRooms) {
      if (!describeRooms.start_at) {
        await queryInterface.addColumn('sam_rooms', 'start_at', {
          type: Sequelize.DATE,
          allowNull: true,
        }).catch(() => {});
      }

      // If MySQL dialect, update ENUM values to include 'STARTING'
      if (queryInterface.sequelize.getDialect() === 'mysql') {
        await queryInterface.sequelize
          .query(
            "ALTER TABLE sam_rooms MODIFY COLUMN status ENUM('WAITING', 'STARTING', 'PLAYING', 'FINISHED', 'ABANDONED') NOT NULL DEFAULT 'WAITING'"
          )
          .catch(() => {});
        await queryInterface.sequelize
          .query(
            "ALTER TABLE sam_rooms MODIFY COLUMN sam_phase ENUM('WAITING', 'STARTING', 'SAM_DECLARING', 'PLAYING', 'FINISHED') NOT NULL DEFAULT 'WAITING'"
          )
          .catch(() => {});
      }
    }

    const describePlayers = await queryInterface.describeTable('sam_players').catch(() => null);
    if (describePlayers) {
      if (!describePlayers.is_ready) {
        await queryInterface.addColumn('sam_players', 'is_ready', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        }).catch(() => {});
      }
    }
  },

  async down(queryInterface) {
    const describeRooms = await queryInterface.describeTable('sam_rooms').catch(() => null);
    if (describeRooms) {
      if (describeRooms.start_at) {
        await queryInterface.removeColumn('sam_rooms', 'start_at').catch(() => {});
      }
    }

    const describePlayers = await queryInterface.describeTable('sam_players').catch(() => null);
    if (describePlayers) {
      if (describePlayers.is_ready) {
        await queryInterface.removeColumn('sam_players', 'is_ready').catch(() => {});
      }
    }
  },
};
