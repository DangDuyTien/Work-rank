'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'profile_status', {
      type: Sequelize.ENUM('incomplete', 'complete'),
      allowNull: false,
      defaultValue: 'complete',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'profile_status');
  },
};
