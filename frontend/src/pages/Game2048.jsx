import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { game2048 } from '../services/api';
import {
  createInitialTileState,
  moveTileState,
  cleanupDisappearingTiles,
  tilesToMatrix,
  getMaxTileFromTiles,
} from '../utils/game2048Engine';
import DefaultAvatar from '../components/DefaultAvatar';
import JobTitleBadge from '../components/JobTitleBadge';
import GameFullscreenShell from '../components/game/GameFullscreenShell';
import {
  Trophy,
  RotateCcw,
  ArrowLeft,
  Crown,
  Medal,
  Gamepad2,
  HelpCircle,
  RefreshCw,
  Sparkles,
  LayoutGrid,
} from 'lucide-react';

const TILE_STYLES = {
  2: { bg: '#ffffff', text: '#141414', border: '1px solid rgba(0,0,0,0.08)', shadow: '0 1px 3px rgba(0,0,0,0.04)' },
  4: { bg: '#fbf9f5', text: '#141414', border: '1px solid rgba(0,0,0,0.1)', shadow: '0 1px 3px rgba(0,0,0,0.05)' },
  8: { bg: '#fef3c7', text: '#92400e', border: '1px solid #fde68a', shadow: '0 2px 4px rgba(180,83,9,0.08)' },
  16: { bg: '#fed7aa', text: '#9a3412', border: '1px solid #fdba74', shadow: '0 2px 6px rgba(234,88,12,0.1)' },
  32: { bg: '#fb923c', text: '#ffffff', border: '1px solid #f97316', shadow: '0 2px 8px rgba(234,88,12,0.15)' },
  64: { bg: '#ea580c', text: '#ffffff', border: '1px solid #c2410c', shadow: '0 2px 10px rgba(194,65,12,0.2)' },
  128: { bg: '#d97706', text: '#ffffff', border: '1px solid #b45309', shadow: '0 3px 12px rgba(180,83,9,0.25)' },
  256: { bg: '#b45309', text: '#ffffff', border: '1px solid #92400e', shadow: '0 4px 14px rgba(180,83,9,0.3)' },
  512: { bg: '#78350f', text: '#fef3c7', border: '1px solid #92400e', shadow: '0 4px 16px rgba(120,53,15,0.35)' },
  1024: { bg: '#292524', text: '#fbbf24', border: '1.5px solid #b45309', shadow: '0 4px 18px rgba(0,0,0,0.25)' },
  2048: { bg: '#141414', text: '#f59e0b', border: '2px solid #b45309', shadow: '0 4px 20px rgba(180,83,9,0.3)' },
  4096: { bg: '#0a0a0a', text: '#fde047', border: '2px solid #ffffff', shadow: '0 4px 24px rgba(0,0,0,0.45)' },
};

function getTileFontSize(value) {
  const str = String(value);
  if (str.length <= 2) return 'clamp(24px, 5.2vw, 36px)';
  if (str.length === 3) return 'clamp(18px, 4.0vw, 26px)';
  if (str.length === 4) return 'clamp(14px, 3.2vw, 20px)';
  return 'clamp(11px, 2.6vw, 16px)';
}

