import React, { useState, useRef, useEffect } from 'react';
import { Activity, MousePointerClick, Keyboard, CheckCircle, Settings, ShieldAlert, Sparkles, X } from 'lucide-react';
import { useActivityStats } from '../hooks/useActivityTracker';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

/**
 * ActivityTelemetryIndicator:
 * Displays real-time activity telemetry (Clicks & Keyboard actions) on the web header.
 * Pure telemetry indicator — completely transparent, no anti-cheat, no privacy intrusion.
 */
export default function ActivityTelemetryIndicator() {
  const { clicks, keyboard, mouseTrackingEnabled, keyboardTrackingEnabled } = useActivityStats();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const isTracking = mouseTrackingEnabled || keyboardTrackingEnabled;

  return (
    <div ref={popoverRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title="Activity Telemetry: Thống kê tương tác trực tiếp"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          background: open ? 'rgba(15,23,42,0.08)' : 'rgba(15,23,42,0.03)',
          border: '1px solid rgba(15,23,42,0.1)',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 500,
          color: '#334155',
          cursor: 'pointer',
          fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
          transition: 'all 0.15s ease',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: isTracking ? '#16a34a' : '#94a3b8',
            boxShadow: isTracking ? '0 0 0 2px rgba(22,163,74,0.2)' : 'none',
            display: 'inline-block',
          }}
        />
        <Activity size={14} color="#0284c7" />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <MousePointerClick size={12} color="#64748b" />
          <strong style={{ fontWeight: 600, color: '#0f172a' }}>{clicks}</strong>
        </span>
        <span style={{ color: '#cbd5e1', fontSize: 11 }}>•</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Keyboard size={12} color="#64748b" />
          <strong style={{ fontWeight: 600, color: '#0f172a' }}>{keyboard}</strong>
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 290,
            background: '#ffffff',
            border: '1px solid rgba(15,23,42,0.14)',
            borderRadius: 8,
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            padding: 14,
            zIndex: 1000,
            fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={15} color="#0284c7" />
              <strong style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>Activity Telemetry</strong>
            </div>
            <span
              style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 4,
                background: isTracking ? 'rgba(22,163,74,0.1)' : 'rgba(148,163,184,0.1)',
                color: isTracking ? '#15803d' : '#64748b',
                fontWeight: 600,
              }}
            >
              {isTracking ? 'ĐANG THEO DÕI' : 'TẠM TẮT'}
            </span>
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                <MousePointerClick size={12} color="#0284c7" />
                <span>Mouse Clicks</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{clicks}</div>
              <div style={{ fontSize: 10, color: mouseTrackingEnabled ? '#16a34a' : '#94a3b8' }}>
                {mouseTrackingEnabled ? 'Hoạt động' : 'Đã tắt'}
              </div>
            </div>

            <div style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                <Keyboard size={12} color="#0284c7" />
                <span>Bàn phím</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{keyboard}</div>
              <div style={{ fontSize: 10, color: keyboardTrackingEnabled ? '#16a34a' : '#94a3b8' }}>
                {keyboardTrackingEnabled ? 'Hoạt động' : 'Đã tắt'}
              </div>
            </div>
          </div>

          {/* Transparency note */}
          <div style={{ background: '#f1f5f9', borderRadius: 6, padding: '8px 10px', fontSize: 11, color: '#475569', lineHeight: 1.45, marginBottom: 10 }}>
            <strong style={{ color: '#0f172a', display: 'block', marginBottom: 2 }}>Thuần túy đo lường tương tác:</strong>
            Hệ thống chỉ đếm số lượng click và thao tác phím. Tuyệt đối không lưu ký tự gõ, không anti-cheat, không can thiệp trải nghiệm.
          </div>

          {/* Admin link */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/settings');
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '6px 10px',
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Settings size={12} />
              Quản lý Cài Đặt Tracking
            </button>
          )}
        </div>
      )}
    </div>
  );
}
