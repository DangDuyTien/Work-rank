import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UiProvider } from './context/UiContext';
import Layout from './components/Layout';
import { normalizeRankingParams } from './config/ranking';

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
const AdminQuiz = lazyWithReload(() => import('./pages/AdminQuiz'));
const Game2048 = lazyWithReload(() => import('./pages/Game2048'));
const SamGame = lazyWithReload(() => import('./pages/SamGame'));
const TypingBattle = lazyWithReload(() => import('./pages/TypingBattle'));
const DrawingGame = lazyWithReload(() => import('./pages/DrawingGame'));
const GameHub = lazyWithReload(() => import('./pages/GameHub'));
const AdminKpi = lazyWithReload(() => import('./pages/AdminKpi'));


const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageFallback text="Đang kiểm tra phiên đăng nhập..." />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <PageFallback text="Đang kiểm tra quyền truy cập..." />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
};

function CanonicalRedirect({ to, ranking = false }) {
  const location = useLocation();
  const search = ranking ? `?${normalizeRankingParams(location.search)}` : location.search;
  return <Navigate to={{ pathname: to, search, hash: location.hash }} replace state={location.state} />;
}

const PageFallback = ({ text = 'Đang tải...' }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)', fontSize: 14 }}>
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

  componentDidUpdate(previousProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error, info) {
    console.error('WorkRank UI crashed:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const message = String(this.state.error?.message || 'Không xác định');
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--surface-soft)' }}>
        <div style={{ width: 'min(460px, 100%)', background: 'var(--surface)', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 0, boxShadow: 'none', padding: 24 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, lineHeight: 1.25, color: 'var(--text-primary)' }}>Không tải được giao diện</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.55 }}>
            Trình duyệt có thể đang giữ bản build cũ. Tải lại trang sẽ lấy bundle mới nhất.
          </p>
          <div style={{ marginTop: 14, padding: 10, borderRadius: 0, background: 'rgba(15,23,42,0.04)', color: 'var(--text-secondary)', fontSize: 12, wordBreak: 'break-word' }}>
            {message}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ border: 'none', borderRadius: 0, background: 'var(--accent)', color: 'var(--accent-foreground)', padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
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
              style={{ border: '1px solid rgba(15,23,42,0.12)', borderRadius: 0, background: 'var(--surface)', color: 'var(--text-primary)', padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Đăng nhập lại
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// A failed route should not poison the whole application after the user moves
// to another history entry. Remounting the boundary for each location gives
// the next route a clean render attempt while preserving the error fallback
// for repeated failures on the same entry.
function RouteErrorBoundary({ children }) {
  const location = useLocation();
  const resetKey = `${location.key}:${location.pathname}:${location.search}`;
  return (
    <AppErrorBoundary key={location.pathname === '/login' ? '/login' : resetKey} resetKey={resetKey}>
      {children}
    </AppErrorBoundary>
  );
}

function AppRoutes() {
  return (
    <div className="wr-route-transition-container">
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/kpi" element={<CanonicalRedirect to="/dashboard" />} />
            <Route path="/activity" element={<Navigate to="/dashboard" replace />} />
            <Route path="/tracking" element={<Navigate to="/dashboard" replace />} />
            <Route path="/productivity" element={<Navigate to="/dashboard" replace />} />
            <Route path="/activity-ranking" element={<CanonicalRedirect to="/leaderboard" ranking />} />
            <Route path="/activity-leaderboard" element={<CanonicalRedirect to="/leaderboard" ranking />} />
            <Route path="/youtube" element={<YouTubeOverview />} />
            <Route path="/arena" element={<Arena />} />
            <Route path="/grand" element={<GrandHub />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/rankings" element={<CanonicalRedirect to="/leaderboard" ranking />} />
            <Route path="/admin/kpi" element={<AdminRoute><AdminKpi /></AdminRoute>} />
            <Route path="/admin/departments" element={<Navigate to="/admin/kpi" replace />} />

            <Route path="/groups" element={<Navigate to="/friends" replace />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/games" element={<GameHub />} />
            <Route path="/games/guess" element={<Navigate to="/games/quiz" replace />} />
            <Route path="/games/2048" element={<Game2048 />} />
            <Route path="/games/capital-board" element={<CapitalBoardGame />} />
            <Route path="/games/capital-board/room/:roomId" element={<CapitalBoardGame />} />
            <Route path="/games/quiz" element={<QuizGame />} />
            <Route path="/games/quiz/room/:roomId" element={<QuizGame />} />
            <Route path="/games/sam" element={<SamGame />} />
            <Route path="/games/sam/room/:roomId" element={<SamGame />} />
            <Route path="/games/typing" element={<TypingBattle />} />
            <Route path="/games/typing/room/:roomId" element={<TypingBattle />} />
            <Route path="/games/drawing" element={<DrawingGame />} />
            <Route path="/admin/quiz" element={<AdminRoute><AdminQuiz /></AdminRoute>} />
            <Route path="/admin/games/quiz" element={<Navigate to="/admin/quiz" replace />} />
            <Route path="/admin/privileges" element={<AdminRoute><AdminPrivileges /></AdminRoute>} />
            <Route path="/admin/teams-youtube" element={<AdminRoute><AdminTeamsYouTube /></AdminRoute>} />
            <Route path="/admin/competition" element={<Navigate to="/admin/competition/seasons" replace />} />
            <Route path="/admin/competition/rules" element={<AdminRoute><CompetitionAdmin /></AdminRoute>} />
            <Route path="/admin/competition/seasons" element={<AdminRoute><AdminSeasons /></AdminRoute>} />
            <Route path="/admin/competition/grand" element={<AdminRoute><AdminGrand /></AdminRoute>} />
            <Route path="/admin/operations" element={<AdminRoute><AdminOperations /></AdminRoute>} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/users/:id" element={<UserDetail />} />
          </Route>
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
          <RouteErrorBoundary>
            <AppRoutes />
          </RouteErrorBoundary>
        </AuthProvider>
      </UiProvider>
    </BrowserRouter>
  );
}
