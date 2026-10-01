'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add order_index to quiz_questions
    const questionsDesc = await queryInterface.describeTable('quiz_questions').catch(() => null);
    if (questionsDesc && !questionsDesc.order_index) {
      await queryInterface.addColumn('quiz_questions', 'order_index', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
      await queryInterface.addIndex('quiz_questions', ['quiz_set_id', 'order_index'], {
        name: 'idx_quiz_questions_set_order',
      }).catch(() => {});
    }

    // 2. Add share_code and status to quiz_sets
    const setsDesc = await queryInterface.describeTable('quiz_sets').catch(() => null);
    if (setsDesc) {
      if (!setsDesc.share_code) {
        await queryInterface.addColumn('quiz_sets', 'share_code', {
          type: Sequelize.STRING(64),
          allowNull: true,
        });
        await queryInterface.addIndex('quiz_sets', ['share_code'], {
          name: 'idx_quiz_sets_share_code',
          unique: true,
        }).catch(() => {});
      }
      if (!setsDesc.status) {
        await queryInterface.addColumn('quiz_sets', 'status', {
          type: Sequelize.ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED'),
          allowNull: false,
          defaultValue: 'PUBLISHED',
        });
      }
    }
  },

  down: async (queryInterface) => {
    const questionsDesc = await queryInterface.describeTable('quiz_questions').catch(() => null);
    if (questionsDesc && questionsDesc.order_index) {
      await queryInterface.removeColumn('quiz_questions', 'order_index').catch(() => {});
    }

    const setsDesc = await queryInterface.describeTable('quiz_sets').catch(() => null);
    if (setsDesc) {
      if (setsDesc.share_code) {
        await queryInterface.removeColumn('quiz_sets', 'share_code').catch(() => {});
      }
      if (setsDesc.status) {
        await queryInterface.removeColumn('quiz_sets', 'status').catch(() => {});
      }
    }
  },
};
