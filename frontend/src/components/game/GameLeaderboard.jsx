import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Medal, Award, RefreshCw, Flame, User, TrendingUp, DollarSign, Target } from 'lucide-react';
import { capitalBoardGame } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AnimatedNumber } from '../ui';

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
      const res = await capitalBoardGame.getLeaderboard({ limit: 50 });
      const data = res?.data || res || {};
      const list = data.items || [];
      setLeaderboard(list);

      if (data.myProfile) {
        setMyProfile(data.myProfile);
      } else if (user?.id) {
        const found = list.find((p) => Number(p.userId) === Number(user.id));
        if (found) setMyProfile(found);
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

  const myGamesPlayed = myProfile?.gamesPlayed ?? myProfile?.totalGames ?? 0;
  const myGamesWon = myProfile?.gamesWon ?? myProfile?.totalWins ?? 0;
  const myWinRate = myGamesPlayed > 0 ? Math.round((myGamesWon / myGamesPlayed) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 2px' }}>
            Bảng Xếp Hạng Cờ Tỷ Phú WorkRank
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            Tích lũy Career Money từ các trận thắng cờ tỷ phú để vinh danh trên bảng xếp hạng toàn công ty.
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

      {/* My Profile Stat Card */}
      {myProfile && (
        <div
          style={{
            background: 'linear-gradient(135deg, var(--text-primary) 0%, #1e293b 100%)',
            color: 'var(--surface)',
            borderRadius: 8,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(15,23,42,0.1)',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'var(--accent-soft)',
                border: '2px solid var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
                fontWeight: 900,
                fontSize: 16,
              }}
            >
              {myProfile.rank ? `#${myProfile.rank}` : '—'}
            </div>

            <div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{user?.name || 'Bạn'} (Bạn)</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Hạng hiện tại: <strong style={{ color: 'var(--accent)' }}>{myProfile.rank ? `#${myProfile.rank}` : 'Chưa xếp hạng'}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 24, textAlign: 'right' }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Career Money</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace' }}>
                $<AnimatedNumber value={myProfile.careerMoney || 0} duration={600} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Thắng / Tổng số trận</div>
              <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace' }}>
                {myGamesWon} / {myGamesPlayed} ({myWinRate}%)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
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
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13, minWidth: 540 }}>
            <thead>
              <tr style={{ background: 'rgba(15,23,42,0.03)', borderBottom: '1px solid rgba(15,23,42,0.08)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 14px', width: 60, textAlign: 'center', fontWeight: 800 }}>HẠNG</th>
                <th style={{ padding: '10px 14px', fontWeight: 800 }}>THÀNH VIÊN</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800 }}>CAREER MONEY</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800 }}>SỐ TRẬN</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800 }}>THẮNG</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800 }}>TỈ LỆ THẮNG</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Đang tải bảng xếp hạng...
                  </td>
                </tr>
              ) : leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Chưa có trận đấu nào hoàn thành. Hãy là người đầu tiên chiến thắng!
                  </td>
                </tr>
              ) : (
                leaderboard.map((item, index) => {
                  const rank = item.rank || index + 1;
                  const isMe = Number(item.userId) === Number(user?.id);
                  const displayName = item.user?.name || `User #${item.userId}`;
                  const gamesPlayed = item.gamesPlayed ?? item.totalGames ?? 0;
                  const gamesWon = item.gamesWon ?? item.totalWins ?? 0;
                  const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
                  const careerMoney = item.careerMoney ?? 0;

                  return (
                    <tr
                      key={item.id || item.userId || index}
                      style={{
                        borderBottom: '1px solid rgba(15,23,42,0.05)',
                        background: isMe ? 'var(--accent-soft)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800 }}>
                        {rank === 1 ? (
                          <span style={{ color: '#eab308', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                            <Trophy size={15} /> 1
                          </span>
                        ) : rank === 2 ? (
                          <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                            <Medal size={15} /> 2
                          </span>
                        ) : rank === 3 ? (
                          <span style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                            <Award size={15} /> 3
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>#{rank}</span>
                        )}
                      </td>

                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              background: rank === 1 ? '#eab308' : 'var(--text-primary)',
                              color: 'var(--surface)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
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
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                              {displayName} {isMe && <span style={{ fontSize: 10, color: 'var(--info)' }}>(Bạn)</span>}
                            </div>
                            {item.user?.department && (
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.user.department}</div>
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
                        ${careerMoney.toLocaleString()}
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}>
                        {gamesPlayed}
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                        {gamesWon}
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', color: 'var(--info)', fontWeight: 800 }}>
                        {winRate}%
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
