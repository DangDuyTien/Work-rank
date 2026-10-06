import React from 'react';
import { Club, Spade, Heart, Diamond } from 'lucide-react';

export const SUIT_META = {
  S: { label: 'Bích', color: '#0f172a', Icon: Spade, symbol: '♠' },
  C: { label: 'Tép', color: '#1e293b', Icon: Club, symbol: '♣' },
  D: { label: 'Rô', color: '#dc2626', Icon: Diamond, symbol: '♦' },
  H: { label: 'Cơ', color: '#dc2626', Icon: Heart, symbol: '♥' },
};

export function parseCardString(cardStr) {
  if (!cardStr || typeof cardStr !== 'string') return null;
  const suit = cardStr.slice(-1).toUpperCase();
  const rank = cardStr.slice(0, -1).toUpperCase();
  const meta = SUIT_META[suit] || SUIT_META.S;
  const isHeo = rank === '2';
  const isAce = rank === 'A';
  return {
    id: cardStr,
    rank,
    suit,
    color: meta.color,
    Icon: meta.Icon,
    symbol: meta.symbol,
    label: meta.label,
    isHeo,
    isAce,
  };
}

export default function SamCard({
  cardId,
  selected = false,
  onClick,
  disabled = false,
  small = false,
  isBack = false,
  style = {},
  className = '',
}) {
  if (isBack) {
    return (
      <div
        className={`sam-card-back ${small ? 'sam-card-back--sm' : ''} ${className}`}
        style={style}
        aria-hidden="true"
      >
        <div
          style={{
            width: small ? 24 : 36,
            height: small ? 36 : 54,
            border: '1px solid rgba(217, 119, 6, 0.35)',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.25)',
          }}
        >
          <Club size={small ? 12 : 18} color="#d97706" />
        </div>
      </div>
    );
  }

  const parsed = parseCardString(cardId);
  if (!parsed) return null;

  const { rank, color, Icon, isHeo, label } = parsed;

  const handleKeyDown = (e) => {
    if (disabled || !onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(cardId);
    }
  };

  return (
    <div
      onClick={!disabled && onClick ? () => onClick(cardId) : undefined}
      onKeyDown={handleKeyDown}
      role={onClick && !disabled ? 'button' : undefined}
      tabIndex={onClick && !disabled ? 0 : -1}
      aria-label={`Quân bài ${rank} ${label}`}
      aria-pressed={selected}
      className={`sam-card-item ${small ? 'sam-card-item--sm' : ''} ${selected ? 'is-selected' : ''} ${isHeo ? 'is-heo' : ''} ${disabled ? 'is-disabled' : ''} ${className}`}
      style={style}
    >
      {/* Top Left Rank & Suit */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
        <span style={{ fontSize: small ? 11 : 14, fontWeight: 900, color, letterSpacing: -0.5 }}>{rank}</span>
        <Icon size={small ? 9 : 11} color={color} style={{ marginTop: 1 }} />
      </div>

      {/* Center Large Suit Icon */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, position: 'relative' }}>
        <Icon size={small ? 16 : 24} color={color} opacity={0.88} />
        {isHeo && (
          <div
            style={{
              position: 'absolute',
              top: -2,
              right: 0,
              fontSize: small ? 7 : 8,
              fontWeight: 900,
              color: '#b45309',
              background: '#fef3c7',
              padding: '1px 3px',
              borderRadius: 2,
              letterSpacing: 0.2,
            }}
          >
            2
          </div>
        )}
      </div>

      {/* Bottom Right Rank & Suit (Inverted) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          lineHeight: 1,
          transform: 'rotate(180deg)',
        }}
      >
        <span style={{ fontSize: small ? 11 : 14, fontWeight: 900, color, letterSpacing: -0.5 }}>{rank}</span>
        <Icon size={small ? 9 : 11} color={color} style={{ marginTop: 1 }} />
      </div>
    </div>
  );
}
