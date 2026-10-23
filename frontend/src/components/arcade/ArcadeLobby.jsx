import React from 'react';
import { Play, Users, Shuffle } from 'lucide-react';
import { Button } from '../ui';
import { PlayerAvatar2D } from './ArcadeArt';
import { modeSpec, teamsAreBalanced } from '../../../../shared/arcade/modes.mjs';
import { modeLabelVi, teamNameVi } from '../../games/arcade/catalog';

/**
 * Phòng chờ dùng chung cho mọi game Arcade.
 *
 * Team mode hiển thị hai cột ĐỘI A / ĐỘI B để người chơi thấy ngay mình thuộc
 * đội nào. Nút bắt đầu bị khóa cho tới khi đủ người, đủ đội và tất cả sẵn sàng
 * — server cũng kiểm tra lại, UI chỉ phản ánh luật.
 */
export default function ArcadeLobby({ snapshot, userId, game, busy, onReady, onStart, onSwitchTeam }) {
  const { room, players } = snapshot;
  const me = players.find((player) => String(player.userId) === String(userId));
  const spec = modeSpec(room.mode);
  const teamMode = Boolean(spec?.teamMode);
  const balanced = teamsAreBalanced(players, spec);
  const everyoneReady = players.length === room.capacity && players.every((player) => player.ready);
  const canStart = everyoneReady && balanced;
  const isHost = String(room.hostId) === String(userId);
  const otherTeam = me?.team === 'A' ? 'B' : 'A';

  return <section className="arcade-lobby">
    <p className="arcade-kicker">{modeLabelVi(room.mode)} · PHÒNG CHỜ</p>
    <h1>{game.displayNameVi || game.name}</h1>
    <p>{room.title} · {players.length}/{room.capacity} người{teamMode ? ` · ${spec.teamSize} đấu ${spec.teamSize}` : ''}</p>

    {teamMode ? <div className="arcade-teams" aria-label="Đội hình">
      {['A', 'B'].map((team) => {
        const roster = players.filter((player) => player.team === team);
        return <div className="arcade-team" data-team={team} key={team}>
          <header><span>{teamNameVi(team)}</span><strong>{roster.length}/{spec.teamSize}</strong></header>
          <div className="arcade-team-roster">
            {roster.map((player) => <div className="arcade-team-slot" key={player.id} data-ready={player.ready}>
              <PlayerAvatar2D player={player} state={player.ready ? 'ready' : 'idle'} />
              <div><b>{player.name}{String(player.userId) === String(userId) ? ' · Bạn' : ''}</b><small>{player.ready ? '✓ Sẵn sàng' : 'Đang chuẩn bị'}{String(player.userId) === String(room.hostId) ? ' · Chủ phòng' : ''}</small></div>
            </div>)}
            {Array.from({ length: Math.max(0, spec.teamSize - roster.length) }, (_, index) => <div className="arcade-team-slot is-empty" key={`empty-${index}`}><span className="arcade-empty-seat"><Users size={22} /><span>Đợi người…</span></span></div>)}
          </div>
        </div>;
      })}
    </div> : <div className="arcade-lobby-stage">{players.map((player) => <div key={player.id}><PlayerAvatar2D player={player} state={player.ready ? 'ready' : 'idle'} /><span className="arcade-ready-label">{player.ready ? '✓ Sẵn sàng' : 'Đang chuẩn bị'}{String(player.userId) === String(room.hostId) ? ' · Chủ phòng' : ''}</span></div>)}{Array.from({ length: room.capacity - players.length }, (_, index) => <div className="arcade-empty-seat" key={index}><Users size={40} /><span>Đợi đồng đội…</span></div>)}</div>}

    {teamMode && <p className="arcade-teams-note" data-balanced={balanced}>{balanced ? `Đủ đội hình ${spec.teamSize} đấu ${spec.teamSize}.` : `Cần đúng ${spec.teamSize} người mỗi đội trước khi bắt đầu.`} Đổi đội sẽ đặt lại trạng thái sẵn sàng.</p>}
    <p className="arcade-controls-info">{game.controls}</p>
    <div className="arcade-actions">
      <Button onClick={onReady} disabled={busy}>{me?.ready ? 'Hủy sẵn sàng' : 'Tôi đã sẵn sàng'}</Button>
      {teamMode && <Button variant="secondary" onClick={() => onSwitchTeam(otherTeam)} disabled={busy}><Shuffle size={17} /> Sang {teamNameVi(otherTeam)}</Button>}
      {isHost && <Button variant="secondary" disabled={!canStart || busy} onClick={onStart}><Play size={18} /> Bắt đầu</Button>}
    </div>
  </section>;
}
