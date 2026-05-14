import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

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

  const logout = async () => {
    try {
      await auth.logout();
    } finally {
      disconnectSocket();
      setSocket(null);
      setUser(null);
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
