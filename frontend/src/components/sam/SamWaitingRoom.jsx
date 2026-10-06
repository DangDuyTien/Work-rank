import React from 'react';
import { Club, Plus, Check, Play, LogOut, HelpCircle, Users, Copy, Bot } from 'lucide-react';
import { Card, Button } from '../ui';
import DefaultAvatar from '../DefaultAvatar';
import JobTitleBadge from '../JobTitleBadge';

export default function SamWaitingRoom({
  room,
  players = [],
  user,
  isAdmin = false,
  startCountdownSec = null,
  actionLoading = false,
  onLeaveRoom,
  onToggleReady,
  onStartMatch,
  onFillBots,
  onOpenRules,
}) {
  const isHost = Number(room?.hostUserId) === Number(user?.id);
  const myPlayer = players.find((pl) => Number(pl.userId) === Number(user?.id));
  const isMeReady = Boolean(myPlayer?.isReady);
  const isStarting = room?.status === 'STARTING';

  return (
    <div
      style={{
        minHeight: '100%',
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <Card
        style={{
          maxWidth: 680,
          width: '100%',
          padding: '24px 20px',
          background: '#ffffff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          borderRadius: 'var(--radius-content, 8px)',
        }}
      >
        {/* Header Section */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            paddingBottom: 14,
            marginBottom: 18,
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span
                style={{
                  display: 'inline-flex',
                  padding: 4,
                  borderRadius: 5,
                  background: '#b45309',
                  color: '#fff',
                }}
              >
                <Club size={16} />
              </span>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: 0 }}>
                {room.title}
              </h1>
              {room.isTest && (
                <span
                  style={{
                    fontSize: 11,
                    background: '#fef3c7',
                    color: '#b45309',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                  }}
                >
                  Test Bot
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Phòng chờ trận đấu (Tối đa {room.maxPlayers} người)
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                display: 'inline-block',
                background: 'rgba(0,0,0,0.04)',
                padding: '4px 8px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'monospace',
                color: '#334155',
                border: '1px solid rgba(0,0,0,0.08)',
              }}
            >
              Mã: {room.code}
            </span>
          </div>
        </div>

        {/* 5-Second Start Countdown Display */}
        {isStarting && (
          <div
            style={{
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 18,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#b45309',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Tất cả người chơi đã sẵn sàng
            </div>
            <div style={{ fontSize: 12, color: '#78350f', marginTop: 2, marginBottom: 4, fontWeight: 600 }}>
              Trận đấu bắt đầu sau
            </div>
            <div
              key={startCountdownSec}
              style={{
                fontSize: startCountdownSec === 0 ? 24 : 40,
                fontWeight: 900,
                color: '#b45309',
                lineHeight: 1,
                fontFamily: 'monospace, system-ui',
              }}
            >
              {startCountdownSec === 0 ? 'BẮT ĐẦU!' : startCountdownSec ?? '5'}
            </div>
          </div>
        )}

        {/* Player Seats Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 12,
            marginBottom: 20,
          }}
        >
          {Array.from({ length: room.maxPlayers || 4 }).map((_, seatIdx) => {
            const p = players.find((pl) => pl.seatIndex === seatIdx);
            if (p) {
              const name = p.isBot ? (p.botName || 'Bot AI') : (p.user?.name || 'Người chơi');
              const isSelf = !p.isBot && Number(p.userId) === Number(user?.id);

              return (
                <div
                  key={p.userId || p.botId || seatIdx}
                  style={{
                    border: p.isReady
                      ? '1px solid rgba(22, 163, 74, 0.4)'
                      : '1px solid rgba(0,0,0,0.1)',
                    borderRadius: 8,
                    padding: '14px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    background: p.isReady ? 'rgba(240, 253, 244, 0.7)' : '#fafafa',
                    position: 'relative',
                  }}
                >
                  {p.isHost && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        fontSize: 9,
                        fontWeight: 700,
                        background: 'rgba(180,83,9,0.1)',
                        color: '#b45309',
                        padding: '1px 4px',
                        borderRadius: 3,
                      }}
                    >
                      Chủ phòng
                    </span>
                  )}
                  {p.isBot && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 6,
                        left: 6,
                        fontSize: 9,
                        fontWeight: 700,
                        background: 'rgba(217,119,6,0.12)',
                        color: '#b45309',
                        padding: '1px 4px',
                        borderRadius: 3,
                      }}
                    >
                      BOT
                    </span>
                  )}

                  <DefaultAvatar name={name} size={42} style={{ marginBottom: 6 }} />
                  <strong
                    style={{
                      fontSize: 12,
                      color: '#111827',
                      marginBottom: 2,
                      maxWidth: 110,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {name} {isSelf && '(Bạn)'}
                  </strong>
                  {!p.isBot && <JobTitleBadge jobTitle={p.user?.jobTitle} size="xs" />}

                  {/* Ready Status Badge */}
                  {p.isReady ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        background: 'rgba(22, 163, 74, 0.12)',
                        color: '#16a34a',
                        border: '1px solid rgba(22, 163, 74, 0.25)',
                        padding: '2px 7px',
                        borderRadius: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        marginTop: 6,
                      }}
                    >
                      <Check size={11} strokeWidth={3} /> Sẵn sàng
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        background: 'rgba(100, 116, 139, 0.1)',
                        color: '#64748b',
                        padding: '2px 7px',
                        borderRadius: 4,
                        marginTop: 6,
                      }}
                    >
                      Chưa sẵn sàng
                    </span>
                  )}
                </div>
              );
            }

            return (
              <div
                key={seatIdx}
                style={{
                  border: '1px dashed rgba(0,0,0,0.15)',
                  borderRadius: 8,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 110,
                  color: '#94a3b8',
                  fontSize: 12,
                  background: '#fafafa',
                }}
              >
                <Plus size={18} style={{ marginBottom: 4, opacity: 0.5 }} />
                Ghế trống #{seatIdx + 1}
              </div>
            );
          })}
        </div>

        {/* Action Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
            borderTop: '1px solid rgba(0,0,0,0.08)',
            paddingTop: 14,
          }}
        >
          <Button variant="secondary" onClick={onLeaveRoom}>
            <LogOut size={14} /> Rời phòng
          </Button>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={onOpenRules}>
              <HelpCircle size={14} /> Luật chơi
            </Button>

            {isAdmin && room.isTest && players.length < room.maxPlayers && (
              <Button variant="secondary" onClick={onFillBots}>
                <Bot size={14} /> Lấp đầy Bot
              </Button>
            )}

            {/* Local Player Ready Button */}
            {myPlayer && (
              <Button
                variant={isMeReady ? 'secondary' : 'primary'}
                disabled={actionLoading}
                onClick={() => onToggleReady(!isMeReady)}
                style={
                  isMeReady
                    ? { color: '#dc2626', borderColor: '#fca5a5', fontWeight: 700 }
                    : { background: '#15803d', borderColor: '#166534', color: '#fff', fontWeight: 700 }
                }
              >
                {isMeReady ? 'Hủy sẵn sàng' : 'Sẵn sàng'}
              </Button>
            )}

            {/* Host Start Match Button */}
            {isHost && (
              <Button
                variant="primary"
                disabled={players.length < 2 || actionLoading || isStarting}
                onClick={onStartMatch}
                style={{ background: '#b45309', borderColor: '#b45309', fontWeight: 800 }}
              >
                {isStarting
                  ? 'Đang đếm ngược…'
                  : players.length < 2
                  ? 'Cần ít nhất 2 người'
                  : actionLoading
                  ? 'Đang chia bài…'
                  : 'Bắt đầu ngay'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
