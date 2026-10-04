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
} from 'lucide-react';
import { quizGame } from '../../services/api';
import QuizAvatar from './QuizAvatar';

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
  const [title, setTitle] = useState('Phòng Quiz Đoán Hình & Đoán Nhạc');
  const [mode, setMode] = useState('ALL');
  const [selectedSetId, setSelectedSetId] = useState('');
  const [availableSets, setAvailableSets] = useState([]);
  const [maxPlayers, setMaxPlayers] = useState(20);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [activeTab, setActiveTab] = useState('ROOMS'); // 'ROOMS' or 'LEADERBOARD'

  useEffect(() => {
    quizGame.listSets().then((res) => {
      setAvailableSets(res || []);
    }).catch(() => {});
  }, []);

  const filteredRooms = rooms.filter((r) => {
    if (modeFilter === 'ALL') return true;
    return r.mode === modeFilter;
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreateRoom({
      title: title.trim(),
      mode,
      quizSetId: selectedSetId ? Number(selectedSetId) : null,
      maxPlayers: Number(maxPlayers),
      totalQuestions: Number(totalQuestions),
    });
    setShowCreateModal(false);
  };

  const modeBadgeConfig = {
    ALL: { label: 'Đoán Hình & Nhạc', icon: Sparkles, color: '#b45309', bg: 'rgba(180,83,9,0.08)', border: 'rgba(180,83,9,0.2)' },
    IMAGE: { label: 'Đoán Hình', icon: Image, color: '#0369a1', bg: 'rgba(2,132,199,0.08)', border: 'rgba(2,132,199,0.2)' },
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
        color: '#141414',
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
          background: '#ffffff',
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
              color: '#b45309',
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

          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#141414', letterSpacing: '-0.3px', lineHeight: 1.3 }}>
            Đoán Hình & Đoán Nhạc
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666666', lineHeight: 1.5, fontWeight: 400 }}>
            Thử thách trực quan và giai điệu bài hát nhanh nhất để ghi điểm và thăng hạng trên bảng xếp hạng toàn công ty.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                width: 38,
                height: 38,
                background: '#ffffff',
                color: '#141414',
                border: '1px solid rgba(0, 0, 0, 0.12)',
                borderRadius: 6,
                cursor: loading ? 'wait' : 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f4f3ef'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 18px',
              background: '#141414',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#262626'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#141414'; }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Tạo Phòng Chơi</span>
          </button>
        </div>
      </div>

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
                background: '#b45309',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Gamepad2 size={18} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                Trận đấu đang diễn ra (#{activeRejoinRoom.code})
              </div>
              <div style={{ fontSize: 12, color: '#b45309', fontWeight: 400 }}>
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
              background: '#b45309',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#92400e'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#b45309'; }}
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
              background: '#ffffff',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: 6,
              padding: '12px 16px',
            }}
          >
            <div style={{ fontSize: 11, color: '#666666', fontWeight: 600, textTransform: 'uppercase' }}>Trận đã chơi</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#141414', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
              {myStats.gamesPlayed || 0}
            </div>
          </div>
          <div
            style={{
              background: '#ffffff',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: 6,
              padding: '12px 16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#666666', fontWeight: 600, textTransform: 'uppercase' }}>
              <span>Chiến thắng</span>
              <Trophy size={12} color="#b45309" />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#b45309', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
              {myStats.gamesWon || 0}
            </div>
          </div>
          <div
            style={{
              background: '#ffffff',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: 6,
              padding: '12px 16px',
            }}
          >
            <div style={{ fontSize: 11, color: '#666666', fontWeight: 600, textTransform: 'uppercase' }}>Tổng điểm tích lũy</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#141414', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
              {Number(myStats.totalScore || 0).toLocaleString()}
            </div>
          </div>
          <div
            style={{
              background: '#ffffff',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: 6,
              padding: '12px 16px',
            }}
          >
            <div style={{ fontSize: 11, color: '#666666', fontWeight: 600, textTransform: 'uppercase' }}>Tỉ lệ đúng</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#15803d', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
              {myStats.accuracy || 0}%
            </div>
          </div>
          <div
            style={{
              background: '#ffffff',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: 6,
              padding: '12px 16px',
            }}
          >
            <div style={{ fontSize: 11, color: '#666666', fontWeight: 600, textTransform: 'uppercase' }}>Điểm kỷ lục</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#7c3aed', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
              {Number(myStats.highestScore || 0).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* ── TABS & FILTER BAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
        {/* Main Section Tabs */}
        <div style={{ display: 'flex', gap: 4, background: '#ffffff', padding: 3, borderRadius: 6, border: '1px solid rgba(0,0,0,0.08)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('ROOMS')}
            style={{
              padding: '6px 14px',
              border: 'none',
              borderRadius: 5,
              fontSize: 12,
              fontWeight: 600,
              background: activeTab === 'ROOMS' ? '#141414' : 'transparent',
              color: activeTab === 'ROOMS' ? '#ffffff' : '#666666',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease',
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
              background: activeTab === 'LEADERBOARD' ? '#141414' : 'transparent',
              color: activeTab === 'LEADERBOARD' ? '#ffffff' : '#666666',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease',
            }}
          >
            <span>Bảng Xếp Hạng</span>
            <Trophy size={13} color={activeTab === 'LEADERBOARD' ? '#f59e0b' : '#b45309'} />
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
                  borderColor: modeFilter === f.id ? '#b45309' : 'rgba(0,0,0,0.1)',
                  background: modeFilter === f.id ? 'rgba(180,83,9,0.08)' : '#ffffff',
                  color: modeFilter === f.id ? '#b45309' : '#666666',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease',
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
                background: '#ffffff',
                borderRadius: 8,
                border: '1px dashed rgba(0,0,0,0.15)',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: '#f4f3ef',
                  color: '#666666',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <Gamepad2 size={22} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#141414' }}>
                Chưa có phòng chơi nào đang chờ
              </div>
              <p style={{ fontSize: 13, color: '#666666', margin: '4px 0 16px', fontWeight: 400 }}>
                Tạo phòng mới và mời các thành viên cùng tham gia thi đấu ngay bây giờ.
              </p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                style={{
                  padding: '8px 18px',
                  background: '#141414',
                  color: '#ffffff',
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
                      background: '#ffffff',
                      borderRadius: 8,
                      border: '1px solid rgba(0, 0, 0, 0.08)',
                      padding: '16px 18px',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
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

                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: '#b45309' }}>
                          #{room.code}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: '#141414', lineHeight: 1.4 }}>
                        {room.title}
                      </h3>

                      {/* Host & Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666666' }}>
                        <QuizAvatar user={room.host || { id: room.hostUserId }} userId={room.hostUserId} size="xs" />
                        <span>Chủ phòng: <strong style={{ color: '#141414', fontWeight: 600 }}>{room.host?.name || 'Host'}</strong></span>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#666666', fontWeight: 600 }}>
                        <Users size={13} color="#666666" />
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
                          background: '#141414',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#262626'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#141414'; }}
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
            background: '#ffffff',
            borderRadius: 8,
            border: '1px solid rgba(0, 0, 0, 0.08)',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0, 0, 0, 0.08)' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#141414', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trophy size={16} color="#b45309" />
              <span>Bảng Xếp Hạng Quiz Toàn Công Ty</span>
            </h3>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f7f4', borderBottom: '1px solid rgba(0, 0, 0, 0.08)' }}>
                  <th style={{ padding: '10px 16px', fontWeight: 700, color: '#666666', fontSize: 11, textTransform: 'uppercase' }}>Hạng</th>
                  <th style={{ padding: '10px 16px', fontWeight: 700, color: '#666666', fontSize: 11, textTransform: 'uppercase' }}>Thành viên</th>
                  <th style={{ padding: '10px 16px', fontWeight: 700, color: '#666666', fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>Tổng điểm</th>
                  <th style={{ padding: '10px 16px', fontWeight: 700, color: '#666666', fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span>Thắng</span>
                      <Trophy size={11} color="#b45309" />
                    </div>
                  </th>
                  <th style={{ padding: '10px 16px', fontWeight: 700, color: '#666666', fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>Độ chính xác</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#666666', fontSize: 13, fontWeight: 400 }}>
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
                            <Crown size={14} color="#b45309" />
                          ) : idx === 1 ? (
                            <Medal size={14} color="#64748b" />
                          ) : idx === 2 ? (
                            <Medal size={14} color="#d97706" />
                          ) : null}
                          <span style={{ color: idx === 0 ? '#b45309' : '#141414' }}>#{idx + 1}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <QuizAvatar user={item.user || { id: item.userId }} userId={item.userId} size="sm" />
                          <span style={{ fontWeight: 600, color: '#141414' }}>{item.user?.name || `User #${item.userId}`}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#141414' }}>
                        {Number(item.totalScore || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#b45309', fontFamily: 'JetBrains Mono, monospace' }}>
                        {item.gamesWon || 0}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#15803d', fontFamily: 'JetBrains Mono, monospace' }}>
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
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: 8,
              padding: 24,
              width: '100%',
              maxWidth: 460,
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.16)',
              color: '#141414',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#141414', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} color="#b45309" />
                <span>Tạo Phòng Đấu Quiz Mới</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#666666', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#141414', marginBottom: 5 }}>
                  Tên phòng đấu *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tên phòng..."
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid rgba(0, 0, 0, 0.15)',
                    background: '#ffffff',
                    color: '#141414',
                    fontSize: 13,
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#141414', marginBottom: 5 }}>
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
                      onClick={() => setMode(m.id)}
                      style={{
                        padding: '8px 6px',
                        borderRadius: 6,
                        border: '1px solid',
                        borderColor: mode === m.id ? '#b45309' : 'rgba(0,0,0,0.12)',
                        background: mode === m.id ? 'rgba(180,83,9,0.08)' : '#f8f7f4',
                        color: mode === m.id ? '#b45309' : '#666666',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease',
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
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#141414', marginBottom: 5 }}>
                    Số người tối đa
                  </label>
                  <select
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid rgba(0, 0, 0, 0.15)',
                      background: '#ffffff',
                      color: '#141414',
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
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#141414', marginBottom: 5 }}>
                    Số câu hỏi
                  </label>
                  <select
                    value={totalQuestions}
                    onChange={(e) => setTotalQuestions(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid rgba(0, 0, 0, 0.15)',
                      background: '#ffffff',
                      color: '#141414',
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
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#141414', marginBottom: 5 }}>
                    Bộ câu hỏi (Tùy chọn)
                  </label>
                  <select
                    value={selectedSetId}
                    onChange={(e) => setSelectedSetId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid rgba(0, 0, 0, 0.15)',
                      background: '#ffffff',
                      color: '#141414',
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
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    background: '#ffffff',
                    border: '1px solid rgba(0,0,0,0.15)',
                    color: '#666666',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: 6,
                    background: '#141414',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  }}
                >
                  Tạo phòng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
