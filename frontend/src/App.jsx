import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TrackingProvider } from './context/TrackingContext';
import { UiProvider } from './context/UiContext';
import Layout from './components/Layout';
import { Construction } from 'lucide-react';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Tracker = lazy(() => import('./pages/Tracker'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const UserDetail = lazy(() => import('./pages/UserDetail'));
const Groups = lazy(() => import('./pages/Groups'));
const Friends = lazy(() => import('./pages/Friends'));
const Security = lazy(() => import('./pages/Security'));
const Settings = lazy(() => import('./pages/Settings'));
const AdminPrivileges = lazy(() => import('./pages/AdminPrivileges'));

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
    <Construction size={48} color="#f59e0b" />
    <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>{title}</h2>
    <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>Chức năng đang được hoàn thiện</p>
  </div>
);

const PageFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#64748b', fontSize: 14 }}>
    Đang tải...
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <UiProvider>
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
                <Route path="leaderboard" element={<Leaderboard />} />
                <Route path="groups" element={<Groups />} />
                <Route path="friends" element={<Friends />} />
                <Route path="tracker" element={<Tracker />} />
                <Route path="performance" element={<ComingSoon title="Phân Tích Hiệu Suất" />} />
                <Route path="security" element={<AdminRoute><Security /></AdminRoute>} />
                <Route path="admin/privileges" element={<AdminRoute><AdminPrivileges /></AdminRoute>} />
                <Route path="settings" element={<Settings />} />
                <Route path="users/:id" element={<UserDetail />} />
              </Route>
            </Routes>
          </Suspense>
        </AuthProvider>
      </UiProvider>
    </BrowserRouter>
  );
}
