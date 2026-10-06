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
      <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, background: '#fafafa', border: '1px dashed var(--border-2)' }}>
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
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              cursor: onSelectTeam ? 'pointer' : 'default',
              transition: 'background var(--motion-fast) var(--ease-standard), border-color var(--motion-fast) var(--ease-standard)',
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
                    background: rank === 1 ? '#fef3c7' : rank === 2 ? 'var(--surface-muted)' : 'var(--surface-soft)',
                    color: rank === 1 ? 'var(--accent)' : rank === 2 ? 'var(--text-secondary)' : 'var(--text-secondary)',
                    border: `1px solid ${rank === 1 ? '#fde68a' : 'var(--border)'}`,
                  }}
                >
                  {rank}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {t.teamName || `Đội ${t.teamId}`}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--surface-muted)', padding: '1px 6px' }}>
                  {t.channelsCount || 0} kênh
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatNumber(val)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {metric === 'views' ? 'views' : 'subs'}
                </span>
                {onSelectTeam && <ChevronRight size={13} color="var(--text-muted)" />}
              </div>
            </div>

            {/* Horizontal Bar */}
            <div style={{ width: '100%', height: 6, background: 'var(--surface-muted)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: rank === 1 ? 'var(--accent)' : 'var(--text-primary)',
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
