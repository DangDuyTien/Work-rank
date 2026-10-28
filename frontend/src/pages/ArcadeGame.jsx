import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trophy, Play, Sparkles, Plus, History } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, PageState, TabTransition, FlipTableBody } from '../components/ui';
import { ArcadePoster } from '../components/arcade/ArcadeArt';
import ArcadePlay from '../components/arcade/ArcadePlay';
import {
  ARCADE_GAMES,
  gameById,
  gameMenuName,
  modeLabelVi,
  modeShortVi,
} from '../games/arcade/catalog';
import useArcadeSession, { arcadeApi } from '../games/arcade/useArcadeSession';
import ArcadeTutorial from '../components/arcade/ArcadeTutorial';
import ArcadeResult from '../components/arcade/ArcadeResult';
import ArcadeLobby from '../components/arcade/ArcadeLobby';
import SavedGameHistory from '../components/arcade/SavedGameHistory';
import { ArcadeComplete, ArcadeSoundControl } from '../components/arcade/ArcadeShared';
import { gameErrorVi } from '../utils/gameErrors';
import '../components/arcade/arcade.css';
import '../components/arcade/arcade-polish.css';

const MODE_OPTIONS = [
  { id: 'SOLO', icon: '✦', hint: 'Phá kỷ lục của bạn', count: '1 người' },
  { id: '1V1', icon: '⚑', hint: 'Hai người, một đường đua', count: '2 người' },
  { id: '2V2', icon: '⚔', hint: 'Đấu đội, tính điểm chung', count: '4 người' },
  { id: '3V3', icon: '♛', hint: 'Đội lớn, nhịp nhanh hơn', count: '6 người' },
  { id: 'TRIO', icon: '✧', hint: 'Ba người tranh hạng', count: '3 người' },
];

function SettledResult(props) {
  const [settled, setSettled] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setSettled(true), 340); return () => clearTimeout(timer); }, []);
  const me = props.snapshot.players.find((p) => String(p.userId) === String(props.userId));
  return settled ? <ArcadeResult {...props} /> : <ArcadeComplete score={me.result.score} rank={me.result.rank} />;
}

