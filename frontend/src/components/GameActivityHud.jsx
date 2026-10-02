import React, { useState } from 'react';
import { Activity, MousePointerClick, Keyboard, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { useActivityStats } from '../hooks/useActivityTracker';

/**
 * GameActivityHud:
 * Non-intrusive floating HUD widget rendered inside fullscreen game surfaces.
 * Confirms real-time tracking of gameplay clicks and keystrokes.
 * Pure telemetry — completely isolated from game scores and without anti-cheat restrictions.
 */
export default function GameActivityHud({ position = 'bottom-right' }) {
  const { clicks, keyboard, mouseTrackingEnabled, keyboardTrackingEnabled } = useActivityStats();
  const [minimized, setMinimized] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const isTracking = mouseTrackingEnabled || keyboardTrackingEnabled;

  const positionStyles = {
    position: 'fixed',
    zIndex: 9999,
    ...(position === 'bottom-right'
      ? { bottom: 16, right: 16 }
      : position === 'top-right'
      ? { top: 16, right: 16 }
      : { bottom: 16, left: 16 }),
  };

  if (minimized) {
    return (
      <div style={positionStyles}>
        <button
          type="button"
          onClick={() => setMinimized(false)}
          title={`Activity Telemetry: ${clicks} clicks, ${keyboard} keys (Nhấn để mở)`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 20,
            color: '#f8fafc',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: isTracking ? '#22c55e' : '#94a3b8',
              boxShadow: isTracking ? '0 0 6px #22c55e' : 'none',
            }}
          />
          <Activity size={12} color="#38bdf8" />
          <span>{clicks}c</span>
          <span style={{ opacity: 0.5 }}>|</span>
          <span>{keyboard}k</span>
        </button>
      </div>
    );
  }

  return (
    <div style={positionStyles}>
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          padding: '8px 12px',
          color: '#f8fafc',
          fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
          maxWidth: 260,
          transition: 'all 0.2s ease',
        }}
      >
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: isTracking ? '#22c55e' : '#94a3b8',
                boxShadow: isTracking ? '0 0 6px #22c55e' : 'none',
              }}
            />
            <Activity size={13} color="#38bdf8" />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', color: '#e2e8f0' }}>
              ACTIVITY TELEMETRY
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              onClick={() => setShowInfo((prev) => !prev)}
              title="Thông tin chi tiết"
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: 10,
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: 4,
              }}
            >
              {showInfo ? 'Ẩn' : 'Info'}
            </button>
            <button
              type="button"
              onClick={() => setMinimized(true)}
              title="Thu nhỏ widget"
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '2px 4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ChevronDown size={14} />
            </button>
          </div>
        </div>

        {/* Live Counters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(255, 255, 255, 0.06)',
              padding: '4px 8px',
              borderRadius: 4,
            }}
          >
            <MousePointerClick size={13} color="#38bdf8" />
            <span style={{ color: '#94a3b8', fontSize: 11 }}>Clicks:</span>
            <strong style={{ color: '#ffffff', fontWeight: 700 }}>{clicks}</strong>
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(255, 255, 255, 0.06)',
              padding: '4px 8px',
              borderRadius: 4,
            }}
          >
            <Keyboard size={13} color="#38bdf8" />
            <span style={{ color: '#94a3b8', fontSize: 11 }}>Phím:</span>
            <strong style={{ color: '#ffffff', fontWeight: 700 }}>{keyboard}</strong>
          </div>
        </div>

        {/* Explanatory Info dropdown */}
        {showInfo && (
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: 10,
              color: '#94a3b8',
              lineHeight: 1.45,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#38bdf8', marginBottom: 3, fontWeight: 600 }}>
              <ShieldCheck size={12} />
              <span>Ghi nhận tương tác trong game</span>
            </div>
            Tự do thao tác chuột và phím điều khiển. Hệ thống thuần túy ghi nhận số lượng — Không anti-cheat, không giới hạn tốc độ và không ảnh hưởng điểm số trận đấu.
          </div>
        )}
      </div>
    </div>
  );
}
