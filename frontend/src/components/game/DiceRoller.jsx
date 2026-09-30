import React, { useState, useEffect } from 'react';

const PIP_PATTERNS = {
  1: [{ top: '50%', left: '50%' }],
  2: [
    { top: '25%', left: '25%' },
    { top: '75%', left: '75%' },
  ],
  3: [
    { top: '25%', left: '25%' },
    { top: '50%', left: '50%' },
    { top: '75%', left: '75%' },
  ],
  4: [
    { top: '25%', left: '25%' },
    { top: '25%', left: '75%' },
    { top: '75%', left: '25%' },
    { top: '75%', left: '75%' },
  ],
  5: [
    { top: '25%', left: '25%' },
    { top: '25%', left: '75%' },
    { top: '50%', left: '50%' },
    { top: '75%', left: '25%' },
    { top: '75%', left: '75%' },
  ],
  6: [
    { top: '25%', left: '25%' },
    { top: '25%', left: '75%' },
    { top: '50%', left: '25%' },
    { top: '50%', left: '75%' },
    { top: '75%', left: '25%' },
    { top: '75%', left: '75%' },
  ],
};

function Die({ value, isRolling }) {
  const pips = PIP_PATTERNS[value] || PIP_PATTERNS[1];

  return (
    <div
      style={{
        width: 48,
        height: 48,
        background: '#ffffff',
        border: '2px solid #0f172a',
        borderRadius: 8,
        boxShadow: '0 4px 10px rgba(15,23,42,0.12), inset 0 -2px 0 rgba(15,23,42,0.06)',
        position: 'relative',
        transform: isRolling ? 'rotate(18deg) scale(1.05)' : 'none',
        transition: 'transform 0.15s ease',
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
            background: value === 1 ? '#ef4444' : '#0f172a',
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

  useEffect(() => {
    if (isRolling) {
      const interval = setInterval(() => {
        setDisplayDice([
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
        ]);
      }, 70);
      return () => clearInterval(interval);
    } else {
      setDisplayDice(dice);
    }
  }, [isRolling, dice]);

  const sum = isRolling
    ? null
    : (lastSum !== null && lastSum !== undefined ? lastSum : (displayDice[0] + displayDice[1]));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Die value={displayDice[0]} isRolling={isRolling} />
        <Die value={displayDice[1]} isRolling={isRolling} />
      </div>
      {sum && !isRolling && (
        <div
          style={{
            background: '#0f172a',
            color: '#ffffff',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 800,
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.02em',
          }}
        >
          {sum} bước
        </div>
      )}
    </div>
  );
}
