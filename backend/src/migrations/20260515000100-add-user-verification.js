'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'is_verified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'team_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'is_verified');
  },
};
