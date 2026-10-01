import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Club,
  Spade,
  Heart,
  Diamond,
  Trophy,
  Users,
  Play,
  LogOut,
  Clock,
  Crown,
  ArrowLeft,
  Copy,
  Check,
  RotateCcw,
  Volume2,
  VolumeX,
  HelpCircle,
  Sparkles,
  Plus,
  AlertCircle,
  ShieldCheck,
  Swords,
  Flame,
  CheckCircle2,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { samGame } from '../services/api';
import { useAuth } from '../context/AuthContext';
import DefaultAvatar from '../components/DefaultAvatar';
import JobTitleBadge from '../components/JobTitleBadge';
import GameFullscreenShell from '../components/game/GameFullscreenShell';
import {
  Card,
  Button,
  SegmentedControl,
  EmptyState,
  PageState,
  Notice,
  StatCard,
  Skeleton,
} from '../components/ui';

// ── PLAYING CARD SUIT CONFIG ──
const SUIT_META = {
  S: { label: 'Bích', color: '#111827', Icon: Spade },
  C: { label: 'Tép', color: '#111827', Icon: Club },
  D: { label: 'Rô', color: '#dc2626', Icon: Diamond },
  H: { label: 'Cơ', color: '#dc2626', Icon: Heart },
};

function parseCardString(cardStr) {
  if (!cardStr || typeof cardStr !== 'string') return null;
  const suit = cardStr.slice(-1).toUpperCase();
  const rank = cardStr.slice(0, -1).toUpperCase();
  const meta = SUIT_META[suit] || SUIT_META.S;
  return { id: cardStr, rank, suit, color: meta.color, Icon: meta.Icon, label: meta.label };
}

