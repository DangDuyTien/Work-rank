'use strict';

// Real HTTP/Socket.IO server for browser acceptance, restricted to an isolated test DB.
if (process.env.NODE_ENV !== 'test') throw new Error('Typing browser fixtures require NODE_ENV=test');
const env = require('../../src/config/env');
if (env.db.dialect !== 'sqlite' || env.db.storage !== ':memory:') {
  throw new Error('Typing browser fixtures require an in-memory SQLite database');
}
const http = require('node:http');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const { sequelize, User, Season, TypingChallenge } = require('../../src/models');
const app = require('../../src/app');

(async () => {
  await sequelize.sync();
  const passwordHash = await bcrypt.hash('TypingAuditTest123!', 4);
  for (const suffix of ['a', 'b', 'spectator']) {
    await User.create({ name: `Typing Audit ${suffix.toUpperCase()}`, email: `typing-${suffix}@audit.test`, passwordHash, status: 'active', role: 'user' });
  }
  await Season.create({ name: 'Isolated Typing Audit', slug: 'typing-audit', status: 'ACTIVE', startAt: new Date(Date.now() - 86400000), endAt: new Date(Date.now() + 86400000) });
  await TypingChallenge.create({ title: 'Typing acceptance passage', language: 'VI', difficulty: 'MEDIUM', content: 'abcdef vị trí hiện tại giúp người chơi nhìn rõ từng ký tự và sửa lỗi chính xác '.repeat(80), isActive: true });
  await require('../../src/services/gameCatalog.service').getCatalog();
  const server = http.createServer(app);
  const io = new Server(server, require('../../src/config/socket'));
  app.set('io', io);
  require('../../src/services/competition/competitionRealtime.service').setIo(io);
  require('../../src/sockets')(io);
  server.listen(env.port, '127.0.0.1', () => console.log(`Isolated typing audit ready on ${env.port}`));
  process.on('SIGTERM', () => { io.close(); server.close(); sequelize.close().finally(() => process.exit(0)); });
})().catch((error) => { console.error(error); process.exit(1); });
