const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./config/env');
const socketOptions = require('./config/socket');
const registerSockets = require('./sockets');
const { sequelize } = require('./models');

async function start() {
  await sequelize.authenticate();
  const server = http.createServer(app);
  const io = new Server(server, socketOptions);
  app.set('io', io);
  registerSockets(io);
  server.listen(env.port, () => console.log(`WorkRank backend listening on ${env.port}`));
}

start().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
