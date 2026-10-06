import React, { useState } from 'react';
import {
  Gamepad2,
  Trophy,
  History,
  Plus,
  RefreshCw,
  Users,
  ArrowRight,
  Clock,
  Search,
  KeyRound,
  Sparkles,
} from 'lucide-react';
import { TabTransition, AnimatedModal } from '../ui';
import GameLeaderboard from './GameLeaderboard';
import GameHistory from './GameHistory';

export default function CapitalBoardLobby({
  activeTab = 'LOBBY',
  onTabChange,
  availableRooms = [],
  activeRejoinRoom = null,
  lobbyLoading = false,
  onRefresh,
  onJoinRoom,
  onCreateRoom,
  actionLoading = false,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newMaxPlayers, setNewMaxPlayers] = useState(4);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [codeJoinError, setCodeJoinError] = useState(null);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim() || creatingRoom) return;
    try {
      setCreatingRoom(true);
      await onCreateRoom({
        title: newRoomName.trim(),
        maxPlayers: newMaxPlayers,
      });
      setShowCreateModal(false);
      setNewRoomName('');
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleCodeJoinSubmit = (e) => {
    e.preventDefault();
    const code = joinCodeInput.trim();
    if (!code) return;
    setCodeJoinError(null);
    onJoinRoom(code);
  };

  const filteredRooms = availableRooms.filter((r) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const titleMatch = (r.title || r.name || '').toLowerCase().includes(term);
    const codeMatch = (r.code || '').toLowerCase().includes(term);
    const hostMatch = (r.host?.name || '').toLowerCase().includes(term);
    return titleMatch || codeMatch || hostMatch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Active Ongoing Game Rejoin Banner */}
      {activeRejoinRoom && (
        <div
          style={{
            background: 'linear-gradient(135deg, var(--info) 0%, var(--blue) 100%)',
            color: 'var(--surface)',
            borderRadius: 8,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 14px var(--info-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={20} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>BẠN ĐANG CÓ TRẬN ĐẤU ĐANG DIỄN RA!</div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>
                Phòng <strong>{activeRejoinRoom.title || activeRejoinRoom.name}</strong> (#{activeRejoinRoom.code})
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onJoinRoom(activeRejoinRoom.id)}
            style={{
              background: 'var(--surface)',
              color: 'var(--info)',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}
          >
            <span>Vào Lại Trận Đấu</span>
            <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '1px solid rgba(15,23,42,0.08)',
          paddingBottom: 8,
        }}
      >
        {[
          { key: 'LOBBY', label: 'Sảnh Phòng Đấu', icon: Gamepad2 },
          { key: 'LEADERBOARD', label: 'Bảng Xếp Hạng', icon: Trophy },
          { key: 'HISTORY', label: 'Lịch Sử Đấu', icon: History },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onTabChange(t.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 6,
                border: 'none',
                background: isActive ? 'var(--text-primary)' : 'transparent',
                color: isActive ? 'var(--surface)' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard)',
              }}
            >
              <Icon size={15} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents wrapped in TabTransition */}
      <TabTransition minHeight={400}>
        {activeTab === 'LOBBY' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Action Bar: Search, Enter Code & Create Room */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', flex: 1, minWidth: 260 }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
                  <Search
                    size={14}
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm phòng theo tên, chủ phòng..."
                    style={{
                      width: '100%',
                      padding: '7px 10px 7px 30px',
                      borderRadius: 6,
                      border: '1px solid rgba(15,23,42,0.12)',
                      fontSize: 12,
                      boxSizing: 'border-box',
                      background: 'var(--surface)',
                    }}
                  />
                </div>

                {/* Join by Code Form */}
                <form onSubmit={handleCodeJoinSubmit} style={{ display: 'flex', gap: 6 }}>
                  <div style={{ position: 'relative', width: 140 }}>
                    <KeyRound
                      size={13}
                      style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                    />
                    <input
                      type="text"
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                      placeholder="Mã CB-XXXX"
                      maxLength={12}
                      style={{
                        width: '100%',
                        padding: '7px 8px 7px 26px',
                        borderRadius: 6,
                        border: '1px solid rgba(15,23,42,0.12)',
                        fontSize: 12,
                        fontFamily: 'JetBrains Mono, monospace',
                        boxSizing: 'border-box',
                        background: 'var(--surface)',
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!joinCodeInput.trim() || actionLoading}
                    style={{
                      background: 'var(--surface)',
                      color: 'var(--text-primary)',
                      border: '1px solid rgba(15,23,42,0.2)',
                      borderRadius: 6,
                      padding: '7px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: !joinCodeInput.trim() || actionLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Vào Mã
                  </button>
                </form>
              </div>

              {/* Create & Refresh Buttons */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={lobbyLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'var(--surface)',
                    border: '1px solid rgba(15,23,42,0.12)',
                    borderRadius: 6,
                    padding: '7px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    cursor: lobbyLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  <RefreshCw size={13} className={lobbyLoading ? 'spin' : ''} />
                  <span>Làm mới</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'var(--text-primary)',
                    color: 'var(--surface)',
                    border: 'none',
                    borderRadius: 6,
                    padding: '7px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(15,23,42,0.15)',
                  }}
                >
                  <Plus size={15} />
                  <span>Tạo Phòng Chơi</span>
                </button>
              </div>
            </div>

            {/* Room List Grid */}
            {filteredRooms.length === 0 ? (
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px dashed rgba(15,23,42,0.15)',
                  borderRadius: 8,
                  padding: '44px 20px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'rgba(15,23,42,0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                  }}
                >
                  <Gamepad2 size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                    {searchTerm ? 'Không tìm thấy phòng phù hợp' : 'Chưa có phòng nào đang chờ'}
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                    {searchTerm ? 'Thử tìm kiếm với từ khóa khác hoặc tạo phòng mới.' : 'Hãy tạo phòng mới để bắt đầu ván cờ đầu tiên!'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  style={{
                    background: 'var(--text-primary)',
                    color: 'var(--surface)',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Tạo Phòng Ngay
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: 14,
                }}
              >
                {filteredRooms.map((r) => {
                  const joinedCount = r.playerCount || r.players?.length || 0;
                  const maxP = r.maxPlayers || 4;
                  const isFull = joinedCount >= maxP;
                  const isPlaying = r.status === 'PLAYING';

                  return (
                    <div
                      key={r.id}
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid rgba(15,23,42,0.1)',
                        borderRadius: 8,
                        padding: 16,
                        boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              background: isPlaying ? 'var(--info-soft)' : 'var(--success-soft)',
                              color: isPlaying ? 'var(--info)' : 'var(--success)',
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}
                          >
                            {isPlaying ? 'ĐANG CHƠI' : 'ĐANG CHỜ'}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                            #{r.code}
                          </span>
                        </div>

                        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                          {r.title || r.name}
                        </h3>

                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          Chủ phòng:{' '}
                          <strong style={{ color: 'var(--text-primary)' }}>{r.host?.name || 'Host'}</strong>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderTop: '1px solid rgba(15,23,42,0.06)',
                          paddingTop: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                          <Users size={15} />
                          <span>
                            <strong>{joinedCount}</strong> / {maxP} người
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => onJoinRoom(r.id)}
                          disabled={actionLoading || (isFull && !isPlaying)}
                          style={{
                            background: isFull ? 'rgba(15,23,42,0.05)' : 'var(--text-primary)',
                            color: isFull ? 'var(--text-muted)' : 'var(--surface)',
                            border: 'none',
                            borderRadius: 6,
                            padding: '6px 14px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: isFull ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span>{isFull ? 'Đã Đầy' : 'Tham Gia'}</span>
                          {!isFull && <ArrowRight size={13} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'LEADERBOARD' && <GameLeaderboard />}
        {activeTab === 'HISTORY' && <GameHistory />}
      </TabTransition>

      {/* Create Room Modal */}
      <AnimatedModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Tạo Phòng Cờ Tỷ Phú"
        maxWidth={440}
      >
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Tên phòng chơi
            </label>
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Ví dụ: Đại Chiến Tỷ Phú WorkRank"
              maxLength={40}
              required
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid rgba(15,23,42,0.2)',
                fontSize: 13,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Số lượng người chơi
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[2, 3, 4].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setNewMaxPlayers(num)}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    borderRadius: 6,
                    border: newMaxPlayers === num ? '2px solid var(--text-primary)' : '1px solid rgba(15,23,42,0.15)',
                    background: newMaxPlayers === num ? 'var(--text-primary)' : 'var(--surface)',
                    color: newMaxPlayers === num ? 'var(--surface)' : 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {num} Người
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 6,
                border: '1px solid rgba(15,23,42,0.2)',
                background: 'var(--surface)',
                color: 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={creatingRoom}
              style={{
                flex: 2,
                padding: '10px 14px',
                borderRadius: 6,
                border: 'none',
                background: 'var(--text-primary)',
                color: 'var(--surface)',
                fontWeight: 700,
                fontSize: 13,
                cursor: creatingRoom ? 'not-allowed' : 'pointer',
              }}
            >
              {creatingRoom ? 'Đang tạo phòng...' : 'Tạo Phòng Ngay'}
            </button>
          </div>
        </form>
      </AnimatedModal>
    </div>
  );
}
