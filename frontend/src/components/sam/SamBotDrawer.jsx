import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Sliders, X, Play, Pause, FastForward, Users, RotateCcw, Terminal } from 'lucide-react';
import { Button } from '../ui';

export default function SamBotDrawer({
  isOpen = false,
  onClose,
  room,
  botDebugLogs = [],
  onPauseBot,
  onResumeBot,
  onStepBot,
  onFillBots,
  onRestartBot,
}) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const drawerContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Điều Khiển Test Bot Admin"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        zIndex: 2500,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: 380,
          maxWidth: '100vw',
          height: '100%',
          background: '#161e1b',
          color: '#f8fafc',
          borderLeft: '1px solid rgba(255,255,255,0.12)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.6)',
          animation: 'drawer-right-enter var(--motion-slow) var(--ease-emphasized) forwards',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '14px 16px',
            background: '#1c2622',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            id="sam-bot-drawer-title"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: '#fbbf24' }}
          >
            <Sliders size={15} /> Điều Khiển Test Bot Admin
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bảng điều khiển"
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
          >
            <X size={17} />
          </button>
        </div>

        {/* Drawer Action Tools */}
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Button
              variant="outline"
              size="sm"
              onClick={room?.botPaused ? onResumeBot : onPauseBot}
              style={{ background: room?.botPaused ? '#15803d' : 'rgba(255,255,255,0.08)', color: '#fff' }}
            >
              {room?.botPaused ? <Play size={13} /> : <Pause size={13} />}
              {room?.botPaused ? 'Tiếp tục Bot' : 'Tạm dừng Bot'}
            </Button>
            <Button variant="outline" size="sm" onClick={onStepBot} style={{ color: '#fff' }}>
              <FastForward size={13} /> Bước (Step)
            </Button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Button variant="outline" size="sm" onClick={onFillBots} style={{ color: '#fff' }}>
              <Users size={13} /> Lấp đầy Bot
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRestartBot}
              style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}
            >
              <RotateCcw size={13} /> Reset ván
            </Button>
          </div>
        </div>

        {/* AI Decision Stream Log */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div
            style={{
              padding: '8px 14px',
              background: 'rgba(0,0,0,0.2)',
              fontSize: 11,
              fontWeight: 700,
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Terminal size={13} /> Live AI Decision Stream
          </div>
          <div
            style={{
              padding: 12,
              overflowY: 'auto',
              fontSize: 11,
              fontFamily: 'monospace',
              flex: 1,
              background: '#0d1311',
            }}
          >
            {botDebugLogs.length === 0 ? (
              <div style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>Chưa có sự kiện bot nào</div>
            ) : (
              botDebugLogs.map((log, idx) => (
                <div
                  key={idx}
                  style={{
                    marginBottom: 6,
                    paddingBottom: 6,
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <span style={{ color: '#d97706' }}>[{log.timestamp}]</span>{' '}
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
    </div>
  );

  return createPortal(drawerContent, document.body);
}
