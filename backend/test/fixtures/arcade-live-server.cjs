'use strict';
// Never touches the working database: real HTTP and sockets over disposable SQLite.
if (process.env.NODE_ENV !== 'test') throw new Error('Arcade fixture requires NODE_ENV=test');
const env = require('../../src/config/env');
if (env.db.dialect !== 'sqlite' || env.db.storage !== ':memory:') throw new Error('Arcade fixture requires in-memory SQLite');
const http = require('node:http');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const { sequelize, User, Season, TypingChallenge } = require('../../src/models');
const app = require('../../src/app');
const fixture = require('express')();
fixture.use(require('express').urlencoded({ extended: false }));
fixture.get('/api/__arcade-fixture', (req, res) => res.type('html').send('<h1>WorkRank Arcade · isolated QA</h1><form method="post" action="/api/__arcade-fixture"><button>Đăng nhập tài khoản QA Telex</button></form>'));
fixture.post('/api/__arcade-fixture', async (req, res) => {
  const user = await User.findOne({ where: { email: 'arcade-native@audit.test' } });
  const token = require('jsonwebtoken').sign({ sub: user.id, tokenVersion: user.tokenVersion }, env.jwtSecret, { expiresIn: '1h' });
  res.type('html').send(`<script>localStorage.setItem('token',${JSON.stringify(token)});location.href='/games/arcade/computer_rush';</script>`);
});
fixture.use(app);
(async () => {
  await sequelize.sync();
  const passwordHash = await bcrypt.hash('ArcadeAuditTest123!', 4);
  for (const [suffix, name] of [['a', 'Lan'], ['b', 'Minh'], ['c', 'Huy'], ['native', 'Telex QA'], ['d', 'An'], ['e', 'Bình'], ['f', 'Chi'], ['g', 'Đạt'], ['h', 'Giang'], ['i', 'Hà']]) await User.create({ name, email: `arcade-${suffix}@audit.test`, passwordHash, status: 'active', role: 'user' });
  await Season.create({ name: 'Isolated Arcade Audit', slug: 'arcade-audit', status: 'ACTIVE', startAt: new Date(Date.now() - 86400000), endAt: new Date(Date.now() + 86400000) });
  await TypingChallenge.create({ title: 'Unified arcade typing passage', language: 'VI', difficulty: 'MEDIUM', content: 'cùng nhau học hỏi từng ngày giữ nhịp thật đều nhìn rõ từng chữ sửa lỗi rồi tiếp tục cuộc đua '.repeat(30), isActive: true });
  await require('../../src/services/gameCatalog.service').getCatalog();
  const server = http.createServer(fixture), io = new Server(server, require('../../src/config/socket'));
  app.set('io', io); require('../../src/sockets')(io);
  server.listen(env.port, '127.0.0.1', () => console.log(`Isolated arcade audit ready on ${env.port}`));
  const close = () => { require('../../src/services/arcade.service').stop(); io.close(); server.close(); sequelize.close().finally(() => process.exit(0)); };
  process.on('SIGTERM', close); process.on('SIGINT', close);
})().catch((e) => { console.error(e); process.exit(1); });
