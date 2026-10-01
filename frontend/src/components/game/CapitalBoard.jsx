import React, { useState } from 'react';
import {
  Flag,
  Coffee,
  CreditCard,
  Gift,
  Sparkles,
  ShieldAlert,
  Trophy,
  Building,
  User,
  Check,
  ChevronRight,
  HelpCircle,
  Volume2,
  VolumeX,
  Gamepad2,
  Zap,
  Dice5,
  Clock,
  X,
} from 'lucide-react';
import DiceRoller from './DiceRoller';
import gameSound from './gameSound';

// 28 Tiles definitions with exact board layout
const BOARD_TILES = [
  // Bottom Row: 0 -> 7 (Left to Right) [row 8]
  { index: 0, type: 'START', name: 'Khởi Hành', label: 'START', bonus: 200, row: 8, col: 1 },
  { index: 1, type: 'PROPERTY', name: 'Phòng Livestream', group: 'MEDIA', groupName: 'Media Hub', color: '#ec4899', price: 100, rent: 15, row: 8, col: 2 },
  { index: 2, type: 'PROPERTY', name: 'Studio Sáng Tạo', group: 'MEDIA', groupName: 'Media Hub', color: '#ec4899', price: 120, rent: 20, row: 8, col: 3 },
  { index: 3, type: 'PROPERTY', name: 'Đài Truyền Thông', group: 'MEDIA', groupName: 'Media Hub', color: '#ec4899', price: 140, rent: 25, row: 8, col: 4 },
  { index: 4, type: 'EVENT', name: 'Cơ Hội Bứt Phá', label: 'CƠ HỘI', row: 8, col: 5 },
  { index: 5, type: 'PROPERTY', name: 'Trung Tâm Dữ Liệu', group: 'TECH', groupName: 'Công Nghệ', color: '#06b6d4', price: 160, rent: 30, row: 8, col: 6 },
  { index: 6, type: 'PROPERTY', name: 'Phòng AI', group: 'TECH', groupName: 'Công Nghệ', color: '#06b6d4', price: 180, rent: 35, row: 8, col: 7 },
  { index: 7, type: 'REST', name: 'Khu Nghỉ Dưỡng', label: 'NGHỈ DƯỠNG', row: 8, col: 8 },

  // Right Column: 8 -> 14 (Bottom to Top) [col 8]
  { index: 8, type: 'PROPERTY', name: 'Trụ Sở Cloud Core', group: 'TECH', groupName: 'Công Nghệ', color: '#06b6d4', price: 200, rent: 40, row: 7, col: 8 },
  { index: 9, type: 'PROPERTY', name: 'Cảng Logistics', group: 'LOGISTICS', groupName: 'Hậu Cần', color: '#3b82f6', price: 220, rent: 45, row: 6, col: 8 },
  { index: 10, type: 'PROPERTY', name: 'Bến Du Thuyền', group: 'LOGISTICS', groupName: 'Hậu Cần', color: '#3b82f6', price: 240, rent: 50, row: 5, col: 8 },
  { index: 11, type: 'TAX', name: 'Phí Hạ Tầng', label: 'PHÍ DỊCH VỤ', taxAmount: 80, row: 4, col: 8 },
  { index: 12, type: 'PROPERTY', name: 'Đảo Hải Đăng', group: 'LOGISTICS', groupName: 'Hậu Cần', color: '#3b82f6', price: 260, rent: 55, row: 3, col: 8 },
  { index: 13, type: 'EVENT', name: 'Vận May', label: 'CƠ HỘI', row: 2, col: 8 },
  { index: 14, type: 'BONUS', name: 'Kho Báu Doanh Nghiệp', label: 'KHO BÁU', bonus: 150, row: 1, col: 8 },

  // Top Row: 15 -> 21 (Right to Left) [row 1]
  { index: 15, type: 'PROPERTY', name: 'Công Viên Xanh', group: 'ECO', groupName: 'Sinh Thái', color: '#10b981', price: 280, rent: 60, row: 1, col: 7 },
  { index: 16, type: 'PROPERTY', name: 'Thung Lũng Sinh Thái', group: 'ECO', groupName: 'Sinh Thái', color: '#10b981', price: 300, rent: 65, row: 1, col: 6 },
  { index: 17, type: 'PROPERTY', name: 'Rừng Nguyên Sinh', group: 'ECO', groupName: 'Sinh Thái', color: '#10b981', price: 320, rent: 70, row: 1, col: 5 },
  { index: 18, type: 'EVENT', name: 'Cơ Hội Đầu Tư', label: 'CƠ HỘI', row: 1, col: 4 },
  { index: 19, type: 'PROPERTY', name: 'Tháp Tài Chính', group: 'FINANCE', groupName: 'Tài Chính', color: '#f59e0b', price: 340, rent: 75, row: 1, col: 3 },
  { index: 20, type: 'PROPERTY', name: 'Tòa Nhà Chọc Trời', group: 'FINANCE', groupName: 'Tài Chính', color: '#f59e0b', price: 360, rent: 80, row: 1, col: 2 },
  { index: 21, type: 'TAX', name: 'Thuế Doanh Nghiệp', label: 'THUẾ QUỸ', taxAmount: 100, row: 1, col: 1 },

  // Left Column: 22 -> 27 (Top to Bottom) [col 1]
  { index: 22, type: 'PROPERTY', name: 'Penthouse Hoàng Kim', group: 'FINANCE', groupName: 'Tài Chính', color: '#f59e0b', price: 380, rent: 85, row: 2, col: 1 },
  { index: 23, type: 'PROPERTY', name: 'Quảng Trường TT', group: 'CENTRAL', groupName: 'Trung Tâm', color: '#8b5cf6', price: 400, rent: 90, row: 3, col: 1 },
  { index: 24, type: 'PROPERTY', name: 'Đại Lộ Ngôi Sao', group: 'CENTRAL', groupName: 'Trung Tâm', color: '#8b5cf6', price: 420, rent: 95, row: 4, col: 1 },
  { index: 25, type: 'EVENT', name: 'Sự Kiện Đặc Biệt', label: 'CƠ HỘI', row: 5, col: 1 },
  { index: 26, type: 'PROPERTY', name: 'Tập Đoàn Quốc Tế', group: 'CENTRAL', groupName: 'Trung Tâm', color: '#8b5cf6', price: 450, rent: 110, row: 6, col: 1 },
  { index: 27, type: 'BONUS', name: 'Thưởng Vượt Chỉ Số', label: 'THƯỞNG', bonus: 100, row: 7, col: 1 },
];

