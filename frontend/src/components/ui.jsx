import React from 'react';
import { Inbox, RotateCcw } from 'lucide-react';

export function Card({ children, style, ...props }) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid rgba(15,23,42,0.08)',
        borderRadius: 0,
        boxShadow: 'none',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '44px 24px', color: '#94a3b8' }}>
      <Icon size={40} color="#38bdf8" style={{ marginBottom: 14 }} />
      <h2 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: 18, fontWeight: 800 }}>{title}</h2>
      {description && <p style={{ margin: '0 auto 18px', maxWidth: 420, fontSize: 13, lineHeight: 1.5 }}>{description}</p>}
      {action}
    </div>
  );
}

export function PageState({ type = 'loading', title, description, onRetry }) {
  const loading = type === 'loading';
  return (
    <div style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
      <div style={{ textAlign: 'center' }}>
        {loading ? (
          <div style={{
            width: 24,
            height: 24,
            border: '3px solid rgba(56,189,248,0.2)',
            borderTopColor: '#38bdf8',
            borderRadius: '50%',
            margin: '0 auto 14px',
            animation: 'spin 0.8s linear infinite',
          }} />
        ) : (
          <RotateCcw size={28} color="#ef4444" style={{ marginBottom: 12 }} />
        )}
        <div style={{ color: type === 'error' ? '#ef4444' : '#94a3b8', fontSize: 14, fontWeight: 800 }}>{title}</div>
        {description && <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5 }}>{description}</div>}
        {type === 'error' && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              marginTop: 14,
              border: '1px solid rgba(56,189,248,0.3)',
              background: 'rgba(56,189,248,0.1)',
              color: '#38bdf8',
              borderRadius: 0,
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            Thử lại
          </button>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function SegmentedControl({ options, value, onChange, ariaLabel }) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        background: 'rgba(15,23,42,0.04)',
        border: '1px solid rgba(15,23,42,0.08)',
        borderRadius: 0,
        padding: 3,
        gap: 2,
      }}
    >
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            style={{
              padding: '7px 14px',
              borderRadius: 0,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              background: active ? '#38bdf8' : 'transparent',
              color: active ? '#ffffff' : '#94a3b8',
              whiteSpace: 'nowrap',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
