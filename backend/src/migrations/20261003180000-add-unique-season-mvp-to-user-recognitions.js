'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add functional unique index on user_recognitions to ensure strictly ONE MVP per Season
    try {
      await queryInterface.sequelize.query(
        "CREATE UNIQUE INDEX uq_user_recognitions_season_mvp ON user_recognitions ((CASE WHEN award_type = 'mvp' THEN season_id ELSE NULL END))"
      );
    } catch (err) {
      if (!err.message.includes('Duplicate key name')) {
        throw err;
      }
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.sequelize.query(
        "DROP INDEX uq_user_recognitions_season_mvp ON user_recognitions"
      );
    } catch (err) {
      // Best effort drop
    }
  },
};
