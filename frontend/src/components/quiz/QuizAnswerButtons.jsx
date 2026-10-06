import React, { useEffect } from 'react';
import { Check, X } from 'lucide-react';

const OPTIONS_KEYS = ['A', 'B', 'C', 'D'];

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
      // Ignore if user is typing in an input
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
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 12,
        width: '100%',
        margin: '0 auto',
      }}
    >
      {options.map(({ key, text }) => {
        const isSelected = selectedOption === key;
        const isCorrect = revealedCorrectOption === key;
        const isWrong = revealedCorrectOption && isSelected && !isCorrect;

        let background = 'var(--surface)';
        let borderColor = 'rgba(15,23,42,0.12)';
        let textColor = 'var(--text-primary)';
        let badgeBg = 'rgba(15,23,42,0.06)';
        let badgeColor = 'var(--text-secondary)';
        let opacity = 1;
        let shadow = '0 1px 3px rgba(15,23,42,0.04)';

        if (revealedCorrectOption) {
          if (isCorrect) {
            background = '#ecfdf5';
            borderColor = '#10b981';
            textColor = '#065f46';
            badgeBg = '#10b981';
            badgeColor = 'var(--surface)';
            shadow = '0 4px 12px rgba(16,185,129,0.15)';
          } else if (isWrong) {
            background = '#fef2f2';
            borderColor = '#ef4444';
            textColor = '#991b1b';
            badgeBg = '#ef4444';
            badgeColor = 'var(--surface)';
            shadow = '0 2px 8px rgba(239,68,68,0.1)';
          } else {
            opacity = 0.45;
            borderColor = 'rgba(15,23,42,0.08)';
          }
        } else if (isSelected) {
          background = 'var(--info-soft)';
          borderColor = 'var(--info)';
          textColor = 'var(--info)';
          badgeBg = 'var(--info)';
          badgeColor = 'var(--surface)';
          shadow = '0 0 0 1px var(--info), 0 4px 12px var(--info-border)';
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
              minHeight: 58,
              padding: '12px 16px',
              background,
              color: textColor,
              border: `1.5px solid ${borderColor}`,
              borderRadius: 10,
              boxShadow: shadow,
              opacity,
              cursor: disabled || selectedOption ? 'default' : 'pointer',
              transition: 'background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), box-shadow var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard), opacity var(--motion-fast) var(--ease-standard), transform var(--motion-fast) var(--ease-standard)',
              textAlign: 'left',
              position: 'relative',
              userSelect: 'none',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              if (!disabled && !selectedOption && !revealedCorrectOption) {
                e.currentTarget.style.borderColor = 'var(--info)';
                e.currentTarget.style.background = 'var(--info-soft)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled && !selectedOption && !revealedCorrectOption) {
                e.currentTarget.style.borderColor = 'rgba(15,23,42,0.12)';
                e.currentTarget.style.background = 'var(--surface)';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
              {/* Option Letter Badge (A, B, C, D) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: badgeBg,
                  color: badgeColor,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 14,
                  fontWeight: 700,
                  flexShrink: 0,
                  transition: 'background-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard), transform var(--motion-fast) var(--ease-standard)',
                }}
              >
                {key}
              </div>

              {/* Option Answer Text */}
              <span
                style={{
                  fontSize: 14,
                  fontWeight: isSelected || isCorrect ? 600 : 500,
                  lineHeight: 1.55,
                  wordBreak: 'break-word',
                }}
              >
                {text}
              </span>
            </div>

            {/* Right Status Indicator */}
            <div style={{ marginLeft: 12, flexShrink: 0 }}>
              {revealedCorrectOption ? (
                isCorrect ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: '#10b981',
                      color: 'var(--surface)',
                    }}
                  >
                    <Check size={16} strokeWidth={3} />
                  </div>
                ) : isWrong ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: '#ef4444',
                      color: 'var(--surface)',
                    }}
                  >
                    <X size={16} strokeWidth={3} />
                  </div>
                ) : null
              ) : isSelected ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    background: 'var(--info-border)',
                    color: 'var(--info)',
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  ĐÃ CHỌN
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    fontFamily: 'JetBrains Mono, monospace',
                    background: 'rgba(15,23,42,0.04)',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  {key}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
