import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Music2, Play, Users, Trophy, Loader2, Keyboard } from 'lucide-react';
import { Button, TabTransition } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useGameAvailability } from '../hooks/useGameAvailability';
import GameComingSoon from '../components/GameComingSoon';
import { musicRaceApi, typingGameApi } from '../services/api';
import { MUSIC_SONGS, songById, normalizeSong, validateSong } from '../games/music/catalog';
import { useMusicRace } from '../games/music/useMusicRace';
import { AUDIO_STATE } from '../games/music/engine';
import MusicStage from '../components/music/MusicStage';
import LyricKaraoke from '../components/music/LyricKaraoke';
import MusicHud from '../components/music/MusicHud';
import MusicSongPicker from '../components/music/MusicSongPicker';
import MusicResult from '../components/music/MusicResult';
import MusicBoard from '../components/music/MusicBoard';
import { arcadeSound } from '../utils/arcadeSound';
import '../components/arcade/arcade.css';
import '../components/music/music-race.css';

const ROOM_MODES = [
  { id: 'SOLO', label: 'Một mình' },
  { id: '1V1', label: '1 chọi 1' },
  { id: 'TRIO', label: 'Ba người' },
];

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <p className="music-toast" key={toast.id} role="status">
      {toast.text}
    </p>
  );
}

function RoomLobby({ room, players, user, countdown, onReady, onLeave, song, busy }) {
  const me = players.find((player) => Number(player.userId) === Number(user?.id));
  const isHost = Number(room.hostUserId) === Number(user?.id);
  return (
    <section className="music-lobby">
      <p className="arcade-kicker">PHÒNG ĐUA · CÙNG BÀI, CÙNG NHỊP</p>
      <h2>{song?.title || room.title}</h2>
      <p className="music-lobby-sub">
        {song ? `${song.artist} · ${song.difficultyLabel} · ${Math.round(song.durationMs / 1000)} giây` : 'Đang tải bài hát…'}
      </p>

      <ul className="music-lobby-players">
        {players.map((player) => (
          <li key={player.userId} data-ready={player.isReady ? 'true' : 'false'}>
            <span className="music-lobby-avatar">{(player.user?.name || '?').slice(0, 1).toUpperCase()}</span>
            <span>
              <b>{player.user?.name || `Người chơi ${player.seatIndex + 1}`}</b>
              <small>{player.isReady ? '✓ Sẵn sàng' : 'Đang chuẩn bị'}</small>
            </span>
          </li>
        ))}
      </ul>

      {countdown !== null ? (
        <p className="music-lobby-count">{countdown > 0 ? countdown : 'BẮT ĐẦU!'}</p>
      ) : (
        <div className="music-lobby-actions">
          <Button onClick={onReady} disabled={busy}>{me?.isReady ? 'Hủy sẵn sàng' : 'Tôi đã sẵn sàng'}</Button>
          <Button variant="secondary" onClick={onLeave}>Rời phòng</Button>
        </div>
      )}

      <p className="music-lobby-note">
        Mỗi người nghe audio trên máy mình. Ai bị kẹt ở cuối câu thì nhạc người đó dừng — vị trí trên đường đua tính theo số câu đã gõ xong, không theo đồng hồ audio.
        {isHost ? ' Bạn là chủ phòng: mọi người sẵn sàng là trận bắt đầu.' : ''}
      </p>
    </section>
  );
}

