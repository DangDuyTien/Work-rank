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
  Pause,
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
  Eye,
  Bot,
  Terminal,
  FastForward,
  Square,
  ShieldAlert,
  Sliders,
  Radio,
  Layers,
  Award,
  ChevronRight,
} from 'lucide-react';
import { samGame } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../services/socket';
import DefaultAvatar from '../components/DefaultAvatar';
import JobTitleBadge from '../components/JobTitleBadge';
import GameFullscreenShell from '../components/game/GameFullscreenShell';
import GameComingSoon from '../components/GameComingSoon';
import { useGameAvailability } from '../hooks/useGameAvailability';
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
import { samSound } from '../utils/samSound';
import {
  parseCard,
  detectCombination,
  canBeat,
  sortCardsByRank,
  sortCardsSmart,
} from '../utils/samEngineClient';

// ── PLAYING CARD SUIT CONFIG ──
const SUIT_META = {
  S: { label: 'Bích', color: '#0f172a', Icon: Spade, symbol: '♠' },
  C: { label: 'Tép', color: '#1e293b', Icon: Club, symbol: '♣' },
  D: { label: 'Rô', color: '#ea580c', Icon: Diamond, symbol: '♦' },
  H: { label: 'Cơ', color: '#dc2626', Icon: Heart, symbol: '♥' },
};

function parseCardString(cardStr) {
  if (!cardStr || typeof cardStr !== 'string') return null;
  const suit = cardStr.slice(-1).toUpperCase();
  const rank = cardStr.slice(0, -1).toUpperCase();
  const meta = SUIT_META[suit] || SUIT_META.S;
  const isHeo = rank === '2';
  const isAce = rank === 'A';
  return { id: cardStr, rank, suit, color: meta.color, Icon: meta.Icon, symbol: meta.symbol, label: meta.label, isHeo, isAce };
}

