'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const describeRooms = await queryInterface.describeTable('sam_rooms').catch(() => null);
    if (describeRooms) {
      if (!describeRooms.room_type) {
        await queryInterface.addColumn('sam_rooms', 'room_type', {
          type: Sequelize.ENUM('LIVE', 'BOT_TEST'),
          allowNull: false,
          defaultValue: 'LIVE',
        }).catch(() => {});
      }
      if (!describeRooms.is_test) {
        await queryInterface.addColumn('sam_rooms', 'is_test', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        }).catch(() => {});
      }
      if (!describeRooms.bot_difficulty) {
        await queryInterface.addColumn('sam_rooms', 'bot_difficulty', {
          type: Sequelize.ENUM('EASY', 'NORMAL', 'HARD'),
          allowNull: false,
          defaultValue: 'NORMAL',
        }).catch(() => {});
      }
      if (!describeRooms.bot_paused) {
        await queryInterface.addColumn('sam_rooms', 'bot_paused', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        }).catch(() => {});
      }
      if (!describeRooms.test_scenario) {
        await queryInterface.addColumn('sam_rooms', 'test_scenario', {
          type: Sequelize.STRING(50),
          allowNull: true,
        }).catch(() => {});
      }
      if (!describeRooms.spectator_count) {
        await queryInterface.addColumn('sam_rooms', 'spectator_count', {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
        }).catch(() => {});
      }
    }

    const describePlayers = await queryInterface.describeTable('sam_players').catch(() => null);
    if (describePlayers) {
      if (!describePlayers.player_type) {
        await queryInterface.addColumn('sam_players', 'player_type', {
          type: Sequelize.ENUM('HUMAN', 'BOT'),
          allowNull: false,
          defaultValue: 'HUMAN',
        }).catch(() => {});
      }
      if (!describePlayers.is_bot) {
        await queryInterface.addColumn('sam_players', 'is_bot', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        }).catch(() => {});
      }
      if (!describePlayers.bot_id) {
        await queryInterface.addColumn('sam_players', 'bot_id', {
          type: Sequelize.STRING(50),
          allowNull: true,
        }).catch(() => {});
      }
      if (!describePlayers.bot_name) {
        await queryInterface.addColumn('sam_players', 'bot_name', {
          type: Sequelize.STRING(50),
          allowNull: true,
        }).catch(() => {});
      }

      // Allow user_id to be nullable for Bot players
      await queryInterface.changeColumn('sam_players', 'user_id', {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      }).catch(() => {});
    }
  },

  async down(queryInterface) {
    const describeRooms = await queryInterface.describeTable('sam_rooms').catch(() => null);
    if (describeRooms) {
      if (describeRooms.room_type) await queryInterface.removeColumn('sam_rooms', 'room_type').catch(() => {});
      if (describeRooms.is_test) await queryInterface.removeColumn('sam_rooms', 'is_test').catch(() => {});
      if (describeRooms.bot_difficulty) await queryInterface.removeColumn('sam_rooms', 'bot_difficulty').catch(() => {});
      if (describeRooms.bot_paused) await queryInterface.removeColumn('sam_rooms', 'bot_paused').catch(() => {});
      if (describeRooms.test_scenario) await queryInterface.removeColumn('sam_rooms', 'test_scenario').catch(() => {});
      if (describeRooms.spectator_count) await queryInterface.removeColumn('sam_rooms', 'spectator_count').catch(() => {});
    }

    const describePlayers = await queryInterface.describeTable('sam_players').catch(() => null);
    if (describePlayers) {
      if (describePlayers.player_type) await queryInterface.removeColumn('sam_players', 'player_type').catch(() => {});
      if (describePlayers.is_bot) await queryInterface.removeColumn('sam_players', 'is_bot').catch(() => {});
      if (describePlayers.bot_id) await queryInterface.removeColumn('sam_players', 'bot_id').catch(() => {});
      if (describePlayers.bot_name) await queryInterface.removeColumn('sam_players', 'bot_name').catch(() => {});
    }
  },
};
