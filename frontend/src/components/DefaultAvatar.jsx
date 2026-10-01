import React, { useState } from 'react';
import { UserRound, Users, Trophy } from 'lucide-react';
import { initialsFromName, avatarHue } from '../utils/avatar';

/**
 * Standardized WorkRank DefaultAvatar Component
 * 
 * Clean, consistent avatar renderer with robust fallback logic:
 * - Shows real image if present and valid
 * - Falls back to clean initials or semantic Lucide icon (UserRound / Users / Trophy)
 * - Zero custom cartoons, zero emoji placeholders
 */
export default function DefaultAvatar({
  src,
  name = '',
  userId,
  size = 40,
  shape = 'square', // 'square' | 'circle' | 'squircle'
  type = 'user', // 'user' | 'team' | 'award'
  className = '',
  style = {},
  alt,
}) {
  const [imgFailed, setImgFailed] = useState(false);

  // Compute border-radius
  let borderRadius = 0;
  if (shape === 'circle') borderRadius = '50%';
  else if (shape === 'squircle') borderRadius = Math.round(size * 0.2);

  const showImage = Boolean(src) && !imgFailed;
  const initials = initialsFromName(name);
  const hue = avatarHue(name, userId);

  return (
    <div
      className={`wr-avatar-container ${className}`.trim()}
      style={{
        width: size,
        height: size,
        borderRadius,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        userSelect: 'none',
        position: 'relative',
        background: showImage ? '#181b20' : `hsl(${hue}, 40%, 94%)`,
        border: '1px solid rgba(15, 23, 42, 0.12)',
        color: `hsl(${hue}, 60%, 28%)`,
        ...style,
      }}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt || name || 'Avatar'}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={() => setImgFailed(true)}
        />
      ) : initials ? (
        <span
          style={{
            fontFamily: "'Space Grotesk', -apple-system, sans-serif",
            fontWeight: 700,
            fontSize: Math.max(10, Math.round(size * 0.38)),
            lineHeight: 1,
            letterSpacing: '-0.5px',
          }}
        >
          {initials}
        </span>
      ) : type === 'team' ? (
        <Users size={Math.max(14, Math.round(size * 0.5))} strokeWidth={2} />
      ) : type === 'award' ? (
        <Trophy size={Math.max(14, Math.round(size * 0.5))} strokeWidth={2} />
      ) : (
        <UserRound size={Math.max(14, Math.round(size * 0.5))} strokeWidth={2} />
      )}
    </div>
  );
}
