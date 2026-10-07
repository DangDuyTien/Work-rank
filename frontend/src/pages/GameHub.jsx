import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gamepad2,
  LayoutGrid,
  Sparkles,
  Club,
  Keyboard,
  Play,
  Clock,
  Shield,
  Settings,
  RefreshCw,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { gameCatalogApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PageShell, PageHeader, Card, Button, PageState, EmptyState } from '../components/ui';

const GAME_ICONS = {
  typing_battle: Keyboard,
  typing: Keyboard,
  capital_board: Gamepad2,
  game_2048: LayoutGrid,
  quiz: Sparkles,
  sam: Club,
};

const DEFAULT_GAMES = [
  {
    gameKey: 'typing_battle',
    name: 'WorkRank Typing Battle',
    status: 'AVAILABLE',
    description: 'Đấu trường thi đấu đánh máy tốc độ cao, realtime 1v1, 2v2, 3v3 tích hợp trực tiếp BXH công ty.',
    icon: 'Keyboard',
    route: '/games/typing',
  },
  {
    gameKey: 'capital_board',
    name: 'Cờ Tỷ Phú',
    status: 'AVAILABLE',
    description: 'Trò chơi bàn cờ tỷ phú kinh doanh và đầu tư bất động sản thời gian thực.',
    icon: 'Gamepad2',
    route: '/games/capital-board',
  },
  {
    gameKey: 'game_2048',
    name: '2048',
    status: 'AVAILABLE',
    description: 'Trò chơi ghép số 2048 trí tuệ, thử thách tư duy và bảng xếp hạng công ty.',
    icon: 'LayoutGrid',
    route: '/games/2048',
  },
  {
    gameKey: 'sam',
    name: 'Đánh Sâm',
    status: 'AVAILABLE',
    description: 'Trò chơi bài dân gian Đánh Sâm 2–4 người thời gian thực kịch tính.',
    icon: 'Club',
    route: '/games/sam',
  },
  {
    gameKey: 'quiz',
    name: 'Đoán Hình & Đoán Nhạc',
    status: 'AVAILABLE',
    description: 'Mini game đoán hình ảnh & đoán bài hát tốc độ cao nhiều người chơi.',
    icon: 'Sparkles',
    route: '/games/quiz',
  },
];

