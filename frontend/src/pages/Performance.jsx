import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, BarChart3, Clock3, Keyboard, RefreshCw, Target } from 'lucide-react';
import { activity } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button, EmptyState, Notice, PageHeader, PageShell, Section, SegmentedControl, StatCard } from '../components/ui';

const RANGES = [
  { key: 'week', label: 'Theo tuần', limit: 8 },
  { key: 'month', label: 'Theo tháng', limit: 6 },
];

function formatNum(value) {
  const n = Number(value) || 0;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return n.toLocaleString('vi-VN');
}

function formatDuration(seconds) {
  const safe = Number(seconds) || 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours >= 24) return `${Math.floor(hours / 24)} ngày ${hours % 24} giờ`;
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  return `${minutes} phút`;
}

function periodLabel(row, range) {
  if (range === 'month') {
    const [year, month] = String(row.period || row.periodStart || '').split('-');
    return month && year ? `Tháng ${Number(month)}/${year}` : 'Không rõ';
  }
  const start = row.periodStart || row.period_start;
  const end = row.periodEnd || row.period_end;
  if (!start || !end) return 'Không rõ';
  return `${start.slice(8, 10)}/${start.slice(5, 7)} - ${end.slice(8, 10)}/${end.slice(5, 7)}`;
}

function metricValue(row, key) {
  return Number(row?.[key] ?? row?.[key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)] ?? 0);
}

export default function Performance() {
  const { user } = useAuth();
  const [range, setRange] = useState('week');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = async (options = {}) => {
    if (!user?.id) return;
    const background = options.background === true;
    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const config = RANGES.find((item) => item.key === range) || RANGES[0];
      const res = range === 'month'
        ? await activity.monthly(user.id, config.limit)
        : await activity.weekly(user.id, config.limit);
      setRows(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không tải được dữ liệu hiệu suất');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [range, user?.id]);

  const summary = useMemo(() => rows.reduce((acc, row) => {
    const activeSeconds = metricValue(row, 'activeSeconds');
    const actions = metricValue(row, 'totalActions') || metricValue(row, 'keystrokeCount') + metricValue(row, 'mouseClickCount');
    const sessions = metricValue(row, 'sessionCount');
    const focusScore = metricValue(row, 'focusScore');
    const weight = activeSeconds > 0 ? activeSeconds : 1;
    acc.activeSeconds += activeSeconds;
    acc.actions += actions;
    acc.sessions += sessions;
    acc.focusWeighted += focusScore * weight;
    acc.focusWeight += weight;
    return acc;
  }, { activeSeconds: 0, actions: 0, sessions: 0, focusWeighted: 0, focusWeight: 0 }), [rows]);

  const focusAverage = summary.focusWeight ? Math.round(summary.focusWeighted / summary.focusWeight) : 0;
  const chartRows = [...rows].reverse();
  const maxActions = Math.max(1, ...chartRows.map((row) => metricValue(row, 'totalActions') || metricValue(row, 'keystrokeCount') + metricValue(row, 'mouseClickCount')));

  return (
    <PageShell className="performance-page" narrow mono>
      <PageHeader
        icon={BarChart3}
        eyebrow="Performance"
        title="Phân tích hiệu suất"
        description="Tổng hợp từ dữ liệu ngày, không đọc raw event nên nhẹ hơn khi dữ liệu lớn."
        actions={(
          <>
            <SegmentedControl
              ariaLabel="Khoảng phân tích hiệu suất"
              options={RANGES}
              value={range}
              onChange={setRange}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => loadData({ background: true })}
              disabled={loading || refreshing}
            >
              <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
              Làm mới
            </Button>
          </>
        )}
      />

      {error && (
        <Notice type="error" icon={AlertCircle}>
          {error}
        </Notice>
      )}

      <section className="ui-stat-grid">
        <StatCard icon={Clock3} label="Active" value={loading ? '...' : formatDuration(summary.activeSeconds)} detail={`${rows.length} kỳ gần nhất`} color="#16a34a" />
        <StatCard icon={Activity} label="Thao tác" value={loading ? '...' : formatNum(summary.actions)} detail="Gõ phím + click" color="#38bdf8" />
        <StatCard icon={Target} label="Focus score" value={loading ? '...' : focusAverage.toLocaleString('vi-VN')} detail="Trung bình có trọng số" color="#7c3aed" />
        <StatCard icon={Keyboard} label="Phiên" value={loading ? '...' : formatNum(summary.sessions)} detail="Tổng số phiên làm việc" color="#ea580c" />
      </section>

      <Section
        title="Xu hướng thao tác"
        description="Bar càng cao nghĩa là tổng thao tác càng nhiều trong kỳ đó."
      >
        {loading ? (
          <EmptyState compact icon={BarChart3} title="Đang tải dữ liệu hiệu suất..." />
        ) : chartRows.length === 0 ? (
          <EmptyState compact icon={BarChart3} title="Chưa có dữ liệu cho khoảng thời gian này." />
        ) : (
          <div className="performance-bar-chart" style={{ '--bar-count': chartRows.length }}>
            {chartRows.map((row) => {
              const actions = metricValue(row, 'totalActions') || metricValue(row, 'keystrokeCount') + metricValue(row, 'mouseClickCount');
              const height = Math.max(8, Math.round((actions / maxActions) * 150));
              return (
                <div key={row.period} className="performance-bar-item">
                  <div className="performance-bar-value">{formatNum(actions)}</div>
                  <div className="performance-bar-track">
                    <span className="performance-bar-fill" style={{ height }} />
                  </div>
                  <div className="performance-bar-label">{periodLabel(row, range)}</div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Chi tiết kỳ" className="ui-section--flush">
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                {['Kỳ', 'Active', 'Gõ phím', 'Click', 'Focus', 'Phiên'].map((heading) => (
                  <th key={heading} className={heading === 'Kỳ' ? '' : 'is-number'}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState compact icon={BarChart3} title="Chưa có dữ liệu chi tiết." />
                  </td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.period}>
                  <td className="is-strong">{periodLabel(row, range)}</td>
                  <td className="is-number">{formatDuration(metricValue(row, 'activeSeconds'))}</td>
                  <td className="is-number">{formatNum(metricValue(row, 'keystrokeCount'))}</td>
                  <td className="is-number">{formatNum(metricValue(row, 'mouseClickCount'))}</td>
                  <td className="is-number">{metricValue(row, 'focusScore').toLocaleString('vi-VN')}</td>
                  <td className="is-number">{formatNum(metricValue(row, 'sessionCount'))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </PageShell>
  );
}
