'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'google_sub', {
      type: Sequelize.STRING(191),
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'avatar_url', {
      type: Sequelize.STRING(2048),
      allowNull: true,
    });
    await queryInterface.addIndex('users', ['google_sub'], {
      name: 'users_google_sub_unique',
      unique: true,
    });

    await queryInterface.createTable('google_auth_tickets', {
      token_hash: { type: Sequelize.STRING(64), allowNull: false, primaryKey: true },
      purpose: { type: Sequelize.STRING(16), allowNull: false },
      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      google_sub: { type: Sequelize.STRING(191), allowNull: false },
      google_email: { type: Sequelize.STRING(191), allowNull: false },
      google_name: { type: Sequelize.STRING(120), allowNull: false },
      google_picture: { type: Sequelize.STRING(2048), allowNull: true },
      return_to: { type: Sequelize.STRING(2048), allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('google_auth_tickets', ['expires_at'], {
      name: 'google_auth_tickets_expires_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('google_auth_tickets');
    await queryInterface.removeIndex('users', 'users_google_sub_unique');
    await queryInterface.removeColumn('users', 'avatar_url');
    await queryInterface.removeColumn('users', 'google_sub');
  },
};
