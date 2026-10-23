import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArcadeHUD, ArcadeCountdown } from './ArcadeShared';
import { arcadeSound } from '../../utils/arcadeSound';
import { challenge, emptyMetrics, replay, DIRECTION_STUMBLE_MS } from '../../../../shared/arcade/engine.mjs';
import { ARCADE_GAMES } from '../../games/arcade/catalog';
import ComputerStation from './ComputerStation';
import DirectionArena from './DirectionArena';
import MemoryBoard from './MemoryBoard';
import RaceStrip, { RivalAvatar } from './RaceStrip';
import TeamHud from './TeamHud';

export default function ArcadePlay({ snapshot, userId, eventsRef, record, offsetRef, personalBest = 0 }) {
  const { room } = snapshot;
  const mine = snapshot.players.find((p) => String(p.userId) === String(userId));
  const start = new Date(room.startedAt).getTime();
  const duration = room.durationSeconds * 1000;
  const options = useMemo(() => ({ durationMs: duration, difficulty: room.difficulty, rulesVersion: room.rulesVersion || 1 }), [duration, room.difficulty, room.rulesVersion]);
  const clock = useRef(-Infinity);
  const elapsedNow = useCallback(() => { clock.current = Math.max(clock.current, Date.now() + offsetRef.current - start); return clock.current; }, [start, offsetRef]);
  const [elapsed, setElapsed] = useState(elapsedNow);
  const [metrics, setMetrics] = useState(() => eventsRef.current.length ? replay(room.gameType, room.seed, eventsRef.current, options) : emptyMetrics());
  const metricsRef = useRef(metrics);
  const [feedback, setFeedback] = useState(null);
  const feedbackTimer = useRef(null);
  const previousAt = eventsRef.current.at(-1)?.at || 0;
  const index = eventsRef.current.length;
  const current = useMemo(() => challenge(room.gameType, room.seed, index, room.difficulty, { ...options, previousAt, previousCorrect: metrics.lastCorrect !== false }), [room.gameType, room.seed, index, room.difficulty, options, previousAt, metrics.lastCorrect]);
  const canPlay = useCallback(() => !mine.finishedAt && elapsedNow() >= 0 && elapsedNow() < duration, [mine.finishedAt, elapsedNow, duration]);
  const submit = useCallback((event, earliestAt = 0, expectedIndex = eventsRef.current.length) => {
    if (!canPlay() || eventsRef.current.length !== expectedIndex) return false;
    const at = Math.round(elapsedNow());
    if (at < earliestAt) return false;
    const previous = metricsRef.current;
    const previousEventAt = eventsRef.current.at(-1)?.at || 0;
    const object = challenge(room.gameType, room.seed, expectedIndex, room.difficulty, { ...options, previousAt: previousEventAt, previousCorrect: previous.lastCorrect !== false });
    const next = [...eventsRef.current, { index: expectedIndex, at, ...event }];
    let result;
    try { result = replay(room.gameType, room.seed, next, options); } catch { return false; }
    record(next); metricsRef.current = result; setMetrics(result);
    const correct = result.lastCorrect;
    const milestone = ({ 3: 'ĐẸP LẮM!', 5: 'TUYỆT VỜI!', 10: 'BÙNG NỔ!', 20: 'CHUỖI HOÀN HẢO!' })[result.combo];
    setFeedback({ state: correct ? result.combo >= 3 ? 'combo' : 'correct' : 'wrong', id: next.length, at, challenge: object, cells: event.cells || [], timeout: event.timeout || event.direction === null,
      expected: object.expected, direction: event.direction, word: object.word, delta: result.score - previous.score, lostCombo: previous.combo, combo: result.combo,
      text: correct ? milestone || (room.gameType === 'direction_rush' ? result.lastResponseMs <= 350 ? 'HOÀN HẢO!' : 'TỐT!' : 'CHÍNH XÁC!') : event.direction === null || event.timeout ? 'HẾT NHỊP!' : 'CHƯA ĐÚNG!' });
    clearTimeout(feedbackTimer.current);
    // Nhịp phản hồi ngắn dần theo level, nhưng luôn đủ lâu để đọc lỗi.
    const level = object.level || 1;
    const hold = room.gameType === 'memory_flash'
      ? options.rulesVersion < 2
        ? 400
        : correct
          ? Math.max(220, 340 - level * 10)
          : Math.max(560, 820 - level * 18)
      : room.gameType === 'direction_rush' ? options.rulesVersion >= 3 && !correct ? DIRECTION_STUMBLE_MS : 180 : 180;
    feedbackTimer.current = setTimeout(() => setFeedback(null), hold);
    return true;
  }, [canPlay, elapsedNow, eventsRef, options, record, room.gameType, room.seed, room.difficulty]);
  const getDirectionState = useCallback(() => {
    const nextIndex=eventsRef.current.length, previousAt=eventsRef.current.at(-1)?.at || 0;
    return { index:nextIndex, previousAt, current:challenge(room.gameType,room.seed,nextIndex,room.difficulty,{...options,previousAt,previousCorrect:metricsRef.current.lastCorrect !== false}) };
  },[eventsRef,room.gameType,room.seed,room.difficulty,options]);
  const upcoming=useMemo(()=>room.gameType==='direction_rush' ? [1,2,3].map(n=>({index:index+n,direction:challenge(room.gameType,room.seed,index+n,room.difficulty,options).direction})) : [],[room.gameType,room.seed,room.difficulty,index,options]);
  useEffect(() => {
    const timer = setInterval(() => setElapsed(elapsedNow()), 50);
    return () => { clearInterval(timer); clearTimeout(feedbackTimer.current); };
  }, [elapsedNow]);
  const remaining = Math.ceil(Math.max(0, duration - Math.max(0, elapsed)) / 1000);
  const liveRank = 1 + snapshot.players.filter((p) => p.id !== mine.id && (p.metrics.score > metrics.score || p.metrics.score === metrics.score && p.position < mine.position)).length;
  useEffect(() => {
    if (!feedback) return;
    const frame = requestAnimationFrame(() => arcadeSound.play(feedback.state === 'wrong' ? 'wrong' : feedback.state === 'combo' ? 'combo' : 'correct'));
    return () => cancelAnimationFrame(frame);
  }, [feedback?.id]);
  return <div className={`arcade-world ${room.gameType} arcade-polished`} data-feedback={feedback?.state || 'idle'} data-urgent={elapsed >= duration - 10000} data-attempts={metrics.attempts}>
    <ArcadeHUD animateScore={false} time={remaining} score={metrics.score} combo={metrics.combo} rank={liveRank} count={snapshot.players.length} comboLabel="CHUỖI" />
    {room.teamMode && <TeamHud teams={snapshot.teams} userId={userId} />}
    <div className="arcade-scene">
      {feedback && feedback.state !== 'wrong' && <span key={feedback.id} className="arcade-surface-flash" data-state={feedback.state} aria-hidden="true" />}
      <div className="arcade-cloud cloud-one" aria-hidden="true" /><div className="arcade-cloud cloud-two" aria-hidden="true" />
      <div className="arcade-scene-title">{ARCADE_GAMES[room.gameType].subtitle}</div>
      {room.gameType === 'computer_rush' && <>
        <ComputerStation current={current} index={index} player={mine} canPlay={canPlay} submit={submit} previousAt={previousAt} elapsedNow={elapsedNow} feedback={feedback} />
        {snapshot.players.length > 1 && <div className="arcade-rivals">{snapshot.players.filter((p) => p.id !== mine.id).map((p) => <div key={p.id}><span className="arcade-rival-monitor"><b>{p.metrics.correct}</b> từ · x{p.metrics.combo}</span><RivalAvatar player={p} /></div>)}</div>}
      </>}
      {room.gameType === 'direction_rush' && <DirectionArena rulesVersion={options.rulesVersion} getDirectionState={getDirectionState} upcoming={upcoming} localMetrics={metrics} current={current} index={index} elapsed={elapsed} durationMs={duration} elapsedNow={elapsedNow} previousAt={previousAt} canPlay={canPlay} submit={submit} players={snapshot.players} me={mine} feedback={feedback} />}
      {room.gameType === 'memory_flash' && <MemoryBoard current={current} index={index} elapsed={elapsed} elapsedNow={elapsedNow} previousAt={previousAt} canPlay={canPlay} submit={submit} players={snapshot.players} me={mine} feedback={feedback} teamMode={room.teamMode} />}
      <div className="arcade-flow-footer"><div className={`arcade-combo ${metrics.combo >= 3 ? 'hot' : ''}`} data-level={metrics.combo >= 10 ? 3 : metrics.combo >= 5 ? 2 : metrics.combo >= 3 ? 1 : 0}><span>✦</span> x{metrics.combo} <small>CHUỖI</small></div><span className="arcade-goal">{personalBest > 0 ? metrics.score > personalBest ? '★ VƯỢT KỶ LỤC!' : `Còn ${personalBest - metrics.score + 1} điểm để phá kỷ lục` : '✦ Tạo kỷ lục đầu tiên của bạn'}</span></div>
      {elapsed >= duration && <div className="arcade-end-message" role="status">HẾT GIỜ!<small>Đang ghi nhận thành tích…</small></div>}
      <ArcadeCountdown value={elapsed < 0 ? Math.min(3, Math.ceil(-elapsed / 1000)) : elapsed < 220 ? 0 : null} instruction={room.gameType === 'computer_rush' ? 'Gõ đúng từ trên màn hình' : room.gameType === 'direction_rush' ? 'Nhìn hướng · bấm mũi tên / WASD' : 'Nhớ ô sao · chờ tắt · chọn lại'} hint={room.gameType === 'direction_rush' ? 'Chỉ đảo khi có biển ĐẢO CHIỀU' : 'Sẵn sàng…'} />
    </div>
    <RaceStrip players={snapshot.players} userId={userId} localMetrics={metrics} gameType={room.gameType} />
  </div>;
}
