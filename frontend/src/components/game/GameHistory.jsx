import React, { useState, useEffect, useCallback } from 'react';
import { History, Trophy, RefreshCw, Calendar, Clock, DollarSign, Award, Skull } from 'lucide-react';
import { capitalBoardGame } from '../../services/api';

function formatDateTime(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function GameHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await capitalBoardGame.getMyHistory({ limit: 30 });
      const data = Array.isArray(res) ? res : (res?.data || []);
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch game history:', err);
      setError('Không thể tải lịch sử trận đấu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 2px' }}>
            Lịch Sử Đấu Cờ Tỷ Phú
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            Xem lại kết quả các ván cờ đã tham gia và phần thưởng Career Money tích lũy.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchHistory}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--surface)',
            border: '1px solid rgba(15,23,42,0.12)',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-primary)',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* History Table */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid rgba(15,23,42,0.1)',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13, minWidth: 600 }}>
            <thead>
              <tr style={{ background: 'rgba(15,23,42,0.03)', borderBottom: '1px solid rgba(15,23,42,0.08)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>THỜI GIAN</th>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>PHÒNG</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800 }}>HẠNG</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800 }}>TỔNG TÀI SẢN</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800 }}>TIỀN MẶT / ĐẤT</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800 }}>THƯỞNG CAREER</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Đang tải lịch sử...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Bạn chưa tham gia trận đấu nào. Hãy tạo hoặc tham gia một phòng chơi!
                  </td>
                </tr>
              ) : (
                history.map((item, idx) => {
                  const rank = item.rank || item.finalRank || 1;
                  const isWon = rank === 1;
                  const isBankrupt = item.status === 'BANKRUPT' || (item.finalCash === 0 && item.finalPropertyValue === 0 && rank > 1);
                  const roomTitle = item.roomTitle || item.room?.title || item.room?.name || `Phòng #${item.roomCode || item.roomId || item.room?.code}`;
                  const playedAt = item.playedAt || item.createdAt;
                  const netWorth = item.finalNetWorth ?? item.netWorth ?? 0;
                  const cash = item.finalCash ?? item.cash ?? 0;
                  const propVal = item.finalPropertyValue ?? item.propertyValue ?? 0;
                  const reward = item.rewardAmount ?? item.careerReward ?? 0;

                  return (
                    <tr
                      key={item.id || idx}
                      style={{
                        borderBottom: '1px solid rgba(15,23,42,0.05)',
                      }}
                    >
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 12 }}>
                        {formatDateTime(playedAt)}
                      </td>

                      <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {roomTitle}
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {isWon ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: 'rgba(234,179,8,0.15)',
                              color: '#ca8a04',
                              padding: '3px 8px',
                              borderRadius: 4,
                              fontWeight: 800,
                              fontSize: 11,
                            }}
                          >
                            <Trophy size={13} /> Quán quân (#1)
                          </span>
                        ) : isBankrupt ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: 'rgba(239,68,68,0.1)',
                              color: '#ef4444',
                              padding: '3px 8px',
                              borderRadius: 4,
                              fontWeight: 800,
                              fontSize: 11,
                            }}
                          >
                            <Skull size={13} /> Phá sản (#{rank})
                          </span>
                        ) : (
                          <span
                            style={{
                              background: 'rgba(15,23,42,0.06)',
                              color: 'var(--text-secondary)',
                              padding: '3px 8px',
                              borderRadius: 4,
                              fontWeight: 800,
                              fontSize: 11,
                            }}
                          >
                            Hạng #{rank}
                          </span>
                        )}
                      </td>

                      <td
                        style={{
                          padding: '10px 14px',
                          textAlign: 'right',
                          fontWeight: 800,
                          color: 'var(--text-primary)',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      >
                        ${netWorth.toLocaleString()}
                      </td>

                      <td
                        style={{
                          padding: '10px 14px',
                          textAlign: 'right',
                          color: 'var(--text-secondary)',
                          fontSize: 12,
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      >
                        ${cash} / ${propVal}
                      </td>

                      <td
                        style={{
                          padding: '10px 14px',
                          textAlign: 'right',
                          fontWeight: 800,
                          color: reward > 0 ? '#16a34a' : 'var(--text-muted)',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      >
                        {reward > 0 ? `+${reward} $` : '0 $'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
