'use strict';
module.exports = {
  async up(queryInterface) {
    const tables = ['uno_actions','uno_results','uno_players','uno_user_stats','uno_rooms','game_2048_scores','game_2048_user_stats','game_transactions','game_events','game_properties','game_players','game_results','game_rooms'];
    for (const table of tables) await queryInterface.dropTable(table).catch(() => {});
    await queryInterface.bulkDelete('game_catalogs', { game_key: ['uno', 'game_2048', 'capital_board'] }).catch(() => {});
  },
  async down() {},
};
