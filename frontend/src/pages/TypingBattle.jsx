import TypingPassage from '../components/TypingPassage';
import TypingArcadeView from '../components/arcade/TypingArcadeView';
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { typingGameApi, sendTypingProgressKeepalive } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useGameAvailability } from '../hooks/useGameAvailability';
import GameComingSoon from '../components/GameComingSoon';
import { arcadeSound as typingSound } from '../utils/arcadeSound';
import { graphemeCount, graphemes, normalizeText, sameCharacter } from '../utils/typingText';
import { createTypingSession } from '../utils/typingSession';
import { createTypingTelemetry } from '../utils/typingTelemetry';
import { PageShell } from '../components/ui';

// Local-first sync cadences: progress leaves the client at a human pace, never
// between a keypress and its paint. Server remains the authority for scores.
const PRACTICE_SYNC_CADENCE_MS = 1500;
const ROOM_SYNC_CADENCE_MS = 1000;
const DRAFT_SAVE_THROTTLE_MS = 1000;

// Helper to clean & sanitize challenge text to standard lowercase Vietnamese without punctuation
const sanitizeChallengeText = (text) => normalizeText(text);
const charCount = (text) => graphemeCount(text);
function countCurrentTextErrors(value, target) {
  const input = graphemes(value);
  const challenge = graphemes(target);
  let errors = 0;
  const comparedLength = Math.min(input.length, challenge.length);
  for (let index = 0; index < comparedLength; index += 1) {
    if (!sameCharacter(input[index], challenge[index])) errors += 1;
  }
  return errors;
}

function getDraftStorageKey(roomId, userId) {
  if (!roomId || !userId) return null;
  return `workrank:typing:draft:${roomId}:${userId}`;
}

function saveTypingDraft(roomId, userId, text, errors = 0, revision = 0, runKey = null) {
  const key = getDraftStorageKey(roomId, userId);
  if (!key) return;
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ text, errorCount: errors, revision, runKey, savedAt: Date.now() })
    );
  } catch {}
}

function loadTypingDraft(roomId, userId, runKey = null) {
  const key = getDraftStorageKey(roomId, userId);
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(key);
    const draft = raw ? JSON.parse(raw) : null;
    return runKey && draft?.runKey !== runKey ? null : draft;
  } catch {
    return null;
  }
}

function clearTypingDraft(roomId, userId) {
  const key = getDraftStorageKey(roomId, userId);
  if (!key) return;
  try {
    sessionStorage.removeItem(key);
  } catch {}
}

