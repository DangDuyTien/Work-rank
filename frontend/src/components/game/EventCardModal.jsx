import React from 'react';
import { Sparkles, TrendingUp, TrendingDown, Gift, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AnimatedModal } from '../ui';

export default function EventCardModal({
  isOpen,
  onClose,
  event,
  actorName = 'Bạn',
}) {
  if (!event) return null;

  const isPositive = event.effect === 'ADD_CASH' || (event.amount && event.amount > 0);
  const amount = Math.abs(event.amount || 0);

  return (
    <AnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Thẻ Cơ Hội & Vận May"
      maxWidth={420}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16 }}>
        {/* Animated Card Visual */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: isPositive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            border: `2px solid ${isPositive ? '#16a34a' : '#ef4444'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isPositive ? '#16a34a' : '#ef4444',
            boxShadow: `0 0 16px ${isPositive ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
            animation: 'pulse 1.5s infinite',
          }}
        >
          {isPositive ? <Gift size={32} /> : <AlertTriangle size={32} />}
        </div>

        <div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              background: isPositive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              color: isPositive ? '#16a34a' : '#dc2626',
              padding: '3px 8px',
              borderRadius: 4,
            }}
          >
            {isPositive ? 'SỰ KIỆN MAY MẮN' : 'CHI PHÍ BẤT NGỜ'}
          </span>

          <h3 style={{ margin: '8px 0 6px', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
            {event.title || 'Sự kiện doanh nghiệp'}
          </h3>

          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {event.description || 'Thẻ cơ hội đã được kích hoạt trong lượt này.'}
          </p>
        </div>

        {/* Amount Badge */}
        {amount > 0 && (
          <div
            style={{
              background: isPositive ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1.5px solid ${isPositive ? '#16a34a' : '#ef4444'}`,
              borderRadius: 8,
              padding: '10px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {isPositive ? <TrendingUp size={20} color="#16a34a" /> : <TrendingDown size={20} color="#ef4444" />}
            <span
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: isPositive ? '#16a34a' : '#dc2626',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {isPositive ? `+$${amount}` : `-$${amount}`}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            background: 'var(--text-primary)',
            color: 'var(--surface)',
            border: 'none',
            borderRadius: 6,
            padding: '10px 16px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: 6,
          }}
        >
          <CheckCircle2 size={16} />
          <span>Xác Nhận</span>
        </button>
      </div>
    </AnimatedModal>
  );
}
