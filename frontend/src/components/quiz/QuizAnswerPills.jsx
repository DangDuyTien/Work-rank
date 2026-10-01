import React, { useEffect } from 'react';
import { Check, X } from 'lucide-react';

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

  // Keyboard shortcut listener (1/A, 2/B, 3/C, 4/D)
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
        gap: 8,
        width: '100%',
      }}
    >
      {options.map(({ key, text }) => {
        const isSelected = selectedOption === key;
        const isCorrect = revealedCorrectOption === key;
        const isWrong = revealedCorrectOption && isSelected && !isCorrect;

        let background = '#ffffff';
        let textColor = '#141414';
        let borderColor = 'rgba(0, 0, 0, 0.12)';
        let badgeBg = '#f4f3ef';
        let badgeColor = '#666666';
        let boxShadow = '0 1px 2px rgba(0, 0, 0, 0.03)';
        let opacity = 1;
        let transform = 'translateY(0)';

        if (revealedCorrectOption) {
          if (isCorrect) {
            background = '#f0fdf4';
            textColor = '#15803d';
            borderColor = '#16a34a';
            badgeBg = '#16a34a';
            badgeColor = '#ffffff';
            boxShadow = '0 2px 8px rgba(22, 163, 74, 0.15)';
          } else if (isWrong) {
            background = '#fef2f2';
            textColor = '#991b1b';
            borderColor = '#dc2626';
            badgeBg = '#dc2626';
            badgeColor = '#ffffff';
            boxShadow = '0 1px 4px rgba(220, 38, 38, 0.1)';
          } else {
            opacity = 0.45;
            boxShadow = 'none';
          }
        } else if (isSelected) {
          background = '#fffbeb';
          textColor = '#92400e';
          borderColor = '#b45309';
          badgeBg = '#b45309';
          badgeColor = '#ffffff';
          boxShadow = '0 1px 4px rgba(180, 83, 9, 0.15)';
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
              width: '100%',
              minHeight: 52,
              padding: '10px 14px',
              background,
              color: textColor,
              border: `1.5px solid ${borderColor}`,
              borderRadius: 6,
              boxShadow,
              opacity,
              transform,
              cursor: disabled || selectedOption ? 'default' : 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'left',
              position: 'relative',
              userSelect: 'none',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onMouseEnter={(e) => {
              if (!disabled && !selectedOption && !revealedCorrectOption) {
                e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.28)';
                e.currentTarget.style.background = '#f8f7f4';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!disabled && !selectedOption && !revealedCorrectOption) {
                e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.12)';
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              {/* Option Letter Badge (A, B, C, D) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 4,
                  background: badgeBg,
                  color: badgeColor,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                {key}
              </div>

              {/* Answer Text */}
              <span
                style={{
                  fontSize: 14,
                  fontWeight: isSelected || isCorrect ? 700 : 500,
                  lineHeight: 1.4,
                  wordBreak: 'break-word',
                }}
              >
                {text}
              </span>
            </div>

            {/* Status Icons / Indicator */}
            <div style={{ marginLeft: 10, flexShrink: 0 }}>
              {revealedCorrectOption ? (
                isCorrect ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: '#16a34a',
                      color: '#ffffff',
                    }}
                  >
                    <Check size={15} strokeWidth={3} />
                  </div>
                ) : isWrong ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: '#dc2626',
                      color: '#ffffff',
                    }}
                  >
                    <X size={15} strokeWidth={3} />
                  </div>
                ) : null
              ) : isSelected ? (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: 'JetBrains Mono, monospace',
                    background: 'rgba(180, 83, 9, 0.12)',
                    color: '#b45309',
                    padding: '2px 7px',
                    borderRadius: 4,
                  }}
                >
                  ĐÃ CHỌN
                </span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
