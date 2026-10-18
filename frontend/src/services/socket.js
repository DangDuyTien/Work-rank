import { io } from 'socket.io-client';
import { auth } from './api';

let socket = null;
let currentSocketToken = null;
let isRefreshingSocket = false;

const isE2EMockEnabled = () => {
  return (
    typeof window !== 'undefined' &&
    window.__WR_E2E_TEST__ === true &&
    Boolean(window.__WR_SOCKET_MOCK__)
  );
};

function setupSocketErrorHandlers(s) {
  if (!s || typeof s.on !== 'function') return;

  s.on('connect_error', async (err) => {
    const msg = String(err?.message || '');
    if (
      msg.includes('Unauthorized') ||
      msg.includes('jwt expired') ||
      msg.includes('Invalid') ||
      msg.includes('Missing token')
    ) {
      if (isRefreshingSocket) return;
      isRefreshingSocket = true;
      try {
        const newToken = await auth.refreshSession();
        if (s && newToken) {
          s.auth = { token: newToken, clientType: 'web' };
          currentSocketToken = newToken;
          s.connect();
        }
      } catch {
        auth.clearLocalSession({
          expired: true,
          message: 'Phiên kết nối realtime đã hết hạn. Vui lòng đăng nhập lại.',
        });
      } finally {
        isRefreshingSocket = false;
      }
    }
  });
}

export const connectSocket = (token) => {
  if (isE2EMockEnabled()) {
    socket = window.__WR_SOCKET_MOCK__;
    return socket;
  }

  if (socket) {
    if (currentSocketToken !== token) {
      currentSocketToken = token;
      socket.auth = { token, clientType: 'web' };
      if (socket.connected) {
        socket.disconnect();
      }
      socket.connect();
      return socket;
    }

    socket.auth = { token, clientType: 'web' };
    if (!socket.connected) socket.connect();
    return socket;
  }

  currentSocketToken = token;
  socket = io((typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '', {
    auth: { token, clientType: 'web' },
  });

  setupSocketErrorHandlers(socket);

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
    currentSocketToken = null;
    isRefreshingSocket = false;
  }
};
