'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create quiz_sets table
    const tableExists = await queryInterface.describeTable('quiz_sets').catch(() => null);
    if (!tableExists) {
      await queryInterface.createTable('quiz_sets', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        title: {
          type: Sequelize.STRING(120),
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        category: {
          type: Sequelize.STRING(60),
          allowNull: false,
          defaultValue: 'Chung',
        },
        image_url: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        created_by_user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
          onDelete: 'SET NULL',
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        },
      });
    }

    // 2. Add quiz_set_id and created_by_user_id to quiz_questions
    const questionsDesc = await queryInterface.describeTable('quiz_questions').catch(() => null);
    if (questionsDesc) {
      if (!questionsDesc.quiz_set_id) {
        await queryInterface.addColumn('quiz_questions', 'quiz_set_id', {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: {
            model: 'quiz_sets',
            key: 'id',
          },
          onDelete: 'SET NULL',
        }).catch(() => {});
      }
      if (!questionsDesc.created_by_user_id) {
        await queryInterface.addColumn('quiz_questions', 'created_by_user_id', {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
          onDelete: 'SET NULL',
        }).catch(() => {});
      }
    }

    // 3. Add quiz_set_id to quiz_rooms
    const roomsDesc = await queryInterface.describeTable('quiz_rooms').catch(() => null);
    if (roomsDesc) {
      if (!roomsDesc.quiz_set_id) {
        await queryInterface.addColumn('quiz_rooms', 'quiz_set_id', {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: {
            model: 'quiz_sets',
            key: 'id',
          },
          onDelete: 'SET NULL',
        }).catch(() => {});
      }
    }
  },

  async down(queryInterface) {
    const roomsDesc = await queryInterface.describeTable('quiz_rooms').catch(() => null);
    if (roomsDesc && roomsDesc.quiz_set_id) {
      await queryInterface.removeColumn('quiz_rooms', 'quiz_set_id').catch(() => {});
    }

    const questionsDesc = await queryInterface.describeTable('quiz_questions').catch(() => null);
    if (questionsDesc) {
      if (questionsDesc.quiz_set_id) await queryInterface.removeColumn('quiz_questions', 'quiz_set_id').catch(() => {});
      if (questionsDesc.created_by_user_id) await queryInterface.removeColumn('quiz_questions', 'created_by_user_id').catch(() => {});
    }

    await queryInterface.dropTable('quiz_sets').catch(() => {});
  },
};
