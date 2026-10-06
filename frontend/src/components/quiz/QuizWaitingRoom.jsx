import React, { useState } from 'react';
import { Play, Copy, Check, LogOut, Crown, Users, Sparkles, Image, Music, Clock } from 'lucide-react';
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
    ALL: { label: 'Đoán Hình & Nhạc', icon: Sparkles, color: 'var(--accent)', bg: 'rgba(180,83,9,0.08)', border: 'rgba(180,83,9,0.2)' },
    IMAGE: { label: 'Đoán Hình Ảnh', icon: Image, color: 'var(--info)', bg: 'var(--info-soft)', border: 'var(--info-border)' },
    MUSIC: { label: 'Đoán Bài Hát', icon: Music, color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)' },
  };

  const currentMode = modeLabels[room.mode] || modeLabels.ALL;
  const ModeIcon = currentMode.icon;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 880,
        margin: '0 auto',
        background: 'var(--surface)',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        borderRadius: 8,
        padding: '24px 28px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        color: 'var(--primary)',
      }}
    >
      {/* ── TOP ROOM BANNER ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          paddingBottom: 20,
          borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 9999,
                background: currentMode.bg,
                border: `1px solid ${currentMode.border}`,
                color: currentMode.color,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.2px',
              }}
            >
              <ModeIcon size={12} />
              <span>{currentMode.label}</span>
            </span>

            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
              • {room.totalQuestions || 10} câu hỏi
            </span>
          </div>

          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.3px', lineHeight: 1.3 }}>
            {room.title || 'Phòng Quiz Thử Thách'}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
            <span>Chủ phòng:</span>
            <strong style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
              <Crown size={12} /> {room.host?.name || 'Host'}
            </strong>
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
              background: '#f8f7f4',
              border: '1px dashed rgba(180, 83, 9, 0.4)',
              borderRadius: 6,
              cursor: 'pointer',
              color: 'var(--primary)',
              transition: 'background var(--motion-fast) var(--ease-standard)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                MÃ PHÒNG
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                #{room.code}
              </span>
            </div>
            {copied ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--success)', fontSize: 11, fontWeight: 600 }}>
                <Check size={14} /> Đã chép
              </span>
            ) : (
              <Copy size={14} color="var(--text-secondary)" />
            )}
          </button>

          <button
            type="button"
            onClick={onLeaveRoom}
            disabled={actionLoading}
            title="Rời khỏi phòng"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '8px 12px',
              background: 'var(--surface)',
              border: '1px solid rgba(220, 38, 38, 0.25)',
              color: '#dc2626',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: actionLoading ? 'not-allowed' : 'pointer',
              transition: 'background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard), transform var(--motion-fast) var(--ease-standard)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
          >
            <LogOut size={13} />
            <span>Rời phòng</span>
          </button>
        </div>
      </div>

      {/* ── PLAYERS LOBBY GRID ── */}
      <div style={{ marginTop: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
            <Users size={15} color="var(--accent)" />
            <span>Danh Sách Người Chơi ({players.length} / {room.maxPlayers || 20})</span>
          </div>

          <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
            Đồng bộ thời gian thực
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 10,
            maxHeight: 340,
            overflowY: 'auto',
            paddingRight: 2,
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
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: isMe ? '#fffbeb' : '#f8f7f4',
                  border: isMe ? '1px solid rgba(180, 83, 9, 0.3)' : '1px solid rgba(0, 0, 0, 0.06)',
                }}
              >
                <div style={{ position: 'relative' }}>
                  <QuizAvatar
                    user={p.user || { id: p.userId }}
                    userId={p.userId}
                    size="sm"
                    border={isPlayerHost ? '2px solid var(--accent)' : isMe ? '2px solid var(--accent)' : '1px solid rgba(0,0,0,0.1)'}
                  />
                  {isPlayerHost && (
                    <div
                      title="Chủ phòng"
                      style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        background: 'var(--accent)',
                        borderRadius: '50%',
                        padding: 2,
                        color: 'var(--surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2,
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
                      fontWeight: 600,
                      color: 'var(--primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {p.user?.name || `Người chơi ${p.userId}`}
                  </div>
                  <div style={{ fontSize: 11, color: isPlayerHost ? 'var(--accent)' : isMe ? 'var(--accent)' : 'var(--success)', fontWeight: 500, marginTop: 1, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {isPlayerHost ? (
                      <>
                        <Crown size={12} color="#d97706" /> Chủ phòng
                      </>
                    ) : isMe ? (
                      <>
                        <Sparkles size={12} color="#d97706" /> Bạn
                      </>
                    ) : (
                      <>
                        <Check size={12} color="var(--success)" /> Sẵn sàng
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── HOST CONTROLS / PARTICIPANT WAITING FOOTER ── */}
      <div
        style={{
          marginTop: 22,
          padding: '16px 20px',
          borderRadius: 6,
          background: isHost ? '#fffbeb' : '#f8f7f4',
          border: isHost ? '1px solid rgba(180, 83, 9, 0.25)' : '1px solid rgba(0, 0, 0, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {isHost ? (
              <>
                <Crown size={15} color="var(--accent)" />
                <span>Bạn Là Chủ Phòng (Host)</span>
              </>
            ) : (
              <>
                <Clock size={15} color="var(--accent)" />
                <span>Đang Chờ Chủ Phòng Bắt Đầu...</span>
              </>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, fontWeight: 400 }}>
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
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 22px',
              background: 'var(--primary)',
              color: 'var(--surface)',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: actionLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
              transition: 'background var(--motion-fast) var(--ease-standard)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#262626'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--primary)'; }}
          >
            <Play size={14} fill="currentColor" />
            <span>{actionLoading ? 'Đang bắt đầu...' : 'BẮT ĐẦU TRẬN ĐẤU'}</span>
          </button>
        ) : (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 6,
              background: '#fffbeb',
              border: '1px solid rgba(180, 83, 9, 0.25)',
              fontSize: 12,
              color: 'var(--accent)',
              fontWeight: 600,
            }}
          >
            <Clock size={14} />
            <span>Chờ hiệu lệnh...</span>
          </div>
        )}
      </div>
    </div>
  );
}
