import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Gamepad2,
  Trophy,
  History,
  BookOpen,
  Plus,
  RefreshCw,
  Users,
  Play,
  LogOut,
  Sparkles,
  AlertCircle,
  Clock,
  ArrowRight,
  Crown,
  X,
} from 'lucide-react';
import { capitalBoardGame } from '../services/api';
import { useAuth } from '../context/AuthContext';
import CapitalBoard from '../components/game/CapitalBoard';
import PlayerCard from '../components/game/PlayerCard';
import GameEventLog from '../components/game/GameEventLog';
import GameResultModal from '../components/game/GameResultModal';
import GameRulesModal from '../components/game/GameRulesModal';
import EventCardModal from '../components/game/EventCardModal';
import CapitalBoardLobby from '../components/game/CapitalBoardLobby';
import CapitalBoardWaitingRoom from '../components/game/CapitalBoardWaitingRoom';
import gameSound from '../components/game/gameSound';
import GameFullscreenShell from '../components/game/GameFullscreenShell';
import GameComingSoon from '../components/GameComingSoon';
import { useGameAvailability } from '../hooks/useGameAvailability';

export default function CapitalBoardGame() {
  const { roomId: urlRoomId } = useParams();
  const navigate = useNavigate();
  const { user, socket, isAdmin } = useAuth();
  const {
    loading: availabilityLoading,
    game: gameInfo,
    isComingSoon,
    rawStatus,
    proceedAsAdmin,
  } = useGameAvailability('capital_board');

  // Tab navigation in lobby
  const [activeTab, setActiveTab] = useState('LOBBY'); // 'LOBBY', 'LEADERBOARD', 'HISTORY'
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Active game state
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [events, setEvents] = useState([]);
  const [gameResults, setGameResults] = useState(null);
  const [currentEventCard, setCurrentEventCard] = useState(null);

  // Turn state
  const [turnPhase, setTurnPhase] = useState('ROLL_DICE'); // 'ROLL_DICE', 'ACTION_PENDING', 'TURN_DONE'
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(25);
  const [isRollingDice, setIsRollingDice] = useState(false);
  const [lastDice, setLastDice] = useState([1, 1]);
  const [lastDiceSum, setLastDiceSum] = useState(null);
  const [recentEventBanner, setRecentEventBanner] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [botLoading, setBotLoading] = useState(false);

  // Lobby state
  const [availableRooms, setAvailableRooms] = useState([]);
  const [activeRejoinRoom, setActiveRejoinRoom] = useState(null);
  const [lobbyLoading, setLobbyLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Ref for turn timer, dice timeout and mount lifecycle
  const timerIntervalRef = useRef(null);
  const diceRollTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (diceRollTimeoutRef.current) clearTimeout(diceRollTimeoutRef.current);
    };
  }, []);

  // Synchronize state snapshot from server payload
  const syncRoomState = useCallback((stateData) => {
    if (!stateData || !isMountedRef.current) return;
    const roomObj = stateData.room || stateData;
    if (roomObj && roomObj.id) {
      setRoom(roomObj);
      setPlayers(stateData.players || roomObj.players || []);
      setProperties(stateData.properties || roomObj.properties || []);
      setEvents(stateData.events || roomObj.events || []);

      if (roomObj.lastDiceResult) {
        setLastDice([roomObj.lastDiceResult.die1 || 1, roomObj.lastDiceResult.die2 || 1]);
        setLastDiceSum(roomObj.lastDiceResult.total || 2);
      }

      const turnState = roomObj.turnState || {};
      if (turnState.rolled) {
        setTurnPhase('ACTION_PENDING');
        if (turnState.eventResult && roomObj.status === 'PLAYING') {
          setCurrentEventCard(turnState.eventResult);
        } else if (!turnState.eventResult) {
          setCurrentEventCard(null);
        }
      } else {
        setTurnPhase('ROLL_DICE');
        setCurrentEventCard(null);
      }

      if (roomObj.status === 'FINISHED') {
        setCurrentEventCard(null);
        const results = stateData.results || stateData.players?.map((p) => ({
          id: p.id,
          userId: p.userId,
          user: p.user,
          rank: p.rank,
          finalCash: p.finalCash ?? p.cash,
          finalPropertyValue: p.finalPropertyValue ?? p.propertyValue,
          finalNetWorth: p.finalNetWorth ?? p.netWorth,
          status: p.status,
        })) || [];
        setGameResults(results);
      }
    }
  }, []);

  // Fetch lobby rooms
  const fetchLobbyRooms = useCallback(async () => {
    try {
      if (isMountedRef.current) {
        setLobbyLoading(true);
        setErrorMsg(null);
      }
      const res = await capitalBoardGame.listRooms({ limit: 30 });
      const roomsList = Array.isArray(res) ? res : (res?.data || []);
      if (isMountedRef.current) {
        setAvailableRooms(roomsList);
      }

      // Check if user has an active room
      try {
        const activeRes = await capitalBoardGame.getActiveRoom();
        const activeData = activeRes?.data || activeRes;
        if (isMountedRef.current) {
          if (activeData?.id) {
            setActiveRejoinRoom(activeData);
          } else {
            setActiveRejoinRoom(null);
          }
        }
      } catch (e) {
        // No active match
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
      if (isMountedRef.current) {
        setErrorMsg('Không thể tải danh sách phòng chơi');
      }
    } finally {
      if (isMountedRef.current) {
        setLobbyLoading(false);
      }
    }
  }, []);

  // Fetch full room detail
  const fetchRoomDetail = useCallback(async (roomIdToFetch) => {
    try {
      if (isMountedRef.current) setErrorMsg(null);
      const res = await capitalBoardGame.getRoom(roomIdToFetch);
      const data = res?.data || res;
      if (data && data.id) {
        syncRoomState(data);
      } else {
        if (isMountedRef.current) setErrorMsg('Không tìm thấy phòng chơi này.');
        navigate('/games/capital-board');
      }
    } catch (err) {
      console.error('Failed to fetch room detail:', err);
      if (isMountedRef.current) {
        setErrorMsg(err.response?.data?.message || 'Không thể vào phòng chơi');
      }
      navigate('/games/capital-board');
    }
  }, [syncRoomState, navigate]);

  // Initial load
  useEffect(() => {
    if (urlRoomId) {
      fetchRoomDetail(urlRoomId);
    } else {
      fetchLobbyRooms();
    }
  }, [urlRoomId, fetchRoomDetail, fetchLobbyRooms]);

  // Socket room joining and listeners
  useEffect(() => {
    if (!socket || !room?.id) return;

    // Join socket game room
    socket.emit('game:joinRoom', { roomId: room.id });

    // Handle room refresh / updates from socket
    const handleRoomUpdated = (data) => {
      if (!data?.roomId || Number(data.roomId) === Number(room.id)) {
        fetchRoomDetail(room.id);
      }
    };

    const handlePlayerJoined = (data) => {
      if (data?.roomId && Number(data.roomId) !== Number(room.id)) return;
      fetchRoomDetail(room.id);
    };

    const handlePlayerLeft = (data) => {
      if (data?.roomId && Number(data.roomId) !== Number(room.id)) return;
      fetchRoomDetail(room.id);
    };

    const handleGameStarted = (data) => {
      if (data?.roomId && Number(data.roomId) !== Number(room.id)) return;
      setCurrentEventCard(null);
      gameSound.playTurn();
      fetchRoomDetail(room.id);
      if (isMountedRef.current) {
        setTurnPhase('ROLL_DICE');
        setTurnTimeRemaining(25);
      }
    };

    const handleDiceRolled = (data) => {
      if (data?.roomId && Number(data.roomId) !== Number(room.id)) return;
      if (diceRollTimeoutRef.current) clearTimeout(diceRollTimeoutRef.current);
      if (isMountedRef.current) setIsRollingDice(true);
      gameSound.playDiceRoll();

      diceRollTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        setIsRollingDice(false);
        if (data) {
          setLastDice([data.die1 || 1, data.die2 || 1]);
          setLastDiceSum(data.total || (data.die1 + data.die2));
        }
        fetchRoomDetail(room.id);
        setTurnPhase('ACTION_PENDING');
      }, 500);
    };

    const handlePropertyPurchased = (data) => {
      if (data?.roomId && Number(data.roomId) !== Number(room.id)) return;
      gameSound.playBuy();
      fetchRoomDetail(room.id);
    };

    const handleRentPaid = (data) => {
      if (data?.roomId && Number(data.roomId) !== Number(room.id)) return;
      gameSound.playTax();
      fetchRoomDetail(room.id);
    };

    const handleTurnChanged = (data) => {
      if (data?.roomId && Number(data.roomId) !== Number(room.id)) return;
      setCurrentEventCard(null);
      fetchRoomDetail(room.id);
      if (isMountedRef.current) {
        setTurnPhase('ROLL_DICE');
        setTurnTimeRemaining(25);
      }
      if (Number(data.currentTurnPlayerId) === Number(user?.id)) {
        gameSound.playTurn();
      }
    };

    const handleBankrupt = (data) => {
      if (data?.roomId && Number(data.roomId) !== Number(room.id)) return;
      gameSound.playTax();
      fetchRoomDetail(room.id);
    };

    const handleFinished = (data) => {
      if (data?.roomId && Number(data.roomId) !== Number(room.id)) return;
      if (diceRollTimeoutRef.current) clearTimeout(diceRollTimeoutRef.current);
      if (isMountedRef.current) {
        setIsRollingDice(false);
        setCurrentEventCard(null);
      }
      gameSound.playVictory();
      fetchRoomDetail(room.id);
    };

    // Reconnect handler
    const onReconnect = () => {
      socket.emit('game:joinRoom', { roomId: room.id });
      fetchRoomDetail(room.id);
    };

    socket.on('game:roomUpdated', handleRoomUpdated);
    socket.on('game:playerJoined', handlePlayerJoined);
    socket.on('game:playerLeft', handlePlayerLeft);
    socket.on('game:started', handleGameStarted);
    socket.on('game:diceRolled', handleDiceRolled);
    socket.on('game:propertyPurchased', handlePropertyPurchased);
    socket.on('game:rentPaid', handleRentPaid);
    socket.on('game:turnChanged', handleTurnChanged);
    socket.on('game:bankrupt', handleBankrupt);
    socket.on('game:finished', handleFinished);
    socket.on('connect', onReconnect);

    return () => {
      if (diceRollTimeoutRef.current) clearTimeout(diceRollTimeoutRef.current);
      socket.emit('game:leaveRoom', { roomId: room.id });
      socket.off('game:roomUpdated', handleRoomUpdated);
      socket.off('game:playerJoined', handlePlayerJoined);
      socket.off('game:playerLeft', handlePlayerLeft);
      socket.off('game:started', handleGameStarted);
      socket.off('game:diceRolled', handleDiceRolled);
      socket.off('game:propertyPurchased', handlePropertyPurchased);
      socket.off('game:rentPaid', handleRentPaid);
      socket.off('game:turnChanged', handleTurnChanged);
      socket.off('game:bankrupt', handleBankrupt);
      socket.off('game:finished', handleFinished);
      socket.off('connect', onReconnect);
    };
  }, [socket, room?.id, user?.id, fetchRoomDetail]);

  // Turn Countdown Timer
  useEffect(() => {
    if (room?.status !== 'PLAYING') {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    // Initialize remaining seconds based on deadline
    if (room.turnDeadline) {
      const remainingSec = Math.max(0, Math.floor((new Date(room.turnDeadline) - new Date()) / 1000));
      setTurnTimeRemaining(remainingSec);
    } else {
      setTurnTimeRemaining(25);
    }

    timerIntervalRef.current = setInterval(() => {
      setTurnTimeRemaining((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [room?.status, room?.turnNumber, room?.turnDeadline]);

  // Actions
  const handleCreateRoom = async ({ title, maxPlayers }) => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const res = await capitalBoardGame.createRoom({
        title,
        maxPlayers: Number(maxPlayers),
      });
      const data = res?.data || res;
      if (data?.id) {
        syncRoomState(data);
        navigate(`/games/capital-board/room/${data.id}`);
      }
    } catch (err) {
      console.error('Failed to create room:', err);
      setErrorMsg(err.response?.data?.message || 'Không thể tạo phòng chơi');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreatePracticeRoom = async (botCount = 3) => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const res = await capitalBoardGame.createPracticeRoom(botCount);
      const data = res?.data || res;
      if (data?.id) {
        syncRoomState(data);
        navigate(`/games/capital-board/room/${data.id}`);
      }
    } catch (err) {
      console.error('Failed to create practice room:', err);
      setErrorMsg(err.response?.data?.message || 'Không thể tạo phòng luyện tập với bot');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddBot = async () => {
    if (!room?.id || botLoading) return;
    try {
      setBotLoading(true);
      setErrorMsg(null);
      const res = await capitalBoardGame.addBot(room.id);
      const data = res?.data || res;
      if (data?.id) {
        syncRoomState(data);
      }
    } catch (err) {
      console.error('Failed to add bot:', err);
      setErrorMsg(err.response?.data?.message || 'Không thể thêm bot vào phòng');
    } finally {
      setBotLoading(false);
    }
  };

  const handleRemoveBot = async (botUserId) => {
    if (!room?.id || botLoading) return;
    try {
      setBotLoading(true);
      setErrorMsg(null);
      const res = await capitalBoardGame.removeBot(room.id, botUserId);
      const data = res?.data || res;
      if (data?.id) {
        syncRoomState(data);
      }
    } catch (err) {
      console.error('Failed to remove bot:', err);
      setErrorMsg(err.response?.data?.message || 'Không thể xóa bot');
    } finally {
      setBotLoading(false);
    }
  };

  const handleJoinRoom = async (roomIdToJoin) => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const res = await capitalBoardGame.joinRoom(roomIdToJoin);
      const data = res?.data || res;
      if (data?.id) {
        syncRoomState(data);
        navigate(`/games/capital-board/room/${data.id}`);
      }
    } catch (err) {
      console.error('Failed to join room:', err);
      setErrorMsg(err.response?.data?.message || 'Không thể tham gia phòng');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!room?.id) return;
    try {
      setActionLoading(true);
      if (diceRollTimeoutRef.current) clearTimeout(diceRollTimeoutRef.current);
      setIsRollingDice(false);
      setCurrentEventCard(null);
      await capitalBoardGame.leaveRoom(room.id);
      setRoom(null);
      setPlayers([]);
      setProperties([]);
      setEvents([]);
      setGameResults(null);
      navigate('/games/capital-board');
      fetchLobbyRooms();
    } catch (err) {
      console.error('Failed to leave room:', err);
    } finally {
      if (isMountedRef.current) {
        setActionLoading(false);
      }
    }
  };

  const handleStartGame = async () => {
    if (!room?.id || actionLoading) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const res = await capitalBoardGame.startGame(room.id);
      const data = res?.data || res;
      if (data?.id) {
        syncRoomState(data);
      }
    } catch (err) {
      console.error('Failed to start game:', err);
      setErrorMsg(err.response?.data?.message || 'Không thể bắt đầu trận đấu');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRollDice = async () => {
    if (!room?.id || actionLoading || isRollingDice) return;
    try {
      setActionLoading(true);
      setIsRollingDice(true);
      gameSound.playDiceRoll();
      const res = await capitalBoardGame.rollDice(room.id);
      const data = res?.data || res;

      setTimeout(() => {
        setIsRollingDice(false);
        if (data?.id) {
          syncRoomState(data);
          const turnState = data.turnState || {};
          if (turnState.eventResult) {
            setCurrentEventCard(turnState.eventResult);
          }
        }
      }, 500);
    } catch (err) {
      console.error('Failed to roll dice:', err);
      setIsRollingDice(false);
      setErrorMsg(err.response?.data?.message || 'Lỗi gieo xúc xắc');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBuyProperty = async () => {
    if (!room?.id || actionLoading) return;
    try {
      setActionLoading(true);
      const res = await capitalBoardGame.buyProperty(room.id);
      const data = res?.data || res;
      if (data?.id) {
        gameSound.playBuy();
        syncRoomState(data);
        setTurnPhase('ACTION_PENDING');
      }
    } catch (err) {
      console.error('Failed to buy property:', err);
      setErrorMsg(err.response?.data?.message || 'Lỗi mua bất động sản');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndTurn = async () => {
    if (!room?.id || actionLoading) return;
    try {
      setActionLoading(true);
      const res = await capitalBoardGame.endTurn(room.id);
      const data = res?.data || res;
      if (data?.id) {
        syncRoomState(data);
        setTurnPhase('ROLL_DICE');
        setTurnTimeRemaining(25);
      }
    } catch (err) {
      console.error('Failed to end turn:', err);
      setErrorMsg(err.response?.data?.message || 'Lỗi kết thúc lượt');
    } finally {
      setActionLoading(false);
    }
  };

  // Identify players
  const myPlayer = players.find((p) => Number(p.userId) === Number(user?.id));
  const currentTurnPlayer = players.find((p) => Number(p.userId) === Number(room?.currentTurnPlayerId));
  const isMyTurn = myPlayer && currentTurnPlayer && Number(myPlayer.userId) === Number(currentTurnPlayer.userId);

  // View state calculation
  const isInsideRoom = Boolean(room);
  const isPlaying = room?.status === 'PLAYING';
  const isWaiting = room?.status === 'WAITING';

  if (!availabilityLoading && isComingSoon) {
    return (
      <GameFullscreenShell
        title="Cờ Tỷ Phú"
        icon={Gamepad2}
        badge="Bàn cờ"
        exitLabel="Quay lại"
        exitTo="/games"
      >
        <GameComingSoon
          gameKey="capital_board"
          name={gameInfo?.name || 'Cờ Tỷ Phú'}
          description={gameInfo?.description}
          isAdmin={isAdmin}
          onAdminProceed={proceedAsAdmin}
        />
      </GameFullscreenShell>
    );
  }

  return (
    <GameFullscreenShell
      title="Cờ Tỷ Phú"
      icon={Gamepad2}
      badge={room ? `Phòng #${room.code || room.id}` : 'Bàn cờ'}
      exitLabel="Thoát"
      exitTo="/arena"
      onExit={() => {
        if (room?.id) {
          handleLeaveRoom();
        } else {
          navigate('/arena');
        }
      }}
      actions={
        <button
          type="button"
          onClick={() => setShowRulesModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--surface)',
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          <BookOpen size={14} />
          <span>Luật chơi</span>
        </button>
      }
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 20px', width: '100%', boxSizing: 'border-box' }}>
        {/* Top Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: '1px solid rgba(15,23,42,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: 'var(--text-primary)',
                color: 'var(--surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(15,23,42,0.15)',
              }}
            >
              <Gamepad2 size={22} color="var(--accent)" />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ fontSize: 'var(--text-h1, 22px)', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.25 }}>
                  CỜ TỶ PHÚ WORKRANK
                </h1>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  V1 REALTIME
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                Game bàn cờ kinh doanh & đầu tư bất động sản thời gian thực dành cho thành viên WorkRank.
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowRulesModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--surface)',
                border: '1px solid rgba(15,23,42,0.12)',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <BookOpen size={15} />
              <span>Luật Chơi</span>
            </button>

            {isInsideRoom && (
              <button
                type="button"
                onClick={handleLeaveRoom}
                disabled={actionLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(239,68,68,0.1)',
                  color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <LogOut size={15} />
                <span>Rời Phòng</span>
              </button>
            )}
          </div>
        </div>

        {/* Global Error Alert Banner */}
        {errorMsg && (
          <div
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#dc2626',
              padding: '10px 14px',
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              style={{ display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* ─────────────────── 1. LOBBY VIEW ─────────────────── */}
        {!isInsideRoom && (
          <CapitalBoardLobby
            activeTab={activeTab}
            onTabChange={setActiveTab}
            availableRooms={availableRooms}
            activeRejoinRoom={activeRejoinRoom}
            lobbyLoading={lobbyLoading}
            onRefresh={fetchLobbyRooms}
            onJoinRoom={handleJoinRoom}
            onCreateRoom={handleCreateRoom}
            onCreatePracticeRoom={handleCreatePracticeRoom}
            actionLoading={actionLoading}
          />
        )}

        {/* ─────────────────── 2. WAITING ROOM VIEW ─────────────────── */}
        {isInsideRoom && isWaiting && (
          <CapitalBoardWaitingRoom
            room={room}
            players={players}
            currentUser={user}
            onStartGame={handleStartGame}
            onLeaveRoom={handleLeaveRoom}
            onAddBot={handleAddBot}
            onRemoveBot={handleRemoveBot}
            actionLoading={actionLoading}
            botLoading={botLoading}
          />
        )}

        {/* ─────────────────── 3. PLAYING BOARD VIEW ─────────────────── */}
        {isInsideRoom && isPlaying && (
          <div className="capital-board-layout">
            {/* Main Stage: Large Hero 2D Capital Board */}
            <div style={{ width: '100%', minWidth: 0, display: 'flex', justifyContent: 'center' }}>
              <CapitalBoard
                room={room}
                players={players}
                properties={properties}
                currentTurnPlayer={currentTurnPlayer}
                myPlayer={myPlayer}
                isMyTurn={isMyTurn}
                turnPhase={turnPhase}
                turnTimeRemaining={turnTimeRemaining}
                isRolling={isRollingDice}
                lastDice={lastDice}
                lastSum={lastDiceSum}
                onRollDice={handleRollDice}
                onBuyProperty={handleBuyProperty}
                onEndTurn={handleEndTurn}
                actionLoading={actionLoading}
                recentEvent={recentEventBanner}
              />
            </div>

            {/* Sidebar HUD: Players & Live Activity Log */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', minWidth: 0 }}>
              {/* Player Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={15} color="var(--info)" />
                    <span>Người chơi ({players.length})</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Lượt {room.turnNumber || 1}/50
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {players.map((p) => {
                    const isCurrentTurn = Number(p.userId) === Number(room.currentTurnPlayerId);
                    const isMe = Number(p.userId) === Number(user?.id);
                    const playerProperties = properties.filter((prop) => Number(prop.ownerUserId) === Number(p.userId));

                    return (
                      <PlayerCard
                        key={p.id || p.userId}
                        player={p}
                        isCurrentTurn={isCurrentTurn}
                        isMe={isMe}
                        turnTimeRemaining={turnTimeRemaining}
                        propertiesOwnedCount={playerProperties.length}
                        ownedProperties={playerProperties}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Live Event Log */}
              <GameEventLog events={events} maxHeight={340} collapsibleOnMobile />
            </div>
          </div>
        )}

        {/* ─────────────────── MODALS ─────────────────── */}

        {/* Rules Modal */}
        <GameRulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />

        {/* Chance / Opportunity Event Modal */}
        <EventCardModal
          isOpen={Boolean(currentEventCard)}
          onClose={() => setCurrentEventCard(null)}
          event={currentEventCard}
          actorName={currentTurnPlayer?.user?.name || 'Người chơi'}
        />

        {/* Game Finished Results Modal */}
        {gameResults && (
          <GameResultModal
            isOpen={Boolean(gameResults)}
            results={gameResults}
            onReturnToLobby={() => {
              setGameResults(null);
              setRoom(null);
              setPlayers([]);
              setProperties([]);
              setEvents([]);
              navigate('/games/capital-board');
              fetchLobbyRooms();
            }}
            onViewLeaderboard={() => {
              setGameResults(null);
              setRoom(null);
              setPlayers([]);
              setProperties([]);
              setEvents([]);
              setActiveTab('LEADERBOARD');
              navigate('/games/capital-board');
            }}
          />
        )}
      </div>
    </GameFullscreenShell>
  );
}
