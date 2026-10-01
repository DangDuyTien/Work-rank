'use strict';

/**
 * FULL AUDIT MIGRATION — YouTube Schema Fix
 *
 * ROOT CAUSE: The original migration (20260929140000) ran successfully BUT:
 * 1. Composite indexes on youtube_channel_metrics/youtube_video_metrics were lost
 *    (the addIndex calls after createTable may have silently failed on some DB engines)
 * 2. On production (Render), created_at columns in metric tables lack CURRENT_TIMESTAMP defaults,
 *    causing Sequelize INSERT failures when strict mode is active.
 * 3. The engagement_rate column DECIMAL(5,2) has precision issues (max 999.99, but
 *    the raw formula could produce > 999.99 for edge cases).
 * 4. team_youtube_summaries.updated_at has NO DEFAULT — Sequelize requires it to be
 *    explicitly writable or have a DB-level default.
 *
 * This migration is FULLY IDEMPOTENT:
 * - Uses IF NOT EXISTS / IF EXISTS guards for all DDL
 * - Will safely run on environments where the fix is already applied
 * - Preserves all existing data
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = queryInterface;

    // ============================================================
    // HELPER: safe addIndex — skips if index already exists
    // ============================================================
    async function safeAddIndex(table, fields, options) {
      try {
        const indexes = await q.showIndex(table);
        const exists = indexes.some((idx) => idx.name === options.name);
        if (!exists) {
          await q.addIndex(table, fields, options);
          console.log(`[Migration] Added index: ${options.name}`);
        } else {
          console.log(`[Migration] Index already exists, skipping: ${options.name}`);
        }
      } catch (err) {
        console.warn(`[Migration] safeAddIndex(${options.name}) warning:`, err.message);
      }
    }

    // ============================================================
    // HELPER: safe ALTER COLUMN to set DEFAULT CURRENT_TIMESTAMP
    // ============================================================
    async function safeFixTimestampDefault(table, column) {
      try {
        await q.sequelize.query(
          `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`,
        );
        console.log(`[Migration] Fixed DEFAULT CURRENT_TIMESTAMP: ${table}.${column}`);
      } catch (err) {
        console.warn(`[Migration] safeFixTimestampDefault(${table}.${column}) warning:`, err.message);
      }
    }

    // ============================================================
    // HELPER: safe ALTER COLUMN updated_at with ON UPDATE
    // ============================================================
    async function safeFixUpdatedAtDefault(table) {
      try {
        await q.sequelize.query(
          `ALTER TABLE \`${table}\` MODIFY COLUMN \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
        );
        console.log(`[Migration] Fixed DEFAULT CURRENT_TIMESTAMP ON UPDATE: ${table}.updated_at`);
      } catch (err) {
        console.warn(`[Migration] safeFixUpdatedAtDefault(${table}) warning:`, err.message);
      }
    }

    // ============================================================
    // HELPER: check if table exists
    // ============================================================
    async function tableExists(table) {
      try {
        const [rows] = await q.sequelize.query(
          `SELECT COUNT(*) AS cnt FROM information_schema.TABLES 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}'`,
        );
        return Number(rows[0].cnt) > 0;
      } catch {
        return false;
      }
    }

    // ============================================================
    // HELPER: check if column exists
    // ============================================================
    async function columnExists(table, column) {
      try {
        const [rows] = await q.sequelize.query(
          `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'`,
        );
        return Number(rows[0].cnt) > 0;
      } catch {
        return false;
      }
    }

    // ============================================================
    // STEP 1: Ensure youtube_channels table exists with full schema
    // ============================================================
    if (!(await tableExists('youtube_channels'))) {
      console.log('[Migration] Creating youtube_channels table (was missing)...');
      await q.createTable('youtube_channels', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
        team_id: {
          type: Sequelize.BIGINT.UNSIGNED, allowNull: true,
          references: { model: 'teams', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
        },
        channel_id: { type: Sequelize.STRING(64), allowNull: false, unique: true },
        title: { type: Sequelize.STRING(255), allowNull: false },
        custom_url: { type: Sequelize.STRING(128), allowNull: true },
        thumbnail_url: { type: Sequelize.TEXT, allowNull: true },
        description: { type: Sequelize.TEXT, allowNull: true },
        status: { type: Sequelize.ENUM('ACTIVE', 'INACTIVE', 'ERROR'), allowNull: false, defaultValue: 'ACTIVE' },
        sync_status: { type: Sequelize.ENUM('IDLE', 'SYNCING', 'SUCCESS', 'ERROR'), allowNull: false, defaultValue: 'IDLE' },
        last_synced_at: { type: Sequelize.DATE, allowNull: true },
        last_sync_error: { type: Sequelize.TEXT, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      });
    }

    // ============================================================
    // STEP 2: Ensure youtube_videos table exists
    // ============================================================
    if (!(await tableExists('youtube_videos'))) {
      console.log('[Migration] Creating youtube_videos table (was missing)...');
      await q.createTable('youtube_videos', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
        channel_id: {
          type: Sequelize.BIGINT.UNSIGNED, allowNull: false,
          references: { model: 'youtube_channels', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
        },
        video_id: { type: Sequelize.STRING(64), allowNull: false, unique: true },
        title: { type: Sequelize.STRING(500), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        published_at: { type: Sequelize.DATE, allowNull: false },
        thumbnail_url: { type: Sequelize.TEXT, allowNull: true },
        duration_seconds: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        status: { type: Sequelize.ENUM('ACTIVE', 'DELETED', 'PRIVATE'), allowNull: false, defaultValue: 'ACTIVE' },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      });
    }

    // ============================================================
    // STEP 3: Ensure youtube_channel_metrics table exists
    // ============================================================
    if (!(await tableExists('youtube_channel_metrics'))) {
      console.log('[Migration] Creating youtube_channel_metrics table (was missing)...');
      await q.createTable('youtube_channel_metrics', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
        channel_id: {
          type: Sequelize.BIGINT.UNSIGNED, allowNull: false,
          references: { model: 'youtube_channels', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
        },
        captured_at: { type: Sequelize.DATE, allowNull: false },
        views: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        subscribers: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        videos_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        watch_time_hours: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0.00 },
        engagement_rate: { type: Sequelize.DECIMAL(7, 4), allowNull: false, defaultValue: 0.0000 },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    // ============================================================
    // STEP 4: Ensure youtube_video_metrics table exists
    // ============================================================
    if (!(await tableExists('youtube_video_metrics'))) {
      console.log('[Migration] Creating youtube_video_metrics table (was missing)...');
      await q.createTable('youtube_video_metrics', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
        video_id: {
          type: Sequelize.BIGINT.UNSIGNED, allowNull: false,
          references: { model: 'youtube_videos', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
        },
        captured_at: { type: Sequelize.DATE, allowNull: false },
        views: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        likes: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        comments: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        watch_time_hours: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0.00 },
        engagement_rate: { type: Sequelize.DECIMAL(7, 4), allowNull: false, defaultValue: 0.0000 },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    // ============================================================
    // STEP 5: Ensure team_youtube_summaries table exists
    // ============================================================
    if (!(await tableExists('team_youtube_summaries'))) {
      console.log('[Migration] Creating team_youtube_summaries table (was missing)...');
      await q.createTable('team_youtube_summaries', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true, allowNull: false },
        team_id: {
          type: Sequelize.BIGINT.UNSIGNED, allowNull: false, unique: true,
          references: { model: 'teams', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
        },
        channels_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        videos_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        total_views: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        total_subscribers: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        views_today: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        views_7d: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        views_30d: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        subscribers_today: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        subscriber_growth_7d: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        subscriber_growth_30d: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        views_growth_30d_pct: { type: Sequelize.DECIMAL(10, 4), allowNull: false, defaultValue: 0.0000 },
        sub_growth_30d_pct: { type: Sequelize.DECIMAL(10, 4), allowNull: false, defaultValue: 0.0000 },
        top_video_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true },
        top_video_title: { type: Sequelize.STRING(500), allowNull: true },
        top_video_views: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        rank_by_views: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        rank_by_subs: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        rank_by_growth: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        freshness_status: { type: Sequelize.ENUM('FRESH', 'STALE', 'FAILED'), allowNull: false, defaultValue: 'FRESH' },
        last_synced_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      });
    }

    // ============================================================
    // STEP 6: Fix timestamp defaults on EXISTING tables
    // ============================================================
    console.log('[Migration] Fixing timestamp defaults on existing tables...');

    // Fix created_at defaults to CURRENT_TIMESTAMP (so DB auto-fills if Sequelize doesn't send it)
    await safeFixTimestampDefault('youtube_channels', 'created_at');
    await safeFixUpdatedAtDefault('youtube_channels');
    await safeFixTimestampDefault('youtube_videos', 'created_at');
    await safeFixUpdatedAtDefault('youtube_videos');
    await safeFixTimestampDefault('youtube_channel_metrics', 'created_at');
    await safeFixTimestampDefault('youtube_video_metrics', 'created_at');
    await safeFixTimestampDefault('team_youtube_summaries', 'created_at');
    await safeFixUpdatedAtDefault('team_youtube_summaries');

    // ============================================================
    // STEP 7: Fix engagement_rate precision — widen from DECIMAL(5,2) to DECIMAL(7,4)
    // This prevents "Out of range value" when engagement_rate > 99.99
    // DECIMAL(7,4) allows values up to 999.9999
    // ============================================================
    console.log('[Migration] Fixing engagement_rate precision...');
    try {
      await q.sequelize.query(
        `ALTER TABLE youtube_channel_metrics MODIFY COLUMN engagement_rate DECIMAL(7,4) NOT NULL DEFAULT 0.0000`,
      );
      console.log('[Migration] Fixed youtube_channel_metrics.engagement_rate → DECIMAL(7,4)');
    } catch (err) {
      console.warn('[Migration] engagement_rate fix (channel_metrics):', err.message);
    }

    try {
      await q.sequelize.query(
        `ALTER TABLE youtube_video_metrics MODIFY COLUMN engagement_rate DECIMAL(7,4) NOT NULL DEFAULT 0.0000`,
      );
      console.log('[Migration] Fixed youtube_video_metrics.engagement_rate → DECIMAL(7,4)');
    } catch (err) {
      console.warn('[Migration] engagement_rate fix (video_metrics):', err.message);
    }

    // ============================================================
    // STEP 8: Fix growth percentage precision — widen DECIMAL(6,2) to DECIMAL(10,4)
    // This prevents "Out of range value" for very large growth percentages
    // ============================================================
    console.log('[Migration] Fixing growth percentage precision...');
    try {
      await q.sequelize.query(
        `ALTER TABLE team_youtube_summaries 
         MODIFY COLUMN views_growth_30d_pct DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
         MODIFY COLUMN sub_growth_30d_pct DECIMAL(10,4) NOT NULL DEFAULT 0.0000`,
      );
      console.log('[Migration] Fixed team_youtube_summaries growth_pct → DECIMAL(10,4)');
    } catch (err) {
      console.warn('[Migration] growth_pct fix:', err.message);
    }

    // ============================================================
    // STEP 9: Restore missing composite indexes on metric tables
    // ============================================================
    console.log('[Migration] Ensuring composite indexes...');

    await safeAddIndex('youtube_channel_metrics', ['channel_id', 'captured_at'], {
      name: 'idx_yt_channel_metrics_cid_time',
    });
    await safeAddIndex('youtube_channel_metrics', ['captured_at'], {
      name: 'idx_yt_channel_metrics_time',
    });
    await safeAddIndex('youtube_video_metrics', ['video_id', 'captured_at'], {
      name: 'idx_yt_video_metrics_vid_time',
    });
    await safeAddIndex('youtube_video_metrics', ['captured_at'], {
      name: 'idx_yt_video_metrics_time',
    });
    await safeAddIndex('team_youtube_summaries', ['team_id'], {
      name: 'idx_team_yt_sum_team_id',
    });
    await safeAddIndex('team_youtube_summaries', ['total_views'], {
      name: 'idx_team_yt_sum_views',
    });
    await safeAddIndex('team_youtube_summaries', ['total_subscribers'], {
      name: 'idx_team_yt_sum_subs',
    });
    await safeAddIndex('team_youtube_summaries', ['views_growth_30d_pct'], {
      name: 'idx_team_yt_sum_growth',
    });
    await safeAddIndex('team_youtube_summaries', ['rank_by_views'], {
      name: 'idx_team_yt_sum_rank_views',
    });
    await safeAddIndex('team_youtube_summaries', ['rank_by_subs'], {
      name: 'idx_team_yt_sum_rank_subs',
    });
    await safeAddIndex('youtube_channels', ['team_id'], {
      name: 'idx_youtube_channels_team_id',
    });
    await safeAddIndex('youtube_channels', ['channel_id'], {
      name: 'idx_youtube_channels_channel_id',
    });
    await safeAddIndex('youtube_channels', ['status'], {
      name: 'idx_youtube_channels_status',
    });
    await safeAddIndex('youtube_videos', ['channel_id'], {
      name: 'idx_youtube_videos_channel_id',
    });
    await safeAddIndex('youtube_videos', ['video_id'], {
      name: 'idx_youtube_videos_video_id',
    });
    await safeAddIndex('youtube_videos', ['published_at'], {
      name: 'idx_youtube_videos_published_at',
    });

    console.log('[Migration] YouTube schema full audit complete.');
  },

  async down(queryInterface, Sequelize) {
    // Revert precision fixes only (don't drop tables — that would lose data)
    // Revert engagement_rate back to DECIMAL(5,2)
    try {
      await queryInterface.sequelize.query(
        `ALTER TABLE youtube_channel_metrics MODIFY COLUMN engagement_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00`,
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE youtube_video_metrics MODIFY COLUMN engagement_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00`,
      );
    } catch (err) {
      console.warn('[Migration down] engagement_rate revert:', err.message);
    }
    try {
      await queryInterface.sequelize.query(
        `ALTER TABLE team_youtube_summaries 
         MODIFY COLUMN views_growth_30d_pct DECIMAL(6,2) NOT NULL DEFAULT 0.00,
         MODIFY COLUMN sub_growth_30d_pct DECIMAL(6,2) NOT NULL DEFAULT 0.00`,
      );
    } catch (err) {
      console.warn('[Migration down] growth_pct revert:', err.message);
    }
  },
};
