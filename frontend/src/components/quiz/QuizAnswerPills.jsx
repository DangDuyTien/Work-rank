import React, { useEffect } from 'react';
import { Check, X } from 'lucide-react';

const PILL_COLORS = {
  A: {
    bg: '#a7f3d0', // Mint cyan
    hoverBg: '#6ee7b7',
    text: '#064e3b',
  },
  B: {
    bg: '#c8be9f', // Sage olive
    hoverBg: '#b8ab87',
    text: '#363124',
  },
  C: {
    bg: '#d8a87b', // Camel tan
    hoverBg: '#ca925f',
    text: '#451a03',
  },
  D: {
    bg: '#cfa396', // Terracotta rose
    hoverBg: '#bd8b7c',
    text: '#4c1d18',
  },
};

export default function QuizAnswerPills({
  question,
  selectedOption = null,
  revealedCorrectOption = null,
  disabled = false,
  onSelectOption,
}) {
  if (!question) return null;

  const options = [
    { key: 'A', text: question.optionA || question.option_a },
    { key: 'B', text: question.optionB || question.option_b },
    { key: 'C', text: question.optionC || question.option_c },
    { key: 'D', text: question.optionD || question.option_d },
  ];

  // Keyboard shortcut listener
  useEffect(() => {
    if (disabled || selectedOption) return;

    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const key = e.key.toUpperCase();
      if (['A', '1'].includes(key)) onSelectOption('A');
      else if (['B', '2'].includes(key)) onSelectOption('B');
      else if (['C', '3'].includes(key)) onSelectOption('C');
      else if (['D', '4'].includes(key)) onSelectOption('D');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, selectedOption, onSelectOption]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: '100%',
      }}
    >
      {options.map(({ key, text }) => {
        const config = PILL_COLORS[key] || PILL_COLORS.A;
        const isSelected = selectedOption === key;
        const isCorrect = revealedCorrectOption === key;
        const isWrong = revealedCorrectOption && isSelected && !isCorrect;

        let background = config.bg;
        let textColor = config.text;
        let borderColor = '#000000';
        let boxShadow = '0 4px 0 #000000, 0 6px 14px rgba(0,0,0,0.15)';
        let opacity = 1;
        let transform = 'translateY(0)';

        if (revealedCorrectOption) {
          if (isCorrect) {
            background = '#10b981';
            textColor = '#ffffff';
            borderColor = '#047857';
            boxShadow = '0 0 24px rgba(16,185,129,0.7), 0 4px 0 #047857';
            transform = 'scale(1.02)';
          } else if (isWrong) {
            background = '#ef4444';
            textColor = '#ffffff';
            borderColor = '#991b1b';
            boxShadow = '0 2px 0 #991b1b';
            opacity = 0.8;
          } else {
            opacity = 0.35;
            boxShadow = 'none';
          }
        } else if (isSelected) {
          boxShadow = '0 0 0 3px #38bdf8, 0 4px 0 #000000, 0 8px 20px rgba(56,189,248,0.5)';
          transform = 'scale(0.99)';
        } else if (disabled) {
          opacity = 0.6;
        }

        return (
          <button
            key={key}
            type="button"
            onClick={() => !disabled && !selectedOption && onSelectOption(key)}
            disabled={disabled || Boolean(selectedOption)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              minHeight: 62,
              padding: '12px 24px',
              background,
              color: textColor,
              border: `2px solid ${borderColor}`,
              borderRadius: 40,
              boxShadow,
              opacity,
              transform,
              cursor: disabled || selectedOption ? 'default' : 'pointer',
              transition: 'transform 0.12s ease, box-shadow 0.15s ease, background 0.15s ease',
              textAlign: 'center',
              position: 'relative',
              userSelect: 'none',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              if (!disabled && !selectedOption && !revealedCorrectOption) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 0 #000000, 0 10px 20px rgba(0,0,0,0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled && !selectedOption && !revealedCorrectOption) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 0 #000000, 0 6px 14px rgba(0,0,0,0.15)';
              }
            }}
          >
            {/* Answer Text */}
            <span
              style={{
                fontSize: 17,
                fontWeight: 900,
                letterSpacing: '-0.2px',
                lineHeight: 1.3,
                wordBreak: 'break-word',
                textShadow: revealedCorrectOption || isSelected ? 'none' : '0 1px 0 rgba(255,255,255,0.4)',
              }}
            >
              {text}
            </span>

            {/* Status Icons */}
            {revealedCorrectOption && isCorrect && (
              <div
                style={{
                  position: 'absolute',
                  right: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#ffffff',
                  color: '#10b981',
                }}
              >
                <Check size={18} strokeWidth={3.5} />
              </div>
            )}

            {revealedCorrectOption && isWrong && (
              <div
                style={{
                  position: 'absolute',
                  right: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#ffffff',
                }}
              >
                <X size={18} strokeWidth={3.5} />
              </div>
            )}

            {isSelected && !revealedCorrectOption && (
              <div
                style={{
                  position: 'absolute',
                  right: 18,
                  fontSize: 10,
                  fontWeight: 900,
                  fontFamily: 'JetBrains Mono, monospace',
                  background: '#0f172a',
                  color: '#ffffff',
                  padding: '3px 8px',
                  borderRadius: 20,
                  border: '1px solid #38bdf8',
                }}
              >
                ĐÃ CHỌN
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
