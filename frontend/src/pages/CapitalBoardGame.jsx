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
import GameLeaderboard from '../components/game/GameLeaderboard';
import GameHistory from '../components/game/GameHistory';
import GameRulesModal from '../components/game/GameRulesModal';
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
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Active game state
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [events, setEvents] = useState([]);
  const [gameResults, setGameResults] = useState(null);

  // Turn state
  const [turnPhase, setTurnPhase] = useState('ROLL_DICE'); // 'ROLL_DICE', 'ACTION_PENDING', 'TURN_DONE'
  const [turnTimeRemaining, setTurnTimeRemaining] = useState(25);
  const [isRollingDice, setIsRollingDice] = useState(false);
  const [lastDice, setLastDice] = useState([1, 1]);
  const [lastDiceSum, setLastDiceSum] = useState(null);
  const [recentEventBanner, setRecentEventBanner] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Lobby state
  const [availableRooms, setAvailableRooms] = useState([]);
  const [activeRejoinRoom, setActiveRejoinRoom] = useState(null);
  const [lobbyLoading, setLobbyLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Create room form
  const [newRoomName, setNewRoomName] = useState('');
  const [newMaxPlayers, setNewMaxPlayers] = useState(4);
  const [creatingRoom, setCreatingRoom] = useState(false);

  // Ref for turn timer
  const timerIntervalRef = useRef(null);

  // Fetch lobby rooms
  const fetchLobbyRooms = useCallback(async () => {
    try {
      setLobbyLoading(true);
      setErrorMsg(null);
      const res = await capitalBoardGame.listRooms({ status: 'WAITING' });
      const roomsList = Array.isArray(res) ? res : (res?.data || []);
      setAvailableRooms(roomsList);

      // Check active ongoing match
      try {
        const activeRes = await capitalBoardGame.getActiveRoom();
        const activeData = activeRes?.room ? activeRes : (activeRes?.data || activeRes);
        if (activeData?.room) {
          setActiveRejoinRoom(activeData.room);
        } else {
          setActiveRejoinRoom(null);
        }
      } catch (e) {
        // No active match
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
      setErrorMsg('Không thể tải danh sách phòng chơi');
    } finally {
      setLobbyLoading(false);
    }
  }, []);

  // Fetch full room detail
  const fetchRoomDetail = useCallback(async (roomIdToFetch) => {
    try {
      setErrorMsg(null);
      const res = await capitalBoardGame.getRoom(roomIdToFetch);
      const data = res?.room ? res : (res?.data || res);
      if (data && data.room) {
        setRoom(data.room);
        setPlayers(data.players || []);
        setProperties(data.properties || []);
        setEvents(data.events || []);
        if (data.results && data.results.length > 0) {
          setGameResults(data.results);
        }

        // Determine turn phase based on turn state
        if (data.room.status === 'PLAYING') {
          // If already rolled, set ACTION_PENDING
          setTurnPhase('ROLL_DICE');
        }
      }
    } catch (err) {
      console.error('Failed to fetch room detail:', err);
      setErrorMsg('Không thể vào phòng chơi');
    }
  }, []);

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

    // Handle game:playerJoined
    const onPlayerJoined = (data) => {
      if (data.players) setPlayers(data.players);
      if (data.room) setRoom(data.room);
      if (data.event) setEvents((prev) => [...prev, data.event]);
    };

    // Handle game:playerLeft
    const onPlayerLeft = (data) => {
      if (data.players) setPlayers(data.players);
      if (data.room) setRoom(data.room);
      if (data.event) setEvents((prev) => [...prev, data.event]);
    };

    // Handle game:started
    const onGameStarted = (data) => {
      if (data.room) setRoom(data.room);
      if (data.players) setPlayers(data.players);
      if (data.properties) setProperties(data.properties);
      if (data.event) setEvents((prev) => [...prev, data.event]);
      setTurnPhase('ROLL_DICE');
      setTurnTimeRemaining(25);
      gameSound.playTurn();
    };

    // Handle game:diceRolled
    const onDiceRolled = (data) => {
      setIsRollingDice(true);
      gameSound.playDiceRoll();
      setTimeout(() => {
        setIsRollingDice(false);
        setLastDice([data.dice1, data.dice2]);
        setLastDiceSum(data.totalSteps);
        if (data.player) {
          setPlayers((prev) => prev.map((p) => (p.id === data.player.id ? data.player : p)));
        }
        if (data.event) setEvents((prev) => [...prev, data.event]);
        setTurnPhase('ACTION_PENDING');
      }, 500);
    };

    // Handle game:playerMoved
    const onPlayerMoved = (data) => {
      if (data.player) {
        setPlayers((prev) => prev.map((p) => (p.id === data.player.id ? data.player : p)));
      }
      if (data.event) setEvents((prev) => [...prev, data.event]);
    };

    // Handle game:propertyPurchased
    const onPropertyPurchased = (data) => {
      gameSound.playBuy();
      if (data.player) {
        setPlayers((prev) => prev.map((p) => (p.id === data.player.id ? data.player : p)));
      }
      if (data.property) {
        setProperties((prev) => prev.map((prop) => (prop.id === data.property.id ? data.property : prop)));
      }
      if (data.event) setEvents((prev) => [...prev, data.event]);
      setTurnPhase('ACTION_PENDING');
    };

    // Handle game:rentPaid
    const onRentPaid = (data) => {
      gameSound.playTax();
      if (data.payer) {
        setPlayers((prev) => prev.map((p) => (p.id === data.payer.id ? data.payer : p)));
      }
      if (data.owner) {
        setPlayers((prev) => prev.map((p) => (p.id === data.owner.id ? data.owner : p)));
      }
      if (data.event) setEvents((prev) => [...prev, data.event]);
    };

    // Handle game:passStartBonus
    const onPassStartBonus = (data) => {
      gameSound.playCoin();
      if (data.player) {
        setPlayers((prev) => prev.map((p) => (p.id === data.player.id ? data.player : p)));
      }
      if (data.event) setEvents((prev) => [...prev, data.event]);
    };

    // Handle game:taxPaid
    const onTaxPaid = (data) => {
      gameSound.playTax();
      if (data.player) {
        setPlayers((prev) => prev.map((p) => (p.id === data.player.id ? data.player : p)));
      }
      if (data.event) setEvents((prev) => [...prev, data.event]);
    };

    // Handle game:bonusReceived
    const onBonusReceived = (data) => {
      gameSound.playCoin();
      if (data.player) {
        setPlayers((prev) => prev.map((p) => (p.id === data.player.id ? data.player : p)));
      }
      if (data.event) setEvents((prev) => [...prev, data.event]);
    };

    // Handle game:eventTriggered
    const onEventTriggered = (data) => {
      gameSound.playChance();
      setRecentEventBanner(data.event?.description || data.eventTitle);
      setTimeout(() => setRecentEventBanner(null), 6000);
      if (data.player) {
        setPlayers((prev) => prev.map((p) => (p.id === data.player.id ? data.player : p)));
      }
      if (data.event) setEvents((prev) => [...prev, data.event]);
    };

    // Handle game:playerBankrupt
    const onPlayerBankrupt = (data) => {
      gameSound.playTax();
      if (data.player) {
        setPlayers((prev) => prev.map((p) => (p.id === data.player.id ? data.player : p)));
      }
      if (data.freedProperties) {
        // Reset freed properties
        setProperties((prev) =>
          prev.map((prop) => (data.freedProperties.includes(prop.id) ? { ...prop, ownerId: null } : prop))
        );
      }
      if (data.event) setEvents((prev) => [...prev, data.event]);
    };

    // Handle game:turnChanged
    const onTurnChanged = (data) => {
      if (data.room) setRoom(data.room);
      if (data.players) setPlayers(data.players);
      if (data.event) setEvents((prev) => [...prev, data.event]);
      setTurnPhase('ROLL_DICE');
      setTurnTimeRemaining(25);

      // If it is my turn, play ding sound
      if (data.currentTurnPlayer?.userId === user?.id) {
        gameSound.playTurn();
      }
    };

    // Handle game:finished
    const onGameFinished = (data) => {
      gameSound.playVictory();
      if (data.room) setRoom(data.room);
      if (data.results) setGameResults(data.results);
      if (data.event) setEvents((prev) => [...prev, data.event]);
    };

    // Handle game:stateUpdate
    const onStateUpdate = (data) => {
      if (data.room) setRoom(data.room);
      if (data.players) setPlayers(data.players);
      if (data.properties) setProperties(data.properties);
      if (data.events) setEvents(data.events);
    };

    socket.on('game:playerJoined', onPlayerJoined);
    socket.on('game:playerLeft', onPlayerLeft);
    socket.on('game:started', onGameStarted);
    socket.on('game:diceRolled', onDiceRolled);
    socket.on('game:playerMoved', onPlayerMoved);
    socket.on('game:propertyPurchased', onPropertyPurchased);
    socket.on('game:rentPaid', onRentPaid);
    socket.on('game:passStartBonus', onPassStartBonus);
    socket.on('game:taxPaid', onTaxPaid);
    socket.on('game:bonusReceived', onBonusReceived);
    socket.on('game:eventTriggered', onEventTriggered);
    socket.on('game:playerBankrupt', onPlayerBankrupt);
    socket.on('game:turnChanged', onTurnChanged);
    socket.on('game:finished', onGameFinished);
    socket.on('game:stateUpdate', onStateUpdate);

    return () => {
      socket.emit('game:leaveRoom', { roomId: room.id });
      socket.off('game:playerJoined', onPlayerJoined);
      socket.off('game:playerLeft', onPlayerLeft);
      socket.off('game:started', onGameStarted);
      socket.off('game:diceRolled', onDiceRolled);
      socket.off('game:playerMoved', onPlayerMoved);
      socket.off('game:propertyPurchased', onPropertyPurchased);
      socket.off('game:rentPaid', onRentPaid);
      socket.off('game:passStartBonus', onPassStartBonus);
      socket.off('game:taxPaid', onTaxPaid);
      socket.off('game:bonusReceived', onBonusReceived);
      socket.off('game:eventTriggered', onEventTriggered);
      socket.off('game:playerBankrupt', onPlayerBankrupt);
      socket.off('game:turnChanged', onTurnChanged);
      socket.off('game:finished', onGameFinished);
      socket.off('game:stateUpdate', onStateUpdate);
    };
  }, [socket, room?.id, user?.id]);

  // Turn Countdown Timer
  useEffect(() => {
    if (room?.status !== 'PLAYING') {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
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
  }, [room?.status, room?.currentTurnSeat]);

  // Actions
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    try {
      setCreatingRoom(true);
      setErrorMsg(null);
      const res = await capitalBoardGame.createRoom({
        title: newRoomName.trim(),
        maxPlayers: Number(newMaxPlayers),
      });
      setShowCreateModal(false);
      setNewRoomName('');
      const data = res?.room ? res : (res?.data || res);
      if (data?.room) {
        setRoom(data.room);
        setPlayers(data.players || []);
        navigate(`/games/capital-board/room/${data.room.id}`);
      }
    } catch (err) {
      console.error('Failed to create room:', err);
      setErrorMsg(err.response?.data?.message || 'Không thể tạo phòng chơi');
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleJoinRoom = async (roomIdToJoin) => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const res = await capitalBoardGame.joinRoom(roomIdToJoin);
      const data = res?.room ? res : (res?.data || res);
      if (data?.room) {
        setRoom(data.room);
        setPlayers(data.players || []);
        navigate(`/games/capital-board/room/${data.room.id}`);
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
      setActionLoading(false);
    }
  };

  const handleStartGame = async () => {
    if (!room?.id) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const res = await capitalBoardGame.startGame(room.id);
      const data = res?.room ? res : (res?.data || res);
      if (data?.room) {
        setRoom(data.room);
        setPlayers(data.players || []);
        setProperties(data.properties || []);
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
      const data = res?.dice1 !== undefined || res?.room ? res : (res?.data || res);
      setTimeout(() => {
        setIsRollingDice(false);
        if (data) {
          setLastDice([data.dice1 ?? 1, data.dice2 ?? 1]);
          setLastDiceSum(data.totalSteps ?? (data.dice1 + data.dice2));
          if (data.room) setRoom(data.room);
          if (data.players) setPlayers(data.players);
          if (data.event) setEvents((prev) => [...prev, data.event]);
          setTurnPhase('ACTION_PENDING');
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
    const activePlayer = players.find((p) => p.seatIndex === room.currentTurnSeat);
    if (!activePlayer) return;

    try {
      setActionLoading(true);
      const res = await capitalBoardGame.buyProperty(room.id, activePlayer.position);
      const data = res?.property || res?.room ? res : (res?.data || res);
      if (data) {
        gameSound.playBuy();
        if (data.room) setRoom(data.room);
        if (data.players) setPlayers(data.players);
        if (data.property) {
          setProperties((prev) =>
            prev.map((prop) => (prop.id === data.property.id ? data.property : prop))
          );
        }
        if (data.event) setEvents((prev) => [...prev, data.event]);
        // After buying, prompt to end turn
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
      const data = res?.room ? res : (res?.data || res);
      if (data) {
        if (data.room) setRoom(data.room);
        if (data.players) setPlayers(data.players);
        if (data.event) setEvents((prev) => [...prev, data.event]);
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

  // Identify my player
  const myPlayer = players.find((p) => Number(p.userId) === Number(user?.id));
  const currentTurnPlayer = players.find((p) => p.seatIndex === room?.currentTurnSeat);
  const isMyTurn = myPlayer && currentTurnPlayer && myPlayer.id === currentTurnPlayer.id;
  const isHost = Number(room?.hostUserId) === Number(user?.id) || Number(room?.hostId) === Number(user?.id);

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
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 700,
            color: '#111111',
            cursor: 'pointer',
          }}
        >
          <BookOpen size={14} />
          <span>Luật chơi</span>
        </button>
      }
    >
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '16px 20px', width: '100%', boxSizing: 'border-box' }}>
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
              background: '#0f172a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(15,23,42,0.15)',
            }}
          >
            <Gamepad2 size={22} color="#b45309" />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 'var(--text-h1, 24px)', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.25 }}>
                CỜ TỶ PHÚ WORKRANK
              </h1>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  background: 'rgba(180,83,9,0.08)',
                  color: "#b45309",
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                V1 REALTIME
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Game giải trí chiến thuật & kinh tế dành riêng cho thành viên 3winmedia.
            </p>
          </div>
        </div>

        {/* Global Header Actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#ffffff',
              border: '1px solid rgba(15,23,42,0.12)',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 700,
              color: '#0f172a',
              cursor: 'pointer',
            }}
          >
            <BookOpen size={15} />
            <span>Luật Chơi</span>
          </button>

          {!isInsideRoom && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(15,23,42,0.15)',
              }}
            >
              <Plus size={16} />
              <span>Tạo Phòng Chơi</span>
            </button>
          )}

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
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <LogOut size={15} />
              <span>Rời Phòng</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Error Banner */}
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

      {/* Active Ongoing Game Rejoin Banner (if player has an active match) */}
      {!isInsideRoom && activeRejoinRoom && (
        <div
          style={{
            background: "#141414",
            color: '#ffffff',
            borderRadius: 8,
            padding: '14px 18px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 14px rgba(2,132,199,0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>BẠN ĐANG CÓ MỘT TRẬN ĐẤU DỞ DANG!</div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>
                Phòng <strong>{activeRejoinRoom.name}</strong> (#{activeRejoinRoom.code}) đang diễn ra.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleJoinRoom(activeRejoinRoom.id)}
            style={{
              background: '#ffffff',
              color: "#b45309",
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
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

      {/* ─────────────────── 1. LOBBY VIEW ─────────────────── */}
      {!isInsideRoom && (
        <div>
          {/* Lobby Segmented Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              borderBottom: '1px solid rgba(15,23,42,0.08)',
              paddingBottom: 8,
              marginBottom: 16,
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
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: 'none',
                    background: isActive ? '#0f172a' : 'transparent',
                    color: isActive ? '#ffffff' : '#64748b',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={15} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab 1: Lobby Rooms List */}
          {activeTab === 'LOBBY' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                  Danh sách phòng chờ ({availableRooms.length})
                </span>

                <button
                  type="button"
                  onClick={fetchLobbyRooms}
                  disabled={lobbyLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#ffffff',
                    border: '1px solid rgba(15,23,42,0.12)',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#0f172a',
                    cursor: lobbyLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  <RefreshCw size={13} className={lobbyLoading ? 'spin' : ''} />
                  <span>Làm mới sảnh</span>
                </button>
              </div>

              {availableRooms.length === 0 ? (
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px dashed rgba(15,23,42,0.15)',
                    borderRadius: 8,
                    padding: '40px 20px',
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
                      color: '#94a3b8',
                    }}
                  >
                    <Gamepad2 size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: '0 0 4px' }}>
                      Chưa có phòng nào đang chờ
                    </h3>
                    <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                      Hãy bấm "Tạo Phòng Chơi" để bắt đầu ván cờ đầu tiên cùng bạn bè!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    style={{
                      background: '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 600,
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
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: 14,
                  }}
                >
                  {availableRooms.map((r) => {
                    const joinedCount = r.playerCount || r.players?.length || 0;
                    const maxP = r.maxPlayers || 4;
                    const isFull = joinedCount >= maxP;

                    return (
                      <div
                        key={r.id}
                        style={{
                          background: '#ffffff',
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
                                fontWeight: 600,
                                background: 'rgba(34,197,94,0.12)',
                                color: '#16a34a',
                                padding: '2px 6px',
                                borderRadius: 4,
                              }}
                            >
                              ĐANG CHỜ
                            </span>
                            <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
                              #{r.code}
                            </span>
                          </div>

                          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: '0 0 4px' }}>
                            {r.name}
                          </h3>

                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            Chủ phòng:{' '}
                            <strong style={{ color: '#0f172a' }}>{r.host?.name || r.host?.username || 'Host'}</strong>
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569' }}>
                            <Users size={15} />
                            <span>
                              <strong>{joinedCount}</strong> / {maxP} người
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleJoinRoom(r.id)}
                            disabled={actionLoading || isFull}
                            style={{
                              background: isFull ? 'rgba(15,23,42,0.05)' : '#0f172a',
                              color: isFull ? '#94a3b8' : '#ffffff',
                              border: 'none',
                              borderRadius: 6,
                              padding: '6px 14px',
                              fontSize: 12,
                              fontWeight: 600,
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

          {/* Tab 2: Leaderboard */}
          {activeTab === 'LEADERBOARD' && <GameLeaderboard />}

          {/* Tab 3: History */}
          {activeTab === 'HISTORY' && <GameHistory />}
        </div>
      )}

      {/* ─────────────────── 2. WAITING ROOM VIEW ─────────────────── */}
      {isInsideRoom && isWaiting && (
        <div
          style={{
            maxWidth: 680,
            margin: '0 auto',
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid rgba(15,23,42,0.1)',
            padding: 24,
            boxShadow: '0 4px 16px rgba(15,23,42,0.06)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                background: 'rgba(180,83,9,0.08)',
                color: "#b45309",
                padding: '3px 8px',
                borderRadius: 4,
                textTransform: 'uppercase',
              }}
            >
              Phòng Chờ Trận Đấu
            </span>
            <h2 style={{ fontSize: 'var(--text-h2, 20px)', fontWeight: 700, color: '#0f172a', margin: '8px 0 4px', lineHeight: 1.25 }}>
              {room.title || room.name}
            </h2>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              Mã phòng: <strong style={{ color: '#0f172a', fontFamily: 'JetBrains Mono, monospace' }}>#{room.code}</strong> |{' '}
              Chủ phòng: <strong style={{ color: '#0f172a' }}>{room.host?.name || 'Host'}</strong>
            </div>
          </div>

          {/* Player Slot Grid (up to maxPlayers) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 24 }}>
            {Array.from({ length: room.maxPlayers || 4 }).map((_, idx) => {
              const p = players.find((pl) => pl.seatIndex === idx);
              const seatColors = ["#141414", "#b91c1c", "#15803d", "#b45309"];
              const sColor = seatColors[idx] || '#94a3b8';

              return (
                <div
                  key={idx}
                  style={{
                    border: p ? `2px solid ${sColor}` : '2px dashed rgba(15,23,42,0.15)',
                    borderRadius: 8,
                    padding: 14,
                    background: p ? '#ffffff' : 'rgba(15,23,42,0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: p ? sColor : 'rgba(15,23,42,0.08)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {p ? (p.user?.name || `P${idx + 1}`).charAt(0).toUpperCase() : idx + 1}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: sColor, textTransform: 'uppercase' }}>
                      Vị trí {idx + 1}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: p ? '#0f172a' : '#94a3b8',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {p ? p.user?.name || p.user?.username || `Người chơi ${idx + 1}` : 'Đang chờ người vào...'}
                    </div>
                    {p?.userId === room.hostId && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>
                        <Crown size={11} />
                        <span>CHỦ PHÒNG</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={handleLeaveRoom}
              disabled={actionLoading}
              style={{
                flex: 1,
                background: '#ffffff',
                color: '#ef4444',
                border: '1.5px solid rgba(239,68,68,0.3)',
                borderRadius: 6,
                padding: '12px 16px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Rời Phòng
            </button>

            {isHost ? (
              <button
                type="button"
                onClick={handleStartGame}
                disabled={actionLoading || players.length < 2}
                style={{
                  flex: 2,
                  background: players.length >= 2 ? '#16a34a' : '#94a3b8',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '12px 16px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: players.length >= 2 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: players.length >= 2 ? '0 4px 14px rgba(22,163,74,0.3)' : 'none',
                }}
              >
                <Play size={16} />
                <span>{players.length < 2 ? 'Cần Tối Thiểu 2 Người' : 'Bắt Đầu Trận Đấu'}</span>
              </button>
            ) : (
              <div
                style={{
                  flex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  background: 'rgba(15,23,42,0.03)',
                  border: '1px solid rgba(15,23,42,0.08)',
                  borderRadius: 6,
                  color: '#64748b',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <Clock size={14} />
                <span>Đang chờ chủ phòng bắt đầu trận đấu...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────── 3. PLAYING BOARD VIEW ─────────────────── */}
      {isInsideRoom && isPlaying && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 280px', gap: 16, alignItems: 'start' }}>
          {/* Left Column: Player Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>
              Người chơi ({players.length})
            </div>
            {players.map((p) => {
              const isCurrentTurn = p.seatIndex === room.currentTurnSeat;
              const isMe = p.userId === user?.id;
              const propertiesCount = properties.filter((prop) => prop.ownerId === p.userId).length;

              return (
                <PlayerCard
                  key={p.id}
                  player={p}
                  isCurrentTurn={isCurrentTurn}
                  isMe={isMe}
                  turnTimeRemaining={turnTimeRemaining}
                  propertiesOwnedCount={propertiesCount}
                />
              );
            })}
          </div>

          {/* Center Column: Capital Board */}
          <div>
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

          {/* Right Column: Live Events Feed */}
          <div>
            <GameEventLog events={events} maxHeight={680} />
          </div>
        </div>
      )}

      {/* ─────────────────── MODALS ─────────────────── */}

      {/* Create Room Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15,23,42,0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 10,
              border: '1px solid rgba(15,23,42,0.15)',
              width: '100%',
              maxWidth: 440,
              padding: 20,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ fontSize: 'var(--text-h3, 16px)', fontWeight: 600, color: '#0f172a', margin: '0 0 14px', lineHeight: 1.3 }}>
              Tạo Phòng Cờ Tỷ Phú
            </h3>

            <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Tên phòng chơi
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Ví dụ: Đại Chiến Tỷ Phú 3winmedia"
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
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
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
                        border: newMaxPlayers === num ? '2px solid #0f172a' : '1px solid rgba(15,23,42,0.15)',
                        background: newMaxPlayers === num ? '#0f172a' : '#ffffff',
                        color: newMaxPlayers === num ? '#ffffff' : '#0f172a',
                        fontWeight: 600,
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
                    background: '#ffffff',
                    color: '#64748b',
                    fontWeight: 600,
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
                    background: '#0f172a',
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: creatingRoom ? 'not-allowed' : 'pointer',
                  }}
                >
                  {creatingRoom ? 'Đang tạo phòng...' : 'Tạo Phòng Ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRulesModal && <GameRulesModal onClose={() => setShowRulesModal(false)} />}

      {/* Game Finished Results Modal */}
      {gameResults && (
        <GameResultModal
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
