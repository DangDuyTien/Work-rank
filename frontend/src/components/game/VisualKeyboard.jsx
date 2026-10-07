import React, { useMemo } from 'react';
import {
  Delete,
  CornerDownLeft,
  ArrowBigUp,
  ArrowRightToLine,
  Lock,
  Keyboard,
  CheckCircle2,
} from 'lucide-react';

/**
 * Standard ANSI Keyboard Layout Definition
 * width: Relative flex multiplier (1 = normal key, 1.5 = tab, 2 = backspace, 6.25 = space)
 */
export const KEYBOARD_LAYOUT = [
  // Row 1: Number Row
  [
    { code: 'Backquote', label: '`', shiftLabel: '~', width: 1 },
    { code: 'Digit1', label: '1', shiftLabel: '!', width: 1 },
    { code: 'Digit2', label: '2', shiftLabel: '@', width: 1 },
    { code: 'Digit3', label: '3', shiftLabel: '#', width: 1 },
    { code: 'Digit4', label: '4', shiftLabel: '$', width: 1 },
    { code: 'Digit5', label: '5', shiftLabel: '%', width: 1 },
    { code: 'Digit6', label: '6', shiftLabel: '^', width: 1 },
    { code: 'Digit7', label: '7', shiftLabel: '&', width: 1 },
    { code: 'Digit8', label: '8', shiftLabel: '*', width: 1 },
    { code: 'Digit9', label: '9', shiftLabel: '(', width: 1 },
    { code: 'Digit0', label: '0', shiftLabel: ')', width: 1 },
    { code: 'Minus', label: '-', shiftLabel: '_', width: 1 },
    { code: 'Equal', label: '=', shiftLabel: '+', width: 1 },
    { code: 'Backspace', label: 'Backspace', icon: 'backspace', width: 2, isSpecial: true, isAction: true },
  ],
  // Row 2: Top Alpha Row
  [
    { code: 'Tab', label: 'Tab', icon: 'tab', width: 1.5, isSpecial: true },
    { code: 'KeyQ', label: 'Q', width: 1 },
    { code: 'KeyW', label: 'W', width: 1 },
    { code: 'KeyE', label: 'E', width: 1 },
    { code: 'KeyR', label: 'R', width: 1 },
    { code: 'KeyT', label: 'T', width: 1 },
    { code: 'KeyY', label: 'Y', width: 1 },
    { code: 'KeyU', label: 'U', width: 1 },
    { code: 'KeyI', label: 'I', width: 1 },
    { code: 'KeyO', label: 'O', width: 1 },
    { code: 'KeyP', label: 'P', width: 1 },
    { code: 'BracketLeft', label: '[', shiftLabel: '{', width: 1 },
    { code: 'BracketRight', label: ']', shiftLabel: '}', width: 1 },
    { code: 'Backslash', label: '\\', shiftLabel: '|', width: 1.5 },
  ],
  // Row 3: Home Row
  [
    { code: 'CapsLock', label: 'Caps', icon: 'lock', width: 1.75, isSpecial: true },
    { code: 'KeyA', label: 'A', width: 1 },
    { code: 'KeyS', label: 'S', width: 1 },
    { code: 'KeyD', label: 'D', width: 1 },
    { code: 'KeyF', label: 'F', width: 1, hasHomeBump: true },
    { code: 'KeyG', label: 'G', width: 1 },
    { code: 'KeyH', label: 'H', width: 1 },
    { code: 'KeyJ', label: 'J', width: 1, hasHomeBump: true },
    { code: 'KeyK', label: 'K', width: 1 },
    { code: 'KeyL', label: 'L', width: 1 },
    { code: 'Semicolon', label: ';', shiftLabel: ':', width: 1 },
    { code: 'Quote', label: "'", shiftLabel: '"', width: 1 },
    { code: 'Enter', label: 'Enter', icon: 'enter', width: 2.25, isSpecial: true, isAction: true },
  ],
  // Row 4: Bottom Alpha Row
  [
    { code: 'ShiftLeft', label: 'Shift', icon: 'shift', width: 2.25, isSpecial: true },
    { code: 'KeyZ', label: 'Z', width: 1 },
    { code: 'KeyX', label: 'X', width: 1 },
    { code: 'KeyC', label: 'C', width: 1 },
    { code: 'KeyV', label: 'V', width: 1 },
    { code: 'KeyB', label: 'B', width: 1 },
    { code: 'KeyN', label: 'N', width: 1 },
    { code: 'KeyM', label: 'M', width: 1 },
    { code: 'Comma', label: ',', shiftLabel: '<', width: 1 },
    { code: 'Period', label: '.', shiftLabel: '>', width: 1 },
    { code: 'Slash', label: '/', shiftLabel: '?', width: 1 },
    { code: 'ShiftRight', label: 'Shift', icon: 'shift', width: 2.75, isSpecial: true },
  ],
  // Row 5: Modifier & Spacebar Row
  [
    { code: 'ControlLeft', label: 'Ctrl', width: 1.5, isSpecial: true },
    { code: 'AltLeft', label: 'Alt', width: 1.25, isSpecial: true },
    { code: 'Space', label: 'SPACEBAR', width: 6.25, isSpace: true },
    { code: 'AltRight', label: 'Alt', width: 1.25, isSpecial: true },
    { code: 'ControlRight', label: 'Ctrl', width: 1.5, isSpecial: true },
  ],
];

