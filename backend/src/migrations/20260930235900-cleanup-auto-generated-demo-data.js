'use strict';

const { Op } = require('sequelize');

const DEMO_EMAILS = [
  'editor.nam@3winmedia.vn',
  'creator.ha@3winmedia.vn',
  'dev.bao@3winmedia.vn',
  'manager.duc@3winmedia.vn',
  'marketing.linh@3winmedia.vn',
  'design.dang@3winmedia.vn',
  'script.thao@3winmedia.vn',
  'analyst.huy@3winmedia.vn',
  'intern.kiet@3winmedia.vn',
  'alice.creator@workrank.com',
  'bob.community@workrank.com',
  'charlie.dev@workrank.com',
];

const DEMO_TEAM_NAMES = [
  'Team Sáng Tạo Alpha',
  'Team Kỹ Thuật Beta',
  'Team Truyền Thông Gamma',
  'Team Sản Xuất Delta',
];

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    // 1. Find all demo user IDs
    const [demoUsers] = await sequelize.query(
      `SELECT id FROM users WHERE email IN (:emails) OR email LIKE '%@3winmedia.vn' OR is_simulated = 1`,
      { replacements: { emails: DEMO_EMAILS } }
    );

    const demoUserIds = demoUsers.map((u) => u.id);

    if (demoUserIds.length > 0) {
      // Safe cleanup of related records for demo users
      const tablesWithUserFk = [
        { table: 'friendships', cols: ['user_id', 'friend_id'] },
        { table: 'profile_likes', cols: ['source_user_id', 'target_user_id'] },
        { table: 'chat_messages', cols: ['user_id'] },
        { table: 'user_recognitions', cols: ['user_id', 'awarded_by'] },
        { table: 'user_profile_customizations', cols: ['user_id'] },
        { table: 'season_team_members', cols: ['user_id'] },
        { table: 'capital_game_players', cols: ['user_id'] },
        { table: 'capital_game_user_stats', cols: ['user_id'] },
        { table: 'quiz_game_user_stats', cols: ['user_id'] },
        { table: 'game_2048_user_stats', cols: ['user_id'] },
        { table: 'game_2048_runs', cols: ['user_id'] },
        { table: 'game_2048_leaderboard', cols: ['user_id'] },
        { table: 'score_ledgers', cols: ['user_id'] },
        { table: 'competition_events', cols: ['actor_id'] },
      ];

      for (const t of tablesWithUserFk) {
        try {
          const [tableExists] = await sequelize.query(
            `SHOW TABLES LIKE '${t.table}'`
          );
          if (tableExists && tableExists.length > 0) {
            for (const col of t.cols) {
              await sequelize.query(
                `DELETE FROM \`${t.table}\` WHERE \`${col}\` IN (:ids)`,
                { replacements: { ids: demoUserIds } }
              );
            }
          }
        } catch (e) {
          // Table might not exist or columns might vary, proceed safely
        }
      }

      // Nullify references in any remaining tables if needed
      try {
        await sequelize.query(
          `UPDATE teams SET owner_id = NULL WHERE owner_id IN (:ids)`,
          { replacements: { ids: demoUserIds } }
        );
      } catch (e) {}

      // Delete demo users
      await sequelize.query(
        `DELETE FROM users WHERE id IN (:ids)`,
        { replacements: { ids: demoUserIds } }
      );
    }

    // 2. Clean up demo teams if they have no genuine members
    const [demoTeams] = await sequelize.query(
      `SELECT id FROM teams WHERE name IN (:names)`,
      { replacements: { names: DEMO_TEAM_NAMES } }
    );

    const demoTeamIds = demoTeams.map((t) => t.id);
    if (demoTeamIds.length > 0) {
      // Check if any non-demo users remain in these teams
      const [remainingUsers] = await sequelize.query(
        `SELECT id, team_id FROM users WHERE team_id IN (:teamIds)`,
        { replacements: { teamIds: demoTeamIds } }
      );

      if (remainingUsers.length === 0) {
        // Safe to remove demo teams and their season bindings
        try {
          await sequelize.query(
            `DELETE FROM season_teams WHERE team_id IN (:teamIds)`,
            { replacements: { teamIds: demoTeamIds } }
          );
        } catch (e) {}

        try {
          await sequelize.query(
            `DELETE FROM team_youtube_summaries WHERE team_id IN (:teamIds)`,
            { replacements: { teamIds: demoTeamIds } }
          );
        } catch (e) {}

        await sequelize.query(
          `DELETE FROM teams WHERE id IN (:teamIds)`,
          { replacements: { teamIds: demoTeamIds } }
        );
      }
    }
  },

  async down() {
    // Irreversible cleanup migration — do not re-insert fake demo users
  },
};
