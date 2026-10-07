'use strict';

const {
  TypingChallenge,
  TypingRoom,
  TypingPlayer,
  TypingMatchResult,
  TypingUserStat,
} = require('../models');
const { seedTypingChallenges } = require('../seeders/typingChallenges.seeder');

/**
 * Ensures typing game tables and columns exist self-healingly across all dialects (SQLite, MySQL, PostgreSQL).
 */
async function ensureTypingSchema(sequelize) {
  try {
    // 1. Sync all typing models safely with { alter: false } if tables do not exist
    await TypingChallenge.sync();
    await TypingRoom.sync();
    await TypingPlayer.sync();
    await TypingMatchResult.sync();
    await TypingUserStat.sync();

    // 2. Ensure initial challenges exist
    const count = await TypingChallenge.count();
    if (count === 0) {
      await seedTypingChallenges().catch((err) =>
        console.warn('[TypingSchema] Challenge seed warning (non-fatal):', err.message)
      );
    }
  } catch (err) {
    console.warn('[TypingSchema] Schema safety sync warning (non-fatal):', err.message);
  }
}

module.exports = { ensureTypingSchema };
