import React from 'react';
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

export function TabTransition({ children, className = '', minHeight = 280, style }) {
  return (
    <div
      className={cx('tab-transition', className)}
      style={{ minHeight, ...style }}
    >
      {children}
    </div>
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
    <div className="page-transition" style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
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

