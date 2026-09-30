import React, { useState } from 'react';
import { Play, Copy, Check, LogOut, Crown, Users, Sparkles, Image, Music, Clock } from 'lucide-react';
import { getUserAvatar } from '../../utils/avatar';

export default function QuizWaitingRoom({
  room,
  players = [],
  currentUser,
  isHost = false,
  onStartGame,
  onLeaveRoom,
  actionLoading = false,
}) {
  const [copied, setCopied] = useState(false);

  if (!room) return null;

  const handleCopyCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const modeLabels = {
    ALL: { label: 'ĐOÁN HÌNH & NHẠC', icon: Sparkles, color: '#38bdf8' },
    IMAGE: { label: 'ĐOÁN HÌNH ẢNH', icon: Image, color: '#10b981' },
    MUSIC: { label: 'ĐOÁN BÀI HÁT', icon: Music, color: '#a855f7' },
  };

  const currentMode = modeLabels[room.mode] || modeLabels.ALL;
  const ModeIcon = currentMode.icon;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 860,
        margin: '0 auto',
        background: '#ffffff',
        border: '1px solid rgba(15,23,42,0.1)',
        borderRadius: 16,
        padding: '24px 28px',
        boxShadow: '0 8px 30px rgba(15,23,42,0.06)',
      }}
    >
      {/* Top Room Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          paddingBottom: 20,
          borderBottom: '1px solid rgba(15,23,42,0.08)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 6,
                background: `${currentMode.color}22`,
                color: currentMode.color,
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: '0.5px',
              }}
            >
              <ModeIcon size={12} />
              <span>{currentMode.label}</span>
            </span>

            <span style={{ fontSize: 12, color: '#64748b' }}>
              • {room.totalQuestions || 10} câu hỏi
            </span>
          </div>

          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#0f172a' }}>
            {room.title || 'Phòng Quiz Thử Thách'}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              Chủ phòng: <strong style={{ color: '#0f172a' }}>{room.host?.name || 'Host'}</strong>
            </span>
          </div>
        </div>

        {/* Room Code Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={handleCopyCode}
            title="Nhấn để sao chép mã phòng"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              background: '#f8fafc',
              border: '1.5px dashed rgba(15,23,42,0.2)',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Mã phòng
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                #{room.code}
              </span>
            </div>
            {copied ? <Check size={16} color="#16a34a" /> : <Copy size={16} color="#64748b" />}
          </button>

          <button
            type="button"
            onClick={onLeaveRoom}
            disabled={actionLoading}
            title="Rời khỏi phòng"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '10px 14px',
              background: '#ffffff',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: actionLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <LogOut size={15} />
            <span>Rời phòng</span>
          </button>
        </div>
      </div>

      {/* Players Lobby Grid */}
      <div style={{ marginTop: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
            <Users size={16} color="#0284c7" />
            <span>Danh Sách Người Chơi ({players.length} / {room.maxPlayers || 20})</span>
          </div>

          <span style={{ fontSize: 12, color: '#64748b' }}>
            Càng nhiều người chơi càng kịch tính!
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
            gap: 12,
          }}
        >
          {players.map((p) => {
            const isPlayerHost = Number(p.userId) === Number(room.hostUserId);
            const isMe = Number(p.userId) === Number(currentUser?.id);
            const avatarUrl = p.user?.avatarUrl || getUserAvatar(p.userId);

            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: isMe ? 'rgba(56,189,248,0.08)' : '#f8fafc',
                  border: isMe ? '1.5px solid #38bdf8' : '1px solid rgba(15,23,42,0.08)',
                }}
              >
                <div style={{ position: 'relative' }}>
                  <img
                    src={avatarUrl}
                    alt={p.user?.name}
                    style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                  />
                  {isPlayerHost && (
                    <div
                      title="Chủ phòng"
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -4,
                        background: '#f59e0b',
                        borderRadius: '50%',
                        padding: 2,
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Crown size={10} strokeWidth={3} />
                    </div>
                  )}
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: isMe ? '#0284c7' : '#0f172a',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {p.user?.name || `Người chơi ${p.userId}`}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                    {isPlayerHost ? 'Chủ phòng' : isMe ? 'Bạn' : 'Sẵn sàng'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Host Action Controls / Waiting Notice */}
      <div
        style={{
          marginTop: 32,
          padding: '20px 24px',
          borderRadius: 12,
          background: isHost ? 'rgba(56,189,248,0.08)' : 'rgba(15,23,42,0.03)',
          border: isHost ? '1.5px solid #38bdf8' : '1px solid rgba(15,23,42,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
            {isHost ? 'Bạn là Chủ Phòng' : 'Đang Chờ Trận Đấu Bắt Đầu...'}
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {isHost
              ? 'Nhấn nút bên cạnh khi mọi người đã vào đủ để bắt đầu trận đấu quiz!'
              : 'Chủ phòng sẽ bắt đầu trận đấu khi mọi người đã sẵn sàng.'}
          </div>
        </div>

        {isHost ? (
          <button
            type="button"
            onClick={onStartGame}
            disabled={actionLoading || players.length < 1}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 24px',
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 800,
              cursor: actionLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(15,23,42,0.25)',
              transition: 'transform 0.1s ease',
            }}
          >
            <Play size={16} />
            <span>Bắt Đầu Trận Đấu</span>
          </button>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: '#0284c7',
              fontWeight: 700,
            }}
          >
            <Clock size={16} style={{ animation: 'spin 3s linear infinite' }} />
            <span>Chờ hiệu lệnh từ host...</span>
          </div>
        )}
      </div>
    </div>
  );
}
