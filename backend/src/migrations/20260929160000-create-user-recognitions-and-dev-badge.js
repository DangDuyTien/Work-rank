'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add is_dev column to users table if not exists
    const usersDesc = await queryInterface.describeTable('users').catch(() => ({}));
    if (!usersDesc.is_dev) {
      await queryInterface.addColumn('users', 'is_dev', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_dev',
      });
    }

    // 2. Create user_recognitions table
    const tableExists = await queryInterface.describeTable('user_recognitions').then(() => true).catch(() => false);
    if (!tableExists) {
      await queryInterface.createTable('user_recognitions', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        award_type: {
          type: Sequelize.STRING(32),
          allowNull: false, // 'champion', 'mvp', 'dev', 'verified'
        },
        title: {
          type: Sequelize.STRING(120),
          allowNull: false,
        },
        season_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'seasons', key: 'id' },
          onDelete: 'SET NULL',
        },
        grand_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'grand_championships', key: 'id' },
          onDelete: 'SET NULL',
        },
        reason: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        awarded_by: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        awarded_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
        metadata: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('NOW'),
        },
      });

      await queryInterface.addIndex('user_recognitions', ['user_id', 'award_type'], {
        name: 'idx_user_recognitions_user_type',
      });
      await queryInterface.addIndex('user_recognitions', ['season_id'], {
        name: 'idx_user_recognitions_season',
      });
      await queryInterface.addIndex('user_recognitions', ['grand_id'], {
        name: 'idx_user_recognitions_grand',
      });
    }
  },

  async down(queryInterface) {
    const tableExists = await queryInterface.describeTable('user_recognitions').then(() => true).catch(() => false);
    if (tableExists) {
      await queryInterface.dropTable('user_recognitions');
    }
    const usersDesc = await queryInterface.describeTable('users').catch(() => ({}));
    if (usersDesc.is_dev) {
      await queryInterface.removeColumn('users', 'is_dev');
    }
  },
};