// ── PREMIUM PLAYING CARD COMPONENT ──
function PlayingCard({
  cardId,
  selected = false,
  onClick,
  disabled = false,
  small = false,
  isBack = false,
  style = {},
  cascadeIndex = 0,
}) {
  if (isBack) {
    return (
      <div
        style={{
          width: small ? 38 : 64,
          height: small ? 54 : 94,
          borderRadius: 8,
          background: 'linear-gradient(135deg, #1e293b 0%, #090e1a 100%)',
          border: '1.5px solid rgba(255,255,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
          userSelect: 'none',
          position: 'relative',
          overflow: 'hidden',
          ...style,
        }}
      >
        <div
          style={{
            width: small ? 24 : 44,
            height: small ? 38 : 68,
            border: '1px dashed rgba(245, 158, 11, 0.4)',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle, rgba(180,83,9,0.15) 0%, transparent 70%)',
          }}
        >
          <Club size={small ? 14 : 22} color="#f59e0b" />
        </div>
      </div>
    );
  }

  const parsed = parseCardString(cardId);
  if (!parsed) return null;

  const { rank, color, Icon, isHeo, isAce } = parsed;

  return (
    <div
      onClick={!disabled && onClick ? () => onClick(cardId) : undefined}
      role="button"
      tabIndex={0}
      aria-label={`Quân bài ${rank} ${parsed.label}`}
      style={{
        width: small ? 44 : 70,
        height: small ? 64 : 102,
        borderRadius: 8,
        background: isHeo ? 'linear-gradient(180deg, #ffffff 0%, #fffbeb 100%)' : '#ffffff',
        border: selected
          ? '2.5px solid #f59e0b'
          : isHeo
          ? '1.5px solid #fbbf24'
          : '1px solid rgba(0,0,0,0.15)',
        boxShadow: selected
          ? '0 12px 28px rgba(245, 158, 11, 0.45), 0 0 0 2px rgba(245, 158, 11, 0.2)'
          : '0 3px 10px rgba(0,0,0,0.14)',
        transform: selected ? 'translateY(-22px) scale(1.04)' : 'translateY(0)',
        transition: 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 180ms ease, border-color 180ms ease',
        cursor: disabled ? 'default' : 'pointer',
        padding: small ? 4 : 6,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        userSelect: 'none',
        flexShrink: 0,
        position: 'relative',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Top Left Rank & Suit */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
        <span style={{ fontSize: small ? 12 : 16, fontWeight: 900, color, letterSpacing: -0.5 }}>{rank}</span>
        <Icon size={small ? 10 : 13} color={color} style={{ marginTop: 1 }} />
      </div>

      {/* Center Large Suit Icon with Subtle Watermark */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, position: 'relative' }}>
        <Icon size={small ? 20 : 32} color={color} opacity={0.9} />
        {isHeo && (
          <div
            style={{
              position: 'absolute',
              top: -2,
              right: 0,
              fontSize: 9,
              fontWeight: 800,
              color: '#b45309',
              background: '#fef3c7',
              padding: '1px 3px',
              borderRadius: 3,
            }}
          >
            HEO
          </div>
        )}
      </div>

      {/* Bottom Right Rank & Suit (Inverted) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          lineHeight: 1,
          transform: 'rotate(180deg)',
        }}
      >
        <span style={{ fontSize: small ? 12 : 16, fontWeight: 900, color, letterSpacing: -0.5 }}>{rank}</span>
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
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 16,
          maxWidth: 680,
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
          border: '1px solid rgba(0,0,0,0.1)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Club size={20} color="#b45309" />
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#0f172a' }}>
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
              color: '#64748b',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', overflowY: 'auto', fontSize: 14, lineHeight: 1.6, color: '#334155' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
            1. Bộ bài và Thứ tự quân
          </h3>
          <p style={{ margin: '0 0 12px' }}>
            Sử dụng bộ bài 52 lá tiêu chuẩn. Độ mạnh quân bài tăng dần:
            <br />
            <strong>3 &lt; 4 &lt; 5 &lt; 6 &lt; 7 &lt; 8 &lt; 9 &lt; 10 &lt; J &lt; Q &lt; K &lt; A &lt; 2</strong>
            <br />
            Trong Sâm Lốc, <strong>không phân biệt chất bài</strong> (♠, ♣, ♦, ♥ có giá trị chặn ngang nhau). Muốn chặn phải có quân cùng loại mang rank lớn hơn.
          </p>

          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
            2. Các bộ bài hợp lệ
          </h3>
          <ul style={{ margin: '0 0 12px', paddingLeft: 20 }}>
            <li><strong>Rác (1 lá):</strong> Quân bài lẻ bất kỳ.</li>
            <li><strong>Đôi (2 lá):</strong> 2 lá cùng rank (ví dụ đôi 7, đôi K).</li>
            <li><strong>Sám (3 lá):</strong> 3 lá cùng rank (ví dụ ba quân J).</li>
            <li><strong>Tứ quý (4 lá):</strong> 4 lá cùng rank. <em>Tứ quý chặt được 1 con 2 và chặt Tứ quý nhỏ hơn!</em></li>
            <li><strong>Sảnh (từ 3 lá trở lên):</strong> Các lá bài có rank liên tiếp. Sảnh nhỏ nhất là <strong>A-2-3</strong>. Sảnh lớn nhất kết thúc bằng A (ví dụ J-Q-K-A).</li>
          </ul>

          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
            3. Luật Báo Sâm (Xin Sâm)
          </h3>
          <p style={{ margin: '0 0 12px' }}>
            Sau khi chia bài, người chơi có 10 giây để quyết định <strong>Báo Sâm</strong>. Nếu bạn báo Sâm và đánh hết 10 lá mà không ai chặn được, bạn <strong>Thắng Sâm</strong> (+20 điểm từ mỗi người chơi). Nếu bị ai chặn dù chỉ 1 lượt, bạn <strong>Đền Sâm</strong> (phạt 20 điểm x số đối thủ).
          </p>

          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
            4. Luật Báo 1 & Thối 2
          </h3>
          <ul style={{ margin: '0 0 12px', paddingLeft: 20 }}>
            <li><strong>Báo 1:</strong> Khi người chơi chỉ còn đúng 1 lá bài, hệ thống phát tín hiệu cảnh báo. Người ngồi trước phải đánh quân to nhất để chặn.</li>
            <li><strong>Thối 2:</strong> Không được để quân 2 (hoặc tứ quý) ở lượt đánh cuối cùng để hết bài. Nếu về bét bằng quân 2 sẽ bị xử <strong>Thối 2</strong> và bị phạt điểm.</li>
            <li><strong>Cóng (Cháy):</strong> Người chơi chưa đánh được lá bài nào khi người khác đã hết bài bị phạt 15 điểm.</li>
          </ul>

          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: '#fffbeb',
              border: '1px solid #fde68a',
              fontSize: 13,
              color: '#92400e',
            }}
          >
            <strong>Lưu ý:</strong> Điểm số trong game là <em>WorkRank Game Points</em> nội bộ dành cho giải trí thi đua lành mạnh.
          </div>
        </div>

        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            background: '#f8fafc',
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
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
              boxSizing: 'border-box',
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
            onClick={() => onSubmit({ title: title.trim(), maxPlayers })}
            style={{ background: '#b45309', borderColor: '#b45309' }}
          >
            {loading ? 'Đang tạo...' : 'Tạo phòng'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── CREATE BOT TEST MODAL (ADMIN ONLY) ──
function CreateBotTestModal({ isOpen, onClose, onSubmit }) {
  const [title, setTitle] = useState('Đánh Sâm — Bot Test Simulator');
  const [playerCount, setPlayerCount] = useState(4);
  const [botCount, setBotCount] = useState(3);
  const [difficulty, setDifficulty] = useState('NORMAL');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      title: title.trim(),
      playerCount: Number(playerCount),
      botCount: Number(botCount),
      difficulty,
    });
  };

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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 8,
          maxWidth: 480,
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          border: '1px solid rgba(0,0,0,0.1)',
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={20} color="#b45309" />
            Tạo Phòng Bot Test (Admin Simulator)
          </h2>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
              Tên phòng Test
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid rgba(0,0,0,0.15)',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                Tổng số ghế
              </label>
              <select
                value={playerCount}
                onChange={(e) => setPlayerCount(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid rgba(0,0,0,0.15)',
                  fontSize: 14,
                  background: '#fff',
                }}
              >
                <option value={2}>2 Người</option>
                <option value={3}>3 Người</option>
                <option value={4}>4 Người</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                Độ khó AI Bot
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid rgba(0,0,0,0.15)',
                  fontSize: 14,
                  background: '#fff',
                }}
              >
                <option value="EASY">Dễ (Easy)</option>
                <option value="NORMAL">Bình thường (Normal)</option>
                <option value="HARD">Khó (Hard)</option>
              </select>
            </div>
          </div>

          <div style={{ fontSize: 12, color: '#92400e', background: 'rgba(180,83,9,0.08)', padding: '10px 12px', borderRadius: 6, border: '1px solid rgba(180,83,9,0.2)' }}>
            ℹ️ Phòng Bot Test được cách ly hoàn toàn khỏi bảng xếp hạng và điểm thi đua của công ty.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <Button variant="secondary" type="button" onClick={onClose}>
              Hủy
            </Button>
            <Button variant="primary" type="submit" style={{ background: '#b45309', borderColor: '#b45309' }}>
              Tạo phòng Test
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── GAME RESULT MODAL ──
function GameResultModal({ isOpen, result, isSamWin, isTest, onPlayAgain, onLeave }) {
  if (!isOpen || !result) return null;

  const winner = result.find((r) => r.isWinner) || result[0];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2200,
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#0f172a',
          color: '#f8fafc',
          borderRadius: 20,
          maxWidth: 520,
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.15)',
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        {/* Header Ribbon */}
        <div style={{ padding: '24px 20px 16px', background: 'radial-gradient(ellipse at top, #1e293b 0%, #0f172a 100%)' }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              boxShadow: '0 0 24px rgba(251, 191, 36, 0.5)',
            }}
          >
            <Trophy size={32} />
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#f8fafc' }}>
            {isSamWin ? '⚡ THẮNG SÂM THẦN TỐC!' : 'KẾT THÚC VÁN ĐẤU'}
          </h2>
          <div style={{ fontSize: 14, color: '#fbbf24', marginTop: 4, fontWeight: 700 }}>
            Người thắng: {winner?.name || 'Vô danh'}
          </div>
        </div>

        {/* Players Score Ledger */}
        <div style={{ padding: '16px 24px' }}>
          <div style={{ background: '#1e293b', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '8px 12px' }}>Người chơi</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Còn lại</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Trạng thái</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Điểm</th>
                </tr>
              </thead>
              <tbody>
                {result.map((p, idx) => {
                  const isWin = p.isWinner;
                  const delta = p.scoreDelta || 0;
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: isWin ? '#fbbf24' : '#f8fafc' }}>
                        {isWin && '👑 '}
                        {p.name}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8' }}>
                        {p.remainingCards != null ? `${p.remainingCards} lá` : '0 lá'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: isWin ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                            color: isWin ? '#34d399' : '#f87171',
                          }}
                        >
                          {isWin ? (isSamWin ? 'THẮNG SÂM' : 'VỀ NHẤT') : p.reason || 'THUA'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: delta > 0 ? '#34d399' : delta < 0 ? '#f87171' : '#94a3b8' }}>
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
        <div style={{ padding: '16px 24px 24px', display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Button variant="outline" onClick={onLeave} style={{ color: '#cbd5e1', borderColor: 'rgba(255,255,255,0.2)' }}>
            <LogOut size={16} /> Rời Bàn
          </Button>
          <Button
            variant="primary"
            onClick={onPlayAgain}
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#0f172a',
              fontWeight: 800,
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
            }}
          >
            <RotateCcw size={16} /> Chơi Ván Tiếp
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── OPPONENT SEAT COMPONENT ──
function OpponentSeat({ player, isTurn, timeLeft, position, samPhase, samDeclarerId, passPlayerIds = [] }) {
  if (!player) return null;

  const isBot = player.isBot;
  const isBaoMot = player.isBaoMot;
  const cardCount = player.remainingCardsCount ?? 10;
  const name = isBot ? (player.botName || 'Bot') : (player.user?.name || 'Người chơi');
  const playerId = player.userId ? Number(player.userId) : (player.id || player.botId);
  const isPassed = Array.isArray(passPlayerIds) && passPlayerIds.some((pid) => String(pid) === String(playerId));
  const isSamDeclarer = samDeclarerId && String(samDeclarerId) === String(playerId);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        position: 'relative',
        transition: 'opacity 200ms ease, transform 200ms ease',
      }}
    >
      {/* Avatar Container with Active Turn Glow */}
      <div style={{ position: 'relative' }}>
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: '50%',
            padding: 3,
            background: isTurn
              ? 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)'
              : isSamDeclarer
              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
              : 'rgba(255,255,255,0.1)',
            boxShadow: isTurn
              ? '0 0 22px rgba(56, 189, 248, 0.75)'
              : isSamDeclarer
              ? '0 0 20px rgba(245, 158, 11, 0.7)'
              : 'none',
            transition: 'background-color 200ms ease, box-shadow 200ms ease, opacity 200ms ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isPassed ? 0.6 : 1,
          }}
        >
          <DefaultAvatar name={name} size={48} />
        </div>

        {/* Mini Turn Countdown on Avatar */}
        {isTurn && !isPassed && (
          <div
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              background: timeLeft <= 5 ? '#ef4444' : '#0284c7',
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 900,
              width: 22,
              height: 22,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #0f172a',
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              animation: 'pulse 1s infinite',
            }}
          >
            {timeLeft}
          </div>
        )}

        {/* Card Count Pill */}
        <div
          style={{
            position: 'absolute',
            bottom: -6,
            left: '50%',
            transform: 'translateX(-50%)',
            background: cardCount <= 2 ? '#dc2626' : '#1e293b',
            color: '#f8fafc',
            fontSize: 10,
            fontWeight: 800,
            padding: '2px 6px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.2)',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          }}
        >
          <span>🂠</span>
          <span>{cardCount} lá</span>
        </div>
      </div>

      {/* Name and Badges */}
      <div style={{ textAlign: 'center', marginTop: 4 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#f8fafc',
            maxWidth: 110,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            opacity: isPassed ? 0.65 : 1,
          }}
        >
          {name}
        </div>

        {/* Status Tag */}
        <div style={{ marginTop: 3, display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
          {isBot && (
            <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '1px 4px', borderRadius: 3 }}>
              BOT
            </span>
          )}
          {player.isHost && (
            <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(147, 51, 234, 0.2)', color: '#c084fc', padding: '1px 4px', borderRadius: 3 }}>
              HOST
            </span>
          )}

          {/* SÂM DECLARATION PHASE BADGES */}
          {samPhase === 'SAM_DECLARING' ? (
            player.hasDeclaredSam === true ? (
              <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24', padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(251,191,36,0.4)', animation: 'pulse 1.2s infinite' }}>
                ⚡ ĐÃ BÁO SÂM
              </span>
            ) : player.hasDeclaredSam === false ? (
              <span style={{ fontSize: 9, fontWeight: 600, background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', padding: '1px 4px', borderRadius: 3 }}>
                Không Báo
              </span>
            ) : (
              <span style={{ fontSize: 9, fontWeight: 600, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '1px 4px', borderRadius: 3, animation: 'pulse 1.5s infinite' }}>
                Đang chọn...
              </span>
            )
          ) : (
            /* PLAYING PHASE BADGES */
            <>
              {isSamDeclarer && (
                <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24', padding: '1px 5px', borderRadius: 3, border: '1px solid rgba(251,191,36,0.4)' }}>
                  👑 XIN SÂM
                </span>
              )}
              {isBaoMot && (
                <span style={{ fontSize: 9, fontWeight: 800, background: '#ef4444', color: '#fff', padding: '1px 4px', borderRadius: 3, animation: 'pulse 1s infinite' }}>
                  BÁO 1
                </span>
              )}
              {isPassed ? (
                <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(148, 163, 184, 0.25)', color: '#cbd5e1', padding: '1px 4px', borderRadius: 3, border: '1px solid rgba(255,255,255,0.1)' }}>
                  BỎ LƯỢT
                </span>
              ) : isTurn ? (
                <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(56, 189, 248, 0.25)', color: '#38bdf8', padding: '1px 4px', borderRadius: 3, border: '1px solid rgba(56, 189, 248, 0.35)' }}>
                  ĐANG ĐÁNH
                </span>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MAIN SAM GAME COMPONENT ──
export default function SamGame() {
  const { roomId: urlRoomId } = useParams();
  const navigate = useNavigate();
  const { user, socket: authSocket, isAdmin } = useAuth();
  const {
    loading: availabilityLoading,
    game: gameInfo,
    isComingSoon,
    rawStatus,
    proceedAsAdmin,
  } = useGameAvailability('sam');

  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState('LOBBY'); // 'LOBBY', 'LEADERBOARD', 'RULES'

  // Loading & Global States
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Lobby Data
  const [rooms, setRooms] = useState([]);
  const [botTestRooms, setBotTestRooms] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myStats, setMyStats] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);

  // Active Match State
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [myHandCards, setMyHandCards] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  const [isSpectator, setIsSpectator] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(25);
  const [bannerMessage, setBannerMessage] = useState('');
  const [lastActionAnimation, setLastActionAnimation] = useState(null);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [startCountdownSec, setStartCountdownSec] = useState(null);
  const lastPlayedCountdownSecRef = useRef(null);

  // Sorting Mode for Hand: 'RANK' (3->2) or 'SMART' (Group combinations)
  const [sortMode, setSortMode] = useState('RANK');

  // Modals & Panels
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBotModal, setShowBotModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showDebugDrawer, setShowDebugDrawer] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [botDebugLogs, setBotDebugLogs] = useState([]);

  // Socket instance: authenticated socket from useAuth or fallback from socket service
  const socket = authSocket || getSocket();

  // ── DATA FETCHING ──
  const fetchLobbyData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const promises = [
        samGame.listRooms({ status: 'WAITING' }),
        samGame.getActiveRoom().catch(() => ({ room: null })),
        samGame.getLeaderboard({ limit: 50 }).catch(() => ({ data: [] })),
        samGame.getMyStats().catch(() => null),
      ];
      if (isAdmin) {
        promises.push(samGame.listBotTestRooms().catch(() => []));
      }

      const results = await Promise.all(promises);
      setRooms(results[0] || []);

      const activeRoomData = results[1]?.room;
      setActiveRoom(activeRoomData || null);
      if (activeRoomData && activeRoomData.status === 'PLAYING') {
        setRoom(activeRoomData);
      }

      setLeaderboard(results[2]?.data || []);
      setMyStats(results[3] || null);

      if (isAdmin && results[4]) {
        setBotTestRooms(results[4] || []);
      }
    } catch (err) {
      console.error('Failed to fetch Sam lobby data:', err);
      setErrorMsg(err.message || 'Không thể tải dữ liệu sảnh');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  const fetchRoomDetail = useCallback(async (roomIdToFetch) => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const data = await samGame.getRoom(roomIdToFetch);
      if (data && data.room) {
        setRoom(data.room);
        if (data.room.serverTime) {
          setServerTimeOffset(new Date(data.room.serverTime).getTime() - Date.now());
        }
        setPlayers(data.players || []);
        setMyHandCards(data.myHandCards || []);
        setIsSpectator(!!data.isSpectator);
        setSpectatorCount(data.spectatorCount || 0);
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
  }, []);

  useEffect(() => {
    if (urlRoomId) {
      fetchRoomDetail(urlRoomId);
    } else {
      fetchLobbyData();
    }
  }, [urlRoomId, fetchRoomDetail, fetchLobbyData]);

  // Turn Countdown Timer (Server Authoritative)
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

  // Start Match 5-Second Countdown Timer (Server Authoritative)
  useEffect(() => {
    if (!room || room.status !== 'STARTING' || !room.startAt) {
      setStartCountdownSec(null);
      lastPlayedCountdownSecRef.current = null;
      return;
    }

    const updateCountdown = () => {
      const deadline = new Date(room.startAt).getTime();
      const now = Date.now() + serverTimeOffset;
      const diffMs = deadline - now;
      const sec = Math.max(0, Math.ceil(diffMs / 1000));
      setStartCountdownSec(sec);

      if (lastPlayedCountdownSecRef.current !== sec) {
        lastPlayedCountdownSecRef.current = sec;
        if (sec > 0) {
          samSound.playCountdownTick();
        } else if (sec === 0) {
          samSound.playCountdownStart();
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100);
    return () => clearInterval(interval);
  }, [room?.status, room?.startAt, serverTimeOffset]);

  // Socket.IO Listeners
  useEffect(() => {
    if (!socket || !room?.id) return;

    socket.emit('sam:joinRoom', { roomId: room.id, isSpectator });

    const handleRoomUpdated = (data) => {
      if (data?.room) setRoom((prev) => ({ ...prev, ...data.room }));
    };

    const handlePlayerJoined = (data) => {
      if (data?.players) setPlayers(data.players);
    };

    const handlePlayerLeft = (data) => {
      if (data?.players) setPlayers(data.players);
    };

    const handlePlayerReady = (data) => {
      if (data?.players) setPlayers(data.players);
    };

    const handleStarting = (data) => {
      if (data?.room) {
        setRoom((prev) => ({ ...prev, ...data.room }));
        if (data.serverTime) {
          setServerTimeOffset(new Date(data.serverTime).getTime() - Date.now());
        }
      }
      if (data?.players) setPlayers(data.players);
      setBannerMessage('⏳ Tất cả đã sẵn sàng! Đếm ngược 5 giây để bắt đầu...');
    };

    const handleStartingCancelled = (data) => {
      if (data?.room) setRoom((prev) => ({ ...prev, ...data.room }));
      if (data?.players) setPlayers(data.players);
      setBannerMessage(
        data?.reason === 'PLAYER_UNREADY'
          ? '⚠️ Đã hủy đếm ngược do người chơi hủy sẵn sàng'
          : '⚠️ Đã hủy đếm ngược do có người chơi rời phòng'
      );
    };

    const handleStarted = (data) => {
      if (data?.room) setRoom(data.room);
      if (data?.players) setPlayers(data.players);
      setGameResult(null);
      setBannerMessage('⚡ Trận đấu bắt đầu! 10 giây báo Sâm');
      samSound.playDeal();
    };

    const handleHandCards = (data) => {
      if (data?.handCards) {
        setMyHandCards(data.handCards);
        setSelectedCards([]);
      }
    };

    const handleSamDecision = (data) => {
      setPlayers((prev) =>
        prev.map((p) => {
          if (
            (p.userId && data.userId && Number(p.userId) === Number(data.userId)) ||
            (p.botId && data.userId && p.botId === data.userId) ||
            p.seatIndex === data.seatIndex
          ) {
            return { ...p, hasDeclaredSam: data.hasDeclaredSam };
          }
          return p;
        })
      );
    };

    const handleSamDeclared = (data) => {
      setBannerMessage(`⚡ ${data.declarerName || 'Người chơi'} ĐÃ BÁO SÂM!`);
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              samPhase: 'PLAYING',
              samDeclarerId: data.userId,
              currentTurnUserId: data.currentTurnUserId,
              currentTurnSeat: data.currentTurnSeat,
              turnDeadline: data.turnDeadline,
            }
          : null
      );
      samSound.playTurnAlert();
    };

    const handleSamResolved = (data) => {
      setBannerMessage(
        data.isSam
          ? `⚡ VÁN ĐẤU BÁO SÂM • ${data.declarerName || 'Người xin Sâm'} ĐI ĐẦU!`
          : '✨ Ván đấu thường bắt đầu! Đánh bài tự do'
      );
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              samPhase: 'PLAYING',
              currentTurnUserId: data.currentTurnUserId,
              currentTurnSeat: data.currentTurnSeat,
              turnDeadline: data.turnDeadline,
            }
          : null
      );
    };

    const handleTurnChanged = (data) => {
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              currentTurnUserId: data.currentTurnUserId,
              currentTurnSeat: data.currentTurnSeat,
              turnDeadline: data.turnDeadline,
            }
          : null
      );
    };

    const handleCardsPlayed = (data) => {
      setBannerMessage(`${data.comboName || 'Bộ bài vừa đánh'}`);
      samSound.playCardPlay();
      setLastActionAnimation({
        userId: data.userId,
        cards: data.cards,
        comboName: data.comboName,
        time: Date.now(),
      });

      // Synchronize player remaining count & room state
      setPlayers((prev) =>
        prev.map((p) => {
          if (
            (p.userId && data.userId && Number(p.userId) === Number(data.userId)) ||
            p.id === data.userId ||
            p.botId === data.userId
          ) {
            return { ...p, remainingCardsCount: data.remainingCount };
          }
          return p;
        })
      );

      setRoom((prev) =>
        prev
          ? {
              ...prev,
              lastPlayedCards: { cards: data.cards, name: data.comboName, userId: data.userId },
              currentTurnUserId: data.nextTurnUserId,
              currentTurnSeat: data.nextTurnSeat,
              turnDeadline: data.turnDeadline,
            }
          : null
      );
    };

    const handlePass = (data) => {
      setBannerMessage('Có người vừa bỏ lượt');
      samSound.playPass();

      setRoom((prev) => {
        if (!prev) return null;
        const passList = Array.isArray(prev.passPlayerIds) ? [...prev.passPlayerIds] : [];
        if (data.userId && !passList.includes(data.userId)) {
          passList.push(data.userId);
        }
        return {
          ...prev,
          passPlayerIds: passList,
          currentTurnUserId: data.nextTurnUserId,
          currentTurnSeat: data.nextTurnSeat,
          turnDeadline: data.turnDeadline,
        };
      });
    };

    const handleRoundReset = (data) => {
      setBannerMessage('✨ Vòng mới! Đánh bộ bài tự do');
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              lastPlayedCards: null,
              passPlayerIds: [],
              currentTurnUserId: data.roundWinnerId,
              currentTurnSeat: data.roundWinnerSeat,
              roundNumber: data.roundNumber,
              turnDeadline: data.turnDeadline,
            }
          : null
      );
    };

    const handleChopped = (data) => {
      setBannerMessage(`⚡ BỊ CHẶT 2! (+${data.points} điểm)`);
      samSound.playCardPlay(true);
    };

    const handleBaoMot = (data) => {
      setBannerMessage(`⚠️ ${data.playerName || 'Có người'} BÁO 1 LÁ!`);
      samSound.playBaoMot();
      setPlayers((prev) =>
        prev.map((p) => {
          if (
            (p.userId && data.userId && Number(p.userId) === Number(data.userId)) ||
            p.botId === data.userId ||
            p.seatIndex === data.seatIndex
          ) {
            return { ...p, isBaoMot: true };
          }
          return p;
        })
      );
    };

    const handleGameFinished = (data) => {
      setGameResult(data.results || []);
      setRoom((prev) => (prev ? { ...prev, status: 'FINISHED' } : null));
      samSound.playVictory();
    };

    const handleSpectatorCount = (data) => {
      if (data?.spectatorCount !== undefined) {
        setSpectatorCount(data.spectatorCount);
      }
    };

    const handleBotDebug = (data) => {
      if (isAdmin && data) {
        setBotDebugLogs((prev) => [
          { ...data, timestamp: new Date().toLocaleTimeString() },
          ...prev.slice(0, 49),
        ]);
      }
    };

    socket.on('sam:roomUpdated', handleRoomUpdated);
    socket.on('sam:playerJoined', handlePlayerJoined);
    socket.on('sam:playerLeft', handlePlayerLeft);
    socket.on('sam:playerReady', handlePlayerReady);
    socket.on('sam:starting', handleStarting);
    socket.on('sam:startingCancelled', handleStartingCancelled);
    socket.on('sam:started', handleStarted);
    socket.on('sam:handCards', handleHandCards);
    socket.on('sam:samDecision', handleSamDecision);
    socket.on('sam:samDeclared', handleSamDeclared);
    socket.on('sam:samResolved', handleSamResolved);
    socket.on('sam:turnChanged', handleTurnChanged);
    socket.on('sam:cardsPlayed', handleCardsPlayed);
    socket.on('sam:pass', handlePass);
    socket.on('sam:roundReset', handleRoundReset);
    socket.on('sam:chopped', handleChopped);
    socket.on('sam:baoMot', handleBaoMot);
    socket.on('sam:gameFinished', handleGameFinished);
    socket.on('sam:spectatorCount', handleSpectatorCount);
    socket.on('sam:botDebug', handleBotDebug);

    return () => {
      socket.emit('sam:leaveRoom', { roomId: room.id });
      socket.off('sam:roomUpdated', handleRoomUpdated);
      socket.off('sam:playerJoined', handlePlayerJoined);
      socket.off('sam:playerLeft', handlePlayerLeft);
      socket.off('sam:playerReady', handlePlayerReady);
      socket.off('sam:starting', handleStarting);
      socket.off('sam:startingCancelled', handleStartingCancelled);
      socket.off('sam:started', handleStarted);
      socket.off('sam:handCards', handleHandCards);
      socket.off('sam:samDecision', handleSamDecision);
      socket.off('sam:samDeclared', handleSamDeclared);
      socket.off('sam:samResolved', handleSamResolved);
      socket.off('sam:turnChanged', handleTurnChanged);
      socket.off('sam:cardsPlayed', handleCardsPlayed);
      socket.off('sam:pass', handlePass);
      socket.off('sam:roundReset', handleRoundReset);
      socket.off('sam:chopped', handleChopped);
      socket.off('sam:baoMot', handleBaoMot);
      socket.off('sam:gameFinished', handleGameFinished);
      socket.off('sam:spectatorCount', handleSpectatorCount);
      socket.off('sam:botDebug', handleBotDebug);
    };
  }, [socket, room?.id, isSpectator, isAdmin]);

  // Identify current user's player entity
  const myPlayer = useMemo(() => {
    return players.find(
      (p) =>
        (p.userId && user?.id && Number(p.userId) === Number(user.id)) ||
        (!p.isBot && p.isHost && Number(p.userId) === Number(user?.id))
    );
  }, [players, user]);

  // Alert when it becomes player's turn
  const isMyTurn = useMemo(() => {
    if (!room || room.status !== 'PLAYING' || room.samPhase !== 'PLAYING') return false;
    if (!myPlayer) return false;
    return room.currentTurnSeat === myPlayer.seatIndex;
  }, [room, myPlayer]);

  useEffect(() => {
    if (isMyTurn) {
      samSound.playTurnAlert();
    }
  }, [isMyTurn]);

  // Selected Cards Combination Inspector
  const selectedCombo = useMemo(() => {
    return detectCombination(selectedCards);
  }, [selectedCards]);

  const canPlaySelected = useMemo(() => {
    if (!isMyTurn || selectedCards.length === 0) return false;
    const beatRes = canBeat(selectedCards, room?.lastPlayedCards);
    return beatRes.canBeat;
  }, [isMyTurn, selectedCards, room?.lastPlayedCards]);

  // Opponents Positioning (Relative to Bottom Player)
  const opponentPositions = useMemo(() => {
    const mySeat = myPlayer ? myPlayer.seatIndex : 0;
    const totalSeats = room?.maxPlayers || 4;

    const positions = { top: null, left: null, right: null };

    players.forEach((p) => {
      if (myPlayer && p.seatIndex === mySeat) return; // Self is bottom

      const relIndex = (p.seatIndex - mySeat + totalSeats) % totalSeats;
      if (totalSeats === 2) {
        positions.top = p;
      } else if (totalSeats === 3) {
        if (relIndex === 1) positions.left = p;
        if (relIndex === 2) positions.right = p;
      } else {
        if (relIndex === 1) positions.left = p;
        if (relIndex === 2) positions.top = p;
        if (relIndex === 3) positions.right = p;
      }
    });

    return positions;
  }, [players, myPlayer, room?.maxPlayers]);

  // ── USER ACTIONS ──
  const handleToggleCardSelection = (cardId) => {
    samSound.playSelect();
    setSelectedCards((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  };

  const handleSortHand = () => {
    samSound.playSelect();
    if (sortMode === 'RANK') {
      const sorted = sortCardsSmart(myHandCards);
      setMyHandCards(sorted);
      setSortMode('SMART');
    } else {
      const sorted = sortCardsByRank(myHandCards);
      setMyHandCards(sorted);
      setSortMode('RANK');
    }
  };

  const handleCreateRoom = async (formData) => {
    try {
      setActionLoading(true);
      const res = await samGame.createRoom(formData);
      if (res?.room) {
        setRoom(res.room);
        setPlayers(res.players || []);
        navigate(`/games/sam/room/${res.room.id}`);
      }
      setShowCreateModal(false);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể tạo phòng');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateBotRoom = async (formData) => {
    try {
      setActionLoading(true);
      const res = await samGame.createBotTestRoom(formData);
      if (res?.room) {
        setRoom(res.room);
        setPlayers(res.players || []);
        navigate(`/games/sam/room/${res.room.id}`);
      }
      setShowBotModal(false);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể tạo phòng Bot Test');
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinRoom = async (targetRoomId) => {
    try {
      setActionLoading(true);
      const res = await samGame.joinRoom(targetRoomId);
      if (res?.room) {
        setRoom(res.room);
        setPlayers(res.players || []);
        if (res.myHandCards) setMyHandCards(res.myHandCards);
        navigate(`/games/sam/room/${res.room.id}`);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể tham gia phòng');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!room?.id) return;
    try {
      setActionLoading(true);
      await samGame.leaveRoom(room.id);
      setRoom(null);
      setPlayers([]);
      setMyHandCards([]);
      setSelectedCards([]);
      navigate('/games/sam');
      fetchLobbyData();
    } catch (err) {
      console.error('Leave room failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleReady = async (targetReady) => {
    if (!room?.id) return;
    try {
      setActionLoading(true);
      if (socket && socket.connected) {
        socket.emit('sam:toggleReady', { roomId: room.id, isReady: targetReady });
      }
      const res = await samGame.toggleReady(room.id, targetReady);
      if (res?.players) setPlayers(res.players);
      if (res?.room) setRoom(res.room);
    } catch (err) {
      console.error('Toggle ready failed:', err);
      setErrorMsg(err.response?.data?.message || 'Không thể thay đổi trạng thái sẵn sàng');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartMatch = async () => {
    if (!room?.id) return;
    try {
      setActionLoading(true);
      const res = await samGame.startMatch(room.id);
      if (res?.room) {
        setRoom(res.room);
        setPlayers(res.players || []);
        if (res.myHandCards) setMyHandCards(res.myHandCards);
        setGameResult(null);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể bắt đầu trận đấu');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePlayCards = async () => {
    if (!room?.id || selectedCards.length === 0 || !isMyTurn) return;
    try {
      setActionLoading(true);
      const res = await samGame.playCards(room.id, selectedCards);
      if (res) {
        setRoom(res.room);
        setPlayers(res.players || []);
        if (res.myHandCards) setMyHandCards(res.myHandCards);
        setSelectedCards([]);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Nước đi không hợp lệ');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePassTurn = async () => {
    if (!room?.id || !isMyTurn) return;
    try {
      setActionLoading(true);
      const res = await samGame.passTurn(room.id);
      if (res) {
        setRoom(res.room);
        setPlayers(res.players || []);
        if (res.myHandCards) setMyHandCards(res.myHandCards);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể bỏ lượt');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclareSam = async (declare) => {
    if (!room?.id) return;
    try {
      setActionLoading(true);
      const res = await samGame.declareSam(room.id, declare);
      if (res) {
        setRoom(res.room);
        setPlayers(res.players || []);
        if (res.myHandCards) setMyHandCards(res.myHandCards);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể báo Sâm');
    } finally {
      setActionLoading(false);
    }
  };

  // ── ADMIN BOT TEST CONTROLS ──
  const handlePauseBot = async () => {
    if (!room?.id) return;
    try {
      const res = await samGame.pauseBotTest(room.id);
      if (res?.room) setRoom(res.room);
    } catch (err) {
      console.error(err);
    }
  };

  const handleResumeBot = async () => {
    if (!room?.id) return;
    try {
      const res = await samGame.resumeBotTest(room.id);
      if (res?.room) setRoom(res.room);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStepBot = async () => {
    if (!room?.id) return;
    try {
      const res = await samGame.stepBotTest(room.id);
      if (res?.room) setRoom(res.room);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestartBot = async () => {
    if (!room?.id) return;
    try {
      const res = await samGame.restartBotTest(room.id);
      if (res?.room) {
        setRoom(res.room);
        setPlayers(res.players || []);
        if (res.myHandCards) setMyHandCards(res.myHandCards);
        setGameResult(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFillBots = async () => {
    if (!room?.id) return;
    try {
      const res = await samGame.fillBots(room.id);
      if (res?.players) setPlayers(res.players);
    } catch (err) {
      console.error(err);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // COMING SOON GUARD (BLOCKS NON-ADMIN USERS IF GAME IS COMING_SOON)
  // ─────────────────────────────────────────────────────────────
  if (!availabilityLoading && isComingSoon) {
    return (
      <GameFullscreenShell
        title="Đánh Sâm"
        icon={Club}
        badge="Dân Gian"
        exitLabel="Quay lại"
        exitTo="/games"
      >
        <GameComingSoon
          gameKey="sam"
          name={gameInfo?.name || 'Đánh Sâm'}
          description={gameInfo?.description}
          isAdmin={isAdmin}
          onAdminProceed={proceedAsAdmin}
        />
      </GameFullscreenShell>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER PHASE 1: FULLSCREEN GAME SHELL (WHEN IN ACTIVE MATCH)
  // ─────────────────────────────────────────────────────────────
  if (room && room.status === 'PLAYING') {
    const myId = user?.id;
    const isSelfPassed = Array.isArray(room?.passPlayerIds) && myId && room.passPlayerIds.some((pid) => String(pid) === String(myId));

    return (
      <GameFullscreenShell topBar={false} className="wr-sam-match-fullscreen">
        <style>{`
          @keyframes dealIn {
            0% {
              opacity: 0;
              transform: translateY(-60px) scale(0.7) rotate(-6deg);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1) rotate(0deg);
            }
          }
          @keyframes playCardIn {
            0% {
              opacity: 0;
              transform: translateY(35px) scale(0.7);
            }
            60% {
              opacity: 1;
              transform: translateY(-4px) scale(1.04);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          @keyframes pulseGlow {
            0%, 100% {
              box-shadow: 0 0 14px rgba(56, 189, 248, 0.45);
            }
            50% {
              box-shadow: 0 0 28px rgba(56, 189, 248, 0.9);
            }
          }
          @keyframes scaleUp {
            0% { transform: scale(0.88); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes fadeIn {
            0% { opacity: 0; }
            100% { opacity: 1; }
          }
        `}</style>

        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'radial-gradient(ellipse at center, #16243b 0%, #0c1424 60%, #070b14 100%)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            color: '#f8fafc',
            fontFamily: "'Space Grotesk', -apple-system, sans-serif",
          }}
        >
          {/* Top Bar Header */}
          <div
            style={{
              height: 54,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              padding: '0 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(10px)',
              flexShrink: 0,
              zIndex: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                onClick={handleLeaveRoom}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#f8fafc',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease',
                }}
              >
                <ArrowLeft size={16} /> Rời bàn
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-flex', padding: 4, borderRadius: 6, background: '#b45309', color: '#fff' }}>
                  <Club size={16} />
                </span>
                <strong style={{ fontSize: 14, color: '#f8fafc' }}>{room.title}</strong>
                <span
                  style={{
                    fontSize: 11,
                    background: 'rgba(255,255,255,0.1)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    color: '#cbd5e1',
                    fontFamily: 'monospace',
                  }}
                >
                  {room.code}
                </span>

                {room.isTest && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#fbbf24',
                      padding: '2px 8px',
                      borderRadius: 4,
                      border: '1px solid rgba(251,191,36,0.3)',
                    }}
                  >
                    <Bot size={12} /> TEST MODE
                  </span>
                )}

                {isSpectator && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      background: 'rgba(56,189,248,0.15)',
                      color: '#38bdf8',
                      padding: '2px 8px',
                      borderRadius: 4,
                      border: '1px solid rgba(56,189,248,0.3)',
                    }}
                  >
                    <Eye size={12} /> ĐANG XEM
                  </span>
                )}

                {spectatorCount > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8' }}>
                    <Eye size={12} /> {spectatorCount}
                  </span>
                )}
              </div>
            </div>

            {/* Announcement Center Chip */}
            {bannerMessage && (
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#fef08a',
                  background: 'rgba(180,83,9,0.3)',
                  padding: '4px 14px',
                  borderRadius: 20,
                  border: '1px solid rgba(251,191,36,0.4)',
                  animation: 'fadeIn 0.2s ease',
                }}
              >
                {bannerMessage}
              </div>
            )}

            {/* Right Tools & Admin Test Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {isAdmin && room.isTest && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDebugDrawer(!showDebugDrawer)}
                  style={{
                    background: showDebugDrawer ? '#b45309' : 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    borderColor: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <Sliders size={14} />
                  ⚙ Test Bot Panel
                </Button>
              )}

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
                onClick={() => {
                  const nextMute = samSound.toggleMute();
                  setSoundEnabled(!nextMute);
                }}
                title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: soundEnabled ? '#38bdf8' : '#64748b',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
            </div>
          </div>

          {/* Central Casino Felt Arena */}
          <div
            style={{
              flex: 1,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 20px 20px',
              overflow: 'hidden',
            }}
          >
            {/* OPPONENT TOP */}
            <div style={{ height: 86, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {opponentPositions.top && (
                <OpponentSeat
                  player={opponentPositions.top}
                  isTurn={room.currentTurnSeat === opponentPositions.top.seatIndex}
                  timeLeft={timeLeft}
                  position="top"
                  samPhase={room.samPhase}
                  samDeclarerId={room.samDeclarerId}
                  passPlayerIds={room.passPlayerIds}
                />
              )}
            </div>

            {/* MIDDLE ROW: OPPONENT LEFT, TABLE ARENA, OPPONENT RIGHT */}
            <div
              style={{
                width: '100%',
                maxWidth: 1100,
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 20,
                position: 'relative',
              }}
            >
              {/* OPPONENT LEFT */}
              <div style={{ width: 140, display: 'flex', justifyContent: 'center' }}>
                {opponentPositions.left && (
                  <OpponentSeat
                    player={opponentPositions.left}
                    isTurn={room.currentTurnSeat === opponentPositions.left.seatIndex}
                    timeLeft={timeLeft}
                    position="left"
                    samPhase={room.samPhase}
                    samDeclarerId={room.samDeclarerId}
                    passPlayerIds={room.passPlayerIds}
                  />
                )}
              </div>

              {/* TABLE FELT TRICK DROPZONE */}
              <div
                style={{
                  flex: 1,
                  maxWidth: 640,
                  height: '80%',
                  minHeight: 230,
                  borderRadius: 24,
                  background: 'radial-gradient(ellipse at center, #1b2e4b 0%, #111d31 70%, #0c1524 100%)',
                  border: '2px solid rgba(255, 255, 255, 0.12)',
                  boxShadow: 'inset 0 0 50px rgba(0,0,0,0.6), 0 10px 30px rgba(0,0,0,0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 20,
                  position: 'relative',
                }}
              >
                {/* Countdown Timer Badge */}
                <div
                  style={{
                    position: 'absolute',
                    top: 14,
                    right: 18,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 800,
                    color: timeLeft <= 5 ? '#f87171' : '#38bdf8',
                    background: 'rgba(0,0,0,0.5)',
                    padding: '4px 12px',
                    borderRadius: 20,
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <Clock size={14} /> {timeLeft}s
                </div>

                {/* Round / Mode Badge */}
                <div
                  style={{
                    position: 'absolute',
                    top: 14,
                    left: 18,
                    fontSize: 12,
                    fontWeight: 700,
                    color: room.samDeclarerId ? '#fbbf24' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {room.samDeclarerId ? (
                    <span style={{ background: 'rgba(245,158,11,0.2)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(251,191,36,0.3)' }}>
                      ⚡ VÁN XIN SÂM
                    </span>
                  ) : (
                    <span>Vòng {room.roundNumber || 1}</span>
                  )}
                </div>

                {/* Cards on Table (Cascading Trick Fan with Smooth Animated Entry) */}
                {room.lastPlayedCards ? (
                  <div
                    key={`trick-${room.lastPlayedCards.userId}-${(room.lastPlayedCards.cards || []).join('-')}`}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      {room.lastPlayedCards.cards.map((c, i) => (
                        <div
                          key={`${c}-${i}`}
                          style={{
                            animation: 'playCardIn 0.38s cubic-bezier(0.2, 0.8, 0.2, 1) backwards',
                            animationDelay: `${i * 55}ms`,
                          }}
                        >
                          <PlayingCard
                            cardId={c}
                            disabled
                            style={{
                              transform: `rotate(${(i - (room.lastPlayedCards.cards.length - 1) / 2) * 5}deg)`,
                              boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#fbbf24',
                        background: 'rgba(15, 23, 42, 0.85)',
                        padding: '5px 16px',
                        borderRadius: 20,
                        border: '1px solid rgba(251,191,36,0.3)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        animation: 'fadeIn 0.2s ease-out',
                      }}
                    >
                      {room.lastPlayedCards.name || 'Bộ bài vừa đánh'}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#64748b' }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 10px',
                      }}
                    >
                      <Club size={28} opacity={0.4} color="#f59e0b" />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8' }}>
                      {room.samPhase === 'SAM_DECLARING'
                        ? 'Thời gian Báo Sâm (10 giây)'
                        : 'Vòng Mới — Đánh Bộ Bài Tự Do'}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      {room.samPhase === 'SAM_DECLARING'
                        ? 'Hãy kiểm tra bài trên tay trước khi quyết định Xin Sâm'
                        : isMyTurn
                        ? '👉 Đang đến lượt bạn đi đầu'
                        : 'Đang chờ đối thủ đánh...'}
                    </div>
                  </div>
                )}
              </div>

              {/* OPPONENT RIGHT */}
              <div style={{ width: 140, display: 'flex', justifyContent: 'center' }}>
                {opponentPositions.right && (
                  <OpponentSeat
                    player={opponentPositions.right}
                    isTurn={room.currentTurnSeat === opponentPositions.right.seatIndex}
                    timeLeft={timeLeft}
                    position="right"
                    samPhase={room.samPhase}
                    samDeclarerId={room.samDeclarerId}
                    passPlayerIds={room.passPlayerIds}
                  />
                )}
              </div>
            </div>

            {/* BOTTOM AREA: PLAYER HAND & ACTION BAR */}
            <div
              style={{
                width: '100%',
                maxWidth: 980,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}
            >
              {isSpectator ? (
                /* SPECTATOR BANNER */
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    padding: '16px 32px',
                    background: 'rgba(15, 23, 42, 0.85)',
                    borderRadius: 12,
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8', fontSize: 14, fontWeight: 800 }}>
                    <Eye size={18} />
                    <span>BẠN ĐANG THEO DÕI TRẬN ĐẤU (CHẾ ĐỘ KHÁN GIẢ)</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    Dữ liệu bài trên tay người chơi được bảo mật trực tiếp từ máy chủ.
                  </span>
                </div>
              ) : (
                /* ACTIVE PLAYER HAND & ACTION BAR */
                <>
                  {/* Action Controls */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', minHeight: 42 }}>
                    {room.samPhase === 'SAM_DECLARING' ? (
                      myPlayer?.hasDeclaredSam === true ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            color: '#fbbf24',
                            fontWeight: 800,
                            fontSize: 13,
                            background: 'rgba(245, 158, 11, 0.15)',
                            padding: '8px 18px',
                            borderRadius: 20,
                            border: '1px solid rgba(245, 158, 11, 0.35)',
                          }}
                        >
                          <Zap size={16} /> Bạn đã Xin Sâm! Đang chờ kết quả...
                        </div>
                      ) : myPlayer?.hasDeclaredSam === false ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            color: '#94a3b8',
                            fontWeight: 700,
                            fontSize: 13,
                            background: 'rgba(255, 255, 255, 0.06)',
                            padding: '8px 18px',
                            borderRadius: 20,
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                          }}
                        >
                          <Check size={16} /> Bạn chọn Không Báo Sâm. Đang chờ người chơi khác...
                        </div>
                      ) : (
                        <>
                          <Button
                            variant="primary"
                            disabled={actionLoading}
                            onClick={() => handleDeclareSam(true)}
                            style={{
                              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                              borderColor: '#f59e0b',
                              color: '#0f172a',
                              fontWeight: 900,
                              padding: '10px 22px',
                              fontSize: 14,
                              boxShadow: '0 0 20px rgba(245, 158, 11, 0.5)',
                            }}
                          >
                            ⚡ Báo Sâm (Xin Sâm)
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={actionLoading}
                            onClick={() => handleDeclareSam(false)}
                            style={{ padding: '10px 18px', fontSize: 14 }}
                          >
                            Không Báo Sâm
                          </Button>
                        </>
                      )
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleSortHand}
                          style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.18)',
                            color: '#e2e8f0',
                            padding: '8px 16px',
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Layers size={15} />
                          {sortMode === 'RANK' ? 'Xếp: Số (3→2)' : 'Xếp: Bộ (Đôi/Sảnh)'}
                        </button>

                        <Button
                          variant="primary"
                          disabled={!canPlaySelected || actionLoading}
                          onClick={handlePlayCards}
                          style={{
                            background: canPlaySelected
                              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                              : '#334155',
                            borderColor: canPlaySelected ? '#f59e0b' : '#475569',
                            color: canPlaySelected ? '#0f172a' : '#94a3b8',
                            fontWeight: 800,
                            padding: '8px 20px',
                            minWidth: 140,
                            boxShadow: canPlaySelected ? '0 4px 16px rgba(245, 158, 11, 0.4)' : 'none',
                          }}
                        >
                          {actionLoading
                            ? 'Đang gửi...'
                            : selectedCards.length > 0
                            ? `Đánh ${selectedCombo.isValid ? `(${selectedCombo.name})` : `(${selectedCards.length})`}`
                            : 'Đánh bài'}
                        </Button>

                        {room.lastPlayedCards && (
                          <Button
                            variant="secondary"
                            disabled={!isMyTurn || actionLoading}
                            onClick={handlePassTurn}
                            style={{
                              padding: '8px 16px',
                              fontWeight: 700,
                            }}
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

                  {/* Horizontal Fan Cards Container with Sequential Deal In Animation */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'flex-end',
                      height: 120,
                      padding: '0 20px',
                      width: '100%',
                      overflowX: 'auto',
                    }}
                  >
                    {myHandCards.length === 0 ? (
                      <div style={{ color: '#94a3b8', fontSize: 13, padding: '20px 0', fontStyle: 'italic' }}>
                        Đang nhận bài từ máy chủ...
                      </div>
                    ) : (
                      myHandCards.map((cardId, index) => (
                        <div
                          key={cardId}
                          style={{
                            marginRight: -20,
                            zIndex: selectedCards.includes(cardId) ? 20 : index + 1,
                            animation: 'dealIn 0.32s cubic-bezier(0.2, 0.8, 0.2, 1) backwards',
                            animationDelay: `${index * 45}ms`,
                          }}
                        >
                          <PlayingCard
                            cardId={cardId}
                            selected={selectedCards.includes(cardId)}
                            onClick={handleToggleCardSelection}
                          />
                        </div>
                      ))
                    )}
                  </div>

                  {/* Bottom Self Info Tag */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                    <DefaultAvatar name={user?.name} size={30} />
                    <strong style={{ fontSize: 13, color: '#f8fafc' }}>{user?.name} (Bạn)</strong>
                    {isSelfPassed && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#cbd5e1',
                          background: 'rgba(148, 163, 184, 0.25)',
                          padding: '2px 8px',
                          borderRadius: 12,
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                      >
                        BỎ LƯỢT (VÒNG NÀY)
                      </span>
                    )}
                    {isMyTurn && !isSelfPassed && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#34d399',
                          background: 'rgba(16,185,129,0.2)',
                          padding: '2px 8px',
                          borderRadius: 12,
                          border: '1px solid rgba(52, 211, 153, 0.4)',
                          animation: 'pulse 1.5s infinite',
                        }}
                      >
                        LƯỢT CỦA BẠN
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Admin Bot Test Control Drawer */}
          {isAdmin && room.isTest && showDebugDrawer && (
            <div
              style={{
                position: 'fixed',
                top: 54,
                right: 0,
                bottom: 0,
                width: 380,
                background: '#0f172a',
                borderLeft: '1px solid rgba(255,255,255,0.15)',
                zIndex: 1500,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
                animation: 'slideInRight 0.2s ease-out',
              }}
            >
              {/* Drawer Header */}
              <div
                style={{
                  padding: '14px 18px',
                  background: '#1e293b',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: '#fbbf24' }}>
                  <Sliders size={16} /> Admin Bot Controls
                </div>
                <button
                  type="button"
                  onClick={() => setShowDebugDrawer(false)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Drawer Action Tools */}
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={room.botPaused ? handleResumeBot : handlePauseBot}
                    style={{ background: room.botPaused ? '#15803d' : 'rgba(255,255,255,0.08)', color: '#fff' }}
                  >
                    {room.botPaused ? <Play size={14} /> : <Pause size={14} />}
                    {room.botPaused ? 'Tiếp tục Bot' : 'Tạm dừng Bot'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleStepBot} style={{ color: '#fff' }}>
                    <FastForward size={14} /> Bước (Step)
                  </Button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Button variant="outline" size="sm" onClick={handleFillBots} style={{ color: '#fff' }}>
                    <Users size={14} /> Lấp đầy Bot
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRestartBot} style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>
                    <RotateCcw size={14} /> Reset ván
                  </Button>
                </div>
              </div>

              {/* AI Decision Stream Log */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '8px 16px', background: 'rgba(0,0,0,0.3)', fontSize: 12, fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Terminal size={14} /> Live AI Decision Stream
                </div>
                <div style={{ padding: 12, overflowY: 'auto', fontSize: 11, fontFamily: 'monospace', flex: 1, background: '#090d16' }}>
                  {botDebugLogs.length === 0 ? (
                    <div style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>Chưa có sự kiện bot nào</div>
                  ) : (
                    botDebugLogs.map((log, idx) => (
                      <div key={idx} style={{ marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: '#38bdf8' }}>[{log.timestamp}]</span>{' '}
                        <strong style={{ color: '#fbbf24' }}>{log.botId}</strong>:{' '}
                        <span style={{ color: log.action === 'PLAY' ? '#34d399' : '#94a3b8' }}>{log.action}</span>{' '}
                        {log.cardIds && <span style={{ color: '#f8fafc' }}>[{log.cardIds.join(',')}]</span>}{' '}
                        <span style={{ color: '#94a3b8' }}>({log.decisionReason || log.comboName || 'PASS'})</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Game Result Modal */}
          <GameResultModal
            isOpen={!!gameResult}
            result={gameResult}
            isSamWin={room.samDeclarerId && Number(room.winnerUserId) === Number(room.samDeclarerId)}
            isTest={room.isTest}
            onPlayAgain={room.isTest && isAdmin ? handleRestartBot : handleStartMatch}
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
  if (room && (room.status === 'WAITING' || room.status === 'STARTING')) {
    const isHost = Number(room.hostUserId) === Number(user?.id);
    const myPlayer = players.find((pl) => Number(pl.userId) === Number(user?.id));
    const isMeReady = Boolean(myPlayer?.isReady);

    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--background, #f4f3ef)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
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
                {room.isTest && (
                  <span style={{ fontSize: 11, background: '#fef3c7', color: '#b45309', fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>
                    TEST MODE
                  </span>
                )}
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

          {/* 5-Second Start Countdown Display (Server Authoritative) */}
          {room.status === 'STARTING' && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.95), rgba(253, 230, 138, 0.98))',
                border: '2px solid #f59e0b',
                borderRadius: 14,
                padding: '18px 24px',
                marginBottom: 20,
                textAlign: 'center',
                boxShadow: '0 8px 24px rgba(245, 158, 11, 0.25)',
                animation: 'pulseGlow 2s infinite',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: '#b45309',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                TẤT CẢ NGƯỜI CHƠI ĐÃ SẴN SÀNG
              </div>
              <div style={{ fontSize: 13, color: '#78350f', marginTop: 2, marginBottom: 8, fontWeight: 600 }}>
                Trận đấu sẽ bắt đầu sau
              </div>
              <div
                key={startCountdownSec}
                style={{
                  fontSize: startCountdownSec === 0 ? 32 : 56,
                  fontWeight: 900,
                  color: '#d97706',
                  lineHeight: 1,
                  animation: 'scaleUp 0.28s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                  fontFamily: 'monospace, system-ui',
                  textShadow: '0 2px 10px rgba(245, 158, 11, 0.35)',
                }}
              >
                {startCountdownSec === 0 ? 'BẮT ĐẦU!' : startCountdownSec ?? '5'}
              </div>
            </div>
          )}

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
                const name = p.isBot ? (p.botName || 'Bot AI') : (p.user?.name || 'Người chơi');
                return (
                  <div
                    key={seatIdx}
                    style={{
                      border: p.isReady ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(0,0,0,0.1)',
                      borderRadius: 8,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      background: p.isReady ? 'rgba(240, 253, 244, 0.7)' : '#fafafa',
                      position: 'relative',
                      transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
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
                    {p.isBot && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          fontSize: 10,
                          fontWeight: 800,
                          background: 'rgba(124,58,237,0.12)',
                          color: '#7c3aed',
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}
                      >
                        BOT
                      </span>
                    )}
                    <DefaultAvatar name={name} size={48} style={{ marginBottom: 8 }} />
                    <strong style={{ fontSize: 13, color: '#111827', marginBottom: 2 }}>
                      {name} {!p.isBot && Number(p.userId) === Number(user?.id) && '(Bạn)'}
                    </strong>
                    {!p.isBot && <JobTitleBadge jobTitle={p.user?.jobTitle} size="xs" />}

                    {/* Ready Status Badge */}
                    {p.isReady ? (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          background: 'rgba(22, 163, 74, 0.12)',
                          color: '#16a34a',
                          border: '1px solid rgba(22, 163, 74, 0.3)',
                          padding: '2px 8px',
                          borderRadius: 12,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          marginTop: 6,
                        }}
                      >
                        <Check size={11} strokeWidth={3} /> SẴN SÀNG
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          background: 'rgba(156, 163, 175, 0.15)',
                          color: '#6b7280',
                          padding: '2px 8px',
                          borderRadius: 12,
                          marginTop: 6,
                        }}
                      >
                        CHƯA SẴN SÀNG
                      </span>
                    )}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <Button variant="secondary" onClick={handleLeaveRoom}>
              Rời phòng
            </Button>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Button variant="secondary" onClick={() => setShowRulesModal(true)}>
                Luật chơi
              </Button>
              {isAdmin && room.isTest && players.length < room.maxPlayers && (
                <Button variant="secondary" onClick={handleFillBots}>
                  Lấp đầy Bot
                </Button>
              )}

              {/* Local Player Ready Button */}
              {myPlayer && (
                <Button
                  variant={isMeReady ? 'secondary' : 'primary'}
                  disabled={actionLoading}
                  onClick={() => handleToggleReady(!isMeReady)}
                  style={
                    isMeReady
                      ? { color: '#dc2626', borderColor: '#fca5a5', fontWeight: 700 }
                      : { background: '#10b981', borderColor: '#059669', color: '#fff', fontWeight: 800 }
                  }
                >
                  {isMeReady ? 'Hủy sẵn sàng' : '✓ Sẵn sàng'}
                </Button>
              )}

              {/* Host manual Start Button */}
              {isHost && (
                <Button
                  variant="primary"
                  disabled={players.length < 2 || actionLoading || room.status === 'STARTING'}
                  onClick={handleStartMatch}
                  style={{ background: '#b45309', borderColor: '#b45309' }}
                >
                  {room.status === 'STARTING'
                    ? 'Đang đếm ngược...'
                    : players.length < 2
                    ? 'Cần ít nhất 2 người'
                    : actionLoading
                    ? 'Đang chia bài...'
                    : 'Bắt đầu ngay'}
                </Button>
              )}
            </div>
          </div>
        </Card>

        <SamRulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER PHASE 3: MAIN LOBBY & LEADERBOARD (WORKRANK DESIGN SYSTEM)
  // ─────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        maxWidth: 1080,
        margin: '0 auto',
        padding: '24px 16px 40px',
        fontFamily: "'Space Grotesk', -apple-system, sans-serif",
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
          {isAdmin && (
            <Button variant="secondary" onClick={() => setShowBotModal(true)}>
              <Bot size={16} /> Bot Test
            </Button>
          )}
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
                            background: r.status === 'PLAYING' ? 'rgba(37,99,235,0.1)' : 'rgba(21,128,61,0.1)',
                            color: r.status === 'PLAYING' ? '#2563eb' : '#15803d',
                          }}
                        >
                          {r.status === 'PLAYING' ? 'Đang đấu' : 'Đang chờ'}
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
                        {r.spectatorCount > 0 && (
                          <span style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Eye size={12} /> {r.spectatorCount}
                          </span>
                        )}
                      </span>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleJoinRoom(r.id)}
                        disabled={r.status === 'WAITING' && r.playerCount >= r.maxPlayers}
                        style={{ background: '#111827' }}
                      >
                        {r.status === 'PLAYING' ? 'Xem Trận' : 'Tham gia'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Admin Bot Test Rooms Section (inline, below public rooms) */}
            {isAdmin && botTestRooms.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Bot size={16} color="#7c3aed" />
                  <strong style={{ fontSize: 13, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Phòng Bot Test (Admin)
                  </strong>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {botTestRooms.map((r) => (
                    <Card
                      key={r.id}
                      style={{
                        padding: 16,
                        background: 'rgba(124,58,237,0.04)',
                        border: '1px dashed rgba(124,58,237,0.25)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 14, color: '#111827' }}>{r.title}</strong>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                          {r.playerCount}/{r.maxPlayers} người • {r.botDifficulty || 'NORMAL'}
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => handleJoinRoom(r.id)}>
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
      />
      <CreateBotTestModal isOpen={showBotModal} onClose={() => setShowBotModal(false)} onSubmit={handleCreateBotRoom} />
      <SamRulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />
    </div>
  );
}
