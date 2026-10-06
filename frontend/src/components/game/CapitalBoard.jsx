import React, { useState, useEffect, useRef } from 'react';
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
  Info,
} from 'lucide-react';
import DiceRoller from './DiceRoller';
import PropertyDetailModal from './PropertyDetailModal';
import gameSound from './gameSound';

// 28 Tiles definitions with exact board layout
export const BOARD_TILES = [
  // Bottom Row: 0 -> 7 (Left to Right) [row 8]
  { index: 0, type: 'START', name: 'Khởi Hành', label: 'START', bonus: 200, row: 8, col: 1, color: '#16a34a' },
  { index: 1, type: 'PROPERTY', name: 'Phòng Livestream', group: 'MEDIA', groupName: 'Media Hub', color: '#ec4899', price: 100, rent: 15, row: 8, col: 2 },
  { index: 2, type: 'PROPERTY', name: 'Studio Sáng Tạo', group: 'MEDIA', groupName: 'Media Hub', color: '#ec4899', price: 120, rent: 20, row: 8, col: 3 },
  { index: 3, type: 'PROPERTY', name: 'Đài Truyền Thông', group: 'MEDIA', groupName: 'Media Hub', color: '#ec4899', price: 140, rent: 25, row: 8, col: 4 },
  { index: 4, type: 'EVENT', name: 'Cơ Hội Bứt Phá', label: 'CƠ HỘI', row: 8, col: 5, color: '#9333ea' },
  { index: 5, type: 'PROPERTY', name: 'Trung Tâm Dữ Liệu', group: 'TECH', groupName: 'Công Nghệ', color: '#06b6d4', price: 160, rent: 30, row: 8, col: 6 },
  { index: 6, type: 'PROPERTY', name: 'Phòng Nghiên Cứu AI', group: 'TECH', groupName: 'Công Nghệ', color: '#06b6d4', price: 180, rent: 35, row: 8, col: 7 },
  { index: 7, type: 'REST', name: 'Khu Nghỉ Dưỡng', label: 'NGHỈ DƯỠNG', row: 8, col: 8, color: '#64748b' },

  // Right Column: 8 -> 14 (Bottom to Top) [col 8]
  { index: 8, type: 'PROPERTY', name: 'Trụ Sở Cloud Core', group: 'TECH', groupName: 'Công Nghệ', color: '#06b6d4', price: 200, rent: 40, row: 7, col: 8 },
  { index: 9, type: 'PROPERTY', name: 'Cảng Logistics', group: 'LOGISTICS', groupName: 'Hậu Cần', color: '#3b82f6', price: 220, rent: 45, row: 6, col: 8 },
  { index: 10, type: 'PROPERTY', name: 'Bến Du Thuyền', group: 'LOGISTICS', groupName: 'Hậu Cần', color: '#3b82f6', price: 240, rent: 50, row: 5, col: 8 },
  { index: 11, type: 'TAX', name: 'Phí Hạ Tầng', label: 'PHÍ DỊCH VỤ', taxAmount: 80, row: 4, col: 8, color: '#ea580c' },
  { index: 12, type: 'PROPERTY', name: 'Đảo Hải Đăng', group: 'LOGISTICS', groupName: 'Hậu Cần', color: '#3b82f6', price: 260, rent: 55, row: 3, col: 8 },
  { index: 13, type: 'EVENT', name: 'Vận May Khởi Nghiệp', label: 'CƠ HỘI', row: 2, col: 8, color: '#9333ea' },
  { index: 14, type: 'BONUS', name: 'Kho Báu Doanh Nghiệp', label: 'KHO BÁU', bonus: 150, row: 1, col: 8, color: '#d97706' },

  // Top Row: 15 -> 21 (Right to Left) [row 1]
  { index: 15, type: 'PROPERTY', name: 'Công Viên Xanh', group: 'ECO', groupName: 'Sinh Thái', color: '#10b981', price: 280, rent: 60, row: 1, col: 7 },
  { index: 16, type: 'PROPERTY', name: 'Thung Lũng Sinh Thái', group: 'ECO', groupName: 'Sinh Thái', color: '#10b981', price: 300, rent: 65, row: 1, col: 6 },
  { index: 17, type: 'PROPERTY', name: 'Rừng Nguyên Sinh', group: 'ECO', groupName: 'Sinh Thái', color: '#10b981', price: 320, rent: 70, row: 1, col: 5 },
  { index: 18, type: 'EVENT', name: 'Cơ Hội Đầu Tư', label: 'CƠ HỘI', row: 1, col: 4, color: '#9333ea' },
  { index: 19, type: 'PROPERTY', name: 'Tháp Tài Chính', group: 'FINANCE', groupName: 'Tài Chính', color: '#f59e0b', price: 340, rent: 75, row: 1, col: 3 },
  { index: 20, type: 'PROPERTY', name: 'Tòa Nhà Chọc Trời', group: 'FINANCE', groupName: 'Tài Chính', color: '#f59e0b', price: 360, rent: 80, row: 1, col: 2 },
  { index: 21, type: 'TAX', name: 'Thuế Doanh Nghiệp', label: 'THUẾ QUỸ', taxAmount: 100, row: 1, col: 1, color: '#dc2626' },

  // Left Column: 22 -> 27 (Top to Bottom) [col 1]
  { index: 22, type: 'PROPERTY', name: 'Penthouse Hoàng Kim', group: 'FINANCE', groupName: 'Tài Chính', color: '#f59e0b', price: 380, rent: 85, row: 2, col: 1 },
  { index: 23, type: 'PROPERTY', name: 'Quảng Trường TT', group: 'CENTRAL', groupName: 'Trung Tâm', color: '#8b5cf6', price: 400, rent: 90, row: 3, col: 1 },
  { index: 24, type: 'PROPERTY', name: 'Đại Lộ Ngôi Sao', group: 'CENTRAL', groupName: 'Trung Tâm', color: '#8b5cf6', price: 420, rent: 95, row: 4, col: 1 },
  { index: 25, type: 'EVENT', name: 'Sự Kiện Đặc Biệt', label: 'CƠ HỘI', row: 5, col: 1, color: '#9333ea' },
  { index: 26, type: 'PROPERTY', name: 'Tập Đoàn Quốc Tế', group: 'CENTRAL', groupName: 'Trung Tâm', color: '#8b5cf6', price: 450, rent: 110, row: 6, col: 1 },
  { index: 27, type: 'BONUS', name: 'Thưởng Vượt Chỉ Số', label: 'THƯỞNG', bonus: 100, row: 7, col: 1, color: '#d97706' },
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

  // Step-by-step animated position for smooth motion
  const [animatedPositions, setAnimatedPositions] = useState({});
  const currentAnimPositionsRef = useRef({});
  const timersByPlayerRef = useRef({});
  const isMountedRef = useRef(true);
  const prevTargetPositionsRef = useRef({});

  // Cleanup on component mount/unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      Object.values(timersByPlayerRef.current).forEach((timers) => {
        if (Array.isArray(timers)) {
          timers.forEach((t) => clearTimeout(t));
        }
      });
      timersByPlayerRef.current = {};
    };
  }, []);

  // Track position changes to animate tokens step-by-step per player
  useEffect(() => {
    const isReducedMotion =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ||
        document.documentElement?.dataset?.workrankReduceMotion === 'true');

    const activePlayerIds = new Set(players.map((p) => p.id));

    // Cleanup timers and state for players who left the room
    Object.keys(timersByPlayerRef.current).forEach((pId) => {
      if (!activePlayerIds.has(Number(pId)) && !activePlayerIds.has(String(pId))) {
        if (Array.isArray(timersByPlayerRef.current[pId])) {
          timersByPlayerRef.current[pId].forEach((t) => clearTimeout(t));
        }
        delete timersByPlayerRef.current[pId];
        delete currentAnimPositionsRef.current[pId];
        delete prevTargetPositionsRef.current[pId];
      }
    });

    players.forEach((p) => {
      const targetPos = Number(p.position || 0);
      const currentAnimPos = currentAnimPositionsRef.current[p.id] ?? targetPos;
      const prevTarget = prevTargetPositionsRef.current[p.id];

      // Initial position registration for new player
      if (prevTarget === undefined) {
        currentAnimPositionsRef.current[p.id] = targetPos;
        prevTargetPositionsRef.current[p.id] = targetPos;
        if (animatedPositions[p.id] !== targetPos) {
          setAnimatedPositions((prev) => ({ ...prev, [p.id]: targetPos }));
        }
        return;
      }

      // No change in position or already arrived
      if (prevTarget === targetPos && currentAnimPos === targetPos) {
        return;
      }

      prevTargetPositionsRef.current[p.id] = targetPos;

      // Clear only this player's active timeouts without affecting other players
      if (Array.isArray(timersByPlayerRef.current[p.id])) {
        timersByPlayerRef.current[p.id].forEach((t) => clearTimeout(t));
      }
      timersByPlayerRef.current[p.id] = [];

      // If user prefers reduced motion, snap immediately
      if (isReducedMotion) {
        currentAnimPositionsRef.current[p.id] = targetPos;
        if (isMountedRef.current) {
          setAnimatedPositions((prev) => ({ ...prev, [p.id]: targetPos }));
        }
        return;
      }

      // Compute clockwise step path (wrapping at 28)
      let steps = targetPos >= currentAnimPos
        ? targetPos - currentAnimPos
        : 28 - currentAnimPos + targetPos;

      if (steps > 0 && steps <= 12) {
        // Animate step by step (120ms per tile step)
        for (let step = 1; step <= steps; step++) {
          const intermediatePos = (currentAnimPos + step) % 28;
          const t = setTimeout(() => {
            if (!isMountedRef.current) return;
            currentAnimPositionsRef.current[p.id] = intermediatePos;
            setAnimatedPositions((prev) => ({ ...prev, [p.id]: intermediatePos }));
            gameSound.playMove();
          }, step * 120);
          timersByPlayerRef.current[p.id].push(t);
        }
      } else {
        // Step distance exceeds normal roll threshold or large jump -> snap directly
        currentAnimPositionsRef.current[p.id] = targetPos;
        if (isMountedRef.current) {
          setAnimatedPositions((prev) => ({ ...prev, [p.id]: targetPos }));
        }
      }
    });
  }, [players]);

  // Map properties by tileIndex
  const propertyMap = {};
  properties.forEach((p) => {
    propertyMap[p.tileIndex] = p;
  });

  // Map players by their display position (animated or static)
  const playersByTile = {};
  players.forEach((p) => {
    if (p.status !== 'BANKRUPT') {
      const pos = animatedPositions[p.id] ?? (p.position || 0);
      if (!playersByTile[pos]) playersByTile[pos] = [];
      playersByTile[pos].push(p);
    }
  });

  // Current tile of the active player
  const activePlayerPosition = animatedPositions[currentTurnPlayer?.id] ?? (currentTurnPlayer?.position ?? 0);
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
      {/* Sound & Match Info Bar */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
          padding: '4px 8px',
          fontSize: 13,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
          <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Phòng #{room?.code || room?.id}</span>
          <span>•</span>
          <span>Lượt: <strong style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>{room?.turnNumber || room?.turnCount || 1}</strong></span>
        </div>

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
            color: soundMuted ? '#ef4444' : 'var(--text-secondary)',
            border: '1px solid rgba(15,23,42,0.1)',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {soundMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          <span>{soundMuted ? 'Âm thanh: Tắt' : 'Âm thanh: Bật'}</span>
        </button>
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
          background: 'var(--border-2)',
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
                background: 'var(--surface)',
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
                transition: 'border-color var(--motion-fast) var(--ease-standard), box-shadow var(--motion-fast) var(--ease-standard)',
                boxShadow: isSelected ? '0 0 8px rgba(56,189,248,0.4)' : isCurrentActiveTile ? '0 0 8px rgba(245,158,11,0.3)' : 'none',
              }}
            >
              {/* Tile Type Header / Color Stripe */}
              {tile.type === 'PROPERTY' ? (
                <div
                  style={{
                    height: 5,
                    width: '100%',
                    background: tile.color || 'var(--text-muted)',
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
                        background: owner.color || '#38bdf8',
                        border: '1.5px solid var(--surface)',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      }}
                    />
                  )}
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 8,
                    fontWeight: 800,
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
                        ? 'var(--text-secondary)'
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
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  textAlign: 'center',
                  lineHeight: 1.1,
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
                  fontWeight: 800,
                  textAlign: 'center',
                  color: tile.type === 'PROPERTY' ? 'var(--info)' : 'var(--text-secondary)',
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
                        background: p.color || '#38bdf8',
                        border: '1.5px solid var(--surface)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--surface)',
                        fontSize: 8,
                        fontWeight: 900,
                        transform: currentTurnPlayer?.id === p.id ? 'scale(1.15)' : 'scale(1)',
                        transition: 'transform var(--motion-fast) var(--ease-spring)',
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

        {/* Central Console (Rows 2..7, Cols 2..7) */}
        <div
          style={{
            gridRow: '2 / 8',
            gridColumn: '2 / 8',
            background: 'var(--surface)',
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
                  background: currentTurnPlayer?.color || '#38bdf8',
                  boxShadow: '0 0 6px rgba(0,0,0,0.2)',
                }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {isMyTurn ? (
                    <span style={{ color: 'var(--info)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Gamepad2 size={14} /> LƯỢT CỦA BẠN!
                    </span>
                  ) : (
                    <span>Lượt: {currentTurnPlayer?.user?.name || `Người chơi ${Number(currentTurnPlayer?.seatIndex || 0) + 1}`}</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
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
                fontWeight: 900,
                color: turnTimeRemaining <= 5 ? '#ef4444' : 'var(--text-primary)',
                background: turnTimeRemaining <= 5 ? 'rgba(239,68,68,0.15)' : 'var(--surface)',
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
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Đang ở ô: </span>
                <strong style={{ fontSize: 12, color: 'var(--text-primary)' }}>{currentTileOnBoard.name}</strong>
                {currentTileProperty && (
                  <span style={{ fontSize: 11, color: 'var(--info)', marginLeft: 6 }}>
                    (${currentTileProperty.price || currentTileProperty.purchasePrice})
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
                  fontWeight: 700,
                  textAlign: 'center',
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
                      background: 'var(--text-primary)',
                      color: 'var(--surface)',
                      border: 'none',
                      borderRadius: 6,
                      padding: '10px 14px',
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: actionLoading || isRolling ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 12px rgba(15,23,42,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Dice5 size={16} />
                    <span>{isRolling ? 'Đang Tung...' : 'Tung Xúc Xắc'}</span>
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
                          color: 'var(--surface)',
                          border: 'none',
                          borderRadius: 6,
                          padding: '10px 14px',
                          fontSize: 13,
                          fontWeight: 800,
                          cursor: actionLoading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          boxShadow: '0 4px 12px rgba(22,163,74,0.25)',
                        }}
                      >
                        <Building size={14} />
                        <span>Mua (${currentTileProperty.price || currentTileProperty.purchasePrice})</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={onEndTurn}
                      disabled={actionLoading}
                      style={{
                        flex: canBuyCurrentTile ? 0.8 : 1,
                        background: 'var(--surface)',
                        color: 'var(--text-primary)',
                        border: '1.5px solid var(--text-primary)',
                        borderRadius: 6,
                        padding: '10px 14px',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: actionLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                    >
                      <span>{canBuyCurrentTile ? 'Bỏ Qua' : 'Kết Thúc Lượt'}</span>
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
                  color: 'var(--text-secondary)',
                  background: 'rgba(15,23,42,0.03)',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid rgba(15,23,42,0.06)',
                }}
              >
                <Clock size={13} />
                <span>Đang chờ <strong>{currentTurnPlayer?.user?.name || `Người chơi ${Number(currentTurnPlayer?.seatIndex || 0) + 1}`}</strong> thực hiện lượt...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Tile Inspector Modal */}
      {selectedTile && (
        <PropertyDetailModal
          isOpen={Boolean(selectedTile)}
          onClose={() => setSelectedTileIndex(null)}
          tile={selectedTile}
          property={selectedProperty}
          owner={selectedOwner}
          players={players}
        />
      )}
    </div>
  );
}
