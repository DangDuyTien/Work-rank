import React, { useEffect } from 'react';
import { Check, X, Triangle, Diamond, Circle, Square } from 'lucide-react';

const OPTIONS_CONFIG = {
  A: {
    label: 'A',
    bg: '#e11d48',
    hoverBg: '#be123c',
    border: '#9f1239',
    icon: Triangle,
    shortcut: 'A',
  },
  B: {
    label: 'B',
    bg: '#0284c7',
    hoverBg: '#0369a1',
    border: '#075985',
    icon: Diamond,
    shortcut: 'B',
  },
  C: {
    label: 'C',
    bg: '#d97706',
    hoverBg: '#b45309',
    border: '#92400e',
    icon: Circle,
    shortcut: 'C',
  },
  D: {
    label: 'D',
    bg: '#059669',
    hoverBg: '#047857',
    border: '#065f46',
    icon: Square,
    shortcut: 'D',
  },
};

export default function QuizAnswerButtons({
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
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 14,
        width: '100%',
        maxWidth: 900,
        margin: '16px auto 0',
      }}
    >
      {options.map(({ key, text }) => {
        const config = OPTIONS_CONFIG[key];
        const Icon = config.icon;
        const isSelected = selectedOption === key;
        const isCorrect = revealedCorrectOption === key;
        const isWrong = revealedCorrectOption && isSelected && !isCorrect;

        let background = config.bg;
        let opacity = 1;
        let transform = 'translateY(0)';
        let boxShadow = `0 5px 0 ${config.border}, 0 10px 20px rgba(0,0,0,0.15)`;
        let border = '2px solid rgba(255,255,255,0.2)';

        if (revealedCorrectOption) {
          if (isCorrect) {
            background = '#10b981';
            boxShadow = '0 0 28px rgba(16,185,129,0.7), 0 5px 0 #047857';
            transform = 'scale(1.02)';
            border = '2px solid #ffffff';
          } else if (isWrong) {
            background = '#ef4444';
            boxShadow = '0 2px 0 #991b1b';
            opacity = 0.6;
          } else {
            opacity = 0.35;
            boxShadow = 'none';
          }
        } else if (isSelected) {
          boxShadow = `0 0 20px rgba(255,255,255,0.8), 0 2px 0 ${config.border}`;
          transform = 'scale(0.98)';
          border = '2px solid #ffffff';
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
              justifyContent: 'space-between',
              minHeight: 88,
              padding: '16px 20px',
              background,
              color: '#ffffff',
              border,
              borderRadius: 14,
              boxShadow,
              opacity,
              transform,
              cursor: disabled || selectedOption ? 'default' : 'pointer',
              transition: 'transform 0.1s ease, box-shadow 0.15s ease, opacity 0.2s ease',
              textAlign: 'left',
              position: 'relative',
              overflow: 'hidden',
              userSelect: 'none',
            }}
          >
            {/* Shape & Option Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                borderRadius: 10,
                background: 'rgba(0,0,0,0.25)',
                marginRight: 14,
                flexShrink: 0,
                color: '#ffffff',
              }}
            >
              <Icon size={24} strokeWidth={2.5} />
            </div>

            {/* Answer Text */}
            <div
              style={{
                flex: 1,
                fontSize: 16,
                fontWeight: 800,
                lineHeight: 1.35,
                wordBreak: 'break-word',
              }}
            >
              {text}
            </div>

            {/* Status Icons */}
            {revealedCorrectOption ? (
              isCorrect ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: '#ffffff',
                    color: '#10b981',
                    marginLeft: 10,
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  }}
                >
                  <Check size={20} strokeWidth={3.5} />
                </div>
              ) : isWrong ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.4)',
                    color: '#ffffff',
                    marginLeft: 10,
                    flexShrink: 0,
                  }}
                >
                  <X size={20} strokeWidth={3.5} />
                </div>
              ) : null
            ) : isSelected ? (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  background: 'rgba(255,255,255,0.3)',
                  padding: '5px 10px',
                  borderRadius: 8,
                  marginLeft: 10,
                  flexShrink: 0,
                  letterSpacing: '0.5px',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                ĐÃ CHỌN
              </div>
            ) : (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  background: 'rgba(0,0,0,0.2)',
                  padding: '3px 8px',
                  borderRadius: 6,
                  marginLeft: 8,
                  opacity: 0.7,
                  fontFamily: 'JetBrains Mono, monospace',
                  flexShrink: 0,
                }}
              >
                [{config.shortcut}]
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
