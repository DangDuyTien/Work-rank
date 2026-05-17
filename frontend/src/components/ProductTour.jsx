import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const PRODUCT_TOUR_EVENT = 'workrank:start-product-tour';

const TOUR_VERSION = 'v2';

const TOUR_STEPS = [
  {
    selector: '[data-tour="app-nav"]',
    title: 'Tour chức năng chính',
    description: 'Tour này chỉ đi qua các chức năng cần biết trước: Theo dõi, cài Desktop Tracker và Pomodoro. Bấm Tiếp, web sẽ tự chuyển trang khi cần.',
  },
  {
    selector: '[data-tour="tracker-widget"]',
    title: 'Phiên theo dõi',
    route: '/tracker',
    description: 'Thẻ này cho biết web có đang nhận dữ liệu từ Desktop Tracker hay không, phiên đã chạy bao lâu và lượng thao tác hiện tại.',
  },
  {
    selector: '[data-tour="tracker-desktop-install"]',
    title: 'Cài và kết nối app',
    route: '/tracker',
    description: 'Đây là khu vực quan trọng nhất: bấm Bắt đầu và mở app nếu đã cài, hoặc tải file .exe Windows nếu máy chưa có WorkRank Tracker.',
  },
  {
    selector: '[data-tour="tracker-download"]',
    title: 'Tải Desktop Tracker',
    route: '/tracker',
    description: 'Nút này tải bản cài Windows. Sau khi cài, quay lại trang Theo dõi và bấm Bắt đầu và mở app để trình duyệt cấp quyền mở ứng dụng.',
  },
  {
    selector: '[data-tour="pomodoro-timer"]',
    title: 'Bộ đếm Pomodoro',
    route: '/pomodoro',
    description: 'Chọn preset 25/5, 50/10 hoặc 15/3, chọn chế độ tập trung/nghỉ, rồi bấm Bắt đầu để chạy phiên.',
  },
  {
    selector: '[data-tour="pomodoro-focus-workflow"]',
    title: 'Mục tiêu và việc focus',
    route: '/pomodoro',
    description: 'Đặt mục tiêu phút focus trong ngày, thêm việc cần làm, ghim việc đang focus và ghi chú nhanh cho phiên làm việc.',
  },
  {
    selector: '[data-tour="help"]',
    title: 'Xem lại hướng dẫn',
    description: 'Sau khi hoàn tất, tour sẽ không tự hiện lại. Bạn có thể bấm nút này để mở lại bất cứ lúc nào.',
  },
];

