import React, { useId } from 'react';

/**
 * BrandMark - Official WorkRank / 3WIN MEDIA Brand Logo Component
 *
 * Features:
 * - Iconic Geometric Golden "W" Vector Logo with multi-facet 3D metallic gradient
 * - Smooth Squircle / Circular corner rounding (Bo tròn chuẩn)
 * - Safe inner padding ensuring 100% full visibility with zero edge-clipping
 * - Optional custom image `src` support with object-fit: contain
 * - Collision-free SVG Gradient IDs via React.useId()
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
  src = '',
  className = '',
  style = {},
}) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');

  // Compute border-radius / SVG rx based on shape/rounded
  let rxValue = 22;
  let containerRadius = Math.round(size * 0.22);
  if (!rounded || shape === 'square') {
    rxValue = 0;
    containerRadius = 0;
  } else if (shape === 'circle') {
    rxValue = 50;
    containerRadius = '50%';
  }

  // Gradient element IDs
  const idBg = `wr-bg-${id}`;
  const idGoldFacet1 = `wr-g1-${id}`;
  const idGoldFacet2 = `wr-g2-${id}`;
  const idGoldFacet3 = `wr-g3-${id}`;
  const idGoldFacet4 = `wr-g4-${id}`;
  const idGoldCrown = `wr-gc-${id}`;
  const idBorder = `wr-bd-${id}`;
  const idGlow = `wr-gw-${id}`;

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
      {/* ── LOGO ICON (Vector Golden "W" OR Full Image) ── */}
      {src ? (
        <span
          style={{
            width: size,
            height: size,
            borderRadius: containerRadius,
            overflow: 'hidden',
            background: '#0f172a',
            border: '1px solid rgba(250, 204, 21, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: Math.max(1, Math.round(size * 0.05)),
            flexShrink: 0,
            boxShadow: glow ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
          }}
        >
          <img
            src={src}
            alt={label}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </span>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 100 100"
          width={size}
          height={size}
          fill="none"
          aria-label={label}
          role="img"
          style={{
            width: size,
            height: size,
            flexShrink: 0,
            display: 'block',
            filter: glow ? 'drop-shadow(0 2px 6px rgba(15,23,42,0.25))' : 'none',
          }}
        >
          <defs>
            {/* Background Gradient */}
            <linearGradient id={idBg} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>

            {/* Gold Gradients for 4 Facets */}
            <linearGradient id={idGoldFacet1} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="45%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
            <linearGradient id={idGoldFacet2} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            <linearGradient id={idGoldFacet3} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#eab308" />
              <stop offset="60%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <linearGradient id={idGoldFacet4} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="40%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>

            {/* Apex Crown Diamond Accent */}
            <linearGradient id={idGoldCrown} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#facc15" />
              <stop offset="50%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#fef08a" />
            </linearGradient>

            {/* Outer Subtle Golden Border */}
            <linearGradient id={idBorder} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(250, 204, 21, 0.45)" />
              <stop offset="50%" stopColor="rgba(234, 179, 8, 0.15)" />
              <stop offset="100%" stopColor="rgba(217, 119, 6, 0.4)" />
            </linearGradient>

            {/* Glow Filter */}
            {glow && (
              <filter id={idGlow} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            )}
          </defs>

          {/* Squircle Base (Bo tròn mềm mại) */}
          <rect width="100" height="100" rx={rxValue} fill={`url(#${idBg})`} />
          <rect
            x="1.5"
            y="1.5"
            width="97"
            height="97"
            rx={Math.max(0, rxValue - 1.5)}
            fill="none"
            stroke={`url(#${idBorder})`}
            strokeWidth="1.75"
          />

          {/* Soft Gold Radial Ambience */}
          {glow && (
            <circle cx="50" cy="52" r="26" fill="#eab308" opacity="0.16" filter={`url(#${idGlow})`} />
          )}

          {/* ── THE ICONIC GOLDEN "W" ── */}
          {/* Left Outer Blade */}
          <path d="M17 25 L25 25 L37 75 L29 75 Z" fill={`url(#${idGoldFacet1})`} />

          {/* Left Inner Face */}
          <path d="M25 25 L32 25 L43 61 L50 36 L50 56 L44 75 L37 75 Z" fill={`url(#${idGoldFacet2})`} />

          {/* Right Inner Face */}
          <path d="M50 36 L57 61 L68 25 L75 25 L63 75 L56 75 L50 56 Z" fill={`url(#${idGoldFacet3})`} />

          {/* Right Outer Blade */}
          <path d="M75 25 L83 25 L71 75 L63 75 Z" fill={`url(#${idGoldFacet4})`} />

          {/* Apex Crown Diamond Accent */}
          <path d="M50 18 L54.5 24 L50 29.5 L45.5 24 Z" fill={`url(#${idGoldCrown})`} />
          <circle cx="50" cy="24" r="1.5" fill="#ffffff" />
        </svg>
      )}

      {/* ── BRAND WORDMARK / LABELS ── */}
      {showLabel && (
        <span
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            justifyContent: 'center',
            lineHeight: 1.1,
            minWidth: 0,
          }}
        >
          <span
            style={{
              color: '#0f172a',
              fontSize: Math.max(14, Math.round(size * 0.48)),
              fontWeight: 900,
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
                fontWeight: 700,
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
