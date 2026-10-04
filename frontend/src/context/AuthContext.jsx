import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

import { setStoredAvatar, removeStoredAvatar } from '../utils/avatar';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const handleAuthExpired = (event) => {
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
      disconnectSocket();
      if (user && token) {
        setSocket(connectSocket(token));
      } else {
        if (!token) setUser(null);
        setSocket(null);
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

    const handleAuthRevoked = () => {
      auth.clearLocalSession();
      disconnectSocket();
      setSocket(null);
      setUser(null);
      sessionStorage.setItem('workrank_auth_notice', 'Tài khoản đã bị chấm dứt hoặc xóa.');
      navigate('/login', { replace: true });
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
      auth.clearLocalSession();
      disconnectSocket();
      setSocket(null);
      setUser(null);
      sessionStorage.setItem('workrank_auth_notice', 'Đã đăng xuất an toàn. Kết nối realtime đã được ngắt.');
      navigate('/login', { replace: true });
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, socket, loading, isAdmin: user?.role === 'admin', logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