export default function TypingBattle() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { roomId: urlRoomId } = useParams();
  const { user, socket, isAdmin } = useAuth();
  const { isComingSoon, game: availabilityGame, proceedAsAdmin } = useGameAvailability('typing_battle');

  // Spectator Role & Live State
  const isSpectateRoute = location.pathname.includes('/spectate/') || searchParams.get('spectate') === '1';
  const [leavingRoom, setLeavingRoom] = useState(false);

  // Navigation Tabs: 'practice' (Instant Trainer) | 'arena' (Online PvP) | 'leaderboard'
  const [activeTab, setActiveTab] = useState('practice');

  // Time-based Test Settings: 30s, 60s (1 min), 120s (2 min), 300s (5 min)
  const [selectedDuration, setSelectedDuration] = useState(120); // Default: 2 minutes (120s)

  // Online Room & Gameplay State
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);

  // Check if current user is an active participant player in the room
  const isUserInPlayers = useMemo(() => {
    return players?.some((p) => p.userId && Number(p.userId) === Number(user?.id));
  }, [players, user?.id]);

  // Read-only spectator mode flag
  const isSpectator = isSpectateRoute || (!isUserInPlayers && (room?.status === 'PLAYING' || room?.status === 'FINISHED'));
  const [loading, setLoading] = useState(false);
  const [roomError, setRoomError] = useState(null);
  const [roomList, setRoomList] = useState([]);
  const [myStats, setMyStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isInputFocused, setIsInputFocused] = useState(true);

  // In-Game Typing State (Shared between Practice and Room Play)
  const [practiceStreamText, setPracticeStreamText] = useState('');
  const [typedText, setTypedText] = useState('');
  const [typedCharCount, setTypedCharCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [liveWpm, setLiveWpm] = useState(0);
  const [liveAccuracy, setLiveAccuracy] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(120);
  const [isFinished, setIsFinished] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const [countdownNumber, setCountdownNumber] = useState(null);
  const [practiceSubmissionResult, setPracticeSubmissionResult] = useState(null);

  // Typing engine refs (local-first: keystrokes never await the network)
  const inputRef = useRef(null);
  const inputRevisionRef = useRef(0);
  const typedTextRef = useRef('');
  const compositionRef = useRef(false);
  const lastCommittedInputRef = useRef('');
  const compositionEndTimerRef = useRef(null);
  const activeMatchKeyRef = useRef(null);
  const practiceAttemptRef = useRef(null);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceError, setPracticeError] = useState(null);
  const finishPendingRef = useRef(null);
  const timerRef = useRef(null);
  const lastTickSecondRef = useRef(0);

  // Local-first typing session: owns the incremental error map and the current
  // char for the challenge text in play. Keystrokes never wait for the network.
  const sessionRef = useRef({ target: null, session: null });
  const getSession = useCallback((target) => {
    const cached = sessionRef.current;
    if (cached.session && cached.target === target) return cached.session;
    const session = createTypingSession(target);
    sessionRef.current = { target, session };
    return session;
  }, []);
  const telemetry = useMemo(() => createTypingTelemetry(), []);
  const arcadeTypingRef = useRef({ combo: 0, best: 0, peakWord: -1, reactionId: 0, lastWrongSound: 0 });

  // Deferred sync scheduler: progress leaves the client at a human cadence,
  // never between a keypress and its paint. Failures keep the payload pending.
  const progressEmitRef = useRef({ timer: null, payload: null, lastAttempt: 0 });
  // Draft persistence is throttled so sessionStorage writes stay off the hot path.
  const draftRef = useRef({ timer: null, writer: null });

  // Keep the native caret/composition intact. The input also needs a real width:
  // Chromium insertText on a 1px input resets selection to zero for Vietnamese.
  // Only write the DOM for an external reset or restored draft.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input || compositionRef.current || input.value.normalize('NFC') === typedText) return;
    input.value = typedText;
    input.setSelectionRange(typedText.length, typedText.length);
  }, [typedText, room?.id, activeTab]);

  const flushTypingProgress = useCallback(({ force = false, keepalive = false } = {}) => {
    const state = progressEmitRef.current;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    const payload = state.payload;
    if (!payload) return;
    const cadence = payload.attemptId ? PRACTICE_SYNC_CADENCE_MS : ROOM_SYNC_CADENCE_MS;
    const wait = cadence - (Date.now() - state.lastAttempt);
    if (!force && wait > 0) {
      state.timer = setTimeout(() => {
        state.timer = null;
        flushTypingProgress();
      }, wait);
      return;
    }
    state.payload = null;
    state.lastAttempt = Date.now();
    const requeue = () => {
      if (!progressEmitRef.current.payload) progressEmitRef.current.payload = payload;
      if (!progressEmitRef.current.timer) {
        progressEmitRef.current.timer = setTimeout(() => {
          progressEmitRef.current.timer = null;
          flushTypingProgress();
        }, cadence);
      }
    };
    if (payload.attemptId) {
      typingGameApi.updatePracticeProgress(payload.attemptId, payload).then((a) => {
        const attempt = practiceAttemptRef.current;
        if (!attempt || attempt.attemptId !== a.attemptId) return;
        const firstServerClock = !attempt.startedAt && a.startedAt;
        practiceAttemptRef.current = { ...attempt, ...a };
        if (firstServerClock) setStartTime(new Date(a.startedAt).getTime() + Date.now() - new Date(a.serverNow).getTime());
      }).catch(requeue);
    } else if (keepalive) {
      sendTypingProgressKeepalive(payload);
    } else if (socket?.connected) {
      socket.emit('typing:progress', payload);
    } else {
      typingGameApi.updateProgress(payload.roomId, payload).catch(requeue);
    }
  }, [socket]);

  const queueTypingProgress = useCallback((payload) => {
    const state = progressEmitRef.current;
    state.payload = payload;
    if (state.timer) return;
    const cadence = payload.attemptId ? PRACTICE_SYNC_CADENCE_MS : ROOM_SYNC_CADENCE_MS;
    const wait = Math.max(0, cadence - (Date.now() - state.lastAttempt));
    state.timer = setTimeout(() => {
      state.timer = null;
      flushTypingProgress();
    }, wait);
  }, [flushTypingProgress]);

  const queueDraftSave = useCallback((writer) => {
    const state = draftRef.current;
    state.writer = writer;
    if (state.timer) return;
    state.timer = setTimeout(() => {
      state.timer = null;
      const pendingWriter = state.writer;
      state.writer = null;
      if (pendingWriter) pendingWriter();
    }, DRAFT_SAVE_THROTTLE_MS);
  }, []);

  const flushDrafts = useCallback(() => {
    const state = draftRef.current;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    const writer = state.writer;
    state.writer = null;
    if (writer) writer();
  }, []);

  const resetTypingSession = useCallback((text, target) => {
    const session = getSession(target);
    const snap = session.reset(text);
    arcadeTypingRef.current = { combo: 0, best: 0, peakWord: -1, reactionId: 0, lastWrongSound: 0 };
    typedTextRef.current = text;
    lastCommittedInputRef.current = text;
    setTypedText(text);
    setTypedCharCount(snap.charCount);
    setErrorCount(snap.errorCount);
    telemetry.patch({
      charCount: snap.charCount,
      errorCount: snap.errorCount,
      currentChar: snap.currentChar,
      targetLength: snap.targetLength,
      keyFeedback: null, combo: 0, bestCombo: 0, reaction: null, reactionId: 0,
    });
    return snap;
  }, [getSession, telemetry]);

  useEffect(() => () => {
    if (progressEmitRef.current.timer) clearTimeout(progressEmitRef.current.timer);
    if (draftRef.current.timer) clearTimeout(draftRef.current.timer);
    if (compositionEndTimerRef.current) cancelAnimationFrame(compositionEndTimerRef.current);
  }, []);

  // Flush draft + pending progress when the tab hides or unloads.
  useEffect(() => {
    const flushOnHide = () => {
      flushDrafts();
      flushTypingProgress({ force: true, keepalive: true });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushOnHide();
    };
    window.addEventListener('pagehide', flushOnHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flushOnHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [flushDrafts, flushTypingProgress]);

  // Challenge text determination
  const challengeText = useMemo(() => {
    if (room?.challengeText) {
      return sanitizeChallengeText(room.challengeText);
    }
    return practiceStreamText;
  }, [room, practiceStreamText]);

  // The active session mirrors the challenge currently rendered. A new session
  // is created (empty) only when the challenge text itself changes.
  const session = getSession(challengeText);
  const inputChars = session.getDisplayChars();

  // ── 1. GLOBAL KEYBOARD EVENT LISTENERS (SHORTCUTS & AUTOFOCUS) ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Restart shortcut: Escape when in practice mode
      if (e.key === 'Escape' && activeTab === 'practice' && !room) {
        e.preventDefault();
        handleRestartPractice();
        return;
      }

      // Auto focus input if user starts typing outside active input/textarea
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag !== 'input' && activeTag !== 'textarea') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
          inputRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, room]);

  // ── 2. FETCH INITIAL DATA & CHALLENGES ──
  const fetchHubData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, lbRes, roomsRes] = await Promise.all([
        typingGameApi.getMyStats().catch(() => null),
        typingGameApi.getLeaderboard({ limit: 50 }).catch(() => ({ leaderboard: [] })),
        typingGameApi.listRooms({ status: 'WAITING' }).catch(() => ({ rooms: [] })),
      ]);

      if (statsRes) setMyStats(statsRes.stats || statsRes);
      if (lbRes?.leaderboard) { setLeaderboard(lbRes.leaderboard);  }
      if (roomsRes?.rooms) setRoomList(roomsRes.rooms);

    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, []);

  const practicePrepareId = useRef(0);
  const preparePractice = useCallback(async (restart = false, duration = 120) => {
    if (!user?.id) return;
    const requestId = ++practicePrepareId.current;
    setPracticeLoading(true);
    setPracticeError(null);
    try {
      const existing = restart ? null : (await typingGameApi.activePracticeAttempt()).attempt;
      const a = existing || await typingGameApi.createPracticeAttempt({ durationLimitSeconds: duration, restart });
      if (requestId !== practicePrepareId.current) return;
      if (!a?.attemptId || typeof a.challengeText !== 'string' || !a.challengeText || !Number.isFinite(Number(a.durationLimitSeconds))) throw new Error('Máy chủ trả bài luyện tập không hợp lệ.');
      practiceAttemptRef.current = a;
      const draft = loadTypingDraft(`practice:${a.attemptId}`, user.id);
      const localWins = draft && Number(draft.revision) >= Number(a.inputRevision);
      const text = (localWins ? draft.text : a.typedText) || '';
      inputRevisionRef.current = Math.max(Number(draft?.revision || 0), Number(a.inputRevision || 0));
      const snap = resetTypingSession(text, a.challengeText);
      setPracticeStreamText(a.challengeText);
      setSelectedDuration(a.durationLimitSeconds);
      const serverStart = a.startedAt ? new Date(a.startedAt).getTime() + Date.now() - new Date(a.serverNow).getTime() : null;
      const elapsed = serverStart ? Math.max(0, (Date.now() - serverStart) / 1000) : 0;
      const correct = Math.max(0, snap.charCount - snap.errorCount);
      lastTickSecondRef.current = Math.floor(elapsed);
      setStartTime(serverStart);
      setTimeElapsed(Math.floor(elapsed));
      setTimeRemaining(Math.max(0, a.durationLimitSeconds - Math.floor(elapsed)));
      setLiveWpm(elapsed > 0 ? Math.round(correct / 5 / (Math.max(1, elapsed) / 60) * 10) / 10 : 0);
      setLiveAccuracy(snap.charCount ? Math.round(correct / snap.charCount * 1000) / 10 : 0);
      setIsFinished(false);
      setPracticeSubmissionResult(null);

      if (localWins && text) queueTypingProgress({ attemptId: a.attemptId, typedText: text, inputRevision: inputRevisionRef.current });
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch (error) {
      setPracticeError(error.response?.data?.message || 'Không thể chuẩn bị bài luyện tập. Hãy thử lại.');
    } finally {
      if (requestId === practicePrepareId.current) setPracticeLoading(false);
    }
  }, [user?.id, queueTypingProgress, resetTypingSession]);

  useEffect(() => {
    if (!urlRoomId && activeTab === 'practice') preparePractice(false);
  }, [urlRoomId, activeTab, preparePractice]);

  const fetchRoomDetail = useCallback(async (roomIdToFetch) => {
    try {
      setLoading(true);
      setRoomError(null);
      let data = await typingGameApi.getRoomDetail(roomIdToFetch);
      if (data && data.room) {
        // Auto-join if user is NOT in spectate mode, logged in, room is in WAITING state, user is not already in players, and room not full
        if (
          !isSpectateRoute &&
          user?.id &&
          data.room.status === 'WAITING' &&
          (!data.players || !data.players.some((p) => p.userId && Number(p.userId) === Number(user.id))) &&
          (data.players ? data.players.length : 0) < (data.room.maxPlayers || 2)
        ) {
          try {
            const joinedData = await typingGameApi.joinRoom(roomIdToFetch);
            if (joinedData && joinedData.room) {
              data = joinedData;
            }
          } catch (joinErr) {
            const status = joinErr.response?.status;
            const message = joinErr.response?.data?.message || joinErr.message || 'Không thể tham gia phòng thi đấu';
            console.warn('[TypingBattle] Auto-join notice:', message);
            if ([403, 404, 409].includes(status)) setRoomError(message);
          }
        }

        setRoom(data.room);
        setPlayers(data.players || []);
        if (data.result) {
          setMatchResult(data.result);
          if (data.room.status === 'FINISHED') {

          }
        }

        // Reconcile and restore draft progress on reload / room fetch
        if (data.room.status === 'PLAYING') {
          activeMatchKeyRef.current = `${data.room.id}:${data.room.startedAt}`;
          if (data.room.startedAt) {
            setStartTime(new Date(data.room.startedAt).getTime());
            setIsFinished(false);
          }
          const myPlayer = (data.players || []).find((p) => Number(p.userId) === Number(user?.id));
          if (myPlayer) {
            if (myPlayer.status === 'FINISHED') setIsFinished(true);
            const draft = loadTypingDraft(roomIdToFetch, user?.id, data.room.startedAt);
            const target = sanitizeChallengeText(data.room.challengeText || '');
            const serverRevision = Number(myPlayer.inputRevision || 0);
            const draftRevision = Number(draft?.revision || 0);
            let textToRestore = '';
            if (draft && typeof draft.text === 'string' && draftRevision >= serverRevision) {
              textToRestore = draft.text;
            } else if (typeof myPlayer.inputText === 'string') {
              textToRestore = myPlayer.inputText;
            } else if ((myPlayer.typedChars || 0) > 0 && data.room.challengeText) {
              textToRestore = ''; // Counts cannot reconstruct the user's actual text.
            }
            inputRevisionRef.current = Math.max(serverRevision, draftRevision);
            const errorsToRestore = countCurrentTextErrors(textToRestore, target);
            saveTypingDraft(roomIdToFetch, user?.id, textToRestore, errorsToRestore, inputRevisionRef.current, data.room.startedAt);
            if (textToRestore || myPlayer.typedChars === 0) {
              resetTypingSession(textToRestore, target);
              setLiveWpm(Number(myPlayer.wpm) || 0);
              setLiveAccuracy(Number(myPlayer.accuracy) || 0);
            }
          }
        } else if (data.room.status === 'FINISHED') {
          clearTypingDraft(roomIdToFetch, user?.id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch typing room detail:', err);
      navigate('/games/typing');
    } finally {
      setLoading(false);
    }
  }, [navigate, user?.id, isSpectateRoute, resetTypingSession]);

  const handleJoinExistingRoom = async (targetRoomId) => {
    try {
      setLoading(true);
      const res = await typingGameApi.joinRoom(targetRoomId);
      if (res?.room) {
        setRoom(res.room);
        setPlayers(res.players || []);
        navigate(`/games/typing/room/${res.room.id}`);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Không thể tham gia phòng thi đấu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (urlRoomId) {
      fetchRoomDetail(urlRoomId);
    } else {
      setRoom(null);
      setPlayers([]);
      setRoomError(null);
      fetchHubData();
    }
  }, [urlRoomId, fetchRoomDetail, fetchHubData]);

  // ── 3. REALTIME SOCKET EVENT LISTENERS ──
  useEffect(() => {
    if (!socket) return;

    const belongsToCurrentRoom = (data) => Boolean(urlRoomId) && Number(data?.roomId || data?.room?.id) === Number(urlRoomId);

    // Subscribe to the socket room only once the authoritative room is known.
    // Emitting on `urlRoomId` alone races the HTTP auto-join: a slow join leaves
    // the socket rejected (non-player in WAITING) and it never re-subscribes, so
    // the client silently misses every later event (ready/starting/started).
    const joinRoomChannel = () => {
      if (room?.id) {
        socket.emit(
          'typing:joinRoom',
          { roomId: Number(room.id), clientSpectatorHint: Boolean(isSpectator) },
          (res) => {
            if (res && res.ok === false) {
              setRoomError(res.error || 'Bạn không phải là người chơi trong phòng này.');
            } else if (res && res.ok) {
              setRoomError(null);
              if (!isSpectator && inputRevisionRef.current > 0) {
                queueTypingProgress({ roomId: room.id, typedText: typedTextRef.current, inputRevision: inputRevisionRef.current });
              }
            }
          }
        );
      }
    };
    const handleSocketReconnect = () => {
      joinRoomChannel();
      // Rooms may have started/finished while the socket was down.
      if (!urlRoomId) fetchHubData();
    };

    // Server-authoritative "this room is gone from every public list".
    const handleRoomRemoved = (data) => {
      const removedId = Number(data?.roomId);
      if (!removedId) return;
      setRoomList((prev) => prev.filter((r) => Number(r.id) !== removedId));
    };

    joinRoomChannel();
    socket.on('connect', handleSocketReconnect);
    socket.on('typing:roomRemoved', handleRoomRemoved);

    // Authoritative snapshot pushed by the server right after the socket joins.
    // Covers late join / reconnect where the original broadcasts were missed.
    const handleRoomState = (data) => {
      if (!belongsToCurrentRoom(data)) return;
      if (data?.room) {
        setRoom(data.room);
        if (data.room.status === 'PLAYING' && data.room.startedAt) {
          const key = `${data.room.id}:${data.room.startedAt}`;
          if (activeMatchKeyRef.current !== key) {
            activeMatchKeyRef.current = key;
            inputRevisionRef.current = 0;
            resetTypingSession('', sanitizeChallengeText(data.room.challengeText || ''));
            setIsFinished(false);
            setCountdownNumber(null);
            setStartTime(new Date(data.room.startedAt).getTime());
            setTimeRemaining(data.room.durationLimitSeconds);
          }
        }
      }
      if (Array.isArray(data?.players)) {
        setPlayers(data.players);
        if (data?.room?.status === 'PLAYING') {
          const myPlayer = data.players.find((p) => Number(p.userId) === Number(user?.id));
          if (myPlayer) {
            if (myPlayer.status === 'FINISHED') setIsFinished(true);
            const serverRevision = Number(myPlayer.inputRevision || 0);
            if (inputRevisionRef.current < serverRevision) {
              const draft = loadTypingDraft(data.room.id, user?.id, data.room.startedAt);
              let textToRestore = '';
              const draftRevision = Number(draft?.revision || 0);
              const target = sanitizeChallengeText(data.room?.challengeText || '');
              if (draft && typeof draft.text === 'string' && draftRevision >= serverRevision) {
                textToRestore = draft.text;
              } else if (typeof myPlayer.inputText === 'string') {
                textToRestore = myPlayer.inputText;
              } else if ((myPlayer.typedChars || 0) > 0 && data.room?.challengeText) {
                textToRestore = ''; // Counts cannot reconstruct the user's actual text.
              }
              inputRevisionRef.current = Math.max(serverRevision, draftRevision);
              const errorsToRestore = countCurrentTextErrors(textToRestore, target);
              saveTypingDraft(data.room.id, user?.id, textToRestore, errorsToRestore, inputRevisionRef.current, data.room.startedAt);
              if (textToRestore || myPlayer.typedChars === 0) {
                resetTypingSession(textToRestore, target);
                setLiveWpm(Number(myPlayer.wpm) || 0);
                setLiveAccuracy(Number(myPlayer.accuracy) || 0);
              }
            }
          }
        }
      }
      if (data?.result) {
        setMatchResult(data.result);
        if (data?.room?.status === 'FINISHED') {
          clearTypingDraft(data?.room?.id || room?.id, user?.id);

        }
      }
    };

    const handleRoomUpdated = (data) => {
      if (!belongsToCurrentRoom(data)) return;
      if (data?.room) {
        setRoom((prev) => ({ ...prev, ...data.room }));
      }
    };

    const handlePlayerJoined = (data) => {
      if (!belongsToCurrentRoom(data)) return;
      if (data?.players) setPlayers(data.players);
    };

    const handlePlayerLeft = (data) => {
      if (!belongsToCurrentRoom(data)) return;
      if (data?.players) setPlayers(data.players);
    };

    const handlePlayerReady = (data) => {
      if (!belongsToCurrentRoom(data)) return;
      if (data?.players) setPlayers(data.players);
    };

    const handleStarting = (data) => {
      if (!belongsToCurrentRoom(data)) return;
      if (data?.room) setRoom((prev) => ({ ...prev, ...data.room }));
      if (data?.players) setPlayers(data.players);
      setCountdownNumber(3);
    };

    const handleStartingCancelled = (data) => {
      if (!belongsToCurrentRoom(data)) return;
      setCountdownNumber(null);
      if (data?.room) setRoom((prev) => ({ ...prev, ...data.room }));
      if (data?.players) setPlayers(data.players);
    };

    const handleStarted = (data) => {
      if (!belongsToCurrentRoom(data)) return;
      const key = `${data.room?.id || room?.id}:${data.room?.startedAt || data.startedAt}`;
      if (activeMatchKeyRef.current === key) return;
      activeMatchKeyRef.current = key;
      setCountdownNumber(null);
      if (data?.room) setRoom(data.room);
      if (data?.players) setPlayers(data.players);
      clearTypingDraft(data?.room?.id || room?.id, user?.id);
      inputRevisionRef.current = 0;
      resetTypingSession('', sanitizeChallengeText(data.room?.challengeText || challengeText));
      setLiveWpm(0);
      setLiveAccuracy(0);
      lastTickSecondRef.current = 0;
      setStartTime(new Date(data.room?.startedAt || data.startedAt || Date.now()).getTime());
      setTimeElapsed(0);
      const duration = data.durationLimitSeconds || data.room?.durationLimitSeconds || 120;
      setTimeRemaining(duration);
      setIsFinished(false);
      setMatchResult(null);

      typingSound.playStart();
      setTimeout(() => inputRef.current?.focus(), 60);
    };

    const handleProgressBatch = (data) => {
      if (!belongsToCurrentRoom(data)) return;
      if (Array.isArray(data?.updates)) {
        setPlayers((prev) =>
          prev.map((p) => {
            const update = data.updates.find((u) => Number(u.userId) === Number(p.userId));
            if (update) {
              if (Number(update.inputRevision || 0) < Number(p.inputRevision || 0)) return p;
              return {
                ...p,
                ...update,
                progressPct: update.progressPct,
                typedChars: update.typedChars,
                wpm: update.wpm,
                accuracy: update.accuracy,
                errorCount: update.errorCount,
              };
            }
            return p;
          })
        );
      }
    };

    const handlePlayerFinished = (data) => {
      if (!belongsToCurrentRoom(data)) return;
      setPlayers((prev) =>
        prev.map((p) => {
          if (Number(p.userId) === Number(data.userId)) {
            return {
              ...p,
              status: 'FINISHED',
              individualRank: data.individualRank,
              wpm: data.wpm,
              accuracy: data.accuracy,
              typedChars: data.typedChars ?? p.typedChars,
              progressPct: data.progressPct ?? p.progressPct,
              completionTimeMs: data.completionTimeMs,
            };
          }
          return p;
        })
      );
    };

    const handleMatchFinished = (data) => {
      if (!belongsToCurrentRoom(data)) return;
      clearTypingDraft(data?.room?.id || room?.id, user?.id);
      setIsFinished(true);
      setMatchResult(data);

      if (data?.room) setRoom((prev) => ({ ...prev, ...data.room, status: 'FINISHED' }));
      typingSound.playWin();
      fetchHubData();
    };



    const handleRoomReset = (data) => {
      if (!belongsToCurrentRoom(data)) return;
      clearTypingDraft(data?.room?.id || room?.id, user?.id);
      inputRevisionRef.current = 0;
      resetTypingSession('', sanitizeChallengeText(data.room?.challengeText || challengeText));
      setLiveWpm(0);
      setLiveAccuracy(0);
      lastTickSecondRef.current = 0;
      setStartTime(null);
      setTimeElapsed(0);
      setIsFinished(false);
      setMatchResult(null);

      if (data?.room) setRoom(data.room);
      if (data?.players) setPlayers(data.players);
      const duration = data.room?.durationLimitSeconds || 120;
      setTimeRemaining(duration);
      setTimeout(() => inputRef.current?.focus(), 60);
    };

    const handleRoomListChanged = () => {
      if (!urlRoomId) {
        typingGameApi.listRooms({ status: 'WAITING' }).then((res) => {
          if (res?.rooms) setRoomList(res.rooms);
        }).catch(() => {});
      }
    };

    socket.on('typing:roomState', handleRoomState);
    socket.on('typing:roomUpdated', handleRoomUpdated);
    socket.on('typing:playerJoined', handlePlayerJoined);
    socket.on('typing:playerLeft', handlePlayerLeft);
    socket.on('typing:playerReady', handlePlayerReady);
    socket.on('typing:starting', handleStarting);
    socket.on('typing:startingCancelled', handleStartingCancelled);
    socket.on('typing:started', handleStarted);
    socket.on('typing:progressBatch', handleProgressBatch);
    socket.on('typing:playerFinished', handlePlayerFinished);
    socket.on('typing:matchFinished', handleMatchFinished);
    socket.on('typing:roomReset', handleRoomReset);
    socket.on('typing:roomListChanged', handleRoomListChanged);

    return () => {
      socket.off('connect', handleSocketReconnect);
      socket.off('typing:roomRemoved', handleRoomRemoved);
      if (room?.id) {
        socket.emit('typing:leaveRoom', { roomId: Number(room.id) });
      }
      socket.off('typing:roomState', handleRoomState);
      socket.off('typing:roomUpdated', handleRoomUpdated);
      socket.off('typing:playerJoined', handlePlayerJoined);
      socket.off('typing:playerLeft', handlePlayerLeft);
      socket.off('typing:playerReady', handlePlayerReady);
      socket.off('typing:starting', handleStarting);
      socket.off('typing:startingCancelled', handleStartingCancelled);
      socket.off('typing:started', handleStarted);
      socket.off('typing:progressBatch', handleProgressBatch);
      socket.off('typing:playerFinished', handlePlayerFinished);
      socket.off('typing:matchFinished', handleMatchFinished);
      socket.off('typing:roomReset', handleRoomReset);
      socket.off('typing:roomListChanged', handleRoomListChanged);
    };
  }, [socket, room?.id, urlRoomId, fetchHubData, isSpectator, queueTypingProgress, resetTypingSession, challengeText]);

  // Countdown timer effect
  useEffect(() => {
    if (countdownNumber === null) return;
    if (countdownNumber <= 0) return;
    const timer = setTimeout(() => {
      const next = countdownNumber - 1;
      setCountdownNumber(next);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdownNumber]);

  const finishCurrentRun = useCallback(async (text = typedTextRef.current, revision = inputRevisionRef.current) => {
    if (finishPendingRef.current) return finishPendingRef.current;
    // The final submit carries the full text; cancel the deferred queue and
    // persist the local draft so nothing is lost if the request fails.
    flushDrafts();
    if (progressEmitRef.current.timer) clearTimeout(progressEmitRef.current.timer);
    progressEmitRef.current.timer = null;
    progressEmitRef.current.payload = null;
    setIsFinished(true);
    setPracticeError(null);
    const work = (async () => {
      try {
        if (room?.id) {
          const detail = await typingGameApi.submitFinish(room.id, { typedText: text, inputRevision: revision });
          if (detail.room) setRoom(detail.room);
          if (detail.players) setPlayers(detail.players);
          if (detail.result) { setMatchResult(detail.result); clearTypingDraft(room.id, user?.id); }
        } else {
          const attempt = practiceAttemptRef.current;
          if (!attempt) throw new Error('Chưa có lượt luyện tập do máy chủ cấp.');
          // Ensure the first input has reached the server even if the network queue was interrupted.
          if (!attempt.startedAt && text) await typingGameApi.updatePracticeProgress(attempt.attemptId, { typedText: text, inputRevision: revision });
          const result = await typingGameApi.submitPracticeResult({ attemptId: attempt.attemptId, typedText: text, inputRevision: revision });
          setPracticeSubmissionResult(result);
          typingSound.playWin();
          setLiveWpm(result.wpm);
          setLiveAccuracy(result.accuracy);
          clearTypingDraft(`practice:${attempt.attemptId}`, user?.id);

          fetchHubData();
        }
      } catch (error) {
        setPracticeError(error.response?.data?.message || error.message || 'Chưa lưu được kết quả. Bản nháp vẫn được giữ.');
      } finally { finishPendingRef.current = null; }
    })();
    finishPendingRef.current = work;
    return work;
  }, [room?.id, user?.id, fetchHubData, flushDrafts]);

  // ── 4. TIME-BASED TEST ENGINE (COUNTDOWN & TIMEOUT FINALIZER) ──
  const effectiveTotalDuration = room?.durationLimitSeconds || selectedDuration;

  useEffect(() => {
    if (startTime && !isFinished && (!room || room.status === 'PLAYING')) {
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const elapsedSec = Math.max(1, Math.floor((now - startTime) / 1000));
        const remSec = Math.max(0, effectiveTotalDuration - elapsedSec);

        // Clock state commits only when the displayed second actually changes.
        setTimeElapsed((prev) => (prev === elapsedSec ? prev : elapsedSec));
        setTimeRemaining((prev) => (prev === remSec ? prev : remSec));

        // Live WPM/accuracy refresh once per second from the local session.
        if (lastTickSecondRef.current !== elapsedSec) {
          lastTickSecondRef.current = elapsedSec;
          const snap = sessionRef.current.session?.getSnapshot();
          const totalChars = snap ? snap.charCount : charCount(typedTextRef.current);
          const totalErrors = snap ? snap.errorCount : 0;
          const correctChars = Math.max(0, totalChars - totalErrors);
          const words = correctChars / 5;
          const minutes = Math.max(1000, now - startTime) / 60000;
          const currentWpm = minutes > 0 ? Math.round(words / minutes * 10) / 10 : 0;
          setLiveWpm((prev) => (prev === currentWpm ? prev : currentWpm));
          setLiveAccuracy((prev) => {
            const nextAccuracy = totalChars > 0 ? Math.max(0, Math.round((correctChars / totalChars) * 1000) / 10) : 0;
            return prev === nextAccuracy ? prev : nextAccuracy;
          });
        }

        // Auto Finish when Countdown reaches 0 (Time's Up!)
        if (remSec <= 0) {
          clearInterval(timerRef.current);
          finishCurrentRun();
        }
      }, 250);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [
    startTime,
    isFinished,
    effectiveTotalDuration,
    room?.status,
    finishCurrentRun,
  ]);

  // ── 5. PRACTICE ACTIONS & DURATION SELECTOR ──
  const handleDurationChange = (newDuration) => {
    setSelectedDuration(newDuration);
    setTimeRemaining(newDuration);
    setPracticeSubmissionResult(null);
    handleRestartPractice(newDuration);
  };

  const handleRestartPractice = (duration = selectedDuration) => {
    if (progressEmitRef.current.timer) clearTimeout(progressEmitRef.current.timer);
    progressEmitRef.current.timer = null;
    progressEmitRef.current.payload = null;
    practiceAttemptRef.current = null;
    inputRevisionRef.current = 0;
    setPracticeStreamText('');
    preparePractice(true, typeof duration === 'number' ? duration : selectedDuration);
    resetTypingSession('', challengeText);
    setLiveWpm(0);
    setLiveAccuracy(0);
    lastTickSecondRef.current = 0;
    setStartTime(null);
    setTimeElapsed(0);
    setTimeRemaining(effectiveTotalDuration);
    setIsFinished(false);

    setPracticeSubmissionResult(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleCompositionStart = () => {
    if (compositionEndTimerRef.current) {
      cancelAnimationFrame(compositionEndTimerRef.current);
      compositionEndTimerRef.current = null;
    }
    compositionRef.current = true;
    const attempt = practiceAttemptRef.current;
    if (room || !attempt || attempt.startedAt || practiceLoading) return;
    setStartTime((prev) => prev ?? Date.now());
    typingGameApi.updatePracticeProgress(attempt.attemptId, { start: true, typedText: typedTextRef.current, inputRevision: inputRevisionRef.current }).then((a) => {
      if (practiceAttemptRef.current?.attemptId !== a.attemptId) return;
      practiceAttemptRef.current = { ...practiceAttemptRef.current, ...a };
      if (a.startedAt) setStartTime(new Date(a.startedAt).getTime() + Date.now() - new Date(a.serverNow).getTime());
    }).catch(() => {
      // Local-first: the server clock sync retries with the next deferred flush;
      // a transient failure must never interrupt typing.
    });
  };

  const handleCompositionEnd = (event) => {
    const input = event.currentTarget;
    compositionRef.current = false;
    // Let the browser commit the composition first. The following native input
    // event is the canonical source; RAF is only a fallback for engines that
    // omit it, and duplicate values are ignored by lastCommittedInputRef.
    if (compositionEndTimerRef.current) cancelAnimationFrame(compositionEndTimerRef.current);
    compositionEndTimerRef.current = requestAnimationFrame(() => {
      compositionEndTimerRef.current = null;
      const value = input.value;
      const end = value.length;
      if (input.selectionStart !== end || input.selectionEnd !== end) input.setSelectionRange(end, end);
      if (value !== lastCommittedInputRef.current) {
        handleInputChange({ target: input, nativeEvent: { isComposing: false } });
      }
    });
  };

  const handleInputBeforeInput = (event) => {
    const input = event.currentTarget;
    const nativeEvent = event.nativeEvent;
    if (compositionRef.current || nativeEvent?.isComposing) return;
    const inputType = nativeEvent?.inputType || '';
    if (!inputType.startsWith('insert') && !inputType.startsWith('delete')) return;
    const end = input.value.length;
    if (input.selectionStart !== end || input.selectionEnd !== end) {
      event.preventDefault();
      input.setSelectionRange(end, end);
    }
  };

  // ── 6. INPUT ENGINE (FULL VIETNAMESE TELEX / VNI SUPPORT) ──
  // Local-first hot path: native value → incremental diff/score → paint.
  // No network, storage or timer work runs between a keypress and its render.
  const handleInputChange = (e) => {
    if (isFinished || (room && room.status !== 'PLAYING') || (!room && (practiceLoading || !practiceAttemptRef.current))) return;

    const session = getSession(challengeText);
    const composing = Boolean(e.nativeEvent?.isComposing || compositionRef.current);
    const snap = session.applyValue(e.target.value, { composing });

    // Composition updates are display-only. The committed native input event is
    // processed once after composition ends; never score intermediate Telex/VNI.
    if (snap.composing) {
      setTypedText(snap.value);
      return;
    }
    if (snap.delta.kind === 'none') {
      lastCommittedInputRef.current = snap.value;
      return;
    }
    const val = snap.value;
    typedTextRef.current = val;
    lastCommittedInputRef.current = val;

    const now = Date.now();
    const effectiveStartTime = startTime || now;
    const { delta } = snap;

    // Start timer on first committed keystroke
    if (!startTime && snap.charCount > 0) {
      setStartTime(effectiveStartTime);
    }

    const isTypingForward = delta.kind === 'append' || delta.kind === 'replace';
    const lastTypedChar = isTypingForward && snap.charCount > 0 ? session.getDisplayChars()[snap.charCount - 1] : '';
    const lastKeyCorrect = isTypingForward ? delta.lastKeyCorrect : null;

    setTypedText(val);
    setTypedCharCount(snap.charCount);
    setErrorCount(snap.errorCount);
    const mood = arcadeTypingRef.current;
    let reaction = null;
    if (isTypingForward && lastKeyCorrect === false) {
      mood.combo = 0; reaction = 'wrong';
      if (now - mood.lastWrongSound > 180) { mood.lastWrongSound = now; typingSound.playError(); }
    } else if (isTypingForward && /\s/u.test(lastTypedChar) && snap.charCount > mood.peakWord) {
      const entered = session.getDisplayChars(), target = session.getTargetChars();
      let from = snap.charCount - 2;
      while (from >= 0 && !/\s/u.test(target[from])) from--;
      if (entered.slice(from + 1, snap.charCount).every((c, n) => sameCharacter(c, target[from + 1 + n]))) {
        mood.peakWord = snap.charCount; mood.combo++; mood.best = Math.max(mood.best, mood.combo);
        reaction = [3, 5, 10, 20].includes(mood.combo) ? 'combo' : 'correct';
        typingSound.play(reaction === 'combo' ? 'combo' : 'correct');
      }
    }
    if (delta.kind === 'delete' && snap.errorCount === 0) reaction = 'action';
    if (reaction) mood.reactionId++;
    telemetry.patch({
      charCount: snap.charCount,
      errorCount: snap.errorCount,
      currentChar: snap.currentChar,
      targetLength: snap.targetLength,
      // Key feedback is local to the newest character; an earlier typo must not color later correct keys as errors.
      keyFeedback: isTypingForward ? (lastKeyCorrect ? 'correct' : 'error') : null,
      combo: mood.combo, bestCombo: mood.best, reaction: reaction || telemetry.getState().reaction, reactionId: mood.reactionId,
    });

    const inputRevision = inputRevisionRef.current + 1;
    inputRevisionRef.current = inputRevision;

    // Local metrics update immediately (same React batch as the paint).
    const accuracy = snap.charCount > 0 ? Math.max(0, Math.round(((snap.charCount - snap.errorCount) / snap.charCount) * 1000) / 10) : 0;
    setLiveAccuracy(accuracy);
    const minutes = Math.max(1000, now - effectiveStartTime) / 60000;
    const correctChars = Math.max(0, snap.charCount - snap.errorCount);
    setLiveWpm(Math.round((correctChars / 5) / minutes * 10) / 10);

    // Draft persistence is throttled; the sync scheduler coalesces the network.
    const draftWriter = () => {
      if (!room && practiceAttemptRef.current) {
        saveTypingDraft(`practice:${practiceAttemptRef.current.attemptId}`, user?.id, val, snap.errorCount, inputRevision);
      } else if (room?.id && user?.id) {
        saveTypingDraft(room.id, user.id, val, snap.errorCount, inputRevision, room.startedAt);
      }
    };

    // When the user finishes typing the entire challenge text in a multiplayer room:
    if (room && room.status === 'PLAYING' && snap.charCount >= snap.targetLength) {
      draftWriter();
      finishCurrentRun(val, inputRevision);
      return;
    }

    queueDraftSave(draftWriter);
    if (!room && practiceAttemptRef.current) {
      queueTypingProgress({ attemptId: practiceAttemptRef.current.attemptId, typedText: val, inputRevision });
    } else if (room?.id && room?.status === 'PLAYING') {
      queueTypingProgress({ roomId: room.id, typedText: val, inputRevision });
    }
  };

  // ── 7. LOBBY & ROOM MANAGEMENT HANDLERS ──
  const handleToggleReady = async () => {
    if (!room?.id) return;
    const me = (players || []).find((p) => Number(p.userId) === Number(user?.id));
    const nextState = room.mode === 'SOLO' ? true : !me?.isReady;
    try {
      if (socket) {
        socket.emit('typing:toggleReady', { roomId: room.id, isReady: nextState });
      } else {
        await typingGameApi.toggleReady(room.id, nextState);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSwitchTeam = async (targetTeam) => {
    if (!room?.id) return;
    try {
      if (socket) {
        socket.emit('typing:switchTeam', { roomId: room.id, team: targetTeam });
      } else {
        await typingGameApi.switchTeam(room.id, targetTeam);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResetRoom = async () => {
    if (!room?.id || loading) return;
    try {
      setLoading(true);
      let data = await typingGameApi.resetRoom(room.id);
      if (data.room?.mode === 'SOLO') data = await typingGameApi.toggleReady(room.id, true);
      if (data.room) setRoom(data.room);
      if (data.players) setPlayers(data.players);
    } catch (err) {
      setRoomError(err.message || 'Không thể đặt lại phòng');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (leavingRoom) return;
    if (!room?.id) {
      navigate('/games/typing');
      return;
    }
    setLeavingRoom(true);
    try {
      if (socket) {
        socket.emit('typing:leaveRoom', { roomId: room.id });
      }
      await typingGameApi.leaveRoom(room.id).catch(() => {});
    } finally {
      setRoom(null);
      setPlayers([]);
      setRoomError(null);
      setLeavingRoom(false);
      navigate('/games/typing');
    }
  };

  // ── 8. ELEGANT 2-LINE TYPING ARENA (SMOOTH 2-LINE ROLLING WINDOW) ──
  const renderedText = <TypingPassage challenge={challengeText} typedText={typedText} inputChars={inputChars} focused={isInputFocused} finished={isFinished} onFocusInput={() => inputRef.current?.focus()} />;

  // Server is the authority on player counts; the lobby never renders a card for
  // a room with zero seats (defensive against stale snapshots while it refetches).
  const playerCountOf = (r) => r.playerCount ?? r.players?.length ?? 0;
  const visibleRoomList = roomList.filter((r) => playerCountOf(r) > 0);

  // Coming Soon Screen Guard
  if (isComingSoon) {
    return (
      <PageShell className="typing-page">
        <GameComingSoon
          gameKey="typing_battle"
          name={availabilityGame?.name || 'WorkRank Typing Battle'}
          description={availabilityGame?.description}
          isAdmin={isAdmin}
          onAdminProceed={proceedAsAdmin}
        />
      </PageShell>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // DEDICATED ARENA ROOM VIEW (ONLINE MULTIPLAYER)
  // ══════════════════════════════════════════════════════════════════════════════
  const nativeInput = <input ref={inputRef} type="text" aria-label="Nội dung đang gõ" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
    onChange={handleInputChange} onCompositionStart={handleCompositionStart} onBeforeInput={handleInputBeforeInput} onCompositionEnd={handleCompositionEnd}
    onFocus={() => setIsInputFocused(true)} onBlur={() => setIsInputFocused(false)} onPaste={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()} disabled={isFinished || !room && (practiceLoading || !practiceAttemptRef.current)} />;
  return <TypingArcadeView user={user} room={room} players={players} isSpectator={isSpectator} roomError={roomError} loading={loading}
    practiceLoading={practiceLoading} practiceError={practiceError} activeTab={activeTab} setActiveTab={setActiveTab} selectedDuration={selectedDuration} setDuration={handleDurationChange}
    roomList={visibleRoomList} leaderboard={leaderboard} myStats={myStats} input={nativeInput} passage={renderedText} telemetry={telemetry}
    timeRemaining={timeRemaining} liveWpm={liveWpm} liveAccuracy={liveAccuracy} combo={arcadeTypingRef.current.combo} bestCombo={arcadeTypingRef.current.best}
    finished={isFinished} result={matchResult} practiceResult={practiceSubmissionResult} countdown={countdownNumber} onRestart={() => handleRestartPractice()}
    onLeave={() => room ? handleLeaveRoom() : navigate('/games')} onReady={handleToggleReady} onReset={handleResetRoom} onSwitchTeam={handleSwitchTeam}
    onRetry={() => isFinished ? finishCurrentRun() : preparePractice(false)} onJoin={(id) => navigate(`/games/typing/room/${id}`)}
    onCreate={async (mode, duration) => {
      try { const next = await typingGameApi.createRoom({ mode, title: `Đường đua ${mode === '1V1' ? 'Duo' : mode}`, matchType: 'RANKED', language: 'VI', difficulty: 'MEDIUM', durationLimitSeconds: duration }); navigate(`/games/typing/room/${next.room.id}`); }
      catch (e) { setRoomError(e.response?.data?.message || e.message); }
    }} />;
}
