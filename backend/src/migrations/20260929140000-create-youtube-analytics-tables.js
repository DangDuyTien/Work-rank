'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. YOUTUBE CHANNELS
    await queryInterface.createTable('youtube_channels', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      team_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: 'teams',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      channel_id: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      custom_url: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      thumbnail_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('ACTIVE', 'INACTIVE', 'ERROR'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
      sync_status: {
        type: Sequelize.ENUM('IDLE', 'SYNCING', 'SUCCESS', 'ERROR'),
        allowNull: false,
        defaultValue: 'IDLE',
      },
      last_synced_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_sync_error: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('youtube_channels', ['team_id'], { name: 'idx_youtube_channels_team_id' });
    await queryInterface.addIndex('youtube_channels', ['channel_id'], { name: 'idx_youtube_channels_channel_id' });
    await queryInterface.addIndex('youtube_channels', ['status'], { name: 'idx_youtube_channels_status' });

    // 2. YOUTUBE VIDEOS
    await queryInterface.createTable('youtube_videos', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      channel_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'youtube_channels',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      video_id: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      title: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      published_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      thumbnail_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      duration_seconds: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: Sequelize.ENUM('ACTIVE', 'DELETED', 'PRIVATE'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('youtube_videos', ['channel_id'], { name: 'idx_youtube_videos_channel_id' });
    await queryInterface.addIndex('youtube_videos', ['video_id'], { name: 'idx_youtube_videos_video_id' });
    await queryInterface.addIndex('youtube_videos', ['published_at'], { name: 'idx_youtube_videos_published_at' });

    // 3. YOUTUBE CHANNEL METRICS (Snapshots over time)
    await queryInterface.createTable('youtube_channel_metrics', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      channel_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'youtube_channels',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      captured_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      views: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      subscribers: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      videos_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      watch_time_hours: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      engagement_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('youtube_channel_metrics', ['channel_id', 'captured_at'], { name: 'idx_yt_channel_metrics_cid_time' });
    await queryInterface.addIndex('youtube_channel_metrics', ['captured_at'], { name: 'idx_yt_channel_metrics_time' });

    // 4. YOUTUBE VIDEO METRICS (Snapshots over time)
    await queryInterface.createTable('youtube_video_metrics', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      video_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'youtube_videos',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      captured_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      views: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      likes: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      comments: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      watch_time_hours: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      engagement_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('youtube_video_metrics', ['video_id', 'captured_at'], { name: 'idx_yt_video_metrics_vid_time' });
    await queryInterface.addIndex('youtube_video_metrics', ['captured_at'], { name: 'idx_yt_video_metrics_time' });

    // 5. TEAM YOUTUBE SUMMARIES (Read Model / Materialized View)
    await queryInterface.createTable('team_youtube_summaries', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      team_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true,
        references: {
          model: 'teams',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      channels_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      videos_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      total_views: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      total_subscribers: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      views_today: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      views_7d: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      views_30d: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      subscribers_today: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      subscriber_growth_7d: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      subscriber_growth_30d: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      views_growth_30d_pct: {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      sub_growth_30d_pct: {
        type: Sequelize.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      top_video_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: 'youtube_videos',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      top_video_title: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      top_video_views: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      rank_by_views: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      rank_by_subs: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      rank_by_growth: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      freshness_status: {
        type: Sequelize.ENUM('FRESH', 'STALE', 'FAILED'),
        allowNull: false,
        defaultValue: 'FRESH',
      },
      last_synced_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('team_youtube_summaries', ['team_id'], { name: 'idx_team_yt_sum_team_id' });
    await queryInterface.addIndex('team_youtube_summaries', ['total_views'], { name: 'idx_team_yt_sum_views' });
    await queryInterface.addIndex('team_youtube_summaries', ['total_subscribers'], { name: 'idx_team_yt_sum_subs' });
    await queryInterface.addIndex('team_youtube_summaries', ['views_growth_30d_pct'], { name: 'idx_team_yt_sum_growth' });
    await queryInterface.addIndex('team_youtube_summaries', ['rank_by_views'], { name: 'idx_team_yt_sum_rank_views' });
    await queryInterface.addIndex('team_youtube_summaries', ['rank_by_subs'], { name: 'idx_team_yt_sum_rank_subs' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('team_youtube_summaries');
    await queryInterface.dropTable('youtube_video_metrics');
    await queryInterface.dropTable('youtube_channel_metrics');
    await queryInterface.dropTable('youtube_videos');
    await queryInterface.dropTable('youtube_channels');
  },
};
