import React from 'react';

export default function BrandMark({
  size = 32,
  showLabel = false,
  labelStyle = {},
  label = '3WIN MEDIA',
  sublabel = '',
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.max(8, size * 0.25), minWidth: 0 }}>
      <img
        src="/3win-mark.png"
        alt={label}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'block',
          flexShrink: 0,
          borderRadius: 0,
          background: '#0f172a',
          padding: 1,
        }}
        onError={(e) => {
          // Fallback to stylized WR symbol if image load fails
          e.target.style.display = 'none';
          if (e.target.nextSibling) e.target.nextSibling.style.display = 'inline-flex';
        }}
      />
      <span
        aria-hidden="true"
        style={{
          display: 'none',
          width: size,
          height: size,
          flexShrink: 0,
          background: '#0f172a',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
          fontWeight: 900,
          fontSize: Math.round(size * 0.42),
          color: '#eab308',
          borderRadius: 0,
        }}
      >
        3W
      </span>
      {showLabel && (
        <span style={{ display: 'inline-flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.1 }}>
          <span
            style={{
              color: '#0f172a',
              fontSize: Math.max(14, Math.round(size * 0.48)),
              fontWeight: 900,
              letterSpacing: '-0.2px',
              whiteSpace: 'nowrap',
              ...labelStyle,
            }}
          >
            {label}
          </span>
          {sublabel && (
            <span
              style={{
                fontSize: Math.max(9, Math.round(size * 0.28)),
                fontWeight: 700,
                color: '#94a3b8',
                letterSpacing: '0.4px',
                textTransform: 'uppercase',
                marginTop: 2,
              }}
            >
              {sublabel}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
