import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext();

export function AuthProvider({ children }) {
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

  return (
    <AuthContext.Provider value={{ user, setUser, socket, loading, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
