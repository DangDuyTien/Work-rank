import React from 'react';
import { Club, Clock } from 'lucide-react';
import SamCard from './SamCard';

export default function SamTable({
  room,
  timeLeft = 25,
  isMyTurn = false,
}) {
  const lastPlayedCards = room?.lastPlayedCards;
  const isSamPhase = room?.samPhase === 'SAM_DECLARING';
  const isSamDeclaredMatch = Boolean(room?.samDeclarerId);

  return (
    <div className={`sam-felt-table ${isMyTurn ? 'is-my-turn' : ''}`}>
      {/* Countdown Timer */}
      <div className={`sam-felt-table__timer ${timeLeft <= 5 ? 'is-urgent' : ''}`}>
        <Clock size={12} />
        <span>{timeLeft}s</span>
      </div>

      {/* Round / Match Phase Indicator */}
      <div className={`sam-felt-table__round ${isSamDeclaredMatch ? 'is-sam' : ''}`}>
        {isSamDeclaredMatch ? (
          <span>Ván Xin Sâm</span>
        ) : (
          <span>Vòng {room?.roundNumber || 1}</span>
        )}
      </div>

      {/* Center Trick Stack */}
      {lastPlayedCards && Array.isArray(lastPlayedCards.cards) && lastPlayedCards.cards.length > 0 ? (
        <div
          key={`trick-${lastPlayedCards.userId}-${lastPlayedCards.cards.join('-')}`}
          className="sam-trick-container"
        >
          <div className="sam-trick-cards">
            {lastPlayedCards.cards.map((c, i) => {
              const cardCount = lastPlayedCards.cards.length;
              const angle = (i - (cardCount - 1) / 2) * 3.5;
              return (
                <div
                  key={`${c}-${i}`}
                  className="sam-trick-card-wrapper"
                >
                  <SamCard
                    cardId={c}
                    disabled
                    small
                    style={{
                      transform: `rotate(${angle}deg)`,
                      boxShadow: '0 4px 10px rgba(0,0,0,0.35)',
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div className="sam-trick-name-badge">
            {lastPlayedCards.name || 'Bộ bài vừa đánh'}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: '#64748b' }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 6px',
            }}
          >
            <Club size={20} color="#d97706" opacity={0.6} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
            {isSamPhase ? 'Giai đoạn Báo Sâm' : 'Vòng Mới'}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            {isSamPhase
              ? 'Kiểm tra bài và chọn Báo Sâm nếu muốn đi trước'
              : isMyTurn
              ? 'Lượt của bạn đi đầu vòng'
              : 'Đang chờ đối thủ đánh…'}
          </div>
        </div>
      )}
    </div>
  );
}
