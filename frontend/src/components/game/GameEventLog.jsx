import React, { useRef, useEffect, useState } from 'react';
import {
  ListFilter,
  Scroll,
  Dice5,
  Building,
  DollarSign,
  Gift,
  CreditCard,
  Sparkles,
  Skull,
  Trophy,
  ArrowRight,
  Activity,
} from 'lucide-react';

const EVENT_TYPE_CONFIG = {
  ROLL_DICE: { icon: Dice5, color: '#38bdf8', label: 'Xúc xắc' },
  MOVE: { icon: ArrowRight, color: '#64748b', label: 'Di chuyển' },
  BUY_PROPERTY: { icon: Building, color: '#16a34a', label: 'Mua đất' },
  PAY_RENT: { icon: DollarSign, color: '#dc2626', label: 'Tiền thuê' },
  PASS_START: { icon: Gift, color: '#16a34a', label: 'Khởi hành' },
  PAY_TAX: { icon: CreditCard, color: '#ea580c', label: 'Thuế' },
  BONUS: { icon: Gift, color: '#f59e0b', label: 'Thưởng' },
  CHANCE_EVENT: { icon: Sparkles, color: '#9333ea', label: 'Cơ hội' },
  BANKRUPT: { icon: Skull, color: '#ef4444', label: 'Phá sản' },
  GAME_OVER: { icon: Trophy, color: '#eab308', label: 'Kết thúc' },
};

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function GameEventLog({ events = [], maxHeight = 380 }) {
  const logContainerRef = useRef(null);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [events]);

  const filteredEvents = events.filter((ev) => {
    const type = ev.eventType || ev.type;
    if (filter === 'TRANSACTIONS') {
      return ['BUY_PROPERTY', 'PAY_RENT', 'PASS_START', 'PAY_TAX', 'BONUS'].includes(type);
    }
    if (filter === 'CHANCE') {
      return type === 'CHANCE_EVENT';
    }
    return true;
  });

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid rgba(15,23,42,0.1)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        height: maxHeight,
        boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid rgba(15,23,42,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15,23,42,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
          <Activity size={15} color="#0284c7" />
          <span>Nhật Ký Trận Đấu</span>
          <span
            style={{
              fontSize: 10,
              background: '#0f172a',
              color: '#ffffff',
              padding: '1px 6px',
              borderRadius: 10,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {events.length}
          </span>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 4 }}>
          {['ALL', 'TRANSACTIONS', 'CHANCE'].map((f) => {
            const labels = { ALL: 'Tất cả', TRANSACTIONS: 'Giao dịch', CHANCE: 'Cơ hội' };
            const isActive = filter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                style={{
                  background: isActive ? '#0f172a' : 'transparent',
                  color: isActive ? '#ffffff' : '#64748b',
                  border: 'none',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {labels[f]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Log Feed */}
      <div
        ref={logContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {filteredEvents.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              fontSize: 12,
              color: '#94a3b8',
              fontStyle: 'italic',
            }}
          >
            Chưa có diễn biến nào...
          </div>
        ) : (
          filteredEvents.map((ev, idx) => {
            const eventType = ev.eventType || ev.type;
            const description = ev.description || ev.payload?.description || ev.message || ev.text || 'Sự kiện trò chơi';
            const conf = EVENT_TYPE_CONFIG[eventType] || {
              icon: Scroll,
              color: '#64748b',
              label: 'Sự kiện',
            };
            const Icon = conf.icon;

            return (
              <div
                key={ev.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '5px 8px',
                  borderRadius: 6,
                  background: idx === filteredEvents.length - 1 ? 'rgba(56,189,248,0.06)' : 'transparent',
                  border: idx === filteredEvents.length - 1 ? '1px dashed rgba(56,189,248,0.3)' : '1px solid transparent',
                  fontSize: 12,
                  lineHeight: 1.35,
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: `${conf.color}15`,
                    color: conf.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  <Icon size={12} />
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#0f172a', wordBreak: 'break-word' }}>{description}</div>
                  <div
                    style={{
                      fontSize: 10,
                      color: '#94a3b8',
                      marginTop: 2,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    {formatTime(ev.createdAt || ev.timestamp)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