// ── PLAYING CARD COMPONENT ──
function PlayingCard({
  cardId,
  selected = false,
  onClick,
  disabled = false,
  small = false,
  isBack = false,
}) {
  if (isBack) {
    return (
      <div
        style={{
          width: small ? 38 : 56,
          height: small ? 56 : 82,
          borderRadius: 4,
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          border: '1px solid rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          userSelect: 'none',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: small ? 24 : 36,
            height: small ? 38 : 56,
            border: '1px dashed rgba(255,255,255,0.25)',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Club size={small ? 14 : 20} color="#b45309" />
        </div>
      </div>
    );
  }

  const parsed = parseCardString(cardId);
  if (!parsed) return null;

  const { rank, color, Icon } = parsed;

  return (
    <div
      onClick={!disabled && onClick ? () => onClick(cardId) : undefined}
      role="button"
      tabIndex={0}
      aria-label={`Quân bài ${rank} ${parsed.label}`}
      style={{
        width: small ? 42 : 62,
        height: small ? 62 : 92,
        borderRadius: 4,
        background: '#ffffff',
        border: selected ? '2px solid #b45309' : '1px solid rgba(0,0,0,0.15)',
        boxShadow: selected
          ? '0 8px 18px rgba(180,83,9,0.35)'
          : '0 2px 6px rgba(0,0,0,0.08)',
        transform: selected ? 'translateY(-14px)' : 'translateY(0)',
        transition: 'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
        cursor: disabled ? 'default' : 'pointer',
        padding: small ? 3 : 5,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        userSelect: 'none',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Top Left Rank & Suit */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
        <span style={{ fontSize: small ? 11 : 14, fontWeight: 900, color }}>{rank}</span>
        <Icon size={small ? 10 : 13} color={color} style={{ marginTop: 1 }} />
      </div>

      {/* Center Large Suit Icon */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
        <Icon size={small ? 18 : 28} color={color} opacity={0.88} />
      </div>

      {/* Bottom Right Rank & Suit (Inverted) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          lineHeight: 1,
          transform: 'rotate(180deg)',
        }}
      >
        <span style={{ fontSize: small ? 11 : 14, fontWeight: 900, color }}>{rank}</span>
        <Icon size={small ? 10 : 13} color={color} style={{ marginTop: 1 }} />
      </div>
    </div>
  );
}

// ── RULES MODAL ──
function SamRulesModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 8,
          maxWidth: 680,
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          border: '1px solid rgba(0,0,0,0.1)',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Club size={20} color="#b45309" />
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#111827' }}>
              Luật Chơi Sâm Lốc WorkRank
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#6b7280',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '18px 24px', overflowY: 'auto', fontSize: 14, lineHeight: 1.6, color: '#374151' }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>
            1. Bộ bài và Thứ tự quân
          </h3>
          <p style={{ margin: '0 0 12px' }}>
            Sử dụng bộ bài 52 lá tiêu chuẩn. Độ mạnh quân bài tăng dần:
            <br />
            <strong>3 &lt; 4 &lt; 5 &lt; 6 &lt; 7 &lt; 8 &lt; 9 &lt; 10 &lt; J &lt; Q &lt; K &lt; A &lt; 2</strong>
            <br />
            Trong Sâm Lốc, <strong>không phân biệt chất bài</strong> (♠, ♣, ♦, ♥ có giá trị ngang nhau). Muốn chặn phải có quân cùng loại mang rank lớn hơn.
          </p>

          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>
            2. Các bộ bài hợp lệ
          </h3>
          <ul style={{ margin: '0 0 12px', paddingLeft: 20 }}>
            <li><strong>Rác (1 lá):</strong> Quân bài lẻ bất kỳ.</li>
            <li><strong>Đôi (2 lá):</strong> 2 lá cùng rank (ví dụ đôi 7, đôi K).</li>
            <li><strong>Sám (3 lá):</strong> 3 lá cùng rank (ví dụ ba quân J).</li>
            <li><strong>Tứ quý (4 lá):</strong> 4 lá cùng rank. <em>Tứ quý có thể chặt được 1 con 2!</em></li>
            <li><strong>Sảnh (từ 3 lá trở lên):</strong> Các lá bài có rank liên tiếp. Sảnh nhỏ nhất là <strong>A-2-3</strong>. Sảnh lớn nhất kết thúc bằng A (ví dụ J-Q-K-A).</li>
          </ul>

          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>
            3. Luật Báo Sâm (Xin Sâm)
          </h3>
          <p style={{ margin: '0 0 12px' }}>
            Sau khi chia bài, người chơi có 10 giây để quyết định <strong>Báo Sâm</strong>. Nếu bạn báo Sâm và đánh hết 10 lá mà không ai chặn được, bạn <strong>Thắng Sâm</strong> (+20 điểm từ mỗi người chơi). Nếu bị ai chặn dù chỉ 1 lượt, bạn <strong>Đền Sâm</strong> (phạt 20 điểm x số đối thủ).
          </p>

          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>
            4. Luật Báo 1 & Thối 2
          </h3>
          <ul style={{ margin: '0 0 12px', paddingLeft: 20 }}>
            <li><strong>Báo 1:</strong> Khi người chơi chỉ còn đúng 1 lá bài, hệ thống phát tín hiệu cảnh báo. Người ngồi trước phải đánh quân to nhất để chặn.</li>
            <li><strong>Thối 2:</strong> Không được để quân 2 (hoặc tứ quý) ở lượt đánh cuối cùng để hết bài. Nếu về bét bằng quân 2 sẽ bị xử <strong>Thối 2</strong> và bị phạt 20 điểm.</li>
            <li><strong>Cóng:</strong> Người chơi chưa đánh được lá bài nào khi người khác đã hết bài bị phạt 15 điểm.</li>
          </ul>

          <div
            style={{
              padding: 12,
              borderRadius: 6,
              background: 'rgba(180,83,9,0.08)',
              border: '1px solid rgba(180,83,9,0.25)',
              fontSize: 13,
              color: '#92400e',
            }}
          >
            <strong>Lưu ý:</strong> Điểm số trong game là <em>WorkRank Game Points</em> nội bộ dành cho giải trí thi đua lành mạnh. Tuyệt đối không quy đổi tiền thật hay cược bất hợp pháp.
          </div>
        </div>

        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid rgba(0,0,0,0.08)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Button variant="primary" onClick={onClose}>
            Đã hiểu
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── CREATE ROOM MODAL ──
function CreateRoomModal({ isOpen, onClose, onSubmit, loading }) {
  const [title, setTitle] = useState('Phòng Đánh Sâm');
  const [maxPlayers, setMaxPlayers] = useState(4);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 8,
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          border: '1px solid rgba(0,0,0,0.1)',
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#111827' }}>Tạo Phòng Đánh Sâm Mới</h2>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
            Tên phòng chơi
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Phòng Sâm Media 3Win"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: '1px solid rgba(0,0,0,0.15)',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
            Số người chơi tối đa
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            {[2, 3, 4].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setMaxPlayers(num)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 6,
                  border: maxPlayers === num ? '2px solid #b45309' : '1px solid rgba(0,0,0,0.12)',
                  background: maxPlayers === num ? 'rgba(180,83,9,0.08)' : '#ffffff',
                  color: maxPlayers === num ? '#b45309' : '#374151',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                {num} Người
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="primary"
            disabled={loading || !title.trim()}
            onClick={() => onSubmit({ title, maxPlayers })}
          >
            {loading ? 'Đang tạo...' : 'Tạo phòng'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── GAME RESULT MODAL ──
function GameResultModal({ isOpen, result, isSamWin, isThoi2, onPlayAgain, onLeave }) {
  if (!isOpen || !Array.isArray(result) || result.length === 0) return null;

  const winner = result.find((r) => r.rank === 1) || result[0];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 8,
          maxWidth: 520,
          width: '100%',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          border: '1px solid rgba(0,0,0,0.1)',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(180,83,9,0.12)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
          }}
        >
          <Trophy size={32} color="#b45309" />
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#111827', margin: '0 0 4px' }}>
          {isSamWin ? '🏆 THẮNG SÂM HOÀN TOÀN!' : isThoi2 ? '⚠️ ĐỐI THỦ THỐI 2!' : '🏆 KẾT QUẢ VÁN ĐẤU'}
        </h2>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 18px' }}>
          Người chiến thắng: <strong style={{ color: '#111827' }}>{winner.name}</strong> (+{winner.scoreDelta} điểm)
        </p>

        {/* Results Table */}
        <div
          style={{
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 6,
            overflow: 'hidden',
            marginBottom: 20,
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800 }}>Hạng</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800 }}>Người chơi</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800 }}>Còn lại</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800 }}>Điểm</th>
              </tr>
            </thead>
            <tbody>
              {result.map((row, idx) => (
                <tr
                  key={row.userId || idx}
                  style={{
                    borderBottom: idx < result.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                    background: row.rank === 1 ? 'rgba(180,83,9,0.04)' : '#ffffff',
                  }}
                >
                  <td style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800 }}>
                    {row.rank === 1 ? '🥇 1' : `🥈 ${row.rank || idx + 1}`}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#111827' }}>
                    {row.name}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#6b7280' }}>
                    {row.remainingCards !== undefined ? `${row.remainingCards} lá` : '-'}
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      textAlign: 'right',
                      fontWeight: 900,
                      color: row.scoreDelta > 0 ? '#15803d' : row.scoreDelta < 0 ? '#b91c1c' : '#4b5563',
                    }}
                  >
                    {row.scoreDelta > 0 ? `+${row.scoreDelta}` : row.scoreDelta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Button variant="secondary" onClick={onLeave}>
            Về sảnh chờ
          </Button>
          <Button variant="primary" onClick={onPlayAgain}>
            Chơi ván tiếp theo
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN SAM GAME COMPONENT ──
export default function SamGame() {
  const { roomId: urlRoomId } = useParams();
  const navigate = useNavigate();
  const { user, socket } = useAuth();

  // Navigation tabs in Lobby
  const [activeTab, setActiveTab] = useState('LOBBY'); // 'LOBBY' | 'LEADERBOARD' | 'RULES'
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Lobby state
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myStats, setMyStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Active match state
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [myHandCards, setMyHandCards] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  const [gameResult, setGameResult] = useState(null);
  const [bannerMessage, setBannerMessage] = useState(null);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(25);
  const timerRef = useRef(null);

  // ── DATA FETCHING ──

  const fetchLobbyData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [roomList, activeRes, lbRes, statsRes] = await Promise.all([
        samGame.listRooms({ status: 'WAITING' }),
        samGame.getActiveRoom().catch(() => ({ room: null })),
        samGame.getLeaderboard({ limit: 50 }).catch(() => ({ data: [] })),
        samGame.getMyStats().catch(() => null),
      ]);

      setRooms(Array.isArray(roomList) ? roomList : []);
      if (activeRes?.room) {
        setActiveRoom(activeRes.room);
      } else {
        setActiveRoom(null);
      }
      setLeaderboard(Array.isArray(lbRes?.data) ? lbRes.data : []);
      setMyStats(statsRes);
    } catch (err) {
      console.error('Failed to fetch Sam lobby data:', err);
      setErrorMsg('Không thể tải dữ liệu sảnh chờ');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRoomDetail = useCallback(
    async (roomIdToFetch) => {
      try {
        setActionLoading(true);
        setErrorMsg(null);
        const data = await samGame.getRoom(roomIdToFetch);
        if (data && data.room) {
          setRoom(data.room);
          setPlayers(data.players || []);
          setMyHandCards(data.myHandCards || []);
          setSelectedCards([]);
          if (data.result) {
            setGameResult(data.result);
          } else {
            setGameResult(null);
          }
        }
      } catch (err) {
        console.error('Failed to fetch Sam room detail:', err);
        setErrorMsg(err.response?.data?.message || 'Không thể vào phòng chơi');
      } finally {
        setActionLoading(false);
      }
    },
    []
  );

  // Initialize
  useEffect(() => {
    if (urlRoomId) {
      fetchRoomDetail(urlRoomId);
    } else {
      fetchLobbyData();
    }
  }, [urlRoomId, fetchRoomDetail, fetchLobbyData]);

  // Turn Countdown Timer
  useEffect(() => {
    if (!room || room.status !== 'PLAYING' || !room.turnDeadline) {
      setTimeLeft(25);
      return;
    }

    const updateTimer = () => {
      const deadline = new Date(room.turnDeadline).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((deadline - now) / 1000));
      setTimeLeft(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [room?.turnDeadline, room?.status]);

  // Socket.IO Room Listeners
  useEffect(() => {
    if (!socket || !room?.id) return;

    socket.emit('sam:joinRoom', { roomId: room.id });

    const handleRoomUpdated = (data) => {
      if (data?.room) setRoom(data.room);
    };

    const handlePlayerJoined = (data) => {
      if (data?.players) setPlayers(data.players);
    };

    const handlePlayerLeft = (data) => {
      if (data?.players) setPlayers(data.players);
    };

    const handleStarted = (data) => {
      if (data?.room) setRoom(data.room);
      if (data?.players) setPlayers(data.players);
      setGameResult(null);
      setBannerMessage('Trận đấu bắt đầu! 10 giây báo Sâm');
    };

    const handleHandCards = (data) => {
      if (data?.handCards) {
        setMyHandCards(data.handCards);
        setSelectedCards([]);
      }
    };

    const handleCardsPlayed = (data) => {
      setBannerMessage(`${data.comboName || 'Bộ bài vừa đánh'}`);
      if (room) {
        setRoom((prev) => ({
          ...prev,
          lastPlayedCards: { cards: data.cards, name: data.comboName, userId: data.userId },
          currentTurnUserId: data.nextTurnUserId,
          turnDeadline: data.turnDeadline,
        }));
      }
    };

    const handlePass = (data) => {
      setBannerMessage('Có người vừa bỏ lượt');
      if (room) {
        setRoom((prev) => ({
          ...prev,
          currentTurnUserId: data.nextTurnUserId,
          turnDeadline: data.turnDeadline,
        }));
      }
    };

    const handleRoundReset = (data) => {
      setBannerMessage('✨ Vòng mới! Đánh bài tự do');
      if (room) {
        setRoom((prev) => ({
          ...prev,
          lastPlayedCards: null,
          currentTurnUserId: data.roundWinnerId,
          roundNumber: data.roundNumber,
          turnDeadline: data.turnDeadline,
        }));
      }
    };

    const handleChopped = (data) => {
      setBannerMessage(`⚡ BỊ CHẶT 2! (+${data.points} điểm)`);
    };

    const handleBaoMot = (data) => {
      setBannerMessage(`⚠️ ${data.playerName || 'Có người'} BÁO 1 LÁ!`);
    };

    const handleGameFinished = (data) => {
      setGameResult(data.results || []);
      setRoom((prev) => (prev ? { ...prev, status: 'FINISHED' } : null));
    };

    socket.on('sam:roomUpdated', handleRoomUpdated);
    socket.on('sam:playerJoined', handlePlayerJoined);
    socket.on('sam:playerLeft', handlePlayerLeft);
    socket.on('sam:started', handleStarted);
    socket.on('sam:handCards', handleHandCards);
    socket.on('sam:cardsPlayed', handleCardsPlayed);
    socket.on('sam:pass', handlePass);
    socket.on('sam:roundReset', handleRoundReset);
    socket.on('sam:chopped', handleChopped);
    socket.on('sam:baoMot', handleBaoMot);
    socket.on('sam:gameFinished', handleGameFinished);

    return () => {
      socket.emit('sam:leaveRoom', { roomId: room.id });
      socket.off('sam:roomUpdated', handleRoomUpdated);
      socket.off('sam:playerJoined', handlePlayerJoined);
      socket.off('sam:playerLeft', handlePlayerLeft);
      socket.off('sam:started', handleStarted);
      socket.off('sam:handCards', handleHandCards);
      socket.off('sam:cardsPlayed', handleCardsPlayed);
      socket.off('sam:pass', handlePass);
      socket.off('sam:roundReset', handleRoundReset);
      socket.off('sam:chopped', handleChopped);
      socket.off('sam:baoMot', handleBaoMot);
      socket.off('sam:gameFinished', handleGameFinished);
    };
  }, [socket, room?.id]);

  // ── USER ACTIONS ──

  const handleCreateRoom = async (formData) => {
    try {
      setActionLoading(true);
      const res = await samGame.createRoom(formData);
      setShowCreateModal(false);
      navigate(`/games/sam/room/${res.room.id}`);
      setRoom(res.room);
      setPlayers(res.players);
      setMyHandCards(res.myHandCards || []);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể tạo phòng');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinRoom = async (targetRoomId) => {
    try {
      setActionLoading(true);
      const res = await samGame.joinRoom(targetRoomId);
      navigate(`/games/sam/room/${targetRoomId}`);
      setRoom(res.room);
      setPlayers(res.players);
      setMyHandCards(res.myHandCards || []);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể vào phòng');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!room) return;
    try {
      setActionLoading(true);
      await samGame.leaveRoom(room.id);
      navigate('/games/sam');
      setRoom(null);
      setPlayers([]);
      setMyHandCards([]);
      fetchLobbyData();
    } catch (err) {
      console.error('Failed to leave room:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartMatch = async () => {
    if (!room) return;
    try {
      setActionLoading(true);
      const res = await samGame.startMatch(room.id);
      setRoom(res.room);
      setPlayers(res.players);
      setMyHandCards(res.myHandCards || []);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể bắt đầu');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleCardSelection = (cardId) => {
    setSelectedCards((prev) => {
      if (prev.includes(cardId)) {
        return prev.filter((c) => c !== cardId);
      }
      return [...prev, cardId];
    });
  };

  const handlePlayCards = async () => {
    if (!room || selectedCards.length === 0) return;
    try {
      setActionLoading(true);
      const res = await samGame.playCards(room.id, selectedCards);
      setRoom(res.room);
      setPlayers(res.players);
      setMyHandCards(res.myHandCards || []);
      setSelectedCards([]);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Nước đi không hợp lệ');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePassTurn = async () => {
    if (!room) return;
    try {
      setActionLoading(true);
      const res = await samGame.passTurn(room.id);
      setRoom(res.room);
      setPlayers(res.players);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể bỏ lượt');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclareSam = async (declare) => {
    if (!room) return;
    try {
      setActionLoading(true);
      const res = await samGame.declareSam(room.id, declare);
      setRoom(res.room);
      setPlayers(res.players);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Lỗi khi báo Sâm');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSortHand = () => {
    // Sort ascending by value
    const sorted = [...myHandCards].sort((a, b) => {
      const pA = parseCardString(a);
      const pB = parseCardString(b);
      return (pA?.rank || 0) - (pB?.rank || 0);
    });
    setMyHandCards(sorted);
  };

  // Determine current player perspective (seat positions 0=me, top, left, right)
  const myPlayer = useMemo(() => {
    return players.find((p) => Number(p.userId) === Number(user?.id)) || null;
  }, [players, user?.id]);

  const opponentPositions = useMemo(() => {
    if (!myPlayer) return { top: null, left: null, right: null };
    const mySeat = myPlayer.seatIndex;
    const others = players.filter((p) => p.seatIndex !== mySeat);

    if (others.length === 1) {
      return { top: others[0], left: null, right: null };
    }
    if (others.length === 2) {
      return { left: others[0], right: others[1], top: null };
    }
    // 4 players
    const getPos = (seat) => {
      const diff = (seat - mySeat + 4) % 4;
      if (diff === 1) return 'right';
      if (diff === 2) return 'top';
      if (diff === 3) return 'left';
      return 'top';
    };

    const res = { top: null, left: null, right: null };
    others.forEach((o) => {
      const pos = getPos(o.seatIndex);
      res[pos] = o;
    });
    return res;
  }, [myPlayer, players]);

  const isMyTurn = useMemo(() => {
    return room?.status === 'PLAYING' && Number(room?.currentTurnUserId) === Number(user?.id);
  }, [room?.status, room?.currentTurnUserId, user?.id]);

  const isHost = useMemo(() => {
    return Number(room?.hostUserId) === Number(user?.id);
  }, [room?.hostUserId, user?.id]);

  // ─────────────────────────────────────────────────────────────
  // RENDER PHASE 1: FULLSCREEN GAME SHELL (WHEN IN ACTIVE MATCH)
  // ─────────────────────────────────────────────────────────────
  if (room && room.status === 'PLAYING') {
    return (
      <GameFullscreenShell topBar={false} className="wr-sam-match-fullscreen">
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#090d16',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            color: '#f8fafc',
            fontFamily: "'Space Grotesk', -apple-system, sans-serif",
          }}
        >
        {/* Game Top Bar */}
        <div
          style={{
            height: 52,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#0f172a',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              type="button"
              onClick={handleLeaveRoom}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#f8fafc',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={16} /> Rời bàn
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Club size={18} color="#b45309" />
              <strong style={{ fontSize: 14, color: '#f8fafc' }}>{room.title}</strong>
              <span
                style={{
                  fontSize: 11,
                  background: 'rgba(255,255,255,0.1)',
                  padding: '2px 8px',
                  borderRadius: 4,
                  color: '#94a3b8',
                  fontFamily: 'monospace',
                }}
              >
                {room.code}
              </span>
            </div>
          </div>

          {/* Center Announcement Banner */}
          {bannerMessage && (
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#fde047',
                background: 'rgba(180,83,9,0.25)',
                padding: '4px 14px',
                borderRadius: 20,
                border: '1px solid rgba(251,191,36,0.3)',
              }}
            >
              {bannerMessage}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={() => setShowRulesModal(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 13,
              }}
            >
              <HelpCircle size={16} /> Luật chơi
            </button>
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              style={{
                background: 'transparent',
                border: 'none',
                color: soundEnabled ? '#38bdf8' : '#64748b',
                cursor: 'pointer',
              }}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          </div>
        </div>

        {/* Central Game Area */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px 24px',
            overflow: 'hidden',
          }}
        >
          {/* OPPONENT TOP */}
          <div style={{ height: 90, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {opponentPositions.top && (
              <OpponentBox
                player={opponentPositions.top}
                isTurn={Number(room.currentTurnUserId) === Number(opponentPositions.top.userId)}
                timeLeft={timeLeft}
              />
            )}
          </div>

          {/* MIDDLE ROW: OPPONENT LEFT, CENTRAL BOARD TABLE, OPPONENT RIGHT */}
          <div
            style={{
              width: '100%',
              maxWidth: 1080,
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              position: 'relative',
            }}
          >
            {/* OPPONENT LEFT */}
            <div style={{ width: 140, display: 'flex', justifyContent: 'center' }}>
              {opponentPositions.left && (
                <OpponentBox
                  player={opponentPositions.left}
                  isTurn={Number(room.currentTurnUserId) === Number(opponentPositions.left.userId)}
                  timeLeft={timeLeft}
                />
              )}
            </div>

            {/* CENTRAL TABLE (Thảm đánh bài WorkRank Neutral Surface) */}
            <div
              style={{
                flex: 1,
                maxWidth: 620,
                height: '75%',
                minHeight: 220,
                borderRadius: 8,
                background: 'linear-gradient(180deg, #131c2e 0%, #0e1524 100%)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                position: 'relative',
              }}
            >
              {/* Turn Countdown Timer on Table */}
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 800,
                  color: timeLeft <= 5 ? '#ef4444' : '#38bdf8',
                  background: 'rgba(0,0,0,0.4)',
                  padding: '4px 10px',
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <Clock size={14} /> {timeLeft}s
              </div>

              {/* Cards on Table */}
              {room.lastPlayedCards ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {room.lastPlayedCards.cards.map((c) => (
                      <PlayingCard key={c} cardId={c} disabled />
                    ))}
                  </div>
                  <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>
                    {room.lastPlayedCards.name || 'Bộ bài vừa đánh'}
                  </span>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#64748b' }}>
                  <Club size={32} opacity={0.3} style={{ marginBottom: 6 }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8' }}>
                    {room.samPhase === 'SAM_DECLARING' ? 'Đang trong thời gian báo Sâm (10s)' : 'Vòng mới — Đánh bài tự do'}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    {isMyTurn ? 'Đang đến lượt bạn đi đầu' : 'Đang chờ lượt người khác...'}
                  </div>
                </div>
              )}
            </div>

            {/* OPPONENT RIGHT */}
            <div style={{ width: 140, display: 'flex', justifyContent: 'center' }}>
              {opponentPositions.right && (
                <OpponentBox
                  player={opponentPositions.right}
                  isTurn={Number(room.currentTurnUserId) === Number(opponentPositions.right.userId)}
                  timeLeft={timeLeft}
                />
              )}
            </div>
          </div>

          {/* BOTTOM (YOUR HAND & CONTROLS) */}
          <div
            style={{
              width: '100%',
              maxWidth: 960,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 14,
            }}
          >
            {/* Action Bar (Buttons) */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {room.samPhase === 'SAM_DECLARING' ? (
                <>
                  <Button
                    variant="primary"
                    onClick={() => handleDeclareSam(true)}
                    style={{
                      background: '#b45309',
                      borderColor: '#b45309',
                      fontWeight: 900,
                      boxShadow: '0 4px 14px rgba(180,83,9,0.4)',
                    }}
                  >
                    ⚡ Báo Sâm (Xin Sâm)
                  </Button>
                  <Button variant="secondary" onClick={() => handleDeclareSam(false)}>
                    Bỏ qua
                  </Button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleSortHand}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#cbd5e1',
                      padding: '8px 14px',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Xếp bài
                  </button>
                  <Button
                    variant="primary"
                    disabled={!isMyTurn || selectedCards.length === 0 || actionLoading}
                    onClick={handlePlayCards}
                    style={{
                      background: isMyTurn && selectedCards.length > 0 ? '#b45309' : '#334155',
                      borderColor: isMyTurn && selectedCards.length > 0 ? '#b45309' : '#475569',
                      fontWeight: 900,
                      minWidth: 120,
                    }}
                  >
                    {actionLoading ? 'Đang đánh...' : `Đánh (${selectedCards.length})`}
                  </Button>
                  {room.lastPlayedCards && (
                    <Button
                      variant="secondary"
                      disabled={!isMyTurn || actionLoading}
                      onClick={handlePassTurn}
                    >
                      Bỏ lượt
                    </Button>
                  )}
                  {selectedCards.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCards([])}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        fontSize: 13,
                        cursor: 'pointer',
                        padding: '4px 8px',
                      }}
                    >
                      Bỏ chọn
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Your Hand (Horizontal overlapping fan) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-end',
                height: 104,
                padding: '0 16px',
                width: '100%',
                overflowX: 'auto',
              }}
            >
              {myHandCards.map((cardId) => (
                <div
                  key={cardId}
                  style={{
                    marginRight: -18, // Overlap cards slightly
                    zIndex: selectedCards.includes(cardId) ? 10 : 1,
                  }}
                >
                  <PlayingCard
                    cardId={cardId}
                    selected={selectedCards.includes(cardId)}
                    onClick={handleToggleCardSelection}
                  />
                </div>
              ))}
            </div>

            {/* Your Info Strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <DefaultAvatar name={user?.name} size={32} />
              <strong style={{ fontSize: 13, color: '#f8fafc' }}>{user?.name} (Bạn)</strong>
              {isMyTurn && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#10b981',
                    background: 'rgba(16,185,129,0.15)',
                    padding: '2px 8px',
                    borderRadius: 10,
                  }}
                >
                  Lượt của bạn
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Game Result Modal */}
        <GameResultModal
          isOpen={!!gameResult}
          result={gameResult}
          isSamWin={room.samDeclarerId && Number(room.winnerUserId) === Number(room.samDeclarerId)}
          onPlayAgain={handleStartMatch}
          onLeave={handleLeaveRoom}
        />

        {/* Rules Modal */}
        <SamRulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />
      </div>
    </GameFullscreenShell>
  );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER PHASE 2: WAITING ROOM (BEFORE MATCH STARTS)
  // ─────────────────────────────────────────────────────────────
  if (room && room.status === 'WAITING') {
    return (
      <GameFullscreenShell
        title="Đánh Sâm"
        icon={Club}
        badge={`Phòng #${room.code || room.id}`}
        exitLabel="Rời phòng"
        onExit={handleLeaveRoom}
        actions={
          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#f4f3ef',
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 800,
              color: '#111111',
              cursor: 'pointer',
            }}
          >
            <HelpCircle size={14} />
            <span>Luật chơi</span>
          </button>
        }
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
        <Card style={{ maxWidth: 640, width: '100%', padding: 28, background: '#ffffff' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
              paddingBottom: 16,
              marginBottom: 20,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Club size={20} color="#b45309" />
                <h1 style={{ fontSize: 20, fontWeight: 900, color: '#111827', margin: 0 }}>
                  {room.title}
                </h1>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                Đang chờ đủ người chơi để bắt đầu (Tối đa {room.maxPlayers} người)
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span
                style={{
                  display: 'inline-block',
                  background: 'rgba(0,0,0,0.05)',
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  color: '#111827',
                }}
              >
                Mã: {room.code}
              </span>
            </div>
          </div>

          {/* 4 Player Seats Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 14,
              marginBottom: 24,
            }}
          >
            {Array.from({ length: room.maxPlayers }).map((_, seatIdx) => {
              const p = players.find((pl) => pl.seatIndex === seatIdx);
              if (p) {
                return (
                  <div
                    key={seatIdx}
                    style={{
                      border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: 8,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      background: '#fafafa',
                      position: 'relative',
                    }}
                  >
                    {p.isHost && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          fontSize: 10,
                          fontWeight: 800,
                          background: 'rgba(180,83,9,0.12)',
                          color: '#b45309',
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}
                      >
                        Chủ phòng
                      </span>
                    )}
                    <DefaultAvatar name={p.user?.name} size={48} style={{ marginBottom: 8 }} />
                    <strong style={{ fontSize: 13, color: '#111827', marginBottom: 2 }}>
                      {p.user?.name}
                    </strong>
                    <JobTitleBadge jobTitle={p.user?.jobTitle} size="xs" />
                  </div>
                );
              }

              return (
                <div
                  key={seatIdx}
                  style={{
                    border: '1px dashed rgba(0,0,0,0.15)',
                    borderRadius: 8,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 120,
                    color: '#9ca3af',
                    fontSize: 12,
                  }}
                >
                  <Plus size={24} style={{ marginBottom: 6, opacity: 0.5 }} />
                  Ghế trống #{seatIdx + 1}
                </div>
              );
            })}
          </div>

          {/* Action Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button variant="secondary" onClick={handleLeaveRoom}>
              Rời phòng
            </Button>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="secondary" onClick={() => setShowRulesModal(true)}>
                Luật chơi
              </Button>
              {isHost ? (
                <Button
                  variant="primary"
                  disabled={players.length < 2 || actionLoading}
                  onClick={handleStartMatch}
                  style={{ background: '#b45309', borderColor: '#b45309' }}
                >
                  {players.length < 2
                    ? 'Cần ít nhất 2 người'
                    : actionLoading
                    ? 'Đang chia bài...'
                    : 'Bắt đầu ván bài'}
                </Button>
              ) : (
                <div style={{ fontSize: 13, color: '#6b7280', alignSelf: 'center' }}>
                  Đang chờ chủ phòng bắt đầu...
                </div>
              )}
            </div>
          </div>
        </Card>

        <SamRulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />
        </div>
      </GameFullscreenShell>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER PHASE 3: MAIN LOBBY & LEADERBOARD (WORKRANK DESIGN SYSTEM)
  // ─────────────────────────────────────────────────────────────
  return (
    <GameFullscreenShell
      title="Đánh Sâm"
      icon={Club}
      badge="Bài dân gian"
      exitLabel="Thoát"
      exitTo="/arena"
      onExit={() => navigate('/arena')}
      actions={
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#141414',
            border: 'none',
            borderRadius: 6,
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 800,
            color: '#ffffff',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          <span>Tạo phòng</span>
        </button>
      }
    >
      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '24px 16px 40px',
          fontFamily: "var(--font-sans, 'Space Grotesk', -apple-system, sans-serif)",
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
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
            <Club size={14} /> Trò Chơi Nội Bộ
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#111827', margin: 0 }}>
            Đánh Sâm Lốc
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '4px 0 0' }}>
            Trò chơi bài dân gian 2–4 người chơi theo lượt thời gian thực server-authoritative
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" onClick={() => setShowRulesModal(true)}>
            <HelpCircle size={16} /> Luật chơi
          </Button>
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
            style={{ background: '#b45309', borderColor: '#b45309' }}
          >
            <Plus size={16} /> Tạo phòng mới
          </Button>
        </div>
      </div>

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
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(180,83,9,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Zap size={20} color="#b45309" />
            </div>
            <div>
              <strong style={{ fontSize: 14, color: '#111827', display: 'block' }}>
                Bạn có một trận đấu đang diễn ra: {activeRoom.title}
              </strong>
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                Mã phòng: {activeRoom.code} • Số người: {activeRoom.players?.length || 0}/{activeRoom.maxPlayers}
              </span>
            </div>
          </div>
          <Button
            variant="primary"
            onClick={() => handleJoinRoom(activeRoom.id)}
            style={{ background: '#b45309', borderColor: '#b45309' }}
          >
            Vào lại bàn chơi
          </Button>
        </Card>
      )}

      {/* Stats Summary Bar */}
      {myStats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
            label="Số Trận Đã Chơi"
            value={myStats.gamesPlayed || 0}
            color="#0284c7"
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

      <div style={{ marginTop: 20 }}>
        {/* TAB 1: LOBBY */}
        {activeTab === 'LOBBY' && (
          <div>
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={130} radius={8} />
                ))}
              </div>
            ) : rooms.length === 0 ? (
              <EmptyState
                icon={Club}
                title="Chưa có phòng nào đang mở"
                description="Hãy là người đầu tiên tạo phòng Đánh Sâm và rủ đồng nghiệp cùng tham gia!"
                action={
                  <Button
                    variant="primary"
                    onClick={() => setShowCreateModal(true)}
                    style={{ background: '#b45309', borderColor: '#b45309', marginTop: 12 }}
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
                {rooms.map((r) => (
                  <Card
                    key={r.id}
                    style={{
                      padding: 18,
                      background: '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: 140,
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
                        <strong style={{ fontSize: 15, color: '#111827' }}>{r.title}</strong>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: 'rgba(21,128,61,0.1)',
                            color: '#15803d',
                          }}
                        >
                          Đang chờ
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <DefaultAvatar name={r.host?.name} size={24} />
                        <span style={{ fontSize: 13, color: '#4b5563' }}>
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
                      </span>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleJoinRoom(r.id)}
                        disabled={r.playerCount >= r.maxPlayers}
                        style={{ background: '#111827' }}
                      >
                        Tham gia
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LEADERBOARD */}
        {activeTab === 'LEADERBOARD' && (
          <Card style={{ padding: 0, overflow: 'hidden', background: '#ffffff' }}>
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
                        {item.rank === 1 ? '🥇 1' : item.rank === 2 ? '🥈 2' : item.rank === 3 ? '🥉 3' : item.rank}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <DefaultAvatar name={item.user?.name} size={32} />
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
          <Card style={{ padding: 24, background: '#ffffff', lineHeight: 1.7 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 14 }}>
              Quy chuẩn luật chơi Sâm Lốc WorkRank
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#b45309', margin: '0 0 6px' }}>
                  Thứ tự quân bài
                </h3>
                <p style={{ margin: 0, color: '#4b5563', fontSize: 14 }}>
                  3 nhỏ nhất, 2 (heo) lớn nhất. Không phân biệt chất: 5 bích ngang 5 cơ. Chặn bài phải dùng quân cùng loại có rank cao hơn.
                </p>
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#b45309', margin: '0 0 6px' }}>
                  Luật Sảnh & Tứ Quý
                </h3>
                <p style={{ margin: 0, color: '#4b5563', fontSize: 14 }}>
                  Sảnh từ 3 lá trở lên. Sảnh nhỏ nhất là A-2-3. Sảnh lớn nhất kết thúc bằng A. Một Tứ quý có thể chặt được 1 con 2 (+15 điểm).
                </p>
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#b45309', margin: '0 0 6px' }}>
                  Báo Sâm (Xin Sâm)
                </h3>
                <p style={{ margin: 0, color: '#4b5563', fontSize: 14 }}>
                  10s đầu ván. Nếu báo Sâm và đánh hết bài không ai chặn: Thắng Sâm (+20 điểm/người). Nếu bị bất kỳ ai chặn 1 lượt: Đền Sâm.
                </p>
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#b45309', margin: '0 0 6px' }}>
                  Báo 1 & Thối 2
                </h3>
                <p style={{ margin: 0, color: '#4b5563', fontSize: 14 }}>
                  Còn 1 lá bài phải báo làng. Không được về bét bằng quân 2 (sẽ bị xử thối 2 và phạt 20 điểm).
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Modals */}
      <CreateRoomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateRoom}
        loading={actionLoading}
      />
      <SamRulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />
      </div>
    </GameFullscreenShell>
  );
}

// ── OPPONENT BOX COMPONENT ──
function OpponentBox({ player, isTurn = false, timeLeft }) {
  if (!player) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        position: 'relative',
        padding: 8,
        borderRadius: 8,
        background: isTurn ? 'rgba(180,83,9,0.15)' : 'rgba(255,255,255,0.03)',
        border: isTurn ? '1px solid rgba(251,191,36,0.5)' : '1px solid transparent',
        transition: 'all 200ms ease',
      }}
    >
      {/* Turn indicator glow */}
      <div style={{ position: 'relative', marginBottom: 6 }}>
        <DefaultAvatar
          name={player.user?.name}
          size={44}
          style={{
            border: isTurn ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.2)',
          }}
        />
        {isTurn && (
          <span
            style={{
              position: 'absolute',
              bottom: -4,
              right: -4,
              background: '#b45309',
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 900,
              padding: '1px 4px',
              borderRadius: 6,
            }}
          >
            {timeLeft}s
          </span>
        )}
      </div>

      <strong style={{ fontSize: 13, color: '#f8fafc', marginBottom: 2 }}>
        {player.user?.name || `Người chơi ${player.seatIndex + 1}`}
      </strong>

      {/* Card Backs Fan indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
        <PlayingCard isBack small />
        <span style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8' }}>
          {player.remainingCardsCount} lá
        </span>
      </div>

      {/* Báo 1 alert badge */}
      {player.remainingCardsCount === 1 && (
        <span
          style={{
            marginTop: 4,
            fontSize: 10,
            fontWeight: 900,
            background: '#b91c1c',
            color: '#ffffff',
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          BÁO 1
        </span>
      )}
    </div>
  );
}
