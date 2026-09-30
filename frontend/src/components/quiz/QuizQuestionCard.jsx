import React from 'react';

export default function QuizQuestionCard({
  question,
}) {
  if (!question) return null;

  return (
    <div
      style={{
        width: '100%',
        marginBottom: 16,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 900,
          color: '#ffffff',
          lineHeight: 1.4,
          textAlign: 'center',
          letterSpacing: '-0.2px',
          textShadow: `
            -1.5px -1.5px 0 #000,
             1.5px -1.5px 0 #000,
            -1.5px  1.5px 0 #000,
             1.5px  1.5px 0 #000,
             0 3px 6px rgba(0,0,0,0.8)
          `,
        }}
      >
        "{question.question}"
      </h2>
    </div>
  );
}
