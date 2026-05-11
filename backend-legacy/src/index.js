require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const setupSocket = require('./sockets');

const authRoutes = require('./routes/auth');
const activityRoutes = require('./routes/activity');
const leaderboardRoutes = require('./routes/leaderboard');
const userRoutes = require('./routes/users');
const groupRoutes = require('./routes/groups');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  req.app.set('io', io);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

setupSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WorkRank Backend running on http://localhost:${PORT}`);
});
