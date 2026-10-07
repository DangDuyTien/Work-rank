import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gamepad2,
  Keyboard,
  LayoutGrid,
  Sparkles,
  Club,
  ArrowLeft,
  Clock,
  ShieldCheck,
  Settings,
  Play,
} from 'lucide-react';
import { Button } from './ui';

const GAME_ICONS = {
  typing_battle: Keyboard,
  typing: Keyboard,
  capital_board: Gamepad2,
  game_2048: LayoutGrid,
  quiz: Sparkles,
  sam: Club,
};

export default function GameComingSoon({
  gameKey,
  name,
  description,
  isAdmin = false,
  onAdminProceed = null,
}) {
  const navigate = useNavigate();
  const IconComponent = GAME_ICONS[gameKey] || Gamepad2;

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'var(--surface)',
          border: '1px solid rgba(15,23,42,0.1)',
          padding: '40px 32px',
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        }}
      >
        {/* Game Icon */}
        <div
          style={{
            width: 72,
            height: 72,
            margin: '0 auto 20px',
            background: 'linear-gradient(135deg, var(--info-soft), rgba(3,105,161,0.05))',
            border: '1px solid var(--info-border)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--info)',
          }}
        >
          <IconComponent size={34} strokeWidth={2.2} />
        </div>

        {/* Status Badge */}
        <div style={{ marginBottom: 12 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: 'rgba(245,158,11,0.12)',
              color: '#d97706',
              border: '1px solid rgba(245,158,11,0.3)',
            }}
          >
            <Clock size={13} strokeWidth={2.5} />
            Sắp Ra Mắt
          </span>
        </div>

        {/* Game Title */}
        <h1
          style={{
            margin: '0 0 10px',
            fontSize: 24,
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          {name || 'Trò Chơi'}
        </h1>

        {/* Description */}
        <p
          style={{
            margin: '0 0 24px',
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
          }}
        >
          {description ||
            'Trò chơi đang trong giai đoạn hoàn thiện kỹ thuật và chuẩn bị ra mắt. Hãy đón chờ phiên bản chính thức trong các giải đấu sắp tới!'}
        </p>

        {/* Action Button */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Button
            variant="secondary"
            onClick={() => navigate('/games')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={16} />
            Quay lại Trò Chơi
          </Button>

          {isAdmin && onAdminProceed && (
            <Button
              variant="primary"
              onClick={onAdminProceed}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                fontWeight: 600,
                background: 'var(--info)',
                borderColor: 'var(--info)',
              }}
            >
              <Play size={16} />
              Vào chơi thử (Admin)
            </Button>
          )}
        </div>

        {/* Admin Preview Notice */}
        {isAdmin && (
          <div
            style={{
              marginTop: 24,
              padding: '12px 14px',
              background: 'var(--surface-soft)',
              border: '1px solid rgba(15,23,42,0.08)',
              fontSize: 12,
              color: 'var(--text-secondary)',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={16} color="var(--info)" />
              <span>
                <strong>Quản trị viên:</strong> Bạn có quyền xem trước và quản lý trạng thái trò chơi này.
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/settings?tab=games')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--info)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: 0,
              }}
            >
              <Settings size={13} />
              Cài đặt Game
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
