'use strict';

/**
 * Migration: 20261002020000-add-assigned-user-id-to-youtube-channels.js
 *
 * Adds `assigned_user_id` to `youtube_channels` table to allow direct assignment of
 * channels to individual members in addition to team assignment.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface;

    async function columnExists(table, column) {
      try {
        const [rows] = await q.sequelize.query(
          `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'`
        );
        return Number(rows[0].cnt) > 0;
      } catch {
        return false;
      }
    }

    if (!(await columnExists('youtube_channels', 'assigned_user_id'))) {
      console.log('[Migration] Adding assigned_user_id column to youtube_channels...');
      await q.sequelize.query(
        'ALTER TABLE `youtube_channels` ADD COLUMN `assigned_user_id` BIGINT UNSIGNED NULL AFTER `team_id`'
      );

      try {
        await q.sequelize.query(
          'ALTER TABLE `youtube_channels` ADD INDEX `idx_youtube_channels_assigned_user_id` (`assigned_user_id`)'
        );
      } catch (err) {
        console.warn('[Migration] Index on assigned_user_id may already exist:', err.message);
      }

      console.log('[Migration] Added assigned_user_id column and index successfully.');
    }
  },

  async down(queryInterface, Sequelize) {
    const q = queryInterface;
    try {
      await q.sequelize.query(
        'ALTER TABLE `youtube_channels` DROP COLUMN `assigned_user_id`'
      );
    } catch {}
  },
};
