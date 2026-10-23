'use strict';

/**
 * Đua Gõ Theo Nhạc — catalog + persistence for the music typing race.
 *
 * Internal game type stays `typing_battle`: rooms, results, BXH and rewards keep
 * their existing tables. This migration only adds what the music mode needs to
 * be auditable:
 *   - a published song catalog (audio + timed lyrics + rights metadata),
 *   - the song a room/attempt/result belongs to,
 *   - flow / no-pause career counters.
 */

const hasTable = (q, table) => q.describeTable(table).then(() => true).catch(() => false);
const hasColumn = async (q, table, column) => {
  if (!(await hasTable(q, table))) return true; // table managed elsewhere
  const columns = await q.describeTable(table);
  return Boolean(columns[column]);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await hasTable(queryInterface, 'music_songs'))) {
      await queryInterface.createTable('music_songs', {
        id: { type: Sequelize.STRING(64), primaryKey: true },
        title: { type: Sequelize.STRING(150), allowNull: false },
        artist: { type: Sequelize.STRING(150), allowNull: false },
        language: { type: Sequelize.STRING(8), allowNull: false, defaultValue: 'VI' },
        bpm: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        difficulty: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'MEDIUM' },
        duration_ms: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        timed_lyrics_version: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
        audio_source: { type: Sequelize.JSON, allowNull: false },
        lyrics_source: { type: Sequelize.JSON, allowNull: false },
        lines: { type: Sequelize.JSON, allowNull: false },
        metrics: { type: Sequelize.JSON, allowNull: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        published_at: { type: Sequelize.DATE, allowNull: true },
        created_by: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await queryInterface.addIndex('music_songs', ['is_active', 'difficulty'], { name: 'idx_music_songs_active_difficulty' });
    }

    if (!(await hasColumn(queryInterface, 'typing_rooms', 'music_song_id'))) {
      await queryInterface.addColumn('typing_rooms', 'music_song_id', { type: Sequelize.STRING(64), allowNull: true });
    }
    if (!(await hasColumn(queryInterface, 'typing_match_results', 'music_song_id'))) {
      await queryInterface.addColumn('typing_match_results', 'music_song_id', { type: Sequelize.STRING(64), allowNull: true });
    }
    if (!(await hasColumn(queryInterface, 'typing_practice_attempts', 'music_song_id'))) {
      await queryInterface.addColumn('typing_practice_attempts', 'music_song_id', { type: Sequelize.STRING(64), allowNull: true });
    }
    if (!(await hasColumn(queryInterface, 'typing_practice_attempts', 'music_evidence'))) {
      await queryInterface.addColumn('typing_practice_attempts', 'music_evidence', { type: Sequelize.JSON, allowNull: true });
    }

    for (const [column, definition] of [
      ['music_best_flow_pct', { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 }],
      ['music_best_score', { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 }],
      ['music_no_pause_runs', { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 }],
      ['music_best_streak', { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 }],
    ]) {
      if (!(await hasColumn(queryInterface, 'typing_user_stats', column))) {
        await queryInterface.addColumn('typing_user_stats', column, definition);
      }
    }
  },

  async down(queryInterface) {
    for (const column of ['music_best_flow_pct', 'music_best_score', 'music_no_pause_runs', 'music_best_streak']) {
      await queryInterface.removeColumn('typing_user_stats', column).catch(() => {});
    }
    await queryInterface.removeColumn('typing_practice_attempts', 'music_evidence').catch(() => {});
    await queryInterface.removeColumn('typing_practice_attempts', 'music_song_id').catch(() => {});
    await queryInterface.removeColumn('typing_match_results', 'music_song_id').catch(() => {});
    await queryInterface.removeColumn('typing_rooms', 'music_song_id').catch(() => {});
    await queryInterface.dropTable('music_songs').catch(() => {});
  },
};
