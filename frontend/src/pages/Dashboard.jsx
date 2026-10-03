import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target,
  Building2,
  Layers,
  CheckCircle2,
  Clock3,
  TrendingUp,
  Calendar,
  RefreshCw,
  AlertCircle,
  Search,
  ChevronRight,
  Info,
  ExternalLink,
  Filter,
  Check,
  X,
  LayoutGrid,
  List,
  Sparkles,
  ArrowRight,
  FileText,
  Trophy,
} from 'lucide-react';
import { kpiApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import usePageVisibility from '../hooks/usePageVisibility';
import { getCached, setCached, fetchWithCache, CACHE_KEYS, CACHE_TTL, isDeepEqual } from '../services/cache';

const PERIOD_LABELS = {
  daily: 'Hàng ngày',
  weekly: 'Hàng tuần',
  monthly: 'Hàng tháng',
  quarterly: 'Hàng quý',
  custom: 'Tùy chỉnh',
};

const SOURCE_LABELS = {
  MANUAL: 'Thủ công',
  ADMIN: 'Admin nhập',
  PRODUCTION: 'Sản xuất',
  YOUTUBE: 'YouTube Hub',
  SYSTEM: 'Hệ thống',
  API: 'API tích hợp',
};

function formatNumber(val) {
  const n = Number(val || 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('vi-VN');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const pageVisible = usePageVisibility();

  const cacheKey = CACHE_KEYS.DASHBOARD_KPI_MY_SUMMARY(user?.id);
  const rawCachedKpi = getCached(cacheKey);
  const initialKpiData = rawCachedKpi?.data || rawCachedKpi || { department: null, currentPeriod: null, kpis: [] };

  const [kpiData, setKpiData] = useState(() => initialKpiData);
  const [loading, setLoading] = useState(!rawCachedKpi);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // View & Filter states
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'completed' | 'in_progress' | 'pending'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKpiDetail, setSelectedKpiDetail] = useState(null);

  // Admin Department Preview override
  const [adminDeptOverride, setAdminDeptOverride] = useState(''); // '' | 'CONTENT' | 'EDIT'

  // Fetch KPI Summary
  const fetchKpis = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else if (!rawCachedKpi) setLoading(true);
    setError('');

    try {
      const params = {};
      if (adminDeptOverride) {
        params.departmentCode = adminDeptOverride;
      }

      const res = await kpiApi.getMyKpis(params);
      const data = res?.data || res || { department: null, currentPeriod: null, kpis: [] };

      setKpiData((prev) => (isDeepEqual(prev, data) ? prev : data));
      if (!adminDeptOverride) {
        setCached(cacheKey, data, { ttl: CACHE_TTL.SHORT });
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Không thể tải chỉ tiêu KPI.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [adminDeptOverride, cacheKey, rawCachedKpi]);

  useEffect(() => {
    if (pageVisible) {
      fetchKpis();
    }
  }, [fetchKpis, pageVisible]);

  // Calculations
  const department = kpiData?.department || null;
  const currentPeriod = kpiData?.currentPeriod || kpiData?.period || null;
  const allKpis = useMemo(() => kpiData?.kpis || [], [kpiData]);

  const totalKpis = allKpis.length;
  const completedKpis = useMemo(() => {
    return allKpis.filter((k) => Number(k.progressPct || k.progress || 0) >= 100 || k.status === 'COMPLETED').length;
  }, [allKpis]);

  const inProgressKpis = useMemo(() => {
    return allKpis.filter((k) => {
      const p = Number(k.progressPct || k.progress || 0);
      return p < 100 && k.status !== 'FAILED';
    }).length;
  }, [allKpis]);

  const overallProgress = useMemo(() => {
    if (!totalKpis) return 0;
    const totalPct = allKpis.reduce((sum, k) => {
      const p = Math.min(100, Math.max(0, Number(k.progressPct || k.progress || 0)));
      return sum + p;
    }, 0);
    return Math.round(totalPct / totalKpis);
  }, [allKpis, totalKpis]);

  const departmentCode = department?.code || (user?.department?.toUpperCase().includes('EDIT') ? 'EDIT' : 'CONTENT');

  // Filtered KPIs list
  const filteredKpis = useMemo(() => {
    let list = [...allKpis];

    if (statusFilter === 'completed') {
      list = list.filter((k) => Number(k.progressPct || k.progress || 0) >= 100 || k.status === 'COMPLETED');
    } else if (statusFilter === 'in_progress') {
      list = list.filter((k) => {
        const p = Number(k.progressPct || k.progress || 0);
        return p > 0 && p < 100 && k.status !== 'FAILED';
      });
    } else if (statusFilter === 'pending') {
      list = list.filter((k) => Number(k.progressPct || k.progress || 0) === 0 || k.status === 'PENDING');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (k) =>
          (k.name || '').toLowerCase().includes(q) ||
          (k.code || '').toLowerCase().includes(q) ||
          (k.description || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [allKpis, statusFilter, searchQuery]);

  return (
    <div className="dashboard-page" style={{ paddingBottom: 60 }}>
      {/* ── 1. HEADER SECTION ────────────────────────────────────────────────── */}
      <section className="dashboard-hero" style={{ marginBottom: 20 }}>
        <div>
          <div className="dashboard-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Target size={14} className="text-blue-600" />
            <span>HỆ THỐNG QUẢN TRỊ MỤC TIÊU KPI</span>
          </div>
          <h1 style={{ margin: '4px 0 6px', fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            KPI CỦA BẠN
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: '#64748b' }}>
            Theo dõi kết quả công việc theo bộ phận{' '}
            <strong style={{ color: '#0f172a', fontWeight: 700 }}>
              {department ? department.name : departmentCode}
            </strong>
          </p>
        </div>

        <div className="dashboard-hero-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Department Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              background: departmentCode === 'CONTENT' ? '#eff6ff' : '#fdf2f8',
              border: `1px solid ${departmentCode === 'CONTENT' ? '#bfdbfe' : '#fbcfe8'}`,
              color: departmentCode === 'CONTENT' ? '#1d4ed8' : '#be185d',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.04em',
            }}
          >
            <Building2 size={15} />
            <span>PHÒNG: {departmentCode}</span>
          </div>

          {/* Admin Department Preview Selector */}
          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                value={adminDeptOverride}
                onChange={(e) => setAdminDeptOverride(e.target.value)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '6px 10px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  color: '#334155',
                  cursor: 'pointer',
                  outline: 'none',
                }}
                title="Admin Preview: Chuyển đổi bộ phận để xem KPI"
              >
                <option value="">Xem phòng của tôi</option>
                <option value="CONTENT">Xem phòng CONTENT</option>
                <option value="EDIT">Xem phòng EDIT</option>
              </select>
            </div>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            className="dashboard-refresh-button"
            disabled={refreshing || loading}
            onClick={() => fetchKpis(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
            <span>Làm mới</span>
          </button>

          {/* Admin KPI Management Link */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate('/admin/kpi')}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '7px 14px',
                background: '#0f172a',
                border: 'none',
                color: '#ffffff',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>Quản Lý KPI (Admin)</span>
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </section>

      {/* ── ERROR ALERT ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="dashboard-error" role="alert" style={{ marginBottom: 20 }}>
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => fetchKpis(true)}>Thử lại</button>
        </div>
      )}

      {/* ── UNASSIGNED DEPARTMENT WARNING ────────────────────────────────────── */}
      {!department && !loading && (
        <div
          style={{
            padding: '14px 18px',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 6,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <AlertCircle size={22} color="#b45309" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>
            <strong>Chưa phân bổ phòng ban:</strong> Tài khoản của bạn hiện chưa được liên kết chính thức vào phòng ban{' '}
            <strong>CONTENT</strong> hoặc <strong>EDIT</strong>. Hệ thống đang hiển thị cấu hình mặc định. Vui lòng liên hệ Quản trị viên để được gán phòng ban chính thức.
          </div>
        </div>
      )}

      {/* ── 2. THE 6 MAIN KPI DASHBOARD CARDS ────────────────────────────────── */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 14,
          marginBottom: 24,
        }}
      >
        {/* Card 1: Department */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              BỘ PHẬN
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
              <Building2 size={16} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
              {departmentCode}
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {department ? department.name : 'Đang thiết lập'}
            </div>
          </div>
        </div>

        {/* Card 2: Total KPIs */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              TỔNG KPI
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
              <Layers size={16} />
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
              {totalKpis}
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>
              Chỉ tiêu được giao kỳ này
            </div>
          </div>
        </div>

        {/* Card 3: KPIs Achieved */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              KPI ĐANG ĐẠT
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 800, color: '#059669' }}>
              {completedKpis}
            </div>
            <div style={{ fontSize: 11.5, color: '#059669', marginTop: 3, fontWeight: 600 }}>
              {totalKpis > 0 ? Math.round((completedKpis / totalKpis) * 100) : 0}% đạt mục tiêu
            </div>
          </div>
        </div>

        {/* Card 4: KPIs In Progress */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              KPI ĐANG THỰC HIỆN
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309' }}>
              <Clock3 size={16} />
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 800, color: '#b45309' }}>
              {inProgressKpis}
            </div>
            <div style={{ fontSize: 11.5, color: '#b45309', marginTop: 3 }}>
              Cần tiếp tục hoàn thiện
            </div>
          </div>
        </div>

        {/* Card 5: Overall Progress */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              TIẾN ĐỘ TỔNG
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 800, color: overallProgress >= 100 ? '#059669' : '#0f172a' }}>
                {overallProgress}%
              </span>
              <span style={{ fontSize: 11, color: '#64748b' }}>trung bình</span>
            </div>
            <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, overallProgress)}%`,
                  height: '100%',
                  background: overallProgress >= 100 ? '#10b981' : overallProgress >= 70 ? '#f59e0b' : '#38bdf8',
                  borderRadius: 3,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        </div>

        {/* Card 6: Current Period */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              KỲ HIỆN TẠI
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
              <Calendar size={16} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentPeriod ? currentPeriod.name : 'Tháng 10/2026'}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
              {currentPeriod?.startDate ? `${formatDate(currentPeriod.startDate)} - ${formatDate(currentPeriod.endDate)}` : 'Chu kỳ hiện hành'}
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. KPI DETAILS SECTION (CONTENT / EDIT) ─────────────────────────── */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        {/* Section Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                KPI {departmentCode}
              </h2>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>
                {filteredKpis.length} chỉ tiêu
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748b' }}>
              Chỉ tiêu và tiến độ thực tế theo từng mục tiêu của phòng ban {department ? department.name : departmentCode}
            </p>
          </div>

          {/* Controls: Search, Filter, ViewMode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative', width: 200 }}>
              <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 9 }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm KPI..."
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  fontSize: 12.5,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  color: '#0f172a',
                  outline: 'none',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: 8, top: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '6px 10px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                color: '#334155',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="completed">Đã đạt (≥ 100%)</option>
              <option value="in_progress">Đang thực hiện (&lt; 100%)</option>
              <option value="pending">Chưa bắt đầu (0%)</option>
            </select>

            {/* View Mode Toggle: Table / Cards */}
            <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: 6, padding: 2, border: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 10px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 4,
                  background: viewMode === 'table' ? '#ffffff' : 'transparent',
                  color: viewMode === 'table' ? '#0f172a' : '#64748b',
                  boxShadow: viewMode === 'table' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <List size={13} />
                <span>Bảng</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 10px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 4,
                  background: viewMode === 'cards' ? '#ffffff' : 'transparent',
                  color: viewMode === 'cards' ? '#0f172a' : '#64748b',
                  boxShadow: viewMode === 'cards' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <LayoutGrid size={13} />
                <span>Thẻ</span>
              </button>
            </div>

            {/* Link to Leaderboard */}
            <button
              type="button"
              onClick={() => navigate('/leaderboard?mode=kpi')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              <Trophy size={13} className="text-amber-500" />
              <span>BXH KPI</span>
            </button>
          </div>
        </div>

        {/* ── 4. LOADING STATE ──────────────────────────────────────────────── */}
        {loading && (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <RefreshCw size={24} className="spin" color="#0284c7" style={{ margin: '0 auto 10px' }} />
            <div style={{ fontSize: 13, color: '#64748b' }}>Đang tải danh sách chỉ tiêu KPI từ cơ sở dữ liệu...</div>
          </div>
        )}

        {/* ── 5. EMPTY STATE ────────────────────────────────────────────────── */}
        {!loading && filteredKpis.length === 0 && (
          <div
            style={{
              padding: '48px 20px',
              textAlign: 'center',
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: 6,
            }}
          >
            <Target size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: '#334155' }}>
              {searchQuery || statusFilter !== 'all'
                ? 'Không tìm thấy KPI nào phù hợp với bộ lọc hiện tại'
                : `Chưa có chỉ tiêu KPI nào được thiết lập cho phòng ${department ? department.name : departmentCode}`}
            </div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 6, maxWidth: 460, margin: '6px auto 16px' }}>
              {isAdmin
                ? 'Bạn có thể tạo mới các chỉ tiêu KPI cho phòng ban và gán định mức trong mục Quản Lý KPI.'
                : 'Vui lòng liên hệ Trưởng bộ phận hoặc Quản trị viên để được gán các chỉ tiêu thực hiện trong kỳ này.'}
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/admin/kpi')}
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  padding: '8px 16px',
                  background: '#0f172a',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Cấu Hình Chỉ Tiêu KPI
              </button>
            )}
          </div>
        )}

        {/* ── 6. TABLE VIEW: | KPI | Target | Actual | Progress | Period | Status | ─ */}
        {!loading && filteredKpis.length > 0 && viewMode === 'table' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                  <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Chỉ Tiêu KPI
                  </th>
                  <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>
                    Chỉ Tiêu (Target)
                  </th>
                  <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>
                    Thực Tế (Actual)
                  </th>
                  <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: 160 }}>
                    Tiến Độ (Progress)
                  </th>
                  <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Kỳ Đánh Giá
                  </th>
                  <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>
                    Trạng Thái
                  </th>
                  <th style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>
                    Thao Tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredKpis.map((kpiItem, index) => {
                  const target = Number(kpiItem.target || kpiItem.targetValue || 0);
                  const actual = Number(kpiItem.actual || kpiItem.actualValue || 0);
                  const progressPct = Number(kpiItem.progressPct || kpiItem.progress || (target > 0 ? Math.round((actual / target) * 100) : 0));
                  const isCompleted = progressPct >= 100 || kpiItem.status === 'COMPLETED';
                  const isGood = progressPct >= 70;

                  return (
                    <tr
                      key={kpiItem.id || kpiItem.kpiId || index}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* 1. KPI Name & Code */}
                      <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13.5 }}>
                          {kpiItem.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 10,
                              fontWeight: 600,
                              background: '#e2e8f0',
                              color: '#334155',
                              padding: '1px 5px',
                              borderRadius: 3,
                            }}
                          >
                            {kpiItem.code}
                          </span>
                          {kpiItem.sourceType && (
                            <span style={{ fontSize: 10.5, color: '#64748b' }}>
                              · {SOURCE_LABELS[kpiItem.sourceType] || kpiItem.sourceType}
                            </span>
                          )}
                        </div>
                        {kpiItem.description && (
                          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3, maxWidth: 380, lineHeight: 1.35 }}>
                            {kpiItem.description}
                          </div>
                        )}
                      </td>

                      {/* 2. Target */}
                      <td style={{ padding: '14px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#334155' }}>
                          {formatNumber(target)}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {kpiItem.unit || 'đơn vị'}
                        </div>
                      </td>

                      {/* 3. Actual */}
                      <td style={{ padding: '14px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <div
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 15,
                            fontWeight: 800,
                            color: isCompleted ? '#059669' : isGood ? '#b45309' : '#0f172a',
                          }}
                        >
                          {formatNumber(actual)}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {kpiItem.unit || 'đơn vị'}
                        </div>
                      </td>

                      {/* 4. Progress */}
                      <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 12.5,
                              fontWeight: 800,
                              color: isCompleted ? '#059669' : isGood ? '#b45309' : '#0284c7',
                            }}
                          >
                            {progressPct}%
                          </span>
                        </div>
                        <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, progressPct)}%`,
                              height: '100%',
                              background: isCompleted ? '#10b981' : isGood ? '#f59e0b' : '#38bdf8',
                              borderRadius: 3,
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      </td>

                      {/* 5. Period */}
                      <td style={{ padding: '14px', verticalAlign: 'middle' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                          {PERIOD_LABELS[kpiItem.periodType] || 'Hàng tháng'}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {currentPeriod ? currentPeriod.name : 'Tháng 10/2026'}
                        </div>
                      </td>

                      {/* 6. Status */}
                      <td style={{ padding: '14px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            background: isCompleted ? '#dcfce7' : isGood ? '#fef3c7' : '#f1f5f9',
                            color: isCompleted ? '#15803d' : isGood ? '#b45309' : '#64748b',
                            border: `1px solid ${isCompleted ? '#86efac' : isGood ? '#fde68a' : '#cbd5e1'}`,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isCompleted ? <Check size={12} /> : isGood ? <Clock3 size={12} /> : null}
                          <span>
                            {isCompleted ? 'ĐẠT CHỈ TIÊU' : isGood ? 'TIẾN ĐỘ TỐT' : progressPct > 0 ? 'ĐANG THỰC HIỆN' : 'CHƯA BẮT ĐẦU'}
                          </span>
                        </span>
                      </td>

                      {/* 7. Action */}
                      <td style={{ padding: '14px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedKpiDetail(kpiItem)}
                          style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            padding: '4px 10px',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: 4,
                            color: '#334155',
                            cursor: 'pointer',
                          }}
                        >
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 7. CARD VIEW (Responsive Grid) ─────────────────────────────────── */}
        {!loading && filteredKpis.length > 0 && viewMode === 'cards' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {filteredKpis.map((kpiItem, index) => {
              const target = Number(kpiItem.target || kpiItem.targetValue || 0);
              const actual = Number(kpiItem.actual || kpiItem.actualValue || 0);
              const progressPct = Number(kpiItem.progressPct || kpiItem.progress || (target > 0 ? Math.round((actual / target) * 100) : 0));
              const isCompleted = progressPct >= 100 || kpiItem.status === 'COMPLETED';
              const isGood = progressPct >= 70;

              return (
                <div
                  key={kpiItem.id || kpiItem.kpiId || index}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                          {kpiItem.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 10,
                              fontWeight: 600,
                              background: '#e2e8f0',
                              color: '#334155',
                              padding: '1px 5px',
                              borderRadius: 3,
                            }}
                          >
                            {kpiItem.code}
                          </span>
                          <span style={{ fontSize: 11, color: '#64748b' }}>
                            Đơn vị: <strong>{kpiItem.unit || 'đơn vị'}</strong>
                          </span>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: isCompleted ? '#dcfce7' : isGood ? '#fef3c7' : '#f1f5f9',
                          color: isCompleted ? '#15803d' : isGood ? '#b45309' : '#64748b',
                          border: `1px solid ${isCompleted ? '#86efac' : isGood ? '#fde68a' : '#cbd5e1'}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isCompleted ? 'ĐẠT' : isGood ? 'TIẾN ĐỘ TỐT' : 'ĐANG LÀM'}
                      </span>
                    </div>

                    {kpiItem.description && (
                      <p style={{ margin: '0 0 10px', fontSize: 11.5, color: '#64748b', lineHeight: 1.4 }}>
                        {kpiItem.description}
                      </p>
                    )}
                  </div>

                  <div>
                    {/* Numbers: Actual vs Target */}
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Thực tế: </span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 800, color: isCompleted ? '#059669' : '#0f172a' }}>
                          {formatNumber(actual)}
                        </span>
                        <span style={{ fontSize: 11, color: '#64748b', marginLeft: 3 }}>
                          / {formatNumber(target)} {kpiItem.unit}
                        </span>
                      </div>
                      <div
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 13,
                          fontWeight: 800,
                          color: isCompleted ? '#059669' : isGood ? '#b45309' : '#0284c7',
                        }}
                      >
                        {progressPct}%
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: 7, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, progressPct)}%`,
                          height: '100%',
                          background: isCompleted ? '#10b981' : isGood ? '#f59e0b' : '#3b82f6',
                          borderRadius: 4,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 10.5, color: '#94a3b8' }}>
                      <span>Kỳ: {PERIOD_LABELS[kpiItem.periodType] || 'Hàng tháng'}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedKpiDetail(kpiItem)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#0284c7',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Chi tiết →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Informational footer note */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 12,
            borderTop: '1px solid #f1f5f9',
            fontSize: 11.5,
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Info size={14} style={{ flexShrink: 0 }} />
          <span>
            Hệ thống WorkRank KPI đánh giá độc lập dựa trên sản lượng và mục tiêu công việc phòng ban (CONTENT & EDIT), hoàn toàn không thu thập thao tác máy tính. Quy tắc tính điểm và thi đua giải đấu sẽ được kết nối ở giai đoạn sau.
          </span>
        </div>
      </div>

      {/* ── 8. KPI DETAIL MODAL ──────────────────────────────────────────────── */}
      {selectedKpiDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setSelectedKpiDetail(null)}
        >
          <div
            style={{
              width: 'min(520px, 100%)',
              background: '#ffffff',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Target size={18} className="text-blue-600" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  Chi Tiết Chỉ Tiêu KPI
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedKpiDetail(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
                  {selectedKpiDetail.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      fontWeight: 700,
                      background: '#e2e8f0',
                      color: '#1e293b',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    {selectedKpiDetail.code}
                  </span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    Bộ phận: <strong>{departmentCode}</strong>
                  </span>
                </div>
              </div>

              {selectedKpiDetail.description && (
                <div style={{ padding: 12, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12.5, color: '#475569', lineHeight: 1.5, marginBottom: 16 }}>
                  {selectedKpiDetail.description}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ padding: 12, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>CHỈ TIÊU (TARGET)</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                    {formatNumber(selectedKpiDetail.target || selectedKpiDetail.targetValue)} {selectedKpiDetail.unit}
                  </div>
                </div>

                <div style={{ padding: 12, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>THỰC TẾ (ACTUAL)</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 800, color: '#059669', marginTop: 2 }}>
                    {formatNumber(selectedKpiDetail.actual || selectedKpiDetail.actualValue)} {selectedKpiDetail.unit}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 12, color: '#475569' }}>
                <div>
                  <span style={{ color: '#94a3b8' }}>Kỳ đánh giá:</span>{' '}
                  <strong>{PERIOD_LABELS[selectedKpiDetail.periodType] || 'Hàng tháng'}</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Nguồn dữ liệu:</span>{' '}
                  <strong>{SOURCE_LABELS[selectedKpiDetail.sourceType] || selectedKpiDetail.sourceType || 'Thủ công'}</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Chu kỳ:</span>{' '}
                  <strong>{currentPeriod ? currentPeriod.name : 'Tháng 10/2026'}</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>Trạng thái:</span>{' '}
                  <strong style={{ color: Number(selectedKpiDetail.progressPct || selectedKpiDetail.progress || 0) >= 100 ? '#059669' : '#0f172a' }}>
                    {selectedKpiDetail.status || 'ĐANG THỰC HIỆN'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSelectedKpiDetail(null)}
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: '6px 14px',
                  background: '#0f172a',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
