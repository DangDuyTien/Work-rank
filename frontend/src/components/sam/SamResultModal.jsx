import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, LogOut, RotateCcw } from 'lucide-react';
import { Button } from '../ui';

export default function SamResultModal({
  isOpen = false,
  result = [],
  isSamWin = false,
  isTest = false,
  onPlayAgain,
  onLeave,
}) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && onLeave) {
        onLeave();
      }
    },
    [onLeave]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !Array.isArray(result) || result.length === 0) return null;

  const winner = result.find((r) => r.isWinner) || result[0];

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sam-result-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 14, 12, 0.88)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2200,
        padding: 16,
        overflowY: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onLeave) {
          onLeave();
        }
      }}
    >
      <div
        style={{
          background: '#161e1b',
          color: '#f8fafc',
          borderRadius: 14,
          maxWidth: 480,
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.12)',
          overflow: 'hidden',
          textAlign: 'center',
          animation: 'modal-enter var(--motion-normal) var(--ease-emphasized) forwards',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header Banner */}
        <div
          style={{
            padding: '20px 16px 14px',
            background: 'radial-gradient(ellipse at top, #23302b 0%, #161e1b 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#b45309',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 8px',
              border: '1px solid rgba(245, 158, 11, 0.5)',
            }}
          >
            <Trophy size={24} color="#fef08a" />
          </div>

          <h2
            id="sam-result-title"
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 800,
              color: '#f8fafc',
              letterSpacing: '-0.01em',
            }}
          >
            {isSamWin ? 'Thắng Sâm!' : 'Kết Thúc Ván Đấu'}
          </h2>

          <div style={{ fontSize: 13, color: '#fbbf24', marginTop: 3, fontWeight: 700 }}>
            Về nhất: <strong>{winner?.name || 'Vô danh'}</strong>
          </div>
        </div>

        {/* Players Score Ledger */}
        <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1 }}>
          <div
            style={{
              background: '#1c2622',
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
                textAlign: 'left',
              }}
            >
              <thead>
                <tr
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    color: '#94a3b8',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <th style={{ padding: '8px 10px' }}>Người chơi</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Còn lại</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Trạng thái</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Điểm</th>
                </tr>
              </thead>
              <tbody>
                {result.map((p, idx) => {
                  const isWin = Boolean(p.isWinner);
                  const delta = p.scoreDelta || 0;
                  return (
                    <tr
                      key={p.userId || idx}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: isWin ? 'rgba(217, 119, 6, 0.1)' : 'transparent',
                      }}
                    >
                      <td
                        style={{
                          padding: '8px 10px',
                          fontWeight: 700,
                          color: isWin ? '#fbbf24' : '#f8fafc',
                        }}
                      >
                        {isWin && (
                          <Trophy
                            size={13}
                            color="#fbbf24"
                            style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }}
                          />
                        )}
                        {p.name}
                      </td>
                      <td
                        style={{
                          padding: '8px 10px',
                          textAlign: 'center',
                          color: '#94a3b8',
                        }}
                      >
                        {p.remainingCards != null ? `${p.remainingCards} lá` : '0 lá'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 3,
                            background: isWin
                              ? 'rgba(16,185,129,0.18)'
                              : 'rgba(239,68,68,0.18)',
                            color: isWin ? '#34d399' : '#f87171',
                          }}
                        >
                          {isWin
                            ? isSamWin
                              ? 'Thắng Sâm'
                              : 'Về nhất'
                            : p.reason || 'Thua'}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '8px 10px',
                          textAlign: 'right',
                          fontWeight: 800,
                          color:
                            delta > 0
                              ? '#34d399'
                              : delta < 0
                              ? '#f87171'
                              : '#94a3b8',
                        }}
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '12px 16px 16px',
            display: 'flex',
            gap: 8,
            justifyContent: 'center',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(16, 22, 19, 0.7)',
          }}
        >
          <Button
            variant="outline"
            onClick={onLeave}
            style={{ color: '#cbd5e1', borderColor: 'rgba(255,255,255,0.18)' }}
          >
            <LogOut size={14} /> Rời bàn
          </Button>
          <Button
            variant="primary"
            onClick={onPlayAgain}
            style={{
              background: '#b45309',
              borderColor: '#d97706',
              color: '#ffffff',
              fontWeight: 800,
            }}
          >
            <RotateCcw size={14} /> Chơi ván tiếp
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
