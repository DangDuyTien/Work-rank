import React from 'react';

export default function BrandMark({ size = 32, showLabel = false, labelStyle = {}, label = 'WorkRank' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.max(6, size * 0.2), minWidth: 0 }}>
      <span
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          background: '#0f172a',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
          fontWeight: 900,
          fontSize: Math.round(size * 0.58),
          color: '#ffffff',
        }}
      >
        W
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
