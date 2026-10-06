import React, { useState } from 'react';
import { AnimatedModal, Button } from '../ui';

export default function SamCreateRoomModal({ isOpen, onClose, onSubmit, loading = false }) {
  const [title, setTitle] = useState('Phòng Đánh Sâm');
  const [maxPlayers, setMaxPlayers] = useState(4);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!title.trim() || loading) return;
    onSubmit({ title: title.trim(), maxPlayers });
  };

  return (
    <AnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      title="Tạo Phòng Đánh Sâm Mới"
      maxWidth={460}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button
            variant="primary"
            disabled={loading || !title.trim()}
            onClick={handleSubmit}
            style={{ background: '#b45309', borderColor: '#b45309' }}
          >
            {loading ? 'Đang tạo…' : 'Tạo phòng'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
            Tên phòng chơi
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Phòng Sâm Media 3Win"
            required
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

        <div>
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
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'background-color var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard)',
                }}
              >
                {num} Người
              </button>
            ))}
          </div>
        </div>
      </form>
    </AnimatedModal>
  );
}
