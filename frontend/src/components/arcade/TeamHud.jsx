import React from 'react';
import { teamNameVi } from '../../games/arcade/catalog';

/**
 * HUD đội compact: không đặt 6 board lên màn hình, chỉ hiển thị điểm đội và
 * trạng thái từng thành viên. Local board vẫn là trung tâm.
 */
export default function TeamHud({ teams = [], userId }) {
  if (!teams.length) return null;
  return <div className="arcade-team-hud" aria-label="Tình hình hai đội">
    {teams.map((team) => <div className="arcade-team-hud-side" data-team={team.id} key={team.id}>
      <div className="arcade-team-hud-score">
        <span>{teamNameVi(team.id)}</span>
        <strong>{team.score.toLocaleString('vi-VN')}</strong>
        <small>{team.correct} ô đúng · {team.accuracy}%</small>
      </div>
      <ul>
        {team.players.map((player) => <li key={player.id} className={String(player.userId) === String(userId) ? 'is-me' : ''} data-state={player.finishedAt ? 'done' : player.lastCorrect === false ? 'wrong' : 'live'}>
          <i aria-hidden="true">{player.finishedAt ? '✓' : player.lastCorrect === false ? '×' : '◇'}</i>
          <span>{player.name}</span>
          <b>{player.score.toLocaleString('vi-VN')}</b>
        </li>)}
      </ul>
    </div>)}
  </div>;
}
