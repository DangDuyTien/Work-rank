import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
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
const Register = lazyWithReload(() => import('./pages/Register'));
const Award = lazyWithReload(() => import('./pages/Award'));
const Home = lazyWithReload(() => import('./pages/Home'));
const Dashboard = lazyWithReload(() => import('./pages/Dashboard'));
const Leaderboard = lazyWithReload(() => import('./pages/Leaderboard'));
const UserDetail = lazyWithReload(() => import('./pages/UserDetail'));
const Friends = lazyWithReload(() => import('./pages/Friends'));
const Settings = lazyWithReload(() => import('./pages/Settings'));
const AdminPrivileges = lazyWithReload(() => import('./pages/AdminPrivileges'));
const CompetitionAdmin = lazyWithReload(() => import('./pages/CompetitionAdmin'));
const AdminSeasons = lazyWithReload(() => import('./pages/AdminSeasons'));
const AdminGrand = lazyWithReload(() => import('./pages/AdminGrand'));
const AdminTeamsYouTube = lazyWithReload(() => import('./pages/AdminTeamsYouTube'));
const AdminOperations = lazyWithReload(() => import('./pages/AdminOperations'));
const Arena = lazyWithReload(() => import('./pages/Arena'));
const GrandHub = lazyWithReload(() => import('./pages/GrandHub'));
const YouTubeOverview = lazyWithReload(() => import('./pages/YouTubeOverview'));
const CapitalBoardGame = lazyWithReload(() => import('./pages/CapitalBoardGame'));
const QuizGame = lazyWithReload(() => import('./pages/QuizGame'));
const Game2048 = lazyWithReload(() => import('./pages/Game2048'));
const SamGame = lazyWithReload(() => import('./pages/SamGame'));


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
          <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, lineHeight: 1.25, color: '#0f172a' }}>Không tải được giao diện</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14, lineHeight: 1.55 }}>
            Trình duyệt có thể đang giữ bản build cũ. Tải lại trang sẽ lấy bundle mới nhất.
          </p>
          <div style={{ marginTop: 14, padding: 10, borderRadius: 0, background: 'rgba(15,23,42,0.04)', color: '#475569', fontSize: 12, wordBreak: 'break-word' }}>
            {message}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ border: 'none', borderRadius: 0, background: '#38bdf8', color: '#ffffff', padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
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
              style={{ border: '1px solid rgba(15,23,42,0.12)', borderRadius: 0, background: '#ffffff', color: '#0f172a', padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Đăng nhập lại
            </button>
          </div>
        </div>
      </div>
    );
  }
}

