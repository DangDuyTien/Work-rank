import React from 'react';
import {
  Club,
  Trophy,
  Swords,
  Flame,
  Crown,
  Plus,
  HelpCircle,
  Bot,
  Zap,
  Users,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import {
  Card,
  Button,
  SegmentedControl,
  EmptyState,
  StatCard,
  Skeleton,
  TabTransition,
} from '../ui';
import DefaultAvatar from '../DefaultAvatar';
import JobTitleBadge from '../JobTitleBadge';

export default function SamLobby({
  user,
  isAdmin = false,
  rooms = [],
  botTestRooms = [],
  leaderboard = [],
  myStats = null,
  activeRoom = null,
  activeTab = 'LOBBY',
  setActiveTab,
  loading = false,
  errorMsg = null,
  onDismissError,
  onOpenCreateModal,
  onOpenBotModal,
  onOpenRulesModal,
  onCreatePracticeRoom,
  onJoinRoom,
}) {
  return (
    <div
      style={{
        maxWidth: 1080,
        margin: '0 auto',
        padding: '24px 16px 40px',
        fontFamily: "'Space Grotesk', -apple-system, sans-serif",
      }}
    >
      {/* Header Section */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 800,
              color: '#b45309',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 4,
            }}
          >
            <Club size={14} /> Trò Chơi Nội Bộ WorkRank
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>
            Đánh Sâm Lốc
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
            Trò chơi bài dân gian 2–4 người chơi theo lượt thời gian thực server-authoritative
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={onOpenRulesModal}>
            <HelpCircle size={15} /> Luật chơi
          </Button>
          {onCreatePracticeRoom && (
            <Button
              variant="secondary"
              onClick={() => onCreatePracticeRoom(3)}
              style={{ color: '#0284c7', borderColor: 'rgba(2,132,199,0.3)', fontWeight: 700 }}
            >
              <Bot size={15} /> Luyện tập Bot
            </Button>
          )}
          {isAdmin && (
            <Button variant="secondary" onClick={onOpenBotModal} style={{ color: '#7c3aed', borderColor: 'rgba(124,58,237,0.3)' }}>
              <Bot size={15} /> Bot Test
            </Button>
          )}
          <Button
            variant="primary"
            onClick={onOpenCreateModal}
            style={{ background: '#b45309', borderColor: '#b45309', fontWeight: 800 }}
          >
            <Plus size={15} /> Tạo phòng mới
          </Button>
        </div>
      </div>

      {/* Error Message Alert Banner */}
      {errorMsg && (
        <div
          style={{
            marginBottom: 20,
            padding: '12px 16px',
            background: '#fef2f2',
            border: '1px solid #f87171',
            borderRadius: 8,
            color: '#b91c1c',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{errorMsg}</span>
          {onDismissError && (
            <button
              type="button"
              onClick={onDismissError}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#b91c1c',
                cursor: 'pointer',
                fontSize: 18,
                lineHeight: 1,
                padding: '0 4px',
              }}
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Active Room Rejoin Banner */}
      {activeRoom && (
        <Card
          style={{
            marginBottom: 20,
            padding: '16px 20px',
            background: 'rgba(180,83,9,0.06)',
            border: '1px solid rgba(180,83,9,0.25)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            borderRadius: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'rgba(180,83,9,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#b45309',
              }}
            >
              <Zap size={20} />
            </div>
            <div>
              <strong style={{ fontSize: 14, color: '#111827', display: 'block' }}>
                Bạn có một trận đấu đang diễn ra: {activeRoom.title}
              </strong>
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                Mã: {activeRoom.code} • Số người: {activeRoom.players?.length || 0}/{activeRoom.maxPlayers}
              </span>
            </div>
          </div>
          <Button
            variant="primary"
            onClick={() => onJoinRoom(activeRoom.id)}
            style={{ background: '#b45309', borderColor: '#b45309', fontWeight: 800 }}
          >
            Vào lại bàn chơi
          </Button>
        </Card>
      )}

      {/* Personal Stats Bar */}
      {myStats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <StatCard
            icon={Trophy}
            label="Tổng Điểm Sâm"
            value={myStats.totalPoints || 0}
            color="#b45309"
          />
          <StatCard
            icon={Swords}
            label="Trận Đã Chơi"
            value={myStats.gamesPlayed || 0}
            color="var(--info)"
          />
          <StatCard
            icon={Flame}
            label="Tỉ Lệ Thắng"
            value={`${myStats.winRate || 0}%`}
            detail={`${myStats.gamesWon || 0} trận thắng`}
            color="#15803d"
          />
          <StatCard
            icon={Crown}
            label="Chuỗi Thắng Cao Nhất"
            value={`${myStats.maxWinStreak || 0} trận`}
            color="#7c3aed"
          />
        </div>
      )}

      {/* Tabs */}
      <SegmentedControl
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { key: 'LOBBY', label: 'Sảnh Chờ' },
          { key: 'LEADERBOARD', label: 'Bảng Xếp Hạng' },
          { key: 'RULES', label: 'Hướng Dẫn & Luật' },
        ]}
      />

      {/* Tab Contents with Smooth TabTransition */}
      <TabTransition key={activeTab} minHeight={360} style={{ marginTop: 20 }}>
        {/* TAB 1: LOBBY */}
        {activeTab === 'LOBBY' && (
          <div>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={140} radius={12} />
                ))}
              </div>
            ) : rooms.length === 0 ? (
              <EmptyState
                icon={Club}
                title="Chưa có phòng nào đang mở"
                description="Hãy là người đầu tiên tạo phòng Đánh Sâm và mời các đồng nghiệp cùng tham gia!"
                action={
                  <Button
                    variant="primary"
                    onClick={onOpenCreateModal}
                    style={{ background: '#b45309', borderColor: '#b45309', marginTop: 12, fontWeight: 800 }}
                  >
                    Tạo phòng ngay
                  </Button>
                }
              />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 16,
                }}
              >
                {rooms.map((r) => {
                  const isPlaying = r.status === 'PLAYING';
                  const isFull = r.playerCount >= r.maxPlayers;

                  return (
                    <Card
                      key={r.id}
                      style={{
                        padding: 18,
                        background: '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: 140,
                        borderRadius: 12,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
                        border: '1px solid rgba(0,0,0,0.08)',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 8,
                          }}
                        >
                          <strong style={{ fontSize: 14, color: '#111827' }}>{r.title}</strong>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: isPlaying ? 'rgba(37,99,235,0.1)' : 'rgba(21,128,61,0.1)',
                              color: isPlaying ? 'var(--info)' : 'var(--success)',
                            }}
                          >
                            {isPlaying ? 'Đang đấu' : 'Đang chờ'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <DefaultAvatar name={r.host?.name} size={24} />
                          <span style={{ fontSize: 12, color: '#4b5563' }}>
                            Chủ phòng: <strong>{r.host?.name}</strong>
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderTop: '1px solid rgba(0,0,0,0.06)',
                          paddingTop: 12,
                        }}
                      >
                        <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Users size={14} /> {r.playerCount || 1}/{r.maxPlayers} người
                          {r.spectatorCount > 0 && (
                            <span style={{ marginLeft: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Eye size={12} /> {r.spectatorCount}
                            </span>
                          )}
                        </span>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => onJoinRoom(r.id)}
                          disabled={!isPlaying && isFull}
                          style={{ background: isPlaying ? 'var(--info)' : 'var(--primary)', fontWeight: 700 }}
                        >
                          {isPlaying ? 'Xem Trận' : 'Tham gia'}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Admin Bot Test Rooms Section */}
            {isAdmin && botTestRooms.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Bot size={15} color="#7c3aed" />
                  <strong style={{ fontSize: 12, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Phòng Bot Test Simulator (Admin Only)
                  </strong>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {botTestRooms.map((r) => (
                    <Card
                      key={r.id}
                      style={{
                        padding: 14,
                        background: 'rgba(124,58,237,0.04)',
                        border: '1px dashed rgba(124,58,237,0.3)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderRadius: 10,
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 13, color: '#111827' }}>{r.title}</strong>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                          {r.playerCount}/{r.maxPlayers} người • Bot: {r.botDifficulty || 'NORMAL'}
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => onJoinRoom(r.id)}>
                        Vào →
                      </Button>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LEADERBOARD */}
        {activeTab === 'LEADERBOARD' && (
          <Card style={{ padding: 0, overflow: 'hidden', background: '#ffffff', borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 800, width: 70 }}>Hạng</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 800 }}>Người chơi</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800 }}>Trận</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800 }}>Thắng</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800 }}>Tỉ lệ</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800 }}>Tổng Điểm</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>
                      Chưa có dữ liệu bảng xếp hạng Sâm Lốc
                    </td>
                  </tr>
                ) : (
                  leaderboard.map((item) => (
                    <tr
                      key={item.userId}
                      style={{
                        borderBottom: '1px solid rgba(0,0,0,0.04)',
                        background: Number(item.userId) === Number(user?.id) ? 'rgba(180,83,9,0.04)' : '#ffffff',
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 900 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 800,
                            background:
                              item.rank === 1
                                ? 'rgba(217, 119, 6, 0.15)'
                                : item.rank === 2
                                ? 'rgba(148, 163, 184, 0.2)'
                                : item.rank === 3
                                ? 'rgba(180, 83, 9, 0.12)'
                                : 'transparent',
                            color:
                              item.rank === 1
                                ? '#b45309'
                                : item.rank === 2
                                ? '#475569'
                                : item.rank === 3
                                ? '#92400e'
                                : '#64748b',
                            border: item.rank <= 3 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                          }}
                        >
                          {item.rank}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <DefaultAvatar name={item.user?.name} size={30} />
                          <div>
                            <strong style={{ fontSize: 13, color: '#111827', display: 'block' }}>
                              {item.user?.name} {Number(item.userId) === Number(user?.id) && '(Bạn)'}
                            </strong>
                            <JobTitleBadge jobTitle={item.user?.jobTitle} size="xs" />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#4b5563' }}>
                        {item.gamesPlayed}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#15803d' }}>
                        {item.gamesWon}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#4b5563' }}>
                        {item.winRate}%
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: '#b45309' }}>
                        {item.totalPoints}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        )}

        {/* TAB 3: RULES */}
        {activeTab === 'RULES' && (
          <Card style={{ padding: 24, background: '#ffffff', lineHeight: 1.7, borderRadius: 12 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginBottom: 14 }}>
              Quy chuẩn luật chơi Sâm Lốc WorkRank
            </h2>
            <div style={{ fontSize: 14, color: '#374151' }}>
              <p>
                <strong>Sâm Lốc</strong> là trò chơi bài dân gian phổ biến sử dụng bộ bài 52 lá tiêu chuẩn, từ 2 đến 4 người chơi.
                Mỗi người chơi được chia 10 lá bài.
              </p>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '14px 0 6px' }}>
                Thứ tự quân bài
              </h3>
              <p>
                3 &lt; 4 &lt; 5 &lt; 6 &lt; 7 &lt; 8 &lt; 9 &lt; 10 &lt; J &lt; Q &lt; K &lt; A &lt; 2.
                <br />
                Đặc điểm quan trọng: <em>Không phân biệt chất bài</em>. Đôi chặn đôi lớn hơn, sám chặn sám lớn hơn, sảnh chặn sảnh cùng độ dài lớn hơn.
              </p>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '14px 0 6px' }}>
                Tứ quý chặt 2
              </h3>
              <p>
                1 Tứ quý bất kỳ có thể chặt được 1 quân 2 (Heo). Tứ quý lớn hơn chặt được Tứ quý nhỏ hơn.
              </p>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '14px 0 6px' }}>
                Luật Xin Sâm
              </h3>
              <p>
                10 giây đầu ván, người chơi có thể Báo Sâm. Nếu thành công đánh hết 10 lá không ai chặn được, bạn nhận thưởng lớn (+20 điểm mỗi người). Nếu bị ai chặn dù chỉ 1 lượt, bạn đền Sâm.
              </p>
            </div>
          </Card>
        )}
      </TabTransition>
    </div>
  );
}