function Leaderboard({ gameType, mode, setMode }) {
  const [period, setPeriod] = useState('all');
  const [selectedGame, setSelectedGame] = useState(gameType);
  const [selectedDifficulty, setSelectedDifficulty] = useState('mixed');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    arcadeApi(`/leaderboard?gameType=${selectedGame}&mode=${mode}&period=${period}&difficulty=${selectedDifficulty}`)
      .then((r) => { if (alive) { setData(r); setError(''); } })
      .catch((e) => { if (alive) setError(gameErrorVi(e, 'Không tải được bảng xếp hạng.')); });
    return () => { alive = false; };
  }, [selectedGame, mode, period, selectedDifficulty]);

  return <section className="arcade-leaderboard">
    <h2><Trophy size={24} /> Bảng xếp hạng</h2>
    <div className="arcade-filters">
      <label>Trò
        <select value={selectedGame} onChange={(e) => setSelectedGame(e.target.value)}>
          {Object.keys(ARCADE_GAMES).map((key) => <option key={key} value={key}>{gameMenuName(key)}</option>)}
        </select>
      </label>
      <label>Chế độ
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          {MODE_OPTIONS.map((m) => <option key={m.id} value={m.id}>{modeLabelVi(m.id)}</option>)}
        </select>
      </label>
      {selectedGame === 'computer_rush' && <label>Kho từ
        <select value={selectedDifficulty} onChange={(e) => setSelectedDifficulty(e.target.value)}>
          {Object.entries({ mixed: 'Tăng dần', easy: 'Dễ', medium: 'Vừa', hard: 'Khó', vietnamese: 'Tiếng Việt' }).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
      </label>}
      <label>Thời gian
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          {Object.entries({ today: 'Hôm nay', week: 'Tuần này', month: 'Tháng này', all: 'Tất cả' }).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
      </label>
    </div>
    <p className="arcade-your-best">
      Kỷ lục của bạn: <b>{data?.personal?.score?.toLocaleString('vi-VN') ?? 'Chưa có'}</b>
      {' · '}Hạng <b>{data?.personal?.rank ? `#${data.personal.rank}` : '—'}</b>
      {' · '}{selectedGame === 'memory_flash' ? 'Chuỗi' : 'Chuỗi'} tốt nhất <b>{data?.personal?.bestCombo ?? '—'}</b>
    </p>
    {error && <p role="alert">{error}</p>}
    <div className="arcade-table-scroll">
      <table>
        <thead>
          <tr>
            <th>Hạng</th>
            <th>Người chơi</th>
            <th>Điểm</th>
            <th>{selectedGame === 'memory_flash' ? 'Vòng đúng' : selectedGame === 'direction_rush' ? 'Hướng đúng' : 'Từ đúng'}</th>
            <th>Chính xác</th>
            <th>Chuỗi</th>
            <th>{selectedGame === 'direction_rush' ? 'Phản xạ TB' : 'Phản hồi TB'}</th>
          </tr>
        </thead>
        <FlipTableBody>
          {data?.rows.map((r) => <tr key={r.userId}><td>#{r.rank}</td><td>{r.name}</td><td><b>{r.score}</b></td><td>{r.correct}</td><td>{r.accuracy}%</td><td>{r.bestCombo}</td><td>{r.avgResponseMs} ms</td></tr>)}
        </FlipTableBody>
      </table>
    </div>
    {data?.rows.length === 0 && <p className="arcade-empty">Ngôi đầu còn trống. Chơi một trận và để lại dấu ấn của bạn!</p>}
  </section>;
}

export default function ArcadeGame({ gameTypeOverride }) {
  const { gameType: routeGameType = 'computer_rush', roomId } = useParams();
  // Đua Gõ Chữ mở chế độ "Gõ Nhanh" qua /games/typing/words → ép gameType.
  const gameType = gameTypeOverride || routeGameType;
  // Giữ người chơi trong URL của chế độ đã chọn.
  const roomPath = (id) => (gameTypeOverride ? `/games/typing/words/room/${id}` : `/games/arcade/${gameType}/room/${id}`);
  const { user, socket } = useAuth();
  const navigate = useNavigate();
  const session = useArcadeSession(roomId, user.id, socket);
  const [mode, setMode] = useState('SOLO');
  const [difficulty, setDifficulty] = useState('mixed');
  const [view, setView] = useState('play');
  const [rooms, setRooms] = useState([]);
  const [active, setActive] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [personal, setPersonal] = useState(null);

  useEffect(() => { setView('play'); }, [roomId, gameType]);

  useEffect(() => {
    if (roomId || !ARCADE_GAMES[gameType]) return undefined;
    let alive = true;
    // WR-AUDIT-020 — trước đây poll /active + /leaderboard mỗi 3s kể cả khi tab
    // ẩn hoặc đang ở menu. Giờ chỉ poll trạng thái phòng mỗi 8s khi tab hiển thị;
    // leaderboard chỉ tải khi đổi game/mode/difficulty.
    const refresh = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const resume = await arcadeApi('/active');
        if (alive) setActive(resume);
      } catch (e) {
        if (alive) setError(gameErrorVi(e, 'Không tải được phòng chơi.'));
      }
    };
    const loadBoard = async () => {
      try {
        const board = await arcadeApi(`/leaderboard?gameType=${gameType}&mode=${mode}&period=all&difficulty=${difficulty}`);
        if (alive) setPersonal(board.personal);
      } catch (e) {
        if (alive) setError(gameErrorVi(e, 'Không tải được phòng chơi.'));
      }
    };
    refresh();
    loadBoard();
    const timer = setInterval(refresh, 8000);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [roomId, gameType, mode, difficulty]);

  useEffect(() => {
    if (roomId || !ARCADE_GAMES[gameType] || mode === 'SOLO') {
      setRooms([]);
      return undefined;
    }
    let alive = true;
    const refreshRooms = async () => {
      try {
        const list = await arcadeApi(`/rooms?gameType=${gameType}&mode=${mode}`);
        if (alive) setRooms(list.rooms);
      } catch (e) {
        if (alive) setError(gameErrorVi(e, 'Không tải được danh sách phòng.'));
      }
    };
    const handleRoomsChanged = (event = {}) => {
      if (!event.gameType || event.gameType === gameType) refreshRooms();
    };
    refreshRooms();
    socket?.on('arcade:roomsChanged', handleRoomsChanged);
    socket?.on('connect', refreshRooms);
    const timer = setInterval(refreshRooms, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
      socket?.off('arcade:roomsChanged', handleRoomsChanged);
      socket?.off('connect', refreshRooms);
    };
  }, [roomId, gameType, mode, socket]);

  useEffect(() => {
    const room = session.snapshot?.room;
    if (!roomId || !room) return undefined;
    let alive = true;
    arcadeApi(`/leaderboard?gameType=${room.gameType}&mode=${room.mode}&period=all&difficulty=${room.difficulty}`)
      .then((r) => { if (alive) setPersonal(r.personal); })
      .catch(() => {});
    return () => { alive = false; };
  }, [roomId, session.snapshot?.room.id]);

  useEffect(() => {
    const roomGameType = session.snapshot?.room.gameType;
    if (!roomId || !roomGameType || roomGameType === gameType || !ARCADE_GAMES[roomGameType]) return;
    navigate(gameTypeOverride ? `/games/typing/words/room/${roomId}` : `/games/arcade/${roomGameType}/room/${roomId}`, { replace: true });
  }, [roomId, gameType, session.snapshot?.room.gameType, navigate]);

  const effective = session.snapshot?.room.gameType || gameType;
  const game = gameById(effective);
  const arcadeMeta = ARCADE_GAMES[effective];
  if (!game || !arcadeMeta) return <PageState type="error" message="Trò chơi không tồn tại." />;

  const open = async (joinId) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const next = joinId ? await arcadeApi(`/rooms/${joinId}/join`, {}) : await arcadeApi('/rooms', { gameType, mode, difficulty });
      try { localStorage.setItem(`wr:arcade:learned:v2:${gameType}`, '1'); } catch { /* Không có storage vẫn chơi được. */ }
      navigate(roomPath(next.room.id));
    } catch (e) { setError(gameErrorVi(e)); }
    finally { setBusy(false); }
  };

  const exit = async () => {
    if (roomId && !(await session.action('leave'))) return;
    // Vào từ Đua Gõ Chữ thì quay lại đúng lobby của chế độ, không nhảy về URL arcade riêng.
    const lobbyPath = gameTypeOverride ? '/games/typing/words' : `/games/arcade/${gameType}`;
    navigate(roomId ? lobbyPath : gameTypeOverride ? '/games/typing' : '/games');
  };

  const replayGame = async () => {
    if (busy) return;
    setBusy(true);
    const next = await session.action('rematch');
    if (next) navigate(gameTypeOverride ? `/games/typing/words/room/${next.room.id}` : `/games/arcade/${next.room.gameType}/room/${next.room.id}`);
    setBusy(false);
  };

  const { snapshot } = session;
  const me = snapshot?.players.find((p) => String(p.userId) === String(user.id));
  const routeMismatch = Boolean(roomId && snapshot && snapshot.room.gameType !== gameType);

  return <div className={`arcade-page ${effective}`}>
    <header className="arcade-topbar">
      <button type="button" onClick={exit}>
        <ArrowLeft size={18} />
        <span>{roomId ? 'Rời phòng' : gameTypeOverride ? 'Đổi chế độ gõ' : 'Trung tâm trò chơi'}</span>
      </button>
      <span className="arcade-brand">WORK RANK <b>ARCADE</b></span>
      <ArcadeSoundControl />
      <button type="button" aria-label="Lịch sử đã lưu" aria-pressed={view === 'history'} disabled={snapshot?.room.status === 'PLAYING' && !me?.finishedAt} onClick={() => setView((v) => v === 'history' ? 'play' : 'history')}><History size={18} /></button>
      <button type="button" disabled={snapshot?.room.status === 'PLAYING' && !me?.finishedAt} onClick={() => { if (snapshot) setMode(snapshot.room.mode); setView((v) => v === 'board' ? 'play' : 'board'); }} aria-pressed={view === 'board'}><Trophy size={18} /><span>BXH</span></button>
    </header>

    {(error || session.error) && <p className="arcade-notice motion-slide-down" role="alert">{error || session.error}</p>}
    {roomId && !session.online && <p className="arcade-offline" role="status">Kết nối gián đoạn · bạn vẫn gõ được · kết quả đang giữ trên thiết bị</p>}

    <TabTransition key={view === 'play' ? roomId ? 'room' : 'menu' : view} minHeight={640}>
      {routeMismatch ? <PageState type="loading" message="Đang mở đúng trò của phòng…" />
        : view === 'history' ? <SavedGameHistory kind="arcade" gameType={effective} onOpen={() => setView('play')} />
          : view === 'board' ? <Leaderboard gameType={effective} mode={mode} setMode={setMode} />
            : roomId ? !snapshot ? <PageState type="loading" message="Đang mở sân chơi…" />
              : snapshot.room.status === 'WAITING' ? <ArcadeLobby snapshot={snapshot} userId={user.id} game={{ ...arcadeMeta, ...game }} busy={busy}
                onReady={() => session.action('ready', { ready: !me.ready })}
                onStart={() => session.action('start')}
                onSwitchTeam={(team) => session.action('team', { team })} />
              : me?.finishedAt ? <SettledResult key={snapshot.room.id} snapshot={snapshot} userId={user.id} busy={busy} onReplay={replayGame} onBoard={() => { setMode(snapshot.room.mode); setView('board'); }} />
                : <ArcadePlay key={snapshot.room.id} snapshot={snapshot} userId={user.id} eventsRef={session.eventsRef} record={session.record} offsetRef={session.offsetRef} personalBest={personal?.score || 0} />
              : <section className="arcade-menu">
                <div className="arcade-menu-hero">
                  <div>
                    <p className="arcade-kicker">WORK RANK ARCADE · {game.mark}</p>
                    <h1>{game.displayNameVi}</h1>
                    <h2>{game.subtitleVi}</h2>
                    <p>{game.longDescriptionVi}</p>
                    <span className="arcade-best-chip">
                      <Trophy size={16} />
                      {personal && personal.score != null
                        ? <>Kỷ lục {modeShortVi(mode)}: <b>{personal.score}</b>{' · '}Hạng {personal.rank ? `#${personal.rank}` : '—'}{' · '}Chuỗi {personal.bestCombo ?? '—'}</>
                        : <>Chưa có kỷ lục ở chế độ này · Chơi ván đầu tiên nhé</>}
                    </span>
                  </div>
                  <ArcadePoster gameType={effective} />
                </div>

                <ArcadeTutorial key={effective} gameType={effective} />

                <h3>Chọn chế độ của bạn</h3>
                <div className="arcade-mode-select">
                  {MODE_OPTIONS.map((m) => <button key={m.id} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
                    <span className="arcade-mode-icon">{m.icon}</span>
                    <span><b>{modeLabelVi(m.id)}</b><small>{m.hint}</small></span>
                    <em>{m.count}</em>
                  </button>)}
                </div>

                <div className="arcade-start-row">
                  {gameType === 'computer_rush' && <label>Kho từ
                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                      {Object.entries({ mixed: 'Tăng dần · Anh + Việt', easy: 'Dễ · tiếng Anh', medium: 'Vừa · tiếng Anh', hard: 'Khó · cụm từ', vietnamese: 'Tiếng Việt' }).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                    </select>
                  </label>}
                  <Button onClick={() => open()} disabled={busy || !!active}>
                    {mode === 'SOLO' ? <Play size={19} /> : <Plus size={19} />}
                    {busy ? 'Đang mở…' : mode === 'SOLO' ? 'Vào chơi ngay' : `Tạo phòng · ${modeShortVi(mode)}`}
                  </Button>
                  <span>{mode === 'SOLO' ? 'Một mình, một kỷ lục mới.' : 'Cùng thử thách · cùng giờ bắt đầu'} · 60 giây mặc định</span>
                </div>

                {active && <div className="arcade-resume">
                  <Sparkles size={18} />
                  <span>Bạn còn một lượt {gameMenuName(active.room.gameType)} đang mở.</span>
                  <Link to={`/games/arcade/${active.room.gameType}/room/${active.room.id}`}>Tiếp tục / rời phòng</Link>
                </div>}

                {mode !== 'SOLO' && <div className="arcade-room-list">
                  <h3>Phòng đang chờ · {modeLabelVi(mode)}</h3>
                  {rooms.length ? rooms.map((r) => <button key={r.id} onClick={() => open(r.id)} disabled={busy || !!active || r.players >= r.capacity}>
                    <span>
                      <b>{gameMenuName(effective)}</b>
                      <small>{r.title} · Chủ phòng: {r.host}{r.teams ? ` · ${r.teams.A} đấu ${r.teams.B}` : ''}</small>
                    </span>
                    <strong>{r.players}/{r.capacity}</strong>
                    <em>ĐANG CHỜ →</em>
                  </button>) : <p className="arcade-empty">Sân chơi đang yên ắng. Mở phòng để bạn bè cùng vào!</p>}
                </div>}
              </section>}
    </TabTransition>
  </div>;
}