function AnimatedAppRoutes() {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState('none'); // 'none' | 'fadeIn' | 'fadeOut'

  useEffect(() => {
    // Cinematic exit/enter transitions
    const isToOrFromHome = location.pathname === '/' || displayLocation.pathname === '/';
    const isEnteringGame = !displayLocation.pathname.startsWith('/games') && location.pathname.startsWith('/games');
    const isExitingGame = displayLocation.pathname.startsWith('/games') && !location.pathname.startsWith('/games');

    if (location.pathname !== displayLocation.pathname) {
      if (isToOrFromHome) {
        setTransitionStage('fadeOut');
        const timer = setTimeout(() => {
          setDisplayLocation(location);
          setTransitionStage('fadeIn');
          window.scrollTo(0, 0);
        }, 180);
        return () => clearTimeout(timer);
      } else if (isEnteringGame) {
        // App contents & navigation slide/fade out into full viewport game surface
        setTransitionStage('appToGameExit');
        const timer = setTimeout(() => {
          setDisplayLocation(location);
          setTransitionStage('none');
          window.scrollTo(0, 0);
        }, 280);
        return () => clearTimeout(timer);
      } else if (isExitingGame) {
        // Navigation slides back in and app content expands smoothly
        setDisplayLocation(location);
        setTransitionStage('appFromGameEnter');
        const timer = setTimeout(() => {
          setTransitionStage('none');
        }, 360);
        return () => clearTimeout(timer);
      } else {
        // Internal page navigation (inside dashboard / authenticated app): instant switch with NO flicker
        setDisplayLocation(location);
        setTransitionStage('none');
      }
    } else if (location.search !== displayLocation.search) {
      setDisplayLocation(location);
    }
  }, [location, displayLocation]);

  const transitionClass =
    transitionStage === 'fadeOut'
      ? 'wr-page-exit'
      : transitionStage === 'fadeIn'
      ? 'wr-page-enter'
      : transitionStage === 'appToGameExit'
      ? 'wr-app-to-game-exit'
      : transitionStage === 'appFromGameEnter'
      ? 'wr-app-from-game-enter'
      : '';

  return (
    <div
      className={`wr-route-transition-container ${transitionClass}`}
    >
      <Suspense fallback={<PageFallback />}>
        <Routes location={displayLocation}>
          <Route path="/" element={<Home />} />
          <Route path="/award" element={<Award />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/youtube" element={<YouTubeOverview />} />
            <Route path="/arena" element={<Arena />} />
            <Route path="/grand" element={<GrandHub />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/rankings" element={<Leaderboard />} />

            <Route path="/groups" element={<Navigate to="/friends" replace />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/games" element={<Navigate to="/dashboard" replace />} />
            <Route path="/games/guess" element={<Navigate to="/games/quiz" replace />} />
            <Route path="/tracker" element={<Navigate to="/dashboard" replace />} />
            <Route path="/pomodoro" element={<Navigate to="/dashboard" replace />} />
            <Route path="/performance" element={<Navigate to="/dashboard" replace />} />
            <Route path="/security" element={<Navigate to="/dashboard" replace />} />
            <Route path="/admin/privileges" element={<AdminRoute><AdminPrivileges /></AdminRoute>} />
            <Route path="/admin/teams-youtube" element={<AdminRoute><AdminTeamsYouTube /></AdminRoute>} />
            <Route path="/admin/competition" element={<Navigate to="/admin/competition/seasons" replace />} />
            <Route path="/admin/competition/seasons" element={<AdminRoute><AdminSeasons /></AdminRoute>} />
            <Route path="/admin/competition/grand" element={<AdminRoute><AdminGrand /></AdminRoute>} />
            <Route path="/admin/operations" element={<AdminRoute><AdminOperations /></AdminRoute>} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/users/:id" element={<UserDetail />} />
          </Route>
          {/* Full-bleed Standalone Game Routes */}
          <Route
            path="/games/2048"
            element={
              <ProtectedRoute>
                <Game2048 />
              </ProtectedRoute>
            }
          />
          <Route
            path="/games/capital-board"
            element={
              <ProtectedRoute>
                <CapitalBoardGame />
              </ProtectedRoute>
            }
          />
          <Route
            path="/games/capital-board/room/:roomId"
            element={
              <ProtectedRoute>
                <CapitalBoardGame />
              </ProtectedRoute>
            }
          />
          <Route
            path="/games/quiz"
            element={
              <ProtectedRoute>
                <QuizGame />
              </ProtectedRoute>
            }
          />
          <Route
            path="/games/quiz/room/:roomId"
            element={
              <ProtectedRoute>
                <QuizGame />
              </ProtectedRoute>
            }
          />
          <Route
            path="/games/sam"
            element={
              <ProtectedRoute>
                <SamGame />
              </ProtectedRoute>
            }
          />
          <Route
            path="/games/sam/room/:roomId"
            element={
              <ProtectedRoute>
                <SamGame />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <UiProvider>
        <AuthProvider>
          <AppErrorBoundary>
            <AnimatedAppRoutes />
          </AppErrorBoundary>
        </AuthProvider>
      </UiProvider>
    </BrowserRouter>
  );
}