export default function Game2048() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Animated Tile State
  const [tiles, setTiles] = useState(() => createInitialTileState());
  const [score, setScore] = useState(0);
  const [lastScoreGain, setLastScoreGain] = useState(null);
  const [moves, setMoves] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [keepPlaying, setKeepPlaying] = useState(false);
  const [gameSessionId, setGameSessionId] = useState(null);

  // Leaderboard & Personal stats state
  const [bestScore, setBestScore] = useState(0);
  const [myRank, setMyRank] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // References for touch and timeouts
  const touchStartRef = useRef({ x: 0, y: 0 });
  const cleanupTimerRef = useRef(null);

  // Start new session from backend
  const initNewSession = useCallback(async () => {
    try {
      const res = await game2048.startSession();
      if (res?.gameSessionId) {
        setGameSessionId(res.gameSessionId);
      }
    } catch (err) {
      console.error('Failed to start 2048 session:', err);
    }
  }, []);

  // Fetch leaderboard & personal stats
  const fetchLeaderboardData = useCallback(async () => {
    try {
      setLeaderboardLoading(true);
      const res = await game2048.getLeaderboard({ limit: 50 });
      if (res) {
        setLeaderboard(Array.isArray(res.data) ? res.data : []);
        if (res.myStats) {
          setBestScore(res.myStats.bestScore || 0);
          setMyRank(res.myStats.rank);
        }
      }
    } catch (err) {
      console.error('Failed to fetch 2048 leaderboard:', err);
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    initNewSession();
    fetchLeaderboardData();
    return () => {
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
    };
  }, [initNewSession, fetchLeaderboardData]);

  // Restart game
  const handleRestart = useCallback(() => {
    if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
    setTiles(createInitialTileState());
    setScore(0);
    setLastScoreGain(null);
    setMoves(0);
    setGameOver(false);
    setHasWon(false);
    setKeepPlaying(false);
    setSubmitted(false);
    initNewSession();
  }, [initNewSession]);

  // Submit score to backend when game over
  const handleSubmitScore = useCallback(
    async (finalScore, finalMatrix, finalMoves, currentSessionId) => {
      if (!currentSessionId || submitted || finalScore <= 0) return;
      setSubmitted(true);

      const maxTile = getMaxTileFromTiles(tiles);
      try {
        const res = await game2048.submitScore({
          score: finalScore,
          maxTile,
          moves: finalMoves,
          gameSessionId: currentSessionId,
          playedAt: new Date().toISOString(),
        });

        if (res?.bestScore !== undefined) {
          setBestScore(res.bestScore);
        }
        fetchLeaderboardData();
      } catch (err) {
        console.error('Failed to submit 2048 score:', err);
      }
    },
    [submitted, tiles, fetchLeaderboardData]
  );

  // Trigger move in a given direction
  const handleMove = useCallback(
    (direction) => {
      if (gameOver) return;

      const result = moveTileState(tiles, direction);
      if (result.moved) {
        const newScore = score + result.scoreEarned;
        const newMoves = moves + 1;

        if (result.scoreEarned > 0) {
          setLastScoreGain({ amount: result.scoreEarned, id: Date.now() });
        }

        setTiles(result.tiles);
        setScore(newScore);
        setMoves(newMoves);

        if (newScore > bestScore) {
          setBestScore(newScore);
        }

        if (result.hasWon && !keepPlaying) {
          setHasWon(true);
        }

        // Clean up disappearing/merged tiles after the 130ms slide transition finishes
        if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = setTimeout(() => {
          setTiles((prev) => cleanupDisappearingTiles(prev));
        }, 130);

        if (result.gameOver) {
          setGameOver(true);
          handleSubmitScore(newScore, result.matrix, newMoves, gameSessionId);
        }
      }
    },
    [tiles, score, moves, bestScore, gameOver, keepPlaying, gameSessionId, handleSubmitScore]
  );

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      if (['ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        handleMove('UP');
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        handleMove('DOWN');
      } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        e.preventDefault();
        handleMove('LEFT');
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        handleMove('RIGHT');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMove]);

  // Touch controls for mobile swipe with strict swipe threshold
  const handleTouchStart = (e) => {
    if (e.touches && e.touches[0]) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  };

  const handleTouchEnd = (e) => {
    if (!e.changedTouches || !e.changedTouches[0]) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - touchStartRef.current.x;
    const diffY = endY - touchStartRef.current.y;

    const minSwipeDistance = 35;
    if (Math.max(Math.abs(diffX), Math.abs(diffY)) < minSwipeDistance) return;

    if (Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) handleMove('RIGHT');
      else handleMove('LEFT');
    } else {
      if (diffY > 0) handleMove('DOWN');
      else handleMove('UP');
    }
  };

  const currentMaxTile = getMaxTileFromTiles(tiles);

  return (
    <GameFullscreenShell
      title="2048"
      icon={LayoutGrid}
      badge="Ghép số"
      exitLabel="Thoát"
      exitTo="/arena"
      onExit={() => navigate('/arena')}
      actions={
        <button
          type="button"
          onClick={handleRestart}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: '#141414',
            color: '#ffffff',
            border: 'none',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'opacity 0.15s ease',
          }}
          title="Chơi lại ván mới"
        >
          <RotateCcw size={13} />
          <span>Ván mới</span>
        </button>
      }
    >
      {/* MAIN WORKSPACE */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          gap: 'clamp(16px, 3vw, 32px)',
          padding: 'clamp(16px, 3vw, 28px) clamp(16px, 4vw, 32px)',
          maxWidth: 1180,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          flexWrap: 'wrap',
        }}
      >
        {/* LEFT COLUMN: 2048 Game Board & Controls */}
        <div
          style={{
            flex: '1 1 380px',
            maxWidth: 480,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            width: '100%',
          }}
        >
          {/* Header Row: Title & Score Panels */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            {/* Title with sharp typography */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontFamily: "var(--font-sans, 'Space Grotesk', -apple-system, sans-serif)",
                    fontSize: 'clamp(34px, 6vw, 44px)',
                    fontWeight: 700,
                    lineHeight: 1,
                    letterSpacing: '-1.5px',
                    color: '#111111',
                  }}
                >
                  2048
                </span>
                <Sparkles size={20} color="#b45309" style={{ marginBottom: 10 }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#777777', letterSpacing: '0.3px', marginTop: 2 }}>
                Ghép số. Tư duy. Chinh phục ô 2048.
              </div>
            </div>

            {/* Score Area (Rectangular panels with subtle borders) */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* Current Score Panel */}
              <div
                style={{
                  position: 'relative',
                  background: '#ffffff',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                  borderRadius: 6,
                  padding: '6px 14px',
                  textAlign: 'center',
                  minWidth: 70,
                }}
              >
                <div style={{ fontSize: 9, fontWeight: 600, color: '#777777', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                  ĐIỂM
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#141414', fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>
                  {score.toLocaleString()}
                </div>
                {lastScoreGain && (
                  <span key={lastScoreGain.id} className="wr-2048-score-gain">
                    +{lastScoreGain.amount}
                  </span>
                )}
              </div>

              {/* Best Score Panel */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                  borderRadius: 6,
                  padding: '6px 14px',
                  textAlign: 'center',
                  minWidth: 70,
                }}
              >
                <div style={{ fontSize: 9, fontWeight: 600, color: '#777777', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                  KỶ LỤC
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#b45309', fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>
                  {bestScore.toLocaleString()}
                </div>
              </div>

              {/* Company Rank Panel */}
              <div
                style={{
                  background: 'rgba(180, 83, 9, 0.08)',
                  border: '1px solid rgba(180, 83, 9, 0.25)',
                  borderRadius: 6,
                  padding: '6px 12px',
                  textAlign: 'center',
                  minWidth: 50,
                }}
              >
                <div style={{ fontSize: 9, fontWeight: 600, color: '#b45309', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                  HẠNG
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#b45309', fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>
                  {myRank ? `#${myRank}` : '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '2px 0',
            }}
          >
            <div style={{ fontSize: 12, color: '#555555', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Nước đi: <strong style={{ color: '#111111' }}>{moves}</strong></span>
              <span style={{ color: 'rgba(0,0,0,0.2)' }}>•</span>
              <span>Ô cao nhất: <strong style={{ color: '#b45309' }}>{currentMaxTile}</strong></span>
            </div>

            <button
              type="button"
              onClick={handleRestart}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                background: '#141414',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
                transition: 'transform 0.1s ease, background 0.15s ease',
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'none')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
            >
              <RotateCcw size={13} />
              <span>Chơi lại</span>
            </button>
          </div>

          {/* 4x4 PHYSICAL GAME BOARD WITH SLIDE & MERGE ANIMATION */}
          <div
            className="wr-2048-board-container"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{ '--wr-2048-gap': 'clamp(6px, 1.8vw, 12px)' }}
          >
            {/* Background 4x4 Empty Cell Slots */}
            <div className="wr-2048-grid-bg">
              {Array.from({ length: 16 }).map((_, idx) => (
                <div key={idx} className="wr-2048-cell-slot" />
              ))}
            </div>

            {/* Foreground Moving & Merging Tiles Layer */}
            <div className="wr-2048-tile-layer">
              {tiles.map((t) => {
                const styleConfig = TILE_STYLES[t.value] || {
                  bg: t.value > 2048 ? '#0a0a0a' : '#eceae4',
                  text: '#111111',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                };

                const transformStr = `translate3d(calc(${t.col} * (100% + var(--wr-2048-gap, 10px))), calc(${t.row} * (100% + var(--wr-2048-gap, 10px))), 0)`;

                let tileClass = 'wr-2048-tile';
                if (t.isDisappearing) tileClass += ' is-disappearing';
                else if (t.isMerged) tileClass += ' is-merged';
                else if (t.isNew) tileClass += ' is-new';

                return (
                  <div
                    key={t.id}
                    className={tileClass}
                    style={{
                      background: styleConfig.bg,
                      color: styleConfig.text,
                      border: styleConfig.border || 'none',
                      boxShadow: styleConfig.shadow || 'none',
                      fontSize: getTileFontSize(t.value),
                      transform: transformStr,
                      '--wr-tile-transform': transformStr,
                    }}
                  >
                    {t.value}
                  </div>
                );
              })}
            </div>

            {/* GAME OVER OVERLAY (Clean Warm Editorial) */}
            {gameOver && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(244, 243, 239, 0.94)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 20,
                  zIndex: 30,
                  textAlign: 'center',
                  animation: 'fadeIn 0.2s ease',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: '#b91c1c', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  HẾT NƯỚC ĐI
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#111111', margin: '4px 0 14px' }}>
                  Ván Đấu Kết Thúc
                </div>

                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.06)',
                    borderRadius: 6,
                    padding: '12px 24px',
                    marginBottom: 18,
                    display: 'flex',
                    gap: 20,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10, color: '#777777', fontWeight: 600 }}>ĐIỂM ĐẠT ĐƯỢC</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#141414', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                      {score.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ width: 1, background: 'rgba(0, 0, 0, 0.08)' }} />
                  <div>
                    <div style={{ fontSize: 10, color: '#777777', fontWeight: 600 }}>KỶ LỤC CỦA BẠN</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#b45309', fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                      {bestScore.toLocaleString()}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRestart}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 22px',
                    background: '#141414',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
                    transition: 'transform 0.1s ease',
                  }}
                >
                  <RotateCcw size={15} />
                  <span>Chơi Lại Ván Mới</span>
                </button>
              </div>
            )}

            {/* 2048 ACHIEVED WIN OVERLAY */}
            {hasWon && !keepPlaying && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(244, 243, 239, 0.94)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 20,
                  zIndex: 30,
                  textAlign: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#b45309', marginBottom: 4 }}>
                  <Crown size={20} />
                  <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.5px' }}>CHIẾN THẮNG!</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#111111', marginBottom: 6 }}>
                  Đạt Được Ô 2048!
                </div>
                <p style={{ fontSize: 12, color: '#555555', margin: '0 0 16px', maxWidth: 280, lineHeight: 1.4 }}>
                  Bạn đã xuất sắc tạo được ô 2048. Bạn có thể tiếp tục chơi để đạt điểm số cao hơn!
                </p>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setKeepPlaying(true)}
                    style={{
                      padding: '9px 18px',
                      background: '#141414',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    }}
                  >
                    Tiếp Tục Chơi
                  </button>
                  <button
                    type="button"
                    onClick={handleRestart}
                    style={{
                      padding: '9px 16px',
                      background: '#ffffff',
                      border: '1px solid rgba(0, 0, 0, 0.15)',
                      color: '#111111',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Ván Mới
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* How to play hint (Structural rectangular card) */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: 6,
              padding: '12px 14px',
              fontSize: 12,
              color: '#555555',
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <HelpCircle size={15} color="#b45309" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <strong style={{ color: '#111111' }}>Cách chơi: </strong>
              Sử dụng các phím mũi tên (↑ ↓ ← →) hoặc vuốt trên màn hình cảm ứng để di chuyển. Hai ô có cùng số khi chạm vào nhau sẽ trượt và hợp nhất thành một ô có giá trị gấp đôi!
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Company-Wide Leaderboard */}
        <div
          style={{
            flex: '1 1 380px',
            maxWidth: 500,
            background: '#ffffff',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            borderRadius: 6,
            padding: '18px 20px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
              paddingBottom: 12,
              borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trophy size={17} color="#b45309" />
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111111', letterSpacing: '0.4px' }}>
                BXH 2048 TOÀN CÔNG TY
              </h2>
            </div>

            <button
              type="button"
              onClick={fetchLeaderboardData}
              disabled={leaderboardLoading}
              title="Làm mới bảng xếp hạng"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#777777',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 4,
              }}
            >
              <RefreshCw size={14} className={leaderboardLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Current User Standing Banner */}
          {user && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 6,
                background: 'rgba(180, 83, 9, 0.06)',
                border: '1px solid rgba(180, 83, 9, 0.2)',
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DefaultAvatar src={user.avatarUrl || user.avatarData} name={user.name || user.email} userId={user.id} size={26} shape="circle" />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#111111' }}>
                  Vị trí của bạn:
                </span>
                <strong style={{ color: '#b45309', fontSize: 12 }}>
                  {myRank ? `Hạng #${myRank}` : 'Chưa xếp hạng'}
                </strong>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: '#b45309', fontFamily: "'JetBrains Mono', monospace" }}>
                {bestScore.toLocaleString()} pts
              </div>
            </div>
          )}

          {/* Leaderboard Table */}
          <div style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
            {leaderboard.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: '#777777', fontSize: 13 }}>
                Chưa có kỷ lục nào được ghi nhận. Hãy là người đầu tiên ghi điểm!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {leaderboard.map((player) => {
                  const isMe = Number(player.userId) === Number(user?.id);
                  const isTop1 = player.rank === 1;
                  const isTop2 = player.rank === 2;
                  const isTop3 = player.rank === 3;

                  return (
                    <div
                      key={player.userId || player.rank}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: isMe
                          ? 'rgba(180, 83, 9, 0.08)'
                          : isTop1
                          ? 'rgba(180, 83, 9, 0.04)'
                          : '#faf9f6',
                        border: isMe
                          ? '1.5px solid rgba(180, 83, 9, 0.35)'
                          : isTop1
                          ? '1px solid rgba(180, 83, 9, 0.2)'
                          : '1px solid rgba(0, 0, 0, 0.05)',
                      }}
                    >
                      {/* Left: Rank + Avatar + Name + JobTitle */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <div
                          style={{
                            width: 22,
                            textAlign: 'center',
                            fontWeight: 700,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 12,
                            color: isTop1 ? '#b45309' : isTop2 ? '#78716c' : isTop3 ? '#a8a29e' : '#777777',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {isTop1 ? (
                            <Crown size={14} color="#b45309" />
                          ) : isTop2 ? (
                            <Medal size={14} color="#78716c" />
                          ) : isTop3 ? (
                            <Medal size={14} color="#a8a29e" />
                          ) : (
                            `#${player.rank}`
                          )}
                        </div>

                        <DefaultAvatar
                          src={player.user?.avatarUrl || player.user?.avatarData}
                          name={player.user?.name || `User #${player.userId}`}
                          userId={player.userId}
                          size={28}
                          shape="circle"
                        />

                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: isMe ? '#b45309' : '#111111',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: 120,
                              }}
                            >
                              {player.user?.name || `User #${player.userId}`}
                            </span>
                            {player.user?.jobTitle && (
                              <JobTitleBadge jobTitle={player.user.jobTitle} size="xs" />
                            )}
                          </div>
                          {player.highestTile > 2 && (
                            <div style={{ fontSize: 10, color: '#777777', fontWeight: 600 }}>
                              Max: <strong style={{ color: '#b45309' }}>{player.highestTile}</strong>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Best Score */}
                      <div
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 13,
                          fontWeight: 700,
                          color: isTop1 ? '#b45309' : '#141414',
                          textAlign: 'right',
                          flexShrink: 0,
                          marginLeft: 8,
                        }}
                      >
                        {Number(player.bestScore || 0).toLocaleString()} pts
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </GameFullscreenShell>
  );
}
