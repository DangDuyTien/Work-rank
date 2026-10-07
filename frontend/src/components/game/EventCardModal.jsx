import React from 'react';
import { Sparkles, TrendingUp, TrendingDown, Gift, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';
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
      maxWidth={440}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16 }}>
        {/* Chance Card Graphic */}
        <div
          style={{
            width: '100%',
            background: isPositive
              ? 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(16,185,129,0.06) 100%)'
              : 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.06) 100%)',
            border: `2px dashed ${isPositive ? '#16a34a' : '#ef4444'}`,
            borderRadius: 14,
            padding: '20px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            boxShadow: `0 8px 20px ${isPositive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
          }}
        >
          {/* Animated Glowing Icon Badge */}
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              background: isPositive ? '#16a34a' : '#dc2626',
              border: '3px solid #ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: `0 0 20px ${isPositive ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)'}`,
            }}
          >
            {isPositive ? <Gift size={34} /> : <AlertTriangle size={34} />}
          </div>

          <div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: isPositive ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                color: isPositive ? '#15803d' : '#b91c1c',
                padding: '4px 10px',
                borderRadius: 20,
              }}
            >
              {isPositive ? '✨ SỰ KIỆN MAY MẮN' : '⚠️ CHI PHÍ BẤT NGỜ'}
            </span>

            <h3 style={{ margin: '10px 0 6px', fontSize: 19, fontWeight: 900, color: 'var(--text-primary)' }}>
              {event.title || 'Sự kiện doanh nghiệp'}
            </h3>

            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {event.description || 'Thẻ cơ hội đã được kích hoạt trong lượt này.'}
            </p>
          </div>

          {/* Amount Badge */}
          {amount > 0 && (
            <div
              style={{
                background: 'var(--surface)',
                border: `2px solid ${isPositive ? '#16a34a' : '#ef4444'}`,
                borderRadius: 10,
                padding: '8px 24px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 10px rgba(0,0,0,0.06)',
              }}
            >
              {isPositive ? <TrendingUp size={22} color="#16a34a" /> : <TrendingDown size={22} color="#ef4444" />}
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  color: isPositive ? '#16a34a' : '#dc2626',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {isPositive ? `+$${amount}` : `-$${amount}`}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, var(--text-primary) 0%, #1e293b 100%)',
            color: 'var(--surface)',
            border: 'none',
            borderRadius: 8,
            padding: '12px 18px',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: '0 4px 12px rgba(15,23,42,0.2)',
          }}
        >
          <CheckCircle2 size={16} />
          <span>Đã Hiểu & Tiếp Tục</span>
        </button>
      </div>
    </AnimatedModal>
  );
}

