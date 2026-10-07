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
  Building2,
  Landmark,
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
  Trees,
  Cpu,
  Bot,
  Ship,
  Crown,
  Tv,
  Mic,
  Coins,
  Compass,
  Radio,
  Mountain,
  Sprout,
  Gem,
  Globe,
  Camera,
  Anchor,
  ShieldCheck,
  Flame,
  ArrowRight,
} from 'lucide-react';
import DiceRoller from './DiceRoller';
import PropertyDetailModal from './PropertyDetailModal';
import gameSound from './gameSound';

// 28 Tiles definitions with exact board layout
export const BOARD_TILES = [
  // Bottom Row: 0 -> 7 (Left to Right) [row 8]
  { index: 0, type: 'START', name: 'Khởi Hành', label: 'START', bonus: 200, row: 8, col: 1, color: '#16a34a', icon: Flag },
  { index: 1, type: 'PROPERTY', name: 'Phòng Livestream', group: 'MEDIA', groupName: 'Media Hub', color: '#f43f5e', price: 100, rent: 15, row: 8, col: 2, icon: Mic, tier: 1 },
  { index: 2, type: 'PROPERTY', name: 'Studio Sáng Tạo', group: 'MEDIA', groupName: 'Media Hub', color: '#f43f5e', price: 120, rent: 20, row: 8, col: 3, icon: Camera, tier: 1 },
  { index: 3, type: 'PROPERTY', name: 'Đài Truyền Thông', group: 'MEDIA', groupName: 'Media Hub', color: '#f43f5e', price: 140, rent: 25, row: 8, col: 4, icon: Tv, tier: 2 },
  { index: 4, type: 'EVENT', name: 'Cơ Hội Bứt Phá', label: 'CƠ HỘI', row: 8, col: 5, color: '#9333ea', icon: Sparkles },
  { index: 5, type: 'PROPERTY', name: 'Trung Tâm Dữ Liệu', group: 'TECH', groupName: 'Công Nghệ', color: '#06b6d4', price: 160, rent: 30, row: 8, col: 6, icon: Cpu, tier: 2 },
  { index: 6, type: 'PROPERTY', name: 'Phòng Nghiên Cứu AI', group: 'TECH', groupName: 'Công Nghệ', color: '#06b6d4', price: 180, rent: 35, row: 8, col: 7, icon: Bot, tier: 2 },
  { index: 7, type: 'REST', name: 'Khu Nghỉ Dưỡng', label: 'NGHỈ DƯỠNG', row: 8, col: 8, color: '#64748b', icon: Coffee },

  // Right Column: 8 -> 14 (Bottom to Top) [col 8]
  { index: 8, type: 'PROPERTY', name: 'Trụ Sở Cloud Core', group: 'TECH', groupName: 'Công Nghệ', color: '#06b6d4', price: 200, rent: 40, row: 7, col: 8, icon: Globe, tier: 2 },
  { index: 9, type: 'PROPERTY', name: 'Cảng Logistics', group: 'LOGISTICS', groupName: 'Hậu Cần', color: '#3b82f6', price: 220, rent: 45, row: 6, col: 8, icon: Ship, tier: 2 },
  { index: 10, type: 'PROPERTY', name: 'Bến Du Thuyền', group: 'LOGISTICS', groupName: 'Hậu Cần', color: '#3b82f6', price: 240, rent: 50, row: 5, col: 8, icon: Compass, tier: 2 },
  { index: 11, type: 'TAX', name: 'Phí Hạ Tầng', label: 'PHÍ DỊCH VỤ', taxAmount: 80, row: 4, col: 8, color: '#ea580c', icon: CreditCard },
  { index: 12, type: 'PROPERTY', name: 'Đảo Hải Đăng', group: 'LOGISTICS', groupName: 'Hậu Cần', color: '#3b82f6', price: 260, rent: 55, row: 3, col: 8, icon: Anchor, tier: 2 },
  { index: 13, type: 'EVENT', name: 'Vận May Khởi Nghiệp', label: 'CƠ HỘI', row: 2, col: 8, color: '#9333ea', icon: Zap },
  { index: 14, type: 'BONUS', name: 'Kho Báu Doanh Nghiệp', label: 'KHO BÁU', bonus: 150, row: 1, col: 8, color: '#d97706', icon: Gift },

  // Top Row: 15 -> 21 (Right to Left) [row 1]
  { index: 15, type: 'PROPERTY', name: 'Công Viên Xanh', group: 'ECO', groupName: 'Sinh Thái', color: '#10b981', price: 280, rent: 60, row: 1, col: 7, icon: Trees, tier: 2 },
  { index: 16, type: 'PROPERTY', name: 'Thung Lũng Sinh Thái', group: 'ECO', groupName: 'Sinh Thái', color: '#10b981', price: 300, rent: 65, row: 1, col: 6, icon: Mountain, tier: 3 },
  { index: 17, type: 'PROPERTY', name: 'Rừng Nguyên Sinh', group: 'ECO', groupName: 'Sinh Thái', color: '#10b981', price: 320, rent: 70, row: 1, col: 5, icon: Sprout, tier: 3 },
  { index: 18, type: 'EVENT', name: 'Cơ Hội Đầu Tư', label: 'CƠ HỘI', row: 1, col: 4, color: '#9333ea', icon: Sparkles },
  { index: 19, type: 'PROPERTY', name: 'Tháp Tài Chính', group: 'FINANCE', groupName: 'Tài Chính', color: '#f59e0b', price: 340, rent: 75, row: 1, col: 3, icon: Landmark, tier: 3 },
  { index: 20, type: 'PROPERTY', name: 'Tòa Nhà Chọc Trời', group: 'FINANCE', groupName: 'Tài Chính', color: '#f59e0b', price: 360, rent: 80, row: 1, col: 2, icon: Building2, tier: 3 },
  { index: 21, type: 'TAX', name: 'Thuế Doanh Nghiệp', label: 'THUẾ QUỸ', taxAmount: 100, row: 1, col: 1, color: '#dc2626', icon: ShieldAlert },

  // Left Column: 22 -> 27 (Top to Bottom) [col 1]
  { index: 22, type: 'PROPERTY', name: 'Penthouse Hoàng Kim', group: 'FINANCE', groupName: 'Tài Chính', color: '#f59e0b', price: 380, rent: 85, row: 2, col: 1, icon: Gem, tier: 3 },
  { index: 23, type: 'PROPERTY', name: 'Quảng Trường TT', group: 'CENTRAL', groupName: 'Trung Tâm', color: '#8b5cf6', price: 400, rent: 90, row: 3, col: 1, icon: Crown, tier: 4 },
  { index: 24, type: 'PROPERTY', name: 'Đại Lộ Ngôi Sao', group: 'CENTRAL', groupName: 'Trung Tâm', color: '#8b5cf6', price: 420, rent: 95, row: 4, col: 1, icon: Sparkles, tier: 4 },
  { index: 25, type: 'EVENT', name: 'Sự Kiện Đặc Biệt', label: 'CƠ HỘI', row: 5, col: 1, color: '#9333ea', icon: Zap },
  { index: 26, type: 'PROPERTY', name: 'Tập Đoàn Quốc Tế', group: 'CENTRAL', groupName: 'Trung Tâm', color: '#8b5cf6', price: 450, rent: 110, row: 6, col: 1, icon: Building, tier: 4 },
  { index: 27, type: 'BONUS', name: 'Thưởng Vượt Chỉ Số', label: 'THƯỞNG', bonus: 100, row: 7, col: 1, color: '#d97706', icon: Trophy },
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
        maxWidth: 860,
        margin: '0 auto',
        userSelect: 'none',
      }}
    >
      {/* Top Header Match & Sound Bar */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
          padding: '4px 10px',
          fontSize: 13,
          background: 'rgba(15,23,42,0.03)',
          borderRadius: 8,
          border: '1px solid rgba(15,23,42,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
          <span style={{ fontWeight: 900, color: 'var(--text-primary)' }}>Phòng #{room?.code || room?.id}</span>
          <span>•</span>
          <span>
            Lượt: <strong style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>{room?.turnNumber || room?.turnCount || 1}</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={toggleSound}
          title={soundMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 10px',
            background: soundMuted ? 'rgba(239,68,68,0.1)' : 'var(--surface)',
            color: soundMuted ? '#ef4444' : 'var(--text-secondary)',
            border: '1px solid rgba(15,23,42,0.1)',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            transition: 'all var(--motion-fast) var(--ease-standard)',
          }}
        >
          {soundMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          <span>{soundMuted ? 'Âm thanh: Tắt' : 'Âm thanh: Bật'}</span>
        </button>
      </div>

      {/* Main 2D Board Container (8x8 Grid with Outer Bezel Frame) */}
      <div className="board-mat-frame">
        {/* 28 Perimeter Board Tiles */}
        {BOARD_TILES.map((tile) => {
          const prop = propertyMap[tile.index];
          const ownerUserId = prop?.ownerUserId || prop?.ownerId;
          const owner = ownerUserId ? players.find((p) => Number(p.userId) === Number(ownerUserId)) : null;
          const playersHere = playersByTile[tile.index] || [];
          const isSelected = selectedTileIndex === tile.index;
          const isCurrentActiveTile = activePlayerPosition === tile.index;
          const TileIcon = tile.icon || Building;
          const isCorner = tile.type === 'START' || tile.type === 'REST' || tile.type === 'BONUS' || tile.type === 'TAX';

          return (
            <div
              key={tile.index}
              onClick={() => setSelectedTileIndex(tile.index)}
              className={`board-tile-card ${isCorner ? 'is-corner' : ''} ${isSelected ? 'is-selected' : ''} ${isCurrentActiveTile ? 'is-active-landed' : ''}`}
              style={{
                gridRow: tile.row,
                gridColumn: tile.col,
              }}
            >
              {/* Top Color Band / Strip for Properties or Badge for Specials */}
              {tile.type === 'PROPERTY' ? (
                <div
                  style={{
                    height: 8,
                    width: '100%',
                    background: `linear-gradient(135deg, ${tile.color || '#ec4899'} 0%, ${tile.color || '#ec4899'}dd 100%)`,
                    borderRadius: 3,
                    position: 'relative',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
                    marginBottom: 2,
                  }}
                >
                  {owner && (
                    <div
                      title={`Đã mua bởi: ${owner.user?.name || `Người chơi ${owner.seatIndex + 1}`}`}
                      style={{
                        position: 'absolute',
                        top: -3,
                        right: 2,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: owner.color || '#38bdf8',
                        border: '1.5px solid #ffffff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                      }}
                    />
                  )}
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 8.5,
                    fontWeight: 900,
                    textAlign: 'center',
                    padding: '1.5px 0',
                    background:
                      tile.type === 'START'
                        ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
                        : tile.type === 'REST'
                        ? 'linear-gradient(135deg, #64748b 0%, #475569 100%)'
                        : tile.type === 'BONUS'
                        ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
                        : tile.type === 'TAX'
                        ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                        : 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)',
                    color: '#ffffff',
                    borderRadius: 3,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                    marginBottom: 2,
                  }}
                >
                  {tile.label || tile.type}
                </div>
              )}

              {/* Tile Center Visual: 2D Building / Icon Illustration */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  padding: '1px 0',
                  flex: 1,
                  minHeight: 0,
                }}
              >
                {owner ? (
                  /* Owned Property 2D House Token Visual */
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      background: `${owner.color || '#38bdf8'}18`,
                      border: `1px solid ${owner.color || '#38bdf8'}55`,
                      borderRadius: 4,
                      padding: '1px 3px',
                    }}
                  >
                    <span style={{ fontSize: 13, lineHeight: 1 }}>🏠</span>
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 900,
                        color: owner.color || '#38bdf8',
                        textTransform: 'uppercase',
                      }}
                    >
                      P{owner.seatIndex + 1}
                    </span>
                  </div>
                ) : (
                  /* Standard Thematic Icon */
                  <div
                    style={{
                      color: tile.type === 'PROPERTY' ? tile.color : tile.type === 'START' ? '#16a34a' : tile.type === 'TAX' ? '#dc2626' : tile.type === 'BONUS' ? '#d97706' : '#9333ea',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.9,
                    }}
                  >
                    <TileIcon size={isCorner ? 20 : 16} />
                  </div>
                )}

                {/* Tile Name / Title */}
                <div
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: 'var(--text-primary)',
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
              </div>

              {/* Price / Subtext Tag */}
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  textAlign: 'center',
                  color: owner
                    ? '#16a34a'
                    : tile.type === 'PROPERTY'
                    ? 'var(--info)'
                    : tile.type === 'TAX'
                    ? '#dc2626'
                    : tile.type === 'START' || tile.type === 'BONUS'
                    ? '#d97706'
                    : 'var(--text-secondary)',
                  fontFamily: 'JetBrains Mono, monospace',
                  background: 'rgba(15,23,42,0.04)',
                  borderRadius: 3,
                  padding: '1px 0',
                }}
              >
                {owner
                  ? `Thuê $${prop?.rent || tile.rent}`
                  : tile.type === 'PROPERTY'
                  ? `$${tile.price}`
                  : tile.type === 'TAX'
                  ? `-$${tile.taxAmount}`
                  : tile.type === 'START' || tile.type === 'BONUS'
                  ? `+$${tile.bonus}`
                  : 'Cơ hội'}
              </div>

              {/* Player Tokens On Tile (Offset 2x2 Layout to Avoid Complete Overlap) */}
              {playersHere.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: 2,
                    right: 2,
                    bottom: 2,
                    pointerEvents: 'none',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gridTemplateRows: '1fr 1fr',
                    padding: 2,
                    alignItems: 'center',
                    justifyItems: 'center',
                    zIndex: 20,
                  }}
                >
                  {playersHere.map((p, idx) => {
                    const isTurnP = currentTurnPlayer?.id === p.id;
                    const avatarUrl = p.user?.avatarUrl || p.user?.avatarData;
                    const initial = p.user?.name?.charAt(0)?.toUpperCase() || String(p.seatIndex + 1);

                    return (
                      <div
                        key={p.id}
                        title={`${p.user?.name || 'Người chơi'} (Vị trí P${p.seatIndex + 1})`}
                        className={`token-pawn-badge ${isTurnP ? 'is-current-turn' : ''}`}
                        style={{
                          background: `linear-gradient(135deg, ${p.color || '#38bdf8'} 0%, ${p.color || '#38bdf8'}cc 100%)`,
                          pointerEvents: 'auto',
                        }}
                      >
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={p.user?.name || 'Player'}
                            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          initial
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Central Console Stage (Rows 2..7, Cols 2..7) */}
        <div className="board-center-stage">
          {/* Top Banner: Active Turn Announcement & Timer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: isMyTurn
                ? 'linear-gradient(135deg, rgba(56,189,248,0.18) 0%, rgba(37,99,235,0.08) 100%)'
                : 'rgba(15,23,42,0.03)',
              border: isMyTurn ? '2px solid #38bdf8' : '1px solid rgba(15,23,42,0.1)',
              padding: '8px 14px',
              borderRadius: 10,
              boxShadow: isMyTurn ? '0 0 16px rgba(56,189,248,0.25)' : 'none',
              transition: 'all var(--motion-fast) var(--ease-spring)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: currentTurnPlayer?.color || '#38bdf8',
                  boxShadow: '0 0 8px rgba(0,0,0,0.3)',
                  border: '2px solid #ffffff',
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-primary)' }}>
                  {isMyTurn ? (
                    <span style={{ color: 'var(--info)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Flame size={16} color="#f59e0b" /> LƯỢT CỦA BẠN!
                    </span>
                  ) : (
                    <span>
                      Lượt của: <strong>{currentTurnPlayer?.user?.name || `Người chơi ${Number(currentTurnPlayer?.seatIndex || 0) + 1}`}</strong>
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  {turnPhase === 'ROLL_DICE' && '🎲 Hãy gieo xúc xắc để di chuyển...'}
                  {turnPhase === 'ACTION_PENDING' && '⚡ Đang lựa chọn mua đất hoặc chuyển lượt...'}
                  {turnPhase === 'TURN_DONE' && 'Đang chuyển lượt tiếp theo...'}
                </div>
              </div>
            </div>

            {/* Turn Countdown Digital Seconds Badge */}
            <div
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 16,
                fontWeight: 900,
                color: turnTimeRemaining <= 5 ? '#ef4444' : 'var(--text-primary)',
                background: turnTimeRemaining <= 5 ? 'rgba(239,68,68,0.15)' : 'var(--surface)',
                border: turnTimeRemaining <= 5 ? '1.5px solid #ef4444' : '1px solid rgba(15,23,42,0.12)',
                padding: '4px 10px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              }}
            >
              <Clock size={13} />
              <span>{turnTimeRemaining}s</span>
            </div>
          </div>

          {/* Center Stage: 3D-styled 2D Dice Roller & Landed Tile Card Preview */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '10px 0',
              flex: 1,
            }}
          >
            {/* Dice Roller */}
            <DiceRoller dice={lastDice} isRolling={isRolling} lastSum={lastSum} />

            {/* Landed Tile Card HUD */}
            {currentTileOnBoard && (
              <div
                style={{
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, rgba(15,23,42,0.03) 0%, rgba(15,23,42,0.01) 100%)',
                  border: '1.5px dashed rgba(15,23,42,0.15)',
                  padding: '8px 16px',
                  borderRadius: 10,
                  maxWidth: '92%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Vị trí hiện tại:</span>
                <strong style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{currentTileOnBoard.name}</strong>
                {currentTileProperty && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: currentTileProperty.ownerUserId ? '#16a34a' : 'var(--info)',
                      background: 'rgba(15,23,42,0.05)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    {currentTileProperty.ownerUserId ? `Đã có chủ (Thuê $${currentTileProperty.rent})` : `Giá mua: $${currentTileProperty.price || currentTileProperty.purchasePrice}`}
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
                  gap: 6,
                  background: 'rgba(168,85,247,0.1)',
                  border: '1px solid rgba(168,85,247,0.35)',
                  color: '#7e22ce',
                  padding: '5px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 800,
                  textAlign: 'center',
                  maxWidth: '95%',
                }}
              >
                <Zap size={14} color="#9333ea" />
                <span>{recentEvent}</span>
              </div>
            )}
          </div>

          {/* Bottom Interactive Arcade Action Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {isMyTurn ? (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                {turnPhase === 'ROLL_DICE' && (
                  <button
                    type="button"
                    onClick={onRollDice}
                    disabled={actionLoading || isRolling}
                    className="game-btn-roll"
                    style={{
                      flex: 1,
                      padding: '12px 20px',
                      fontSize: 15,
                    }}
                  >
                    <Dice5 size={18} />
                    <span>{isRolling ? 'Đang Tung Xúc Xắc...' : 'TUNG XÚC XẮC'}</span>
                  </button>
                )}

                {turnPhase === 'ACTION_PENDING' && (
                  <>
                    {canBuyCurrentTile && (
                      <button
                        type="button"
                        onClick={onBuyProperty}
                        disabled={actionLoading}
                        className="game-btn-buy"
                        style={{
                          flex: 1.2,
                          padding: '12px 18px',
                          fontSize: 14,
                        }}
                      >
                        <Building size={16} />
                        <span>Mua Bất Động Sản (${currentTileProperty.price || currentTileProperty.purchasePrice})</span>
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
                        border: '2px solid var(--text-primary)',
                        borderRadius: 8,
                        padding: '12px 18px',
                        fontSize: 14,
                        fontWeight: 900,
                        cursor: actionLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        boxShadow: '0 2px 8px rgba(15,23,42,0.08)',
                        transition: 'all var(--motion-fast) var(--ease-spring)',
                      }}
                    >
                      <span>{canBuyCurrentTile ? 'Bỏ Qua' : 'Kết Thúc Lượt'}</span>
                      <ChevronRight size={16} />
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
                  gap: 8,
                  textAlign: 'center',
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  background: 'rgba(15,23,42,0.03)',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(15,23,42,0.08)',
                }}
              >
                <Clock size={15} />
                <span>
                  Đang chờ <strong>{currentTurnPlayer?.user?.name || `Người chơi ${Number(currentTurnPlayer?.seatIndex || 0) + 1}`}</strong> hoàn tất lượt...
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Tile Inspector Deed Modal */}
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
