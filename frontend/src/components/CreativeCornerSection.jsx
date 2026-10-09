import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Palette,
  Heart,
  Download,
  Maximize2,
  Trash2,
  ArrowUpRight,
  Medal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { drawingApi } from '../services/api';
import { getSocket } from '../services/socket';
import { Reveal, Button, AnimatedModal, Skeleton } from './ui';
import VerifiedBadge from './VerifiedBadge';
import { displayScore, removeVietnameseDiacritics } from './PublicRecognition';
import { initialsFromName, avatarHue } from '../utils/avatar';

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const HEART_COLORS = ['#ef4444', '#f43f5e', '#fb7185', '#e11d48', '#f87171'];

function AuthorAvatar({ author, size = 38 }) {
  const [imageError, setImageError] = useState(false);
  const authorName = author?.name || 'Thành viên';
  const hue = avatarHue(authorName, author?.id);

  if (author?.avatarUrl && !imageError) {
    return (
      <img
        src={author.avatarUrl}
        alt={authorName}
        className="public-artwork-avatar-img"
        style={{ width: size, height: size }}
        loading="lazy"
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div
      className="public-artwork-avatar-fallback"
      style={{
        width: size,
        height: size,
        backgroundColor: `hsl(${hue}, 45%, 92%)`,
        color: `hsl(${hue}, 70%, 32%)`,
      }}
      aria-hidden="true"
    >
      {initialsFromName(authorName)}
    </div>
  );
}

export default function CreativeCornerSection() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [drawings, setDrawings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('top'); // 'top' | 'latest'
  const [homeVisible, setHomeVisible] = useState(true);

  // Floating Heart Particle Animation State
  const [floatingHearts, setFloatingHearts] = useState([]);

  // Lightbox Modal State
  const [lightboxArtwork, setLightboxArtwork] = useState(null);

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Trigger floating hearts on like action
  const triggerHeartBurst = useCallback((clientX, clientY) => {
    const burstCount = 8;
    const originX = clientX || window.innerWidth / 2;
    const originY = clientY || window.innerHeight / 2;
    const newHearts = Array.from({ length: burstCount }).map((_, i) => ({
      id: `${Date.now()}-${i}-${Math.random()}`,
      x: originX + (Math.random() * 50 - 25),
      y: originY + (Math.random() * 20 - 10),
      color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
      size: 15 + Math.floor(Math.random() * 10),
      scale: 0.85 + Math.random() * 0.45,
      rotate: Math.random() * 40 - 20,
      duration: 850 + Math.random() * 350,
    }));

    setFloatingHearts((prev) => [...prev, ...newHearts]);

    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => !newHearts.some((nh) => nh.id === h.id)));
    }, 1300);
  }, []);

  // Fetch drawings from API
  const fetchDrawings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await drawingApi.getGallery({
        page: 1,
        limit: 12,
        filter,
        visibility: 'PUBLIC',
      });
      if (res && res.settings && typeof res.settings.homeVisible === 'boolean') {
        setHomeVisible(res.settings.homeVisible);
      }
      if (res && Array.isArray(res.drawings)) {
        setDrawings(res.drawings);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách tác phẩm:', err);
      setError('Chưa tải được tác phẩm từ Thư Viện Tranh.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchDrawings();
  }, [fetchDrawings]);

  // Realtime Socket listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleCreated = (newDrawing) => {
      if (!newDrawing) return;
      setDrawings((prev) => {
        if (prev.some((d) => d.id === newDrawing.id)) return prev;
        return [newDrawing, ...prev].slice(0, 16);
      });
    };

    const handleLiked = (payload) => {
      if (!payload || !payload.drawingId) return;
      setDrawings((prev) =>
        prev.map((d) =>
          d.id === payload.drawingId ? { ...d, likesCount: payload.likesCount } : d
        )
      );
      setLightboxArtwork((prev) =>
        prev && prev.id === payload.drawingId ? { ...prev, likesCount: payload.likesCount } : prev
      );
    };

    const handleDeleted = (payload) => {
      if (!payload || !payload.drawingId) return;
      setDrawings((prev) => prev.filter((d) => d.id !== payload.drawingId));
      setLightboxArtwork((prev) => (prev && prev.id === payload.drawingId ? null : prev));
    };

    const handleSettingsUpdated = (newSettings) => {
      if (newSettings && typeof newSettings.homeVisible === 'boolean') {
        setHomeVisible(newSettings.homeVisible);
      }
    };

    socket.on('drawing:created', handleCreated);
    socket.on('drawing:liked', handleLiked);
    socket.on('drawing:deleted', handleDeleted);
    socket.on('drawing:settings_updated', handleSettingsUpdated);

    return () => {
      socket.off('drawing:created', handleCreated);
      socket.off('drawing:liked', handleLiked);
      socket.off('drawing:deleted', handleDeleted);
      socket.off('drawing:settings_updated', handleSettingsUpdated);
    };
  }, []);

  // Handle Like toggle with optimistic UI update
  const handleToggleLike = async (e, drawing) => {
    if (e && e.stopPropagation) e.stopPropagation();

    if (e && e.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      triggerHeartBurst(rect.left + rect.width / 2, rect.top);
    } else {
      triggerHeartBurst(window.innerWidth / 2, window.innerHeight / 2);
    }

    if (!user) {
      navigate('/login');
      return;
    }

    const currentLiked = drawing.hasLiked;
    const currentCount = drawing.likesCount;
    const nextLiked = !currentLiked;
    const nextCount = nextLiked ? currentCount + 1 : Math.max(0, currentCount - 1);

    // Optimistic update
    const updateItem = (item) =>
      item.id === drawing.id ? { ...item, hasLiked: nextLiked, likesCount: nextCount } : item;

    setDrawings((prev) => prev.map(updateItem));
    if (lightboxArtwork && lightboxArtwork.id === drawing.id) {
      setLightboxArtwork((prev) => ({ ...prev, hasLiked: nextLiked, likesCount: nextCount }));
    }

    try {
      const res = await drawingApi.toggleLike(drawing.id);
      if (res) {
        const syncItem = (item) =>
          item.id === drawing.id
            ? { ...item, hasLiked: res.hasLiked, likesCount: res.likesCount }
            : item;
        setDrawings((prev) => prev.map(syncItem));
        if (lightboxArtwork && lightboxArtwork.id === drawing.id) {
          setLightboxArtwork((prev) => ({
            ...prev,
            hasLiked: res.hasLiked,
            likesCount: res.likesCount,
          }));
        }
      }
    } catch (err) {
      // Revert on error
      const revertItem = (item) =>
        item.id === drawing.id
          ? { ...item, hasLiked: currentLiked, likesCount: currentCount }
          : item;
      setDrawings((prev) => prev.map(revertItem));
      if (lightboxArtwork && lightboxArtwork.id === drawing.id) {
        setLightboxArtwork((prev) => ({
          ...prev,
          hasLiked: currentLiked,
          likesCount: currentCount,
        }));
      }
    }
  };

  // Download artwork locally as PNG
  const handleDownload = (e, drawing) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!drawing || !drawing.imageUrl) return;
    const link = document.createElement('a');
    link.href = drawing.imageUrl;
    link.download = `${drawing.title || 'workrank-artwork'}.png`;
    link.target = '_blank';
    link.click();
  };

  // Delete artwork
  const handleDeleteArtwork = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await drawingApi.deleteDrawing(deleteTarget.id);
      setDrawings((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      if (lightboxArtwork && lightboxArtwork.id === deleteTarget.id) {
        setLightboxArtwork(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error('Lỗi xóa tác phẩm:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Lightbox keyboard navigation (ArrowLeft / ArrowRight)
  const handleLightboxPrev = useCallback(() => {
    if (!lightboxArtwork || drawings.length <= 1) return;
    const currIdx = drawings.findIndex((d) => d.id === lightboxArtwork.id);
    const prevIdx = (currIdx - 1 + drawings.length) % drawings.length;
    setLightboxArtwork(drawings[prevIdx]);
  }, [lightboxArtwork, drawings]);

  const handleLightboxNext = useCallback(() => {
    if (!lightboxArtwork || drawings.length <= 1) return;
    const currIdx = drawings.findIndex((d) => d.id === lightboxArtwork.id);
    const nextIdx = (currIdx + 1) % drawings.length;
    setLightboxArtwork(drawings[nextIdx]);
  }, [lightboxArtwork, drawings]);

  useEffect(() => {
    if (!lightboxArtwork) return;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') handleLightboxPrev();
      if (e.key === 'ArrowRight') handleLightboxNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxArtwork, handleLightboxPrev, handleLightboxNext]);

  // If Admin has toggled Home Visibility to false, do not render section
  if (!homeVisible) {
    return null;
  }

  const currentCount = drawings.length;

  return (
    <Reveal
      as="section"
      delay={500}
      className="public-season-section public-archive-section public-creative-section"
      aria-labelledby="creative-corner-title"
      aria-busy={loading}
    >
      {/* Dynamic Floating Lucide Hearts Layer */}
      {floatingHearts.length > 0 && (
        <div className="public-floating-hearts-container" aria-hidden="true">
          {floatingHearts.map((heart) => (
            <span
              key={heart.id}
              className="public-floating-heart"
              style={{
                left: `${heart.x}px`,
                top: `${heart.y}px`,
                transform: `scale(${heart.scale}) rotate(${heart.rotate}deg)`,
                animationDuration: `${heart.duration}ms`,
                color: heart.color,
              }}
            >
              <Heart size={heart.size} fill="currentColor" stroke="none" />
            </span>
          ))}
        </div>
      )}

      {/* 1. Standard WorkRank Home Editorial Heading */}
      <div className="public-season-heading is-detail">
        <h2 id="creative-corner-title">
          <span>Sáng tạo · Thư viện tranh</span>
        </h2>
        <div>
          <p>{currentCount > 0 ? `${currentCount} Tác phẩm` : 'Studio nghệ thuật'}</p>
          <span>Nét vẽ cảm hứng &amp; sắc màu nghệ thuật từ nhân sự 3WIN MEDIA</span>
        </div>
      </div>

      {/* 2. Gallery Header Bar: Filter Tabs & Studio CTA */}
      <div className="public-creative-control-bar">
        <div className="public-creative-tabs" role="tablist" aria-label="Bộ lọc tác phẩm tranh">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'top'}
            className={`public-creative-tab ${filter === 'top' ? 'is-active' : ''}`}
            onClick={() => setFilter('top')}
          >
            Nhiều tim nhất
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'latest'}
            className={`public-creative-tab ${filter === 'latest' ? 'is-active' : ''}`}
            onClick={() => setFilter('latest')}
          >
            Mới nhất
          </button>
        </div>

        <Link to="/games/drawing" className="public-editorial-link public-creative-studio-cta">
          <Palette size={16} aria-hidden="true" />
          <span>Vào phòng vẽ tranh</span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>

      {/* 3. Main Artwork Content Area */}
      {loading ? (
        <div className="public-artwork-grid" aria-label="Đang tải danh sách tác phẩm">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="public-artwork-card is-skeleton">
              <div className="public-artwork-author-row">
                <Skeleton height={38} width={38} radius={50} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Skeleton height={14} width="55%" />
                  <Skeleton height={11} width="35%" />
                </div>
              </div>
              <Skeleton height={240} width="100%" radius={0} />
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Skeleton height={16} width="75%" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Skeleton height={28} width={68} radius={999} />
                  <Skeleton height={28} width={60} radius={6} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="public-recognition-feedback" role="alert">
          <span>{error}</span>
          <button type="button" onClick={fetchDrawings}>
            Thử lại <ArrowUpRight size={15} />
          </button>
        </div>
      ) : currentCount === 0 ? (
        <div className="public-creative-empty-card">
          <div className="public-creative-empty-icon" aria-hidden="true">
            <Palette size={34} />
          </div>
          <h3 className="public-creative-empty-title">Chưa có tác phẩm nào trong Thư Viện Tranh</h3>
          <p className="public-creative-empty-desc">
            Hãy là người đầu tiên đặt nét vẽ cảm hứng lên bảng tranh của 3WIN MEDIA!
          </p>
          <Link to="/games/drawing" className="public-entry-button public-creative-empty-cta">
            <span>Bắt đầu vẽ bức tranh đầu tiên</span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="public-artwork-grid">
          {drawings.map((item, index) => {
            const author = item.author || {};
            const canDelete = user && (author.id === user.id || isAdmin);
            const authorProfileUrl = author.id ? `/users/${author.id}` : '#';

            return (
              <article key={item.id} className="public-artwork-card">
                {/* Author Information Header */}
                <header className="public-artwork-author-row">
                  <Link
                    to={authorProfileUrl}
                    className="public-artwork-author-link"
                    onClick={(e) => !author.id && e.preventDefault()}
                    title={author.name ? `Xem hồ sơ của ${author.name}` : undefined}
                  >
                    <AuthorAvatar author={author} size={38} />
                    <div className="public-artwork-author-meta">
                      <div className="public-artwork-author-name-wrap">
                        <span className="public-artwork-author-name">
                          {author.name || 'Thành viên 3WIN'}
                        </span>
                        {author.isVerified && <VerifiedBadge size={14} />}
                      </div>
                      <div className="public-artwork-author-sub">
                        <span className="public-artwork-time">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                        {(author.teamName || author.department) && (
                          <>
                            <span className="public-artwork-sep">·</span>
                            <span
                              className="public-artwork-department"
                              title={author.teamName ? `Đội ${author.teamName}` : author.department}
                            >
                              {author.teamName ? `Đội ${author.teamName}` : author.department}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>

                  <div className="public-artwork-header-aside">
                    {filter === 'top' && index < 3 && (
                      <span
                        className={`public-artwork-top-pill rank-${index + 1}`}
                        title={`Top ${index + 1} lượt tim`}
                      >
                        <Medal size={11} aria-hidden="true" />
                        <span>#{index + 1}</span>
                      </span>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        className="public-artwork-delete-icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(item);
                        }}
                        title="Xóa tác phẩm"
                        aria-label="Xóa tác phẩm"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </header>

                {/* Artwork Canvas Frame (Large, Balanced, Aspect Ratio Preserved) */}
                <div
                  className="public-artwork-media-frame"
                  onClick={() => setLightboxArtwork(item)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Xem chi tiết tác phẩm: ${item.title}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setLightboxArtwork(item);
                    }
                  }}
                >
                  <div className="public-artwork-canvas-backdrop">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="public-artwork-canvas-img"
                      loading="lazy"
                    />
                  </div>
                  <div className="public-artwork-media-overlay" aria-hidden="true">
                    <span className="public-artwork-media-hint">
                      <Maximize2 size={13} />
                      <span>Xem chi tiết</span>
                    </span>
                  </div>
                </div>

                {/* Artwork Bottom: Title & Action Bar */}
                <div className="public-artwork-info-row">
                  <h3
                    className="public-artwork-title"
                    title={item.title}
                    onClick={() => setLightboxArtwork(item)}
                  >
                    {item.title}
                  </h3>

                  <div className="public-artwork-bottom-bar">
                    <button
                      type="button"
                      className={`public-artwork-like-pill ${item.hasLiked ? 'is-liked' : ''}`}
                      onClick={(e) => handleToggleLike(e, item)}
                      title={item.hasLiked ? 'Đã thả tim (nhấn để bỏ thích)' : 'Thả tim tác phẩm'}
                      aria-pressed={Boolean(item.hasLiked)}
                    >
                      <Heart
                        size={15}
                        className="public-artwork-heart-svg"
                        fill={item.hasLiked ? '#ef4444' : 'none'}
                        stroke={item.hasLiked ? '#ef4444' : 'currentColor'}
                        strokeWidth={item.hasLiked ? 0 : 2}
                      />
                      <span className="public-artwork-like-count">
                        {displayScore(item.likesCount)}
                      </span>
                    </button>

                    <div className="public-artwork-action-group">
                      <button
                        type="button"
                        className="public-artwork-icon-btn"
                        onClick={(e) => handleDownload(e, item)}
                        title="Tải ảnh PNG về máy"
                        aria-label="Tải ảnh PNG"
                      >
                        <Download size={15} />
                      </button>
                      <button
                        type="button"
                        className="public-artwork-icon-btn"
                        onClick={() => setLightboxArtwork(item)}
                        title="Xem toàn màn hình"
                        aria-label="Xem toàn màn hình"
                      >
                        <Maximize2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 4. Full Artwork Lightbox Modal */}
      <AnimatedModal
        isOpen={Boolean(lightboxArtwork)}
        onClose={() => setLightboxArtwork(null)}
        title={lightboxArtwork?.title || 'Chi tiết tác phẩm'}
        maxWidth={940}
      >
        {lightboxArtwork && (
          <div className="public-artwork-modal-body">
            {/* Modal Image Exhibition Frame */}
            <div className="public-artwork-modal-frame">
              <img
                src={lightboxArtwork.imageUrl}
                alt={lightboxArtwork.title}
                className="public-artwork-modal-image"
              />

              {drawings.length > 1 && (
                <>
                  <button
                    type="button"
                    className="public-artwork-modal-nav is-prev"
                    onClick={handleLightboxPrev}
                    aria-label="Tác phẩm trước (Phím mũi tên trái)"
                    title="Tác phẩm trước"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    type="button"
                    className="public-artwork-modal-nav is-next"
                    onClick={handleLightboxNext}
                    aria-label="Tác phẩm kế tiếp (Phím mũi tên phải)"
                    title="Tác phẩm kế tiếp"
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
            </div>

            {/* Modal Metadata & Actions Panel */}
            <div className="public-artwork-modal-info-bar">
              <div className="public-artwork-modal-author">
                <AuthorAvatar author={lightboxArtwork.author} size={42} />
                <div className="public-artwork-modal-author-text">
                  <div className="public-artwork-author-name-wrap">
                    <Link
                      to={lightboxArtwork.author?.id ? `/users/${lightboxArtwork.author.id}` : '#'}
                      className="public-artwork-modal-author-name"
                      onClick={(e) => !lightboxArtwork.author?.id && e.preventDefault()}
                    >
                      {lightboxArtwork.author?.name || 'Thành viên 3WIN'}
                    </Link>
                    {lightboxArtwork.author?.isVerified && <VerifiedBadge size={15} />}
                  </div>
                  <div className="public-artwork-modal-sub">
                    <span>{formatRelativeTime(lightboxArtwork.createdAt)}</span>
                    {(lightboxArtwork.author?.teamName || lightboxArtwork.author?.department) && (
                      <>
                        <span>·</span>
                        <span>
                          {lightboxArtwork.author.teamName
                            ? `Đội ${lightboxArtwork.author.teamName}`
                            : lightboxArtwork.author.department}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="public-artwork-modal-actions">
                <button
                  type="button"
                  className={`public-artwork-like-pill is-large ${lightboxArtwork.hasLiked ? 'is-liked' : ''}`}
                  onClick={(e) => handleToggleLike(e, lightboxArtwork)}
                  title={lightboxArtwork.hasLiked ? 'Bỏ thích' : 'Thả tim tác phẩm'}
                >
                  <Heart
                    size={16}
                    fill={lightboxArtwork.hasLiked ? '#ef4444' : 'none'}
                    stroke={lightboxArtwork.hasLiked ? '#ef4444' : 'currentColor'}
                    strokeWidth={lightboxArtwork.hasLiked ? 0 : 2}
                  />
                  <span>
                    {lightboxArtwork.hasLiked ? 'Đã thả tim' : 'Thả tim'} (
                    {displayScore(lightboxArtwork.likesCount)})
                  </span>
                </button>

                <button
                  type="button"
                  className="public-artwork-btn-secondary"
                  onClick={(e) => handleDownload(e, lightboxArtwork)}
                >
                  <Download size={15} />
                  <span>Tải ảnh PNG</span>
                </button>

                {user && (lightboxArtwork.author?.id === user.id || isAdmin) && (
                  <button
                    type="button"
                    className="public-artwork-btn-secondary is-danger"
                    onClick={() => setDeleteTarget(lightboxArtwork)}
                  >
                    <Trash2 size={15} />
                    <span>Xóa</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatedModal>

      {/* 5. Delete Confirmation Modal */}
      <AnimatedModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Xác nhận xóa tác phẩm"
        maxWidth={440}
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isDeleting}
              onClick={() => setDeleteTarget(null)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={isDeleting}
              onClick={handleDeleteArtwork}
            >
              {isDeleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Bạn có chắc chắn muốn gỡ bỏ tác phẩm "<b>{deleteTarget?.title}</b>" khỏi Thư Viện Tranh
          không? Thao tác này không thể hoàn tác.
        </p>
      </AnimatedModal>
    </Reveal>
  );
}
