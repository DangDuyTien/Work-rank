'use strict';
const sequelize = require('../config/database');
// SQLite uses one connection for the isolated browser fixture. Queue its writes;
// network databases keep normal transactional row locking and concurrency.
let pending = Promise.resolve();
function typingTransaction(work) {
  if (sequelize.getDialect() !== 'sqlite') return sequelize.transaction(work);
  const run = pending.catch(() => {}).then(() => sequelize.transaction(work));
  pending = run.catch(() => {});
  return run;
}
module.exports = typingTransaction;
