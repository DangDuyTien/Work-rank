import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trophy, Play, Users, Sparkles, Plus, History } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, PageState, TabTransition, FlipTableBody } from '../components/ui';
import { ArcadePoster, PlayerAvatar2D } from '../components/arcade/ArcadeArt';
import ArcadePlay from '../components/arcade/ArcadePlay';
import { ARCADE_GAMES } from '../games/arcade/catalog';
import useArcadeSession, { arcadeApi } from '../games/arcade/useArcadeSession';
import ArcadeTutorial from '../components/arcade/ArcadeTutorial';
import ArcadeResult from '../components/arcade/ArcadeResult';
import SavedGameHistory from '../components/arcade/SavedGameHistory';
import { ArcadeComplete, ArcadeSoundControl } from '../components/arcade/ArcadeShared';
import '../components/arcade/arcade.css';
import '../components/arcade/arcade-polish.css';

function SettledResult(props) {
  const [settled,setSettled]=useState(false);
  useEffect(()=>{const timer=setTimeout(()=>setSettled(true),340);return()=>clearTimeout(timer);},[]);
  const me=props.snapshot.players.find(p=>String(p.userId)===String(props.userId));
  return settled?<ArcadeResult {...props}/>:<ArcadeComplete score={me.result.score} rank={me.result.rank}/>;
}