export default function CapitalBoard({
  room,
  players = [],
  properties = [],
  currentTurnPlayer,
  myPlayer,
  isMyTurn = false,
  turnPhase = 'ROLL_DICE', // 'ROLL_DICE', 'ACTION_PENDING', 'TURN_DONE'
  turnTimeRemaining = 25,
  isRolling = false,
  lastDice = [1, 1],
  lastSum = null,
  onRollDice,
  onBuyProperty,
  onEndTurn,
  actionLoading = false,
  recentEvent = null,
}) {
  const [selectedTileIndex, setSelectedTileIndex] = useState(null);
  const [soundMuted, setSoundMuted] = useState(gameSound.isMuted());

  // Map properties by tileIndex
  const propertyMap = {};
  properties.forEach((p) => {
    propertyMap[p.tileIndex] = p;
  });

  // Map players by their current position
  const playersByTile = {};
  players.forEach((p) => {
    if (p.status !== 'BANKRUPT') {
      const pos = p.position || 0;
      if (!playersByTile[pos]) playersByTile[pos] = [];
      playersByTile[pos].push(p);
    }
  });

  // Current tile of the active player
  const activePlayerPosition = currentTurnPlayer?.position ?? 0;
  const currentTileOnBoard = BOARD_TILES[activePlayerPosition];
  const currentTileProperty = propertyMap[activePlayerPosition];

  // Check if current tile can be bought by current user
  const canBuyCurrentTile =
    isMyTurn &&
    turnPhase === 'ACTION_PENDING' &&
    currentTileOnBoard?.type === 'PROPERTY' &&
    currentTileProperty &&
    !currentTileProperty.ownerUserId &&
    !currentTileProperty.ownerId &&
    myPlayer?.cash >= (currentTileProperty.price || currentTileProperty.purchasePrice);

  const toggleSound = () => {
    const isNowMuted = gameSound.toggleMute();
    setSoundMuted(isNowMuted);
  };

  const selectedTile = selectedTileIndex !== null ? BOARD_TILES[selectedTileIndex] : null;
  const selectedProperty = selectedTileIndex !== null ? propertyMap[selectedTileIndex] : null;
  const selectedOwnerId = selectedProperty?.ownerUserId || selectedProperty?.ownerId;
  const selectedOwner = selectedOwnerId
    ? players.find((p) => Number(p.userId) === Number(selectedOwnerId))
    : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: 780,
        margin: '0 auto',
        userSelect: 'none',
      }}
    >
      {/* Sound & Info Bar */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
          padding: '4px 8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b' }}>
          <span style={{ fontWeight: 700, color: '#0f172a' }}>Phòng #{room?.code}</span>
          <span>•</span>
          <span>Lượt: <strong style={{ color: '#0f172a', fontFamily: 'JetBrains Mono, monospace' }}>{room?.turnCount || 1}</strong></span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={toggleSound}
            title={soundMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              background: soundMuted ? 'rgba(239,68,68,0.1)' : 'rgba(15,23,42,0.05)',
              color: soundMuted ? '#ef4444' : '#475569',
              border: '1px solid rgba(15,23,42,0.1)',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {soundMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            <span>{soundMuted ? 'Âm thanh: Tắt' : 'Âm thanh: Bật'}</span>
          </button>
        </div>
      </div>

      {/* Main Board Container (8x8 Grid) */}
      <div
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gridTemplateRows: 'repeat(8, 1fr)',
          gap: 3,
          background: '#cbd5e1',
          padding: 4,
          borderRadius: 12,
          boxShadow: '0 12px 30px rgba(15,23,42,0.1), inset 0 2px 4px rgba(255,255,255,0.6)',
          position: 'relative',
        }}
      >
        {/* 28 Perimeter Tiles */}
        {BOARD_TILES.map((tile) => {
          const prop = propertyMap[tile.index];
          const ownerUserId = prop?.ownerUserId || prop?.ownerId;
          const owner = ownerUserId ? players.find((p) => Number(p.userId) === Number(ownerUserId)) : null;
          const playersHere = playersByTile[tile.index] || [];
          const isSelected = selectedTileIndex === tile.index;
          const isCurrentActiveTile = activePlayerPosition === tile.index;

          return (
            <div
              key={tile.index}
              onClick={() => setSelectedTileIndex(tile.index)}
              style={{
                gridRow: tile.row,
                gridColumn: tile.col,
                background: '#ffffff',
                borderRadius: 4,
                border: isSelected
                  ? '2px solid #38bdf8'
                  : isCurrentActiveTile
                  ? '2px dashed #f59e0b'
                  : '1px solid rgba(15,23,42,0.08)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '3px 2px',
                position: 'relative',
                cursor: 'pointer',
                overflow: 'hidden',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                boxShadow: isSelected ? '0 0 8px rgba(56,189,248,0.4)' : 'none',
              }}
            >
              {/* Tile Type Header / Color Stripe */}
              {tile.type === 'PROPERTY' ? (
                <div
                  style={{
                    height: 5,
                    width: '100%',
                    background: tile.color || '#94a3b8',
                    borderRadius: 2,
                    position: 'relative',
                  }}
                >
                  {owner && (
                    <div
                      title={`Chủ sở hữu: ${owner.user?.name || 'Người chơi'}`}
                      style={{
                        position: 'absolute',
                        top: -2,
                        right: 2,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: owner.color || owner.seatColor || '#38bdf8',
                        border: '1.5px solid #ffffff',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      }}
                    />
                  )}
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 8,
                    fontWeight: 600,
                    textAlign: 'center',
                    padding: '1px 0',
                    background:
                      tile.type === 'START'
                        ? 'rgba(34,197,94,0.15)'
                        : tile.type === 'REST'
                        ? 'rgba(100,116,139,0.15)'
                        : tile.type === 'BONUS'
                        ? 'rgba(245,158,11,0.15)'
                        : tile.type === 'TAX'
                        ? 'rgba(239,68,68,0.15)'
                        : 'rgba(168,85,247,0.15)',
                    color:
                      tile.type === 'START'
                        ? '#16a34a'
                        : tile.type === 'REST'
                        ? '#475569'
                        : tile.type === 'BONUS'
                        ? '#d97706'
                        : tile.type === 'TAX'
                        ? '#dc2626'
                        : '#7c3aed',
                    borderRadius: 2,
                  }}
                >
                  {tile.label || tile.type}
                </div>
              )}

              {/* Tile Name / Title */}
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: '#0f172a',
                  textAlign: 'center',
                  lineHeight: 1.15,
                  padding: '1px 1px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {tile.name}
              </div>

              {/* Price / Subtext */}
              <div
                style={{
                  fontSize: 8,
                  fontWeight: 600,
                  textAlign: 'center',
                  color: tile.type === 'PROPERTY' ? '#0284c7' : '#64748b',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {tile.type === 'PROPERTY'
                  ? `$${tile.price}`
                  : tile.type === 'TAX'
                  ? `-$${tile.taxAmount}`
                  : tile.type === 'START' || tile.type === 'BONUS'
                  ? `+$${tile.bonus}`
                  : ''}
              </div>

              {/* Player Tokens On Tile */}
              {playersHere.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    left: 2,
                    right: 2,
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 2,
                    flexWrap: 'wrap',
                    zIndex: 5,
                  }}
                >
                  {playersHere.map((p) => (
                    <div
                      key={p.id}
                      title={`${p.user?.name || 'Người chơi'} (Vị trí ${p.seatIndex + 1})`}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: p.color || p.seatColor || '#38bdf8',
                        border: '1.5px solid #ffffff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontSize: 8,
                        fontWeight: 700,
                        animation: currentTurnPlayer?.id === p.id ? 'bounce 1s infinite' : 'none',
                      }}
                    >
                      {p.seatIndex + 1}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Central Game Center Console (Rows 2..7, Cols 2..7) */}
        <div
          style={{
            gridRow: '2 / 8',
            gridColumn: '2 / 8',
            background: '#ffffff',
            borderRadius: 8,
            border: '1px solid rgba(15,23,42,0.1)',
            boxShadow: 'inset 0 2px 6px rgba(15,23,42,0.04)',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Top Center Banner: Current Turn & Timer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: isMyTurn ? 'rgba(56,189,248,0.12)' : 'rgba(15,23,42,0.03)',
              border: isMyTurn ? '1.5px solid #38bdf8' : '1px solid rgba(15,23,42,0.08)',
              padding: '6px 12px',
              borderRadius: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: currentTurnPlayer?.seatColor || '#94a3b8',
                  boxShadow: '0 0 6px rgba(0,0,0,0.2)',
                }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                  {isMyTurn ? (
                    <span style={{ color: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Gamepad2 size={14} /> LƯỢT CỦA BẠN!
                    </span>
                  ) : (
                    <span>Lượt: {currentTurnPlayer?.user?.name || `Người chơi ${currentTurnPlayer?.seatIndex + 1}`}</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {turnPhase === 'ROLL_DICE' && 'Chờ gieo xúc xắc...'}
                  {turnPhase === 'ACTION_PENDING' && 'Đang lựa chọn mua tài sản / kết thúc lượt...'}
                  {turnPhase === 'TURN_DONE' && 'Đang chuyển lượt...'}
                </div>
              </div>
            </div>

            {/* Turn Countdown Badge */}
            <div
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 16,
                fontWeight: 700,
                color: turnTimeRemaining <= 5 ? '#ef4444' : '#0f172a',
                background: turnTimeRemaining <= 5 ? 'rgba(239,68,68,0.15)' : '#ffffff',
                border: '1px solid rgba(15,23,42,0.1)',
                padding: '2px 8px',
                borderRadius: 4,
              }}
            >
              {turnTimeRemaining}s
            </div>
          </div>

          {/* Center Stage: Dice Roller & Recent Event / Tile Landed Banner */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '10px 0',
            }}
          >
            <DiceRoller dice={lastDice} isRolling={isRolling} lastSum={lastSum} />

            {/* Active Tile Landed Information */}
            {currentTileOnBoard && (
              <div
                style={{
                  textAlign: 'center',
                  background: 'rgba(15,23,42,0.02)',
                  border: '1px dashed rgba(15,23,42,0.1)',
                  padding: '6px 12px',
                  borderRadius: 6,
                  maxWidth: '90%',
                }}
              >
                <span style={{ fontSize: 11, color: '#64748b' }}>Đang ở ô: </span>
                <strong style={{ fontSize: 12, color: '#0f172a' }}>{currentTileOnBoard.name}</strong>
                {currentTileProperty && (
                  <span style={{ fontSize: 11, color: '#0284c7', marginLeft: 6 }}>
                    (${currentTileProperty.purchasePrice})
                  </span>
                )}
              </div>
            )}

            {/* Recent Event Banner */}
            {recentEvent && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  background: 'rgba(168,85,247,0.1)',
                  border: '1px solid rgba(168,85,247,0.3)',
                  color: '#6b21a8',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  textAlign: 'center',
                  animation: 'fadeIn 0.3s ease',
                  maxWidth: '95%',
                }}
              >
                <Zap size={13} color="#9333ea" />
                <span>{recentEvent}</span>
              </div>
            )}
          </div>

          {/* Bottom Action Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {isMyTurn ? (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                {turnPhase === 'ROLL_DICE' && (
                  <button
                    type="button"
                    onClick={onRollDice}
                    disabled={actionLoading || isRolling}
                    style={{
                      flex: 1,
                      background: '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '10px 14px',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: actionLoading || isRolling ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 12px rgba(15,23,42,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Dice5 size={16} />
                    <span>Gieo Xúc Xắc</span>
                  </button>
                )}

                {turnPhase === 'ACTION_PENDING' && (
                  <>
                    {canBuyCurrentTile && (
                      <button
                        type="button"
                        onClick={onBuyProperty}
                        disabled={actionLoading}
                        style={{
                          flex: 1,
                          background: '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '10px 14px',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: actionLoading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          boxShadow: '0 4px 12px rgba(22,163,74,0.25)',
                        }}
                      >
                        <Building size={14} />
                        <span>Mua (${currentTileProperty.purchasePrice})</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={onEndTurn}
                      disabled={actionLoading}
                      style={{
                        flex: canBuyCurrentTile ? 0.8 : 1,
                        background: '#ffffff',
                        color: '#0f172a',
                        border: '1.5px solid #0f172a',
                        borderRadius: 6,
                        padding: '10px 14px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: actionLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                    >
                      <span>Kết Thúc Lượt</span>
                      <ChevronRight size={14} />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  textAlign: 'center',
                  fontSize: 12,
                  color: '#64748b',
                  background: 'rgba(15,23,42,0.03)',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid rgba(15,23,42,0.06)',
                }}
              >
                <Clock size={13} />
                <span>Đang chờ <strong>{currentTurnPlayer?.user?.name || `Người chơi ${currentTurnPlayer?.seatIndex + 1}`}</strong> thực hiện lượt...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Tile Inspector Modal / Footer Drawer */}
      {selectedTile && (
        <div
          style={{
            width: '100%',
            marginTop: 12,
            background: '#ffffff',
            border: '1px solid rgba(15,23,42,0.1)',
            borderRadius: 8,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                background: selectedTile.color || '#94a3b8',
              }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                Ô #{selectedTile.index}: {selectedTile.name}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {selectedTile.type === 'PROPERTY' && (
                  <span>
                    Nhóm: <strong>{selectedTile.groupName}</strong> | Giá mua: <strong>${selectedTile.price}</strong> | Tiền thuê:{' '}
                    <strong>${selectedTile.rent}</strong>
                  </span>
                )}
                {selectedTile.type === 'START' && 'Nhận +$200 khi đi qua hoặc dừng lại ô Khởi Hành'}
                {selectedTile.type === 'REST' && 'Nghỉ ngơi thư giãn, không bị trừ tiền'}
                {selectedTile.type === 'TAX' && `Đóng phí / thuế: $${selectedTile.taxAmount}`}
                {selectedTile.type === 'BONUS' && `Nhận thưởng doanh nghiệp: +$${selectedTile.bonus}`}
                {selectedTile.type === 'EVENT' && 'Rút ngẫu nhiên 1 Thẻ Cơ Hội / Vận May'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {selectedProperty && (
              <div style={{ fontSize: 12 }}>
                {selectedOwner ? (
                  <span
                    style={{
                      background: `${selectedOwner.color || selectedOwner.seatColor || '#38bdf8'}22`,
                      color: selectedOwner.color || selectedOwner.seatColor || '#38bdf8',
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontWeight: 600,
                    }}
                  >
                    Chủ: {selectedOwner.user?.name || 'Người chơi'}
                  </span>
                ) : (
                  <span
                    style={{
                      background: 'rgba(34,197,94,0.1)',
                      color: '#16a34a',
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontWeight: 600,
                    }}
                  >
                    Đất trống (${selectedProperty.price || selectedProperty.purchasePrice})
                  </span>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setSelectedTileIndex(null)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: 12,
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <X size={13} />
              <span>Đóng</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
