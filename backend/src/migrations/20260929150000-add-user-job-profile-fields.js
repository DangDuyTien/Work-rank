'use strict';

/**
 * Migration: Add Job Title, Department, Bio, and Phone fields to Users table.
 *
 * Replaces legacy gameification concepts (EXP, Level, Virtual Titles)
 * with authentic corporate organizational hierarchy:
 * - job_title: Actual job position (Nhân viên, Editor, Quản lý kênh, Trưởng phòng, Phó giám đốc, Giám đốc)
 * - department: Functional business department (Media & Content, Engineering Core, Community & Growth)
 * - bio: Professional self-introduction / summary
 * - phone: Contact telephone number
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('users');

    if (!tableInfo.job_title) {
      await queryInterface.addColumn('users', 'job_title', {
        type: Sequelize.STRING(120),
        allowNull: true,
        defaultValue: 'Nhân viên',
      });
    }

    if (!tableInfo.department) {
      await queryInterface.addColumn('users', 'department', {
        type: Sequelize.STRING(120),
        allowNull: true,
        defaultValue: 'Media & Content',
      });
    }

    if (!tableInfo.bio) {
      await queryInterface.addColumn('users', 'bio', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!tableInfo.phone) {
      await queryInterface.addColumn('users', 'phone', {
        type: Sequelize.STRING(32),
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    const tableInfo = await queryInterface.describeTable('users');

    if (tableInfo.phone) {
      await queryInterface.removeColumn('users', 'phone');
    }
    if (tableInfo.bio) {
      await queryInterface.removeColumn('users', 'bio');
    }
    if (tableInfo.department) {
      await queryInterface.removeColumn('users', 'department');
    }
    if (tableInfo.job_title) {
      await queryInterface.removeColumn('users', 'job_title');
    }
  },
};
