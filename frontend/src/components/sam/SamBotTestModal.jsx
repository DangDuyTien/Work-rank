import React, { useState } from 'react';
import { Bot, Info } from 'lucide-react';
import { AnimatedModal, Button } from '../ui';

export default function SamBotTestModal({ isOpen, onClose, onSubmit, loading = false }) {
  const [title, setTitle] = useState('Đánh Sâm — Bot Test Simulator');
  const [playerCount, setPlayerCount] = useState(4);
  const [botCount, setBotCount] = useState(3);
  const [difficulty, setDifficulty] = useState('NORMAL');

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!title.trim() || loading) return;
    onSubmit({
      title: title.trim(),
      playerCount: Number(playerCount),
      botCount: Number(botCount),
      difficulty,
    });
  };

  return (
    <AnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Tạo Phòng Bot Test (Admin Simulator)"
      maxWidth={500}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button
            variant="primary"
            disabled={loading || !title.trim()}
            onClick={handleSubmit}
            style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
          >
            {loading ? 'Đang tạo…' : 'Tạo phòng Test'}
          </Button>
        </>
      }
    >
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
                padding: '9px 10px',
                borderRadius: 6,
                border: '1px solid rgba(0,0,0,0.15)',
                fontSize: 13,
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
                padding: '9px 10px',
                borderRadius: 6,
                border: '1px solid rgba(0,0,0,0.15)',
                fontSize: 13,
                background: '#fff',
              }}
            >
              <option value="EASY">Dễ (Easy)</option>
              <option value="NORMAL">Bình thường (Normal)</option>
              <option value="HARD">Khó (Hard)</option>
            </select>
          </div>
        </div>

        <div
          style={{
            fontSize: 12,
            color: '#6b21a8',
            background: 'rgba(124, 58, 237, 0.08)',
            padding: '10px 12px',
            borderRadius: 6,
            border: '1px solid rgba(124, 58, 237, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Info size={14} style={{ flexShrink: 0 }} />
          <span>Phòng Bot Test được cách ly hoàn toàn khỏi bảng xếp hạng và điểm thi đua của công ty.</span>
        </div>
      </form>
    </AnimatedModal>
  );
}