/**
 * Maps a target character to the target key code(s) on the visual keyboard.
 */
export function getTargetKeyCodes(targetChar) {
  if (!targetChar) return [];
  if (targetChar === ' ') return ['Space'];
  if (targetChar === '\n') return ['Enter'];

  // Special shift-required symbols
  const shiftSymbols = {
    '~': ['ShiftLeft', 'Backquote'],
    '!': ['ShiftLeft', 'Digit1'],
    '@': ['ShiftLeft', 'Digit2'],
    '#': ['ShiftLeft', 'Digit3'],
    '$': ['ShiftLeft', 'Digit4'],
    '%': ['ShiftLeft', 'Digit5'],
    '^': ['ShiftLeft', 'Digit6'],
    '&': ['ShiftLeft', 'Digit7'],
    '*': ['ShiftLeft', 'Digit8'],
    '(': ['ShiftLeft', 'Digit9'],
    ')': ['ShiftLeft', 'Digit0'],
    '_': ['ShiftLeft', 'Minus'],
    '+': ['ShiftLeft', 'Equal'],
    '{': ['ShiftLeft', 'BracketLeft'],
    '}': ['ShiftLeft', 'BracketRight'],
    '|': ['ShiftLeft', 'Backslash'],
    ':': ['ShiftLeft', 'Semicolon'],
    '"': ['ShiftLeft', 'Quote'],
    '<': ['ShiftLeft', 'Comma'],
    '>': ['ShiftLeft', 'Period'],
    '?': ['ShiftLeft', 'Slash'],
  };

  if (shiftSymbols[targetChar]) {
    return shiftSymbols[targetChar];
  }

  // Normal punctuation & symbols
  const normalSymbols = {
    '`': ['Backquote'],
    '-': ['Minus'],
    '=': ['Equal'],
    '[': ['BracketLeft'],
    ']': ['BracketRight'],
    '\\': ['Backslash'],
    ';': ['Semicolon'],
    "'": ['Quote'],
    ',': ['Comma'],
    '.': ['Period'],
    '/': ['Slash'],
  };

  if (normalSymbols[targetChar]) {
    return normalSymbols[targetChar];
  }

  // Digits 0-9
  if (targetChar >= '0' && targetChar <= '9') {
    return [`Digit${targetChar}`];
  }

  // Standard Latin Alphabet A-Z & Vietnamese Telex base key (No Shift / CapsLock required)
  const normalizedBase = targetChar
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (normalizedBase >= 'A' && normalizedBase <= 'Z') {
    return [`Key${normalizedBase}`];
  }

  return [];
}

/**
 * Minimalist Keyboard Component perfectly synchronized with WorkRank Theme Palette
 * (Uses WorkRank's CSS design tokens: --surface, --surface-soft, --border, --accent, --text-primary)
 */
