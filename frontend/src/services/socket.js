import { io } from 'socket.io-client';

let socket = null;

const isE2EMockEnabled = () => {
  return (
    typeof window !== 'undefined' &&
    window.__WR_E2E_TEST__ === true &&
    Boolean(window.__WR_SOCKET_MOCK__)
  );
};

export const connectSocket = (token) => {
  if (isE2EMockEnabled()) {
    socket = window.__WR_SOCKET_MOCK__;
    return socket;
  }
  if (socket) {
    socket.auth = { token, clientType: 'web' };
    if (!socket.connected) socket.connect();
    return socket;
  }
  socket = io(import.meta.env.VITE_API_URL || '', {
    auth: { token, clientType: 'web' },
  });
  return socket;
};

export const getSocket = () => {
  if (isE2EMockEnabled()) {
    return window.__WR_SOCKET_MOCK__;
  }
  return socket;
};

export const disconnectSocket = () => {
  if (isE2EMockEnabled()) {
    return;
  }
  if (socket) {
    if (typeof socket.disconnect === 'function') {
      socket.disconnect();
    }
    socket = null;
  }
};
