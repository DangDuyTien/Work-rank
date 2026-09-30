import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { quizGame } from '../services/api';
import quizSound from '../components/quiz/quizSound';
import QuizLobby from '../components/quiz/QuizLobby';
import QuizWaitingRoom from '../components/quiz/QuizWaitingRoom';
import QuizTopBar from '../components/quiz/QuizTopBar';
import QuizQuestionCard from '../components/quiz/QuizQuestionCard';
import QuizAnswerPills from '../components/quiz/QuizAnswerPills';
import QuizTimerBar from '../components/quiz/QuizTimerBar';
import QuizMediaBox from '../components/quiz/QuizMediaBox';
import QuizPlayerStrip from '../components/quiz/QuizPlayerStrip';
import QuizRoundResultModal from '../components/quiz/QuizRoundResultModal';
import QuizFinalResults from '../components/quiz/QuizFinalResults';
import {
  AlertCircle,
  AlertTriangle,
  LogOut,
  Clock,
  Sparkles,
  Gamepad2,
  ArrowLeft,
  ArrowRight,
  Music,
  Image as ImageIcon,
  Trophy,
} from 'lucide-react';

export default function QuizGame() {
  const { user, socket } = useAuth();
  const { roomId: urlRoomId } = useParams();
  const navigate = useNavigate();

  // Room & gameplay state
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [myAnswer, setMyAnswer] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [finalResults, setFinalResults] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);

  // Lobby state
  const [availableRooms, setAvailableRooms] = useState([]);
  const [activeRejoinRoom, setActiveRejoinRoom] = useState(null);
  const [myStats, setMyStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [lobbyLoading, setLobbyLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [soundMuted, setSoundMuted] = useState(quizSound.isMuted());
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);

  // Server-authoritative timer
  const [timeRemaining, setTimeRemaining] = useState(10);
  const [timeTotal, setTimeTotal] = useState(10);
  const timerIntervalRef = useRef(null);
  const lastTickSecRef = useRef(null);

  // Toggle sound
  const toggleSound = () => {
    const isNowMuted = quizSound.toggleMute();
    setSoundMuted(isNowMuted);
  };

  // Push activity feed message
  const pushActivity = (name, text, color = '#38bdf8', avatar = null) => {
    setRecentActivity((prev) => [
      ...prev.slice(-8),
      { name, text, color, avatar, time: Date.now() },
    ]);
  };

  /**
   * Server-authoritative timer synchronizer:
   * Uses server questionStartTime + questionDurationMs to calculate exact deadline
   * Updates display countdown and locks answer when remaining <= 0
   */
  const syncServerTimer = useCallback((startTimeMs, durationMs, timeLimitSeconds = 10) => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    const totalDurationMs = Number(durationMs) || (Number(timeLimitSeconds) * 1000) || 10000;
    const startMs = Number(startTimeMs) || Date.now();
    const deadlineMs = startMs + totalDurationMs;
    const totalSec = Math.max(1, Math.round(totalDurationMs / 1000));
    setTimeTotal(totalSec);

    const calcRemaining = () => {
      const now = Date.now();
      const diffMs = deadlineMs - now;
      return Math.max(0, Math.ceil(diffMs / 1000));
    };

    const initialSec = calcRemaining();
    setTimeRemaining(initialSec);
    lastTickSecRef.current = initialSec;

    if (initialSec <= 0) return;

    timerIntervalRef.current = setInterval(() => {
      const remainingSec = calcRemaining();
      setTimeRemaining(remainingSec);

      if (remainingSec <= 3 && remainingSec > 0 && remainingSec !== lastTickSecRef.current) {
        quizSound.playTick(true);
      }
      lastTickSecRef.current = remainingSec;

      if (remainingSec <= 0) {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      }
    }, 100);
  }, []);

  // Fetch lobby rooms & stats
  const fetchLobbyData = useCallback(async () => {
    try {
      setLobbyLoading(true);
      setErrorMsg(null);
      const [roomsRes, activeRes, lbRes, statsRes] = await Promise.allSettled([
        quizGame.listRooms({ status: 'WAITING' }),
        quizGame.getActiveRoom(),
        quizGame.getLeaderboard(),
        quizGame.getMyStats(),
      ]);

      if (roomsRes.status === 'fulfilled') {
        setAvailableRooms(Array.isArray(roomsRes.value) ? roomsRes.value : (roomsRes.value?.data || []));
      }

      if (activeRes.status === 'fulfilled' && activeRes.value) {
        const activeData = activeRes.value?.room ? activeRes.value : (activeRes.value?.data || activeRes.value);
        if (activeData?.room) {
          setActiveRejoinRoom(activeData.room);
        } else {
          setActiveRejoinRoom(null);
        }
      }

      if (lbRes.status === 'fulfilled' && lbRes.value) {
        setLeaderboard(Array.isArray(lbRes.value.data) ? lbRes.value.data : []);
      }

      if (statsRes.status === 'fulfilled' && statsRes.value) {
        setMyStats(statsRes.value?.data || statsRes.value);
      }
    } catch (err) {
      console.error('Failed to load quiz lobby:', err);
    } finally {
      setLobbyLoading(false);
    }
  }, []);

  // Fetch full room detail
  const fetchRoomDetail = useCallback(async (roomIdToFetch) => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const res = await quizGame.getRoom(roomIdToFetch);
      const data = res?.room ? res : (res?.data || res);
      if (data && data.room) {
        setRoom(data.room);
        setPlayers(data.players || []);
        setCurrentQuestion(data.currentQuestion || null);
        setQuestionIndex(data.room.currentQuestionIndex || 0);
        setTotalQuestions(data.room.totalQuestions || 10);
        if (data.myAnswer) {
          setMyAnswer(data.myAnswer);
          setSelectedOption(data.myAnswer.selectedOption);
        } else {
          setMyAnswer(null);
          setSelectedOption(null);
        }

        if (data.room.status === 'PLAYING' && data.currentQuestion) {
          syncServerTimer(
            data.room.questionStartTime,
            data.room.questionDurationMs,
            data.currentQuestion.timeLimit || 10
          );
        }

        if (data.room.status === 'FINISHED') {
          setFinalResults(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch room detail:', err);
      setErrorMsg(err.response?.data?.message || 'Không thể tải phòng chơi');
    } finally {
      setActionLoading(false);
    }
  }, [syncServerTimer]);

  // Initial load
  useEffect(() => {
    if (urlRoomId) {
      fetchRoomDetail(urlRoomId);
    } else {
      setRoom(null);
      setCurrentQuestion(null);
      setRoundResult(null);
      setFinalResults(null);
      fetchLobbyData();
    }
  }, [urlRoomId, fetchRoomDetail, fetchLobbyData]);

  // Realtime Socket.IO Listeners
  useEffect(() => {
    if (!socket || !room?.id) return;

    socket.emit('quiz:joinRoom', { roomId: room.id });

    const onRoomUpdated = (data) => {
      if (data.room) setRoom(data.room);
      if (data.players) setPlayers(data.players);
    };

    const onPlayerJoined = (data) => {
      if (data.players) setPlayers(data.players);
      if (data.room) setRoom(data.room);
      const joinedUser = data.joinedUser || data.user;
      if (joinedUser) {
        pushActivity(joinedUser.name || 'Người chơi', 'đã tham gia phòng!', '#34d399');
      }
    };

    const onPlayerLeft = (data) => {
      if (data.players) setPlayers(data.players);
      if (data.room) setRoom(data.room);
    };

    const onGameStarted = (data) => {
      if (data.room) setRoom(data.room);
      if (data.players) setPlayers(data.players);
      if (data.question) {
        setCurrentQuestion(data.question);
        setQuestionIndex(data.questionIndex || 0);
        setTotalQuestions(data.totalQuestions || 10);
        setSelectedOption(null);
        setMyAnswer(null);
        setRoundResult(null);
        setFinalResults(null);
        syncServerTimer(data.questionStartTime, data.questionDurationMs, data.question.timeLimit || 10);
        pushActivity('Hệ thống', 'Trận đấu bắt đầu! Câu hỏi số 1', '#f59e0b');
      }
    };

    const onQuestion = (data) => {
      setRoundResult(null);
      setSelectedOption(null);
      setMyAnswer(null);
      if (data.question) {
        setCurrentQuestion(data.question);
        setQuestionIndex(data.questionIndex || 0);
        setTotalQuestions(data.totalQuestions || 10);
        syncServerTimer(data.questionStartTime, data.questionDurationMs, data.question.timeLimit || 10);
        pushActivity('Hệ thống', `Chuyển sang Câu ${Number(data.questionIndex || 0) + 1}`, '#f59e0b');
      }
    };

    const onAnswerSubmitted = (data) => {
      const p = players.find((pl) => Number(pl.userId) === Number(data.userId));
      if (p) {
        pushActivity(p.user?.name || 'Người chơi', 'đã chọn đáp án', '#94a3b8');
      }
    };

    const onQuestionResult = (data) => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setRoundResult(data);
      if (data.leaderboard) setPlayers(data.leaderboard);

      const myAns = data.answers?.find((a) => Number(a.userId) === Number(user?.id));
      if (myAns?.isCorrect) {
        quizSound.playCorrect();
        pushActivity('Bạn', `Đã trả lời đúng! (+${myAns.score}đ)`, '#34d399');
      } else {
        quizSound.playWrong();
      }
    };

    const onGameFinished = (data) => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      quizSound.playVictory();
      if (data.room) setRoom(data.room);
      if (data.players) setPlayers(data.players);
      setFinalResults(data);
      pushActivity('Hệ thống', 'Trận đấu kết thúc!', '#f59e0b');
    };

    socket.on('quiz:roomUpdated', onRoomUpdated);
    socket.on('quiz:playerJoined', onPlayerJoined);
    socket.on('quiz:playerLeft', onPlayerLeft);
    socket.on('quiz:started', onGameStarted);
    socket.on('quiz:question', onQuestion);
    socket.on('quiz:answerSubmitted', onAnswerSubmitted);
    socket.on('quiz:questionResult', onQuestionResult);
    socket.on('quiz:finished', onGameFinished);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      socket.emit('quiz:leaveRoom', { roomId: room.id });
      socket.off('quiz:roomUpdated', onRoomUpdated);
      socket.off('quiz:playerJoined', onPlayerJoined);
      socket.off('quiz:playerLeft', onPlayerLeft);
      socket.off('quiz:started', onGameStarted);
      socket.off('quiz:question', onQuestion);
      socket.off('quiz:answerSubmitted', onAnswerSubmitted);
      socket.off('quiz:questionResult', onQuestionResult);
      socket.off('quiz:finished', onGameFinished);
    };
  }, [socket, room?.id, user?.id, syncServerTimer, players]);

  // Actions
  const handleCreateRoom = async (formData) => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const res = await quizGame.createRoom(formData);
      const data = res?.room ? res : (res?.data || res);
      if (data?.room) {
        setRoom(data.room);
        setPlayers(data.players || []);
        navigate(`/games/quiz/room/${data.room.id}`);
      }
    } catch (err) {
      console.error('Failed to create room:', err);
      setErrorMsg(err.response?.data?.message || 'Không thể tạo phòng chơi');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinRoom = async (roomIdToJoin) => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const res = await quizGame.joinRoom(roomIdToJoin);
      const data = res?.room ? res : (res?.data || res);
      if (data?.room) {
        setRoom(data.room);
        setPlayers(data.players || []);
        navigate(`/games/quiz/room/${data.room.id}`);
      }
    } catch (err) {
      console.error('Failed to join room:', err);
      setErrorMsg(err.response?.data?.message || 'Không thể tham gia phòng');
    } finally {
      setActionLoading(false);
    }
  };

  const executeLeaveRoom = async () => {
    setShowLeaveConfirmModal(false);
    if (!room?.id) {
      navigate('/dashboard');
      return;
    }
    try {
      setActionLoading(true);
      await quizGame.leaveRoom(room.id);
      setRoom(null);
      setPlayers([]);
      setCurrentQuestion(null);
      setRoundResult(null);
      setFinalResults(null);
      navigate('/games/quiz');
      fetchLobbyData();
    } catch (err) {
      console.error('Failed to leave room:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestLeave = () => {
    if (isPlayingOrShowing && !isFinished) {
      setShowLeaveConfirmModal(true);
    } else if (room) {
      executeLeaveRoom();
    } else {
      navigate('/dashboard');
    }
  };

  const handleStartGame = async () => {
    if (!room?.id) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      await quizGame.startGame(room.id);
    } catch (err) {
      console.error('Failed to start game:', err);
      setErrorMsg(err.response?.data?.message || 'Không thể bắt đầu trận đấu');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectOption = async (optionKey) => {
    if (!room?.id || !currentQuestion?.id || selectedOption || timeRemaining <= 0) return;

    setSelectedOption(optionKey);
    quizSound.playSelect();

    try {
      const res = await quizGame.submitAnswer(room.id, {
        questionId: currentQuestion.id,
        selectedOption: optionKey,
      });
      const data = res?.data || res;
      if (data?.answer) {
        setMyAnswer(data.answer);
      }
    } catch (err) {
      console.error('Failed to submit answer:', err);
      setErrorMsg('Không gửi được đáp án');
    }
  };

  const isHost = Number(room?.hostUserId) === Number(user?.id);
  const isWaiting = room?.status === 'WAITING';
  const isPlayingOrShowing = room?.status === 'PLAYING' || room?.status === 'SHOWING_RESULT';
  const isFinished = room?.status === 'FINISHED' || Boolean(finalResults);

  const IS_COMING_SOON = true;

  if (IS_COMING_SOON) {
    return (
      <div
        className="quiz-game-shell quiz-game-shell--scrollable"
        style={{
          width: '100vw',
          minHeight: '100dvh',
          background: 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          color: '#ffffff',
          overflowX: 'hidden',
          userSelect: 'none',
          boxSizing: 'border-box',
        }}
      >
        {/* Top Header Bar */}
        <header
          style={{
            height: 58,
            width: '100%',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            boxSizing: 'border-box',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              <ArrowLeft size={14} />
              <span>Trang Chủ</span>
            </button>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'linear-gradient(135deg, #b45309 0%, #d97706 100%)',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: '0.4px',
              }}
            >
              <Sparkles size={14} />
              <span>ĐOÁN HÌNH & ĐOÁN NHẠC</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => navigate('/games/2048')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                border: 'none',
                fontSize: 12,
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(2,132,199,0.3)',
              }}
            >
              <Gamepad2 size={14} />
              <span>Chơi Game 2048</span>
            </button>
          </div>
        </header>

        {/* Centered Coming Soon Showcase Container */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            width: '100%',
            maxWidth: 720,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: '100%',
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 20,
              padding: '36px 32px',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Ambient Top Glow */}
            <div
              style={{
                position: 'absolute',
                top: -60,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 240,
                height: 120,
                background: 'radial-gradient(circle, rgba(245,158,11,0.25) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />

            {/* Coming Soon Pill */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                padding: '5px 14px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 900,
                color: '#f59e0b',
                letterSpacing: '0.8px',
                marginBottom: 16,
              }}
            >
              <Clock size={13} />
              <span>SẮP RA MẮT • COMING SOON</span>
            </div>

            <h1
              style={{
                margin: '0 0 12px',
                fontSize: 32,
                fontWeight: 950,
                color: '#ffffff',
                letterSpacing: '-0.5px',
                lineHeight: 1.2,
              }}
            >
              Đoán Hình & Đoán Nhạc
            </h1>

            <p
              style={{
                margin: '0 auto 28px',
                fontSize: 14,
                color: '#94a3b8',
                lineHeight: 1.6,
                maxWidth: 540,
                fontWeight: 500,
              }}
            >
              Chế độ mini game trực tuyến Đoán Hình & Đoán Nhạc đang được nâng cấp toàn diện hệ thống âm thanh, kho câu hỏi đa phương tiện và đồng bộ realtime. Tính năng sẽ sớm được phát hành cho toàn thể thành viên!
            </p>

            {/* Feature preview cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                marginBottom: 32,
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '16px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8', marginBottom: 6 }}>
                  <ImageIcon size={18} />
                  <strong style={{ fontSize: 13, color: '#ffffff' }}>Đoán Hình Ảnh</strong>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                  Thử thách thị giác nhanh tay tinh mắt với meme & biểu tượng
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '16px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ec4899', marginBottom: 6 }}>
                  <Music size={18} />
                  <strong style={{ fontSize: 13, color: '#ffffff' }}>Đoán Bài Hát</strong>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                  Nghe giai điệu ngắn và đoán tên bài hát hot hit
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '16px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b', marginBottom: 6 }}>
                  <Trophy size={18} />
                  <strong style={{ fontSize: 13, color: '#ffffff' }}>Thi Đấu Live</strong>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                  Đấu phòng nhiều người chơi và cập nhật BXH trực tiếp
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={() => navigate('/games/2048')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 22px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(2, 132, 199, 0.4)',
                }}
              >
                <Gamepad2 size={16} />
                <span>Chơi Game 2048 Ngay</span>
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                onClick={() => navigate('/games/capital-board')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '12px 18px',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <span>Cờ Tỷ Phú</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '12px 18px',
                  borderRadius: 10,
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <span>Về Bảng Điều Khiển</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`quiz-game-shell ${!isPlayingOrShowing && !isFinished ? 'quiz-game-shell--scrollable' : ''}`}
      style={{
        width: '100vw',
        minHeight: '100dvh',
        background: 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: isPlayingOrShowing ? 'space-between' : 'flex-start',
        overflowX: 'hidden',
        overflowY: isPlayingOrShowing ? 'hidden' : 'auto',
        userSelect: 'none',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. TOP BAR (Always Visible Across Entire Flow) */}
      <QuizTopBar
        room={room}
        questionIndex={questionIndex}
        totalQuestions={totalQuestions}
        playerCount={players.length}
        currentUser={user}
        soundMuted={soundMuted}
        onToggleSound={toggleSound}
        onLeaveRoom={handleRequestLeave}
        isLobby={!room}
      />

      {/* Global Error Notice */}
      {errorMsg && (
        <div
          style={{
            maxWidth: 1040,
            margin: '12px auto 0',
            padding: '10px 16px',
            borderRadius: 10,
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            fontSize: 13,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: 60,
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. LOBBY VIEW */}
      {!room && (
        <div style={{ width: '100%', padding: '20px 20px 40px', boxSizing: 'border-box' }}>
          <QuizLobby
            rooms={availableRooms}
            activeRejoinRoom={activeRejoinRoom}
            myStats={myStats}
            leaderboard={leaderboard}
            loading={lobbyLoading}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onRejoinRoom={(rId) => navigate(`/games/quiz/room/${rId}`)}
            onRefresh={fetchLobbyData}
          />
        </div>
      )}

      {/* 3. WAITING ROOM VIEW */}
      {room && isWaiting && (
        <div style={{ width: '100%', padding: '24px 20px 40px', boxSizing: 'border-box' }}>
          <QuizWaitingRoom
            room={room}
            players={players}
            currentUser={user}
            isHost={isHost}
            onStartGame={handleStartGame}
            onLeaveRoom={handleRequestLeave}
            actionLoading={actionLoading}
          />
        </div>
      )}

      {/* 4. ACTIVE GAMEPLAY VIEW */}
      {room && isPlayingOrShowing && !isFinished && currentQuestion && (
        <>
          <div className="quiz-game-main-stage">
            {/* Left Column — Question Text, 4 Large Answer Pills, Real Countdown Bar */}
            <div className="quiz-game-left-col">
              <QuizQuestionCard question={currentQuestion} />

              <QuizAnswerPills
                question={currentQuestion}
                selectedOption={selectedOption}
                revealedCorrectOption={roundResult?.correctOption}
                disabled={Boolean(roundResult) || timeRemaining <= 0}
                onSelectOption={handleSelectOption}
              />

              <QuizTimerBar
                timeRemaining={timeRemaining}
                timeTotal={timeTotal}
              />

              {roundResult && (
                <QuizRoundResultModal
                  correctOption={roundResult.correctOption}
                  explanation={roundResult.explanation}
                  myAnswer={myAnswer}
                  answers={roundResult.answers || []}
                  isLastQuestion={roundResult.isLastQuestion}
                />
              )}
            </div>

            {/* Right Column — Large Media Box (Image / Music Visualizer) */}
            <div className="quiz-game-right-col">
              <QuizMediaBox
                question={currentQuestion}
                isLocked={Boolean(roundResult) || timeRemaining <= 0}
              />
            </div>
          </div>

          {/* Bottom Dock — Live Activity + Player Tokens */}
          <QuizPlayerStrip
            players={players}
            currentUserId={user?.id}
            recentActivity={recentActivity}
          />
        </>
      )}

      {/* 5. FINAL RESULTS VIEW */}
      {room && isFinished && (
        <div style={{ width: '100%', padding: '24px 20px 40px', boxSizing: 'border-box' }}>
          <QuizFinalResults
            room={room}
            players={players}
            currentUserId={user?.id}
            onPlayAgain={() => {
              navigate('/games/quiz');
              fetchLobbyData();
            }}
            onBackToLobby={() => {
              navigate('/games/quiz');
              fetchLobbyData();
            }}
          />
        </div>
      )}

      {/* Leave Room Confirmation Modal */}
      {showLeaveConfirmModal && (
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
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 16,
              padding: 26,
              width: '100%',
              maxWidth: 420,
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
              color: '#ffffff',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <AlertTriangle size={24} />
            </div>

            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 900, color: '#ffffff' }}>
              Xác Nhận Rời Trận Đấu
            </h3>

            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
              Trận đấu đang diễn ra. Nếu bạn rời phòng lúc này, điểm số của câu hỏi hiện tại sẽ không được bảo lưu.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setShowLeaveConfirmModal(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Tiếp Tục Chơi
              </button>

              <button
                type="button"
                onClick={executeLeaveRoom}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 18px',
                  borderRadius: 8,
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(239,68,68,0.4)',
                }}
              >
                <LogOut size={14} />
                <span>Rời Phòng</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
