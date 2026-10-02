const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./config/env');
const socketOptions = require('./config/socket');
const registerSockets = require('./sockets');
const { sequelize } = require('./models');
const competitionRealtime = require('./services/competition/competitionRealtime.service');
const { ensureYouTubeSchema } = require('./services/youtube/youtubeSchemaCheck');

async function start() {
  await sequelize.authenticate();
  await ensureYouTubeSchema(sequelize);
  const server = http.createServer(app);
  const io = new Server(server, socketOptions);
  app.set('io', io);
  competitionRealtime.setIo(io);
  const gameRealtime = require('./services/gameRealtime.service');
  gameRealtime.setIo(io);
  const quizRealtime = require('./services/quizRealtime.service');
  quizRealtime.setIo(io);
  const samRealtime = require('./services/samRealtime.service');
  samRealtime.setIo(io);
  registerSockets(io);
  server.listen(env.port, '0.0.0.0', () => {
    console.log(`WorkRank backend listening on 0.0.0.0:${env.port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
