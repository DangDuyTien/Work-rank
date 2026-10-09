import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Club,
  Volume2,
  VolumeX,
  HelpCircle,
  Sliders,
  Eye,
  Bot,
  ArrowLeft,
} from 'lucide-react';
import { samGame } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../services/socket';
import GameFullscreenShell from '../components/game/GameFullscreenShell';
import GameComingSoon from '../components/GameComingSoon';
import { useGameAvailability } from '../hooks/useGameAvailability';
import { Button } from '../components/ui';
import { samSound } from '../utils/samSound';
import {
  detectCombination,
  canBeat,
  sortCardsByRank,
  sortCardsSmart,
} from '../utils/samEngineClient';

// Sam Modular UI Components & Styles
import '../components/sam/samMotion.css';
import SamPlayerSeat from '../components/sam/SamPlayerSeat';
import SamTable from '../components/sam/SamTable';
import SamActionBar from '../components/sam/SamActionBar';
import SamResultModal from '../components/sam/SamResultModal';
import SamWaitingRoom from '../components/sam/SamWaitingRoom';
import SamRulesModal from '../components/sam/SamRulesModal';
import SamCreateRoomModal from '../components/sam/SamCreateRoomModal';
import SamBotTestModal from '../components/sam/SamBotTestModal';
import SamBotDrawer from '../components/sam/SamBotDrawer';
import SamLobby from '../components/sam/SamLobby';

