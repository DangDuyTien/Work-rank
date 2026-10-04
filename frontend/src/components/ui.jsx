import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Inbox, RotateCcw } from 'lucide-react';

function cx(...values) {
  return values.filter(Boolean).join(' ');
}

export function Card({ children, className = '', style, tone = 'default', ...props }) {
  return (
    <div
      className={cx('ui-card', tone !== 'default' && `ui-card--${tone}`, className)}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, compact = false, className = '' }) {
  return (
    <div className={cx('ui-empty-state', compact && 'ui-empty-state--compact', className)}>
      <Icon className="ui-empty-state__icon" size={compact ? 26 : 40} />
      <h2 className="ui-empty-state__title">{title}</h2>
      {description && <p className="ui-empty-state__description">{description}</p>}
      {action}
    </div>
  );
}

export function PageState({ type = 'loading', title, description, onRetry }) {
  const loading = type === 'loading';
  return (
    <div className="ui-page-state" aria-busy={loading ? 'true' : undefined}>
      <div className="ui-page-state__inner">
        {loading ? (
          <div className="ui-spinner" />
        ) : (
          <RotateCcw className="ui-page-state__error-icon" size={28} />
        )}
        <div className={cx('ui-page-state__title', type === 'error' && 'is-error')}>{title}</div>
        {description && <div className="ui-page-state__description">{description}</div>}
        {type === 'error' && onRetry && (
          <Button type="button" variant="secondary" size="sm" onClick={onRetry} className="ui-page-state__action">
            Thử lại
          </Button>
        )}
      </div>
    </div>
  );
}