export default function GameHub() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [games, setGames] = useState(DEFAULT_GAMES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCatalog = useCallback(async () => {
    try {
      setError(null);
      const res = await gameCatalogApi.getCatalog();
      if (res && Array.isArray(res.games)) {
        const merged = DEFAULT_GAMES.map((def) => {
          const serverGame = res.games.find((g) => (g.gameKey || g.game_key) === def.gameKey);
          if (!serverGame) return def;
          return {
            ...def,
            ...serverGame,
            route: serverGame.route || def.route || (def.gameKey === 'capital_board' ? '/games/capital-board' : `/games/${def.gameKey}`),
          };
        });

        res.games.forEach((g) => {
          const key = g.gameKey || g.game_key;
          if (key && !DEFAULT_GAMES.some((d) => d.gameKey === key)) {
            merged.push({
              gameKey: key,
              name: g.name,
              status: g.status || 'AVAILABLE',
              description: g.description || '',
              route: g.route || `/games/${key}`,
              enabled: g.enabled !== false,
            });
          }
        });

        setGames(merged);
      }
    } catch (err) {
      // Keep defaults if fetch fails
      console.warn('Failed to load game catalog, using default catalog list:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const availableGames = games.filter((g) => g.status === 'AVAILABLE' && g.enabled !== false);
  const comingSoonGames = games.filter((g) => g.status === 'COMING_SOON' || g.enabled === false);

  if (loading) {
    return (
      <PageShell>
        <PageState type="loading" message="Đang tải danh mục trò chơi..." />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        kicker="Trung Tâm Giải Trí & Đấu Trí"
        title="Danh Mục Trò Chơi WorkRank"
        description="Khám phá các trò chơi tương tác bàn cờ kinh doanh, ghép số trí tuệ và đấu bài dân gian thời gian thực."
        actions={
          isAdmin && (
            <Button
              variant="secondary"
              onClick={() => navigate('/settings?tab=games')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Settings size={15} />
              Quản lý trạng thái game
            </Button>
          )
        }
      />

      {/* ── SECTION 1: ĐANG CÓ THỂ CHƠI ── */}
      <section style={{ marginBottom: 40 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            borderBottom: '1px solid rgba(15,23,42,0.08)',
            paddingBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#16a34a',
                display: 'inline-block',
              }}
            />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              ĐANG CÓ THỂ CHƠI
            </h2>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                background: 'var(--surface-muted)',
                padding: '2px 8px',
                borderRadius: 2,
              }}
            >
              {availableGames.length}
            </span>
          </div>
        </div>

        {availableGames.length === 0 ? (
          <EmptyState
            title="Chưa có trò chơi nào sẵn sàng"
            description="Tất cả trò chơi hiện đang trong giai đoạn cập nhật hoặc bảo trì."
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 20,
            }}
          >
            {availableGames.map((game) => {
              const Icon = GAME_ICONS[game.gameKey] || Gamepad2;
              return (
                <div
                  key={game.gameKey}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid rgba(15,23,42,0.1)',
                    borderRadius: 'var(--radius-content)',
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'border-color var(--motion-fast) var(--ease-standard), box-shadow var(--motion-fast) var(--ease-standard)',
                  }}
                  className="hover:border-slate-400 hover:shadow-sm"
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        marginBottom: 16,
                      }}
                    >
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          background: 'var(--info-soft)',
                          border: '1px solid var(--info-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--info)',
                        }}
                      >
                        <Icon size={24} strokeWidth={2.2} />
                      </div>
                      <span
                        style={{
                          padding: '3px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: 'rgba(34,197,94,0.12)',
                          color: '#16a34a',
                          border: '1px solid rgba(34,197,94,0.3)',
                        }}
                      >
                        Sẵn sàng
                      </span>
                    </div>

                    <h3
                      style={{
                        margin: '0 0 8px',
                        fontSize: 17,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {game.name}
                    </h3>
                    <p
                      style={{
                        margin: '0 0 20px',
                        fontSize: 13,
                        lineHeight: 1.55,
                        color: 'var(--text-secondary)',
                        minHeight: 40,
                      }}
                    >
                      {game.description}
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    onClick={() => navigate(game.route)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      fontWeight: 600,
                      padding: '10px 16px',
                    }}
                  >
                    <Play size={15} />
                    Chơi ngay
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── SECTION 2: SẮP RA MẮT ── */}
      <section style={{ marginBottom: 40 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            borderBottom: '1px solid rgba(15,23,42,0.08)',
            paddingBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#f59e0b',
                display: 'inline-block',
              }}
            />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              SẮP RA MẮT
            </h2>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                background: 'var(--surface-muted)',
                padding: '2px 8px',
                borderRadius: 2,
              }}
            >
              {comingSoonGames.length}
            </span>
          </div>
        </div>

        {comingSoonGames.length === 0 ? (
          <div
            style={{
              padding: 24,
              background: 'var(--surface-soft)',
              border: '1px dashed rgba(15,23,42,0.12)',
              color: 'var(--text-secondary)',
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            Hiện tại tất cả trò chơi trong danh mục đều đã ra mắt và có thể chơi trực tiếp.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 20,
            }}
          >
            {comingSoonGames.map((game) => {
              const Icon = GAME_ICONS[game.gameKey] || Gamepad2;
              return (
                <div
                  key={game.gameKey}
                  style={{
                    background: '#fafafa',
                    border: '1px solid rgba(15,23,42,0.08)',
                    borderRadius: 'var(--radius-content)',
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    opacity: 0.9,
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        marginBottom: 16,
                      }}
                    >
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          background: 'rgba(245,158,11,0.08)',
                          border: '1px solid rgba(245,158,11,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#d97706',
                        }}
                      >
                        <Icon size={24} strokeWidth={2.2} />
                      </div>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: 'rgba(245,158,11,0.12)',
                          color: '#d97706',
                          border: '1px solid rgba(245,158,11,0.3)',
                        }}
                      >
                        <Clock size={11} strokeWidth={2.5} />
                        Sắp ra mắt
                      </span>
                    </div>

                    <h3
                      style={{
                        margin: '0 0 8px',
                        fontSize: 17,
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {game.name}
                    </h3>
                    <p
                      style={{
                        margin: '0 0 20px',
                        fontSize: 13,
                        lineHeight: 1.55,
                        color: 'var(--text-secondary)',
                        minHeight: 40,
                      }}
                    >
                      {game.description ||
                        'Trò chơi đang trong quá trình phát triển và hoàn thiện các tính năng thi đấu.'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      variant="secondary"
                      disabled={!isAdmin}
                      onClick={() => navigate(game.route)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        fontWeight: 600,
                        padding: '10px 16px',
                        background: 'var(--surface)',
                        color: isAdmin ? 'var(--info)' : 'var(--text-muted)',
                        cursor: isAdmin ? 'pointer' : 'default',
                      }}
                    >
                      {isAdmin ? 'Xem trước (Admin)' : 'Sắp ra mắt'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </PageShell>
  );
}
