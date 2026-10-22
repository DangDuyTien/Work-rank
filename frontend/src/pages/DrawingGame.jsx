import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Paintbrush,
  Eraser,
  PaintBucket,
  Hand,
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
  ZoomIn,
  ZoomOut,
  Maximize2,
  Keyboard,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { drawingApi } from '../services/api';
import { loadDrawingDraft, saveDrawingDraft, removeDrawingDraft } from '../utils/drawingDraft';
import { resolveAssetUrl } from '../utils/assetUrl';
import { PlayerAvatar2D } from '../components/arcade/ArcadeArt';
import '../components/arcade/arcade.css';
import '../components/arcade/drawing-arcade.css';
import { PageShell, Button, AnimatedModal, Notice } from '../components/ui';

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
// Khớp giới hạn backend (utils/imageValidation.js).
const MAX_PUBLISH_BYTES = 8 * 1024 * 1024;
// Tranh nét mảnh nén PNG rất tốt; chỉ khi vượt ngưỡng này mới thử WebP q=0.92
// để không bao giờ chạm trần 8MB mà vẫn giữ chi tiết.
const WEBP_FALLBACK_THRESHOLD = 3.5 * 1024 * 1024;

export default function DrawingGame() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const viewportRef = useRef(null);

  // Drawing state
  const [tool, setTool] = useState('brush'); // 'brush' | 'eraser' | 'select' | 'fill'
  const [color, setColor] = useState('#0f172a');
  const [brushSize, setBrushSize] = useState(6);

  // Viewport Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  // Fast synchronous refs for drawing & interaction loop (bypasses React re-render lag)
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const brushSizeRef = useRef(brushSize);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const lastMidPointRef = useRef(null);
  const pointsCountRef = useRef(0);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const isSpacePressedRef = useRef(false);

  // History for Undo/Redo (using refs for synchronous responsiveness + state for UI button disabled states)
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Preview & Publishing state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [artworkTitle, setArtworkTitle] = useState('');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [publishingAvailable,setPublishingAvailable]=useState(null);
  useEffect(()=>{let active=true;drawingApi.getSettings().then(data=>{if(active)setPublishingAvailable(data.publishing?.available ?? null);}).catch(()=>{});return()=>{active=false;};},[]);
  const [draftStatus,setDraftStatus]=useState('loading'),[publishedArtwork,setPublishedArtwork]=useState(null),[uploadPercent,setUploadPercent]=useState(0),[publishStage,setPublishStage]=useState('');
  const draftTimer=useRef(null),draftReady=useRef(false),draftRevision=useRef(0),publicationId=useRef(null),draftMeta=useRef(null);
  // Chặn double-click Publish: state isPublishing chỉ đổi sau khi React commit,
  // nên một cú double-click rất nhanh vẫn có thể lọt hai request.
  const publishingRef=useRef(false);
  if(!publicationId.current)publicationId.current=crypto.randomUUID();
  draftMeta.current={title:artworkTitle,visibility,tool,color,brushSize};
  const persistDraftNow=useCallback(async()=>{
    clearTimeout(draftTimer.current);draftTimer.current=null;
    if(!canvasRef.current || !draftReady.current)return;
    const revision=draftRevision.current,meta={...draftMeta.current,publicationId:publicationId.current};
    const blob=await new Promise(resolve=>canvasRef.current.toBlob(resolve,'image/png'));
    if(!blob || revision!==draftRevision.current)return;
    await saveDrawingDraft(user.id,{...meta,blob,savedAt:Date.now()});
    if(revision===draftRevision.current)setDraftStatus('saved');
  },[user.id]);
  const queueDraft=useCallback((pixelsChanged=false)=>{
    if(!draftReady.current)return;
    if(pixelsChanged){publicationId.current=crypto.randomUUID();setPublishedArtwork(null);}
    draftRevision.current++;setDraftStatus('saving');clearTimeout(draftTimer.current);
    draftTimer.current=setTimeout(()=>persistDraftNow().catch(()=>setDraftStatus('unavailable')),400);
  },[persistDraftNow]);
  useEffect(()=>{if(draftReady.current&&!publishedArtwork)queueDraft();},[artworkTitle,visibility,tool,color,brushSize,queueDraft,publishedArtwork]);
  useEffect(()=>()=>{clearTimeout(draftTimer.current);},[]);
  // Chỉ cảnh báo rời trang trong khoảng debounce 400ms khi nét mới chưa kịp
  // ghi xuống IndexedDB — không chặn người dùng bằng popup vô cớ.
  useEffect(()=>{
    const guard=(event)=>{if(draftStatus!=='saving')return;event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',guard);
    return()=>window.removeEventListener('beforeunload',guard);
  },[draftStatus]);


  // Synchronize state changes to refs immediately and synchronously
  const changeTool = useCallback((nextTool) => {
    toolRef.current = nextTool;
    setTool(nextTool);
  }, []);

  const changeColor = useCallback((nextColor) => {
    colorRef.current = nextColor;
    setColor(nextColor);
  }, []);

  const changeBrushSize = useCallback((nextSize) => {
    brushSizeRef.current = nextSize;
    setBrushSize(nextSize);
  }, []);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    brushSizeRef.current = brushSize;
  }, [brushSize]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  // Translate client coordinates to internal canvas coordinates
  // Works identically regardless of zoom level, pan position, or screen scale
  const getCoordinates = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    };
  }, []);

  // Stroke context styling helper
  const applyStrokeContext = (ctx, activeTool, activeColor, activeBrushSize) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = activeBrushSize;
    if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
      ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = activeColor;
      ctx.fillStyle = activeColor;
    }
  };

  // Setup canvas resolution, 2D context & initial centered placement
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Clear canvas to pristine transparent state (revealing white board beneath)
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    contextRef.current = ctx;

    let active=true;
    loadDrawingDraft(user.id).then(draft=>{
      if(!active)return;
      if(!draft?.blob){draftReady.current=true;setDraftStatus('empty');return;}
      const image=new Image(),url=URL.createObjectURL(draft.blob);
      image.onload=()=>{URL.revokeObjectURL(url);if(!active)return;ctx.clearRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);ctx.drawImage(image,0,0);
        undoStackRef.current=[ctx.getImageData(0,0,CANVAS_WIDTH,CANVAS_HEIGHT)];redoStackRef.current=[];
        publicationId.current=draft.publicationId||crypto.randomUUID();setArtworkTitle(draft.title||'');setVisibility(draft.visibility||'PUBLIC');
        draftReady.current=true;setDraftStatus('restored');};
      image.onerror=()=>{URL.revokeObjectURL(url);draftReady.current=true;setDraftStatus('unavailable');};image.src=url;
    }).catch(()=>{draftReady.current=true;setDraftStatus('unavailable');});

    // Save initial blank state
    const initialState = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    undoStackRef.current = [initialState];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);

    // Calculate initial centered fit within viewport
    if (viewportRef.current) {
      const vpRect = viewportRef.current.getBoundingClientRect();
      const fitZoom = Math.min(1, Math.min((vpRect.width - 32) / CANVAS_WIDTH, (vpRect.height - 32) / CANVAS_HEIGHT));
      const initialZoom = Math.max(0.1, Math.round(fitZoom * 100) / 100);
      const initialX = Math.round((vpRect.width - CANVAS_WIDTH * initialZoom) / 2);
      const initialY = Math.round((vpRect.height - CANVAS_HEIGHT * initialZoom) / 2);
      setZoom(initialZoom);
      setPan({ x: initialX, y: initialY });
    }
    return()=>{active=false;draftReady.current=false;};
  }, [user.id]);

  // Save current canvas snapshot to undo stack
  const saveSnapshot = useCallback(() => {
    const ctx = contextRef.current;
    if (!ctx) return;
    const snapshot = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > MAX_UNDO_STEPS) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    setCanUndo(undoStackRef.current.length > 1);
    setCanRedo(false);
    queueDraft(true);
  }, [queueDraft]);

  // Undo action (synchronous & instant)
  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length <= 1) return;
    const ctx = contextRef.current;
    if (!ctx) return;

    const current = undoStackRef.current.pop();
    redoStackRef.current.push(current);
    const previous = undoStackRef.current[undoStackRef.current.length - 1];

    ctx.putImageData(previous, 0, 0);
    setCanUndo(undoStackRef.current.length > 1);
    setCanRedo(redoStackRef.current.length > 0);
    queueDraft(true);
  }, [queueDraft]);

  // Redo action (synchronous & instant)
  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const ctx = contextRef.current;
    if (!ctx) return;

    const nextState = redoStackRef.current.pop();
    undoStackRef.current.push(nextState);

    ctx.putImageData(nextState, 0, 0);
    setCanUndo(undoStackRef.current.length > 1);
    setCanRedo(redoStackRef.current.length > 0);
    queueDraft(true);
  }, [queueDraft]);

  // Zoom management helper (centered at cursor position or viewport center)
  const updateZoom = useCallback((targetZoom, centerScreen) => {
    const clamped = Math.min(4.0, Math.max(0.1, Math.round(targetZoom * 100) / 100));
    const currentZoom = zoomRef.current;
    if (clamped === currentZoom) return;

    const ratio = clamped / currentZoom;
    const vp = viewportRef.current;

    let newPan = { ...panRef.current };
    if (centerScreen && vp) {
      const vpRect = vp.getBoundingClientRect();
      const cx = centerScreen.x - vpRect.left;
      const cy = centerScreen.y - vpRect.top;
      newPan = {
        x: Math.round(cx - (cx - panRef.current.x) * ratio),
        y: Math.round(cy - (cy - panRef.current.y) * ratio),
      };
    } else if (vp) {
      const vpRect = vp.getBoundingClientRect();
      const cx = vpRect.width / 2;
      const cy = vpRect.height / 2;
      newPan = {
        x: Math.round(cx - (cx - panRef.current.x) * ratio),
        y: Math.round(cy - (cy - panRef.current.y) * ratio),
      };
    }

    setZoom(clamped);
    setPan(newPan);
  }, []);

  const handleZoomIn = useCallback(() => {
    updateZoom(zoomRef.current * 1.25);
  }, [updateZoom]);

  const handleZoomOut = useCallback(() => {
    updateZoom(zoomRef.current * 0.8);
  }, [updateZoom]);

  const handleResetView = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const vpRect = vp.getBoundingClientRect();
    const fitZoom = Math.min(1, Math.min((vpRect.width - 32) / CANVAS_WIDTH, (vpRect.height - 32) / CANVAS_HEIGHT));
    const targetZoom = Math.max(0.1, Math.round(fitZoom * 100) / 100);
    const targetX = Math.round((vpRect.width - CANVAS_WIDTH * targetZoom) / 2);
    const targetY = Math.round((vpRect.height - CANVAS_HEIGHT * targetZoom) / 2);
    setZoom(targetZoom);
    setPan({ x: targetX, y: targetY });
  }, []);

  useEffect(() => {
    const viewport=viewportRef.current;
    if(!viewport)return;
    let frame;
    const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(handleResetView);});
    observer.observe(viewport);
    return()=>{observer.disconnect();cancelAnimationFrame(frame);};
  },[handleResetView]);

  // Wheel listener: Ctrl + Wheel for cursor-centered zoom; page scrolling preserved without Ctrl
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.87;
        updateZoom(zoomRef.current * factor, { x: e.clientX, y: e.clientY });
      }
    };

    vp.addEventListener('wheel', handleWheel, { passive: false });
    return () => vp.removeEventListener('wheel', handleWheel);
  }, [updateZoom]);

  // Keyboard shortcuts handler (P, E, V, Space, Ctrl+Z, Ctrl+Y, +, -, 0, Esc, ?)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Guard against text inputs, textareas, and editable fields
      const tag = (e.target.tagName || '').toUpperCase();
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.target.isContentEditable) {
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Undo: Ctrl/Cmd + Z
      if (isCtrlOrCmd && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Ctrl/Cmd + Shift + Z OR Ctrl/Cmd + Y
      if (
        (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'z') ||
        (isCtrlOrCmd && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Space: temporary pan mode (without triggering page scroll)
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        isSpacePressedRef.current = true;
        setIsSpacePressed(true);
        return;
      }

      // Zoom in: + or =
      if ((e.key === '+' || e.key === '=') && !isCtrlOrCmd) {
        e.preventDefault();
        handleZoomIn();
        return;
      }

      // Zoom out: - or _
      if ((e.key === '-' || e.key === '_') && !isCtrlOrCmd) {
        e.preventDefault();
        handleZoomOut();
        return;
      }

      // Reset view: 0
      if (e.key === '0' && !isCtrlOrCmd) {
        e.preventDefault();
        handleResetView();
        return;
      }

      // Tool shortcuts (single keys)
      if (!isCtrlOrCmd && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'p') {
          changeTool('brush');
        } else if (key === 'e') {
          changeTool('eraser');
        } else if (key === 'v') {
          changeTool('select');
        } else if (key === '?' || key === 'h') {
          setShowShortcutsModal((prev) => !prev);
        } else if (key === 'escape') {
          if (showShortcutsModal) setShowShortcutsModal(false);
          else if (showClearConfirmModal) setShowClearConfirmModal(false);
          else if (showPreviewModal && !isPublishing) setShowPreviewModal(false);
          else if (toolRef.current === 'select') changeTool('brush');
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        setIsSpacePressed(false);
      }
    };

    const handleBlur = () => {
      isSpacePressedRef.current = false;
      setIsSpacePressed(false);
      isPanningRef.current = false;
      setIsPanning(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [
    changeTool,
    handleUndo,
    handleRedo,
    handleZoomIn,
    handleZoomOut,
    handleResetView,
    showShortcutsModal,
    showClearConfirmModal,
    showPreviewModal,
    isPublishing,
  ]);

  // Flood Fill / Paint Bucket Algorithm (supports transparent & opaque pixels)
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
      startA === fillA &&
      Math.abs(startR - fillR) < 5 &&
      Math.abs(startG - fillG) < 5 &&
      Math.abs(startB - fillB) < 5
    ) {
      return;
    }

    const matchColor = (pos) => {
      const a = data[pos + 3];
      // If both are transparent, they match
      if (startA === 0 && a === 0) return true;
      // If one is transparent and other is opaque, they don't match
      if ((startA === 0 && a > 32) || (startA > 32 && a === 0)) return false;

      const r = data[pos];
      const g = data[pos + 1];
      const b = data[pos + 2];
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
      if (curY - 1 >= 0 && !visited[idx - CANVAS_WIDTH]) queue.push([curX, curY - 1]);
    }

    ctx.putImageData(imgData, 0, 0);
    saveSnapshot();
  };

  // Pointer Down (Draw or Pan)
  const handlePointerDown = (e) => {
    if (!draftReady.current || isPublishing) return;
    // Check for Pan modes:
    // 1. Middle mouse button (button === 1)
    // 2. Space key held down
    // 3. 'select' tool active
    if (e.button === 1 || isSpacePressedRef.current || toolRef.current === 'select') {
      e.preventDefault();
      isPanningRef.current = true;
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX - panRef.current.x,
        y: e.clientY - panRef.current.y,
      };
      if (e.currentTarget?.setPointerCapture) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch (_) {}
      }
      return;
    }

    // Left mouse button only for drawing / fill
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const coords = getCoordinates(e);

    if (toolRef.current === 'fill') {
      floodFill(coords.x, coords.y, colorRef.current);
      return;
    }

    const ctx = contextRef.current;
    if (!ctx) return;

    // Use Pointer Capture so fast movements never lose the stroke
    if (e.currentTarget?.setPointerCapture) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (_) {}
    }

    isDrawingRef.current = true;
    lastPointRef.current = coords;
    lastMidPointRef.current = coords;
    pointsCountRef.current = 1;

    // Render initial contact dot immediately
    ctx.save();
    applyStrokeContext(ctx, toolRef.current, colorRef.current, brushSizeRef.current);
    ctx.beginPath();
    ctx.arc(coords.x, coords.y, Math.max(0.5, brushSizeRef.current / 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Pointer Move (Smooth quadratic Bézier midpoint interpolation + coalesced event sampling)
  const handlePointerMove = (e) => {
    if (isPanningRef.current) {
      const newX = e.clientX - panStartRef.current.x;
      const newY = e.clientY - panStartRef.current.y;
      setPan({ x: newX, y: newY });
      return;
    }

    if (!isDrawingRef.current) return;
    const ctx = contextRef.current;
    if (!ctx || !lastPointRef.current) return;

    // Extract sub-frame coalesced pointer events for high-rate sampling
    const events =
      typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];

    const activeTool = toolRef.current;
    const activeColor = colorRef.current;
    const activeSize = brushSizeRef.current;

    ctx.save();
    applyStrokeContext(ctx, activeTool, activeColor, activeSize);

    for (let i = 0; i < events.length; i++) {
      const pt = getCoordinates(events[i]);
      const prev = lastPointRef.current;
      const dx = pt.x - prev.x;
      const dy = pt.y - prev.y;

      // Skip redundant zero-movement points (< 0.25px distance squared)
      if (dx * dx + dy * dy < 0.25) continue;

      const mid = {
        x: (prev.x + pt.x) / 2,
        y: (prev.y + pt.y) / 2,
      };

      // Quadratic curve from last midpoint through previous point to new midpoint
      // Guarantees 100% gap-free, continuous strokes at all speeds!
      ctx.beginPath();
      ctx.moveTo(lastMidPointRef.current.x, lastMidPointRef.current.y);
      ctx.quadraticCurveTo(prev.x, prev.y, mid.x, mid.y);
      ctx.stroke();

      lastMidPointRef.current = mid;
      lastPointRef.current = pt;
      pointsCountRef.current++;
    }

    ctx.restore();
  };

  // Pointer Up / Cancel (Stroke completion & snapshot saving)
  const handlePointerUp = (e) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsPanning(false);
      if (e?.currentTarget?.hasPointerCapture && e.currentTarget.hasPointerCapture(e.pointerId)) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
      return;
    }

    if (!isDrawingRef.current) return;

    const ctx = contextRef.current;
    if (ctx && lastPointRef.current && lastMidPointRef.current && pointsCountRef.current > 1) {
      // Complete stroke with final line to last point
      ctx.save();
      applyStrokeContext(ctx, toolRef.current, colorRef.current, brushSizeRef.current);
      ctx.beginPath();
      ctx.moveTo(lastMidPointRef.current.x, lastMidPointRef.current.y);
      ctx.lineTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.stroke();
      ctx.restore();
    }

    isDrawingRef.current = false;
    lastPointRef.current = null;
    lastMidPointRef.current = null;
    pointsCountRef.current = 0;

    if (e?.currentTarget?.hasPointerCapture && e.currentTarget.hasPointerCapture(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }

    saveSnapshot();
  };

  // Viewport background pointer down (allows panning on empty viewport workspace)
  const handleViewportPointerDown = (e) => {
    if (
      e.target === viewportRef.current ||
      e.button === 1 ||
      isSpacePressedRef.current ||
      toolRef.current === 'select'
    ) {
      e.preventDefault();
      isPanningRef.current = true;
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX - panRef.current.x,
        y: e.clientY - panRef.current.y,
      };
      if (viewportRef.current?.setPointerCapture) {
        try {
          viewportRef.current.setPointerCapture(e.pointerId);
        } catch (_) {}
      }
    }
  };

  // Clear entire canvas
  const handleClearCanvas = () => {
    const ctx = contextRef.current;
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    saveSnapshot();
    setShowClearConfirmModal(false);
  };

  // Helper to get composited canvas with pure white background for download/export/publish
  const getCompositedCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = CANVAS_WIDTH;
    exportCanvas.height = CANVAS_HEIGHT;
    const expCtx = exportCanvas.getContext('2d');
    // Solid white paper background
    expCtx.fillStyle = '#ffffff';
    expCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    // Draw current artwork
    expCtx.drawImage(canvas, 0, 0);
    return exportCanvas;
  }, []);

  /**
   * Xuất bản đăng: PNG lossless (giữ đúng nét vẽ). Nếu PNG vượt ngưỡng, thử
   * WebP q=0.92; nếu vẫn vượt trần 8MB thì báo lỗi rõ thay vì để backend 413.
   */
  const exportArtworkBlob = useCallback(async () => {
    const exportCanvas = getCompositedCanvas();
    if (!exportCanvas) throw new Error('Không thể xuất hình ảnh từ canvas.');

    const toBlob = (type, quality) =>
      new Promise((resolve) => exportCanvas.toBlob(resolve, type, quality));

    let blob = await toBlob('image/png');
    if (!blob) throw new Error('Không thể xuất hình ảnh từ canvas.');

    if (blob.size > WEBP_FALLBACK_THRESHOLD) {
      const webp = await toBlob('image/webp', 0.92);
      // Safari có thể trả PNG dù xin WebP → chỉ nhận khi đúng định dạng và nhẹ hơn.
      if (webp && webp.type === 'image/webp' && webp.size < blob.size) blob = webp;
    }

    if (blob.size > MAX_PUBLISH_BYTES) {
      throw new Error(
        'Tranh vượt quá 8MB nên chưa thể đăng. Hãy bớt chi tiết ảnh hoặc tải bản PNG về máy.'
      );
    }

    const mime = blob.type || 'image/png';
    const ext = mime === 'image/webp' ? 'webp' : mime === 'image/jpeg' ? 'jpg' : 'png';
    return { blob, mime, ext };
  }, [getCompositedCanvas]);

  // Download artwork locally as PNG
  const handleDownload = () => {
    const exportCanvas = getCompositedCanvas();
    if (!exportCanvas) return;

    const dataUrl = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `workrank-art-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  // Open Finish & Preview Modal
  const handleOpenPreview = () => {
    const exportCanvas = getCompositedCanvas();
    if (!exportCanvas) return;

    const dataUrl = exportCanvas.toDataURL('image/png');
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
    if (publishingRef.current) return;
    publishingRef.current = true;

    try {
      setIsPublishing(true);setUploadPercent(0);setPublishStage('Đang giữ bản nháp trên thiết bị…');
      setErrorMessage('');
      await persistDraftNow().catch(()=>setDraftStatus('unavailable'));

      setPublishStage('Đang chuẩn bị ảnh…');
      const { blob, mime, ext } = await exportArtworkBlob();

      const formData = new FormData();
      formData.append('image', blob, `artwork.${ext}`);
      formData.append('publicationId',publicationId.current);
      formData.append('title', artworkTitle.trim() || 'Tác phẩm không tên');
      formData.append('width', String(CANVAS_WIDTH));
      formData.append('height', String(CANVAS_HEIGHT));
      formData.append('visibility', visibility);
      formData.append(
        'metadata',
        JSON.stringify({
          drawnAt: new Date().toISOString(),
          toolUsed: 'WorkRank Creative Canvas Studio',
          exportedMime: mime,
        })
      );

      setPublishStage('Đang tải ảnh lên hệ thống…');
      const created=await drawingApi.createDrawing(formData,event=>setUploadPercent(event.total?Math.min(90,Math.round(event.loaded/event.total*90)):0));
      setUploadPercent(92);setPublishStage('Đang xác minh bản ghi và ảnh đã lưu…');
      const confirmed=(await drawingApi.getById(created.drawing.id)).drawing;
      const remoteUrl=resolveAssetUrl(confirmed.imageUrl);
      await new Promise((resolve,reject)=>{const image=new Image(),timer=setTimeout(()=>reject(new Error('Đã gửi tác phẩm nhưng chưa xác minh được ảnh. Hãy thử lại; bản nháp vẫn còn.')),15000);
        image.onload=()=>{clearTimeout(timer);resolve();};image.onerror=()=>{clearTimeout(timer);reject(new Error('Chưa tải lại được ảnh từ kho lưu trữ. Hãy thử lại; bản nháp vẫn còn.'));};image.src=remoteUrl;});
      setPreviewImageUrl(remoteUrl);setArtworkTitle(confirmed.title);setPublishedArtwork(confirmed);setUploadPercent(100);setPublishStage('Đã đăng lên Thư viện');
      await removeDrawingDraft(user.id).catch(()=>{});setDraftStatus('published');
      setPublishSuccess(true);
    } catch (err) {
      console.error('Lỗi chia sẻ tác phẩm:', err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Không thể chia sẻ tác phẩm. Vui lòng thử lại.';
      setErrorMessage(msg);
    } finally {
      publishingRef.current = false;
      setIsPublishing(false);
    }
  };

  const zoomPercent = Math.round(zoom * 100);

  return (
    <PageShell className="drawing-game-shell">
      {/* Top Header */}
      <div className="drawing-header">
        <div className="drawing-header__left">
          <Link to="/games" className="drawing-back-btn">
            <ArrowLeft size={16} />
            <span>Trò chơi</span>
          </Link>
          <div className="drawing-companion" data-published={!!publishedArtwork}><PlayerAvatar2D player={{userId:user.id,name:user.name,avatarUrl:user.avatarUrl,position:1}} state={publishedArtwork?'win':'ready'} feedbackId={tool}/></div>
          <div className="drawing-header__title-group">
            <div className="drawing-badge">
              <Sparkles size={13} />
              <span>WORK RANK ARCADE · GÓC SÁNG TẠO</span>
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

      <div className="drawing-save-hud" data-state={draftStatus} role="status"><span>{publishedArtwork?`✓ Đã đăng tranh lên Thư viện · Tác phẩm #${publishedArtwork.id}`:draftStatus==='loading'?'Đang mở bản nháp…':draftStatus==='saving'?'Đang lưu bản nháp trên thiết bị…':draftStatus==='restored'?'Đã khôi phục bản nháp trên thiết bị · Chưa đăng':draftStatus==='unavailable'?'Không lưu được bản nháp trên thiết bị · Hãy tải PNG để giữ tranh':'Đã lưu bản nháp trên thiết bị · Chưa đăng lên Thư viện'}</span><Link to="/creative-corner">Thư viện tranh →</Link></div>
      {publishingAvailable===false&&<Notice type="info">Hiện chưa thể đăng tranh lên hệ thống. Bạn vẫn có thể vẽ, giữ nháp trên thiết bị và tải bản PNG.</Notice>}
      {/* Main Drawing Stage (WHITEBOARD VIEWPORT WITH ZOOM & PAN) */}
      <div className="drawing-stage-container">
        <div
          ref={viewportRef}
          className={`drawing-viewport tool-${tool} ${isPanning ? 'is-panning' : ''} ${isSpacePressed ? 'is-space-pressed' : ''}`}
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Zoomable / Pannable Board Layer */}
          <div
            className="drawing-canvas-layer"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            <div className="drawing-canvas-card">
              <canvas
                ref={canvasRef}
                className="drawing-canvas"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{ touchAction: 'none' }}
              />
            </div>
          </div>

          {/* Floating Zoom & View HUD in corner */}
          <div className="drawing-viewport-hud">
            <button
              type="button"
              className="hud-btn"
              onClick={handleZoomOut}
              title="Thu nhỏ (-)"
              aria-label="Thu nhỏ"
            >
              <ZoomOut size={15} />
            </button>
            <span
              className="hud-zoom-badge"
              onClick={handleResetView}
              title="Nhấn để đặt lại góc nhìn 100% (0)"
            >
              {zoomPercent}%
            </span>
            <button
              type="button"
              className="hud-btn"
              onClick={handleZoomIn}
              title="Phóng to (+)"
              aria-label="Phóng to"
            >
              <ZoomIn size={15} />
            </button>
            <div className="hud-divider" />
            <button
              type="button"
              className="hud-btn"
              onClick={handleResetView}
              title="Đặt lại khung nhìn (0)"
              aria-label="Đặt lại khung nhìn"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Compact Creative Toolbar */}
      <div className="drawing-toolbar-container">
        <div className="drawing-toolbar">
          {/* Tool selectors (Brush, Eraser, Move/Pan, Fill) */}
          <div className="toolbar-group">
            <button
              type="button"
              className={`tool-btn ${tool === 'brush' ? 'is-active' : ''}`}
              onClick={() => changeTool('brush')}
              title="Cọ vẽ (P)"
              aria-label="Cọ vẽ"
            >
              <Paintbrush size={18} />
              <span className="tool-label">Cọ</span>
            </button>
            <button
              type="button"
              className={`tool-btn ${tool === 'eraser' ? 'is-active' : ''}`}
              onClick={() => changeTool('eraser')}
              title="Cục tẩy (E)"
              aria-label="Cục tẩy"
            >
              <Eraser size={18} />
              <span className="tool-label">Tẩy</span>
            </button>
            <button
              type="button"
              className={`tool-btn ${tool === 'select' ? 'is-active' : ''}`}
              onClick={() => changeTool('select')}
              title="Di chuyển canvas (V hoặc Giữ Space)"
              aria-label="Di chuyển canvas"
            >
              <Hand size={18} />
              <span className="tool-label">Di chuyển</span>
            </button>
            <button
              type="button"
              className={`tool-btn ${tool === 'fill' ? 'is-active' : ''}`}
              onClick={() => changeTool('fill')}
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
                onClick={() => changeBrushSize(b.size)}
                title={`${b.label} (${b.size}px)`}
                aria-label={b.label}
              >
                <span
                  className="size-dot"
                  style={{
                    width: Math.max(4, Math.min(22, b.size * 0.75)),
                    height: Math.max(4, Math.min(22, b.size * 0.75)),
                    backgroundColor: tool === 'eraser' ? '#ef4444' : color,
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
                    changeColor(c);
                    if (tool === 'eraser' || tool === 'select') changeTool('brush');
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
                  changeColor(e.target.value);
                  if (tool === 'eraser' || tool === 'select') changeTool('brush');
                }}
                className="sr-only"
              />
              <div className="color-wheel-btn" style={{ borderColor: color }}>
                <PaletteIcon size={14} style={{ color }} />
              </div>
            </label>
          </div>

          <div className="toolbar-divider" />

          {/* Undo, Redo, Zoom, Clear, Download & Shortcuts Help */}
          <div className="toolbar-group actions-group">
            <button
              type="button"
              className="action-btn"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Hoàn tác (Ctrl+Z)"
              aria-label="Hoàn tác"
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              className="action-btn"
              onClick={handleRedo}
              disabled={!canRedo}
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
            <button
              type="button"
              className="action-btn"
              onClick={() => setShowShortcutsModal(true)}
              title="Bảng phím tắt (? hoặc H)"
              aria-label="Bảng phím tắt"
            >
              <Keyboard size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Shortcuts Help Modal */}
      <AnimatedModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
        title="Phím tắt Whiteboard"
        maxWidth={500}
        actions={
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setShowShortcutsModal(false)}
          >
            Đã hiểu
          </Button>
        }
      >
        <div className="shortcuts-modal-grid">
          <div className="shortcut-row">
            <span className="shortcut-label">Cọ vẽ</span>
            <div className="shortcut-keys">
              <kbd className="shortcut-kbd">P</kbd>
            </div>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-label">Cục tẩy</span>
            <div className="shortcut-keys">
              <kbd className="shortcut-kbd">E</kbd>
            </div>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-label">Di chuyển bảng vẽ (Pan)</span>
            <div className="shortcut-keys">
              <kbd className="shortcut-kbd">V</kbd>
            </div>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-label">Di chuyển nhanh</span>
            <div className="shortcut-keys">
              <kbd className="shortcut-kbd">Space</kbd>
              <span className="shortcut-plus">+</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Kéo chuột</span>
            </div>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-label">Di chuyển bằng chuột giữa</span>
            <div className="shortcut-keys">
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Chuột giữa + Kéo</span>
            </div>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-label">Thu phóng quanh con trỏ</span>
            <div className="shortcut-keys">
              <kbd className="shortcut-kbd">Ctrl/Cmd</kbd>
              <span className="shortcut-plus">+</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Lăn chuột</span>
            </div>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-label">Phóng to / Thu nhỏ</span>
            <div className="shortcut-keys">
              <kbd className="shortcut-kbd">+</kbd>
              <span className="shortcut-plus">/</span>
              <kbd className="shortcut-kbd">-</kbd>
            </div>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-label">Đặt lại góc nhìn mặc định</span>
            <div className="shortcut-keys">
              <kbd className="shortcut-kbd">0</kbd>
            </div>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-label">Hoàn tác (Undo)</span>
            <div className="shortcut-keys">
              <kbd className="shortcut-kbd">Ctrl/Cmd</kbd>
              <span className="shortcut-plus">+</span>
              <kbd className="shortcut-kbd">Z</kbd>
            </div>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-label">Làm lại (Redo)</span>
            <div className="shortcut-keys">
              <kbd className="shortcut-kbd">Ctrl/Cmd</kbd>
              <span className="shortcut-plus">+</span>
              <kbd className="shortcut-kbd">Y</kbd>
            </div>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-label">Đóng hộp thoại / Hủy thao tác</span>
            <div className="shortcut-keys">
              <kbd className="shortcut-kbd">Esc</kbd>
            </div>
          </div>
        </div>
      </AnimatedModal>

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
                  setArtworkTitle('');handleClearCanvas();
                }}
              >
                Vẽ tác phẩm mới 🎨
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => navigate('/creative-corner')}
              >
                Xem trong Thư Viện Tranh
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
                disabled={isPublishing || publishingAvailable===false}
                onClick={handlePublish}
                className="share-submit-btn"
              >
                {isPublishing ? (
                  <>
                    <span className="ui-spinner ui-spinner--sm" />
                    <span>{publishStage}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Đăng tranh lên Thư viện</span>
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
            <h2 className="publish-success-title">Đã đăng tranh lên Thư viện!</h2>
            <p className="drawing-publish-id">✓ Tác phẩm #{publishedArtwork?.id} · Đã đọc lại bản ghi và tải ảnh thật từ kho lưu trữ</p>
            <p className="publish-success-desc">
              Tác phẩm đã có trong <b>Thư Viện Tranh</b> và sẽ còn ở đó sau khi tải lại trang,
              đổi trình duyệt hoặc khi hệ thống được deploy lại.
            </p>
            <div className="publish-preview-card">
              <img src={previewImageUrl} alt={artworkTitle} className="publish-preview-img" />
              <div className="publish-preview-info">
                <div className="publish-preview-title">{artworkTitle}</div>
                <div className="publish-preview-author">Tác giả: {user?.name || 'Bạn'} · Chế độ: Công khai</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="drawing-preview-form">
            {isPublishing&&<div className="drawing-save-progress" role="status">{publishStage}<progress value={uploadPercent} max={100}/></div>}
            {errorMessage && (
              <Notice type="error" className="preview-error-notice">
                {errorMessage} <Button variant="secondary" onClick={handleDownload}>Tải bản PNG để giữ tranh</Button>
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
                  disabled={isPublishing}
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
                  <div className="author-role">
                    {user?.jobTitle || user?.department || 'Tác giả sáng tạo'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatedModal>
    </PageShell>
  );
}
