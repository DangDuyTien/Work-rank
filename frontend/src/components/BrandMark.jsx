import React from 'react';

export default function BrandMark({ size = 32, showLabel = false, labelStyle = {}, label = 'WorkRank' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.max(8, size * 0.28), minWidth: 0 }}>
      <span
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: Math.max(7, Math.round(size * 0.24)),
          background: '#ffffff',
          border: '1px solid rgba(15,23,42,0.1)',
          boxShadow: `0 ${Math.max(5, size * 0.2)}px ${Math.max(12, size * 0.58)}px rgba(15,23,42,0.12)`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <svg viewBox="0 0 48 48" width="100%" height="100%" role="img" aria-label="WorkRank">
          <rect x="7" y="7" width="34" height="34" rx="9" fill="#eff6ff" />
          <path d="M15 36V24.5C15 23.1 16.1 22 17.5 22H20.5C21.9 22 23 23.1 23 24.5V36H15Z" fill="#38bdf8" />
          <path d="M25 36V15.5C25 14.1 26.1 13 27.5 13H30.5C31.9 13 33 14.1 33 15.5V36H25Z" fill="#2563eb" />
          <path d="M35 36V28.5C35 27.1 36.1 26 37.5 26H40.5C41.9 26 43 27.1 43 28.5V36H35Z" fill="#22c55e" />
          <path d="M12 36H44" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
          <path d="M13 15.5L16.5 19L23 12.5" fill="none" stroke="#0f172a" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="29" cy="20" r="2.2" fill="#ffffff" opacity="0.9" />
        </svg>
      </span>
      {showLabel && (
        <span
          style={{
            color: '#0f172a',
            fontSize: 15,
            fontWeight: 900,
            letterSpacing: '-0.35px',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            ...labelStyle,
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
