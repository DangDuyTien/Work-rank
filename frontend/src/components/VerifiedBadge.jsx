import React from 'react';
import { BadgeCheck } from 'lucide-react';

/**
 * Standardized WorkRank Verified Badge Component
 * 
 * Uses canonical Lucide BadgeCheck icon with verified sky-blue tone.
 */
export default function VerifiedBadge({
  size = 16,
  color = '#0284c7',
  fill = '#e0f2fe',
  className = '',
  style = {},
  title = 'Tài khoản đã xác thực',
}) {
  return (
    <span
      className={`wr-verified-badge ${className}`.trim()}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      }}
    >
      <BadgeCheck
        size={size}
        color={color}
        fill={fill}
        strokeWidth={2}
      />
    </span>
  );
}