export default function SamGame() {
  const { roomId: urlRoomId } = useParams();
  const navigate = useNavigate();
  const { user, socket: authSocket, isAdmin } = useAuth();
  const {
    loading: availabilityLoading,
    game: gameInfo,
    isComingSoon,
    proceedAsAdmin,
  } = useGameAvailability('sam');

  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState('LOBBY'); // 'LOBBY', 'LEADERBOARD', 'RULES'

  // Loading & Global States
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Lobby Data
  const [rooms, setRooms] = useState([]);
  const [botTestRooms, setBotTestRooms] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myStats, setMyStats] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);

  // Active Match State
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [myHandCards, setMyHandCards] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  const [isSpectator, setIsSpectator] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(25);
  const [bannerMessage, setBannerMessage] = useState('');
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [startCountdownSec, setStartCountdownSec] = useState(null);
  const lastPlayedCountdownSecRef = useRef(null);

  // Sorting Mode for Hand: 'RANK' (3->2) or 'SMART' (Group combinations)
  const [sortMode, setSortMode] = useState('RANK');

  // Modals & Panels
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBotModal, setShowBotModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showDebugDrawer, setShowDebugDrawer] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [botDebugLogs, setBotDebugLogs] = useState([]);

  // Socket instance: authenticated socket from useAuth or fallback from socket service
  const socket = authSocket || getSocket();

  // ── DATA FETCHING ──
  const fetchLobbyData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const promises = [
        samGame.listRooms({ status: 'WAITING' }),
        samGame.getActiveRoom().catch(() => ({ room: null })),
        samGame.getLeaderboard({ limit: 50 }).catch(() => ({ data: [] })),
        samGame.getMyStats().catch(() => null),
      ];
      if (isAdmin) {
        promises.push(samGame.listBotTestRooms().catch(() => []));
      }

      const results = await Promise.all(promises);
      setRooms(results[0] || []);

      const activeRoomData = results[1]?.room;
      setActiveRoom(activeRoomData || null);
      if (activeRoomData && activeRoomData.status === 'PLAYING') {
        setRoom(activeRoomData);
      }

      setLeaderboard(results[2]?.data || []);
      setMyStats(results[3] || null);

      if (isAdmin && results[4]) {
        setBotTestRooms(results[4] || []);
      }
    } catch (err) {
      console.error('Failed to fetch Sam lobby data:', err);
      setErrorMsg(err.message || 'Không thể tải dữ liệu sảnh');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  const fetchRoomDetail = useCallback(async (roomIdToFetch) => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      let data = await samGame.getRoom(roomIdToFetch);
      if (data && data.room) {
        // Auto-join if user is logged in, room is in WAITING state, not a test room, and user is not yet in players
        if (
          user?.id &&
          data.room.status === 'WAITING' &&
          !data.room.isTest &&
          (!data.players || !data.players.some((p) => p.userId && Number(p.userId) === Number(user.id))) &&
          (data.players ? data.players.length : 0) < (data.room.maxPlayers || 4)
        ) {
          try {
            const joinedData = await samGame.joinRoom(roomIdToFetch);
            if (joinedData && joinedData.room) {
              data = joinedData;
            }
          } catch (joinErr) {
            console.warn('[SamGame] Auto-join notice:', joinErr.message);
          }
        }

        setRoom(data.room);
        if (data.room.serverTime) {
          setServerTimeOffset(new Date(data.room.serverTime).getTime() - Date.now());
        }
        setPlayers(data.players || []);
        setMyHandCards(data.myHandCards || []);
        setIsSpectator(Boolean(data.isSpectator));
        setSpectatorCount(data.spectatorCount || 0);
        setSelectedCards([]);
        if (data.result) {
          setGameResult(data.result);
        } else {
          setGameResult(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch Sam room detail:', err);
      setErrorMsg(err.response?.data?.message || 'Không thể vào phòng chơi');
    } finally {
      setActionLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (urlRoomId) {
      fetchRoomDetail(urlRoomId);
    } else {
      fetchLobbyData();
    }
  }, [urlRoomId, fetchRoomDetail, fetchLobbyData]);

  // Turn Countdown Timer (Server Authoritative)
  useEffect(() => {
    if (!room || room.status !== 'PLAYING' || !room.turnDeadline) {
      setTimeLeft(25);
      return;
    }

    const updateTimer = () => {
      const deadline = new Date(room.turnDeadline).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((deadline - now) / 1000));
      setTimeLeft(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [room?.turnDeadline, room?.status]);

  // Start Match 5-Second Countdown Timer (Server Authoritative)
  useEffect(() => {
    if (!room || room.status !== 'STARTING' || !room.startAt) {
      setStartCountdownSec(null);
      lastPlayedCountdownSecRef.current = null;
      return;
    }

    const updateCountdown = () => {
      const deadline = new Date(room.startAt).getTime();
      const now = Date.now() + serverTimeOffset;
      const diffMs = deadline - now;
      const sec = Math.max(0, Math.ceil(diffMs / 1000));
      setStartCountdownSec(sec);

      if (lastPlayedCountdownSecRef.current !== sec) {
        lastPlayedCountdownSecRef.current = sec;
        if (sec > 0) {
          samSound.playCountdownTick();
        } else if (sec === 0) {
          samSound.playCountdownStart();
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100);
    return () => clearInterval(interval);
  }, [room?.status, room?.startAt, serverTimeOffset]);

  // Socket.IO Listeners with 100% Guaranteed Cleanup
  useEffect(() => {
    if (!socket || !room?.id) return;

    // (Re)subscribe on mount and after every socket reconnect so a dropped
    // connection never leaves the client outside the room channel.
    const joinRoomChannel = () => socket.emit('sam:joinRoom', { roomId: room.id, isSpectator });
    joinRoomChannel();
    socket.on('connect', joinRoomChannel);

    // Authoritative snapshot pushed by the server right after the socket joins.
    const handleRoomState = (data) => {
      if (data?.room) setRoom(data.room);
      if (Array.isArray(data?.players)) setPlayers(data.players);
      if (Array.isArray(data?.myHandCards)) setMyHandCards(data.myHandCards);
      if (typeof data?.isSpectator === 'boolean') setIsSpectator(data.isSpectator);
    };

    const handleRoomUpdated = (data) => {
      if (data?.room) setRoom((prev) => ({ ...prev, ...data.room }));
    };

    const handlePlayerJoined = (data) => {
      if (data?.players) setPlayers(data.players);
    };

    const handlePlayerLeft = (data) => {
      if (data?.players) setPlayers(data.players);
    };

    const handlePlayerReady = (data) => {
      if (data?.players) setPlayers(data.players);
    };

    const handleStarting = (data) => {
      if (data?.room) {
        setRoom((prev) => ({ ...prev, ...data.room }));
        if (data.serverTime) {
          setServerTimeOffset(new Date(data.serverTime).getTime() - Date.now());
        }
      }
      if (data?.players) setPlayers(data.players);
      setBannerMessage('Tất cả đã sẵn sàng. Bắt đầu sau 5 giây…');
    };

    const handleStartingCancelled = (data) => {
      if (data?.room) setRoom((prev) => ({ ...prev, ...data.room }));
      if (data?.players) setPlayers(data.players);
      setBannerMessage(
        data?.reason === 'PLAYER_UNREADY'
          ? 'Đã hủy đếm ngược do người chơi hủy sẵn sàng'
          : 'Đã hủy đếm ngược do có người chơi rời phòng'
      );
    };

    const handleStarted = (data) => {
      if (data?.room) setRoom(data.room);
      if (data?.players) setPlayers(data.players);
      setGameResult(null);
      setBannerMessage('Trận đấu bắt đầu. 10 giây báo Sâm');
      samSound.playDeal();
    };

    const handleHandCards = (data) => {
      if (data?.handCards) {
        setMyHandCards(data.handCards);
        setSelectedCards([]);
      }
    };

    const handleSamDecision = (data) => {
      setPlayers((prev) =>
        prev.map((p) => {
          if (
            (p.userId && data.userId && Number(p.userId) === Number(data.userId)) ||
            (p.botId && data.userId && p.botId === data.userId) ||
            p.seatIndex === data.seatIndex
          ) {
            return { ...p, hasDeclaredSam: data.hasDeclaredSam };
          }
          return p;
        })
      );
    };

    const handleSamDeclared = (data) => {
      setBannerMessage(`${data.declarerName || 'Người chơi'} đã báo Sâm!`);
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              samPhase: 'PLAYING',
              samDeclarerId: data.userId,
              currentTurnUserId: data.currentTurnUserId,
              currentTurnSeat: data.currentTurnSeat,
              turnDeadline: data.turnDeadline,
            }
          : null
      );
      samSound.playTurnAlert();
    };

    const handleSamResolved = (data) => {
      setBannerMessage(
        data.isSam
          ? `${data.declarerName || 'Người xin Sâm'} xin Sâm và đi đầu ván!`
          : 'Ván đấu bắt đầu. Đánh bài tự do'
      );
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              samPhase: 'PLAYING',
              currentTurnUserId: data.currentTurnUserId,
              currentTurnSeat: data.currentTurnSeat,
              turnDeadline: data.turnDeadline,
            }
          : null
      );
    };

    const handleTurnChanged = (data) => {
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              currentTurnUserId: data.currentTurnUserId,
              currentTurnSeat: data.currentTurnSeat,
              turnDeadline: data.turnDeadline,
            }
          : null
      );
    };

    const handleCardsPlayed = (data) => {
      setBannerMessage(`${data.comboName || 'Bộ bài vừa đánh'}`);
      samSound.playCardPlay();

      // Synchronize player remaining count & room state
      setPlayers((prev) =>
        prev.map((p) => {
          if (
            (p.userId && data.userId && Number(p.userId) === Number(data.userId)) ||
            p.id === data.userId ||
            p.botId === data.userId
          ) {
            return { ...p, remainingCardsCount: data.remainingCount };
          }
          return p;
        })
      );

      setRoom((prev) =>
        prev
          ? {
              ...prev,
              lastPlayedCards: { cards: data.cards, name: data.comboName, userId: data.userId },
              currentTurnUserId: data.nextTurnUserId,
              currentTurnSeat: data.nextTurnSeat,
              turnDeadline: data.turnDeadline,
            }
          : null
      );
    };

    const handlePass = (data) => {
      setBannerMessage('Có người vừa bỏ lượt');
      samSound.playPass();

      setRoom((prev) => {
        if (!prev) return null;
        const passList = Array.isArray(prev.passPlayerIds) ? [...prev.passPlayerIds] : [];
        if (data.userId && !passList.includes(data.userId)) {
          passList.push(data.userId);
        }
        return {
          ...prev,
          passPlayerIds: passList,
          currentTurnUserId: data.nextTurnUserId,
          currentTurnSeat: data.nextTurnSeat,
          turnDeadline: data.turnDeadline,
        };
      });
    };

    const handleRoundReset = (data) => {
      setBannerMessage('Vòng mới. Đánh bộ bài tự do');
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              lastPlayedCards: null,
              passPlayerIds: [],
              currentTurnUserId: data.roundWinnerId,
              currentTurnSeat: data.roundWinnerSeat,
              roundNumber: data.roundNumber,
              turnDeadline: data.turnDeadline,
            }
          : null
      );
    };

    const handleChopped = (data) => {
      setBannerMessage(`Bị chặt 2 (+${data.points} điểm)`);
      samSound.playCardPlay(true);
    };

    const handleBaoMot = (data) => {
      setBannerMessage(`${data.playerName || 'Có người'} báo 1 lá`);
      samSound.playBaoMot();
      setPlayers((prev) =>
        prev.map((p) => {
          if (
            (p.userId && data.userId && Number(p.userId) === Number(data.userId)) ||
            p.botId === data.userId ||
            p.seatIndex === data.seatIndex
          ) {
            return { ...p, isBaoMot: true };
          }
          return p;
        })
      );
    };

    const handleGameFinished = (data) => {
      setGameResult(data.results || []);
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              status: 'FINISHED',
              isSamWin: data.isSamWin,
              winnerUserId: data.winnerUserId,
            }
          : null
      );
      samSound.playVictory();
    };

    const handleSpectatorCount = (data) => {
      if (data?.spectatorCount !== undefined) {
        setSpectatorCount(data.spectatorCount);
      }
    };

    const handleBotDebug = (data) => {
      if (isAdmin && data) {
        setBotDebugLogs((prev) => [
          { ...data, timestamp: new Date().toLocaleTimeString() },
          ...prev.slice(0, 49),
        ]);
      }
    };

    socket.on('sam:roomState', handleRoomState);
    socket.on('sam:roomUpdated', handleRoomUpdated);
    socket.on('sam:playerJoined', handlePlayerJoined);
    socket.on('sam:playerLeft', handlePlayerLeft);
    socket.on('sam:playerReady', handlePlayerReady);
    socket.on('sam:starting', handleStarting);
    socket.on('sam:startingCancelled', handleStartingCancelled);
    socket.on('sam:started', handleStarted);
    socket.on('sam:handCards', handleHandCards);
    socket.on('sam:samDecision', handleSamDecision);
    socket.on('sam:samDeclared', handleSamDeclared);
    socket.on('sam:samResolved', handleSamResolved);
    socket.on('sam:turnChanged', handleTurnChanged);
    socket.on('sam:cardsPlayed', handleCardsPlayed);
    socket.on('sam:pass', handlePass);
    socket.on('sam:roundReset', handleRoundReset);
    socket.on('sam:chopped', handleChopped);
    socket.on('sam:baoMot', handleBaoMot);
    socket.on('sam:gameFinished', handleGameFinished);
    socket.on('sam:spectatorCount', handleSpectatorCount);
    socket.on('sam:botDebug', handleBotDebug);

    return () => {
      socket.off('connect', joinRoomChannel);
      socket.emit('sam:leaveRoom', { roomId: room.id });
      socket.off('sam:roomState', handleRoomState);
      socket.off('sam:roomUpdated', handleRoomUpdated);
      socket.off('sam:playerJoined', handlePlayerJoined);
      socket.off('sam:playerLeft', handlePlayerLeft);
      socket.off('sam:playerReady', handlePlayerReady);
      socket.off('sam:starting', handleStarting);
      socket.off('sam:startingCancelled', handleStartingCancelled);
      socket.off('sam:started', handleStarted);
      socket.off('sam:handCards', handleHandCards);
      socket.off('sam:samDecision', handleSamDecision);
      socket.off('sam:samDeclared', handleSamDeclared);
      socket.off('sam:samResolved', handleSamResolved);
      socket.off('sam:turnChanged', handleTurnChanged);
      socket.off('sam:cardsPlayed', handleCardsPlayed);
      socket.off('sam:pass', handlePass);
      socket.off('sam:roundReset', handleRoundReset);
      socket.off('sam:chopped', handleChopped);
      socket.off('sam:baoMot', handleBaoMot);
      socket.off('sam:gameFinished', handleGameFinished);
      socket.off('sam:spectatorCount', handleSpectatorCount);
      socket.off('sam:botDebug', handleBotDebug);
    };
  }, [socket, room?.id, isSpectator, isAdmin]);

  // Identify current user's player entity
  const myPlayer = useMemo(() => {
    return players.find(
      (p) =>
        (p.userId && user?.id && Number(p.userId) === Number(user.id)) ||
        (!p.isBot && p.isHost && Number(p.userId) === Number(user?.id))
    );
  }, [players, user]);

  // Alert when it becomes player's turn
  const isMyTurn = useMemo(() => {
    if (!room || room.status !== 'PLAYING' || room.samPhase !== 'PLAYING') return false;
    if (!myPlayer) return false;
    return room.currentTurnSeat === myPlayer.seatIndex;
  }, [room, myPlayer]);

  useEffect(() => {
    if (isMyTurn) {
      samSound.playTurnAlert();
    }
  }, [isMyTurn]);

  // Selected Cards Combination Inspector
  const selectedCombo = useMemo(() => {
    return detectCombination(selectedCards);
  }, [selectedCards]);

  const beatResult = useMemo(() => {
    if (!isMyTurn || selectedCards.length === 0) return { canBeat: false, reason: '' };
    return canBeat(selectedCards, room?.lastPlayedCards);
  }, [isMyTurn, selectedCards, room?.lastPlayedCards]);

  const canPlaySelected = beatResult.canBeat;

  // Opponents Positioning (Relative to Bottom Player)
  const opponentPositions = useMemo(() => {
    const mySeat = myPlayer ? myPlayer.seatIndex : 0;
    const totalSeats = room?.maxPlayers || 4;

    const positions = { top: null, left: null, right: null };

    players.forEach((p) => {
      if (myPlayer && p.seatIndex === mySeat) return; // Self is bottom

      const relIndex = (p.seatIndex - mySeat + totalSeats) % totalSeats;
      if (totalSeats === 2) {
        positions.top = p;
      } else if (totalSeats === 3) {
        if (relIndex === 1) positions.left = p;
        if (relIndex === 2) positions.right = p;
      } else {
        if (relIndex === 1) positions.left = p;
        if (relIndex === 2) positions.top = p;
        if (relIndex === 3) positions.right = p;
      }
    });

    return positions;
  }, [players, myPlayer, room?.maxPlayers]);

  // ── USER ACTIONS ──
  const handleToggleCardSelection = (cardId) => {
    samSound.playSelect();
    setSelectedCards((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  };

  const handleSortHand = () => {
    samSound.playSelect();
    if (sortMode === 'RANK') {
      const sorted = sortCardsSmart(myHandCards);
      setMyHandCards(sorted);
      setSortMode('SMART');
    } else {
      const sorted = sortCardsByRank(myHandCards);
      setMyHandCards(sorted);
      setSortMode('RANK');
    }
  };

  const handleCreateRoom = async (formData) => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const res = await samGame.createRoom(formData);
      if (res?.room) {
        setRoom(res.room);
        setPlayers(res.players || []);
        navigate(`/games/sam/room/${res.room.id}`);
      }
      setShowCreateModal(false);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Không thể tạo phòng');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreatePracticeRoom = async (botCount = 3) => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const res = await samGame.createPracticeRoom({ botCount });
      if (res?.room) {
        setRoom(res.room);
        setPlayers(res.players || []);
        if (res.myHandCards) setMyHandCards(res.myHandCards);
        navigate(`/games/sam/room/${res.room.id}`);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Không thể tạo phòng luyện tập');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateBotRoom = async (formData) => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const res = await samGame.createBotTestRoom(formData);
      if (res?.room) {
        setRoom(res.room);
        setPlayers(res.players || []);
        navigate(`/games/sam/room/${res.room.id}`);
      }
      setShowBotModal(false);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Không thể tạo phòng Bot Test');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinRoom = async (targetRoomId) => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const res = await samGame.joinRoom(targetRoomId);
      if (res?.room) {
        setRoom(res.room);
        setPlayers(res.players || []);
        if (res.myHandCards) setMyHandCards(res.myHandCards);
        navigate(`/games/sam/room/${res.room.id}`);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Không thể tham gia phòng');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!room?.id) return;
    try {
      setActionLoading(true);
      await samGame.leaveRoom(room.id);
      setRoom(null);
      setPlayers([]);
      setMyHandCards([]);
      setSelectedCards([]);
      navigate('/games/sam');
      fetchLobbyData();
    } catch (err) {
      console.error('Leave room failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleReady = async (targetReady) => {
    if (!room?.id) return;
    try {
      setActionLoading(true);
      const res = await samGame.toggleReady(room.id, targetReady);
      if (res?.players) setPlayers(res.players);
      if (res?.room) setRoom(res.room);
    } catch (err) {
      console.error('Toggle ready failed:', err);
      setErrorMsg(err.response?.data?.message || 'Không thể thay đổi trạng thái sẵn sàng');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartMatch = async () => {
    if (!room?.id) return;
    try {
      setActionLoading(true);
      const res = await samGame.startMatch(room.id);
      if (res?.room) {
        setRoom(res.room);
        setPlayers(res.players || []);
        if (res.myHandCards) setMyHandCards(res.myHandCards);
        setGameResult(null);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể bắt đầu trận đấu');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePlayCards = async () => {
    if (!room?.id || selectedCards.length === 0 || !isMyTurn) return;
    try {
      setActionLoading(true);
      const res = await samGame.playCards(room.id, selectedCards);
      if (res) {
        setRoom(res.room);
        setPlayers(res.players || []);
        if (res.myHandCards) setMyHandCards(res.myHandCards);
        setSelectedCards([]);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Nước đi không hợp lệ');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePassTurn = async () => {
    if (!room?.id || !isMyTurn) return;
    try {
      setActionLoading(true);
      const res = await samGame.passTurn(room.id);
      if (res) {
        setRoom(res.room);
        setPlayers(res.players || []);
        if (res.myHandCards) setMyHandCards(res.myHandCards);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể bỏ lượt');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclareSam = async (declare) => {
    if (!room?.id) return;
    try {
      setActionLoading(true);
      const res = await samGame.declareSam(room.id, declare);
      if (res) {
        setRoom(res.room);
        setPlayers(res.players || []);
        if (res.myHandCards) setMyHandCards(res.myHandCards);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể báo Sâm');
    } finally {
      setActionLoading(false);
    }
  };

  // ── ADMIN BOT TEST CONTROLS ──
  const handlePauseBot = async () => {
    if (!room?.id) return;
    try {
      const res = await samGame.pauseBotTest(room.id);
      if (res?.room) setRoom(res.room);
    } catch (err) {
      console.error(err);
    }
  };

  const handleResumeBot = async () => {
    if (!room?.id) return;
    try {
      const res = await samGame.resumeBotTest(room.id);
      if (res?.room) setRoom(res.room);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStepBot = async () => {
    if (!room?.id) return;
    try {
      const res = await samGame.stepBotTest(room.id);
      if (res?.room) setRoom(res.room);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestartBot = async () => {
    if (!room?.id) return;
    try {
      const res = await samGame.restartBotTest(room.id);
      if (res?.room) {
        setRoom(res.room);
        setPlayers(res.players || []);
        if (res.myHandCards) setMyHandCards(res.myHandCards);
        setGameResult(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFillBots = async () => {
    if (!room?.id) return;
    try {
      const res = await samGame.fillBots(room.id);
      if (res?.players) setPlayers(res.players);
    } catch (err) {
      console.error(err);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // COMING SOON GUARD
  // ─────────────────────────────────────────────────────────────
  if (!availabilityLoading && isComingSoon) {
    return (
      <GameFullscreenShell
        title="Đánh Sâm"
        icon={Club}
        badge="Dân Gian"
        exitLabel="Quay lại"
        exitTo="/games"
      >
        <GameComingSoon
          gameKey="sam"
          name={gameInfo?.name || 'Đánh Sâm'}
          description={gameInfo?.description}
          isAdmin={isAdmin}
          onAdminProceed={proceedAsAdmin}
        />
      </GameFullscreenShell>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER PHASE 1: FULLSCREEN GAME SHELL (ACTIVE MATCH / FINISHED MATCH)
  // ─────────────────────────────────────────────────────────────
  if (room && (room.status === 'PLAYING' || room.status === 'FINISHED')) {
    const myId = user?.id;
    const isSelfPassed = Array.isArray(room?.passPlayerIds) && myId && room.passPlayerIds.some((pid) => String(pid) === String(myId));

    return (
      <GameFullscreenShell topBar={false} className="wr-sam-match-fullscreen">
        <div className="sam-arena-shell">
          {/* Top Bar Header */}
          <div className="sam-top-bar">
            <div className="sam-top-bar__left">
              <button
                type="button"
                className="sam-back-btn wr-game-exit-control"
                onClick={handleLeaveRoom}
                title="Rời phòng"
              >
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">Rời bàn</span>
                <span className="sm:hidden">Rời</span>
              </button>

              <div className="sam-room-title" title={room.title}>
                <span style={{ display: 'inline-flex', padding: 3, borderRadius: 5, background: '#b45309', color: '#fff', flexShrink: 0 }}>
                  <Club size={13} />
                </span>
                <span className="hidden sm:inline">{room.title}</span>
              </div>

              <span className="sam-badge sam-badge--code">
                {room.code}
              </span>

              {room.isTest && (
                <span className="sam-badge sam-badge--test">
                  <Bot size={11} /> TEST
                </span>
              )}

              {isSpectator && (
                <span className="sam-badge sam-badge--spectator">
                  <Eye size={11} /> ĐANG XEM
                </span>
              )}

              {spectatorCount > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#94a3b8' }}>
                  <Eye size={11} /> {spectatorCount}
                </span>
              )}
            </div>

            {/* Announcement Center Chip */}
            {bannerMessage && (
              <div className="sam-center-banner" title={bannerMessage}>
                {bannerMessage}
              </div>
            )}

            {/* Right Tools & Sound Controls */}
            <div className="sam-top-bar__right">
              {isAdmin && room.isTest && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDebugDrawer(!showDebugDrawer)}
                  style={{
                    background: showDebugDrawer ? '#b45309' : 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    borderColor: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <Sliders size={13} />
                  <span>Test Bot</span>
                </Button>
              )}

              <button
                type="button"
                onClick={() => setShowRulesModal(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                }}
              >
                <HelpCircle size={15} />
                <span className="hidden sm:inline">Luật</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextMute = samSound.toggleMute();
                  setSoundEnabled(!nextMute);
                }}
                title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: soundEnabled ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
              </button>
            </div>
          </div>

          {/* Central Arena Layout */}
          <div className="sam-board-layout">
            {/* OPPONENT TOP */}
            <div className="sam-seat-top">
              {opponentPositions.top && (
                <SamPlayerSeat
                  player={opponentPositions.top}
                  isTurn={room.currentTurnSeat === opponentPositions.top.seatIndex}
                  timeLeft={timeLeft}
                  position="top"
                  samPhase={room.samPhase}
                  samDeclarerId={room.samDeclarerId}
                  passPlayerIds={room.passPlayerIds}
                />
              )}
            </div>

            {/* MIDDLE ROW: OPPONENT LEFT, FELT TABLE, OPPONENT RIGHT */}
            <div className="sam-middle-row">
              {/* OPPONENT LEFT */}
              <div className="sam-seat-side">
                {opponentPositions.left && (
                  <SamPlayerSeat
                    player={opponentPositions.left}
                    isTurn={room.currentTurnSeat === opponentPositions.left.seatIndex}
                    timeLeft={timeLeft}
                    position="left"
                    samPhase={room.samPhase}
                    samDeclarerId={room.samDeclarerId}
                    passPlayerIds={room.passPlayerIds}
                  />
                )}
              </div>

              {/* TABLE FELT TRICK DROPZONE */}
              <SamTable
                room={room}
                timeLeft={timeLeft}
                isMyTurn={isMyTurn}
              />

              {/* OPPONENT RIGHT */}
              <div className="sam-seat-side">
                {opponentPositions.right && (
                  <SamPlayerSeat
                    player={opponentPositions.right}
                    isTurn={room.currentTurnSeat === opponentPositions.right.seatIndex}
                    timeLeft={timeLeft}
                    position="right"
                    samPhase={room.samPhase}
                    samDeclarerId={room.samDeclarerId}
                    passPlayerIds={room.passPlayerIds}
                  />
                )}
              </div>
            </div>

            {/* BOTTOM AREA: PLAYER HAND & ACTION BAR */}
            <SamActionBar
              user={user}
              myPlayer={myPlayer}
              myHandCards={myHandCards}
              selectedCards={selectedCards}
              onToggleCard={handleToggleCardSelection}
              onClearSelected={() => setSelectedCards([])}
              onSortHand={handleSortHand}
              sortMode={sortMode}
              isMyTurn={isMyTurn}
              isSelfPassed={isSelfPassed}
              isSpectator={isSpectator}
              samPhase={room.samPhase}
              canPlaySelected={canPlaySelected}
              selectedCombo={selectedCombo}
              beatReason={beatResult.reason}
              actionLoading={actionLoading}
              onPlayCards={handlePlayCards}
              onPassTurn={handlePassTurn}
              onDeclareSam={handleDeclareSam}
              hasTableCards={Boolean(room.lastPlayedCards)}
            />
          </div>

          {/* Admin Bot Test Control Drawer */}
          {isAdmin && room.isTest && (
            <SamBotDrawer
              isOpen={showDebugDrawer}
              onClose={() => setShowDebugDrawer(false)}
              room={room}
              botDebugLogs={botDebugLogs}
              onPauseBot={handlePauseBot}
              onResumeBot={handleResumeBot}
              onStepBot={handleStepBot}
              onFillBots={handleFillBots}
              onRestartBot={handleRestartBot}
            />
          )}

          {/* Game Result Modal */}
          <SamResultModal
            isOpen={Boolean(gameResult)}
            result={gameResult}
            isSamWin={room.samDeclarerId && Number(room.winnerUserId) === Number(room.samDeclarerId)}
            isTest={room.isTest}
            onPlayAgain={room.isTest && isAdmin ? handleRestartBot : handleStartMatch}
            onLeave={handleLeaveRoom}
          />

          {/* Rules Modal */}
          <SamRulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />
        </div>
      </GameFullscreenShell>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER PHASE 2: WAITING ROOM
  // ─────────────────────────────────────────────────────────────
  if (room && (room.status === 'WAITING' || room.status === 'STARTING')) {
    return (
      <GameFullscreenShell
        title="Đánh Sâm"
        icon={Club}
        badge={room.code ? `Phòng #${room.code}` : 'Phòng chờ'}
        exitLabel="Rời phòng"
        exitTo="/games/sam"
        onExit={handleLeaveRoom}
      >
        <SamWaitingRoom
          room={room}
          players={players}
          user={user}
          isAdmin={isAdmin}
          startCountdownSec={startCountdownSec}
          actionLoading={actionLoading}
          errorMsg={errorMsg}
          onDismissError={() => setErrorMsg(null)}
          onLeaveRoom={handleLeaveRoom}
          onToggleReady={handleToggleReady}
          onStartMatch={handleStartMatch}
          onFillBots={handleFillBots}
          onOpenRules={() => setShowRulesModal(true)}
        />
        <SamRulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />
      </GameFullscreenShell>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER PHASE 3: MAIN LOBBY & LEADERBOARD
  // ─────────────────────────────────────────────────────────────
  return (
    <GameFullscreenShell
      title="Đánh Sâm"
      icon={Club}
      badge="Dân gian"
      exitLabel="Thoát"
      exitTo="/games"
    >
      <SamLobby
        user={user}
        isAdmin={isAdmin}
        rooms={rooms}
        botTestRooms={botTestRooms}
        leaderboard={leaderboard}
        myStats={myStats}
        activeRoom={activeRoom}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        loading={loading}
        errorMsg={errorMsg}
        onDismissError={() => setErrorMsg(null)}
        onOpenCreateModal={() => setShowCreateModal(true)}
        onOpenBotModal={() => setShowBotModal(true)}
        onOpenRulesModal={() => setShowRulesModal(true)}
        onCreatePracticeRoom={handleCreatePracticeRoom}
        onJoinRoom={handleJoinRoom}
      />

      {/* Modals */}
      <SamCreateRoomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateRoom}
        loading={actionLoading}
      />

      {isAdmin && (
        <SamBotTestModal
          isOpen={showBotModal}
          onClose={() => setShowBotModal(false)}
          onSubmit={handleCreateBotRoom}
          loading={actionLoading}
        />
      )}

      <SamRulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />
    </GameFullscreenShell>
  );
}
