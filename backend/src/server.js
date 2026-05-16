const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./config/env');
const socketOptions = require('./config/socket');
const registerSockets = require('./sockets');
const { sequelize } = require('./models');
const simulationService = require('./services/simulation.service');
const retentionService = require('./services/retention.service');

async function start() {
  await sequelize.authenticate();
  const server = http.createServer(app);
  const io = new Server(server, socketOptions);
  app.set('io', io);
  registerSockets(io);
  server.listen(env.port, () => {
    console.log(`WorkRank backend listening on ${env.port}`);
    retentionService.startRetentionJobs();
    simulationService.restorePersistedState({ io }).catch((error) => {
      console.error('Failed to restore simulation state', error);
    });
  });
}

start().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
