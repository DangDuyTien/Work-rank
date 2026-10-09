import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Paintbrush,
  Eraser,
  PaintBucket,
  RotateCcw,
  RotateCw,
  Trash2,
  Download,
  Share2,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Palette as PaletteIcon,
  Image as ImageIcon,
  Eye,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { drawingApi } from '../services/api';
import { PageShell, Card, Button, AnimatedModal, Notice } from '../components/ui';

const PRESET_COLORS = [
  '#0f172a', // Slate Black
  '#334155', // Charcoal
  '#64748b', // Cool Grey
  '#e2e8f0', // Light Grey
  '#ffffff', // Pure White
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#84cc16', // Lime
  '#e11d48', // Crimson
];

const BRUSH_SIZES = [
  { size: 2, label: 'Siêu mảnh' },
  { size: 6, label: 'Mảnh' },
  { size: 12, label: 'Vừa' },
  { size: 22, label: 'Lớn' },
  { size: 38, label: 'Rất lớn' },
];

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 700;
const MAX_UNDO_STEPS = 25;

export default function DrawingGame() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const canvasRef = useRef(null);
  const contextRef = useRef(null);

  // Drawing state
  const [tool, setTool] = useState('brush'); // 'brush' | 'eraser' | 'fill'
  const [color, setColor] = useState('#0f172a');
  const [brushSize, setBrushSize] = useState(6);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPoint, setLastPoint] = useState(null);

  // History for Undo/Redo
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Preview & Publishing state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [artworkTitle, setArtworkTitle] = useState('');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Setup canvas resolution & 2D context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Fill background with clean white initially
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    contextRef.current = ctx;

    // Save initial blank state
    const initialState = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    setUndoStack([initialState]);
  }, []);

  // Save current canvas snapshot to undo stack
  const saveSnapshot = useCallback(() => {
    const ctx = contextRef.current;
    if (!ctx) return;
    const snapshot = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    setUndoStack((prev) => {
      const next = [...prev, snapshot];
      if (next.length > MAX_UNDO_STEPS) {
        next.shift();
      }
      return next;
    });
    setRedoStack([]); // Clear redo stack on new action
  }, []);

  // Undo action
  const handleUndo = useCallback(() => {
    if (undoStack.length <= 1) return;
    const ctx = contextRef.current;
    if (!ctx) return;

    const current = undoStack[undoStack.length - 1];
    const previous = undoStack[undoStack.length - 2];

    setRedoStack((prev) => [...prev, current]);
    setUndoStack((prev) => prev.slice(0, prev.length - 1));

    ctx.putImageData(previous, 0, 0);
  }, [undoStack]);

  // Redo action
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const ctx = contextRef.current;
    if (!ctx) return;

    const nextState = redoStack[redoStack.length - 1];

    setUndoStack((prev) => [...prev, nextState]);
    setRedoStack((prev) => prev.slice(0, prev.length - 1));

    ctx.putImageData(nextState, 0, 0);
  }, [redoStack]);

  // Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Translate client coordinates to internal canvas coordinates
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // Flood Fill / Paint Bucket Algorithm
  const floodFill = (startX, startY, fillColor) => {
    const ctx = contextRef.current;
    if (!ctx) return;

    const imgData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const data = imgData.data;

    // Parse target fill color
    const tempEl = document.createElement('div');
    tempEl.style.color = fillColor;
    document.body.appendChild(tempEl);
    const rgbStr = window.getComputedStyle(tempEl).color;
    document.body.removeChild(tempEl);
    const match = rgbStr.match(/\d+/g);
    const fillR = parseInt(match[0], 10);
    const fillG = parseInt(match[1], 10);
    const fillB = parseInt(match[2], 10);
    const fillA = 255;

    const pixelPos = (Math.floor(startY) * CANVAS_WIDTH + Math.floor(startX)) * 4;
    const startR = data[pixelPos];
    const startG = data[pixelPos + 1];
    const startB = data[pixelPos + 2];
    const startA = data[pixelPos + 3];

    // Already the same color
    if (
      Math.abs(startR - fillR) < 5 &&
      Math.abs(startG - fillG) < 5 &&
      Math.abs(startB - fillB) < 5 &&
      Math.abs(startA - fillA) < 5
    ) {
      return;
    }

    const matchColor = (pos) => {
      const r = data[pos];
      const g = data[pos + 1];
      const b = data[pos + 2];
      const a = data[pos + 3];
      return (
        Math.abs(r - startR) <= 32 &&
        Math.abs(g - startG) <= 32 &&
        Math.abs(b - startB) <= 32 &&
        Math.abs(a - startA) <= 32
      );
    };

    const colorPixel = (pos) => {
      data[pos] = fillR;
      data[pos + 1] = fillG;
      data[pos + 2] = fillB;
      data[pos + 3] = fillA;
    };

    const queue = [[Math.floor(startX), Math.floor(startY)]];
    const visited = new Uint8Array(CANVAS_WIDTH * CANVAS_HEIGHT);

    while (queue.length > 0) {
      const [curX, curY] = queue.pop();
      if (curX < 0 || curX >= CANVAS_WIDTH || curY < 0 || curY >= CANVAS_HEIGHT) continue;

      const idx = curY * CANVAS_WIDTH + curX;
      if (visited[idx]) continue;
      visited[idx] = 1;

      const pos = idx * 4;
      if (!matchColor(pos)) continue;

      colorPixel(pos);

      if (curX + 1 < CANVAS_WIDTH && !visited[idx + 1]) queue.push([curX + 1, curY]);
      if (curX - 1 >= 0 && !visited[idx - 1]) queue.push([curX - 1, curY]);
      if (curY + 1 < CANVAS_HEIGHT && !visited[idx + CANVAS_WIDTH]) queue.push([curX, curY + 1]);
      if (curY - 1 >= 0 && !visited[idx - 1]) queue.push([curX, curY - 1]);
    }

    ctx.putImageData(imgData, 0, 0);
    saveSnapshot();
  };

  // Pointer Down (Start drawing)
  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const coords = getCoordinates(e);

    if (tool === 'fill') {
      floodFill(coords.x, coords.y, color);
      return;
    }

    const ctx = contextRef.current;
    if (!ctx) return;

    setIsDrawing(true);
    setLastPoint(coords);

    ctx.beginPath();
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = brushSize;
    ctx.moveTo(coords.x, coords.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  // Pointer Move (Draw smoothly)
  const handlePointerMove = (e) => {
    if (!isDrawing || tool === 'fill') return;
    const ctx = contextRef.current;
    if (!ctx || !lastPoint) return;

    const currentPoint = getCoordinates(e);

    ctx.beginPath();
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = brushSize;
    ctx.moveTo(lastPoint.x, lastPoint.y);

    const midPoint = {
      x: (lastPoint.x + currentPoint.x) / 2,
      y: (lastPoint.y + currentPoint.y) / 2,
    };
    ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, midPoint.x, midPoint.y);
    ctx.stroke();

    setLastPoint(currentPoint);
  };

  // Pointer Up / Leave (End drawing)
  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setLastPoint(null);
    saveSnapshot();
  };

  // Clear entire canvas
  const handleClearCanvas = () => {
    const ctx = contextRef.current;
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    saveSnapshot();
    setShowClearConfirmModal(false);
  };

  // Download artwork locally as PNG
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `workrank-art-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  // Open Finish & Preview Modal
  const handleOpenPreview = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    setPreviewImageUrl(dataUrl);

    const now = new Date();
    const defaultTitle = `Tác phẩm ${now.toLocaleDateString('vi-VN')} · ${now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    if (!artworkTitle) {
      setArtworkTitle(defaultTitle);
    }

    setPublishSuccess(false);
    setErrorMessage('');
    setShowPreviewModal(true);
  };

  // Submit & Publish to WorkRank
  const handlePublish = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      setIsPublishing(true);
      setErrorMessage('');

      const blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png');
      });

      if (!blob) {
        throw new Error('Không thể xuất hình ảnh từ canvas.');
      }

      const formData = new FormData();
      formData.append('image', blob, 'artwork.png');
      formData.append('title', artworkTitle.trim() || 'Tác phẩm không tên');
      formData.append('width', String(CANVAS_WIDTH));
      formData.append('height', String(CANVAS_HEIGHT));
      formData.append('visibility', visibility);
      formData.append('metadata', JSON.stringify({
        drawnAt: new Date().toISOString(),
        toolUsed: 'WorkRank Creative Canvas',
      }));

      await drawingApi.createDrawing(formData);

      setPublishSuccess(true);
    } catch (err) {
      console.error('Lỗi chia sẻ tác phẩm:', err);
      const msg = err.response?.data?.message || err.message || 'Không thể chia sẻ tác phẩm. Vui lòng thử lại.';
      setErrorMessage(msg);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <PageShell className="drawing-game-shell">
      {/* Top Header */}
      <div className="drawing-header">
        <div className="drawing-header__left">
          <Link to="/games" className="drawing-back-btn">
            <ArrowLeft size={16} />
            <span>Trò chơi</span>
          </Link>
          <div className="drawing-header__title-group">
            <div className="drawing-badge">
              <Sparkles size={13} />
              <span>Góc Sáng Tạo</span>
            </div>
            <h1 className="drawing-title">Game Vẽ Tranh WorkRank</h1>
          </div>
        </div>

        <div className="drawing-header__actions">
          <Link to="/" className="drawing-view-gallery-btn">
            <ImageIcon size={15} />
            <span>Xem góc sáng tạo trên Home</span>
          </Link>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleOpenPreview}
            className="drawing-finish-btn"
          >
            <Sparkles size={16} />
            <span>Hoàn thành tác phẩm</span>
          </Button>
        </div>
      </div>

      {/* Main Drawing Stage (LARGE CANVAS CENTERPIECE) */}
      <div className="drawing-stage-container">
        <div className="drawing-canvas-wrapper">
          <canvas
            ref={canvasRef}
            className={`drawing-canvas tool-${tool}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ touchAction: 'none' }}
          />
        </div>
      </div>

      {/* Compact Creative Toolbar (Under the canvas) */}
      <div className="drawing-toolbar-container">
        <div className="drawing-toolbar">
          {/* Tool selectors */}
          <div className="toolbar-group">
            <button
              type="button"
              className={`tool-btn ${tool === 'brush' ? 'is-active' : ''}`}
              onClick={() => setTool('brush')}
              title="Cọ vẽ (Brush)"
              aria-label="Cọ vẽ"
            >
              <Paintbrush size={18} />
              <span className="tool-label">Cọ</span>
            </button>
            <button
              type="button"
              className={`tool-btn ${tool === 'eraser' ? 'is-active' : ''}`}
              onClick={() => setTool('eraser')}
              title="Cục tẩy (Eraser)"
              aria-label="Cục tẩy"
            >
              <Eraser size={18} />
              <span className="tool-label">Tẩy</span>
            </button>
            <button
              type="button"
              className={`tool-btn ${tool === 'fill' ? 'is-active' : ''}`}
              onClick={() => setTool('fill')}
              title="Đổ màu (Paint Bucket)"
              aria-label="Đổ màu"
            >
              <PaintBucket size={18} />
              <span className="tool-label">Đổ màu</span>
            </button>
          </div>

          <div className="toolbar-divider" />

          {/* Brush sizes */}
          <div className="toolbar-group sizes-group">
            <span className="toolbar-group-label">Nét:</span>
            {BRUSH_SIZES.map((b) => (
              <button
                key={b.size}
                type="button"
                className={`size-btn ${brushSize === b.size ? 'is-active' : ''}`}
                onClick={() => setBrushSize(b.size)}
                title={`${b.label} (${b.size}px)`}
                aria-label={b.label}
              >
                <span
                  className="size-dot"
                  style={{
                    width: Math.max(4, Math.min(22, b.size * 0.75)),
                    height: Math.max(4, Math.min(22, b.size * 0.75)),
                    backgroundColor: tool === 'eraser' ? '#94a3b8' : color,
                  }}
                />
              </button>
            ))}
          </div>

          <div className="toolbar-divider" />

          {/* Color swatches + Custom Color Picker */}
          <div className="toolbar-group colors-group">
            <div className="color-swatches">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch ${color === c && tool !== 'eraser' ? 'is-active' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => {
                    setColor(c);
                    if (tool === 'eraser') setTool('brush');
                  }}
                  title={c}
                  aria-label={`Màu ${c}`}
                />
              ))}
            </div>

            {/* Native Color Picker */}
            <label className="custom-color-picker" title="Chọn màu tự do">
              <input
                type="color"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  if (tool === 'eraser') setTool('brush');
                }}
                className="sr-only"
              />
              <div className="color-wheel-btn" style={{ borderColor: color }}>
                <PaletteIcon size={14} style={{ color }} />
              </div>
            </label>
          </div>

          <div className="toolbar-divider" />

          {/* Undo, Redo, Clear & Download */}
          <div className="toolbar-group actions-group">
            <button
              type="button"
              className="action-btn"
              onClick={handleUndo}
              disabled={undoStack.length <= 1}
              title="Hoàn tác (Ctrl+Z)"
              aria-label="Hoàn tác"
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              className="action-btn"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              title="Làm lại (Ctrl+Y)"
              aria-label="Làm lại"
            >
              <RotateCw size={16} />
            </button>
            <button
              type="button"
              className="action-btn"
              onClick={handleDownload}
              title="Tải ảnh về máy"
              aria-label="Tải ảnh về máy"
            >
              <Download size={16} />
            </button>
            <button
              type="button"
              className="action-btn danger"
              onClick={() => setShowClearConfirmModal(true)}
              title="Xóa toàn bộ tranh"
              aria-label="Xóa toàn bộ tranh"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      <AnimatedModal
        isOpen={showClearConfirmModal}
        onClose={() => setShowClearConfirmModal(false)}
        title="Xác nhận làm mới khung vẽ"
        maxWidth={440}
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowClearConfirmModal(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleClearCanvas}
            >
              Xóa bảng vẽ
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Bạn có chắc chắn muốn xóa toàn bộ nét vẽ và làm mới khung tranh không? Thao tác này sẽ đặt lại khung vẽ về màu trắng ban đầu.
        </p>
      </AnimatedModal>

      {/* Preview & Save Modal */}
      <AnimatedModal
        isOpen={showPreviewModal}
        onClose={() => {
          if (!isPublishing) setShowPreviewModal(false);
        }}
        title="Xem trước tác phẩm &amp; Hoàn thành"
        maxWidth={720}
        actions={
          publishSuccess ? (
            <div style={{ display: 'flex', gap: 10, width: '100%', justifyContent: 'flex-end' }}>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => {
                  setShowPreviewModal(false);
                  handleClearCanvas();
                }}
              >
                Vẽ tác phẩm mới 🎨
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => navigate('/')}
              >
                Xem Thư Viện Tranh trên Home
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, width: '100%', justifyContent: 'flex-end' }}>
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={isPublishing}
                onClick={() => setShowPreviewModal(false)}
              >
                Tiếp tục chỉnh sửa
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={isPublishing}
                onClick={handlePublish}
                className="share-submit-btn"
              >
                {isPublishing ? (
                  <>
                    <span className="ui-spinner ui-spinner--sm" />
                    <span>Đang lưu tác phẩm...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Lưu &amp; Hoàn thành tác phẩm</span>
                  </>
                )}
              </Button>
            </div>
          )
        }
      >
        {publishSuccess ? (
          <div className="publish-success-state">
            <CheckCircle2 size={54} className="publish-success-icon" />
            <h2 className="publish-success-title">Tác phẩm đã được lưu thành công!</h2>
            <p className="publish-success-desc">
              Tác phẩm của bạn đã được đưa vào <b>Thư Viện Tranh</b>. Mọi người trong công ty có thể chiêm ngưỡng và thả tim cho bạn!
            </p>
            <div className="publish-preview-card">
              <img src={previewImageUrl} alt={artworkTitle} className="publish-preview-img" />
              <div className="publish-preview-info">
                <div className="publish-preview-title">{artworkTitle}</div>
                <div className="publish-preview-author">Tác giả: {user?.name || 'Bạn'}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="drawing-preview-form">
            {errorMessage && (
              <Notice type="error" className="preview-error-notice">
                {errorMessage}
              </Notice>
            )}

            <div className="preview-image-container">
              <img
                src={previewImageUrl}
                alt="Artwork Preview"
                className="preview-artwork-image"
              />
            </div>

            <div className="preview-form-fields">
              <div className="form-group">
                <label htmlFor="artwork-title" className="form-label">
                  Tên tác phẩm:
                </label>
                <input
                  id="artwork-title"
                  type="text"
                  value={artworkTitle}
                  onChange={(e) => setArtworkTitle(e.target.value)}
                  placeholder="Nhập tên tác phẩm nghệ thuật..."
                  maxLength={120}
                  className="form-input"
                  autoFocus
                />
                <span className="form-hint">
                  Tên tác phẩm sẽ xuất hiện nổi bật cùng tên tác giả trong Thư Viện Tranh.
                </span>
              </div>

              <div className="author-info-card">
                <div className="author-avatar">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} />
                  ) : (
                    <span>{(user?.name || 'U').charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <div className="author-name">{user?.name || 'Thành viên WorkRank'}</div>
                  <div className="author-role">{user?.jobTitle || user?.department || 'Tác giả sáng tạo'}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatedModal>
    </PageShell>
  );
}
