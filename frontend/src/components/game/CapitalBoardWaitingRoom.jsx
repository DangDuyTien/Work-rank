import React, { useState } from 'react';
import { Users, Crown, Play, LogOut, Copy, Check, Share2, Clock, Sparkles } from 'lucide-react';

const SEAT_COLORS = ['#38bdf8', '#ef4444', '#10b981', '#f59e0b'];

export default function CapitalBoardWaitingRoom({
  room,
  players = [],
  currentUser,
  onStartGame,
  onLeaveRoom,
  onAddBot,
  onRemoveBot,
  actionLoading = false,
  botLoading = false,
}) {
  const [copied, setCopied] = useState(false);

  if (!room) return null;

  const isHost = Number(room.hostUserId || room.host?.id) === Number(currentUser?.id);
  const maxPlayers = Number(room.maxPlayers) || 4;
  const canStart = players.length >= 2;
  const isFull = players.length >= maxPlayers;

  const handleCopyLink = () => {
    const url = `${window.location.origin}/games/capital-board/room/${room.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      style={{
        maxWidth: 680,
        margin: '0 auto',
        background: 'var(--surface)',
        borderRadius: 12,
        border: '1px solid rgba(15,23,42,0.1)',
        padding: 24,
        boxShadow: '0 4px 16px rgba(15,23,42,0.06)',
      }}
    >
      {/* Header Info */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            background: 'var(--info-soft)',
            color: 'var(--info)',
            padding: '3px 10px',
            borderRadius: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          PHÒNG CHỜ TRẬN ĐẤU
        </span>

        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0 4px', lineHeight: 1.25 }}>
          {room.title || room.name || `Phòng Cờ Tỷ Phú #${room.code}`}
        </h2>

        <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
          <span>
            Mã phòng: <strong style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>#{room.code}</strong>
          </span>
          <span>•</span>
          <span>
            Chủ phòng: <strong style={{ color: 'var(--text-primary)' }}>{room.host?.name || 'Host'}</strong>
          </span>
        </div>

        {/* Share Deep-Link & Bot Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleCopyLink}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(15,23,42,0.04)',
              color: copied ? '#16a34a' : 'var(--text-primary)',
              border: copied ? '1px solid #16a34a' : '1px solid rgba(15,23,42,0.12)',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard)',
            }}
          >
            {copied ? <Check size={14} /> : <Share2 size={14} />}
            <span>{copied ? 'Đã sao chép link mời!' : 'Sao chép link mời'}</span>
          </button>

          {isHost && !isFull && onAddBot && (
            <button
              type="button"
              onClick={onAddBot}
              disabled={botLoading || actionLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--info-soft)',
                color: 'var(--info)',
                border: '1px solid var(--info-border, rgba(56,189,248,0.3))',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: botLoading || actionLoading ? 'not-allowed' : 'pointer',
                opacity: botLoading || actionLoading ? 0.7 : 1,
                transition: 'background var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), opacity var(--motion-fast) var(--ease-standard)',
              }}
            >
              <Sparkles size={14} />
              <span>{botLoading ? 'Đang thêm...' : '+ Thêm Bot AI'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Player Slots (up to maxPlayers) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {Array.from({ length: maxPlayers }).map((_, idx) => {
          const p = players.find((pl) => pl.seatIndex === idx);
          const sColor = SEAT_COLORS[idx] || '#38bdf8';
          const isPlayerHost = p && Number(p.userId) === Number(room.hostUserId || room.host?.id);
          const isCurrentPlayer = p && Number(p.userId) === Number(currentUser?.id);
          const isBot = p && Boolean(p.user?.isBot || p.user?.isSimulated);

          return (
            <div
              key={idx}
              style={{
                border: p ? `2px solid ${sColor}` : '2px dashed rgba(15,23,42,0.15)',
                borderRadius: 8,
                padding: 14,
                background: p ? 'var(--surface)' : 'rgba(15,23,42,0.02)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow: p ? `0 2px 8px ${sColor}22` : 'none',
                transition: 'border-color var(--motion-fast) var(--ease-standard), box-shadow var(--motion-fast) var(--ease-standard)',
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: p ? sColor : 'rgba(15,23,42,0.08)',
                  color: 'var(--surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 800,
                  boxShadow: p ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
                  flexShrink: 0,
                }}
              >
                {p ? (isBot ? '🤖' : (p.user?.name || `P${idx + 1}`).charAt(0).toUpperCase()) : idx + 1}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: sColor, textTransform: 'uppercase' }}>
                    Vị trí {idx + 1}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isBot && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                          fontSize: 9,
                          color: 'var(--info)',
                          fontWeight: 800,
                          background: 'var(--info-soft)',
                          padding: '1px 5px',
                          borderRadius: 3,
                        }}
                      >
                        BOT
                      </span>
                    )}
                    {isPlayerHost && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          fontSize: 10,
                          color: '#f59e0b',
                          fontWeight: 800,
                          background: 'rgba(245,158,11,0.12)',
                          padding: '1px 5px',
                          borderRadius: 3,
                        }}
                      >
                        <Crown size={11} />
                        <span>HOST</span>
                      </span>
                    )}
                    {isBot && isHost && onRemoveBot && (
                      <button
                        type="button"
                        onClick={() => onRemoveBot(p.userId)}
                        disabled={actionLoading || botLoading}
                        title="Xóa Bot này"
                        style={{
                          background: 'rgba(239,68,68,0.1)',
                          color: '#ef4444',
                          border: 'none',
                          borderRadius: 3,
                          padding: '2px 5px',
                          fontSize: 10,
                          fontWeight: 800,
                          cursor: 'pointer',
                          lineHeight: 1,
                          transition: 'background var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard)',
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: p ? 'var(--text-primary)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: 2,
                  }}
                >
                  {p ? p.user?.name || `Người chơi ${idx + 1}` : (
                    isHost && onAddBot ? (
                      <button
                        type="button"
                        onClick={onAddBot}
                        disabled={botLoading || actionLoading}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--info)',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Sparkles size={12} />
                        <span>+ Thêm Bot vào đây</span>
                      </button>
                    ) : (
                      'Đang chờ người chơi...'
                    )
                  )}
                </div>

                {isCurrentPlayer && (
                  <span style={{ fontSize: 10, color: 'var(--info)', fontWeight: 800 }}>
                    (Bạn)
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={onLeaveRoom}
          disabled={actionLoading || botLoading}
          style={{
            flex: 1,
            background: 'var(--surface)',
            color: '#ef4444',
            border: '1.5px solid rgba(239,68,68,0.3)',
            borderRadius: 6,
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'background var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard)',
          }}
        >
          <LogOut size={16} />
          <span>Rời Phòng</span>
        </button>

        {isHost ? (
          <button
            type="button"
            onClick={onStartGame}
            disabled={actionLoading || botLoading || !canStart}
            style={{
              flex: 2,
              background: canStart ? '#16a34a' : 'var(--text-muted)',
              color: 'var(--surface)',
              border: 'none',
              borderRadius: 6,
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 800,
              cursor: canStart ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: canStart ? '0 4px 14px rgba(22,163,74,0.3)' : 'none',
              transition: 'background var(--motion-fast) var(--ease-standard), box-shadow var(--motion-fast) var(--ease-standard)',
            }}
          >
            <Play size={16} />
            <span>{canStart ? 'Bắt Đầu Trận Đấu' : 'Cần Tối Thiểu 2 Người'}</span>
          </button>
        ) : (
          <div
            style={{
              flex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: 'rgba(15,23,42,0.03)',
              border: '1px solid rgba(15,23,42,0.08)',
              borderRadius: 6,
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 700,
              padding: '12px 16px',
            }}
          >
            <Clock size={15} />
            <span>Đang chờ chủ phòng bắt đầu trận đấu...</span>
          </div>
        )}
      </div>
    </div>
  );
}
