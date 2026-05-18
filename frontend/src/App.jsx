import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TrackingProvider } from './context/TrackingContext';
import { UiProvider } from './context/UiContext';
import Layout from './components/Layout';

const CHUNK_RELOAD_KEY = 'workrank:chunk-reload-attempted';

function isChunkLoadError(error) {
  const message = String(error?.message || error || '');
  return error?.name === 'ChunkLoadError'
    || /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically imported module/i.test(message);
}

function lazyWithReload(importer) {
  return lazy(async () => {
    try {
      const mod = await importer();
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      return mod;
    } catch (error) {
      if (isChunkLoadError(error) && sessionStorage.getItem(CHUNK_RELOAD_KEY) !== '1') {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }
  });
}

const Login = lazyWithReload(() => import('./pages/Login'));
const Home = lazyWithReload(() => import('./pages/Home'));
const Dashboard = lazyWithReload(() => import('./pages/Dashboard'));
const Tracker = lazyWithReload(() => import('./pages/Tracker'));
const Leaderboard = lazyWithReload(() => import('./pages/Leaderboard'));
const UserDetail = lazyWithReload(() => import('./pages/UserDetail'));
const Groups = lazyWithReload(() => import('./pages/Groups'));
const Friends = lazyWithReload(() => import('./pages/Friends'));
const Security = lazyWithReload(() => import('./pages/Security'));
const Settings = lazyWithReload(() => import('./pages/Settings'));
const AdminPrivileges = lazyWithReload(() => import('./pages/AdminPrivileges'));
const Pomodoro = lazyWithReload(() => import('./pages/Pomodoro'));
const Performance = lazyWithReload(() => import('./pages/Performance'));

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageFallback text="Đang kiểm tra phiên đăng nhập..." />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <PageFallback text="Đang kiểm tra quyền truy cập..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
};

const PageFallback = ({ text = 'Đang tải...' }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#64748b', fontSize: 14 }}>
    {text}
  </div>
);

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('WorkRank UI crashed:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const message = String(this.state.error?.message || 'Không xác định');
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f8fafc' }}>
        <div style={{ width: 'min(460px, 100%)', background: '#ffffff', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 0, boxShadow: 'none', padding: 24 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 22, color: '#0f172a' }}>Không tải được giao diện</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14, lineHeight: 1.6 }}>
            Trình duyệt có thể đang giữ bản build cũ. Tải lại trang sẽ lấy bundle mới nhất.
          </p>
          <div style={{ marginTop: 14, padding: 10, borderRadius: 0, background: 'rgba(15,23,42,0.04)', color: '#475569', fontSize: 12, wordBreak: 'break-word' }}>
            {message}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ border: 'none', borderRadius: 0, background: '#38bdf8', color: '#ffffff', padding: '10px 14px', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}
            >
              Tải lại trang
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                window.location.href = '/login';
              }}
              style={{ border: '1px solid rgba(15,23,42,0.12)', borderRadius: 0, background: '#ffffff', color: '#0f172a', padding: '10px 14px', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}
            >
              Đăng nhập lại
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <UiProvider>
        <AuthProvider>
          <AppErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <TrackingProvider>
                        <Layout />
                      </TrackingProvider>
                    </ProtectedRoute>
                  }
                >
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/groups" element={<Groups />} />
                  <Route path="/friends" element={<Friends />} />
                  <Route path="/tracker" element={<Tracker />} />
                  <Route path="/pomodoro" element={<Pomodoro />} />
                  <Route path="/performance" element={<Performance />} />
                  <Route path="/security" element={<AdminRoute><Security /></AdminRoute>} />
                  <Route path="/admin/privileges" element={<AdminRoute><AdminPrivileges /></AdminRoute>} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/users/:id" element={<UserDetail />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </AppErrorBoundary>
        </AuthProvider>
      </UiProvider>
    </BrowserRouter>
  );
}
