import React, { useState } from 'react';
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
} from 'lucide-react';
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
    ALL: { label: 'ĐOÁN HÌNH & NHẠC', icon: Sparkles, color: '#38bdf8', bg: 'rgba(56,189,248,0.15)', border: 'rgba(56,189,248,0.35)' },
    IMAGE: { label: 'ĐOÁN HÌNH', icon: Image, color: '#34d399', bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.35)' },
    MUSIC: { label: 'ĐOÁN NHẠC', icon: Music, color: '#c084fc', bg: 'rgba(192,132,252,0.15)', border: 'rgba(192,132,252,0.35)' },
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        width: '100%',
        maxWidth: 1080,
        margin: '0 auto',
        color: '#ffffff',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Header Card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(12px)',
          borderRadius: 16,
          padding: '24px 28px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              padding: '4px 12px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 900,
              marginBottom: 8,
              letterSpacing: '0.4px',
            }}
          >
            <Sparkles size={13} />
            <span>MINI GAME TRẮC NGHIỆM TỐC ĐỘ</span>
          </div>

          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.3px' }}>
            Đoán Hình & Đoán Nhạc
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
            Nhìn hình ảnh, lắng nghe giai điệu và chọn đáp án chính xác nhanh nhất để bứt phá bảng xếp hạng!
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              title="Làm mới danh sách"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 42,
                height: 42,
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 10,
                cursor: loading ? 'wait' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 22px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 900,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            <Plus size={17} strokeWidth={2.5} />
            <span>Tạo Phòng Chơi</span>
          </button>
        </div>
      </div>

      {/* Active Rejoin Banner */}
      {activeRejoinRoom && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1.5px solid #38bdf8',
            borderRadius: 12,
            boxShadow: '0 4px 16px rgba(56, 189, 248, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: '#0284c7',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(2,132,199,0.5)',
              }}
            >
              <Gamepad2 size={20} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#ffffff' }}>
                Bạn đang có trận đấu đang diễn ra (#{activeRejoinRoom.code})
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                Phòng: <strong style={{ color: '#38bdf8' }}>{activeRejoinRoom.title}</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onRejoinRoom(activeRejoinRoom.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 18px',
              background: '#38bdf8',
              color: '#0f172a',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 900,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(56,189,248,0.4)',
            }}
          >
            <span>Vào lại</span>
            <ArrowRight size={14} strokeWidth={2.5} />
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
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 14,
            padding: '16px 20px',
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Trận đã chơi</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#ffffff', marginTop: 2 }}>{myStats.gamesPlayed || 0}</div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>
              <span>Chiến thắng</span>
              <Trophy size={12} color="#f59e0b" />
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#f59e0b', marginTop: 2 }}>{myStats.gamesWon || 0}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Tổng điểm</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#38bdf8', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
              {Number(myStats.totalScore || 0).toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Tỉ lệ đúng</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#34d399', marginTop: 2 }}>{myStats.accuracy || 0}%</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Điểm kỷ lục</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#c084fc', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
              {Number(myStats.highestScore || 0).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Main Tab Controls & Filters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        {/* Rooms / Leaderboard View Tabs */}
        <div style={{ display: 'flex', gap: 6, background: 'rgba(0, 0, 0, 0.4)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('ROOMS')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 800,
              background: activeTab === 'ROOMS' ? '#0284c7' : 'transparent',
              color: activeTab === 'ROOMS' ? '#ffffff' : '#94a3b8',
              cursor: 'pointer',
              boxShadow: activeTab === 'ROOMS' ? '0 2px 8px rgba(2,132,199,0.4)' : 'none',
              transition: 'all 0.15s ease',
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
              padding: '8px 16px',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 800,
              background: activeTab === 'LEADERBOARD' ? '#0284c7' : 'transparent',
              color: activeTab === 'LEADERBOARD' ? '#ffffff' : '#94a3b8',
              cursor: 'pointer',
              boxShadow: activeTab === 'LEADERBOARD' ? '0 2px 8px rgba(2,132,199,0.4)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span>Bảng Xếp Hạng Quiz</span>
            <Trophy size={14} color="#f59e0b" />
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
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: '1px solid',
                  borderColor: modeFilter === f.id ? '#38bdf8' : 'rgba(255,255,255,0.12)',
                  background: modeFilter === f.id ? 'rgba(56,189,248,0.2)' : 'rgba(15,23,42,0.6)',
                  color: modeFilter === f.id ? '#38bdf8' : '#94a3b8',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
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
                background: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(10px)',
                borderRadius: 16,
                border: '1px dashed rgba(255,255,255,0.18)',
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                }}
              >
                <Gamepad2 size={26} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
                Chưa có phòng chơi nào đang chờ
              </div>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '6px 0 20px' }}>
                Hãy tạo phòng mới và mời đồng đội cùng tham gia thi đấu ngay bây giờ!
              </p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                style={{
                  padding: '10px 22px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
                }}
              >
                + Tạo Phòng Ngay
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
              {filteredRooms.map((room) => {
                const conf = modeBadgeConfig[room.mode] || modeBadgeConfig.ALL;
                const ModeIcon = conf.icon;

                return (
                  <div
                    key={room.id}
                    style={{
                      background: 'rgba(15, 23, 42, 0.8)',
                      backdropFilter: 'blur(8px)',
                      borderRadius: 14,
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      padding: '18px 20px',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'border-color 0.15s ease, transform 0.15s ease',
                    }}
                  >
                    <div>
                      {/* Badge & Code */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 9px',
                            borderRadius: 6,
                            background: conf.bg,
                            border: `1px solid ${conf.border}`,
                            color: conf.color,
                            fontSize: 10,
                            fontWeight: 900,
                            letterSpacing: '0.3px',
                          }}
                        >
                          <ModeIcon size={11} />
                          <span>{conf.label}</span>
                        </span>

                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 900, color: '#38bdf8' }}>
                          #{room.code}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 900, color: '#ffffff', lineHeight: 1.4 }}>
                        {room.title}
                      </h3>

                      {/* Host & Info with QuizAvatar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}>
                        <QuizAvatar user={room.host || { id: room.hostUserId }} userId={room.hostUserId} size="xs" />
                        <span>Host: <strong style={{ color: '#ffffff' }}>{room.host?.name || 'Host'}</strong></span>
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
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#94a3b8', fontWeight: 800 }}>
                        <Users size={14} color="#38bdf8" />
                        <span>{room.playerCount || (room.players ? room.players.length : 1)} / {room.maxPlayers || 20} người</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onJoinRoom(room.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '7px 14px',
                          background: '#0284c7',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 900,
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(2,132,199,0.35)',
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
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(12px)',
            borderRadius: 16,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
          }}
        >
          <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trophy size={18} color="#f59e0b" />
              <span>Bảng Xếp Hạng Quiz Toàn Công Ty</span>
            </h3>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(0, 0, 0, 0.3)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <th style={{ padding: '12px 18px', fontWeight: 900, color: '#94a3b8' }}>Hạng</th>
                  <th style={{ padding: '12px 18px', fontWeight: 900, color: '#94a3b8' }}>Thành viên</th>
                  <th style={{ padding: '12px 18px', fontWeight: 900, color: '#94a3b8', textAlign: 'right' }}>Tổng điểm</th>
                  <th style={{ padding: '12px 18px', fontWeight: 900, color: '#94a3b8', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span>Thắng</span>
                      <Trophy size={12} color="#f59e0b" />
                    </div>
                  </th>
                  <th style={{ padding: '12px 18px', fontWeight: 900, color: '#94a3b8', textAlign: 'right' }}>Độ chính xác</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((item, idx) => (
                  <tr
                    key={item.id || idx}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      background: idx === 0 ? 'rgba(245,158,11,0.06)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '14px 18px', fontWeight: 900, fontFamily: 'JetBrains Mono, monospace' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {idx === 0 ? (
                          <Crown size={15} color="#f59e0b" />
                        ) : idx === 1 ? (
                          <Medal size={15} color="#94a3b8" />
                        ) : idx === 2 ? (
                          <Medal size={15} color="#d97706" />
                        ) : null}
                        <span style={{ color: idx === 0 ? '#f59e0b' : '#ffffff' }}>#{idx + 1}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <QuizAvatar user={item.user || { id: item.userId }} userId={item.userId} size="sm" />
                        <span style={{ fontWeight: 800, color: '#ffffff' }}>{item.user?.name || `User #${item.userId}`}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#38bdf8' }}>
                      {Number(item.totalScore || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 800, color: '#f59e0b' }}>
                      {item.gamesWon || 0}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 800, color: '#34d399' }}>
                      {item.accuracy || 0}%
                    </td>
                  </tr>
                ))}
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
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 16,
              padding: 26,
              width: '100%',
              maxWidth: 460,
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
              color: '#ffffff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} color="#38bdf8" />
                <span>Tạo Phòng Đấu Quiz Mới</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#cbd5e1', marginBottom: 6 }}>
                  Tên phòng đấu
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tên phòng..."
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    background: 'rgba(255, 255, 255, 0.06)',
                    color: '#ffffff',
                    fontSize: 13,
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#cbd5e1', marginBottom: 6 }}>
                  Chế độ câu hỏi
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
                        borderRadius: 8,
                        border: '1.5px solid',
                        borderColor: mode === m.id ? '#38bdf8' : 'rgba(255,255,255,0.12)',
                        background: mode === m.id ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)',
                        color: mode === m.id ? '#38bdf8' : '#94a3b8',
                        fontSize: 12,
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.15s ease',
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
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#cbd5e1', marginBottom: 6 }}>
                    Số người tối đa
                  </label>
                  <select
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      background: '#1e293b',
                      color: '#ffffff',
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
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#cbd5e1', marginBottom: 6 }}>
                    Số câu hỏi
                  </label>
                  <select
                    value={totalQuestions}
                    onChange={(e) => setTotalQuestions(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      background: '#1e293b',
                      color: '#ffffff',
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

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 8,
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#94a3b8',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '9px 22px',
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(2,132,199,0.4)',
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
