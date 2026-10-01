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
      const res = await capitalBoardGame.getMyHistory(30);
      setHistory(res.data || []);
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
          <h2 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.25, color: '#0f172a', margin: '0 0 2px' }}>
            Lịch Sử Đấu Cờ Tỷ Phú
          </h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.55 }}>
            Xem lại kết quả các ván cờ đã tham gia và phần thưởng tích lũy.
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
            background: '#ffffff',
            border: '1px solid rgba(15,23,42,0.12)',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 600,
            color: '#0f172a',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* History List */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid rgba(15,23,42,0.1)',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(15,23,42,0.03)', borderBottom: '1px solid rgba(15,23,42,0.08)', color: '#64748b' }}>
              <th style={{ padding: '10px 14px', fontWeight: 600 }}>THỜI GIAN</th>
              <th style={{ padding: '10px 14px', fontWeight: 600 }}>PHÒNG</th>
              <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>HẠNG</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>TỔNG TÀI SẢN</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>TIỀN MẶT / ĐẤT</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>THƯỞNG CAREER</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                  Đang tải lịch sử...
                </td>
              </tr>
            ) : history.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                  Bạn chưa tham gia trận đấu nào. Hãy tạo hoặc tham gia một phòng chơi!
                </td>
              </tr>
            ) : (
              history.map((item) => {
                const isWon = item.finalRank === 1;
                const isBankrupt = item.status === 'BANKRUPT';

                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid rgba(15,23,42,0.05)',
                    }}
                  >
                    <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>
                      {formatDateTime(item.createdAt)}
                    </td>

                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                      {item.room?.name || `Phòng #${item.room?.code || item.roomId}`}
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
                            fontWeight: 600,
                            fontSize: 11,
                          }}
                        >
                          <Trophy size={13} /> Vô địch (#1)
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
                            fontWeight: 600,
                            fontSize: 11,
                          }}
                        >
                          <Skull size={13} /> Phá sản (#{item.finalRank})
                        </span>
                      ) : (
                        <span
                          style={{
                            background: 'rgba(15,23,42,0.06)',
                            color: '#475569',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontWeight: 600,
                            fontSize: 11,
                          }}
                        >
                          Hạng #{item.finalRank}
                        </span>
                      )}
                    </td>

                    <td
                      style={{
                        padding: '10px 14px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: '#0f172a',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      ${item.finalNetWorth?.toLocaleString()}
                    </td>

                    <td
                      style={{
                        padding: '10px 14px',
                        textAlign: 'right',
                        color: '#64748b',
                        fontSize: 12,
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      ${item.finalCash} / ${item.finalPropertyValue}
                    </td>

                    <td
                      style={{
                        padding: '10px 14px',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: item.careerReward > 0 ? '#16a34a' : '#94a3b8',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      {item.careerReward > 0 ? `+${item.careerReward} $` : '0 $'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
