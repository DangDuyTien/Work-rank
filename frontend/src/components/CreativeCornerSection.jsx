import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Palette,
  Heart,
  Download,
  Trash2,
  ArrowUpRight,
  Medal,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { drawingApi } from '../services/api';
import { getSocket } from '../services/socket';
import { Reveal, Button, AnimatedModal, Skeleton } from './ui';
import {
  RecognitionPortrait,
  RecognitionName,
  displayScore,
  removeVietnameseDiacritics,
} from './PublicRecognition';

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

const HEART_COLORS = ['#ef4444', '#f43f5e', '#fb7185', '#e11d48', '#f87171', '#fda4af'];

export default function CreativeCornerSection() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [drawings, setDrawings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('top'); // 'top' | 'latest'
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [homeVisible, setHomeVisible] = useState(true);

  // Floating Hearts Particle Animation State
  const [floatingHearts, setFloatingHearts] = useState([]);
  const [centerHeartAnim, setCenterHeartAnim] = useState(false);
  const canvasRef = useRef(null);

  // Delete Artwork state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Spawn floating Lucide heart particles at given coordinates
  const triggerHeartBurst = useCallback((clientX, clientY) => {
    const burstCount = 8;
    const newHearts = Array.from({ length: burstCount }).map((_, i) => ({
      id: `${Date.now()}-${i}-${Math.random()}`,
      x: (clientX || window.innerWidth / 2) + (Math.random() * 60 - 30),
      y: (clientY || window.innerHeight / 2) + (Math.random() * 30 - 15),
      color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
      size: 16 + Math.floor(Math.random() * 12),
      scale: 0.85 + Math.random() * 0.5,
      rotate: Math.random() * 50 - 25,
      duration: 900 + Math.random() * 400,
    }));

    setFloatingHearts((prev) => [...prev, ...newHearts]);

    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => !newHearts.some((nh) => nh.id === h.id)));
    }, 1400);
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
        setSelectedIndex(0);
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

  // Realtime Socket listeners for live updates without refresh
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
          d.id === payload.drawingId
            ? { ...d, likesCount: payload.likesCount }
            : d
        )
      );
    };

    const handleDeleted = (payload) => {
      if (!payload || !payload.drawingId) return;
      setDrawings((prev) => prev.filter((d) => d.id !== payload.drawingId));
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

  // Handle Like toggle with interactive Heart Burst & optimistic UI update
  const handleToggleLike = async (e, drawing) => {
    if (e && e.stopPropagation) e.stopPropagation();

    // Trigger Heart Burst animation from click origin
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
    setDrawings((prev) =>
      prev.map((d) =>
        d.id === drawing.id
          ? { ...d, hasLiked: nextLiked, likesCount: nextCount }
          : d
      )
    );

    try {
      const res = await drawingApi.toggleLike(drawing.id);
      if (res) {
        setDrawings((prev) =>
          prev.map((d) =>
            d.id === drawing.id
              ? { ...d, hasLiked: res.hasLiked, likesCount: res.likesCount }
              : d
          )
        );
      }
    } catch (err) {
      // Revert on error
      setDrawings((prev) =>
        prev.map((d) =>
          d.id === drawing.id
            ? { ...d, hasLiked: currentLiked, likesCount: currentCount }
            : d
        )
      );
    }
  };

  // Double-click on Massive Canvas to Like & spawn Lucide Heart burst
  const handleCanvasDoubleClick = (e) => {
    e.preventDefault();
    if (!activeArtwork) return;

    setCenterHeartAnim(true);
    setTimeout(() => setCenterHeartAnim(false), 900);

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX || rect.left + rect.width / 2;
    const y = e.clientY || rect.top + rect.height / 2;
    triggerHeartBurst(x, y);

    if (!activeArtwork.hasLiked) {
      handleToggleLike(e, activeArtwork);
    }
  };

  // Delete active artwork (by author or admin)
  const handleDeleteArtwork = async () => {
    if (!activeArtwork) return;
    try {
      setIsDeleting(true);
      await drawingApi.deleteDrawing(activeArtwork.id);
      setDrawings((prev) => prev.filter((d) => d.id !== activeArtwork.id));
      setShowDeleteConfirm(false);
      setSelectedIndex(0);
    } catch (err) {
      console.error('Lỗi xóa tác phẩm:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Download artwork locally as PNG
  const handleDownloadArtwork = (e, drawing) => {
    e.stopPropagation();
    if (!drawing || !drawing.imageUrl) return;
    const link = document.createElement('a');
    link.href = drawing.imageUrl;
    link.download = `${drawing.title || 'workrank-artwork'}.png`;
    link.target = '_blank';
    link.click();
  };

  const currentCount = drawings.length;
  const activeArtwork = drawings[selectedIndex] || drawings[0] || null;
  const author = activeArtwork?.author || {};
  const authorName = author?.name ? removeVietnameseDiacritics(author.name) : 'Thanh vien';
  const authorAvatar = author?.avatarUrl || null;
  const authorProfileUrl = author?.id ? `/users/${author.id}` : '#';

  const isAuthorOrAdmin =
    user &&
    activeArtwork &&
    (activeArtwork.author?.id === user.id || isAdmin);

  const handlePrev = () => {
    if (currentCount <= 1) return;
    setSelectedIndex((prev) => (prev - 1 + currentCount) % currentCount);
  };

  const handleNext = () => {
    if (currentCount <= 1) return;
    setSelectedIndex((prev) => (prev + 1) % currentCount);
  };

  // If Admin has turned off Creative Corner on Home, do not render the section
  if (!homeVisible) {
    return null;
  }

  return (
    <Reveal
      as="section"
      delay={500}
      className="public-season-section public-archive-section public-weekly-recognition public-creative-recognition"
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

      {/* 1. Standard Editorial Heading */}
      <div className="public-season-heading is-detail">
        <h2 id="creative-corner-title">
          <span>Sáng tạo · Thư viện tranh</span>
        </h2>
        <div>
          <p>{currentCount > 0 ? `${currentCount} Tác phẩm` : 'Studio nghệ thuật'}</p>
          <span>Nét vẽ cảm hứng &amp; sáng tạo từ các thành viên 3Win Media</span>
        </div>
      </div>

      {/* 2. Top Identification Grid: Author Portrait (Khung ô vuông chân dung người vẽ / Chủ tài khoản) + Metadata */}
      <div className="public-recognition-grid public-creative-recognition-grid">
        {/* Left Column: Ô VUÔNG CHÂN DUNG NGƯỜI VẼ / CHỦ SỞ HỮU TÀI KHOẢN */}
        <figure className="public-featured-person" aria-label={`Ảnh chân dung tác giả ${authorName}`}>
          <div
            className={`public-featured-frame is-ready ${author?.id ? 'is-interactive' : ''}`}
            onClick={() => author?.id && navigate(authorProfileUrl)}
            title={author?.id ? `Xem hồ sơ của ${author.name}` : undefined}
          >
            <svg className="public-frame-quote is-opening" viewBox="0 0 100 175" aria-hidden="true" focusable="false">
              <path d="M0 0H100V100L52 175H0L48 100H0Z" />
            </svg>
            <svg className="public-frame-quote is-closing" viewBox="0 0 100 175" aria-hidden="true" focusable="false">
              <path d="M0 0H100V100L52 175H0L48 100H0Z" />
            </svg>

            {/* Author Portrait inside Quote Frame */}
            <RecognitionPortrait
              key={`author-${author?.id || 'none'}-${activeArtwork?.id || 'none'}`}
              name={authorName}
              image={authorAvatar}
              type="member"
              imageOnly
            />
          </div>

          {activeArtwork && (
            <figcaption className="public-creative-caption">
              <p className="public-honoree-role">
                Họa sĩ sáng tạo:
              </p>
              <h3 className="public-creative-author-heading">
                <Link to={authorProfileUrl} className="public-archive-name-simple">
                  <RecognitionName name={author.name || 'Thành viên WorkRank'} verified={author.isVerified} />
                  <ArrowUpRight size={18} aria-hidden="true" />
                </Link>
              </h3>
              <p className="public-honoree-role">
                {author.jobTitle || author.department || 'Nhân sự 3Win Media'}
                {author.teamName && ` · Đội ${author.teamName}`}
              </p>
            </figcaption>
          )}
        </figure>

        {/* Right Column: Tiêu đề tác phẩm, Bảng thông số & Bộ lọc */}
        <div className="public-archive-content">
          {/* Filter switchers & Studio CTA */}
          <div className="public-creative-filter-bar">
            <div className="public-creative-tabs" role="tablist" aria-label="Bộ lọc tác phẩm">
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

            <Link to="/games/drawing" className="public-editorial-link public-creative-cta">
              <Palette size={16} aria-hidden="true" />
              <span>Vào Studio vẽ tranh</span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>

          {loading ? (
            <div className="public-creative-loading">
              <Skeleton height={32} width="70%" style={{ marginBottom: 12 }} />
              <Skeleton height={20} width="90%" style={{ marginBottom: 8 }} />
              <Skeleton height={20} width="60%" />
            </div>
          ) : error ? (
            <div className="public-recognition-feedback" role="alert">
              <span>{error}</span>
              <button type="button" onClick={fetchDrawings}>
                Thử lại <ArrowUpRight size={15} />
              </button>
            </div>
          ) : !activeArtwork ? (
            <div className="public-honoree-empty">
              <p>Chưa có tác phẩm nào trong Thư Viện Tranh.</p>
              <Link to="/games/drawing" className="public-editorial-link">
                <span>Bắt đầu vẽ bức tranh đầu tiên</span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="public-creative-active-info">
              <div className="public-archive-name-line">
                <div className="public-archive-name">
                  <span className="public-recognition-name">{activeArtwork.title}</span>
                </div>
              </div>

              {/* Status pill */}
              <span className="public-recognition-status is-official">
                <i aria-hidden="true" />
                {filter === 'top' ? `Tác phẩm dẫn đầu lượt tim` : `Tác phẩm mới nhất`}
              </span>

              {/* Fact pairs */}
              <dl className="public-recognition-facts public-weekly-facts" aria-label={`Thông số tác phẩm ${activeArtwork.title}`}>
                <div>
                  <dt>Lượt tim</dt>
                  <dd className="is-text public-likes-counter">
                    <Heart
                      size={15}
                      fill={activeArtwork.likesCount > 0 ? '#ef4444' : 'none'}
                      stroke={activeArtwork.likesCount > 0 ? '#ef4444' : 'currentColor'}
                      strokeWidth={2}
                    />
                    <span>{displayScore(activeArtwork.likesCount)}</span>
                  </dd>
                </div>
                <div>
                  <dt>Tác giả</dt>
                  <dd className="is-text">
                    <RecognitionName name={author.name || 'Ẩn danh'} />
                  </dd>
                </div>
                <div>
                  <dt>Đội nhóm</dt>
                  <dd className="is-text">{author.teamName || '3Win Media'}</dd>
                </div>
                <div>
                  <dt>Thời gian</dt>
                  <dd className="is-text">{formatRelativeTime(activeArtwork.createdAt)}</dd>
                </div>
              </dl>

              {/* Interactive Lucide Heart Reaction Bar */}
              <div className="public-creative-active-actions">
                <button
                  type="button"
                  className={`public-creative-heart-btn ${activeArtwork.hasLiked ? 'is-liked' : ''}`}
                  onClick={(e) => handleToggleLike(e, activeArtwork)}
                  title="Nhấn để thả tim"
                >
                  <Heart
                    size={17}
                    className="public-heart-btn-icon"
                    fill={activeArtwork.hasLiked ? '#ef4444' : 'none'}
                    stroke={activeArtwork.hasLiked ? '#ef4444' : 'currentColor'}
                    strokeWidth={2}
                  />
                  <span>{activeArtwork.hasLiked ? 'Đã thả tim' : 'Thả tim'} ({displayScore(activeArtwork.likesCount)})</span>
                </button>

                <button
                  type="button"
                  className="public-creative-btn-secondary"
                  onClick={(e) => handleDownloadArtwork(e, activeArtwork)}
                  title="Tải tác phẩm về máy"
                >
                  <Download size={15} />
                  <span>Tải ảnh PNG</span>
                </button>

                {isAuthorOrAdmin && (
                  <button
                    type="button"
                    className="public-creative-btn-secondary is-danger"
                    onClick={() => setShowDeleteConfirm(true)}
                    title="Gỡ bỏ tác phẩm này"
                  >
                    <Trash2 size={15} />
                    <span>Xóa tranh</span>
                  </button>
                )}

                {currentCount > 1 && (
                  <div className="public-creative-nav-arrows">
                    <button
                      type="button"
                      className="public-creative-arrow-btn"
                      onClick={handlePrev}
                      aria-label="Tác phẩm trước"
                      title="Tác phẩm trước"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="public-creative-index-badge">
                      {selectedIndex + 1}/{currentCount}
                    </span>
                    <button
                      type="button"
                      className="public-creative-arrow-btn"
                      onClick={handleNext}
                      aria-label="Tác phẩm tiếp theo"
                      title="Tác phẩm tiếp theo"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. MASSIVE GRAND EXHIBITION CANVAS (BẢN VẼ KHỔ LỚN HOÀNH TRÁNG TO SẴN TRỰC TIẾP) */}
      {activeArtwork && (
        <div className="public-creative-grand-showcase">
          <div className="public-grand-canvas-wrapper" ref={canvasRef}>
            <div
              className="public-grand-canvas-frame"
              onDoubleClick={handleCanvasDoubleClick}
              title="Nhấn đúp (Double-click) để thả tim"
            >
              <img
                src={activeArtwork.imageUrl}
                alt={activeArtwork.title || 'Bản vẽ sáng tạo'}
                className="public-grand-canvas-image"
                loading="lazy"
              />

              {/* Big Center Heart Animation on Double Click */}
              {centerHeartAnim && (
                <div className="public-canvas-center-heart" aria-hidden="true">
                  <Heart size={92} fill="#ef4444" stroke="#ffffff" strokeWidth={1.5} />
                </div>
              )}
            </div>

            {/* Bottom Caption & Interactive Reaction Bar */}
            <div className="public-grand-canvas-bar">
              <div className="public-grand-canvas-bar-info">
                <span className="public-grand-canvas-bar-title">{activeArtwork.title}</span>
                <span className="public-grand-canvas-bar-author">
                  Họa sĩ: <strong>{author.name || 'Thành viên'}</strong>
                  {author.teamName && ` · Đội ${author.teamName}`}
                </span>
              </div>

              <div className="public-grand-canvas-bar-actions">
                <button
                  type="button"
                  className={`public-creative-heart-btn ${activeArtwork.hasLiked ? 'is-liked' : ''}`}
                  onClick={(e) => handleToggleLike(e, activeArtwork)}
                  title="Nhấn để thả tim"
                >
                  <Heart
                    size={17}
                    className="public-heart-btn-icon"
                    fill={activeArtwork.hasLiked ? '#ef4444' : 'none'}
                    stroke={activeArtwork.hasLiked ? '#ef4444' : 'currentColor'}
                    strokeWidth={2}
                  />
                  <span>Thả tim ({displayScore(activeArtwork.likesCount)})</span>
                </button>

                <button
                  type="button"
                  className="public-creative-btn-secondary"
                  onClick={(e) => handleDownloadArtwork(e, activeArtwork)}
                >
                  <Download size={15} />
                  <span>Tải ảnh PNG</span>
                </button>

                <Link to="/games/drawing" className="public-editorial-link public-grand-canvas-cta">
                  <span>Vẽ tác phẩm mới</span>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. EXHIBITION GALLERY STRIP: BỘ SƯU TẬP TÁC PHẨM */}
      {drawings.length > 1 && (
        <div className="public-creative-strip-section">
          <div className="public-creative-strip-header">
            <h3 className="public-creative-strip-title">
              <span>Thư viện tác phẩm · 3Win Media Studio</span>
            </h3>
            <span className="public-creative-strip-sub">
              Nhấn vào bất kỳ tranh nào trong thư viện để chuyển sang xem bản vẽ khổ lớn và thông tin tác giả
            </span>
          </div>

          <div className="public-creative-strip-grid">
            {drawings.map((item, index) => {
              const isSelected = activeArtwork?.id === item.id;
              const itemAuthor = item.author || {};
              return (
                <div
                  key={item.id}
                  className={`public-creative-card ${isSelected ? 'is-active' : ''}`}
                  onClick={() => setSelectedIndex(index)}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedIndex(index);
                    }
                  }}
                >
                  <div className="public-creative-card-thumb">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      loading="lazy"
                      className="public-creative-card-img"
                    />
                    <span className="public-creative-card-rank">
                      <Medal size={13} />
                      <span>{filter === 'top' ? `#${index + 1}` : `${index + 1}`}</span>
                    </span>
                  </div>

                  <div className="public-creative-card-meta">
                    <h4 className="public-creative-card-title" title={item.title}>
                      {item.title}
                    </h4>
                    <div className="public-creative-card-footer">
                      <span className="public-creative-card-author">
                        {itemAuthor.name || 'Ẩn danh'}
                      </span>
                      <button
                        type="button"
                        className={`public-creative-mini-heart ${item.hasLiked ? 'is-liked' : ''}`}
                        onClick={(e) => handleToggleLike(e, item)}
                        title="Thả tim tác phẩm này"
                      >
                        <Heart
                          size={12}
                          className="public-mini-heart-icon"
                          fill={item.hasLiked ? '#ef4444' : 'none'}
                          stroke={item.hasLiked ? '#ef4444' : 'currentColor'}
                          strokeWidth={2}
                        />
                        <span>{displayScore(item.likesCount)}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Delete Confirmation Modal */}
      <AnimatedModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Xác nhận xóa tác phẩm"
        maxWidth={440}
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isDeleting}
              onClick={() => setShowDeleteConfirm(false)}
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
          Bạn có chắc chắn muốn gỡ bỏ tác phẩm "<b>{activeArtwork?.title}</b>" khỏi Thư Viện Tranh không? Thao tác này không thể hoàn tác.
        </p>
      </AnimatedModal>
    </Reveal>
  );
}
