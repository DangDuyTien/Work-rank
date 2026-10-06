import React from 'react';
import { Layers } from 'lucide-react';
import DefaultAvatar from '../DefaultAvatar';

export default function SamPlayerSeat({
  player,
  isTurn = false,
  timeLeft = 25,
  position = 'top',
  samPhase = 'PLAYING',
  samDeclarerId = null,
  passPlayerIds = [],
}) {
  if (!player) return null;

  const isBot = Boolean(player.isBot);
  const isBaoMot = Boolean(player.isBaoMot);
  const cardCount = player.remainingCardsCount ?? 10;
  const name = isBot ? (player.botName || 'Bot AI') : (player.user?.name || 'Người chơi');
  const playerId = player.userId ? Number(player.userId) : (player.id || player.botId);
  const isPassed = Array.isArray(passPlayerIds) && passPlayerIds.some((pid) => String(pid) === String(playerId));
  const isSamDeclarer = samDeclarerId && String(samDeclarerId) === String(playerId);

  return (
    <div
      className={`sam-opponent-seat ${isPassed ? 'is-passed' : ''}`}
      data-position={position}
    >
      {/* Avatar Container */}
      <div
        className={`sam-opponent-avatar-wrap ${isTurn && !isPassed ? 'is-turn' : ''} ${isSamDeclarer ? 'is-sam-declarer' : ''}`}
      >
        <DefaultAvatar name={name} size={42} />

        {/* Mini Turn Countdown */}
        {isTurn && !isPassed && (
          <div
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: timeLeft <= 5 ? '#dc2626' : '#d97706',
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 900,
              width: 18,
              height: 18,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #111715',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {timeLeft}
          </div>
        )}

        {/* Card Count Pill */}
        <div className={`sam-opponent-card-pill ${isBaoMot ? 'is-bao-mot' : ''}`}>
          <Layers size={10} style={{ opacity: 0.8 }} />
          <span>{cardCount} lá</span>
        </div>
      </div>

      {/* Name */}
      <div className="sam-opponent-name" title={name}>
        {name}
      </div>

      {/* Status Tags */}
      <div className="sam-opponent-tags">
        {isBot && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              background: 'rgba(217, 119, 6, 0.15)',
              color: '#fbbf24',
              padding: '1px 4px',
              borderRadius: 3,
            }}
          >
            BOT
          </span>
        )}
        {player.isHost && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              background: 'rgba(180, 83, 9, 0.2)',
              color: '#f59e0b',
              padding: '1px 4px',
              borderRadius: 3,
            }}
          >
            CHỦ BÀN
          </span>
        )}

        {/* SÂM PHASE */}
        {samPhase === 'SAM_DECLARING' ? (
          player.hasDeclaredSam === true ? (
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                background: 'rgba(217, 119, 6, 0.25)',
                color: '#fef08a',
                padding: '1px 5px',
                borderRadius: 3,
                border: '1px solid rgba(217, 119, 6, 0.4)',
              }}
            >
              Báo Sâm
            </span>
          ) : player.hasDeclaredSam === false ? (
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#94a3b8',
                padding: '1px 4px',
                borderRadius: 3,
              }}
            >
              Không báo
            </span>
          ) : (
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#cbd5e1',
                padding: '1px 4px',
                borderRadius: 3,
              }}
            >
              Đang chọn
            </span>
          )
        ) : (
          /* PLAYING PHASE */
          <>
            {isSamDeclarer && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  background: 'rgba(217, 119, 6, 0.25)',
                  color: '#fef08a',
                  padding: '1px 5px',
                  borderRadius: 3,
                  border: '1px solid rgba(217, 119, 6, 0.4)',
                }}
              >
                Xin Sâm
              </span>
            )}
            {isBaoMot && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  background: '#dc2626',
                  color: '#ffffff',
                  padding: '1px 4px',
                  borderRadius: 3,
                }}
              >
                Báo 1
              </span>
            )}
            {isPassed ? (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#94a3b8',
                  padding: '1px 4px',
                  borderRadius: 3,
                }}
              >
                Bỏ lượt
              </span>
            ) : isTurn ? (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  background: 'rgba(217, 119, 6, 0.2)',
                  color: '#fbbf24',
                  padding: '1px 4px',
                  borderRadius: 3,
                  border: '1px solid rgba(217, 119, 6, 0.35)',
                }}
              >
                Lượt đi
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
