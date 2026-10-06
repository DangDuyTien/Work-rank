import React, { useMemo } from 'react';
import { Layers, Zap, Check, Eye } from 'lucide-react';
import SamCard from './SamCard';
import DefaultAvatar from '../DefaultAvatar';

export default function SamActionBar({
  user,
  myPlayer,
  myHandCards = [],
  selectedCards = [],
  onToggleCard,
  onClearSelected,
  onSortHand,
  sortMode = 'RANK',
  isMyTurn = false,
  isSelfPassed = false,
  isSpectator = false,
  samPhase = 'PLAYING',
  canPlaySelected = false,
  selectedCombo = null,
  beatReason = '',
  actionLoading = false,
  onPlayCards,
  onPassTurn,
  onDeclareSam,
  hasTableCards = false,
}) {
  if (isSpectator) {
    return (
      <div className="sam-bottom-area">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            background: 'rgba(20, 26, 24, 0.9)',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            textAlign: 'center',
          }}
        >
          <Eye size={15} color="var(--accent)" />
          <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 700 }}>
            Bạn đang xem trận đấu với tư cách khán giả
          </span>
        </div>
      </div>
    );
  }

  // Dynamic overlap for cards based on total count to prevent mobile horizontal overflow
  const cardOverlap = useMemo(() => {
    const total = myHandCards.length;
    if (total <= 5) return 0;
    if (total <= 8) return -14;
    return -22; // For 9-10 cards
  }, [myHandCards.length]);

  return (
    <div className="sam-bottom-area">
      {/* ── ACTION BUTTON CONTROLS ── */}
      <div className="sam-action-bar">
        {samPhase === 'SAM_DECLARING' ? (
          myPlayer?.hasDeclaredSam === true ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: '#fef08a',
                fontWeight: 700,
                fontSize: 13,
                background: 'rgba(41, 28, 16, 0.85)',
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid rgba(217, 119, 6, 0.4)',
              }}
            >
              <Zap size={14} /> Bạn đã Xin Sâm. Đang chờ người khác…
            </div>
          ) : myPlayer?.hasDeclaredSam === false ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: '#94a3b8',
                fontWeight: 600,
                fontSize: 13,
                background: 'rgba(255, 255, 255, 0.06)',
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <Check size={14} /> Không Báo Sâm. Chờ bắt đầu ván…
            </div>
          ) : (
            <>
              <button
                type="button"
                className="sam-btn-action sam-btn-action--sam-declare"
                disabled={actionLoading}
                onClick={() => onDeclareSam(true)}
              >
                Báo Sâm (Xin Sâm)
              </button>
              <button
                type="button"
                className="sam-btn-action sam-btn-action--pass"
                disabled={actionLoading}
                onClick={() => onDeclareSam(false)}
              >
                Không báo
              </button>
            </>
          )
        ) : (
          /* PLAYING PHASE CONTROLS */
          <>
            {/* Sort Hand Button */}
            <button
              type="button"
              className="sam-btn-action sam-btn-action--secondary"
              onClick={onSortHand}
              title="Sắp xếp bài trên tay"
            >
              <Layers size={13} />
              <span>{sortMode === 'RANK' ? 'Xếp: Số' : 'Xếp: Bộ'}</span>
            </button>

            {/* Play Cards Action Button */}
            <button
              type="button"
              className={`sam-btn-action sam-btn-action--play ${!canPlaySelected ? 'is-disabled' : ''}`}
              disabled={!canPlaySelected || actionLoading}
              onClick={onPlayCards}
            >
              {actionLoading
                ? 'Đang gửi…'
                : selectedCards.length > 0 && selectedCombo?.isValid
                ? `Đánh ${selectedCombo.name}`
                : selectedCards.length > 0
                ? `Đánh (${selectedCards.length} lá)`
                : 'Đánh bài'}
            </button>

            {/* Pass Turn Action Button */}
            {hasTableCards && (
              <button
                type="button"
                className="sam-btn-action sam-btn-action--pass"
                disabled={!isMyTurn || isSelfPassed || actionLoading}
                onClick={onPassTurn}
              >
                Bỏ lượt
              </button>
            )}

            {/* Clear Selection Button */}
            {selectedCards.length > 0 && (
              <button
                type="button"
                className="sam-btn-action sam-btn-action--secondary"
                onClick={onClearSelected}
              >
                Bỏ chọn
              </button>
            )}
          </>
        )}
      </div>

      {/* Invalid move hint reason */}
      {isMyTurn && selectedCards.length > 0 && !canPlaySelected && beatReason && (
        <div
          style={{
            fontSize: 11,
            color: '#fca5a5',
            background: 'rgba(220, 38, 38, 0.15)',
            padding: '2px 8px',
            borderRadius: 4,
            border: '1px solid rgba(239, 68, 68, 0.25)',
            marginTop: -2,
          }}
        >
          {beatReason}
        </div>
      )}

      {/* ── PLAYER HAND TRAY ── */}
      <div className="sam-hand-wrapper">
        <div className="sam-hand-cards">
          {myHandCards.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 12, padding: '16px 0', fontStyle: 'italic' }}>
              Đang chia bài…
            </div>
          ) : (
            myHandCards.map((cardId, index) => {
              const isSelected = selectedCards.includes(cardId);
              return (
                <div
                  key={cardId}
                  style={{
                    marginRight: index < myHandCards.length - 1 ? `${cardOverlap}px` : '0px',
                    zIndex: isSelected ? 40 : index + 1,
                  }}
                >
                  <SamCard
                    cardId={cardId}
                    selected={isSelected}
                    onClick={onToggleCard}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── SELF INFO ROW ── */}
      <div className="sam-self-info">
        <DefaultAvatar name={user?.name} size={22} />
        <strong style={{ fontSize: 12 }}>{user?.name} (Bạn)</strong>
        {isSelfPassed && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#94a3b8',
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '1px 6px',
              borderRadius: 3,
            }}
          >
            Đã bỏ lượt
          </span>
        )}
        {isMyTurn && !isSelfPassed && (
          <span className="sam-turn-pill">
            LƯỢT CỦA BẠN
          </span>
        )}
      </div>
    </div>
  );
}
