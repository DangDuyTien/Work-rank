import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  Images,
  Play,
  Settings,
  Sparkles,
  Trophy,
} from 'lucide-react';
import {
  GAME_CENTER_ITEMS,
  GALLERY_NAV_ITEM,
  MODE_SHORT_VI,
} from '../games/arcade/catalog';
import { ArcadePoster } from '../components/arcade/ArcadeArt';
import '../components/arcade/arcade.css';
import '../components/arcade/game-center.css';
import { gameCatalogApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PageShell, Button, EmptyState } from '../components/ui';

/**
 * TRUNG TÂM TRÒ CHƠI — 5 trò, một ngôn ngữ visual.
 *
 * Card lấy tên/mô tả/chế độ từ GAME_REGISTRY, chỉ trạng thái mở chơi là đến từ
 * server (admin bật/tắt). Không hardcode lại tên game ở đây.
 */
export default function GameHub() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [statusMap, setStatusMap] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchCatalog = useCallback(async () => {
    try {
      const res = await gameCatalogApi.getCatalog();
      const list = res?.games || (Array.isArray(res) ? res : []);
      const map = {};
      list.forEach((game) => {
        const key = game.gameKey || game.game_key;
        if (key) map[key] = { status: game.status, enabled: game.enabled };
      });
      setStatusMap(map);
    } catch (err) {
      // Không có catalog vẫn phải chơi được: mọi game trong registry mặc định mở.
      console.warn('Không đọc được trạng thái game, dùng danh mục mặc định:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
    const handleUpdate = () => fetchCatalog();
    window.addEventListener('workrank:game-catalog-updated', handleUpdate);
    return () => window.removeEventListener('workrank:game-catalog-updated', handleUpdate);
  }, [fetchCatalog]);

  const games = GAME_CENTER_ITEMS.map((game) => {
    const state = statusMap[game.catalogKey] || {};
    const available = state.status !== 'COMING_SOON' && state.enabled !== false;
    return { ...game, available };
  });
  const availableGames = games.filter((game) => game.available);
  const comingSoonGames = games.filter((game) => !game.available);

  return (
    <PageShell className="game-center-page">
      <header className="gc-hero">
        <div className="gc-hero-copy">
          <p className="gc-kicker"><Sparkles size={13} aria-hidden="true" /> WORK RANK ARCADE</p>
          <h1>Trung tâm trò chơi</h1>
          <p className="gc-hero-lead">
            Năm trò chơi ngắn, vui và công bằng. Mỗi ván khoảng một phút — đủ để đổi nhịp giữa giờ làm,
            đủ để leo bảng xếp hạng của công ty.
          </p>
          <ul className="gc-hero-facts">
            <li><b>{GAME_CENTER_ITEMS.length}</b> trò đang mở</li>
            <li><b>4</b> chế độ phòng</li>
            <li><b>60s</b> mỗi ván arcade</li>
          </ul>
        </div>
        <div className="gc-hero-art" aria-hidden="true">
          <span className="gc-hero-sun" />
          <span className="gc-hero-shelf" />
          <span className="gc-hero-frame is-one">✦</span>
          <span className="gc-hero-frame is-two">Aa</span>
          <span className="gc-hero-frame is-three">↑</span>
          <span className="gc-hero-figure"><span>•ᴗ•</span><i /></span>
        </div>
      </header>

      <section className="gc-section" aria-labelledby="gc-available-title">
        <div className="gc-section-head">
          <span className="gc-live-dot" aria-hidden="true" />
          <h2 id="gc-available-title">Đang có thể chơi</h2>
          <span className="gc-count">{availableGames.length}</span>
          <span className="gc-section-note">Bấm vào thẻ để vào sân</span>
        </div>

        {loading && !availableGames.length ? (
          <div className="gc-grid" aria-label="Đang tải danh mục trò chơi">
            {GAME_CENTER_ITEMS.map((game) => (
              <div key={game.id} className="gc-card is-skeleton" aria-hidden="true">
                <span className="gc-skeleton-poster" />
                <span className="gc-skeleton-line is-title" />
                <span className="gc-skeleton-line" />
                <span className="gc-skeleton-line is-short" />
              </div>
            ))}
          </div>
        ) : availableGames.length === 0 ? (
          <EmptyState
            title="Chưa có trò chơi nào sẵn sàng"
            description="Tất cả trò chơi đang trong giai đoạn cập nhật hoặc bảo trì. Quay lại sau ít phút nhé."
          />
        ) : (
          <div className="gc-grid">
            {availableGames.map((game) => {
              const Icon = game.icon;
              return (
                <article
                  key={game.id}
                  className="gc-card"
                  data-game={game.id}
                  style={{ '--gc-accent': game.theme.accent, '--gc-soft': game.theme.soft, '--gc-ink': game.theme.ink }}
                >
                  <div className="gc-card-poster">
                    <ArcadePoster gameType={game.id} compact />
                    <span className="gc-card-status"><i aria-hidden="true" /> Sẵn sàng</span>
                  </div>

                  <div className="gc-card-body">
                    <div className="gc-card-heading">
                      <span className="gc-card-icon" aria-hidden="true"><Icon size={17} strokeWidth={2.2} /></span>
                      <span className="gc-card-mark" aria-hidden="true">{game.mark}</span>
                    </div>

                    <h3 className="gc-card-name">{game.displayNameVi}</h3>
                    <p className="gc-card-sub">{game.subtitleVi}</p>
                    <p className="gc-card-desc">{game.descriptionVi}</p>

                    <ul className="gc-card-modes" aria-label="Chế độ chơi">
                      {game.modes.length
                        ? game.modes.map((mode) => <li key={mode}>{MODE_SHORT_VI[mode] || mode}</li>)
                        : <li>Tự do sáng tạo</li>}
                    </ul>

                    <Button
                      variant="primary"
                      onClick={() => navigate(game.route)}
                      className="gc-card-cta"
                    >
                      <Play size={15} aria-hidden="true" />
                      Chơi ngay
                      <ArrowRight size={15} aria-hidden="true" />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Link to={GALLERY_NAV_ITEM.route} className="gc-gallery-strip">
        <span className="gc-gallery-icon" aria-hidden="true"><Images size={22} /></span>
        <span className="gc-gallery-copy">
          <b>{GALLERY_NAV_ITEM.displayNameVi}</b>
          <small>Tranh của mọi người trong công ty — thả tim, tải ảnh, xem chi tiết.</small>
        </span>
        <span className="gc-gallery-link">Mở thư viện <ArrowRight size={15} aria-hidden="true" /></span>
      </Link>

      <section className="gc-section" aria-labelledby="gc-soon-title">
        <div className="gc-section-head">
          <span className="gc-soon-dot" aria-hidden="true" />
          <h2 id="gc-soon-title">Sắp ra mắt</h2>
          <span className="gc-count">{comingSoonGames.length}</span>
        </div>

        {comingSoonGames.length === 0 ? (
          <p className="gc-soon-empty">
            Tất cả trò chơi trong danh mục đều đã ra mắt và có thể chơi ngay.
          </p>
        ) : (
          <div className="gc-grid is-soon">
            {comingSoonGames.map((game) => {
              const Icon = game.icon;
              return (
                <article key={game.id} className="gc-card is-soon" data-game={game.id}>
                  <div className="gc-card-poster">
                    <ArcadePoster gameType={game.id} compact />
                    <span className="gc-card-status is-soon"><Clock size={11} aria-hidden="true" /> Sắp ra mắt</span>
                  </div>
                  <div className="gc-card-body">
                    <div className="gc-card-heading">
                      <span className="gc-card-icon" aria-hidden="true"><Icon size={17} strokeWidth={2.2} /></span>
                    </div>
                    <h3 className="gc-card-name">{game.displayNameVi}</h3>
                    <p className="gc-card-sub">{game.subtitleVi}</p>
                    <p className="gc-card-desc">{game.descriptionVi}</p>
                    <Button
                      variant="secondary"
                      disabled={!isAdmin}
                      onClick={() => navigate(game.route)}
                      className="gc-card-cta"
                    >
                      {isAdmin ? 'Xem trước (quản trị)' : 'Đang hoàn thiện'}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="gc-footer">
        <span><Trophy size={15} aria-hidden="true" /> Mọi kết quả đều được lưu vào bảng xếp hạng riêng của từng trò.</span>
        {isAdmin && (
          <Button
            variant="secondary"
            onClick={() => navigate('/settings?tab=games')}
            className="gc-admin-btn"
          >
            <Settings size={15} aria-hidden="true" />
            Quản lý trạng thái trò chơi
          </Button>
        )}
      </footer>
    </PageShell>
  );
}
