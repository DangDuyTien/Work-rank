'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('typing_players').catch(() => null);
    if (!table?.accuracy) return;
    await queryInterface.changeColumn('typing_players', 'accuracy', {
      type: Sequelize.FLOAT,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('typing_players').catch(() => null);
    if (!table?.accuracy) return;
    await queryInterface.changeColumn('typing_players', 'accuracy', {
      type: Sequelize.FLOAT,
      allowNull: false,
      defaultValue: 100.0,
    });
  },
};
