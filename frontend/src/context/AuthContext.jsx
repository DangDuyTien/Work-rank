import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth, setActiveReactUser, AUTH_CHANNEL_NAME } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import { clearCache } from '../services/cache';

import { setStoredAvatar, removeStoredAvatar } from '../utils/avatar';

const AuthContext = createContext(null);

// A profile is ready for the app when its canonical work identity is known.
// Keep this derived so refreshed user payloads immediately update the guard.
export function isProfileComplete(profile) {
  if (!profile) return false;
  if (profile.profileStatus === 'incomplete') return false;
  if (profile.profileStatus === 'complete') return true;
  return Boolean(profile.jobTitle && profile.department && profile.jobTitle !== 'Nhân viên');
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setActiveReactUser(user);
  }, [user]);

  const fetchMe = async () => {
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    if (!token && !refreshToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      if (!token && refreshToken) await auth.refreshSession();
      const res = await auth.me();
      setUser(res.data.user);
    } catch (err) {
      auth.clearLocalSession();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
    return () => disconnectSocket();
  }, []);

  // Cross-tab authentication synchronization (BroadcastChannel + storage event)
  useEffect(() => {
    let channel = null;
    try {
      if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
      }
    } catch {
      channel = null;
    }

    const handleBroadcastMessage = (event) => {
      const { type, userId, user: nextUser, token, message } = event.data || {};
      if (type === 'AUTH_LOGOUT') {
        clearCache();
        disconnectSocket();
        setSocket(null);
        setUser(null);
        sessionStorage.setItem('workrank_auth_notice', message || 'Đã đăng xuất từ tab khác.');
        if (location.pathname !== '/login') navigate('/login', { replace: true });
      } else if (type === 'AUTH_LOGIN') {
        // Differing user logged in on another tab
        const currentId = user ? String(user.id) : null;
        if (!currentId || currentId !== String(userId)) {
          clearCache();
          disconnectSocket();
          setSocket(null);
          if (nextUser) {
            setUser(nextUser);
          } else {
            fetchMe();
          }
        }
      } else if (type === 'AUTH_REFRESHED') {
        // Tokens refreshed in another tab
        if (token && socket) {
          socket.auth = { ...(socket.auth || {}), token, clientType: 'web' };
        }
      }
    };

    if (channel) {
      channel.onmessage = handleBroadcastMessage;
    }

    const handleStorage = (event) => {
      if (event.key === 'workrank_session' || event.key === 'token') {
        if (!event.newValue) {
          // Tokens removed -> logged out in another tab
          clearCache();
          disconnectSocket();
          setSocket(null);
          setUser(null);
          if (location.pathname !== '/login') navigate('/login', { replace: true });
        } else {
          // Token changed
          const storedUserId = localStorage.getItem('workrank_active_user_id');
          if (storedUserId && user && String(user.id) !== String(storedUserId)) {
            clearCache();
            disconnectSocket();
            setSocket(null);
            fetchMe();
          }
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    const handleAuthDrift = () => {
      // Identity drift detected by request interceptor
      fetchMe();
    };
    window.addEventListener('workrank:auth-drift-detected', handleAuthDrift);

    return () => {
      if (channel) {
        channel.close();
      }
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('workrank:auth-drift-detected', handleAuthDrift);
    };
  }, [user, socket, location.pathname, navigate]);

  useEffect(() => {
    const handleAuthExpired = (event) => {
      clearCache();
      auth.clearLocalSession();
      disconnectSocket();
      setSocket(null);
      setUser(null);
      sessionStorage.setItem(
        'workrank_auth_message',
        event.detail?.message || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
      );
      if (location.pathname !== '/login') navigate('/login', { replace: true });
    };
    window.addEventListener('workrank:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('workrank:auth-expired', handleAuthExpired);
  }, [location.pathname, navigate]);

  useEffect(() => {
    const handleAuthUpdated = (event) => {
      const token = event.detail?.token || localStorage.getItem('token');
      if (user && token) {
        setSocket(connectSocket(token));
      } else {
        if (!token) {
          setUser(null);
          disconnectSocket();
          setSocket(null);
        }
      }
    };
    window.addEventListener('workrank:auth-updated', handleAuthUpdated);
    return () => window.removeEventListener('workrank:auth-updated', handleAuthUpdated);
  }, [user]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (user && token) {
      const s = connectSocket(token);
      setSocket(s);
    } else if (!user) {
      setSocket(null);
      disconnectSocket();
    }
  }, [user]);

  // Real-time synchronization for user data & team propagation
  useEffect(() => {
    if (!socket) return;

    const handleUserUpdated = (payload) => {
      const targetId = String(payload?.userId || payload?.user?.id || '');
      const updatedData = payload?.user || {};

      // If current logged-in user was modified
      if (user && targetId === String(user.id)) {
        setUser((prev) => ({
          ...prev,
          ...updatedData,
          avatarData: updatedData.avatarData !== undefined ? updatedData.avatarData : prev.avatarData,
          jobTitle: updatedData.jobTitle !== undefined ? updatedData.jobTitle : prev.jobTitle,
          department: updatedData.department !== undefined ? updatedData.department : prev.department,
          isVerified: updatedData.isVerified !== undefined ? updatedData.isVerified : prev.isVerified,
          isDev: updatedData.isDev !== undefined ? updatedData.isDev : prev.isDev,
          teamId: updatedData.teamId !== undefined ? updatedData.teamId : prev.teamId,
          teamName: updatedData.teamName !== undefined ? updatedData.teamName : prev.teamName,
        }));

        if (updatedData.avatarData) {
          setStoredAvatar(user.id, updatedData.avatarData);
        } else if (updatedData.avatarData === null) {
          removeStoredAvatar(user.id);
        }
      }

      // Propagate globally for components, tables, sidebars, leaderboards
      window.dispatchEvent(new CustomEvent('workrank:user-updated', { detail: payload }));
    };

    const handleTeamMembershipUpdated = (payload) => {
      const targetId = String(payload?.userId || '');
      if (user && targetId === String(user.id)) {
        setUser((prev) => ({
          ...prev,
          teamId: payload.newTeamId,
          teamName: payload.teamName || null,
        }));
      }
      window.dispatchEvent(new CustomEvent('workrank:team-updated', { detail: payload }));
    };

    const handleAuthRevoked = (payload = {}) => {
      clearCache();
      auth.clearLocalSession({ message: payload?.message || 'Tài khoản hoặc phiên làm việc đã bị thu hồi.' });
      disconnectSocket();
      setSocket(null);
      setUser(null);
      sessionStorage.setItem('workrank_auth_notice', payload?.message || 'Tài khoản đã bị chấm dứt hoặc xóa.');
      if (location.pathname !== '/login') navigate('/login', { replace: true });
    };

    socket.on('user:updated', handleUserUpdated);
    socket.on('team:membership:updated', handleTeamMembershipUpdated);
    socket.on('auth:revoked', handleAuthRevoked);

    return () => {
      socket.off('user:updated', handleUserUpdated);
      socket.off('team:membership:updated', handleTeamMembershipUpdated);
      socket.off('auth:revoked', handleAuthRevoked);
    };
  }, [socket, user, navigate]);

  const logout = async (skipBackendCall = false) => {
    try {
      if (!skipBackendCall && localStorage.getItem('token')) {
        await auth.logout().catch(() => {});
      }
    } finally {
      clearCache();
      auth.clearLocalSession();
      disconnectSocket();
      setSocket(null);
      setUser(null);
      sessionStorage.setItem('workrank_auth_notice', 'Đã đăng xuất an toàn. Kết nối realtime đã được ngắt.');
      if (location.pathname !== '/login') navigate('/login', { replace: true });
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, socket, loading, isAdmin: user?.role === 'admin', isProfileComplete: isProfileComplete(user), logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được gọi bên trong AuthProvider.');
  }
  return context;
}
