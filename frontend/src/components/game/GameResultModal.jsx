import React from 'react';
import { Trophy, Medal, Award, DollarSign, ArrowRight, RotateCcw, Skull, Sparkles, Crown } from 'lucide-react';
import { AnimatedModal } from '../ui';

const RANK_BADGES = {
  1: { icon: Trophy, label: 'QUÁN QUÂN', bg: 'rgba(234,179,8,0.18)', color: '#ca8a04', border: '#eab308' },
  2: { icon: Medal, label: 'Á QUÂN', bg: 'rgba(148,163,184,0.18)', color: 'var(--text-secondary)', border: 'var(--text-muted)' },
  3: { icon: Award, label: 'HẠNG 3', bg: 'rgba(180,83,9,0.18)', color: 'var(--accent)', border: '#d97706' },
  4: { icon: Award, label: 'HẠNG 4', bg: 'rgba(100,116,139,0.12)', color: 'var(--text-secondary)', border: 'var(--border-2)' },
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
      maxWidth={580}
      hideCloseButton={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Top Winner Spotlight Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            padding: '24px 20px',
            borderRadius: 14,
            textAlign: 'center',
            position: 'relative',
            border: '2px solid rgba(234,179,8,0.4)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.2)',
            overflow: 'hidden',
          }}
        >
          {/* Champion Crown / Trophy */}
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(234,179,8,0.3) 0%, rgba(202,138,4,0.2) 100%)',
              border: '2.5px solid #eab308',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              color: '#eab308',
              boxShadow: '0 0 20px rgba(234,179,8,0.5)',
            }}
          >
            <Crown size={30} />
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 6px', letterSpacing: '-0.01em', color: '#ffffff' }}>
            CHÚC MỪNG QUÁN QUÂN
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>
            Chiến thắng thuộc về{' '}
            <strong style={{ color: '#facc15', fontWeight: 800 }}>
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
            const isBankrupt = res.status === 'BANKRUPT' || (res.finalCash === 0 && res.finalPropertyValue === 0 && rank > 1);
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
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: rank === 1 ? '2px solid #eab308' : '1px solid rgba(15,23,42,0.1)',
                  background: rank === 1 ? 'rgba(234,179,8,0.06)' : 'var(--surface)',
                  boxShadow: rank === 1 ? '0 4px 14px rgba(234,179,8,0.15)' : '0 2px 6px rgba(15,23,42,0.03)',
                }}
              >
                {/* Left: Rank & User */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: rankConf.bg,
                      color: rankConf.color,
                      border: `1.5px solid ${rankConf.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: 14,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                  >
                    {rank === 1 ? <Trophy size={18} /> : `#${rank}`}
                  </div>

                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {displayName}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {isBankrupt ? (
                        <span style={{ color: '#ef4444', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Skull size={12} /> Đã phá sản
                        </span>
                      ) : (
                        <span>
                          Tiền: <strong>${cash.toLocaleString()}</strong> | Đất: <strong>${propVal.toLocaleString()}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Net Worth & Rewards */}
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 900,
                      color: 'var(--text-primary)',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    ${netWorth.toLocaleString()}
                  </div>
                  {reward > 0 && (
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 800,
                        color: '#16a34a',
                        fontFamily: 'JetBrains Mono, monospace',
                        marginTop: 2,
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
              background: 'linear-gradient(135deg, var(--text-primary) 0%, #1e293b 100%)',
              color: 'var(--surface)',
              border: 'none',
              borderRadius: 8,
              padding: '12px 18px',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(15,23,42,0.18)',
            }}
          >
            <RotateCcw size={15} />
            <span>Về Sảnh Game</span>
          </button>

          <button
            type="button"
            onClick={onViewLeaderboard}
            style={{
              flex: 1,
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              border: '2px solid rgba(15,23,42,0.2)',
              borderRadius: 8,
              padding: '12px 18px',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: '0 2px 6px rgba(15,23,42,0.06)',
            }}
          >
            <span>Bảng Xếp Hạng</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
}

