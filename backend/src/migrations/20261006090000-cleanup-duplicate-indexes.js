'use strict';

/**
 * Migration: Safely remove verified duplicate indexes on the `teams` table.
 *
 * Checks exact column composition, sequence, and uniqueness before dropping.
 * Only drops an index if a canonical index with identical columns and uniqueness already exists.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const sequelize = queryInterface.sequelize;
    const dialect = sequelize.getDialect();

    if (dialect !== 'mysql' && dialect !== 'mariadb') {
      return;
    }

    const tableName = 'teams';
    const [rawIndexes] = await sequelize.query(`SHOW INDEX FROM \`${tableName}\``);

    // Group columns by index Key_name
    const indexMap = new Map();
    for (const row of rawIndexes) {
      const name = row.Key_name;
      if (!indexMap.has(name)) {
        indexMap.set(name, {
          name,
          unique: Number(row.Non_unique) === 0,
          columns: [],
        });
      }
      indexMap.get(name).columns.push({
        column: row.Column_name,
        seq: Number(row.Seq_in_index),
      });
    }

    // Sort column sequences
    for (const idx of indexMap.values()) {
      idx.columns.sort((a, b) => a.seq - b.seq);
      idx.signature = `${idx.unique ? 'UNIQ' : 'MUL'}:${idx.columns.map((c) => c.column).join(',')}`;
    }

    // Canonical indexes to protect
    const canonicalNames = new Set(['PRIMARY', 'name', 'invite_code', 'owner_id']);
    const canonicalSignatures = new Set();
    for (const [name, idx] of indexMap.entries()) {
      if (canonicalNames.has(name)) {
        canonicalSignatures.add(idx.signature);
      }
    }

    // Identify true duplicates that have identical signature to a canonical index
    for (const [name, idx] of indexMap.entries()) {
      if (canonicalNames.has(name)) continue;

      if (canonicalSignatures.has(idx.signature)) {
        // Safe to drop verified duplicate
        await sequelize.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${name}\``);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    // Redundant duplicate indexes should not be recreated.
  },
};

