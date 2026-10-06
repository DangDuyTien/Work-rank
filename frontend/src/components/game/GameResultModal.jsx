import React from 'react';
import { Trophy, Medal, Award, DollarSign, ArrowRight, RotateCcw, Skull } from 'lucide-react';
import { AnimatedModal } from '../ui';

const RANK_BADGES = {
  1: { icon: Trophy, label: 'QUÁN QUÂN', bg: 'rgba(234,179,8,0.15)', color: '#ca8a04', border: '#eab308' },
  2: { icon: Medal, label: 'Á QUÂN', bg: 'rgba(148,163,184,0.15)', color: 'var(--text-secondary)', border: 'var(--text-muted)' },
  3: { icon: Award, label: 'HẠNG 3', bg: 'rgba(180,83,9,0.15)', color: 'var(--accent)', border: '#d97706' },
  4: { icon: Award, label: 'HẠNG 4', bg: 'rgba(100,116,139,0.1)', color: 'var(--text-secondary)', border: 'var(--border-2)' },
};

export default function GameResultModal({
  isOpen = true,
  results = [],
  onReturnToLobby,
  onViewLeaderboard,
}) {
  if (!results || results.length === 0) return null;

  // Sort by rank ascending
  const sortedResults = [...results].sort((a, b) => (a.rank || a.finalRank || 99) - (b.rank || b.finalRank || 99));
  const winner = sortedResults[0];

  return (
    <AnimatedModal
      isOpen={isOpen}
      onClose={onReturnToLobby}
      title="Kết Quả Trận Đấu Cờ Tỷ Phú"
      maxWidth={560}
      hideCloseButton={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Top Winner Spotlight Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, var(--text-primary) 0%, #1e293b 100%)',
            color: 'var(--surface)',
            padding: '20px 16px',
            borderRadius: 8,
            textAlign: 'center',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: 'rgba(234,179,8,0.2)',
              border: '2px solid #eab308',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 10px',
              color: '#eab308',
            }}
          >
            <Trophy size={26} />
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.01em', color: 'var(--surface)' }}>
            CHÚC MỪNG QUÁN QUÂN
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            Chiến thắng thuyết phục thuộc về{' '}
            <strong style={{ color: 'var(--accent)', fontWeight: 700 }}>
              {winner?.user?.name || `Người chơi ${winner?.rank || 1}`}
            </strong>
          </p>
        </div>

        {/* Podium Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sortedResults.map((res) => {
            const rank = res.rank || res.finalRank || 1;
            const rankConf = RANK_BADGES[rank] || RANK_BADGES[4];
            const Icon = rankConf.icon;
            const displayName = res.user?.name || `Người chơi ${rank}`;
            const isBankrupt = res.status === 'BANKRUPT' || res.finalCash === 0 && res.finalPropertyValue === 0 && rank > 1;
            const netWorth = res.finalNetWorth ?? res.netWorth ?? 0;
            const cash = res.finalCash ?? res.cash ?? 0;
            const propVal = res.finalPropertyValue ?? res.propertyValue ?? 0;
            const reward = res.rewardAmount ?? res.careerReward ?? 0;

            return (
              <div
                key={res.id || res.userId || rank}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: rank === 1 ? '2px solid #eab308' : '1px solid rgba(15,23,42,0.08)',
                  background: rank === 1 ? 'rgba(234,179,8,0.05)' : 'var(--surface)',
                }}
              >
                {/* Left: Rank & User */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: rankConf.bg,
                      color: rankConf.color,
                      border: `1px solid ${rankConf.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 13,
                    }}
                  >
                    {rank === 1 ? <Trophy size={16} /> : `#${rank}`}
                  </div>

                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {displayName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {isBankrupt ? (
                        <span style={{ color: '#ef4444', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Skull size={11} /> Phá sản
                        </span>
                      ) : (
                        <span>
                          Tiền: <strong>${cash}</strong> | Đất: <strong>${propVal}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Net Worth & Rewards */}
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    ${netWorth.toLocaleString()}
                  </div>
                  {reward > 0 && (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#16a34a',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      +{reward} Career $
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button
            type="button"
            onClick={onReturnToLobby}
            style={{
              flex: 1,
              background: 'var(--text-primary)',
              color: 'var(--surface)',
              border: 'none',
              borderRadius: 6,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <RotateCcw size={14} />
            <span>Về Sảnh Game</span>
          </button>

          <button
            type="button"
            onClick={onViewLeaderboard}
            style={{
              flex: 1,
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              border: '1.5px solid rgba(15,23,42,0.2)',
              borderRadius: 6,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span>Bảng Xếp Hạng</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
}
