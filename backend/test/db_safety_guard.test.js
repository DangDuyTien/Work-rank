'use strict';

/**
 * db_safety_guard.test.js
 *
 * Verification suite for BUG-005 fail-closed test database safety guard.
 * Verifies that tests can NEVER target or destroy working/production databases.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const {
  assertSafeTestDatabase,
  FORBIDDEN_TEST_DATABASES,
  ALLOWED_TEST_DB_SUFFIXES,
} = require('../src/config/env');

describe('BUG-005: Database Safety Guard (assertSafeTestDatabase)', () => {
  describe('Unit Tests: Guard Rejection of Unsafe Databases in Test Mode', () => {
    it('rejects protected database "workrank_realtime" in test mode', () => {
      assert.throws(
        () => {
          assertSafeTestDatabase({
            nodeEnv: 'test',
            db: { dialect: 'mysql', name: 'workrank_realtime' },
          });
        },
        (err) => {
          assert.equal(err.code, 'UNSAFE_TEST_DATABASE_TARGET');
          assert.match(err.message, /\[DB-SAFETY GUARD\] FATAL/);
          assert.match(err.message, /workrank_realtime/);
          return true;
        }
      );
    });

    it('rejects all protected database names in test mode regardless of case', () => {
      const protectedNames = [
        'workrank_realtime',
        'WORKRANK_REALTIME',
        'workrank',
        'production',
        'PROD',
        'staging',
        'development',
        'master',
        'main',
      ];

      for (const name of protectedNames) {
        assert.throws(
          () => {
            assertSafeTestDatabase({
              nodeEnv: 'test',
              db: { dialect: 'mysql', name },
            });
          },
          (err) => {
            assert.equal(err.code, 'UNSAFE_TEST_DATABASE_TARGET');
            assert.match(err.message, /\[DB-SAFETY GUARD\] FATAL/);
            return true;
          },
          `Expected database name "${name}" to be rejected in test mode`
        );
      }
    });

    it('rejects database names that do not end with an approved test suffix', () => {
      const invalidNames = ['workrank_db', 'app_data', 'custom_database', 'my_db'];

      for (const name of invalidNames) {
        assert.throws(
          () => {
            assertSafeTestDatabase({
              nodeEnv: 'test',
              db: { dialect: 'mysql', name },
            });
          },
          (err) => {
            assert.equal(err.code, 'UNSAFE_TEST_DATABASE_TARGET');
            assert.match(err.message, /does not end with an approved test suffix/);
            return true;
          },
          `Expected database name "${name}" without test suffix to be rejected`
        );
      }
    });

    it('rejects missing, empty, or whitespace database names for network dialects', () => {
      const emptyNames = ['', '   ', null, undefined];

      for (const name of emptyNames) {
        assert.throws(
          () => {
            assertSafeTestDatabase({
              nodeEnv: 'test',
              db: { dialect: 'mysql', name },
            });
          },
          (err) => {
            assert.equal(err.code, 'UNSAFE_TEST_DATABASE_TARGET');
            assert.match(err.message, /Database name is required/);
            return true;
          }
        );
      }
    });
  });

  describe('Unit Tests: Guard Allowance of Safe Test Databases', () => {
    it('allows database names ending with approved test suffixes', () => {
      const validNames = [
        'workrank_realtime_test',
        'workrank_realtime_testing',
        'workrank_audit',
        'my_service_e2e',
      ];

      for (const name of validNames) {
        const result = assertSafeTestDatabase({
          nodeEnv: 'test',
          db: { dialect: 'mysql', name },
        });
        assert.equal(result, true, `Expected valid test DB "${name}" to be allowed`);
      }
    });

    it('allows SQLite dialect in-memory storage', () => {
      const result = assertSafeTestDatabase({
        nodeEnv: 'test',
        db: { dialect: 'sqlite', storage: ':memory:' },
      });
      assert.equal(result, true);
    });

    it('allows SQLite dialect file storage', () => {
      const result = assertSafeTestDatabase({
        nodeEnv: 'test',
        db: { dialect: 'sqlite', storage: 'test.sqlite' },
      });
      assert.equal(result, true);
    });

    it('does not block databases when running in non-test mode (e.g. development/production)', () => {
      // In development or production, workrank_realtime is expected and valid
      const devResult = assertSafeTestDatabase({
        nodeEnv: 'development',
        db: { dialect: 'mysql', name: 'workrank_realtime' },
      });
      assert.equal(devResult, true);

      const prodResult = assertSafeTestDatabase({
        nodeEnv: 'production',
        db: { dialect: 'mysql', name: 'workrank_realtime' },
      });
      assert.equal(prodResult, true);
    });
  });

  describe('Integration Tests: Child Process Database Initialization Guard', () => {
    const backendRoot = path.resolve(__dirname, '..');

    it('blocks database.js from initializing when DB_NAME=workrank_realtime in test mode', () => {
      const result = spawnSync(
        process.execPath,
        ['-e', "require('./src/config/database')"],
        {
          cwd: backendRoot,
          env: {
            ...process.env,
            NODE_ENV: 'test',
            DB_DIALECT: 'mysql',
            DB_NAME: 'workrank_realtime',
            DB_NAME_TEST: '',
          },
          encoding: 'utf8',
        }
      );

      assert.notEqual(result.status, 0, 'Child process should fail with non-zero exit code');
      assert.match(
        result.stderr,
        /\[DB-SAFETY GUARD\] FATAL/,
        'Stderr should contain fatal guard error'
      );
      assert.match(
        result.stderr,
        /UNSAFE_TEST_DATABASE_TARGET/,
        'Error code should be UNSAFE_TEST_DATABASE_TARGET'
      );
    });

    it('blocks database.js from initializing when DB_NAME_TEST=workrank_realtime in test mode', () => {
      const result = spawnSync(
        process.execPath,
        ['-e', "require('./src/config/database')"],
        {
          cwd: backendRoot,
          env: {
            ...process.env,
            NODE_ENV: 'test',
            DB_DIALECT: 'mysql',
            DB_NAME_TEST: 'workrank_realtime',
          },
          encoding: 'utf8',
        }
      );

      assert.notEqual(result.status, 0, 'Child process should fail with non-zero exit code');
      assert.match(
        result.stderr,
        /\[DB-SAFETY GUARD\] FATAL/,
        'Stderr should contain fatal guard error'
      );
    });

    it('blocks database.js from initializing when DB_NAME lacks test suffix', () => {
      const result = spawnSync(
        process.execPath,
        ['-e', "require('./src/config/database')"],
        {
          cwd: backendRoot,
          env: {
            ...process.env,
            NODE_ENV: 'test',
            DB_DIALECT: 'mysql',
            DB_NAME: 'unapproved_production_db',
            DB_NAME_TEST: '',
          },
          encoding: 'utf8',
        }
      );

      assert.notEqual(result.status, 0, 'Child process should fail with non-zero exit code');
      assert.match(
        result.stderr,
        /does not end with an approved test suffix/,
        'Stderr should explain missing test suffix'
      );
    });

    it('allows database.js initialization when targeting a safe SQLite test configuration', () => {
      const result = spawnSync(
        process.execPath,
        ['-e', "const db = require('./src/config/database'); console.log('DB_INITIALIZED_SAFE:' + db.getDialect())"],
        {
          cwd: backendRoot,
          env: {
            ...process.env,
            NODE_ENV: 'test',
            DB_DIALECT: 'sqlite',
            DB_STORAGE: ':memory:',
          },
          encoding: 'utf8',
        }
      );

      assert.equal(result.status, 0, `Expected success (code 0) but got stderr: ${result.stderr}`);
      assert.match(result.stdout, /DB_INITIALIZED_SAFE:sqlite/);
    });
  });
});
