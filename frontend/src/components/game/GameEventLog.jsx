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
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AnimatedCollapse } from '../ui';

const EVENT_TYPE_CONFIG = {
  ROOM_CREATED: { icon: Activity, color: 'var(--accent)', soft: 'var(--accent-soft)', label: 'Tạo phòng' },
  PLAYER_JOINED: { icon: ArrowRight, color: 'var(--accent)', soft: 'var(--accent-soft)', label: 'Tham gia' },
  PLAYER_LEFT: { icon: ArrowRight, color: 'var(--text-secondary)', label: 'Rời phòng' },
  GAME_STARTED: { icon: Trophy, color: '#16a34a', label: 'Bắt đầu' },
  DICE_ROLLED: { icon: Dice5, color: 'var(--info)', soft: 'var(--info-soft)', label: 'Xúc xắc' },
  PROPERTY_BOUGHT: { icon: Building, color: '#16a34a', label: 'Mua đất' },
  RENT_PAID: { icon: DollarSign, color: '#dc2626', label: 'Tiền thuê' },
  START_BONUS: { icon: Gift, color: '#16a34a', label: 'Thưởng vòng' },
  TAX_PAID: { icon: CreditCard, color: '#ea580c', label: 'Thuế / Phí' },
  BONUS_RECEIVED: { icon: Gift, color: '#f59e0b', label: 'Kho báu' },
  EVENT_TRIGGERED: { icon: Sparkles, color: '#9333ea', label: 'Cơ hội' },
  BANKRUPTCY: { icon: Skull, color: '#ef4444', label: 'Phá sản' },
  GAME_FINISHED: { icon: Trophy, color: '#eab308', label: 'Kết thúc' },
};

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function parseEventMessage(ev) {
  const type = ev.type || ev.eventType;
  const payload = ev.payload || {};

  switch (type) {
    case 'ROOM_CREATED':
      return `Phòng chơi được tạo: "${payload.title || 'Phòng cờ tỷ phú'}"`;
    case 'PLAYER_JOINED':
      return `${payload.name || 'Người chơi'} đã tham gia vào phòng (Vị trí ${Number(payload.seatIndex || 0) + 1})`;
    case 'PLAYER_LEFT':
      return 'Một người chơi đã rời khỏi phòng.';
    case 'GAME_STARTED':
      return 'Trận đấu chính thức bắt đầu!';
    case 'DICE_ROLLED':
      return `Tung xúc xắc: ${payload.die1 || '?'}+${payload.die2 || '?'} = ${payload.total || '?'} bước -> Đến ô "${payload.tileName || 'Ô bàn cờ'}"`;
    case 'PROPERTY_BOUGHT':
      return `Đã mua bất động sản "${payload.propertyName || 'Tài sản'}" với giá $${payload.price || 0}`;
    case 'RENT_PAID':
      return `Đã trả $${payload.rent || 0} tiền thuê cho "${payload.propertyName || 'Tài sản'}"`;
    case 'START_BONUS':
      return `Nhận +$${payload.amount || 200} thưởng vòng khi đi qua ô Khởi Hành!`;
    case 'TAX_PAID':
      return `Đóng khoản phí / thuế "${payload.taxName || 'Dịch vụ'}": -$${payload.amount || 100}`;
    case 'BONUS_RECEIVED':
      return `Nhận thưởng kho báu doanh nghiệp: +$${payload.amount || 150}`;
    case 'EVENT_TRIGGERED':
      return `Cơ hội: "${payload.title || 'Sự kiện'}" (${payload.effect === 'ADD_CASH' ? `+$${payload.amount}` : `-$${payload.amount}`})`;
    case 'BANKRUPTCY':
      return `Đã phá sản: ${payload.reason || 'Hết tiền mặt'}`;
    case 'GAME_FINISHED':
      return 'Trận đấu kết thúc!';
    default:
      return ev.description || ev.message || 'Diễn biến trận đấu';
  }
}

export default function GameEventLog({ events = [], maxHeight = 420, collapsibleOnMobile = false }) {
  const logContainerRef = useRef(null);
  const [filter, setFilter] = useState('ALL');
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [events]);

  const filteredEvents = events.filter((ev) => {
    const type = ev.type || ev.eventType;
    if (filter === 'TRANSACTIONS') {
      return ['PROPERTY_BOUGHT', 'RENT_PAID', 'START_BONUS', 'TAX_PAID', 'BONUS_RECEIVED'].includes(type);
    }
    if (filter === 'CHANCE') {
      return type === 'EVENT_TRIGGERED';
    }
    return true;
  });

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid rgba(15,23,42,0.1)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          <Activity size={15} color="var(--info)" />
          <span>Nhật Ký Trận Đấu</span>
          <span
            style={{
              fontSize: 10,
              background: 'var(--text-primary)',
              color: 'var(--surface)',
              padding: '1px 6px',
              borderRadius: 10,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {events.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                    background: isActive ? 'var(--text-primary)' : 'transparent',
                    color: isActive ? 'var(--surface)' : 'var(--text-secondary)',
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

          {collapsibleOnMobile && (
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Log Feed */}
      <AnimatedCollapse isOpen={!isCollapsed}>
        <div
          ref={logContainerRef}
          style={{
            maxHeight,
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
                padding: '30px 10px',
                fontSize: 12,
                color: 'var(--text-muted)',
                fontStyle: 'italic',
              }}
            >
              Chưa có diễn biến nào...
            </div>
          ) : (
            filteredEvents.map((ev, idx) => {
              const type = ev.type || ev.eventType;
              const text = parseEventMessage(ev);
              const conf = EVENT_TYPE_CONFIG[type] || {
                icon: Scroll,
                color: 'var(--text-secondary)',
                label: 'Sự kiện',
              };
              const Icon = conf.icon;
              const isLatest = idx === filteredEvents.length - 1;

              return (
                <div
                  key={ev.id || `${type}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: isLatest ? 'var(--accent-soft)' : 'transparent',
                    border: isLatest ? '1px dashed var(--accent-border)' : '1px solid transparent',
                    fontSize: 12,
                    lineHeight: 1.35,
                    transition: 'background var(--motion-fast) var(--ease-standard)',
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: conf.soft || `${conf.color}15`,
                      color: conf.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    <Icon size={13} />
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--text-primary)', wordBreak: 'break-word', fontWeight: isLatest ? 600 : 400 }}>
                      {text}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text-muted)',
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
      </AnimatedCollapse>
    </div>
  );
}
