import React, { useState, useEffect } from 'react';

const PIP_PATTERNS = {
  1: [{ top: '50%', left: '50%', size: 12, color: '#ef4444' }],
  2: [
    { top: '28%', left: '28%', size: 9, color: 'var(--text-primary)' },
    { top: '72%', left: '72%', size: 9, color: 'var(--text-primary)' },
  ],
  3: [
    { top: '25%', left: '25%', size: 9, color: 'var(--text-primary)' },
    { top: '50%', left: '50%', size: 9, color: 'var(--text-primary)' },
    { top: '75%', left: '75%', size: 9, color: 'var(--text-primary)' },
  ],
  4: [
    { top: '28%', left: '28%', size: 9, color: 'var(--text-primary)' },
    { top: '28%', left: '72%', size: 9, color: 'var(--text-primary)' },
    { top: '72%', left: '28%', size: 9, color: 'var(--text-primary)' },
    { top: '72%', left: '72%', size: 9, color: 'var(--text-primary)' },
  ],
  5: [
    { top: '26%', left: '26%', size: 8.5, color: 'var(--text-primary)' },
    { top: '26%', left: '74%', size: 8.5, color: 'var(--text-primary)' },
    { top: '50%', left: '50%', size: 9, color: '#ef4444' },
    { top: '74%', left: '26%', size: 8.5, color: 'var(--text-primary)' },
    { top: '74%', left: '74%', size: 8.5, color: 'var(--text-primary)' },
  ],
  6: [
    { top: '24%', left: '28%', size: 8.5, color: 'var(--text-primary)' },
    { top: '24%', left: '72%', size: 8.5, color: 'var(--text-primary)' },
    { top: '50%', left: '28%', size: 8.5, color: 'var(--text-primary)' },
    { top: '50%', left: '72%', size: 8.5, color: 'var(--text-primary)' },
    { top: '76%', left: '28%', size: 8.5, color: 'var(--text-primary)' },
    { top: '76%', left: '72%', size: 8.5, color: 'var(--text-primary)' },
  ],
};

function Die({ value, isRolling, rotation = 0 }) {
  const pips = PIP_PATTERNS[value] || PIP_PATTERNS[1];

  return (
    <div
      style={{
        width: 52,
        height: 52,
        background: 'linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%)',
        border: '2px solid rgba(15, 23, 42, 0.85)',
        borderRadius: 12,
        boxShadow: isRolling
          ? '0 10px 22px rgba(15,23,42,0.28), inset 0 2px 2px rgba(255,255,255,0.9), inset 0 -3px 0 rgba(15,23,42,0.15)'
          : '0 6px 14px rgba(15,23,42,0.16), inset 0 2px 2px rgba(255,255,255,0.9), inset 0 -3px 0 rgba(15,23,42,0.12)',
        position: 'relative',
        transform: isRolling
          ? `rotate(${rotation}deg) scale(1.12)`
          : 'rotate(0deg) scale(1)',
        transition: 'transform var(--motion-fast) var(--ease-standard), box-shadow var(--motion-fast) var(--ease-standard)',
        flexShrink: 0,
      }}
    >
      {pips.map((pip, idx) => (
        <span
          key={idx}
          style={{
            position: 'absolute',
            width: pip.size || 9,
            height: pip.size || 9,
            borderRadius: '50%',
            background: pip.color || 'var(--text-primary)',
            top: pip.top,
            left: pip.left,
            transform: 'translate(-50%, -50%)',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4), 0 1px 1px rgba(255,255,255,0.6)',
          }}
        />
      ))}
    </div>
  );
}

export default function DiceRoller({ dice = [1, 1], isRolling = false, lastSum = null }) {
  const [displayDice, setDisplayDice] = useState(dice);
  const [rotations, setRotations] = useState([0, 0]);

  useEffect(() => {
    if (isRolling) {
      const interval = setInterval(() => {
        setDisplayDice([
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
        ]);
        setRotations([
          (Math.random() - 0.5) * 45,
          (Math.random() - 0.5) * 45,
        ]);
      }, 60);
      return () => clearInterval(interval);
    } else {
      setDisplayDice(dice);
      setRotations([0, 0]);
    }
  }, [isRolling, dice]);

  const sum = isRolling
    ? null
    : (lastSum !== null && lastSum !== undefined ? lastSum : (displayDice[0] + displayDice[1]));

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'rgba(15,23,42,0.03)',
        padding: '8px 14px',
        borderRadius: 12,
        border: '1px solid rgba(15,23,42,0.08)',
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Die value={displayDice[0]} isRolling={isRolling} rotation={rotations[0]} />
        <Die value={displayDice[1]} isRolling={isRolling} rotation={rotations[1]} />
      </div>
      {sum && !isRolling && (
        <div
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: '#f8fafc',
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 900,
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.02em',
            boxShadow: '0 4px 10px rgba(15,23,42,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>🎲</span>
          <span>{sum} BƯỚC</span>
        </div>
      )}
    </div>
  );
}

