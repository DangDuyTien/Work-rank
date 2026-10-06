import React, { useState } from 'react';
import { User } from 'lucide-react';
import { initialsFromName, avatarHue, getUserAvatar } from '../../utils/avatar';

const SIZES = {
  xs: 22,
  sm: 32,
  md: 44,
  lg: 56,
  xl: 72,
};

/**
 * Standardized Quiz Avatar Component
 * 
 * Rules:
 * - width = height, aspect-ratio: 1, border-radius: 50%, overflow: hidden, object-fit: cover
 * - Clean initials / canonical icon fallback with deterministic hue
 * - Explicit size scale: xs (22px), sm (32px), md (44px), lg (56px), xl (72px)
 */
export default function QuizAvatar({
  user = {},
  userId = null,
  size = 'md',
  border = null,
  style = {},
  className = '',
}) {
  const [imgError, setImgError] = useState(false);
  const px = typeof size === 'number' ? size : (SIZES[size] || SIZES.md);
  
  const id = user?.id || userId || user?.userId;
  const name = user?.name || user?.email || (id ? `User #${id}` : 'User');
  const avatarSrc = !imgError ? (user?.avatarUrl || user?.avatarData || getUserAvatar(user, id)) : null;
  const initials = initialsFromName(name);
  const hue = avatarHue(name, id);

  return (
    <div
      className={`quiz-avatar-container ${className}`}
      style={{
        width: px,
        height: px,
        minWidth: px,
        minHeight: px,
        aspectRatio: '1 / 1',
        borderRadius: '50%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `hsl(${hue}, 65%, 45%)`,
        color: 'var(--surface)',
        fontWeight: 700,
        fontSize: Math.max(10, Math.round(px * 0.38)),
        border: border || '1px solid rgba(0,0,0,0.1)',
        boxSizing: 'border-box',
        flexShrink: 0,
        userSelect: 'none',
        position: 'relative',
        ...style,
      }}
    >
      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt={name}
          onError={() => setImgError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            borderRadius: '50%',
          }}
        />
      ) : (
        <span>{initials || <User size={Math.round(px * 0.5)} />}</span>
      )}
    </div>
  );
}
