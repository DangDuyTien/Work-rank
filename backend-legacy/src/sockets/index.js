const jwt = require('jsonwebtoken');

const setupSocket = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.name} connected`);
    socket.join(`user:${socket.user.id}`);

    socket.on('disconnect', () => {
      console.log(`User ${socket.user.name} disconnected`);
    });
  });
};

module.exports = setupSocket;
