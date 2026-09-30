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
    ALL: { label: 'ĐOÁN HÌNH & NHẠC', icon: Sparkles, color: '#0284c7' },
    IMAGE: { label: 'ĐOÁN HÌNH ẢNH', icon: Image, color: '#16a34a' },
    MUSIC: { label: 'ĐOÁN BÀI HÁT', icon: Music, color: '#9333ea' },
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
        borderRadius: 14,
        padding: '24px 28px',
        boxShadow: '0 4px 20px rgba(15,23,42,0.04)',
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
                background: `${currentMode.color}15`,
                color: currentMode.color,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.3px',
              }}
            >
              <ModeIcon size={12} />
              <span>{currentMode.label}</span>
            </span>

            <span style={{ fontSize: 12, color: '#64748b' }}>
              • {room.totalQuestions || 10} câu hỏi
            </span>
          </div>

          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
            {room.title || 'Phòng Quiz Thử Thách'}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              Chủ phòng: <strong style={{ color: '#0f172a' }}>{room.host?.name || 'Host'}</strong>
            </span>
          </div>
        </div>

        {/* Room Code Badge & Leave Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={handleCopyCode}
            title="Nhấn để sao chép mã phòng"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              background: '#f8fafc',
              border: '1px dashed rgba(15,23,42,0.25)',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Mã phòng
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
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
              padding: '8px 12px',
              background: '#ffffff',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: actionLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <LogOut size={14} />
            <span>Rời phòng</span>
          </button>
        </div>
      </div>

      {/* Players Lobby Grid */}
      <div style={{ marginTop: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
            <Users size={16} color="#0284c7" />
            <span>Danh Sách Người Chơi ({players.length} / {room.maxPlayers || 20})</span>
          </div>

          <span style={{ fontSize: 12, color: '#64748b' }}>
            Thời gian thực
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
            gap: 10,
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
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: isMe ? 'rgba(2,132,199,0.06)' : '#f8fafc',
                  border: isMe ? '1.5px solid #0284c7' : '1px solid rgba(15,23,42,0.08)',
                }}
              >
                <div style={{ position: 'relative' }}>
                  <img
                    src={avatarUrl}
                    alt={p.user?.name}
                    style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                  />
                  {isPlayerHost && (
                    <div
                      title="Chủ phòng"
                      style={{
                        position: 'absolute',
                        top: -4,
                        right: -3,
                        background: '#f59e0b',
                        borderRadius: '50%',
                        padding: 2,
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Crown size={9} strokeWidth={3} />
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
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {isPlayerHost ? 'Chủ phòng' : isMe ? 'Bạn' : 'Sẵn sàng'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Host Controls / Participant Waiting */}
      <div
        style={{
          marginTop: 24,
          padding: '16px 20px',
          borderRadius: 10,
          background: isHost ? 'rgba(2,132,199,0.05)' : 'rgba(15,23,42,0.02)',
          border: isHost ? '1px solid rgba(2,132,199,0.2)' : '1px solid rgba(15,23,42,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
            {isHost ? 'Bạn là Chủ Phòng' : 'Đang chờ trận đấu bắt đầu...'}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {isHost
              ? 'Nhấn nút khi mọi người đã sẵn sàng để bắt đầu câu hỏi đầu tiên.'
              : 'Chủ phòng sẽ bắt đầu trận đấu khi danh sách người chơi ổn định.'}
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
              gap: 6,
              padding: '10px 20px',
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 800,
              cursor: actionLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(15,23,42,0.15)',
            }}
          >
            <Play size={15} />
            <span>Bắt Đầu Trận Đấu</span>
          </button>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: '#0284c7',
              fontWeight: 700,
            }}
          >
            <Clock size={15} />
            <span>Chờ hiệu lệnh từ host...</span>
          </div>
        )}
      </div>
    </div>
  );
}
