import React from 'react';

export default function VerifiedBadge({ size = 16, color = '#0064e0', className = '', style = {} }) {
  // Tạo hình sao với nhiều nếp cứa và nhọn hơn
  const numSpikes = 14;
  const outerRadius = 11.6;
  const innerRadius = 9.4; // Tăng lên một chút để bớt nhọn
  
  const pts = [];
  for (let i = 0; i < numSpikes * 2; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const a = (i * Math.PI) / numSpikes;
    const x = 12 + r * Math.sin(a);
    const y = 12 - r * Math.cos(a);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  const polygonPoints = pts.join(' ');

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <polygon fill={color} points={polygonPoints} />
      <path
        fill="#ffffff"
        d="M10.05 16.596l-4.11-4.11 1.414-1.414 2.697 2.696 6.386-6.386 1.414 1.414-7.8 7.8z"
      />
    </svg>
  );
}
