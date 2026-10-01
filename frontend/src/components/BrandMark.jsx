import React, { useState } from 'react';

/**
 * BrandMark - Official WorkRank / 3WIN MEDIA Brand Logo Component
 *
 * Displays the full high-res golden "W" logo on dark slate background
 * with smooth squircle/circle rounded corners and zero edge-clipping.
 */
export default function BrandMark({
  size = 32,
  showLabel = false,
  labelStyle = {},
  sublabelStyle = {},
  label = '3WIN MEDIA',
  sublabel = '',
  shape = 'squircle', // 'squircle' | 'circle' | 'square'
  rounded = true,
  glow = true,
  src = '/3win-mark.png',
  className = '',
  style = {},
}) {
  const [imgError, setImgError] = useState(false);

  // Compute border-radius based on shape/rounded
  let borderRadius = Math.round(size * 0.2);
  if (!rounded || shape === 'square') {
    borderRadius = 0;
  } else if (shape === 'circle') {
    borderRadius = '50%';
  }

  return (
    <span
      className={`brand-mark-wrapper ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.max(8, Math.round(size * 0.25)),
        minWidth: 0,
        verticalAlign: 'middle',
        userSelect: 'none',
        ...style,
      }}
    >
      {/* ── LOGO ICON IMAGE (FULL & BO TRÒN CHUẨN) ── */}
      <span
        style={{
          width: size,
          height: size,
          borderRadius,
          overflow: 'hidden',
          background: '#181b20',
          border: '1px solid rgba(250, 204, 21, 0.25)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: glow ? '0 2px 8px rgba(15,23,42,0.2)' : 'none',
          position: 'relative',
        }}
      >
        {!imgError ? (
          <img
            src={src}
            alt={label}
            width={size}
            height={size}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
            onError={() => setImgError(true)}
          />
        ) : (
          /* Fallback if image fails to load */
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: Math.round(size * 0.45),
              color: '#facc15',
              lineHeight: 1,
            }}
          >
            W
          </span>
        )}
      </span>

      {/* ── BRAND WORDMARK / LABELS ── */}
      {showLabel && (
        <span
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            justifyContent: 'center',
            lineHeight: 1.25,
            minWidth: 0,
          }}
        >
          <span
            style={{
              color: '#0f172a',
              fontSize: Math.max(14, Math.round(size * 0.48)),
              fontWeight: 700,
              letterSpacing: '-0.3px',
              whiteSpace: 'nowrap',
              fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
              ...labelStyle,
            }}
          >
            {label}
          </span>
          {sublabel && (
            <span
              style={{
                fontSize: Math.max(9, Math.round(size * 0.28)),
                fontWeight: 600,
                color: '#94a3b8',
                letterSpacing: '0.4px',
                textTransform: 'uppercase',
                marginTop: 2,
                fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
                ...sublabelStyle,
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
