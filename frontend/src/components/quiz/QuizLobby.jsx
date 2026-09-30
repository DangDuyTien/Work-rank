import React, { useState } from 'react';
import {
  Plus,
  Users,
  Play,
  Image,
  Music,
  Sparkles,
  Trophy,
  Medal,
  Crown,
  Flame,
  Search,
  ArrowRight,
  RotateCcw,
  Zap,
  Gamepad2,
  Dice5,
} from 'lucide-react';
import { getUserAvatar } from '../../utils/avatar';

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
  const [title, setTitle] = useState('Phòng Quiz Đoán Hình Đoán Nhạc');
  const [mode, setMode] = useState('ALL');
  const [maxPlayers, setMaxPlayers] = useState(20);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [activeTab, setActiveTab] = useState('ROOMS'); // 'ROOMS' or 'LEADERBOARD'

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
      maxPlayers: Number(maxPlayers),
      totalQuestions: Number(totalQuestions),
    });
    setShowCreateModal(false);
  };

  const modeBadgeConfig = {
    ALL: { label: 'ĐOÁN HÌNH & NHẠC', icon: Sparkles, color: '#0284c7', bg: 'rgba(2,132,199,0.1)' },
    IMAGE: { label: 'ĐOÁN HÌNH', icon: Image, color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
    MUSIC: { label: 'ĐOÁN NHẠC', icon: Music, color: '#9333ea', bg: 'rgba(147,51,234,0.1)' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', maxWidth: 1040, margin: '0 auto' }}>
      {/* Top Header & Rejoin Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: 16,
          padding: '24px 28px',
          color: '#ffffff',
          boxShadow: '0 8px 32px rgba(15,23,42,0.12)',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(56,189,248,0.15)',
              color: '#38bdf8',
              padding: '3px 10px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            <Sparkles size={13} />
            <span>MINI GAME NỘI BỘ WORKRANK</span>
          </div>

          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>
            Đoán Hình & Đoán Nhạc
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#94a3b8' }}>
            Nhìn hình đoán chữ, nghe nhạc đoán bài hát — trả lời nhanh nhất để ghi điểm tối đa!
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '12px 20px',
            background: '#38bdf8',
            color: '#0f172a',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 900,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(56,189,248,0.4)',
          }}
        >
          <Plus size={18} strokeWidth={3} />
          <span>Tạo Phòng Chơi</span>
        </button>
      </div>

      {/* Active Rejoin Banner */}
      {activeRejoinRoom && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            background: 'rgba(56,189,248,0.1)',
            border: '1.5px solid #38bdf8',
            borderRadius: 12,
            animation: 'fadeIn 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#0284c7',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Gamepad2 size={20} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                Bạn đang có trận đấu đang diễn ra (#{activeRejoinRoom.code})
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Phòng: <strong>{activeRejoinRoom.title}</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onRejoinRoom(activeRejoinRoom.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '8px 16px',
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <span>Vào Lại Trận</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Career Stats Bar */}
      {myStats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
            background: '#ffffff',
            border: '1px solid rgba(15,23,42,0.08)',
            borderRadius: 12,
            padding: '14px 18px',
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Trận đã chơi</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>{myStats.gamesPlayed || 0}</div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              <span>Chiến thắng</span>
              <Trophy size={12} color="#d97706" />
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#d97706', marginTop: 2 }}>{myStats.gamesWon || 0}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Tổng điểm</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0284c7', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
              {Number(myStats.totalScore || 0).toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Tỉ lệ đúng</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#16a34a', marginTop: 2 }}>{myStats.accuracy || 0}%</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Điểm kỷ lục</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#7c3aed', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
              {Number(myStats.highestScore || 0).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Main Tab Controls & Filters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        {/* Rooms / Leaderboard View Tabs */}
        <div style={{ display: 'flex', gap: 6, background: 'rgba(15,23,42,0.05)', padding: 4, borderRadius: 8 }}>
          <button
            type="button"
            onClick={() => setActiveTab('ROOMS')}
            style={{
              padding: '6px 14px',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 800,
              background: activeTab === 'ROOMS' ? '#ffffff' : 'transparent',
              color: activeTab === 'ROOMS' ? '#0f172a' : '#64748b',
              cursor: 'pointer',
              boxShadow: activeTab === 'ROOMS' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            Sảnh Phòng Đấu ({rooms.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('LEADERBOARD')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 800,
              background: activeTab === 'LEADERBOARD' ? '#ffffff' : 'transparent',
              color: activeTab === 'LEADERBOARD' ? '#0f172a' : '#64748b',
              cursor: 'pointer',
              boxShadow: activeTab === 'LEADERBOARD' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            <span>Bảng Xếp Hạng Quiz</span>
            <Trophy size={14} color="#d97706" />
          </button>
        </div>

        {/* Mode Filters (if in rooms tab) */}
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid',
                  borderColor: modeFilter === f.id ? '#0f172a' : 'rgba(15,23,42,0.1)',
                  background: modeFilter === f.id ? '#0f172a' : '#ffffff',
                  color: modeFilter === f.id ? '#ffffff' : '#64748b',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <f.icon size={13} />
                <span>{f.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* View Content */}
      {activeTab === 'ROOMS' ? (
        <div>
          {filteredRooms.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 24px',
                background: '#ffffff',
                borderRadius: 14,
                border: '1px dashed rgba(15,23,42,0.15)',
              }}
            >
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: '50%',
                  background: 'rgba(15,23,42,0.06)',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <Gamepad2 size={28} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                Chưa có phòng chơi nào đang chờ
              </div>
              <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 16px' }}>
                Hãy là người đầu tiên tạo phòng và mời đồng đội vào thử thách!
              </p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                style={{
                  padding: '10px 18px',
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                + Tạo Phòng Ngay
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {filteredRooms.map((room) => {
                const conf = modeBadgeConfig[room.mode] || modeBadgeConfig.ALL;
                const ModeIcon = conf.icon;
                const avatarUrl = room.host?.avatarUrl || getUserAvatar(room.hostUserId);

                return (
                  <div
                    key={room.id}
                    style={{
                      background: '#ffffff',
                      borderRadius: 12,
                      border: '1px solid rgba(15,23,42,0.1)',
                      padding: '16px 18px',
                      boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    <div>
                      {/* Badge & Code */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 4,
                            background: conf.bg,
                            color: conf.color,
                            fontSize: 10,
                            fontWeight: 900,
                          }}
                        >
                          <ModeIcon size={12} />
                          <span>{conf.label}</span>
                        </span>

                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 900, color: '#64748b' }}>
                          #{room.code}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                        {room.title}
                      </h3>

                      {/* Host & Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
                        <img src={avatarUrl} alt={room.host?.name} style={{ width: 18, height: 18, borderRadius: '50%' }} />
                        <span>Host: <strong>{room.host?.name || 'Host'}</strong></span>
                      </div>
                    </div>

                    {/* Bottom Action & Player Count */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 16,
                        paddingTop: 12,
                        borderTop: '1px solid rgba(15,23,42,0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#475569', fontWeight: 700 }}>
                        <Users size={14} color="#0284c7" />
                        <span>{room.playerCount || (room.players ? room.players.length : 1)} / {room.maxPlayers || 20}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onJoinRoom(room.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '6px 14px',
                          background: '#0f172a',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        <span>Tham gia</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Leaderboard View */
        <div
          style={{
            background: '#ffffff',
            borderRadius: 14,
            border: '1px solid rgba(15,23,42,0.1)',
            overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
          }}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
              Bảng Vinh Danh Cao Thủ Đoán Nhanh
            </h3>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(15,23,42,0.02)', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                  <th style={{ padding: '10px 16px', fontWeight: 800, color: '#64748b' }}>Hạng</th>
                  <th style={{ padding: '10px 16px', fontWeight: 800, color: '#64748b' }}>Thành viên</th>
                  <th style={{ padding: '10px 16px', fontWeight: 800, color: '#64748b', textAlign: 'right' }}>Tổng điểm</th>
                  <th style={{ padding: '10px 16px', fontWeight: 800, color: '#64748b', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span>Thắng</span>
                      <Trophy size={12} color="#d97706" />
                    </div>
                  </th>
                  <th style={{ padding: '10px 16px', fontWeight: 800, color: '#64748b', textAlign: 'right' }}>Độ chính xác</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((item, idx) => {
                  const avatarUrl = item.user?.avatarUrl || getUserAvatar(item.userId);
                  return (
                    <tr
                      key={item.id || idx}
                      style={{
                        borderBottom: '1px solid rgba(15,23,42,0.05)',
                        background: idx === 0 ? 'rgba(245,158,11,0.04)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 900, fontFamily: 'JetBrains Mono, monospace' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {idx === 0 ? (
                            <Crown size={15} color="#d97706" />
                          ) : idx === 1 ? (
                            <Medal size={15} color="#64748b" />
                          ) : idx === 2 ? (
                            <Medal size={15} color="#b45309" />
                          ) : null}
                          <span>#{idx + 1}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <img src={avatarUrl} alt={item.user?.name} style={{ width: 28, height: 28, borderRadius: '50%' }} />
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>{item.user?.name || `User #${item.userId}`}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#0284c7' }}>
                        {Number(item.totalScore || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#d97706' }}>
                        {item.gamesWon || 0}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                        {item.accuracy || 0}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Room Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: 24,
              width: '100%',
              maxWidth: 460,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
              Tạo Phòng Đấu Quiz Mới
            </h2>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                  Tên phòng
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
                    border: '1px solid rgba(15,23,42,0.2)',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                  Chế độ chơi
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
                        padding: '10px 8px',
                        borderRadius: 6,
                        border: '1.5px solid',
                        borderColor: mode === m.id ? '#0284c7' : 'rgba(15,23,42,0.15)',
                        background: mode === m.id ? 'rgba(2,132,199,0.1)' : '#ffffff',
                        color: mode === m.id ? '#0284c7' : '#475569',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <m.icon size={16} />
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                    Số người tối đa
                  </label>
                  <select
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid rgba(15,23,42,0.2)',
                      fontSize: 14,
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value={4}>4 người</option>
                    <option value={8}>8 người</option>
                    <option value={12}>12 người</option>
                    <option value={20}>20 người</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                    Số câu hỏi
                  </label>
                  <select
                    value={totalQuestions}
                    onChange={(e) => setTotalQuestions(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid rgba(15,23,42,0.2)',
                      fontSize: 14,
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value={5}>5 câu</option>
                    <option value={10}>10 câu</option>
                    <option value={15}>15 câu</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    background: 'transparent',
                    border: '1px solid rgba(15,23,42,0.2)',
                    color: '#64748b',
                    fontSize: 13,
                    fontWeight: 700,
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
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
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
