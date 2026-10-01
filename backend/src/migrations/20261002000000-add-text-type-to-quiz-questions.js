'use strict';

module.exports = {
  up: async (queryInterface) => {
    // Alter the `type` enum on quiz_questions to add 'TEXT'
    await queryInterface.sequelize.query(
      "ALTER TABLE `quiz_questions` MODIFY COLUMN `type` ENUM('IMAGE', 'MUSIC', 'TEXT') NOT NULL DEFAULT 'IMAGE';"
    );
  },

  down: async (queryInterface) => {
    // Revert: remove 'TEXT' (existing TEXT rows would be invalid — acceptable for rollback)
    await queryInterface.sequelize.query(
      "ALTER TABLE `quiz_questions` MODIFY COLUMN `type` ENUM('IMAGE', 'MUSIC') NOT NULL DEFAULT 'IMAGE';"
    );
  },
};
