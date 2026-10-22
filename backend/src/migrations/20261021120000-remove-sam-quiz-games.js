'use strict';

/**
 * Game Center cleanup — remove the retired Sâm and Guess Image (Quiz) games.
 *
 * Game Center now ships only Typing Battle and Drawing. This migration removes
 * every table that existed solely for the two retired games, purges their
 * catalogue entries, and drops game-specific reward rows written by the earlier
 * UNO game (already removed from code in 20261018000000-remove-retired-games).
 *
 * Explicitly NOT touched:
 *   - users / teams / departments / KPI / auth / social tables
 *   - typing_* and drawings/drawing_likes (active games)
 *   - score_ledger rows earned from WorkRank work (KPI, YouTube, kudos)
 *
 * The migration is idempotent: every step tolerates an already-clean database.
 */

const { Op } = require('sequelize');

const GAME_SPECIFIC_TABLES = [
  // Quiz / Guess Image — children first (FK order)
  'quiz_answers',
  'quiz_players',
  'quiz_rooms',
  'quiz_questions',
  'quiz_sets',
  'quiz_user_stats',
  // Sâm — children first (FK order)
  'sam_actions',
  'sam_results',
  'sam_players',
  'sam_rooms',
  'sam_user_stats',
  // Retired capital-board leaderboard (no model, no code path since the
  // 20261018000000 retired-game drop; kept only as an orphan table).
  'game_leaderboard_profiles',
];

const RETIRED_CATALOG_KEYS = ['sam', 'quiz', 'uno', 'game_2048', 'capital_board'];

// Ledger rows that are explicitly game rewards from removed games.
// WorkRank-earned XP (KPI/YouTube/kudos) never matches these patterns.
const RETIRED_LEDGER_PATTERNS = [
  'UNO Match%',
  'Sâm%',
  'Sam %',
  'Sam:%',
  'Quiz %',
  'Đoán Hình%',
  'Đoán Nhạc%',
];

async function tableExists(queryInterface, table) {
  return queryInterface.describeTable(table).then(() => true).catch(() => false);
}

module.exports = {
  async up(queryInterface) {
    // 1. Purge game-specific reward ledger rows before the source tables go away.
    const ledgerTableExists = await tableExists(queryInterface, 'score_ledger');
    if (ledgerTableExists) {
      for (const pattern of RETIRED_LEDGER_PATTERNS) {
        await queryInterface.bulkDelete('score_ledger', {
          reason: { [Op.like]: pattern },
        }).catch(() => {});
      }
    }

    // 2. Remove retired entries from the shared game catalogue.
    const catalogExists = await tableExists(queryInterface, 'game_catalogs');
    if (catalogExists) {
      await queryInterface.bulkDelete('game_catalogs', {
        game_key: { [Op.in]: RETIRED_CATALOG_KEYS },
      }).catch(() => {});
    }

    // 3. Drop every table that only served a retired game.
    for (const table of GAME_SPECIFIC_TABLES) {
      if (await tableExists(queryInterface, table)) {
        await queryInterface.dropTable(table);
      }
    }

    // 4. Post-condition: no retired game table may survive this migration.
    for (const table of GAME_SPECIFIC_TABLES) {
      if (await tableExists(queryInterface, table)) {
        throw new Error(`[game-center-cleanup] Table "${table}" still exists after cleanup`);
      }
    }
  },

  /**
   * Irreversible by design: this migration deletes retired game data.
   * Restore from the pre-cleanup snapshot documented in
   * docs/audit/2026-10-21/GAME_CENTER_CLEANUP_BEFORE_NEW_GAME.md if ever needed.
   */
  async down() {},
};
