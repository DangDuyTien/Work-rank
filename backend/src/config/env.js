const dotenv = require('dotenv');

// Capture pre-existing environment variables from shell/invoking process before dotenv loads .env
const initialEnv = { ...process.env };
dotenv.config();

const isTest = (process.env.NODE_ENV || 'development') === 'test';

// Resolve database dialect:
// In test mode, default to SQLite only if DB_DIALECT is not explicitly forced in environment/shell.
let resolvedDialect;
if (isTest) {
  resolvedDialect = initialEnv.DB_DIALECT || process.env.DB_DIALECT_TEST || 'sqlite';
} else {
  resolvedDialect = process.env.DB_DIALECT || 'mysql';
}

// Resolve database name:
// In test mode, route to process.env.DB_NAME_TEST || 'workrank_realtime_test'.
// If an explicit DB_NAME was passed in the invoking shell environment, preserve it so
// assertSafeTestDatabase can catch and reject unsafe targets.
let resolvedDbName;
if (isTest) {
  if (process.env.DB_NAME_TEST) {
    resolvedDbName = process.env.DB_NAME_TEST;
  } else if (initialEnv.DB_NAME) {
    resolvedDbName = initialEnv.DB_NAME;
  } else {
    resolvedDbName = 'workrank_realtime_test';
  }
} else {
  resolvedDbName = process.env.DB_NAME || 'workrank_realtime';
}

// Resolve storage:
let resolvedStorage;
if (isTest && resolvedDialect === 'sqlite') {
  resolvedStorage = process.env.DB_STORAGE || ':memory:';
} else {
  resolvedStorage = process.env.DB_STORAGE || undefined;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5001),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'change-me-access-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'change-me-refresh-secret',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
  competitionProcessingEnabled: process.env.COMPETITION_PROCESSING_ENABLED !== 'false',
  competitionShadowMode: process.env.COMPETITION_SHADOW_MODE === 'true',
  // ── Private Media (owner-only capability) ──────────────────────────────────
  // Secrets stay server-side only. Never expose these through an API response.
  privateMedia: {
    // Bootstrap only: resolved ONCE into a canonical user id, then ignored.
    bootstrapOwnerEmail: (process.env.PRIVATE_MEDIA_BOOTSTRAP_OWNER_EMAIL || 'tienddph50842@gmail.com').trim().toLowerCase(),
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
    pairingCodeTtlMs: Number(process.env.PRIVATE_MEDIA_PAIRING_TTL_MS || 10 * 60 * 1000),
    sessionKey: 'primary',
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    name: resolvedDbName,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    dialect: resolvedDialect,
    storage: resolvedStorage,
    ssl: process.env.DB_SSL === 'true',
    sslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    sslCaPath: process.env.DB_SSL_CA_PATH || '',
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
  },
};

/**
 * Validates configuration fail-fast when running in production environment.
 *
 * @param {object} [customEnv=env]
 * @returns {boolean} true if valid
 * @throws {Error} if critical production configuration is missing or insecure
 */
function validateProductionConfig(customEnv = env) {
  if (customEnv.nodeEnv === 'production') {
    const errors = [];
    if (!customEnv.jwtSecret || customEnv.jwtSecret === 'change-me-access-secret' || customEnv.jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be a secure secret of at least 32 characters in production');
    }
    if (!customEnv.refreshTokenSecret || customEnv.refreshTokenSecret === 'change-me-refresh-secret' || customEnv.refreshTokenSecret.length < 32) {
      errors.push('REFRESH_TOKEN_SECRET must be a secure secret of at least 32 characters in production');
    }
    if (!customEnv.clientUrl || customEnv.clientUrl.includes('localhost') || customEnv.clientUrl.includes('127.0.0.1')) {
      errors.push('CLIENT_URL must be configured with a production domain and cannot be localhost');
    }
    if (!customEnv.db.name || !customEnv.db.user) {
      errors.push('Database configuration (DB_NAME, DB_USER) must be set for production');
    }
    if (errors.length > 0) {
      const msg = `Production Configuration Validation Failed:\n- ${errors.join('\n- ')}`;
      const err = new Error(msg);
      err.code = 'INVALID_PROD_CONFIG';
      throw err;
    }
  }
  return true;
}

const FORBIDDEN_TEST_DATABASES = Object.freeze([
  'workrank_realtime',
  'workrank',
  'workrank_dev',
  'workrank_development',
  'workrank_prod',
  'workrank_production',
  'workrank_stage',
  'workrank_staging',
  'production',
  'prod',
  'staging',
  'development',
  'master',
  'main',
]);

const ALLOWED_TEST_DB_SUFFIXES = Object.freeze([
  '_test',
  '_testing',
  '_audit',
  '_e2e',
]);

/**
 * Fail-closed safety guard to prevent tests from targeting production or development databases.
 *
 * @param {object} [config=env] - Configuration object matching env structure (must include nodeEnv and db)
 * @returns {boolean} true if safe
 * @throws {Error} if unsafe database target is detected in test environment
 */
function assertSafeTestDatabase(config = env) {
  const currentEnv = config?.nodeEnv || process.env.NODE_ENV || 'development';
  if (currentEnv !== 'test') {
    return true;
  }

  const dialect = config?.db?.dialect || 'mysql';
  const dbName = config?.db?.name;

  // SQLite dialect is safe with in-memory or local test file storage
  if (dialect === 'sqlite') {
    return true;
  }

  if (!dbName || typeof dbName !== 'string' || dbName.trim() === '') {
    const error = new Error(
      `[DB-SAFETY GUARD] FATAL: Test execution aborted! Database name is required for dialect '${dialect}' in test mode.`
    );
    error.code = 'UNSAFE_TEST_DATABASE_TARGET';
    throw error;
  }

  const normalizedDbName = dbName.trim().toLowerCase();

  // Check forbidden exact database names
  if (FORBIDDEN_TEST_DATABASES.includes(normalizedDbName)) {
    const error = new Error(
      `[DB-SAFETY GUARD] FATAL: Test execution aborted! Target database '${dbName}' is a protected development/production database. ` +
      `Tests are never permitted to target '${dbName}'. Please use a dedicated test database (e.g. 'workrank_realtime_test').`
    );
    error.code = 'UNSAFE_TEST_DATABASE_TARGET';
    throw error;
  }

  // Ensure database ends with an approved test suffix for network/disk DBMS (MySQL, PostgreSQL, etc.)
  const hasValidSuffix = ALLOWED_TEST_DB_SUFFIXES.some((suffix) => normalizedDbName.endsWith(suffix));
  if (!hasValidSuffix) {
    const error = new Error(
      `[DB-SAFETY GUARD] FATAL: Test execution aborted! Target database '${dbName}' does not end with an approved test suffix ` +
      `(${ALLOWED_TEST_DB_SUFFIXES.join(', ')}). Aborting to prevent accidental data loss.`
    );
    error.code = 'UNSAFE_TEST_DATABASE_TARGET';
    throw error;
  }

  return true;
}

module.exports = env;
module.exports.validateProductionConfig = validateProductionConfig;
module.exports.assertSafeTestDatabase = assertSafeTestDatabase;
module.exports.FORBIDDEN_TEST_DATABASES = FORBIDDEN_TEST_DATABASES;
module.exports.ALLOWED_TEST_DB_SUFFIXES = ALLOWED_TEST_DB_SUFFIXES;

