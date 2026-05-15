const { Sequelize } = require('sequelize');
const fs = require('fs');
const env = require('./env');

function buildDialectOptions() {
  if (!env.db.ssl) return {};

  const ssl = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: env.db.sslRejectUnauthorized,
  };

  if (env.db.sslCaPath) {
    ssl.ca = fs.readFileSync(env.db.sslCaPath);
  }

  return { ssl };
}

const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: env.db.dialect,
  dialectOptions: buildDialectOptions(),
  logging: env.db.logging,
  define: {
    underscored: true,
    timestamps: true,
  },
});

module.exports = sequelize;
