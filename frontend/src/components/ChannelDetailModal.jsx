import React, { useState, useEffect } from 'react';
import { X, ExternalLink, RefreshCw, Tv, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { youtube } from '../services/api';
import YouTubeTrendChart from './YouTubeTrendChart';

function formatNum(value) {
  const n = Number(value) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toLocaleString();
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return 'Chưa đồng bộ';
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

export default function ChannelDetailModal({ channelId, isOpen, onClose }) {
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    if (!isOpen || !channelId) return;

    let isMounted = true;
    setLoading(true);
    setError('');

    youtube.getChannelDetails(channelId, { period })
      .then((data) => {
        if (isMounted) setChannel(data);
      })
      .catch((err) => {
        if (isMounted) setError(err?.response?.data?.message || 'Không thể tải chi tiết kênh');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [channelId, isOpen, period]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const youtubeUrl = channel?.customUrl
    ? `https://youtube.com/${channel.customUrl.startsWith('@') ? channel.customUrl : '@' + channel.customUrl}`
    : channel?.channelId
    ? `https://youtube.com/channel/${channel.channelId}`
    : null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          width: '100%',
          maxWidth: 820,
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid #cbd5e1',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {channel?.thumbnailUrl ? (
              <img
                src={channel.thumbnailUrl}
                alt={channel.title}
                style={{ width: 44, height: 44, borderRadius: 22, objectFit: 'cover', border: '1px solid #cbd5e1' }}
              />
            ) : (
              <div
                style={{
                  width: 44,
                  height: 44,
                  background: '#fee2e2',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Tv size={22} />
              </div>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  {channel?.title || 'Chi tiết kênh YouTube'}
                </h3>
                {channel?.team?.name ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      background: '#e0e7ff',
                      color: '#4338ca',
                      padding: '2px 8px',
                      border: '1px solid #c7d2fe',
                    }}
                  >
                    {channel.team.name}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      background: '#fef3c7',
                      color: '#b45309',
                      padding: '2px 8px',
                      border: '1px solid #fde68a',
                    }}
                  >
                    Chưa gán đội
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                {channel?.customUrl || channel?.channelId || 'ID: —'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {youtubeUrl && (
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  textDecoration: 'none',
                }}
              >
                <span>Mở YouTube</span>
                <ExternalLink size={13} />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 6,
                cursor: 'pointer',
                color: '#64748b',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '20px' }}>
          {loading ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
              <RefreshCw size={24} className="spin" style={{ marginBottom: 12 }} />
              <div>Đang tải dữ liệu lịch sử kênh...</div>
            </div>
          ) : error ? (
            <div style={{ padding: '20px', background: '#fef2f2', color: '#991b1b', fontSize: 13, border: '1px solid #fecaca' }}>
              {error}
            </div>
          ) : channel ? (
            <div>
              {/* Metric Cards Row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>TỔNG LƯỢT XEM</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                    {formatNum(channel.views)}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>SUBSCRIBERS</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                    {formatNum(channel.subscribers)}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>TĂNG TRƯỞNG KỲ</div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 20,
                      fontWeight: 700,
                      color: channel.viewsGrowthPct !== null ? (channel.viewsGrowthPct >= 0 ? '#10b981' : '#ef4444') : '#64748b',
                      marginTop: 4,
                    }}
                  >
                    {channel.viewsGrowthPct !== null ? `${channel.viewsGrowthPct >= 0 ? '+' : ''}${Number(channel.viewsGrowthPct).toFixed(1)}%` : 'Chưa đủ dữ liệu'}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>ĐỒNG BỘ GẦN NHẤT</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={14} color="#64748b" />
                    <span>{formatRelativeTime(channel.lastSyncedAt)}</span>
                  </div>
                </div>
              </div>

              {/* Trend Chart */}
              <div style={{ marginBottom: 16 }}>
                <YouTubeTrendChart
                  data={channel.history || []}
                  period={period}
                  onPeriodChange={(newPeriod) => setPeriod(newPeriod)}
                  title={`Tăng trưởng kênh: ${channel.title}`}
                />
              </div>

              {/* Description & Metadata */}
              {channel.description && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 14px', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>Mô tả kênh:</div>
                  <div style={{ maxHeight: 80, overflowY: 'auto' }}>{channel.description}</div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
