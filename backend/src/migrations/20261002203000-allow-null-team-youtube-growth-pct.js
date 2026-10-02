'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Allow NULL on views_growth_30d_pct and sub_growth_30d_pct when teams have insufficient baseline data
    await queryInterface.sequelize.query(
      `ALTER TABLE team_youtube_summaries 
       MODIFY COLUMN views_growth_30d_pct DECIMAL(10,4) NULL DEFAULT NULL,
       MODIFY COLUMN sub_growth_30d_pct DECIMAL(10,4) NULL DEFAULT NULL`
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE team_youtube_summaries 
       MODIFY COLUMN views_growth_30d_pct DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
       MODIFY COLUMN sub_growth_30d_pct DECIMAL(10,4) NOT NULL DEFAULT 0.0000`
    );
  },
};
