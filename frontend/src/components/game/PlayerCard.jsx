import React from 'react';
import { User, Trophy, Skull, WifiOff, Clock, Building, DollarSign, Wallet, ShieldCheck, Sparkles } from 'lucide-react';
import { AnimatedNumber } from '../ui';

const DEFAULT_SEAT_COLORS = ['#38bdf8', '#ef4444', '#10b981', '#f59e0b'];

export default function PlayerCard({
  player,
  isCurrentTurn = false,
  isMe = false,
  turnTimeRemaining = 25,
  propertiesOwnedCount = 0,
  ownedProperties = [],
}) {
  const {
    seatIndex = 0,
    cash = 1500,
    netWorth = 1500,
    propertyValue = 0,
    status = 'ACTIVE',
    isOnline = true,
    user,
  } = player || {};

  const seatColor = player?.color || DEFAULT_SEAT_COLORS[seatIndex] || '#38bdf8';
  const displayName = user?.name || `Người chơi ${seatIndex + 1}`;
  const avatarUrl = user?.avatarUrl || user?.avatarData;
  const isBankrupt = status === 'BANKRUPT';
  const isWinner = status === 'WINNER';
  const isBot = Boolean(user?.isBot || user?.isSimulated);

  // Progress percentage for 25s turn timer
  const timerPercent = Math.max(0, Math.min(100, (turnTimeRemaining / 25) * 100));

  return (
    <div
      style={{
        background: isBankrupt
          ? 'var(--surface-muted)'
          : isCurrentTurn
          ? 'linear-gradient(145deg, var(--surface) 0%, rgba(56,189,248,0.06) 100%)'
          : 'var(--surface)',
        border: isCurrentTurn
          ? `2px solid ${seatColor}`
          : isMe
          ? '2px solid var(--text-primary)'
          : '1px solid rgba(15,23,42,0.1)',
        borderRadius: 12,
        padding: '12px 14px',
        position: 'relative',
        boxShadow: isCurrentTurn
          ? `0 0 20px ${seatColor}33, 0 6px 16px rgba(15,23,42,0.08)`
          : '0 2px 8px rgba(15,23,42,0.04)',
        opacity: isBankrupt ? 0.5 : 1,
        transition: 'all var(--motion-normal) var(--ease-spring)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        overflow: 'hidden',
      }}
    >
      {/* Top Animated Turn Timer Progress Bar */}
      {isCurrentTurn && !isBankrupt && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3.5,
            background: 'rgba(15,23,42,0.08)',
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${timerPercent}%`,
              background: turnTimeRemaining <= 5 ? '#ef4444' : seatColor,
              transition: 'width 1s linear, background-color var(--motion-fast) var(--ease-standard)',
            }}
          />
        </div>
      )}

      {/* Header Info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {/* Avatar / Token Badge */}
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${seatColor} 0%, ${seatColor}cc 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: 14,
              border: '2.5px solid #ffffff',
              boxShadow: isCurrentTurn
                ? `0 0 10px ${seatColor}, 0 2px 6px rgba(0,0,0,0.25)`
                : '0 2px 6px rgba(0,0,0,0.18)',
              overflow: 'hidden',
              flexShrink: 0,
              position: 'relative',
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : isBot ? (
              '🤖'
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: 800,
                  color: isBankrupt ? 'var(--text-muted)' : 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 120,
                }}
                title={displayName}
              >
                {displayName}
              </span>
              {isBot && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    background: 'var(--info-soft)',
                    color: 'var(--info)',
                    padding: '1px 5px',
                    borderRadius: 4,
                    flexShrink: 0,
                  }}
                >
                  BOT
                </span>
              )}
              {isMe && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 900,
                    background: 'var(--text-primary)',
                    color: 'var(--surface)',
                    padding: '1px 5px',
                    borderRadius: 4,
                    flexShrink: 0,
                  }}
                >
                  BẠN
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: seatColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                P{seatIndex + 1}
              </span>
              <span>•</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Building size={11} /> {propertiesOwnedCount} đất
              </span>
              {!isOnline && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, color: '#ef4444' }}>
                  <WifiOff size={10} />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status Tag */}
        {isBankrupt ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(239,68,68,0.12)',
              color: '#ef4444',
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 10.5,
              fontWeight: 800,
            }}
          >
            <Skull size={12} /> PHÁ SẢN
          </span>
        ) : isWinner ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(245,158,11,0.15)',
              color: '#d97706',
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 10.5,
              fontWeight: 800,
            }}
          >
            <Trophy size={12} /> VÔ ĐỊCH
          </span>
        ) : isCurrentTurn ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: `${seatColor}22`,
              color: seatColor,
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 900,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            <Clock size={12} /> {turnTimeRemaining}s
          </span>
        ) : null}
      </div>

      {/* Financial Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 6,
          background: isBankrupt ? 'transparent' : 'rgba(15,23,42,0.03)',
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid rgba(15,23,42,0.06)',
        }}
      >
        <div>
          <div style={{ fontSize: 9.5, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
            Tiền mặt
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: isBankrupt ? 'var(--text-muted)' : '#16a34a',
              fontFamily: 'JetBrains Mono, monospace',
              marginTop: 1,
            }}
          >
            $<AnimatedNumber value={cash} duration={500} />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9.5, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
            Tài sản
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: isBankrupt ? 'var(--text-muted)' : 'var(--info)',
              fontFamily: 'JetBrains Mono, monospace',
              marginTop: 1,
            }}
          >
            $<AnimatedNumber value={propertyValue} duration={500} />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9.5, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
            Tổng giá trị
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: isBankrupt ? 'var(--text-muted)' : '#8b5cf6',
              fontFamily: 'JetBrains Mono, monospace',
              marginTop: 1,
            }}
          >
            $<AnimatedNumber value={netWorth} duration={500} />
          </div>
        </div>
      </div>

      {/* Owned Property Color Chips (if any) */}
      {ownedProperties && ownedProperties.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', paddingTop: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>Đất:</span>
          {ownedProperties.map((prop) => (
            <span
              key={prop.id || prop.tileIndex}
              title={`${prop.propertyName} ($${prop.price})`}
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: prop.groupColor || '#38bdf8',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                display: 'inline-block',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

