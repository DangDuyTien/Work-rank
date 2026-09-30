import React, { useState } from 'react';
import { Play, Copy, Check, LogOut, Crown, Users, Sparkles, Image, Music, Clock, ShieldCheck } from 'lucide-react';
import QuizAvatar from './QuizAvatar';

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
    IMAGE: { label: 'ĐOÁN HÌNH ẢNH', icon: Image, color: '#34d399' },
    MUSIC: { label: 'ĐOÁN BÀI HÁT', icon: Music, color: '#c084fc' },
  };

  const currentMode = modeLabels[room.mode] || modeLabels.ALL;
  const ModeIcon = currentMode.icon;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 920,
        margin: '0 auto',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 16,
        padding: '28px 32px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        color: '#ffffff',
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
          paddingBottom: 22,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 20,
                background: `${currentMode.color}20`,
                border: `1px solid ${currentMode.color}50`,
                color: currentMode.color,
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: '0.4px',
              }}
            >
              <ModeIcon size={12} />
              <span>{currentMode.label}</span>
            </span>

            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>
              • {room.totalQuestions || 10} câu hỏi
            </span>
          </div>

          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.3px' }}>
            {room.title || 'Phòng Quiz Thử Thách'}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 13, color: '#94a3b8' }}>
            <span>Chủ phòng:</span>
            <strong style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Crown size={13} /> {room.host?.name || 'Host'}
            </strong>
          </div>
        </div>

        {/* Room Code Badge & Leave Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={handleCopyCode}
            title="Nhấn để sao chép mã phòng"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 14px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px dashed rgba(56, 189, 248, 0.6)',
              borderRadius: 8,
              cursor: 'pointer',
              color: '#ffffff',
              transition: 'background 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>
                MÃ PHÒNG (CODE)
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 900, color: '#38bdf8' }}>
                #{room.code}
              </span>
            </div>
            {copied ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#34d399', fontSize: 12, fontWeight: 800 }}>
                <Check size={16} /> Đã chép
              </span>
            ) : (
              <Copy size={16} color="#94a3b8" />
            )}
          </button>

          <button
            type="button"
            onClick={onLeaveRoom}
            disabled={actionLoading}
            title="Rời khỏi phòng"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 14px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 800,
              cursor: actionLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
            <Users size={18} color="#38bdf8" />
            <span>DANH SÁCH NGƯỜI CHƠI ({players.length} / {room.maxPlayers || 20})</span>
          </div>

          <span style={{ fontSize: 12, color: '#34d399', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399' }} />
            Đồng bộ thời gian thực
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: 12,
            maxHeight: 340,
            overflowY: 'auto',
            paddingRight: 4,
          }}
        >
          {players.map((p) => {
            const isPlayerHost = Number(p.userId) === Number(room.hostUserId);
            const isMe = Number(p.userId) === Number(currentUser?.id);

            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: isMe ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                  border: isMe ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: isMe ? '0 0 16px rgba(56, 189, 248, 0.15)' : 'none',
                }}
              >
                <div style={{ position: 'relative' }}>
                  <QuizAvatar
                    user={p.user || { id: p.userId }}
                    userId={p.userId}
                    size="md"
                    border={isPlayerHost ? '2px solid #f59e0b' : isMe ? '2px solid #38bdf8' : '2px solid rgba(255,255,255,0.2)'}
                  />
                  {isPlayerHost && (
                    <div
                      title="Chủ phòng"
                      style={{
                        position: 'absolute',
                        top: -5,
                        right: -5,
                        background: '#f59e0b',
                        borderRadius: '50%',
                        padding: 3,
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #000000',
                        zIndex: 2,
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
                      color: isMe ? '#38bdf8' : '#ffffff',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {p.user?.name || `Người chơi ${p.userId}`}
                  </div>
                  <div style={{ fontSize: 11, color: isPlayerHost ? '#f59e0b' : isMe ? '#38bdf8' : '#94a3b8', fontWeight: 700, marginTop: 1 }}>
                    {isPlayerHost ? '👑 Chủ phòng' : isMe ? '✨ Bạn' : '✓ Sẵn sàng'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Host Controls / Participant Waiting Card */}
      <div
        style={{
          marginTop: 26,
          padding: '18px 22px',
          borderRadius: 12,
          background: isHost ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.04)',
          border: isHost ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
            {isHost ? (
              <>
                <Crown size={16} color="#f59e0b" />
                <span>Bạn Là Chủ Phòng (Host)</span>
              </>
            ) : (
              <>
                <Clock size={16} color="#38bdf8" />
                <span>Đang Chờ Chủ Phòng Bắt Đầu...</span>
              </>
            )}
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 3 }}>
            {isHost
              ? 'Nhấn nút để phát câu hỏi đầu tiên cho tất cả người chơi trong phòng.'
              : 'Trận đấu sẽ tự động bắt đầu ngay khi chủ phòng bấm nút.'}
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
              padding: '12px 28px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 900,
              cursor: actionLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(2, 132, 199, 0.4)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            <Play size={16} fill="currentColor" />
            <span>{actionLoading ? 'Đang Bắt Đầu...' : 'BẮT ĐẦU TRẬN ĐẤU'}</span>
          </button>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 8,
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              fontSize: 13,
              color: '#38bdf8',
              fontWeight: 800,
            }}
          >
            <Clock size={15} />
            <span>Chờ hiệu lệnh...</span>
          </div>
        )}
      </div>
    </div>
  );
}
