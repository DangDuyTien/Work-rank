import React from 'react';
import { Inbox, RotateCcw } from 'lucide-react';

export function Card({ children, style, ...props }) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid rgba(15,23,42,0.1)',
        borderRadius: 8,
        boxShadow: '0 12px 32px rgba(15,23,42,0.05)',
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
    <div style={{ textAlign: 'center', padding: '44px 24px', color: '#64748b' }}>
      <Icon size={40} color="#3b82f6" style={{ marginBottom: 14 }} />
      <h2 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: 18, fontWeight: 800 }}>{title}</h2>
      {description && <p style={{ margin: '0 auto 18px', maxWidth: 420, fontSize: 13, lineHeight: 1.5 }}>{description}</p>}
      {action}
    </div>
  );
}

export function PageState({ type = 'loading', title, description, onRetry }) {
  const loading = type === 'loading';
  return (
    <div style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
      <div style={{ textAlign: 'center' }}>
        {loading ? (
          <div style={{
            width: 24,
            height: 24,
            border: '3px solid #dbeafe',
            borderTopColor: '#2563eb',
            borderRadius: '50%',
            margin: '0 auto 14px',
            animation: 'spin 0.8s linear infinite',
          }} />
        ) : (
          <RotateCcw size={28} color="#dc2626" style={{ marginBottom: 12 }} />
        )}
        <div style={{ color: type === 'error' ? '#991b1b' : '#475569', fontSize: 14, fontWeight: 800 }}>{title}</div>
        {description && <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5 }}>{description}</div>}
        {type === 'error' && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              marginTop: 14,
              border: '1px solid rgba(37,99,235,0.22)',
              background: 'rgba(37,99,235,0.08)',
              color: '#2563eb',
              borderRadius: 6,
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
        border: '1px solid rgba(15,23,42,0.1)',
        borderRadius: 6,
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
              borderRadius: 5,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              background: active ? '#2563eb' : 'transparent',
              color: active ? '#ffffff' : '#64748b',
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
