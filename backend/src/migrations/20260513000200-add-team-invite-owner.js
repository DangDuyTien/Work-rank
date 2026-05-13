'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('teams', 'invite_code', {
      type: Sequelize.STRING(32),
      allowNull: true,
      unique: true,
      after: 'description',
    });
    await queryInterface.addColumn('teams', 'owner_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
      after: 'invite_code',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('teams', 'owner_id');
    await queryInterface.removeColumn('teams', 'invite_code');
  },
};
