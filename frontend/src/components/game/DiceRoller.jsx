import React, { useState, useEffect } from 'react';

const PIP_PATTERNS = {
  1: [{ top: '50%', left: '50%' }],
  2: [
    { top: '28%', left: '28%' },
    { top: '72%', left: '72%' },
  ],
  3: [
    { top: '25%', left: '25%' },
    { top: '50%', left: '50%' },
    { top: '75%', left: '75%' },
  ],
  4: [
    { top: '28%', left: '28%' },
    { top: '28%', left: '72%' },
    { top: '72%', left: '28%' },
    { top: '72%', left: '72%' },
  ],
  5: [
    { top: '26%', left: '26%' },
    { top: '26%', left: '74%' },
    { top: '50%', left: '50%' },
    { top: '74%', left: '26%' },
    { top: '74%', left: '74%' },
  ],
  6: [
    { top: '24%', left: '28%' },
    { top: '24%', left: '72%' },
    { top: '50%', left: '28%' },
    { top: '50%', left: '72%' },
    { top: '76%', left: '28%' },
    { top: '76%', left: '72%' },
  ],
};

function Die({ value, isRolling, rotation = 0 }) {
  const pips = PIP_PATTERNS[value] || PIP_PATTERNS[1];

  return (
    <div
      style={{
        width: 48,
        height: 48,
        background: 'var(--surface)',
        border: '2px solid var(--text-primary)',
        borderRadius: 10,
        boxShadow: isRolling
          ? '0 8px 16px rgba(15,23,42,0.2), inset 0 -2px 0 rgba(15,23,42,0.1)'
          : '0 4px 10px rgba(15,23,42,0.12), inset 0 -2px 0 rgba(15,23,42,0.06)',
        position: 'relative',
        transform: isRolling
          ? `rotate(${rotation}deg) scale(1.08)`
          : 'rotate(0deg) scale(1)',
        transition: 'transform var(--motion-fast) var(--ease-standard), box-shadow var(--motion-fast) var(--ease-standard)',
      }}
    >
      {pips.map((pip, idx) => (
        <span
          key={idx}
          style={{
            position: 'absolute',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: value === 1 ? '#ef4444' : 'var(--text-primary)',
            top: pip.top,
            left: pip.left,
            transform: 'translate(-50%, -50%)',
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
          (Math.random() - 0.5) * 36,
          (Math.random() - 0.5) * 36,
        ]);
      }, 65);
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Die value={displayDice[0]} isRolling={isRolling} rotation={rotations[0]} />
        <Die value={displayDice[1]} isRolling={isRolling} rotation={rotations[1]} />
      </div>
      {sum && !isRolling && (
        <div
          style={{
            background: 'var(--text-primary)',
            color: 'var(--surface)',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 800,
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.02em',
            boxShadow: '0 2px 6px rgba(15,23,42,0.15)',
          }}
        >
          {sum} bước
        </div>
      )}
    </div>
  );
}
