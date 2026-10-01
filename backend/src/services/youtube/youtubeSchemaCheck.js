'use strict';

/**
 * YouTube Schema Safety Reconciler
 * Runs once on server startup to verify that critical YouTube columns exist in the connected database.
 * If any column (e.g. created_at, subscribers_today) is missing or mismatched, it repairs it self-healingly.
 */
async function ensureYouTubeSchema(sequelize) {
  try {
    const [summaryCols] = await sequelize.query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'team_youtube_summaries'
    `);

    const colNames = new Set(summaryCols.map((c) => c.COLUMN_NAME));

    // 1. Ensure created_at exists in team_youtube_summaries
    if (!colNames.has('created_at')) {
      console.log('[YouTubeSchema] Repairing missing created_at in team_youtube_summaries...');
      await sequelize.query(
        `ALTER TABLE \`team_youtube_summaries\` ADD COLUMN \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`
      );
      console.log('[YouTubeSchema] Repaired created_at column successfully.');
    }

    // 2. Ensure subscribers_today is signed INT
    const subTodayCol = summaryCols.find((c) => c.COLUMN_NAME === 'subscribers_today');
    if (subTodayCol && subTodayCol.COLUMN_TYPE.toLowerCase().includes('unsigned')) {
      console.log('[YouTubeSchema] Converting team_youtube_summaries.subscribers_today from unsigned to signed INT...');
      await sequelize.query(
        `ALTER TABLE \`team_youtube_summaries\` MODIFY COLUMN \`subscribers_today\` INT NOT NULL DEFAULT 0`
      );
      console.log('[YouTubeSchema] Converted subscribers_today to signed INT successfully.');
    }
  } catch (err) {
    console.warn('[YouTubeSchema] Startup check warning (non-fatal):', err.message);
  }
}

module.exports = { ensureYouTubeSchema };
