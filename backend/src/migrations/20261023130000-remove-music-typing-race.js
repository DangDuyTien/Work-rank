'use strict';

/**
 * Rollback of the cancelled "Đua Gõ Theo Nhạc" (music typing) feature.
 *
 * The create migration (20261023120000) was already applied on development
 * databases, so it stays in history — deleting an applied migration would leave
 * a dangling `SequelizeMeta` row and make the schema impossible to reason about.
 * This forward migration is the cleanup: it removes everything the feature
 * added, and it is idempotent so it is safe on databases where the feature was
 * never applied.
 *
 * Nothing here touches typing rooms, results, stats or BXH beyond dropping the
 * music-only columns; the typing game keeps working with the exact same tables.
 */

const hasTable = (q, table) => q.describeTable(table).then(() => true).catch(() => false);
const hasColumn = async (q, table, column) => {
  if (!(await hasTable(q, table))) return false;
  const columns = await q.describeTable(table);
  return Boolean(columns[column]);
};

const MUSIC_STAT_COLUMNS = ['music_best_flow_pct', 'music_best_score', 'music_no_pause_runs', 'music_best_streak'];

module.exports = {
  async up(queryInterface) {
    // 1. Song catalog table.
    if (await hasTable(queryInterface, 'music_songs')) {
      await queryInterface.dropTable('music_songs');
    }

    // 2. Music-only columns on typing tables.
    for (const [table, column] of [
      ['typing_rooms', 'music_song_id'],
      ['typing_match_results', 'music_song_id'],
      ['typing_practice_attempts', 'music_song_id'],
      ['typing_practice_attempts', 'music_evidence'],
    ]) {
      if (await hasColumn(queryInterface, table, column)) {
        await queryInterface.removeColumn(table, column);
      }
    }

    // 3. Music career counters on the typing stat row.
    for (const column of MUSIC_STAT_COLUMNS) {
      if (await hasColumn(queryInterface, 'typing_user_stats', column)) {
        await queryInterface.removeColumn('typing_user_stats', column);
      }
    }
  },

  async down() {
    // One-way cleanup: the feature is cancelled, there is nothing to restore.
  },
};