function getStorageKey(user) {
  return `workrank:onboarding-tour:${TOUR_VERSION}:${user?.id || user?.email || 'guest'}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isRouteMatch(pathname, route) {
  if (!route) return true;
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isVisibleElement(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getPaddedRect(element) {
  const rect = element.getBoundingClientRect();
  const padding = 8;
  const left = clamp(rect.left - padding, 8, window.innerWidth - 8);
  const top = clamp(rect.top - padding, 8, window.innerHeight - 8);
  const right = clamp(rect.right + padding, 8, window.innerWidth - 8);
  const bottom = clamp(rect.bottom + padding, 8, window.innerHeight - 8);

  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
    right,
    bottom,
  };
}

export default function ProductTour() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [tooltipStyle, setTooltipStyle] = useState(null);
  const tooltipRef = useRef(null);
  const rafRef = useRef(0);
  const autoStartedRef = useRef(false);
  const moveDirectionRef = useRef(1);
  const storageKey = useMemo(() => getStorageKey(user), [user]);

  const getTarget = useCallback((index = stepIndex) => {
    const step = TOUR_STEPS[index];
    if (!step || typeof document === 'undefined') return null;
    if (!isRouteMatch(location.pathname, step.route)) return null;
    const targets = Array.from(document.querySelectorAll(step.selector));
    return targets.find((target) => isVisibleElement(target)) || null;
  }, [location.pathname, stepIndex]);

  const getBoundedIndex = useCallback((index) => (
    index >= 0 && index < TOUR_STEPS.length ? index : -1
  ), []);

  const tourIndexes = useMemo(() => TOUR_STEPS.map((_, index) => index), []);

  const completeTour = useCallback((remember = true) => {
    if (remember) localStorage.setItem(storageKey, 'done');
    setOpen(false);
    setTargetRect(null);
    setTooltipStyle(null);
  }, [storageKey]);

  const startTour = useCallback(() => {
    moveDirectionRef.current = 1;
    setStepIndex(0);
    setOpen(true);
    setTargetRect(null);
    setTooltipStyle(null);
  }, []);

  const goToStep = useCallback((index, direction = 1) => {
    moveDirectionRef.current = direction;
    setTargetRect(null);
    setTooltipStyle(null);
    setStepIndex(index);
  }, []);

  const updatePosition = useCallback(() => {
    if (!open) return;
    const target = getTarget(stepIndex);
    if (!target) return;

    const rect = getPaddedRect(target);
    const tooltipWidth = Math.min(372, window.innerWidth - 28);
    const tooltipHeight = tooltipRef.current?.offsetHeight || 236;
    const gap = 14;
    const viewportPadding = 14;

    let top = rect.bottom + gap;
    if (top + tooltipHeight > window.innerHeight - viewportPadding) {
      top = rect.top - tooltipHeight - gap;
    }
    top = clamp(top, viewportPadding, Math.max(viewportPadding, window.innerHeight - tooltipHeight - viewportPadding));

    let left = rect.left;
    if (rect.left + tooltipWidth > window.innerWidth - viewportPadding) {
      left = rect.right - tooltipWidth;
    }
    left = clamp(left, viewportPadding, Math.max(viewportPadding, window.innerWidth - tooltipWidth - viewportPadding));

    setTargetRect(rect);
    setTooltipStyle({ top, left, width: tooltipWidth });
  }, [getTarget, open, stepIndex]);

  const scheduleUpdate = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(updatePosition);
  }, [updatePosition]);

  useEffect(() => {
    if (!user || autoStartedRef.current) return undefined;
    autoStartedRef.current = true;
    if (localStorage.getItem(storageKey) === 'done') return undefined;

    const timer = window.setTimeout(() => startTour(), 850);
    return () => window.clearTimeout(timer);
  }, [startTour, storageKey, user]);

  useEffect(() => {
    const handleStart = () => startTour();
    window.addEventListener(PRODUCT_TOUR_EVENT, handleStart);
    return () => window.removeEventListener(PRODUCT_TOUR_EVENT, handleStart);
  }, [startTour]);

  useEffect(() => {
    if (!open) return undefined;
    const step = TOUR_STEPS[stepIndex];
    if (step?.route && !isRouteMatch(location.pathname, step.route)) {
      setTargetRect(null);
      setTooltipStyle(null);
      navigate(step.route);
      return undefined;
    }

    const target = getTarget(stepIndex);
    if (!target) {
      const retryTimer = window.setTimeout(() => {
        const retryTarget = getTarget(stepIndex);
        if (retryTarget) {
          retryTarget.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
          window.setTimeout(updatePosition, 240);
          return;
        }

        const direction = moveDirectionRef.current || 1;
        const nextIndex = getBoundedIndex(stepIndex + direction);
        if (nextIndex >= 0) {
          goToStep(nextIndex, direction);
        } else {
          completeTour(false);
        }
      }, 320);
      return () => window.clearTimeout(retryTimer);
    }

    target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    const timer = window.setTimeout(updatePosition, 320);
    return () => window.clearTimeout(timer);
  }, [completeTour, getBoundedIndex, getTarget, goToStep, location.pathname, navigate, open, stepIndex, updatePosition]);

  useEffect(() => {
    if (!open) return undefined;

    const target = getTarget(stepIndex);
    const resizeObserver = target && 'ResizeObserver' in window ? new ResizeObserver(scheduleUpdate) : null;
    if (target && resizeObserver) resizeObserver.observe(target);

    window.addEventListener('resize', scheduleUpdate);
    document.addEventListener('scroll', scheduleUpdate, true);
    scheduleUpdate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', scheduleUpdate);
      document.removeEventListener('scroll', scheduleUpdate, true);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [getTarget, open, scheduleUpdate, stepIndex]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') completeTour(true);
      if (event.key === 'ArrowRight') {
        const nextIndex = getBoundedIndex(stepIndex + 1);
        if (nextIndex >= 0) goToStep(nextIndex, 1);
        else completeTour(true);
      }
      if (event.key === 'ArrowLeft') {
        const prevIndex = getBoundedIndex(stepIndex - 1);
        if (prevIndex >= 0) goToStep(prevIndex, -1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [completeTour, getBoundedIndex, goToStep, open, stepIndex]);

  if (!open || !targetRect || !tooltipStyle) return null;

  const currentStep = TOUR_STEPS[stepIndex];
  const previousIndex = getBoundedIndex(stepIndex - 1);
  const nextIndex = getBoundedIndex(stepIndex + 1);
  const currentOrdinal = stepIndex + 1;
  const totalSteps = TOUR_STEPS.length;

  return createPortal(
    <div className="product-tour-layer" role="dialog" aria-modal="true" aria-label="Hướng dẫn sử dụng WorkRank">
      <div className="product-tour-mask product-tour-mask-top" style={{ height: targetRect.top }} />
      <div className="product-tour-mask product-tour-mask-left" style={{ top: targetRect.top, width: targetRect.left, height: targetRect.height }} />
      <div className="product-tour-mask product-tour-mask-right" style={{ top: targetRect.top, left: targetRect.right, height: targetRect.height }} />
      <div className="product-tour-mask product-tour-mask-bottom" style={{ top: targetRect.bottom }} />

      <div
        className="product-tour-spotlight"
        style={{
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
        }}
      />

      <div
        ref={tooltipRef}
        className="product-tour-tooltip"
        style={tooltipStyle}
      >
        <div className="product-tour-meta">
          <span>Hướng dẫn nhanh</span>
          <strong>{currentOrdinal} / {totalSteps}</strong>
        </div>
        <h3>{currentStep.title}</h3>
        <p>{currentStep.description}</p>

        <div className="product-tour-progress" aria-hidden="true">
          {tourIndexes.map((index) => (
            <span key={index} className={index === stepIndex ? 'active' : ''} />
          ))}
        </div>

        <div className="product-tour-controls">
          <button type="button" className="product-tour-skip" onClick={() => completeTour(true)}>
            Bỏ qua
          </button>
          <div>
            <button
              type="button"
              className="product-tour-secondary"
              disabled={previousIndex < 0}
              onClick={() => {
                if (previousIndex >= 0) goToStep(previousIndex, -1);
              }}
            >
              Trước
            </button>
            <button
              type="button"
              className="product-tour-primary"
              onClick={() => {
                if (nextIndex >= 0) goToStep(nextIndex, 1);
                else completeTour(true);
              }}
            >
              {nextIndex >= 0 ? 'Tiếp' : 'Hoàn tất'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
