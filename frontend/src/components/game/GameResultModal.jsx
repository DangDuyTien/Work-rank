import React from 'react';
import { Trophy, Medal, Award, DollarSign, ArrowRight, RotateCcw } from 'lucide-react';

const RANK_BADGES = {
  1: { icon: Trophy, label: 'QUÁN QUÂN', bg: 'rgba(234,179,8,0.15)', color: '#ca8a04', border: '#eab308' },
  2: { icon: Medal, label: 'Á QUÂN', bg: 'rgba(148,163,184,0.15)', color: '#64748b', border: '#94a3b8' },
  3: { icon: Award, label: 'HẠNG 3', bg: 'rgba(180,83,9,0.15)', color: '#b45309', border: '#d97706' },
  4: { icon: Award, label: 'HẠNG 4', bg: 'rgba(100,116,139,0.1)', color: '#475569', border: '#cbd5e1' },
};

export default function GameResultModal({
  results = [],
  onReturnToLobby,
  onViewLeaderboard,
}) {
  if (!results || results.length === 0) return null;

  // Sort by finalRank ascending
  const sortedResults = [...results].sort((a, b) => a.finalRank - b.finalRank);
  const winner = sortedResults[0];

  return (
    <div
      className="modal-backdrop-enter"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15,23,42,0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        className="modal-dialog-enter"
        style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid rgba(15,23,42,0.15)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          width: '100%',
          maxWidth: 580,
          overflow: 'hidden',
        }}
      >
        {/* Header Ribbon */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            padding: '24px 20px',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: 'rgba(234,179,8,0.2)',
              border: '2px solid #eab308',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              color: '#eab308',
            }}
          >
            <Trophy size={28} />
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.25, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            KẾT QUẢ TRẬN ĐẤU
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.55 }}>
            Chúc mừng Quán quân{' '}
            <strong style={{ color: '#38bdf8', fontWeight: 600 }}>
              {winner?.user?.name || winner?.user?.username || 'Người chơi 1'}
            </strong>
            !
          </p>
        </div>

        {/* Podium / Results Table */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sortedResults.map((res) => {
            const rankConf = RANK_BADGES[res.finalRank] || RANK_BADGES[4];
            const Icon = rankConf.icon;
            const displayName = res.user?.name || res.user?.username || `Người chơi ${res.finalRank}`;

            return (
              <div
                key={res.id || res.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: res.finalRank === 1 ? '2px solid #eab308' : '1px solid rgba(15,23,42,0.08)',
                  background: res.finalRank === 1 ? 'rgba(234,179,8,0.05)' : '#ffffff',
                }}
              >
                {/* Left Rank & User */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {res.finalRank === 1 ? <Trophy size={16} /> : `#${res.finalRank}`}
                  </div>

                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{displayName}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {res.status === 'BANKRUPT' ? (
                        <span style={{ color: '#ef4444', fontWeight: 600 }}>Phá sản</span>
                      ) : (
                        <span>
                          Tiền: <strong style={{ fontWeight: 600 }}>${res.finalCash}</strong> | Tài sản: <strong style={{ fontWeight: 600 }}>${res.finalPropertyValue}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Rewards & Net Worth */}
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#0f172a',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    ${res.finalNetWorth}
                  </div>
                  {res.careerReward > 0 && (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#16a34a',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      +{res.careerReward} Career $
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions Footer */}
        <div
          style={{
            padding: '14px 20px',
            background: 'rgba(15,23,42,0.02)',
            borderTop: '1px solid rgba(15,23,42,0.08)',
            display: 'flex',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onReturnToLobby}
            style={{
              flex: 1,
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
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
              background: '#ffffff',
              color: '#0f172a',
              border: '1.5px solid rgba(15,23,42,0.2)',
              borderRadius: 6,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
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
    </div>
  );
}
