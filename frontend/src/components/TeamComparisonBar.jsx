import React from 'react';
import { Users, Eye, ChevronRight, Trophy } from 'lucide-react';

function formatNumber(n) {
  const num = Number(n || 0);
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return num.toLocaleString();
}

export default function TeamComparisonBar({
  teams = [],
  metric = 'views', // 'views' | 'subscribers'
  onSelectTeam = null,
  limit = 5,
}) {
  const sorted = [...teams]
    .sort((a, b) => {
      const aVal = metric === 'views' ? Number(a.totalViews || 0) : Number(a.totalSubscribers || 0);
      const bVal = metric === 'views' ? Number(b.totalViews || 0) : Number(b.totalSubscribers || 0);
      return bVal - aVal;
    })
    .slice(0, limit);

  const maxVal = sorted.length > 0
    ? Math.max(1, metric === 'views' ? Number(sorted[0].totalViews || 0) : Number(sorted[0].totalSubscribers || 0))
    : 1;

  if (sorted.length === 0) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: 13, background: '#fafafa', border: '1px dashed #cbd5e1' }}>
        Chưa có dữ liệu đội nhóm để so sánh
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sorted.map((t, idx) => {
        const val = metric === 'views' ? Number(t.totalViews || 0) : Number(t.totalSubscribers || 0);
        const pct = Math.max(4, Math.round((val / maxVal) * 100));
        const rank = idx + 1;

        return (
          <div
            key={t.teamId || idx}
            onClick={() => onSelectTeam && onSelectTeam(t.teamId)}
            style={{
              padding: '10px 14px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              cursor: onSelectTeam ? 'pointer' : 'default',
              transition: 'background 0.15s ease, border-color 0.15s ease',
            }}
            className="team-compare-row"
          >
            {/* Header: Rank, Team Name, Channels Count, Total Val */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    background: rank === 1 ? '#fef3c7' : rank === 2 ? '#f1f5f9' : '#f8fafc',
                    color: rank === 1 ? '#b45309' : rank === 2 ? '#475569' : '#64748b',
                    border: `1px solid ${rank === 1 ? '#fde68a' : '#e2e8f0'}`,
                  }}
                >
                  {rank}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                  {t.teamName || `Đội ${t.teamId}`}
                </span>
                <span style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', padding: '1px 6px' }}>
                  {t.channelsCount || 0} kênh
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                  {formatNumber(val)}
                </span>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  {metric === 'views' ? 'views' : 'subs'}
                </span>
                {onSelectTeam && <ChevronRight size={13} color="#94a3b8" />}
              </div>
            </div>

            {/* Horizontal Bar */}
            <div style={{ width: '100%', height: 6, background: '#f1f5f9', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: rank === 1 ? '#b45309' : '#0f172a',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
