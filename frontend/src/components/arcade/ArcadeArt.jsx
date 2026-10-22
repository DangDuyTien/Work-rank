import React, { memo } from 'react';
import DefaultAvatar from '../DefaultAvatar';

export const PlayerAvatar2D = memo(function PlayerAvatar2D({ player, state = 'idle', direction, feedbackId = 0 }) {
  return <div className={`arcade-player p${player.position || 1}`} data-state={state} data-direction={direction}>
    <div key={feedbackId} className="arcade-actor">
      <div className="arcade-avatar-head"><DefaultAvatar name={player.name} src={player.avatarUrl} userId={player.userId} size={52} shape="circle" /></div>
      <div className="arcade-body"><i /><i /></div><div className="arcade-shoes"><i /><i /></div>
      {(state === 'correct' || state === 'combo' || state === 'win') && <span className="arcade-sparkles" aria-hidden="true">✦ <b>✧</b> ✦</span>}
      {state === 'wrong' && <span className="arcade-miss" aria-hidden="true">×</span>}
    </div>
    <span className="arcade-name"><b>P{player.position || 1}</b> {player.name}</span>
  </div>;
});

export function ArcadePoster({ gameType }) {
  return <div className={`arcade-poster ${gameType}`} aria-hidden="true">
    <span className="arcade-poster-star">✦</span><span className="arcade-poster-dot">✧</span>
    {gameType === 'computer_rush' ? <><div className="arcade-mini-monitor"><span>Aa<span className="arcade-cursor">▏</span></span><i /></div><div className="arcade-mini-keyboard">▰ ▰ ▰ ▰ ▰</div></>
      : gameType === 'direction_rush' ? <div className="arcade-mini-arrows"><span>↑</span><span>←</span><b>✦</b><span>→</span><span>↓</span></div>
        : <div className="arcade-mini-board">{Array.from({ length: 9 }, (_, i) => <i key={i} className={[1, 3, 8].includes(i) ? 'lit' : ''}>{[1, 3, 8].includes(i) ? '✦' : ''}</i>)}</div>}
    <div className="arcade-poster-friend"><span>•ᴗ•</span><i /></div>
    <span className="arcade-poster-floor" />
  </div>;
}
