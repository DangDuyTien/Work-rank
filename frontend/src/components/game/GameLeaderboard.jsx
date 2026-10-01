import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Medal, Award, RefreshCw, Flame, User, TrendingUp, DollarSign } from 'lucide-react';
import { capitalBoardGame } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function GameLeaderboard() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await capitalBoardGame.getLeaderboard(50);
      const list = res.data || [];
      setLeaderboard(list);

      // Find my position
      if (user?.id) {
        const found = list.find((p) => p.userId === user.id);
        if (found) {
          setMyProfile(found);
        } else {
          // If not in top 50, fetch my profile separately
          try {
            const meRes = await capitalBoardGame.getMyProfile();
            if (meRes.data) setMyProfile(meRes.data);
          } catch (e) {
            // No profile yet
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch game leaderboard:', err);
      setError('Không thể tải bảng xếp hạng cờ tỷ phú');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: '0 0 2px' }}>
            Bảng Xếp Hạng Cờ Tỷ Phú
          </h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Tích lũy Career Money từ các trận thắng cờ tỷ phú để leo top danh vọng 3winmedia.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLeaderboard}
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
            fontWeight: 700,
            color: '#0f172a',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* My Profile Stat Card */}
      {myProfile && (
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            borderRadius: 8,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(15,23,42,0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: 'rgba(56,189,248,0.2)',
                border: '2px solid #38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                fontWeight: 900,
                fontSize: 16,
              }}
            >
              {myProfile.rank ? `#${myProfile.rank}` : '—'}
            </div>

            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{user?.name || user?.username} (Bạn)</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                Hạng hiện tại: <strong style={{ color: '#38bdf8' }}>{myProfile.rank ? `#${myProfile.rank}` : 'Chưa xếp hạng'}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, textAlign: 'right' }}>
            <div>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Career Money</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#38bdf8', fontFamily: 'JetBrains Mono, monospace' }}>
                ${myProfile.careerMoney?.toLocaleString() || 0}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Thắng / Số trận</div>
              <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace' }}>
                {myProfile.totalWins || 0} / {myProfile.totalGames || 0} ({myProfile.winRate || 0}%)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
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
              <th style={{ padding: '10px 14px', width: 60, textAlign: 'center' }}>HẠNG</th>
              <th style={{ padding: '10px 14px' }}>THÀNH VIÊN</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>CAREER MONEY</th>
              <th style={{ padding: '10px 14px', textAlign: 'center' }}>SỐ TRẬN</th>
              <th style={{ padding: '10px 14px', textAlign: 'center' }}>THẮNG</th>
              <th style={{ padding: '10px 14px', textAlign: 'center' }}>TỈ LỆ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                  Đang tải bảng xếp hạng...
                </td>
              </tr>
            ) : leaderboard.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                  Chưa có trận đấu nào hoàn thành. Hãy là người đầu tiên chiến thắng!
                </td>
              </tr>
            ) : (
              leaderboard.map((item, index) => {
                const rank = index + 1;
                const isMe = item.userId === user?.id;
                const displayName = item.user?.name || item.user?.username || `User #${item.userId}`;

                return (
                  <tr
                    key={item.id || item.userId}
                    style={{
                      borderBottom: '1px solid rgba(15,23,42,0.05)',
                      background: isMe ? 'rgba(56,189,248,0.06)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800 }}>
                      {rank === 1 ? (
                        <span style={{ color: '#eab308', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          <Trophy size={15} /> 1
                        </span>
                      ) : rank === 2 ? (
                        <span style={{ color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          <Medal size={15} /> 2
                        </span>
                      ) : rank === 3 ? (
                        <span style={{ color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          <Award size={15} /> 3
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>#{rank}</span>
                      )}
                    </td>

                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: rank === 1 ? '#eab308' : '#0f172a',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          {item.user?.avatarUrl ? (
                            <img src={item.user.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                          ) : (
                            displayName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>
                            {displayName} {isMe && <span style={{ fontSize: 10, color: '#0284c7' }}>(Bạn)</span>}
                          </div>
                          {item.user?.department && (
                            <div style={{ fontSize: 11, color: '#64748b' }}>{item.user.department}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td
                      style={{
                        padding: '10px 14px',
                        textAlign: 'right',
                        fontWeight: 900,
                        color: '#16a34a',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      ${item.careerMoney?.toLocaleString()}
                    </td>

                    <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}>
                      {item.totalGames}
                    </td>

                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                      {item.totalWins}
                    </td>

                    <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', color: '#0284c7', fontWeight: 700 }}>
                      {item.winRate}%
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
