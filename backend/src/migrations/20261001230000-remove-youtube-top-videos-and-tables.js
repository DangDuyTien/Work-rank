'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Drop foreign key / columns from team_youtube_summaries if present
    const tableInfo = await queryInterface.describeTable('team_youtube_summaries').catch(() => null);
    if (tableInfo) {
      if (tableInfo.top_video_id) {
        await queryInterface.removeColumn('team_youtube_summaries', 'top_video_id').catch((err) => {
          console.warn('[Migration] Could not remove top_video_id column:', err.message);
        });
      }
      if (tableInfo.top_video_title) {
        await queryInterface.removeColumn('team_youtube_summaries', 'top_video_title').catch((err) => {
          console.warn('[Migration] Could not remove top_video_title column:', err.message);
        });
      }
      if (tableInfo.top_video_views) {
        await queryInterface.removeColumn('team_youtube_summaries', 'top_video_views').catch((err) => {
          console.warn('[Migration] Could not remove top_video_views column:', err.message);
        });
      }
    }

    // 2. Drop youtube_video_metrics table if exists
    await queryInterface.dropTable('youtube_video_metrics').catch((err) => {
      console.warn('[Migration] Could not drop youtube_video_metrics table:', err.message);
    });

    // 3. Drop youtube_videos table if exists
    await queryInterface.dropTable('youtube_videos').catch((err) => {
      console.warn('[Migration] Could not drop youtube_videos table:', err.message);
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Irreversible cleanup of video metrics
  },
};
