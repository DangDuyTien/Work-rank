import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TrackingProvider } from './context/TrackingContext';
import Layout from './components/Layout';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Tracker = lazy(() => import('./pages/Tracker'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const UserDetail = lazy(() => import('./pages/UserDetail'));
const Groups = lazy(() => import('./pages/Groups'));
const Security = lazy(() => import('./pages/Security'));

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
};

// Placeholder pages for sidebar nav items
const ComingSoon = ({ title }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
    <div style={{ fontSize: 48 }}>🚧</div>
    <h2 style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', margin: 0 }}>{title}</h2>
    <p style={{ fontSize: 14, color: '#4b5563', margin: 0 }}>Coming soon — under construction</p>
  </div>
);

const PageFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#4b5563', fontSize: 14 }}>
    Đang tải...
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <TrackingProvider>
                    <Layout />
                  </TrackingProvider>
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="tracker" element={<Tracker />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="groups" element={<Groups />} />
              <Route path="performance" element={<ComingSoon title="Performance Analytics" />} />
              <Route path="security" element={<AdminRoute><Security /></AdminRoute>} />
              <Route path="settings" element={<ComingSoon title="Settings" />} />
              <Route path="users/:id" element={<UserDetail />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