function Leaderboard({ gameType, mode, setMode }) {
  const [period, setPeriod] = useState('all');
  const [selectedGame, setSelectedGame] = useState(gameType);
  const [selectedDifficulty, setSelectedDifficulty] = useState('mixed');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    arcadeApi(`/leaderboard?gameType=${selectedGame}&mode=${mode}&period=${period}&difficulty=${selectedDifficulty}`).then((r) => { if (alive) { setData(r); setError(''); } }).catch((e) => { if (alive) setError(e.response?.data?.message || 'Không tải được BXH'); });
    return () => { alive = false; };
  }, [selectedGame, mode, period, selectedDifficulty]);
  return <section className="arcade-leaderboard"><h2><Trophy size={24} /> Bảng xếp hạng</h2>
    <div className="arcade-filters"><label>Game<select value={selectedGame} onChange={(e) => setSelectedGame(e.target.value)}>{Object.entries(ARCADE_GAMES).map(([key, g]) => <option key={key} value={key}>{g.name}</option>)}</select></label><label>Chế độ<select value={mode} onChange={(e) => setMode(e.target.value)}>{['SOLO', 'DUO', 'TRIO'].map((m) => <option key={m}>{m}</option>)}</select></label>{selectedGame === 'computer_rush' && <label>Kho từ<select value={selectedDifficulty} onChange={(e) => setSelectedDifficulty(e.target.value)}>{Object.entries({ mixed: 'Tăng dần', easy: 'Dễ', medium: 'Vừa', hard: 'Khó', vietnamese: 'Tiếng Việt' }).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>}<label>Thời gian<select value={period} onChange={(e) => setPeriod(e.target.value)}>{Object.entries({ today: 'Hôm nay', week: 'Tuần này', month: 'Tháng này', all: 'Tất cả' }).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label></div>
    <p className="arcade-your-best">Kỷ lục của bạn: <b>{data?.personal?.score?.toLocaleString('vi-VN') ?? 'Chưa có'}</b> · Hạng <b>{data?.personal?.rank ? `#${data.personal.rank}` : '—'}</b> · {selectedGame === 'memory_flash' ? 'Chuỗi' : 'Combo'} tốt nhất <b>{data?.personal?.bestCombo ?? '—'}</b></p>
    {error && <p role="alert">{error}</p>}
    <div className="arcade-table-scroll"><table><thead><tr><th>Hạng</th><th>Người chơi</th><th>Điểm</th><th>{selectedGame === 'computer_rush' ? 'Từ đúng' : selectedGame === 'memory_flash' ? 'Vòng đúng' : 'Hướng đúng'}</th><th>Chính xác</th><th>{selectedGame === 'memory_flash' ? 'Chuỗi' : 'Combo'}</th><th>{selectedGame === 'direction_rush' ? 'Phản xạ TB' : 'Phản hồi TB'}</th></tr></thead><FlipTableBody>{data?.rows.map((r) => <tr key={r.userId}><td>#{r.rank}</td><td>{r.name}</td><td><b>{r.score}</b></td><td>{r.correct}</td><td>{r.accuracy}%</td><td>{r.bestCombo}</td><td>{r.avgResponseMs}ms</td></tr>)}</FlipTableBody></table></div>
    {data?.rows.length === 0 && <p className="arcade-empty">Ngôi đầu còn trống. Chơi một trận và để lại dấu ấn của bạn!</p>}
  </section>;
}

export default function ArcadeGame() {
  const { gameType = 'computer_rush', roomId } = useParams();
  const game = Object.hasOwn(ARCADE_GAMES, gameType) ? ARCADE_GAMES[gameType] : null;
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
    if (roomId || !game) return;
    let alive = true;
    const refresh = async () => {
      try {
        const [resume, board, list] = await Promise.all([arcadeApi('/active'), arcadeApi(`/leaderboard?gameType=${gameType}&mode=${mode}&period=all&difficulty=${difficulty}`), mode === 'SOLO' ? Promise.resolve({ rooms: [] }) : arcadeApi(`/rooms?gameType=${gameType}&mode=${mode}`)]);
        if (alive) { setActive(resume); setPersonal(board.personal); setRooms(list.rooms); }
      } catch (e) { if (alive) setError(e.response?.data?.message || 'Không tải được phòng'); }
    };
    refresh(); const timer = setInterval(refresh, 3000);
    return () => { alive = false; clearInterval(timer); };
  }, [roomId, gameType, mode, game, difficulty]);
  useEffect(() => {
    const room = session.snapshot?.room;
    if (!roomId || !room) return;
    let alive = true;
    arcadeApi(`/leaderboard?gameType=${room.gameType}&mode=${room.mode}&period=all&difficulty=${room.difficulty}`).then((r) => { if (alive) setPersonal(r.personal); }).catch(() => {});
    return () => { alive = false; };
  }, [roomId, session.snapshot?.room.id]);
  if (!game) return <PageState type="error" message="Game không tồn tại" />;
  const open = async (joinId) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const next = joinId ? await arcadeApi(`/rooms/${joinId}/join`, {}) : await arcadeApi('/rooms', { gameType, mode, difficulty });
      try { localStorage.setItem(`wr:arcade:learned:v2:${gameType}`, '1'); } catch { /* Starting a game remains possible without storage. */ }
      navigate(`/games/arcade/${gameType}/room/${next.room.id}`);
    } catch (e) { setError(e.response?.data?.message || e.message); }
    finally { setBusy(false); }
  };
  const exit = async () => {
    if (roomId && !(await session.action('leave'))) return;
    navigate(roomId ? `/games/arcade/${gameType}` : '/games');
  };
  const replayGame = async () => {
    if (busy) return;
    setBusy(true);
    const next = await session.action('rematch');
    if (next) navigate(`/games/arcade/${next.room.gameType}/room/${next.room.id}`);
    setBusy(false);
  };
  const { snapshot } = session;
  const me = snapshot?.players.find((p) => String(p.userId) === String(user.id));
  const effective = snapshot?.room.gameType || gameType;
  return <div className={`arcade-page ${effective}`}>
    <header className="arcade-topbar"><button type="button" onClick={exit}><ArrowLeft size={18} /><span>{roomId ? 'Rời phòng' : 'Game Center'}</span></button><span className="arcade-brand">WORK RANK <b>ARCADE</b></span><ArcadeSoundControl /><button type="button" aria-label="Lịch sử đã lưu" aria-pressed={view==='history'} disabled={snapshot?.room.status==='PLAYING'&&!me?.finishedAt} onClick={()=>setView(v=>v==='history'?'play':'history')}><History size={18}/></button><button type="button" disabled={snapshot?.room.status === 'PLAYING' && !me?.finishedAt} onClick={() => { if (snapshot) setMode(snapshot.room.mode); setView((v) => v === 'board' ? 'play' : 'board'); }} aria-pressed={view === 'board'}><Trophy size={18} /><span>BXH</span></button></header>
    {(error || session.error) && <p className="arcade-notice motion-slide-down" role="alert">{error || session.error}</p>}
    {roomId && !session.online && <p className="arcade-offline" role="status">Kết nối gián đoạn · input vẫn hoạt động · đang giữ bản lưu trên thiết bị</p>}
    <TabTransition key={view==='play' ? roomId?'room':'menu' : view} minHeight={640}>
      {view === 'history' ? <SavedGameHistory kind="arcade" gameType={effective} onOpen={()=>setView('play')}/> : view === 'board' ? <Leaderboard gameType={effective} mode={mode} setMode={setMode} />
        : roomId ? !snapshot ? <PageState type="loading" message="Đang mở sân chơi…" />
          : snapshot.room.status === 'WAITING' ? <section className="arcade-lobby"><p className="arcade-kicker">{snapshot.room.mode} · PHÒNG CHỜ</p><h1>{game.name}</h1><p>{snapshot.room.title} · {snapshot.players.length}/{snapshot.room.capacity} người</p><div className="arcade-lobby-stage">{snapshot.players.map((p) => <div key={p.id}><PlayerAvatar2D player={p} state={p.ready ? 'ready' : 'idle'} /><span className="arcade-ready-label">{p.ready ? '✓ Sẵn sàng' : 'Đang chuẩn bị'}{String(p.userId) === String(snapshot.room.hostId) ? ' · Chủ phòng' : ''}</span></div>)}{Array.from({ length: snapshot.room.capacity - snapshot.players.length }, (_, i) => <div className="arcade-empty-seat" key={i}><Users size={40} /><span>Đợi đồng đội…</span></div>)}</div><p className="arcade-controls-info">{game.controls}</p><div className="arcade-actions"><Button onClick={() => session.action('ready', { ready: !me.ready })}>{me.ready ? 'Hủy sẵn sàng' : 'Tôi đã sẵn sàng'}</Button>{String(snapshot.room.hostId) === String(user.id) && <Button variant="secondary" disabled={snapshot.players.length !== snapshot.room.capacity || snapshot.players.some((p) => !p.ready)} onClick={() => session.action('start')}><Play size={18} /> Bắt đầu</Button>}</div></section>
          : me?.finishedAt ? <SettledResult key={snapshot.room.id} snapshot={snapshot} userId={user.id} busy={busy} onReplay={replayGame} onBoard={() => { setMode(snapshot.room.mode); setView('board'); }} />
              : <ArcadePlay key={snapshot.room.id} snapshot={snapshot} userId={user.id} eventsRef={session.eventsRef} record={session.record} offsetRef={session.offsetRef} personalBest={personal?.score || 0} />
          : <section className="arcade-menu"><div className="arcade-menu-hero"><div><p className="arcade-kicker">WORK RANK ARCADE · {game.mark}</p><h1>{game.name}</h1><h2>{game.subtitle}</h2><p>{game.description}</p><span className="arcade-best-chip"><Trophy size={16} /> Kỷ lục {mode}: <b>{personal?.score ?? '—'}</b> · Hạng {personal?.rank ? `#${personal.rank}` : '—'} · Chuỗi {personal?.bestCombo ?? '—'}</span></div><ArcadePoster gameType={gameType} /></div>
            <ArcadeTutorial key={gameType} gameType={gameType} /><h3>Chọn chế độ của bạn</h3><div className="arcade-mode-select">{[{ id: 'SOLO', icon: '✦', label: 'Phá kỷ lục của bạn', players: '01' }, { id: 'DUO', icon: '⚑', label: 'Đấu 1v1', players: '02' }, { id: 'TRIO', icon: '♛', label: '3 người tranh hạng', players: '03' }].map((m) => <button key={m.id} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}><span className="arcade-mode-icon">{m.icon}</span><span><b>{m.id}</b><small>{m.label}</small></span><em>{m.players}</em></button>)}</div>
            <div className="arcade-start-row">{gameType === 'computer_rush' && <label>Kho từ<select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>{Object.entries({ mixed: 'Tăng dần · Anh + Việt', easy: 'Dễ · English', medium: 'Vừa · English', hard: 'Khó · Cụm từ', vietnamese: 'Tiếng Việt' }).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>}<Button onClick={() => open()} disabled={busy || !!active}>{mode === 'SOLO' ? <Play size={19} /> : <Plus size={19} />}{busy ? 'Đang mở…' : mode === 'SOLO' ? 'Vào chơi ngay' : `Tạo phòng ${mode}`}</Button><span>{mode === 'SOLO' ? 'Một mình, một kỷ lục mới.' : 'Cùng thử thách · Cùng giờ bắt đầu'} · 60s mặc định</span></div>
            {active && <div className="arcade-resume"><Sparkles size={18} /><span>Bạn còn một lượt {ARCADE_GAMES[active.room.gameType]?.name} đang mở.</span><Link to={`/games/arcade/${active.room.gameType}/room/${active.room.id}`}>Tiếp tục / rời phòng</Link></div>}
            {mode !== 'SOLO' && <div className="arcade-room-list"><h3>Phòng đang chờ · {mode}</h3>{rooms.length ? rooms.map((r) => <button key={r.id} onClick={() => open(r.id)} disabled={busy || !!active || r.players >= r.capacity}><span><b>{game.name}</b><small>{r.title} · Chủ phòng: {r.host}</small></span><strong>{r.players}/{r.capacity}</strong><em>ĐANG CHỜ →</em></button>) : <p className="arcade-empty">Sân chơi đang yên ắng. Mở phòng để bạn bè cùng vào!</p>}</div>}
          </section>}
    </TabTransition>
  </div>;
}