export default function MusicRace() {
  const navigate = useNavigate();
  const { roomId: urlRoomId } = useParams();
  const { user, socket } = useAuth();
  const { isComingSoon, game: availabilityGame, proceedAsAdmin, isAdmin } = useGameAvailability('typing_battle');

  const [songs, setSongs] = useState(MUSIC_SONGS);
  const [selectedSong, setSelectedSong] = useState(null);
  const [phase, setPhase] = useState('pick');
  const [sessionKey, setSessionKey] = useState(0);
  const [toast, setToast] = useState(null);
  const [mode, setMode] = useState('SOLO');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [roomError, setRoomError] = useState(null);

  const [localResult, setLocalResult] = useState(null);
  const [serverResult, setServerResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [bestBySong, setBestBySong] = useState({});
  const [boardTab, setBoardTab] = useState('songs');
  const [board, setBoard] = useState([]);
  const [boardLoading, setBoardLoading] = useState(false);

  const attemptRef = useRef(null);
  const toastTimer = useRef(null);
  const progressTimer = useRef(null);
  const revisionRef = useRef(0);
  const engineRef = useRef(null);
  const startTimeoutRef = useRef(null);
  const roomRef = useRef(null);

  const isRoomMode = Boolean(urlRoomId);
  const roomSong = useMemo(() => (room?.musicSongId ? songById(room.musicSongId) : null), [room?.musicSongId]);
  const activeSong = isRoomMode ? roomSong : selectedSong;

  const showToast = useCallback((text) => {
    setToast({ id: Date.now() + Math.random(), text });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1100);
  }, []);

  const handleEngineEvent = useCallback((event) => {
    if (!event) return;
    if (event.type === 'line:ready') {
      arcadeSound.play('correct');
      showToast('✓ THEO KỊP!');
    } else if (event.type === 'boundary:pause') {
      arcadeSound.playError();
    } else if (event.type === 'boundary:resume') {
      arcadeSound.playStart();
      showToast('♫ TIẾP TỤC!');
    } else if (event.type === 'song:finished') {
      arcadeSound.playWin();
    }
  }, [showToast]);

  const { snapshot, ready, error: audioError, start, engine, inputRef, inputProps } = useMusicRace({
    song: activeSong,
    active: Boolean(activeSong) && phase !== 'pick' && phase !== 'result',
    restartKey: sessionKey,
    onEvent: handleEngineEvent,
  });

  useEffect(() => { engineRef.current = engine; }, [engine]);

  // The catalog is data, not code: the server is the publish gate, the bundled
  // JSON is the offline fallback so the game still opens without a network.
  useEffect(() => {
    let alive = true;
    musicRaceApi.listSongs()
      .then((data) => {
        if (!alive || !Array.isArray(data?.songs) || data.songs.length === 0) return;
        // Never offer a song the client cannot actually play.
        const playable = data.songs.map(normalizeSong).filter((song) => validateSong(song).length === 0);
        if (playable.length) setSongs(playable);
      })
      .catch(() => {});
    musicRaceApi.myStats().then((data) => { if (alive) setBestBySong(data?.bestBySong || {}); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (boardTab !== 'board' || isRoomMode) return undefined;
    let alive = true;
    setBoardLoading(true);
    musicRaceApi.leaderboard({ limit: 20 })
      .then((data) => { if (alive) setBoard(data?.leaderboard || []); })
      .catch(() => { if (alive) setBoard([]); })
      .finally(() => { if (alive) setBoardLoading(false); });
    return () => { alive = false; };
  }, [boardTab, isRoomMode]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (progressTimer.current) clearInterval(progressTimer.current);
    if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
  }, []);

  // On phones the virtual keyboard shrinks the visual viewport. Keep the line
  // the player is typing inside what they can actually see.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    const keepLineVisible = () => {
      if (document.activeElement !== inputRef.current) return;
      const area = document.querySelector('.music-sing-area');
      const rect = area?.getBoundingClientRect();
      if (!rect) return;
      const overflow = rect.bottom - (viewport.height - 12);
      if (overflow > 0) window.scrollBy({ top: overflow + 16, behavior: 'smooth' });
    };
    viewport.addEventListener('resize', keepLineVisible);
    return () => viewport.removeEventListener('resize', keepLineVisible);
  }, [inputRef]);

  const firstLineStart = activeSong?.lines?.[0]?.startMs ?? 0;
  const introRemaining = snapshot && snapshot.audioMs < firstLineStart
    ? Math.max(0, Math.ceil((firstLineStart - snapshot.audioMs) / 1000))
    : 0;

  // ── Solo run ────────────────────────────────────────────────────────────────
  const submitRun = useCallback(async (evidence) => {
    setLocalResult(evidence);
    setPhase('result');
    setSaving(true);
    setSubmitError(null);
    try {
      if (isRoomMode && roomRef.current?.id) {
        const detail = await typingGameApi.submitFinish(roomRef.current.id, {
          typedText: evidence.typedText,
          inputRevision: revisionRef.current,
          music: evidence,
        });
        const mine = (detail?.result?.results || []).find((row) => String(row.userId) === String(user.id));
        setServerResult(mine || detail?.result || null);
        if (detail?.room) setRoom(detail.room);
      } else {
        const attempt = attemptRef.current;
        if (!attempt?.attemptId) throw new Error('Chưa có lượt chơi do máy chủ cấp.');
        const response = await musicRaceApi.finish({ ...evidence, attemptId: attempt.attemptId, music: evidence });
        setServerResult(response?.result || response);
      }
    } catch (error) {
      setSubmitError(error?.response?.data?.message || error?.message || 'Không gửi được kết quả.');
    } finally {
      setSaving(false);
    }
  }, [isRoomMode, user?.id]);

  const handleFinishRef = useRef(null);
  useEffect(() => { handleFinishRef.current = (instance) => submitRun(instance.getEvidence()); }, [submitRun]);

  const handleStart = useCallback(() => {
    if (!ready) return;
    const started = start();
    if (!started) return;
    setPhase('playing');
    if (!isRoomMode) {
      attemptRef.current = null;
      musicRaceApi.createAttempt({ songId: activeSong.id })
        .then((attempt) => { attemptRef.current = attempt; })
        .catch(() => { attemptRef.current = null; });
    }
  }, [ready, start, activeSong?.id, isRoomMode]);

  // The song's own ending closes the run; the engine emits it once.
  const finishedRef = useRef(false);
  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.state === AUDIO_STATE.FINISHED && !finishedRef.current && phase === 'playing') {
      finishedRef.current = true;
      const instance = engineRef.current;
      if (instance) handleFinishRef.current(instance);
    }
  }, [snapshot, phase]);

  const handleSelectSong = (song) => {
    setSelectedSong(song);
    setServerResult(null);
    setLocalResult(null);
    setSubmitError(null);
    setPhase('ready');
    setSessionKey((key) => key + 1);
    finishedRef.current = false;
  };

  const handleReplay = () => {
    setServerResult(null);
    setLocalResult(null);
    setSubmitError(null);
    setPhase('ready');
    setSessionKey((key) => key + 1);
    finishedRef.current = false;
  };

  // ── Room mode ───────────────────────────────────────────────────────────────
  const createRoom = async () => {
    if (!selectedSong || creating) return;
    setCreating(true);
    setRoomError(null);
    try {
      const created = await typingGameApi.createRoom({
        mode,
        songId: selectedSong.id,
        title: `${selectedSong.title} · ${ROOM_MODES.find((m) => m.id === mode)?.label || mode}`,
        matchType: 'RANKED',
        difficulty: selectedSong.difficulty,
        language: 'VI',
        durationLimitSeconds: Math.ceil(selectedSong.durationMs / 1000) + 2,
      });
      navigate(`/games/typing/music/room/${created.room.id}`);
    } catch (error) {
      setRoomError(error?.response?.data?.message || error?.message || 'Không mở được phòng.');
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    if (!urlRoomId) return undefined;
    let alive = true;
    setBusy(true);
    typingGameApi.getRoomDetail(urlRoomId)
      .then((detail) => {
        if (!alive) return;
        setRoom(detail.room);
        setPlayers(detail.players || []);
        if (detail.room?.status === 'PLAYING') {
          setPhase('playing');
          finishedRef.current = false;
        }
      })
      .catch((error) => { if (alive) setRoomError(error?.response?.data?.message || 'Không vào được phòng.'); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [urlRoomId]);

  useEffect(() => { roomRef.current = room; }, [room]);

  useEffect(() => {
    if (!socket || !urlRoomId) return undefined;
    const roomId = Number(urlRoomId);
    const belongs = (data) => Number(data?.roomId || data?.room?.id) === roomId;

    const onState = (data) => {
      if (!belongs(data)) return;
      if (data.room) setRoom(data.room);
      if (Array.isArray(data.players)) setPlayers(data.players);
    };
    const onPlayers = (data) => { if (belongs(data) && Array.isArray(data.players)) setPlayers(data.players); };
    const onStarting = (data) => { if (belongs(data)) setCountdown(3); };
    const onStartingCancelled = (data) => { if (belongs(data)) { setCountdown(null); if (data.players) setPlayers(data.players); } };

    const onStarted = (data) => {
      if (!belongs(data)) return;
      setCountdown(null);
      if (data.room) setRoom(data.room);
      if (Array.isArray(data.players)) setPlayers(data.players);
      setPhase('playing');
      finishedRef.current = false;
      const startedAt = new Date(data.room?.startedAt || data.startedAt || Date.now()).getTime();
      const lead = 900;
      const delay = Math.max(0, startedAt + lead - Date.now());
      if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
      startTimeoutRef.current = setTimeout(() => {
        // Audio-ready gate + autoplay: retry briefly instead of starting a race
        // on a file that is still decoding. A blocked play() leaves the engine
        // in PREPARING and the UI offers "vào nhịp" rather than faking it.
        let attempts = 0;
        const tryStart = () => {
          if (start() || attempts > 25) return;
          attempts += 1;
          startTimeoutRef.current = setTimeout(tryStart, 120);
        };
        tryStart();
      }, delay);
    };

    const onMatchFinished = (data) => {
      if (!belongs(data)) return;
      const mine = (data.results || []).find((row) => String(row.userId) === String(user.id));
      if (mine) setServerResult(mine);
      setSaving(false);
    };

    socket.emit('typing:joinRoom', { roomId }, () => {});
    socket.on('typing:roomState', onState);
    socket.on('typing:playerJoined', onPlayers);
    socket.on('typing:playerLeft', onPlayers);
    socket.on('typing:playerReady', onPlayers);
    socket.on('typing:starting', onStarting);
    socket.on('typing:startingCancelled', onStartingCancelled);
    socket.on('typing:started', onStarted);
    socket.on('typing:matchFinished', onMatchFinished);
    return () => {
      socket.off('typing:roomState', onState);
      socket.off('typing:playerJoined', onPlayers);
      socket.off('typing:playerLeft', onPlayers);
      socket.off('typing:playerReady', onPlayers);
      socket.off('typing:starting', onStarting);
      socket.off('typing:startingCancelled', onStartingCancelled);
      socket.off('typing:started', onStarted);
      socket.off('typing:matchFinished', onMatchFinished);
      socket.emit('typing:leaveRoom', { roomId });
    };
  }, [socket, urlRoomId, user?.id, start]);

  // Progress leaves the client at a human cadence: never between a keystroke
  // and its paint. Music evidence rides along with the same payload.
  useEffect(() => {
    if (!isRoomMode || phase !== 'playing' || !socket) return undefined;
    progressTimer.current = setInterval(() => {
      const instance = engineRef.current;
      if (!instance) return;
      const evidence = instance.getEvidence();
      revisionRef.current += 1;
      socket.emit('typing:progress', {
        roomId: Number(urlRoomId),
        typedText: evidence.typedText,
        inputRevision: revisionRef.current,
        music: evidence,
      });
    }, 1200);
    return () => { if (progressTimer.current) clearInterval(progressTimer.current); };
  }, [isRoomMode, phase, socket, urlRoomId]);

  const toggleReady = () => {
    if (!room || !socket) return;
    const me = players.find((player) => Number(player.userId) === Number(user.id));
    socket.emit('typing:toggleReady', { roomId: room.id, isReady: !me?.isReady });
  };

  const leaveRoom = async () => {
    if (room?.id) {
      socket?.emit('typing:leaveRoom', { roomId: room.id });
      await typingGameApi.leaveRoom(room.id).catch(() => {});
    }
    navigate('/games/typing/music');
  };

  if (isComingSoon) {
    return (
      <div className="arcade-page music-page">
        <GameComingSoon
          gameKey="typing_battle"
          name={availabilityGame?.name || 'Đua Gõ Theo Nhạc'}
          description={availabilityGame?.description}
          isAdmin={isAdmin}
          onAdminProceed={proceedAsAdmin}
        />
      </div>
    );
  }

  const showLobby = isRoomMode && room && room.status !== 'PLAYING' && phase !== 'playing' && phase !== 'result';
  const showPlay = phase === 'playing' || (isRoomMode && room?.status === 'PLAYING' && phase !== 'result');
  const flow = snapshot?.flowPct ?? 100;

  return (
    <div className="arcade-page music-page">
      <header className="arcade-topbar">
        <button type="button" onClick={() => (isRoomMode ? leaveRoom() : navigate('/games/typing'))}>
          <ArrowLeft size={17} /> {isRoomMode ? 'Rời phòng' : 'Đổi chế độ'}
        </button>
        <span className="arcade-brand">WORK RANK <b>ARCADE</b></span>
        <span className="music-topbar-song">
          <Music2 size={14} aria-hidden="true" />
          {activeSong ? `${activeSong.title} · ${activeSong.artist}` : 'ĐUA GÕ THEO NHẠC'}
        </span>
      </header>

      {(phase === 'pick' || phase === 'ready') && (
      <div className="music-heading">
        <div>
          <p className="arcade-kicker">02 · ĐUA GÕ THEO NHẠC</p>
          <h1>ĐUA GÕ THEO NHẠC</h1>
          <p>Gõ đúng lời · Giữ nhạc tiếp tục</p>
        </div>
        {!isRoomMode && (
          <span className="arcade-best-chip">
            <Trophy size={13} aria-hidden="true" /> Nhạc chưa dừng lần nào = 100% liền mạch
          </span>
        )}
      </div>
      )}

      {(roomError || audioError) && <div className="arcade-notice" role="alert">{roomError || audioError}</div>}

      <TabTransition key={`${phase}-${isRoomMode ? 'room' : 'solo'}`} minHeight={520}>
        {phase === 'result' ? (
          <MusicResult
            song={activeSong}
            result={serverResult}
            local={localResult}
            saving={saving}
            error={submitError}
            onReplay={isRoomMode ? () => navigate('/games/typing/music') : handleReplay}
            onBoard={() => { setPhase('pick'); setSelectedSong(null); setBoardTab('board'); }}
            onBack={() => { setPhase('pick'); setSelectedSong(null); }}
          />
        ) : showLobby ? (
          <RoomLobby
            room={room}
            players={players}
            user={user}
            song={roomSong}
            countdown={countdown}
            onReady={toggleReady}
            onLeave={leaveRoom}
            busy={busy}
          />
        ) : showPlay ? (
          <section className="music-run">
            <MusicHud
              score={snapshot?.score || 0}
              flowPct={flow}
              streak={snapshot?.noPauseStreak || 0}
              behindChars={snapshot?.behindChars || 0}
              lineChars={snapshot?.line?.charCount || 1}
              lineProgress={snapshot?.lineProgress || 0}
              pauseCount={snapshot?.pauseCount || 0}
              paused={snapshot?.state === AUDIO_STATE.WAITING_AT_BOUNDARY}
            />

            <div className="music-stage-wrap">
              <MusicStage
                state={snapshot?.state || AUDIO_STATE.PREPARING}
                flowPct={flow}
                streak={snapshot?.noPauseStreak || 0}
              />
              {introRemaining > 0 && snapshot?.state !== AUDIO_STATE.WAITING_AT_BOUNDARY && (
                <div className="music-intro" aria-hidden="true">
                  <span>♫</span>
                  <b>{introRemaining}</b>
                  <small>vào câu đầu</small>
                </div>
              )}
            </div>

            <div className="music-sing-area" onClick={() => inputRef.current?.focus({ preventScroll: true })} role="presentation">
              <LyricKaraoke
                lines={activeSong?.lines || []}
                lineIndex={snapshot?.lineIndex ?? 0}
                typedValue={snapshot?.typedValue || ''}
                audioState={snapshot?.state || AUDIO_STATE.PREPARING}
                lineState={snapshot?.lineState}
              />
              <input
                {...inputProps}
                ref={inputRef}
                className="music-native-input"
                maxLength={snapshot?.line?.charCount || 1}
                disabled={!snapshot || snapshot.state === AUDIO_STATE.FINISHED}
              />
              {!snapshot?.typedValue && snapshot?.state === AUDIO_STATE.WAITING_AT_BOUNDARY && (
                <p className="music-focus-hint"><Keyboard size={14} aria-hidden="true" /> Bấm vào đây rồi gõ tiếp phần còn thiếu</p>
              )}
            </div>

            <Toast toast={toast} />

            {!ready && (
              <div className="music-hold">
                <Loader2 size={16} className="music-spin" aria-hidden="true" /> Đang chuẩn bị nhạc…
              </div>
            )}

            {snapshot?.state === AUDIO_STATE.WAITING_AT_BOUNDARY && (
              <div className="music-waiting-bar">
                <span>⏸ NHẠC ĐANG CHỜ BẠN</span>
                <Button onClick={() => inputRef.current?.focus({ preventScroll: true })}>Gõ tiếp</Button>
              </div>
            )}
          </section>
        ) : phase === 'ready' ? (
          <section className="music-ready">
            <div className="music-ready-card">
              <p className="arcade-kicker">SẴN SÀNG</p>
              <h2>{selectedSong?.title}</h2>
              <p className="music-ready-artist">{selectedSong?.artist} · {selectedSong?.difficultyLabel} · {Math.round((selectedSong?.durationMs || 0) / 1000)} giây</p>
              <p className="music-ready-brief">
                Nhạc chạy liên tục. Gõ đúng từng câu; nếu còn sai khi hết câu, nhạc dừng đúng ở cuối câu đó và chạy tiếp ngay khi bạn gõ xong.
                Đừng để bài hát phải dừng.
              </p>
              <div className="music-ready-stats">
                <span><b>{selectedSong?.lines?.length || 0}</b> câu</span>
                <span><b>{selectedSong?.charsPerSecond || 0}</b> ký tự/giây</span>
                <span><b>{selectedSong?.metrics?.accentRatio ? Math.round(selectedSong.metrics.accentRatio * 100) : 0}%</b> ký tự có dấu</span>
              </div>
              <div className="music-ready-actions">
                <Button onClick={handleStart} disabled={!ready}>
                  {ready ? <><Play size={16} /> BẮT ĐẦU</> : <><Loader2 size={16} className="music-spin" /> Đang tải nhạc…</>}
                </Button>
                <Button variant="secondary" onClick={() => { setPhase('pick'); setSelectedSong(null); }}>Chọn bài khác</Button>
              </div>
              <p className="music-ready-note">
                Trình duyệt chỉ phát nhạc sau một cú bấm — nút BẮT ĐẦU chính là cú bấm đó. Nhạc và lời do WorkRank sở hữu.
              </p>
            </div>
            <div className="music-ready-aside">
              <MusicStage state={AUDIO_STATE.PREPARING} flowPct={100} />
            </div>
          </section>
        ) : (
          <>
            <div className="music-pick-tabs" role="tablist" aria-label="Chọn bài hoặc xem bảng xếp hạng">
              <button type="button" role="tab" aria-selected={boardTab === 'songs'} onClick={() => setBoardTab('songs')}>Chọn bài hát</button>
              <button type="button" role="tab" aria-selected={boardTab === 'board'} onClick={() => setBoardTab('board')}>Bảng xếp hạng</button>
            </div>
            <TabTransition key={boardTab} minHeight={420}>
            {boardTab === 'board' ? (
              <MusicBoard rows={board} loading={boardLoading} myUserId={user?.id} />
            ) : (
            <>
            <MusicSongPicker onSelect={handleSelectSong} busy={creating} bestBySong={bestBySong} songs={songs} />
            <div className="music-room-create">
              <div>
                <p className="arcade-kicker"><Users size={13} aria-hidden="true" /> ĐUA CÙNG NHAU</p>
                <p>Chọn bài ở trên, chọn số người rồi mở phòng. Mọi người nhận cùng bài, cùng lời, cùng mốc bắt đầu.</p>
              </div>
              <div className="music-room-create-actions">
                <select value={mode} onChange={(event) => setMode(event.target.value)} aria-label="Chế độ phòng">
                  {ROOM_MODES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
                <Button onClick={createRoom} disabled={!selectedSong || creating}>
                  {creating ? 'Đang mở…' : selectedSong ? `Mở phòng · ${selectedSong.title}` : 'Chọn bài trước'}
                </Button>
              </div>
            </div>
            </>
            )}
            </TabTransition>
          </>
        )}
      </TabTransition>
    </div>
  );
}
