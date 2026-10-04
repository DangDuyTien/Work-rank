'use strict';

/**
 * efficiency_rating stores a human-readable explanation of "why +X points"
 * (e.g. "Sản lượng: 5/5 tập, TB: 120p/tập (100.0%)"), which exceeds 32 chars.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('production_kpi_execution_snapshots', 'efficiency_rating', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('production_kpi_execution_snapshots', 'efficiency_rating', {
      type: Sequelize.STRING(32),
      allowNull: true,
    });
  },
};
