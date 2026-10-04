import React, { useState, useEffect } from 'react';
import { User, Trophy, Skull, WifiOff, Clock, Building, DollarSign, Wallet } from 'lucide-react';

export default function PlayerCard({
  player,
  isCurrentTurn = false,
  isMe = false,
  turnTimeRemaining = 25,
  propertiesOwnedCount = 0,
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

  const seatColor = player?.color || player?.seatColor || '#38bdf8';

  const displayName = user?.name || user?.username || `Người chơi ${seatIndex + 1}`;
  const avatarUrl = user?.avatarUrl || user?.avatar;
  const isBankrupt = status === 'BANKRUPT';
  const isWinner = status === 'WINNER';

  // Progress percentage for 25s turn timer
  const timerPercent = Math.max(0, Math.min(100, (turnTimeRemaining / 25) * 100));

  return (
    <div
      style={{
        background: isBankrupt ? '#f1f5f9' : '#ffffff',
        border: isCurrentTurn
          ? `2px solid ${seatColor}`
          : isMe
          ? '2px solid #0f172a'
          : '1px solid rgba(15,23,42,0.1)',
        borderRadius: 8,
        padding: 12,
        position: 'relative',
        boxShadow: isCurrentTurn
          ? `0 0 16px ${seatColor}33, 0 4px 12px rgba(15,23,42,0.08)`
          : '0 2px 6px rgba(15,23,42,0.04)',
        opacity: isBankrupt ? 0.6 : 1,
        transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease, transform 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Top Seat & Turn Bar */}
      {isCurrentTurn && !isBankrupt && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'rgba(15,23,42,0.08)',
            borderTopLeftRadius: 6,
            borderTopRightRadius: 6,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${timerPercent}%`,
              background: turnTimeRemaining <= 5 ? '#ef4444' : seatColor,
              transition: 'width 1s linear',
            }}
          />
        </div>
      )}

      {/* Header Info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Avatar / Token */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: seatColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 13,
              border: '2px solid #ffffff',
              boxShadow: '0 2px 4px rgba(15,23,42,0.15)',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: isBankrupt ? '#94a3b8' : '#0f172a',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 110,
                }}
                title={displayName}
              >
                {displayName}
              </span>
              {isMe && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    background: '#0f172a',
                    color: '#ffffff',
                    padding: '1px 4px',
                    borderRadius: 3,
                  }}
                >
                  BẠN
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: seatColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Vị trí {seatIndex + 1}
              </span>
              {!isOnline && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, color: '#ef4444' }}>
                  <WifiOff size={10} /> Mất kết nối
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
              gap: 3,
              background: 'rgba(239,68,68,0.1)',
              color: '#ef4444',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 800,
            }}
          >
            <Skull size={11} /> PHÁ SẢN
          </span>
        ) : isWinner ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              background: 'rgba(245,158,11,0.15)',
              color: '#d97706',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 800,
            }}
          >
            <Trophy size={11} /> VÔ ĐỊCH
          </span>
        ) : isCurrentTurn ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              background: `${seatColor}22`,
              color: seatColor,
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 800,
              animation: 'pulse 1.5s infinite',
            }}
          >
            <Clock size={11} /> {turnTimeRemaining}s
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
          padding: '6px 8px',
          borderRadius: 6,
          border: '1px solid rgba(15,23,42,0.05)',
        }}
      >
        <div>
          <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Tiền mặt</div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: isBankrupt ? '#94a3b8' : '#16a34a',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            ${cash}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Tài sản</div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: isBankrupt ? '#94a3b8' : '#0284c7',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            ${propertyValue}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Tổng tài sản</div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: isBankrupt ? '#94a3b8' : '#7c3aed',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            ${netWorth}
          </div>
        </div>
      </div>
    </div>
  );
}
