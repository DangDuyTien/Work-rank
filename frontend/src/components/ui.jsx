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
