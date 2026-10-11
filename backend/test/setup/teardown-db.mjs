/**
 * Global test teardown safety net.
 *
 * Root cause it fixes:
 * Many suites in `backend/test` never call `sequelize.close()`. With the SQLite
 * test dialect that leaves the connection pool's handles open, so the test
 * process stays alive after the last test resolves. `node --test` waits for the
 * event loop to drain; across ~53 leaking files that wait trips the harness
 * TEST_TIMEOUT (> 180000ms) and the suite is truncated mid-run — even though
 * every individual assertion passed.
 *
 * How it fixes it:
 * Loaded once per test process via `node --import ./test/setup/teardown-db.mjs`,
 * this registers a root-level `after()` hook that closes the connection pool
 * when all tests in that process have finished. The process can then exit
 * promptly instead of hanging on the leaked pool.
 *
 * Safety:
 * Suites that already close the connection themselves are unaffected —
 * `Sequelize.prototype.close()` is idempotent, so a second call is a no-op.
 * Teardown failures are logged, never rethrown, so they cannot mask a real
 * test result.
 */
import { after } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const { sequelize } = require(path.resolve(here, '../../src/models'));

after(async () => {
  try {
    await sequelize.close();
  } catch (error) {
    // A teardown hiccup must not turn a green suite red.
    console.error('[test-teardown] Failed to close Sequelize connection:', error.message);
  }
});
