'use strict';

/**
 * Migration: 20261001220000-remove-youtube-videos-count-columns.js
 *
 * Removes `videos_count` column from `youtube_channel_metrics` and `team_youtube_summaries`.
 * The metric "Số lượng video / Videos" is permanently decommissioned from the YouTube module.
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

    async function tableExists(table) {
      try {
        const [rows] = await q.sequelize.query(
          `SELECT COUNT(*) AS cnt FROM information_schema.TABLES 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}'`
        );
        return Number(rows[0].cnt) > 0;
      } catch {
        return false;
      }
    }

    // 1. Drop videos_count from youtube_channel_metrics
    if (await tableExists('youtube_channel_metrics')) {
      if (await columnExists('youtube_channel_metrics', 'videos_count')) {
        console.log('[Migration] Dropping column videos_count from youtube_channel_metrics...');
        await q.sequelize.query(
          'ALTER TABLE `youtube_channel_metrics` DROP COLUMN `videos_count`'
        );
        console.log('[Migration] Dropped videos_count from youtube_channel_metrics successfully.');
      }
    }

    // 2. Drop videos_count from team_youtube_summaries
    if (await tableExists('team_youtube_summaries')) {
      if (await columnExists('team_youtube_summaries', 'videos_count')) {
        console.log('[Migration] Dropping column videos_count from team_youtube_summaries...');
        await q.sequelize.query(
          'ALTER TABLE `team_youtube_summaries` DROP COLUMN `videos_count`'
        );
        console.log('[Migration] Dropped videos_count from team_youtube_summaries successfully.');
      }
    }

    console.log('[Migration] 20261001220000-remove-youtube-videos-count-columns applied successfully.');
  },

  async down(queryInterface, Sequelize) {
    const q = queryInterface;

    // Optional rollback: Re-add columns as nullable/default 0
    try {
      await q.sequelize.query(
        'ALTER TABLE `youtube_channel_metrics` ADD COLUMN `videos_count` INT UNSIGNED NOT NULL DEFAULT 0'
      );
    } catch {}

    try {
      await q.sequelize.query(
        'ALTER TABLE `team_youtube_summaries` ADD COLUMN `videos_count` INT UNSIGNED NOT NULL DEFAULT 0'
      );
    } catch {}

    console.log('[Migration] 20261001220000-remove-youtube-videos-count-columns rolled back.');
  },
};
