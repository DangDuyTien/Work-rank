import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { quizGame } from '../services/api';
import quizSound from '../components/quiz/quizSound';
import QuizLobby from '../components/quiz/QuizLobby';
import QuizWaitingRoom from '../components/quiz/QuizWaitingRoom';
import QuizQuestionCard from '../components/quiz/QuizQuestionCard';
import QuizAnswerButtons from '../components/quiz/QuizAnswerButtons';
import QuizRoundResultModal from '../components/quiz/QuizRoundResultModal';
import QuizLiveLeaderboard from '../components/quiz/QuizLiveLeaderboard';
import QuizFinalResults from '../components/quiz/QuizFinalResults';
import { Volume2, VolumeX, AlertCircle, LogOut, Trophy, Sparkles } from 'lucide-react';

export default function QuizGame() {
  const { user, socket } = useAuth();
  const { roomId: urlRoomId } = useParams();
  const navigate = useNavigate();

  // State
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [myAnswer, setMyAnswer] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [finalResults, setFinalResults] = useState(null);

  // Lobby state
  const [availableRooms, setAvailableRooms] = useState([]);
  const [activeRejoinRoom, setActiveRejoinRoom] = useState(null);
  const [myStats, setMyStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [lobbyLoading, setLobbyLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [soundMuted, setSoundMuted] = useState(quizSound.isMuted());

  // Timer countdown
  const [timeRemaining, setTimeRemaining] = useState(10);
  const [timeTotal, setTimeTotal] = useState(10);
  const timerRef = useRef(null);

  // Toggle sound
  const toggleSound = () => {
    const isNowMuted = quizSound.toggleMute();
    setSoundMuted(isNowMuted);
  };

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
  }, []);

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

  // Countdown timer logic
  const startTimer = useCallback((durationSeconds) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeTotal(durationSeconds);
    setTimeRemaining(durationSeconds);

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        if (prev - 1 <= 3) {
          quizSound.playTick(true);
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

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
        startTimer(Math.round((data.questionDurationMs || 10000) / 1000));
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
        startTimer(Math.round((data.questionDurationMs || 10000) / 1000));
      }
    };

    const onAnswerSubmitted = (data) => {
      // Someone answered
    };

    const onQuestionResult = (data) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setRoundResult(data);
      if (data.leaderboard) setPlayers(data.leaderboard);

      // Play sound based on result
      const myAns = data.answers?.find((a) => Number(a.userId) === Number(user?.id));
      if (myAns?.isCorrect) {
        quizSound.playCorrect();
      } else {
        quizSound.playWrong();
      }
    };

    const onGameFinished = (data) => {
      if (timerRef.current) clearInterval(timerRef.current);
      quizSound.playVictory();
      if (data.room) setRoom(data.room);
      if (data.players) setPlayers(data.players);
      setFinalResults(data);
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
      if (timerRef.current) clearInterval(timerRef.current);
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
  }, [socket, room?.id, user?.id, startTimer]);

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

  const handleLeaveRoom = async () => {
    if (!room?.id) return;
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

  const myCurrentPlayer = players.find((p) => Number(p.userId) === Number(user?.id));

  return (
    <div style={{ width: '100%', minHeight: 'calc(100vh - 120px)', padding: '16px 16px 24px', userSelect: 'none' }}>
      {/* Top Bar (Audio toggle, user points, leave room) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: 1040,
          margin: '0 auto 12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {room && (
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12,
                fontWeight: 800,
                color: '#64748b',
                background: 'rgba(15,23,42,0.05)',
                padding: '3px 8px',
                borderRadius: 4,
              }}
            >
              Phòng #{room.code}
            </span>
          )}

          {isPlayingOrShowing && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 10px',
                borderRadius: 6,
                background: 'rgba(2,132,199,0.08)',
                color: '#0284c7',
                fontSize: 12,
                fontWeight: 800,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              <Trophy size={13} color="#0284c7" />
              <span>{Number(myCurrentPlayer?.score || 0).toLocaleString()} pts</span>
            </div>
          )}
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
              padding: '4px 10px',
              background: soundMuted ? 'rgba(239,68,68,0.08)' : 'rgba(15,23,42,0.04)',
              color: soundMuted ? '#ef4444' : '#475569',
              border: '1px solid rgba(15,23,42,0.08)',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {soundMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            <span>{soundMuted ? 'Tắt' : 'Bật'}</span>
          </button>

          {room && (
            <button
              type="button"
              onClick={handleLeaveRoom}
              disabled={actionLoading}
              title="Rời khỏi phòng đấu"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                background: '#ffffff',
                border: '1px solid rgba(239,68,68,0.25)',
                color: '#ef4444',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <LogOut size={13} />
              <span>Rời phòng</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div
          style={{
            maxWidth: 1040,
            margin: '0 auto 14px',
            padding: '10px 14px',
            borderRadius: 8,
            background: '#fee2e2',
            border: '1px solid #ef4444',
            color: '#dc2626',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1. LOBBY VIEW */}
      {!room && (
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
      )}

      {/* 2. WAITING ROOM VIEW */}
      {room && isWaiting && (
        <QuizWaitingRoom
          room={room}
          players={players}
          currentUser={user}
          isHost={isHost}
          onStartGame={handleStartGame}
          onLeaveRoom={handleLeaveRoom}
          actionLoading={actionLoading}
        />
      )}

      {/* 3. ACTIVE GAMEPLAY VIEW */}
      {room && isPlayingOrShowing && !isFinished && currentQuestion && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            maxWidth: 960,
            margin: '0 auto',
          }}
        >
          {/* Question Card with Media */}
          <QuizQuestionCard
            question={currentQuestion}
            questionIndex={questionIndex}
            totalQuestions={totalQuestions}
            timeRemaining={timeRemaining}
            timeTotal={timeTotal}
            isLocked={Boolean(roundResult) || Boolean(selectedOption) || timeRemaining <= 0}
          />

          {/* 4 Clean Multiple Choice Options (A, B, C, D) */}
          <QuizAnswerButtons
            question={currentQuestion}
            selectedOption={selectedOption}
            revealedCorrectOption={roundResult?.correctOption}
            disabled={Boolean(roundResult) || timeRemaining <= 0}
            onSelectOption={handleSelectOption}
          />

          {/* Round Result Reveal Banner */}
          {roundResult && (
            <QuizRoundResultModal
              correctOption={roundResult.correctOption}
              explanation={roundResult.explanation}
              myAnswer={myAnswer}
              answers={roundResult.answers || []}
              leaderboard={players}
              isLastQuestion={roundResult.isLastQuestion}
            />
          )}

          {/* Bottom Player Avatar Dock */}
          <div style={{ marginTop: 6 }}>
            <QuizLiveLeaderboard
              players={players}
              currentUserId={user?.id}
            />
          </div>
        </div>
      )}

      {/* 4. FINAL RESULTS VIEW */}
      {room && isFinished && (
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
      )}
    </div>
  );
}