export function SegmentedControl({ options, value, onChange, ariaLabel }) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="ui-segmented"
    >
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={cx('ui-segmented__button', active && 'is-active')}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Button({ children, className = '', variant = 'secondary', size = 'md', ...props }) {
  return (
    <button
      className={cx('ui-button', `ui-button--${variant}`, `ui-button--${size}`, className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function PageShell({ children, className = '', narrow = false, mono = false }) {
  return (
    <div className={cx('ui-page-shell', narrow && 'ui-page-shell--narrow', mono && 'ui-page-shell--mono', className)}>
      {children}
    </div>
  );
}

export function PageHeader({ icon: Icon, eyebrow, title, description, actions }) {
  return (
    <section className="ui-page-header">
      <div className="ui-page-header__copy">
        {eyebrow && (
          <div className="ui-kicker">
            {Icon && <Icon size={15} />}
            {eyebrow}
          </div>
        )}
        <h1 className="ui-page-title">{title}</h1>
        {description && <p className="ui-page-description">{description}</p>}
      </div>
      {actions && <div className="ui-page-actions">{actions}</div>}
    </section>
  );
}

export function Section({ title, description, actions, children, className = '' }) {
  return (
    <section className={cx('ui-section', className)}>
      {(title || description || actions) && (
        <div className="ui-section__header">
          <div>
            {title && <h2 className="ui-section__title">{title}</h2>}
            {description && <p className="ui-section__description">{description}</p>}
          </div>
          {actions && <div className="ui-section__actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Notice({ type = 'info', icon: Icon, children }) {
  return (
    <div className={cx('ui-notice', `ui-notice--${type}`)} role={type === 'error' ? 'alert' : 'status'}>
      {Icon && <Icon size={17} />}
      <span>{children}</span>
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, detail, color = '#38bdf8' }) {
  return (
    <Card className="ui-stat-card" style={{ '--stat-color': color }}>
      <div className="ui-stat-card__top">
        <span className="ui-stat-card__label">{label}</span>
        {Icon && (
          <span className="ui-stat-card__icon">
            <Icon size={17} />
          </span>
        )}
      </div>
      <strong className="ui-stat-card__value">{value}</strong>
      {detail && <span className="ui-stat-card__detail">{detail}</span>}
    </Card>
  );
}

export function PageTransition({ children, className = '', style }) {
  return (
    <div className={cx('page-transition', className)} style={style}>
      {children}
    </div>
  );
}

export function TabTransition({ children, className = '', minHeight = 200, style }) {
  return (
    <div
      className={cx('tab-transition', className)}
      style={{ minHeight, ...style }}
    >
      {children}
    </div>
  );
}

/**
 * AnimatedCollapse — smooth height 0 ↔ auto using CSS grid trick.
 * No JavaScript height measurement needed.
 *
 * Usage:
 *   <AnimatedCollapse isOpen={expanded}>
 *     <div>content</div>
 *   </AnimatedCollapse>
 */
export function AnimatedCollapse({ isOpen, children, className = '', style }) {
  return (
    <div
      className={cx('animated-collapse', isOpen && 'is-open', className)}
      aria-hidden={!isOpen}
      style={style}
    >
      <div className="animated-collapse__inner">
        {children}
      </div>
    </div>
  );
}

/**
 * AnimatedNumber — Smooth counter animation with requestAnimationFrame.
 * Usage: <AnimatedNumber value={pts} duration={700} formatFn={(v) => `${v.toLocaleString()} PTS`} />
 */
export function AnimatedNumber({ value, duration = 650, formatFn, className = '', style }) {
  const numVal = typeof value === 'number' ? value : (parseFloat(String(value).replace(/,/g, '')) || 0);
  const [displayValue, setDisplayValue] = useState(numVal);
  const startValRef = useRef(numVal);
  const targetValRef = useRef(numVal);
  const startTimeRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastRenderedValueRef = useRef(numVal);

  useEffect(() => {
    const target = typeof value === 'number' ? value : (parseFloat(String(value).replace(/,/g, '')) || 0);
    if (target === targetValRef.current && displayValue === target) return;

    // Check reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement?.dataset?.workrankReduceMotion === 'true');

    if (prefersReducedMotion) {
      targetValRef.current = target;
      lastRenderedValueRef.current = target;
      setDisplayValue(target);
      return;
    }

    startValRef.current = displayValue;
    targetValRef.current = target;
    startTimeRef.current = null;

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic: very smooth deceleration into final resting value
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValRef.current + (targetValRef.current - startValRef.current) * eased;

      const nextVal = progress === 1
        ? targetValRef.current
        : (Number.isInteger(targetValRef.current) ? Math.round(current) : Math.round(current * 10) / 10);

      if (nextVal !== lastRenderedValueRef.current) {
        lastRenderedValueRef.current = nextVal;
        setDisplayValue(nextVal);
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [value, duration]);

  const formatted = formatFn ? formatFn(displayValue) : displayValue.toLocaleString();

  return (
    <span className={cx('motion-number-counter', className)} style={style}>
      {formatted}
    </span>
  );
}

/**
 * AnimatedModal — Standardized accessible modal with coordinated enter and exit animations.
 */
export function AnimatedModal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 600,
  className = '',
  dialogStyle,
  hideCloseButton = false,
  actions,
}) {
  const [mounted, setMounted] = useState(isOpen);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const timer = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, 240); // match --motion-normal exit (smooth without snap)
      return () => clearTimeout(timer);
    }
  }, [isOpen, mounted]);

  const handleClose = React.useCallback(() => {
    if (onClose) onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, handleClose]);

  if (!mounted) return null;

  const modalNode = (
    <div
      className={cx('ui-modal-overlay', closing ? 'modal-backdrop-exit' : 'modal-backdrop-enter')}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cx('ui-modal-dialog', closing ? 'modal-dialog-exit' : 'modal-dialog-enter', className)}
        style={{ width: '100%', maxWidth, maxHeight: '90vh', ...dialogStyle }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || !hideCloseButton) && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            {title && <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111111' }}>{title}</h3>}
            {!hideCloseButton && (
              <button
                type="button"
                onClick={handleClose}
                aria-label="Đóng"
                style={{ marginLeft: 'auto', border: 'none', background: 'rgba(0,0,0,0.04)', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#555555', fontSize: 13, transition: 'background var(--motion-fast) ease' }}
              >
                ✕
              </button>
            )}
          </div>
        )}
        <div style={{ overflowY: 'auto', flex: 1, padding: 20 }}>
          {children}
        </div>
        {actions && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(0,0,0,0.08)', background: '#fafaf8', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
}

/**
 * AnimatedList & AnimatedListItem — Staggered list reveals without layout jumps
 */
export function AnimatedList({ children, className = '', style }) {
  return (
    <div className={cx('animated-list', className)} style={style}>
      {children}
    </div>
  );
}

export function AnimatedListItem({ index = 0, children, className = '', style }) {
  const staggerClass = index < 6 ? `motion-stagger-${Math.min(index + 1, 6)}` : '';
  return (
    <div className={cx('motion-fade-in-up', staggerClass, className)} style={style}>
      {children}
    </div>
  );
}

/**
 * Reveal — nội dung hiện dần (fade + trượt lên) khi mount hoặc khi cuộn tới.
 *   mode="load":   chạy khi mount, sau `delay` ms (dùng để xếp lớp lần lượt trên trang).
 *   mode="scroll": hiện theo vị trí cuộn (CSS scroll-driven, không JS listener).
 *   since:         mốc performance.now() lúc trang mount. Truyền vào cho nội dung đến muộn
 *                  (dữ liệu API) để không phải chờ thêm `delay` khi dữ liệu về sau.
 * Đổi `key` của Reveal để chạy lại hiệu ứng (vd: key={record ? 'ready' : 'loading'}).
 * Usage: <Reveal as="h2" delay={360} className="x">…</Reveal>
 */
export function Reveal({ as: Tag = 'div', mode = 'load', delay = 0, since, className = '', style, children, ...props }) {
  const [frozenDelay] = useState(() => (
    since == null ? delay : Math.max(0, delay - (performance.now() - since))
  ));
  if (mode === 'scroll') {
    return <Tag className={cx('motion-scroll-reveal', className)} style={style} {...props}>{children}</Tag>;
  }
  return (
    <Tag className={cx('motion-reveal', className)} style={{ ...style, '--reveal-delay': `${frozenDelay}ms` }} {...props}>
      {children}
    </Tag>
  );
}

/**
 * RevealText — chữ chạy hiện ra lần lượt từng ký tự (tiêu đề lớn, hero).
 * Screen reader đọc nguyên câu qua aria-label; ký tự tách lẻ bị ẩn khỏi a11y tree.
 * Usage: <RevealText as="h1" text="Recipients" delay={120} step={45} className="title" />
 */
export function RevealText({ as: Tag = 'span', text = '', delay = 0, step = 45, className = '', style, ...props }) {
  let charIndex = 0;
  const words = String(text).split(' ');
  return (
    <Tag className={className} style={{ ...style, '--reveal-delay': `${delay}ms`, '--char-step': `${step}ms` }} aria-label={text} {...props}>
      {words.map((word, wordIndex) => (
        <React.Fragment key={wordIndex}>
          {wordIndex > 0 && ' '}
          <span className="motion-reveal-word" aria-hidden="true">
            {Array.from(word).map((char) => {
              const i = charIndex++;
              return <span key={i} className="motion-reveal-char" style={{ '--char-i': i }}>{char}</span>;
            })}
          </span>
        </React.Fragment>
      ))}
    </Tag>
  );
}

export function Skeleton({ width, height = 18, radius = 4, className = '', style, variant = 'rect' }) {
  const isCircle = variant === 'circle' || variant === 'avatar';
  return (
    <div
      className={cx('skeleton-box', className)}
      style={{
        width: width ?? '100%',
        height: isCircle ? (width ?? height) : height,
        borderRadius: isCircle ? '50%' : radius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

export function CardSkeleton({ count = 3 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', padding: 18, borderRadius: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton height={12} width="40%" />
            <Skeleton height={20} width={20} radius={4} />
          </div>
          <Skeleton height={28} width="60%" />
          <Skeleton height={10} width="80%" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 4, minHeight = 320 }) {
  return (
    <div style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', padding: 18, minHeight }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 18, borderBottom: '1px solid rgba(15,23,42,0.06)', paddingBottom: 12 }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={14} width={i === 0 ? 40 : i === 1 ? '30%' : '20%'} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0' }}>
            <Skeleton height={24} width={24} radius={0} />
            <Skeleton height={32} width={32} variant="circle" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton height={14} width="45%" />
              <Skeleton height={10} width="25%" />
            </div>
            <Skeleton height={16} width={70} />
            <Skeleton height={16} width={50} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageTransitionSkeleton() {
  return (
    <div className="page-transition-skeleton" style={{ maxWidth: 1680, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '50%' }}>
          <Skeleton height={24} width="60%" />
          <Skeleton height={12} width="90%" />
        </div>
        <Skeleton height={34} width={110} />
      </div>
      <CardSkeleton count={3} />
      <TableSkeleton rows={5} cols={4} minHeight={300} />
    </div>
  );
}

export { default as Icon, ICON_SIZES, ICON_TONES } from './Icon';
export { FlipTableBody, FlipList } from './FlipTableBody';
