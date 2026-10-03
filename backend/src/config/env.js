const dotenv = require('dotenv');

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5001),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'change-me-access-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'change-me-refresh-secret',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
  competitionProcessingEnabled: process.env.COMPETITION_PROCESSING_ENABLED !== 'false',
  competitionShadowMode: process.env.COMPETITION_SHADOW_MODE === 'true',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    name: process.env.DB_NAME || 'workrank_realtime',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    dialect: process.env.DB_DIALECT || (process.env.NODE_ENV === 'test' ? 'sqlite' : 'mysql'),
    storage: process.env.DB_STORAGE || (process.env.NODE_ENV === 'test' ? ':memory:' : undefined),
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

module.exports = env;
module.exports.validateProductionConfig = validateProductionConfig;

