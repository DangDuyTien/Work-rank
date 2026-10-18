'use strict';

/**
 * Migration: Add token_version column to users table for session revocation (BUG-003).
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('users');
    if (!tableInfo.token_version) {
      await queryInterface.addColumn('users', 'token_version', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      });
    }
  },

  down: async (queryInterface) => {
    const tableInfo = await queryInterface.describeTable('users');
    if (tableInfo.token_version) {
      await queryInterface.removeColumn('users', 'token_version');
    }
  },
};
