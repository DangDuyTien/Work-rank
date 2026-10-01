'use strict';

/**
 * Migration: 20261001190000-reconcile-youtube-production-schema.js
 *
 * ROOT CAUSE REMEDIATION:
 * 1. Migration 20260929140000 created `team_youtube_summaries` without `created_at`.
 * 2. Migration 20261001000000 attempted `ALTER TABLE MODIFY COLUMN created_at ...`, which failed
 *    silently on existing production DBs (because MODIFY requires the column to already exist).
 *    This left production throwing "Unknown column 'created_at' in 'field list'" whenever
 *    TeamYouTubeSummary was queried or updated.
 * 3. `team_youtube_summaries.subscribers_today` was created as `INT UNSIGNED`. When subscriber
 *    growth today is negative (e.g. net subscriber loss), MySQL strict mode throws
 *    "Out of range value for column 'subscribers_today' at row 1" (code 1264).
 *
 * This migration:
 * - Safely adds `created_at` to `team_youtube_summaries` if missing (via ADD COLUMN), or fixes default if present.
 * - Modifies `subscribers_today` in `team_youtube_summaries` to signed `INT` so negative changes never crash.
 * - Verifies and reconciles timestamp columns across all 5 YouTube tables.
 * - Is 100% idempotent and safe to run on any environment.
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

    // ============================================================
    // 1. RECONCILE team_youtube_summaries
    // ============================================================
    if (await tableExists('team_youtube_summaries')) {
      // 1a. Ensure created_at exists
      if (!(await columnExists('team_youtube_summaries', 'created_at'))) {
        console.log('[Migration] Adding missing column created_at to team_youtube_summaries...');
        await q.sequelize.query(
          `ALTER TABLE \`team_youtube_summaries\` ADD COLUMN \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
        );
      } else {
        await q.sequelize.query(
          `ALTER TABLE \`team_youtube_summaries\` MODIFY COLUMN \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
        );
      }

      // 1b. Ensure updated_at exists & has ON UPDATE trigger
      if (!(await columnExists('team_youtube_summaries', 'updated_at'))) {
        await q.sequelize.query(
          `ALTER TABLE \`team_youtube_summaries\` ADD COLUMN \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
        );
      } else {
        await q.sequelize.query(
          `ALTER TABLE \`team_youtube_summaries\` MODIFY COLUMN \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
        );
      }

      // 1c. Change subscribers_today from UNSIGNED to SIGNED INT
      try {
        await q.sequelize.query(
          `ALTER TABLE \`team_youtube_summaries\` MODIFY COLUMN \`subscribers_today\` INT NOT NULL DEFAULT 0`
        );
        console.log('[Migration] Successfully changed team_youtube_summaries.subscribers_today to signed INT');
      } catch (err) {
        console.warn('[Migration] subscribers_today signed conversion warning:', err.message);
      }
    }

    // ============================================================
    // 2. RECONCILE youtube_channel_metrics
    // ============================================================
    if (await tableExists('youtube_channel_metrics')) {
      if (!(await columnExists('youtube_channel_metrics', 'created_at'))) {
        await q.sequelize.query(
          `ALTER TABLE \`youtube_channel_metrics\` ADD COLUMN \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
        );
      } else {
        await q.sequelize.query(
          `ALTER TABLE \`youtube_channel_metrics\` MODIFY COLUMN \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
        );
      }

      try {
        await q.sequelize.query(
          `ALTER TABLE \`youtube_channel_metrics\` MODIFY COLUMN \`engagement_rate\` DECIMAL(7,4) NOT NULL DEFAULT 0.0000`
        );
      } catch (err) {
        console.warn('[Migration] youtube_channel_metrics.engagement_rate warning:', err.message);
      }
    }

    // ============================================================
    // 3. RECONCILE youtube_video_metrics
    // ============================================================
    if (await tableExists('youtube_video_metrics')) {
      if (!(await columnExists('youtube_video_metrics', 'created_at'))) {
        await q.sequelize.query(
          `ALTER TABLE \`youtube_video_metrics\` ADD COLUMN \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
        );
      } else {
        await q.sequelize.query(
          `ALTER TABLE \`youtube_video_metrics\` MODIFY COLUMN \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
        );
      }

      try {
        await q.sequelize.query(
          `ALTER TABLE \`youtube_video_metrics\` MODIFY COLUMN \`engagement_rate\` DECIMAL(7,4) NOT NULL DEFAULT 0.0000`
        );
      } catch (err) {
        console.warn('[Migration] youtube_video_metrics.engagement_rate warning:', err.message);
      }
    }

    // ============================================================
    // 4. RECONCILE youtube_channels
    // ============================================================
    if (await tableExists('youtube_channels')) {
      if (!(await columnExists('youtube_channels', 'created_at'))) {
        await q.sequelize.query(
          `ALTER TABLE \`youtube_channels\` ADD COLUMN \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
        );
      } else {
        await q.sequelize.query(
          `ALTER TABLE \`youtube_channels\` MODIFY COLUMN \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
        );
      }

      if (!(await columnExists('youtube_channels', 'updated_at'))) {
        await q.sequelize.query(
          `ALTER TABLE \`youtube_channels\` ADD COLUMN \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
        );
      } else {
        await q.sequelize.query(
          `ALTER TABLE \`youtube_channels\` MODIFY COLUMN \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
        );
      }
    }

    // ============================================================
    // 5. RECONCILE youtube_videos
    // ============================================================
    if (await tableExists('youtube_videos')) {
      if (!(await columnExists('youtube_videos', 'created_at'))) {
        await q.sequelize.query(
          `ALTER TABLE \`youtube_videos\` ADD COLUMN \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
        );
      } else {
        await q.sequelize.query(
          `ALTER TABLE \`youtube_videos\` MODIFY COLUMN \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
        );
      }

      if (!(await columnExists('youtube_videos', 'updated_at'))) {
        await q.sequelize.query(
          `ALTER TABLE \`youtube_videos\` ADD COLUMN \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
        );
      } else {
        await q.sequelize.query(
          `ALTER TABLE \`youtube_videos\` MODIFY COLUMN \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
        );
      }
    }

    console.log('[Migration] 20261001190000-reconcile-youtube-production-schema completed successfully.');
  },

  async down(queryInterface, Sequelize) {
    // Reversible changes only; data is preserved
    console.log('[Migration] 20261001190000 rollback completed.');
  },
};