export default function VisualKeyboard({
  activeKeys = new Set(),
  targetChar = '',
  lastFeedback = null, // 'correct' | 'error' | null
  onKeyClick = null,
}) {
  const targetCodes = useMemo(() => getTargetKeyCodes(targetChar), [targetChar]);

  const renderKeyIcon = (iconName, isPressed) => {
    const iconColor = isPressed ? '#ffffff' : 'currentColor';
    switch (iconName) {
      case 'backspace':
        return <Delete size={13} style={{ color: iconColor }} />;
      case 'enter':
        return <CornerDownLeft size={13} style={{ color: iconColor }} />;
      case 'shift':
        return <ArrowBigUp size={13} style={{ color: iconColor }} />;
      case 'tab':
        return <ArrowRightToLine size={12} style={{ color: iconColor }} />;
      case 'lock':
        return <Lock size={11} style={{ color: iconColor }} />;
      default:
        return null;
    }
  };

  return (
    <div
      className="workrank-minimal-keyboard"
      style={{
        width: '100%',
        maxWidth: 860,
        margin: '0 auto',
        padding: '12px 14px',
        background: 'var(--surface-soft, #f0eee9)',
        border: '1px solid var(--border-strong, rgba(0, 0, 0, 0.12))',
        borderRadius: 12,
        boxShadow: '0 4px 14px -4px rgba(0, 0, 0, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        userSelect: 'none',
      }}
    >
      {/* Top Status Bar with Lucide Icons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 8,
          marginBottom: 2,
          borderBottom: '1px solid var(--border, rgba(0, 0, 0, 0.08))',
          fontSize: 11,
          color: 'var(--text-secondary, #555555)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Keyboard size={14} style={{ color: 'var(--accent, #b45309)' }} />
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: activeKeys.size > 0 ? 'var(--accent, #b45309)' : 'var(--success, #15803d)',
              boxShadow: activeKeys.size > 0 ? '0 0 6px var(--accent, #b45309)' : 'none',
              transition: 'background var(--motion-fast) var(--ease-standard), box-shadow var(--motion-fast) var(--ease-standard)',
            }}
          />
          <span style={{ fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 11, color: 'var(--text-primary, #111111)' }}>
            Bàn phím trực quan
          </span>
        </div>

        {targetChar && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted, #777777)' }}>Phím mục tiêu:</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'var(--accent-soft, rgba(180, 83, 9, 0.08))',
                color: 'var(--accent, #b45309)',
                border: '1px solid var(--accent-border, rgba(180, 83, 9, 0.25))',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {targetChar === ' ' ? 'SPACE' : targetChar === '\n' ? 'ENTER' : targetChar}
            </span>
          </div>
        )}
      </div>

      {/* 5 Rows of Keycaps Synced with WorkRank Theme */}
      {KEYBOARD_LAYOUT.map((row, rowIndex) => (
        <div
          key={rowIndex}
          style={{
            display: 'flex',
            gap: 4,
            width: '100%',
          }}
        >
          {row.map((key) => {
            const isPressed =
              activeKeys.has(key.code) ||
              (key.code === 'ShiftLeft' && activeKeys.has('ShiftRight')) ||
              (key.code === 'ShiftRight' && activeKeys.has('ShiftLeft')) ||
              (key.code === 'ControlLeft' && activeKeys.has('ControlRight')) ||
              (key.code === 'ControlRight' && activeKeys.has('ControlLeft'));

            const isTarget = targetCodes.includes(key.code);

            // Clean, theme-synchronized keycap styling
            let bg = 'var(--surface, #ffffff)';
            let color = 'var(--text-primary, #111111)';
            let borderColor = 'rgba(0, 0, 0, 0.1)';
            let borderBottom = '2px solid rgba(0, 0, 0, 0.16)';
            let transform = 'translateY(0px)';
            let boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';

            if (isPressed) {
              if (lastFeedback === 'error') {
                bg = '#dc2626';
                color = '#ffffff';
                borderColor = '#b91c1c';
                borderBottom = '1px solid #991b1b';
                transform = 'translateY(1.5px)';
                boxShadow = '0 0 8px rgba(220, 38, 38, 0.35)';
              } else {
                bg = 'var(--accent, #b45309)';
                color = '#ffffff';
                borderColor = '#92400e';
                borderBottom = '1px solid #78350f';
                transform = 'translateY(1.5px)';
                boxShadow = '0 0 8px rgba(180, 83, 9, 0.35)';
              }
            } else if (isTarget) {
              bg = 'var(--accent-soft, rgba(180, 83, 9, 0.1))';
              color = 'var(--accent, #b45309)';
              borderColor = 'var(--accent, #b45309)';
              borderBottom = '2px solid var(--accent, #b45309)';
            } else if (key.isSpecial) {
              bg = 'var(--surface-muted, #eceae4)';
              color = 'var(--text-secondary, #555555)';
              borderColor = 'rgba(0, 0, 0, 0.08)';
              borderBottom = '2px solid rgba(0, 0, 0, 0.14)';
            }

            return (
              <button
                key={key.code}
                type="button"
                onClick={() => onKeyClick && onKeyClick(key)}
                tabIndex={-1}
                aria-label={key.label}
                style={{
                  flex: key.width || 1,
                  minWidth: 0,
                  height: 38,
                  padding: '2px 4px',
                  background: bg,
                  color,
                  border: `1px solid ${borderColor}`,
                  borderBottom,
                  borderRadius: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: key.isSpecial ? 10.5 : 12,
                  fontWeight: isPressed || isTarget ? 700 : 600,
                  cursor: 'pointer',
                  transform,
                  boxShadow,
                  position: 'relative',
                  outline: 'none',
                  transition:
                    'transform var(--motion-fast) var(--ease-standard), background var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard)',
                }}
              >
                {/* Secondary Shift Label */}
                {key.shiftLabel && (
                  <span
                    style={{
                      fontSize: 8.5,
                      lineHeight: 1,
                      color: isPressed ? '#ffffff' : 'var(--text-muted, #777777)',
                      marginBottom: 1,
                      opacity: 0.85,
                    }}
                  >
                    {key.shiftLabel}
                  </span>
                )}

                {/* Main Key Label with Library Icons */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    lineHeight: 1.1,
                    letterSpacing: key.isSpecial ? '-0.02em' : '0.02em',
                  }}
                >
                  {key.icon && renderKeyIcon(key.icon, isPressed)}
                  {key.label}
                </span>

                {/* Tactile Home Row Minimal Dash on F & J */}
                {key.hasHomeBump && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 3,
                      width: 8,
                      height: 1.5,
                      background: isPressed ? '#ffffff' : 'var(--accent, #b45309)',
                      borderRadius: 1,
                      opacity: 0.8,
                    }}
                  />
                )}

                {/* Target Minimal Indicator Dot */}
                {isTarget && !isPressed && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 3,
                      right: 3,
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: 'var(--accent, #b45309)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
