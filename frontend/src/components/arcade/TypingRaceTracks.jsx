import React, { memo, useEffect, useRef } from 'react';
import { PlayerAvatar2D } from './ArcadeArt';

// Timed passages are deliberately long streams. Map the visual track to a
// common distance budget (120 WPM) so racers separate visibly; only a finished
// server state crosses the flag. This never changes authoritative progress.
const laneProgress = (correct, seconds) => Math.min(94, 100 * Math.max(0, correct) / Math.max(60, seconds * 10));

// Local runner samples telemetry at 10Hz. Keystrokes never rerender the track.
const Runner = memo(function Runner({ player, telemetry, local, finished, duration }) {
  const travel = useRef(null), figure = useRef(null), lastReaction = useRef(0);
  useEffect(() => {
    if (!local) return;
    let frame = 0, previous = -1, until = 0;
    const update = () => {
      if (document.hidden || !travel.current) return;
      const d = telemetry.getState();
      const progress = finished ? 100 : laneProgress(d.charCount-d.errorCount,duration);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!travel.current) return;
        if (progress !== previous) { travel.current.style.transform = `translate3d(${progress}%,0,0)`; previous = progress; }
        const actor = figure.current?.querySelector('.arcade-player');
        if (actor && d.reactionId !== lastReaction.current) { lastReaction.current = d.reactionId; actor.dataset.state = d.reaction || 'action'; until = performance.now() + 220; }
        else if (actor && performance.now() > until) actor.dataset.state = finished ? 'finish' : 'idle';
      });
    };
    update(); const timer = setInterval(update, 100);
    return () => { clearInterval(timer); cancelAnimationFrame(frame); };
  }, [local, telemetry, finished, duration]);
  return <div ref={travel} className="typing-runner-travel" style={local ? undefined : { transform: `translate3d(${finished ? 100 : laneProgress((player.typedChars || 0) * (player.accuracy ?? 100) / 100,duration)}%,0,0)` }}><span ref={figure} className="typing-runner-figure"><PlayerAvatar2D player={player} state={finished ? 'finish' : 'idle'} /></span></div>;
});
export default memo(function TypingRaceTracks({ players, user, telemetry, duration = 120 }) {
  const racers = players.length ? players : [{ userId: user.id, user: user, liveRank: 1 }];
  return <div className="typing-race-tracks" role="group" aria-label="Đường đua Typing Battle 2D">
    {racers.map((p, i) => {
      const local = String(p.userId) === String(user.id), done = p.status === 'FINISHED';
      const player = { ...p, position: i % 3 + 1, name: p.user?.name || p.name || 'Người chơi', avatarUrl: p.user?.avatarUrl || p.avatarUrl };
      return <div className={`typing-race-lane ${local ? 'is-local' : ''}`} key={p.userId} data-live-user={p.userId} data-live-rank={p.liveRank || ''}>
        <div className="typing-race-name"><b>{player.name}{local ? ' · Bạn' : ''}</b><small>{done ? '✓ Đã về đích' : players.length > 1 ? `#${p.liveRank || '—'} · ${Math.round(p.wpm || 0)} WPM` : 'Gõ đúng để tiến lên!'}</small></div>
        <div className="typing-race-road"><span className="typing-race-dashes" /><span className="typing-finish-line" aria-hidden="true">⚑</span><Runner player={player} local={local} telemetry={telemetry} finished={done} duration={duration} /></div>
      </div>;
    })}
  </div>;
});
