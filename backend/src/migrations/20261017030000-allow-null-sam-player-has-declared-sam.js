'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const describePlayers = await queryInterface.describeTable('sam_players').catch(() => null);
    if (describePlayers && describePlayers.has_declared_sam) {
      await queryInterface.changeColumn('sam_players', 'has_declared_sam', {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const describePlayers = await queryInterface.describeTable('sam_players').catch(() => null);
    if (describePlayers && describePlayers.has_declared_sam) {
      await queryInterface.changeColumn('sam_players', 'has_declared_sam', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },
};
