import React, { useState, useEffect } from 'react';
import {
  Plus,
  Users,
  Image,
  Music,
  Sparkles,
  Trophy,
  Medal,
  Crown,
  Dice5,
  ArrowRight,
  Gamepad2,
  X,
  RefreshCw,
  Folder,
  KeyRound,
  Copy,
  Check,
} from 'lucide-react';
import { quizGame } from '../../services/api';
import QuizAvatar from './QuizAvatar';
import { AnimatedModal, TabTransition } from '../ui';

export default function QuizLobby({
  rooms = [],
  activeRejoinRoom = null,
  myStats = null,
  leaderboard = [],
  loading = false,
  onCreateRoom,
  onJoinRoom,
  onRejoinRoom,
  onRefresh,
}) {
  const [modeFilter, setModeFilter] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('Phòng Đoán Hình & Đoán Nhạc');
  const [mode, setMode] = useState('IMAGE');
  const [selectedSetId, setSelectedSetId] = useState('');
  const [availableSets, setAvailableSets] = useState([]);
  const [maxPlayers, setMaxPlayers] = useState(20);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [activeTab, setActiveTab] = useState('ROOMS'); // 'ROOMS' or 'LEADERBOARD'
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [codeJoinError, setCodeJoinError] = useState(null);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);

  useEffect(() => {
    quizGame.listSets().then((res) => {
      setAvailableSets(res || []);
    }).catch(() => {});
  }, []);

  const filteredRooms = rooms.filter((r) => {
    if (modeFilter === 'ALL') return true;
    return r.mode === modeFilter;
  });

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || isSubmittingCreate) return;
    try {
      setIsSubmittingCreate(true);
      await onCreateRoom({
        title: title.trim(),
        mode,
        quizSetId: selectedSetId ? Number(selectedSetId) : null,
        maxPlayers: Number(maxPlayers),
        totalQuestions: Number(totalQuestions),
      });
      setShowCreateModal(false);
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleCodeJoinSubmit = async (e) => {
    e.preventDefault();
    const cleanCode = joinCodeInput.trim();
    if (!cleanCode || isSubmittingJoin) return;
    try {
      setIsSubmittingJoin(true);
      setCodeJoinError(null);
      await onJoinRoom(cleanCode);
    } catch (err) {
      setCodeJoinError(err?.message || 'Không thể vào phòng bằng mã này');
    } finally {
      setIsSubmittingJoin(false);
    }
  };

  const modeBadgeConfig = {
    ALL: { label: 'Đoán Hình & Nhạc', icon: Sparkles, color: 'var(--accent)', bg: 'rgba(180,83,9,0.08)', border: 'rgba(180,83,9,0.2)' },
    IMAGE: { label: 'Đoán Hình', icon: Image, color: 'var(--info)', bg: 'var(--info-soft)', border: 'var(--info-border)' },
    MUSIC: { label: 'Đoán Nhạc', icon: Music, color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)' },
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        width: '100%',
        maxWidth: 1080,
        margin: '0 auto',
        color: 'var(--primary)',
        boxSizing: 'border-box',
        padding: '8px 0 24px',
      }}
    >
      {/* ── TOP HEADER HERO CARD ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '20px 24px',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ minWidth: 260, flex: 1 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(180, 83, 9, 0.08)',
              border: '1px solid rgba(180, 83, 9, 0.2)',
              color: 'var(--accent)',
              padding: '3px 10px',
              borderRadius: 9999,
              fontSize: 11,
              fontWeight: 700,
              marginBottom: 8,
              letterSpacing: '0.3px',
              textTransform: 'uppercase',
            }}
          >
            <Sparkles size={12} />
            <span>Trắc Nghiệm Tốc Độ Realtime</span>
          </div>

          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.3px', lineHeight: 1.3 }}>
            Đoán Hình & Đoán Nhạc
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, fontWeight: 400 }}>
            Thử thách trực quan và giai điệu bài hát nhanh nhất để ghi điểm và thăng hạng trên bảng xếp hạng toàn công ty.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Quick Join By Room Code */}
          <form
            onSubmit={handleCodeJoinSubmit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <KeyRound size={13} style={{ position: 'absolute', left: 9, color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Mã phòng (vd: QZ...)"
                value={joinCodeInput}
                onChange={(e) => {
                  setJoinCodeInput(e.target.value.toUpperCase());
                  setCodeJoinError(null);
                }}
                style={{
                  padding: '8px 10px 8px 28px',
                  borderRadius: 6,
                  border: '1px solid rgba(0, 0, 0, 0.15)',
                  background: 'var(--surface)',
                  color: 'var(--primary)',
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, monospace',
                  width: 155,
                  outline: 'none',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={!joinCodeInput.trim() || isSubmittingJoin}
              style={{
                padding: '8px 12px',
                background: 'var(--surface)',
                border: '1px solid rgba(0,0,0,0.15)',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--primary)',
                cursor: !joinCodeInput.trim() || isSubmittingJoin ? 'not-allowed' : 'pointer',
                opacity: !joinCodeInput.trim() || isSubmittingJoin ? 0.6 : 1,
              }}
            >
              {isSubmittingJoin ? 'Đang vào...' : 'Vào phòng'}
            </button>
          </form>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              title="Làm mới danh sách phòng"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                background: 'var(--surface)',
                color: 'var(--primary)',
                border: '1px solid rgba(0, 0, 0, 0.12)',
                borderRadius: 6,
                cursor: loading ? 'wait' : 'pointer',
                transition: 'background var(--motion-fast) var(--ease-standard)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: 'var(--primary)',
              color: 'var(--surface)',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
              transition: 'background var(--motion-fast) var(--ease-standard)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#262626'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--primary)'; }}
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Tạo Phòng Chơi</span>
          </button>
        </div>
      </div>

      {codeJoinError && (
        <div style={{ padding: '8px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: 12, fontWeight: 600 }}>
          {codeJoinError}
        </div>
      )}

      {/* ── ACTIVE REJOIN BANNER ── */}
      {activeRejoinRoom && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 6,
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 6,
                background: 'var(--accent)',
                color: 'var(--surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Gamepad2 size={18} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-hover)' }}>
                Trận đấu đang diễn ra (#{activeRejoinRoom.code})
              </div>
              <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 400 }}>
                Phòng: <strong>{activeRejoinRoom.title}</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onRejoinRoom(activeRejoinRoom.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              background: 'var(--accent)',
              color: 'var(--surface)',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background var(--motion-fast) var(--ease-standard)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
          >
            <span>Vào lại</span>
            <ArrowRight size={13} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* ── CAREER STATS BAR ── */}
      {myStats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 10,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: 6,
              padding: '12px 16px',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Trận đã chơi</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
              {myStats.gamesPlayed || 0}
            </div>
          </div>
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: 6,
              padding: '12px 16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              <span>Chiến thắng</span>
              <Trophy size={12} color="var(--accent)" />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
              {myStats.gamesWon || 0}
            </div>
          </div>
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: 6,
              padding: '12px 16px',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Tổng điểm tích lũy</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
              {Number(myStats.totalScore || 0).toLocaleString()}
            </div>
          </div>
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: 6,
              padding: '12px 16px',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Tỉ lệ đúng</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
              {myStats.accuracy || 0}%
            </div>
          </div>
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: 6,
              padding: '12px 16px',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Điểm kỷ lục</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#7c3aed', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
              {Number(myStats.highestScore || 0).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* ── TABS & FILTER BAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
        {/* Main Section Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', padding: 3, borderRadius: 6, border: '1px solid rgba(0,0,0,0.08)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('ROOMS')}
            style={{
              padding: '6px 14px',
              border: 'none',
              borderRadius: 5,
              fontSize: 12,
              fontWeight: 600,
              background: activeTab === 'ROOMS' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'ROOMS' ? 'var(--surface)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard), transform var(--motion-fast) var(--ease-standard)',
            }}
          >
            Sảnh Phòng Đấu ({rooms.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('LEADERBOARD')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 14px',
              border: 'none',
              borderRadius: 5,
              fontSize: 12,
              fontWeight: 600,
              background: activeTab === 'LEADERBOARD' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'LEADERBOARD' ? 'var(--surface)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard), transform var(--motion-fast) var(--ease-standard)',
            }}
          >
            <span>Bảng Xếp Hạng</span>
            <Trophy size={13} color={activeTab === 'LEADERBOARD' ? '#f59e0b' : 'var(--accent)'} />
          </button>
        </div>

        {/* Mode Filter Buttons (Only visible in ROOMS tab) */}
        {activeTab === 'ROOMS' && (
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { id: 'ALL', label: 'Tất cả', icon: Dice5 },
              { id: 'IMAGE', label: 'Đoán Hình', icon: Image },
              { id: 'MUSIC', label: 'Đoán Nhạc', icon: Music },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setModeFilter(f.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid',
                  borderColor: modeFilter === f.id ? 'var(--accent)' : 'rgba(0,0,0,0.1)',
                  background: modeFilter === f.id ? 'rgba(180,83,9,0.08)' : 'var(--surface)',
                  color: modeFilter === f.id ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard), transform var(--motion-fast) var(--ease-standard)',
                }}
              >
                <f.icon size={13} />
                <span>{f.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── TAB CONTENT ── */}
      {activeTab === 'ROOMS' ? (
        <div>
          {filteredRooms.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 24px',
                background: 'var(--surface)',
                borderRadius: 8,
                border: '1px dashed rgba(0,0,0,0.15)',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'var(--background)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <Gamepad2 size={22} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)' }}>
                Chưa có phòng chơi nào đang chờ
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 16px', fontWeight: 400 }}>
                Tạo phòng mới và mời các thành viên cùng tham gia thi đấu ngay bây giờ.
              </p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                style={{
                  padding: '8px 18px',
                  background: 'var(--primary)',
                  color: 'var(--surface)',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                + Tạo Phòng Ngay
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {filteredRooms.map((room) => {
                const conf = modeBadgeConfig[room.mode] || modeBadgeConfig.ALL;
                const ModeIcon = conf.icon;

                return (
                  <div
                    key={room.id}
                    style={{
                      background: 'var(--surface)',
                      borderRadius: 8,
                      border: '1px solid rgba(0, 0, 0, 0.08)',
                      padding: '16px 18px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'border-color var(--motion-fast) var(--ease-standard), box-shadow var(--motion-fast) var(--ease-standard)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(0,0,0,0.18)';
                      e.currentTarget.style.boxShadow = '0 3px 8px rgba(0,0,0,0.06)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
                    }}
                  >
                    <div>
                      {/* Badge & Code */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '2px 8px',
                            borderRadius: 9999,
                            background: conf.bg,
                            border: `1px solid ${conf.border}`,
                            color: conf.color,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '0.2px',
                          }}
                        >
                          <ModeIcon size={11} />
                          <span>{conf.label}</span>
                        </span>

                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                          #{room.code}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: 'var(--primary)', lineHeight: 1.4 }}>
                        {room.title}
                      </h3>

                      {/* Host & Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                        <QuizAvatar user={room.host || { id: room.hostUserId }} userId={room.hostUserId} size="xs" />
                        <span>Chủ phòng: <strong style={{ color: 'var(--primary)', fontWeight: 600 }}>{room.host?.name || 'Host'}</strong></span>
                      </div>
                    </div>

                    {/* Bottom Action & Player Count */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 14,
                        paddingTop: 10,
                        borderTop: '1px solid rgba(0, 0, 0, 0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                        <Users size={13} color="var(--text-secondary)" />
                        <span>{room.playerCount || (room.players ? room.players.length : 1)} / {room.maxPlayers || 20} người</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onJoinRoom(room.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 12px',
                          background: 'var(--primary)',
                          color: 'var(--surface)',
                          border: 'none',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'background var(--motion-fast) var(--ease-standard)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#262626'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--primary)'; }}
                      >
                        <span>Tham gia</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── LEADERBOARD VIEW ── */
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 8,
            border: '1px solid rgba(0, 0, 0, 0.08)',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0, 0, 0, 0.08)' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trophy size={16} color="var(--accent)" />
              <span>Bảng Xếp Hạng Quiz Toàn Công Ty</span>
            </h3>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f7f4', borderBottom: '1px solid rgba(0, 0, 0, 0.08)' }}>
                  <th style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>Hạng</th>
                  <th style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>Thành viên</th>
                  <th style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>Tổng điểm</th>
                  <th style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span>Thắng</span>
                      <Trophy size={11} color="var(--accent)" />
                    </div>
                  </th>
                  <th style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>Độ chính xác</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 400 }}>
                      Chưa ghi nhận dữ liệu thi đấu nào trên bảng xếp hạng.
                    </td>
                  </tr>
                ) : (
                  leaderboard.map((item, idx) => (
                    <tr
                      key={item.id || idx}
                      style={{
                        borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
                        background: idx === 0 ? 'rgba(180,83,9,0.03)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {idx === 0 ? (
                            <Crown size={14} color="var(--accent)" />
                          ) : idx === 1 ? (
                            <Medal size={14} color="var(--text-secondary)" />
                          ) : idx === 2 ? (
                            <Medal size={14} color="#d97706" />
                          ) : null}
                          <span style={{ color: idx === 0 ? 'var(--accent)' : 'var(--primary)' }}>#{idx + 1}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <QuizAvatar user={item.user || { id: item.userId }} userId={item.userId} size="sm" />
                          <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{item.user?.name || `User #${item.userId}`}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--primary)' }}>
                        {Number(item.totalScore || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {item.gamesWon || 0}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--success)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {item.accuracy || 0}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CREATE ROOM MODAL ── */}
      <AnimatedModal
        isOpen={showCreateModal}
        onClose={() => !isSubmittingCreate && setShowCreateModal(false)}
        title="Tạo Phòng Đấu Quiz Mới"
        maxWidth={480}
      >
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--primary)', marginBottom: 5 }}>
              Tên phòng đấu *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tên phòng..."
              required
              disabled={isSubmittingCreate}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid rgba(0, 0, 0, 0.15)',
                background: 'var(--surface)',
                color: 'var(--primary)',
                fontSize: 13,
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--primary)', marginBottom: 5 }}>
              Chế độ câu hỏi *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { id: 'ALL', label: 'Tất Cả', icon: Sparkles },
                { id: 'IMAGE', label: 'Đoán Hình', icon: Image },
                { id: 'MUSIC', label: 'Đoán Nhạc', icon: Music },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={isSubmittingCreate}
                  onClick={() => setMode(m.id)}
                  style={{
                    padding: '8px 6px',
                    borderRadius: 6,
                    border: '1px solid',
                    borderColor: mode === m.id ? 'var(--accent)' : 'rgba(0,0,0,0.12)',
                    background: mode === m.id ? 'rgba(180,83,9,0.08)' : '#f8f7f4',
                    color: mode === m.id ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: isSubmittingCreate ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard), transform var(--motion-fast) var(--ease-standard)',
                  }}
                >
                  <m.icon size={15} />
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--primary)', marginBottom: 5 }}>
                Số người tối đa
              </label>
              <select
                value={maxPlayers}
                disabled={isSubmittingCreate}
                onChange={(e) => setMaxPlayers(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid rgba(0, 0, 0, 0.15)',
                  background: 'var(--surface)',
                  color: 'var(--primary)',
                  fontSize: 13,
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              >
                <option value={4}>4 người</option>
                <option value={8}>8 người</option>
                <option value={12}>12 người</option>
                <option value={20}>20 người</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--primary)', marginBottom: 5 }}>
                Số câu hỏi
              </label>
              <select
                value={totalQuestions}
                disabled={isSubmittingCreate}
                onChange={(e) => setTotalQuestions(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid rgba(0, 0, 0, 0.15)',
                  background: 'var(--surface)',
                  color: 'var(--primary)',
                  fontSize: 13,
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              >
                <option value={5}>5 câu</option>
                <option value={10}>10 câu</option>
                <option value={15}>15 câu</option>
              </select>
            </div>
          </div>

          {availableSets.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--primary)', marginBottom: 5 }}>
                Bộ câu hỏi (Tùy chọn)
              </label>
              <select
                value={selectedSetId}
                disabled={isSubmittingCreate}
                onChange={(e) => setSelectedSetId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid rgba(0, 0, 0, 0.15)',
                  background: 'var(--surface)',
                  color: 'var(--primary)',
                  fontSize: 13,
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              >
                <option value="">Tất cả câu hỏi (Ngẫu nhiên)</option>
                {availableSets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.category || 'Chung'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              type="button"
              disabled={isSubmittingCreate}
              onClick={() => setShowCreateModal(false)}
              style={{
                padding: '8px 14px',
                borderRadius: 6,
                background: 'var(--surface)',
                border: '1px solid rgba(0,0,0,0.15)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: isSubmittingCreate ? 'not-allowed' : 'pointer',
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmittingCreate}
              style={{
                padding: '8px 18px',
                borderRadius: 6,
                background: 'var(--primary)',
                color: 'var(--surface)',
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                cursor: isSubmittingCreate ? 'not-allowed' : 'pointer',
                opacity: isSubmittingCreate ? 0.7 : 1,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {isSubmittingCreate && <RefreshCw size={13} className="spin" />}
              <span>{isSubmittingCreate ? 'Đang tạo...' : 'Tạo phòng'}</span>
            </button>
          </div>
        </form>
      </AnimatedModal>
    </div>
  );
}
