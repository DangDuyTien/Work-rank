import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Target,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  ArrowUpRight,
  TrendingUp,
  History,
  Check,
  X,
  ChevronRight,
  BarChart3,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import { kpiApi, users as usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import VerifiedBadge from '../components/VerifiedBadge';

const PERIOD_TYPE_LABELS = {
  daily: 'Hàng ngày',
  weekly: 'Hàng tuần',
  monthly: 'Hàng tháng',
  quarterly: 'Hàng quý',
  custom: 'Tùy chỉnh',
};

const SOURCE_TYPE_LABELS = {
  manual: 'Thủ công',
  admin: 'Admin nhập',
  production: 'Sản xuất',
  youtube: 'YouTube Hub',
  system: 'Hệ thống',
  api: 'API tích hợp',
};

export default function AdminKpi() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('kpis'); // 'kpis' | 'departments' | 'results' | 'history'

  // Data states
  const [departments, setDepartments] = useState([]);
  const [definitions, setDefinitions] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState([]);
  const [usersList, setUsersList] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [filterDept, setFilterDept] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isKpiModalOpen, setIsKpiModalOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState(null);
  const [kpiFormData, setKpiFormData] = useState({
    departmentId: '',
    name: '',
    code: '',
    description: '',
    unit: 'video',
    target: 0,
    periodType: 'monthly',
    sourceType: 'manual',
    active: true,
  });

  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptFormData, setDeptFormData] = useState({
    name: '',
    code: '',
    description: '',
    active: true,
  });

  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [resultFormData, setResultFormData] = useState({
    userId: '',
    departmentId: '',
    kpiId: '',
    periodId: '',
    actualValue: 0,
    targetValue: 0,
    status: 'IN_PROGRESS',
    source: 'admin',
    notes: '',
  });

  // Load initial data
  const loadAllData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const [deptRes, defsRes, periodsRes, usersRes] = await Promise.all([
        kpiApi.getDepartments().catch(() => ({ data: [] })),
        kpiApi.getDefinitions().catch(() => ({ data: [] })),
        kpiApi.getPeriods().catch(() => ({ data: [] })),
        usersApi.list({ limit: 200 }).catch(() => ({ data: [] })),
      ]);

      const depts = deptRes?.data || [];
      const defs = defsRes?.data || [];
      const pers = periodsRes?.data || [];
      const usrs = usersRes?.data || [];

      setDepartments(depts);
      setDefinitions(defs);
      setPeriods(pers);
      setUsersList(usrs);

      // Default selected period
      if (pers.length > 0 && !filterPeriod) {
        const activePer = pers.find((p) => p.status === 'ACTIVE') || pers[0];
        setFilterPeriod(String(activePer.id));
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterPeriod]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Load results when filters change or tab is 'results'
  const loadResults = useCallback(async () => {
    try {
      const params = {};
      if (filterDept) params.departmentId = filterDept;
      if (filterPeriod) params.periodId = filterPeriod;
      if (filterUser) params.userId = filterUser;

      const res = await kpiApi.getResults(params);
      setResults(res?.data || []);
    } catch (err) {
      console.error('Error loading KPI results:', err);
    }
  }, [filterDept, filterPeriod, filterUser]);

  // Load history when tab is 'history'
  const loadHistory = useCallback(async () => {
    try {
      const res = await kpiApi.getResultHistory({ limit: 50 });
      setHistory(res?.data || []);
    } catch (err) {
      console.error('Error loading KPI history:', err);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'results') {
      loadResults();
    } else if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadResults, loadHistory]);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // KPI Actions
  const handleOpenCreateKpi = () => {
    setEditingKpi(null);
    setKpiFormData({
      departmentId: departments[0]?.id ? String(departments[0].id) : '',
      name: '',
      code: '',
      description: '',
      unit: 'video',
      target: 10,
      periodType: 'monthly',
      sourceType: 'manual',
      active: true,
    });
    setIsKpiModalOpen(true);
  };

  const handleOpenEditKpi = (kpi) => {
    setEditingKpi(kpi);
    setKpiFormData({
      departmentId: String(kpi.departmentId),
      name: kpi.name,
      code: kpi.code,
      description: kpi.description || '',
      unit: kpi.unit || '',
      target: kpi.target || 0,
      periodType: kpi.periodType || 'monthly',
      sourceType: kpi.sourceType || 'manual',
      active: kpi.active !== false,
    });
    setIsKpiModalOpen(true);
  };

  const handleSaveKpi = async (e) => {
    e.preventDefault();
    try {
      if (editingKpi) {
        await kpiApi.updateDefinition(editingKpi.id, kpiFormData);
        showSuccess('Cập nhật chỉ tiêu KPI thành công!');
      } else {
        await kpiApi.createDefinition(kpiFormData);
        showSuccess('Tạo chỉ tiêu KPI mới thành công!');
      }
      setIsKpiModalOpen(false);
      const res = await kpiApi.getDefinitions();
      setDefinitions(res?.data || []);
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Lỗi khi lưu KPI');
    }
  };

  const handleToggleKpi = async (kpi) => {
    try {
      await kpiApi.toggleDefinition(kpi.id);
      setDefinitions((prev) =>
        prev.map((item) => (item.id === kpi.id ? { ...item, active: !item.active } : item))
      );
      showSuccess(`Đã ${kpi.active ? 'tắt' : 'bật'} KPI ${kpi.name}!`);
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Lỗi khi cập nhật trạng thái');
    }
  };

  const handleDeleteKpi = async (kpi) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa chỉ tiêu KPI "${kpi.name}"?`)) return;
    try {
      await kpiApi.deleteDefinition(kpi.id);
      setDefinitions((prev) => prev.filter((item) => item.id !== kpi.id));
      showSuccess('Đã xóa chỉ tiêu KPI thành công!');
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Lỗi khi xóa KPI');
    }
  };

  // Department Actions
  const handleOpenCreateDept = () => {
    setEditingDept(null);
    setDeptFormData({
      name: '',
      code: '',
      description: '',
      active: true,
    });
    setIsDeptModalOpen(true);
  };

  const handleOpenEditDept = (dept) => {
    setEditingDept(dept);
    setDeptFormData({
      name: dept.name,
      code: dept.code,
      description: dept.description || '',
      active: dept.active !== false,
    });
    setIsDeptModalOpen(true);
  };

  const handleSaveDept = async (e) => {
    e.preventDefault();
    try {
      if (editingDept) {
        await kpiApi.updateDepartment(editingDept.id, deptFormData);
        showSuccess('Cập nhật phòng ban thành công!');
      } else {
        await kpiApi.createDepartment(deptFormData);
        showSuccess('Thêm phòng ban mới thành công!');
      }
      setIsDeptModalOpen(false);
      const res = await kpiApi.getDepartments();
      setDepartments(res?.data || []);
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Lỗi khi lưu phòng ban');
    }
  };

  // Result Actions
  const handleOpenRecordResult = (existingResult = null) => {
    if (existingResult) {
      setResultFormData({
        userId: String(existingResult.userId),
        departmentId: String(existingResult.departmentId),
        kpiId: String(existingResult.kpiId),
        periodId: String(existingResult.periodId),
        actualValue: existingResult.actualValue || 0,
        targetValue: existingResult.targetValue || 0,
        status: existingResult.status || 'IN_PROGRESS',
        source: existingResult.source || 'admin',
        notes: '',
      });
    } else {
      setResultFormData({
        userId: usersList[0]?.id ? String(usersList[0].id) : '',
        departmentId: departments[0]?.id ? String(departments[0].id) : '',
        kpiId: definitions[0]?.id ? String(definitions[0].id) : '',
        periodId: periods[0]?.id ? String(periods[0].id) : '',
        actualValue: 0,
        targetValue: definitions[0]?.target || 0,
        status: 'IN_PROGRESS',
        source: 'admin',
        notes: '',
      });
    }
    setIsResultModalOpen(true);
  };

  const handleSaveResult = async (e) => {
    e.preventDefault();
    try {
      await kpiApi.recordResult(resultFormData);
      showSuccess('Ghi nhận kết quả KPI thành công!');
      setIsResultModalOpen(false);
      loadResults();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Lỗi khi lưu kết quả KPI');
    }
  };

  // Filtered definitions
  const filteredDefinitions = useMemo(() => {
    return definitions.filter((d) => {
      if (filterDept && String(d.departmentId) !== String(filterDept)) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (
          d.name.toLowerCase().includes(q) ||
          d.code.toLowerCase().includes(q) ||
          (d.description && d.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [definitions, filterDept, searchTerm]);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px', minHeight: '80vh' }}>
      {/* PAGE HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            <Target size={14} />
            WorkRank KPI Foundation
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
            Quản Lý Phòng Ban & Chỉ Tiêu KPI
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            Cấu hình danh mục KPI cho CONTENT & EDIT, thiết lập mục tiêu và ghi nhận kết quả thực tế.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => loadAllData(true)}
            disabled={refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: 12.5,
              fontWeight: 600,
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            Làm mới
          </button>
        </div>
      </div>

      {/* SUCCESS / ERROR ALERTS */}
      {successMsg && (
        <div style={{ padding: '10px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: 4, marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} color="#059669" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div style={{ padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 4, marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} color="#dc2626" />
          <span>{error}</span>
        </div>
      )}

      {/* NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        {[
          { id: 'kpis', label: 'Quản Lý KPI', icon: Target, count: definitions.length },
          { id: 'departments', label: 'Phòng Ban', icon: Building2, count: departments.length },
          { id: 'results', label: 'Kết Quả & Tiến Độ', icon: BarChart3, count: results.length },
          { id: 'history', label: 'Nhật Ký & Lịch Sử', icon: History, count: history.length },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const IconComp = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                border: 'none',
                borderBottom: isActive ? '2px solid #059669' : '2px solid transparent',
                background: 'transparent',
                color: isActive ? '#059669' : '#64748b',
                fontSize: 13.5,
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <IconComp size={16} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  background: isActive ? '#ecfdf5' : '#f1f5f9',
                  color: isActive ? '#059669' : '#64748b',
                  padding: '1px 6px',
                  borderRadius: 10,
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: KPI DEFINITIONS                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'kpis' && (
        <div>
          {/* Controls Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Department Filter */}
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 4,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: '#334155',
                }}
              >
                <option value="">Tất cả phòng ban</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>

              {/* Search */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Tìm kiếm chỉ tiêu KPI..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: '7px 12px 7px 30px',
                    borderRadius: 4,
                    border: '1px solid #cbd5e1',
                    fontSize: 12.5,
                    width: 220,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateKpi}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                borderRadius: 4,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Plus size={15} />
              Thêm Chỉ Tiêu KPI
            </button>
          </div>

          {/* KPI List Table */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Mã & Tên KPI</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Phòng Ban</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Mục Tiêu Mặc Định</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Chu Kỳ</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Nguồn Dữ Liệu</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Trạng Thái</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredDefinitions.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                      <Target size={36} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
                      <div style={{ fontWeight: 600 }}>Không tìm thấy chỉ tiêu KPI nào</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>Nhấn "Thêm Chỉ Tiêu KPI" để khởi tạo KPI cho bộ phận.</div>
                    </td>
                  </tr>
                ) : (
                  filteredDefinitions.map((kpi) => {
                    const dept = departments.find((d) => d.id === kpi.departmentId);
                    return (
                      <tr key={kpi.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{kpi.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                            <code style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', padding: '1px 5px', borderRadius: 3 }}>
                              {kpi.code}
                            </code>
                            {kpi.description && (
                              <span style={{ fontSize: 11, color: '#64748b' }}>{kpi.description}</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 4,
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                          }}>
                            {dept?.name || kpi.departmentId}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                          {Number(kpi.target || 0).toLocaleString()} <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>{kpi.unit}</span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#334155' }}>
                          {PERIOD_TYPE_LABELS[kpi.periodType] || kpi.periodType}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 11, color: '#475569', background: '#f1f5f9', padding: '2px 6px', borderRadius: 3 }}>
                            {SOURCE_TYPE_LABELS[kpi.sourceType] || kpi.sourceType}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleKpi(kpi)}
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '3px 10px',
                              borderRadius: 12,
                              border: 'none',
                              cursor: 'pointer',
                              background: kpi.active ? '#dcfce7' : '#f1f5f9',
                              color: kpi.active ? '#15803d' : '#64748b',
                            }}
                          >
                            {kpi.active ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                          </button>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditKpi(kpi)}
                              style={{
                                padding: '5px 8px',
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: 4,
                                color: '#334155',
                                cursor: 'pointer',
                              }}
                              title="Sửa KPI"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteKpi(kpi)}
                              style={{
                                padding: '5px 8px',
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: 4,
                                color: '#dc2626',
                                cursor: 'pointer',
                              }}
                              title="Xóa KPI"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DEPARTMENTS                                                        */}
      {/* ========================================================================= */}
      {activeTab === 'departments' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Danh mục phòng ban nghiệp vụ của tổ chức. Hệ thống được cấu hình sẵn cho <strong>CONTENT</strong> và <strong>EDIT</strong>.
            </p>
            <button
              type="button"
              onClick={handleOpenCreateDept}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                borderRadius: 4,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Plus size={15} />
              Thêm Phòng Ban
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {departments.map((dept) => {
              const deptKpis = definitions.filter((d) => d.departmentId === dept.id);
              return (
                <div
                  key={dept.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 34,
                          height: 34,
                          borderRadius: 6,
                          background: '#eff6ff',
                          color: '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Building2 size={18} />
                        </div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{dept.name}</h3>
                          <code style={{ fontSize: 11, color: '#64748b' }}>{dept.code}</code>
                        </div>
                      </div>

                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 10,
                        background: dept.active ? '#dcfce7' : '#f1f5f9',
                        color: dept.active ? '#15803d' : '#64748b',
                      }}>
                        {dept.active ? 'HOẠT ĐỘNG' : 'TẠM KHÓA'}
                      </span>
                    </div>

                    <p style={{ margin: '8px 0 14px', fontSize: 12.5, color: '#64748b', lineHeight: 1.45 }}>
                      {dept.description || 'Chưa có mô tả phòng ban.'}
                    </p>

                    <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 4, fontSize: 12, marginBottom: 14 }}>
                      <div style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                        Chỉ tiêu KPI ({deptKpis.length}):
                      </div>
                      {deptKpis.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {deptKpis.map((k) => (
                            <span key={k.id} style={{ fontSize: 11, background: '#e2e8f0', color: '#1e293b', padding: '2px 6px', borderRadius: 3 }}>
                              {k.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Chưa có KPI nào gán cho phòng này.</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEditDept(dept)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '6px 12px',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#334155',
                        cursor: 'pointer',
                      }}
                    >
                      <Edit2 size={13} />
                      Chỉnh sửa
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: KPI RESULTS                                                        */}
      {/* ========================================================================= */}
      {activeTab === 'results' && (
        <div>
          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Department Filter */}
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 4,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: '#334155',
                }}
              >
                <option value="">Tất cả phòng ban</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              {/* Period Filter */}
              <select
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 4,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: '#334155',
                }}
              >
                <option value="">Tất cả các kỳ</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>

              {/* User Filter */}
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 4,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: '#334155',
                }}
              >
                <option value="">Tất cả nhân viên</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName || u.username} ({u.jobTitle || 'Nhân viên'})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => handleOpenRecordResult()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                borderRadius: 4,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Plus size={15} />
              Ghi Nhận Kết Quả KPI
            </button>
          </div>

          {/* Results Table */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Nhân Viên</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Phòng Ban</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Chỉ Tiêu KPI</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Kỳ Đánh Giá</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Thực Tế / Chỉ Tiêu</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569' }}>Tiến Độ</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>Trạng Thái</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                      <BarChart3 size={36} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
                      <div style={{ fontWeight: 600 }}>Chưa có kết quả KPI nào trong bộ lọc này</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>Nhấn "Ghi Nhận Kết Quả KPI" để cập nhật số liệu thực tế cho nhân sự.</div>
                    </td>
                  </tr>
                ) : (
                  results.map((res) => {
                    const target = Number(res.targetValue || 0);
                    const actual = Number(res.actualValue || 0);
                    const pct = Number(res.progressPct || (target > 0 ? Math.round((actual / target) * 100) : 0));
                    const isDone = pct >= 100;

                    return (
                      <tr key={res.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>
                            {res.user?.fullName || res.user?.username || `User #${res.userId}`}
                          </div>
                          {res.user?.jobTitle && (
                            <div style={{ fontSize: 11, color: '#64748b' }}>{res.user.jobTitle}</div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#1e40af' }}>
                            {res.department?.name || res.departmentId}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{res.kpi?.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{res.kpi?.code}</div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#334155' }}>
                          {res.period?.name || res.periodId}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                          <span style={{ color: isDone ? '#059669' : '#0f172a' }}>{actual.toLocaleString()}</span>
                          <span style={{ color: '#64748b', fontWeight: 400 }}> / {target.toLocaleString()} {res.kpi?.unit}</span>
                        </td>
                        <td style={{ padding: '12px 16px', width: 140 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                width: `${Math.min(pct, 100)}%`,
                                height: '100%',
                                background: isDone ? '#10b981' : '#3b82f6',
                                borderRadius: 3,
                              }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: isDone ? '#059669' : '#3b82f6' }}>
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: isDone ? '#dcfce7' : '#fef3c7',
                            color: isDone ? '#15803d' : '#b45309',
                          }}>
                            {isDone ? 'ĐẠT' : 'ĐANG TIẾN HÀNH'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenRecordResult(res)}
                            style={{
                              padding: '5px 10px',
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              borderRadius: 4,
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#334155',
                              cursor: 'pointer',
                            }}
                          >
                            Cập nhật
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: AUDIT LOG (KPI EVENTS)                                             */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
            Nhật ký ghi nhận và sửa đổi số liệu KPI theo thời gian thực (Audit Trail).
          </p>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 16px', fontWeight: 600, color: '#475569' }}>Thời Gian</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600, color: '#475569' }}>Hành Động</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600, color: '#475569' }}>Nhân Viên</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600, color: '#475569' }}>Chỉ Tiêu KPI</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600, color: '#475569' }}>Biến Động (Trước → Sau)</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600, color: '#475569' }}>Người Thực Hiện</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600, color: '#475569' }}>Nguồn</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                      <History size={36} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
                      <div style={{ fontWeight: 600 }}>Chưa có sự kiện KPI nào được ghi nhận</div>
                    </td>
                  </tr>
                ) : (
                  history.map((ev) => (
                    <tr key={ev.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {new Date(ev.createdAt).toLocaleString('vi-VN')}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 3,
                          background: ev.eventType === 'CREATED' ? '#dcfce7' : '#eff6ff',
                          color: ev.eventType === 'CREATED' ? '#15803d' : '#1d4ed8',
                        }}>
                          {ev.eventType}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: '#0f172a' }}>
                        {ev.user?.fullName || ev.user?.username || `User #${ev.userId}`}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        {ev.kpi?.name || `KPI #${ev.kpiId}`}
                      </td>
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>
                        <span style={{ color: '#94a3b8' }}>{ev.oldValue !== null ? ev.oldValue : '—'}</span>
                        <span style={{ margin: '0 6px', color: '#64748b' }}>→</span>
                        <strong style={{ color: '#059669' }}>{ev.newValue}</strong>
                      </td>
                      <td style={{ padding: '10px 16px', color: '#475569' }}>
                        {ev.triggeredBy?.fullName || ev.triggeredBy?.username || 'Hệ thống'}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: 3 }}>
                          {ev.source}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE / EDIT KPI                                                  */}
      {/* ========================================================================= */}
      {isKpiModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 20,
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 6,
            width: 'min(520px, 100%)',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                {editingKpi ? 'Chỉnh Sửa Chỉ Tiêu KPI' : 'Thêm Mới Chỉ Tiêu KPI'}
              </h3>
              <button
                type="button"
                onClick={() => setIsKpiModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveKpi} style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Phòng Ban *
                  </label>
                  <select
                    required
                    value={kpiFormData.departmentId}
                    onChange={(e) => setKpiFormData({ ...kpiFormData, departmentId: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13 }}
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Mã KPI (Code) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: CONT_VID, EDIT_REV"
                    value={kpiFormData.code}
                    onChange={(e) => setKpiFormData({ ...kpiFormData, code: e.target.value.toUpperCase() })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13, textTransform: 'uppercase' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Tên Chỉ Tiêu KPI *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Video hoàn thành, Revision bản dựng..."
                  value={kpiFormData.name}
                  onChange={(e) => setKpiFormData({ ...kpiFormData, name: e.target.value })}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Mô Tả
                </label>
                <textarea
                  rows={2}
                  placeholder="Mô tả tiêu chuẩn và cách thức đo lường KPI..."
                  value={kpiFormData.description}
                  onChange={(e) => setKpiFormData({ ...kpiFormData, description: e.target.value })}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13, resize: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Đơn Vị Đo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: video, lượt xem, bản..."
                    value={kpiFormData.unit}
                    onChange={(e) => setKpiFormData({ ...kpiFormData, unit: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Mục Tiêu Mặc Định *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min={0}
                    value={kpiFormData.target}
                    onChange={(e) => setKpiFormData({ ...kpiFormData, target: Number(e.target.value) })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Kỳ Đánh Giá *
                  </label>
                  <select
                    value={kpiFormData.periodType}
                    onChange={(e) => setKpiFormData({ ...kpiFormData, periodType: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13 }}
                  >
                    <option value="daily">Hàng ngày (Daily)</option>
                    <option value="weekly">Hàng tuần (Weekly)</option>
                    <option value="monthly">Hàng tháng (Monthly)</option>
                    <option value="quarterly">Hàng quý (Quarterly)</option>
                    <option value="custom">Tùy chỉnh (Custom)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Nguồn Dữ Liệu *
                  </label>
                  <select
                    value={kpiFormData.sourceType}
                    onChange={(e) => setKpiFormData({ ...kpiFormData, sourceType: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13 }}
                  >
                    <option value="manual">Thủ công (Manual)</option>
                    <option value="admin">Quản trị viên (Admin)</option>
                    <option value="production">Hệ thống Sản xuất (Production)</option>
                    <option value="youtube">YouTube Studio Hub</option>
                    <option value="system">Hệ thống nội bộ (System)</option>
                    <option value="api">API tích hợp</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <input
                  type="checkbox"
                  id="kpiActive"
                  checked={kpiFormData.active}
                  onChange={(e) => setKpiFormData({ ...kpiFormData, active: e.target.checked })}
                />
                <label htmlFor="kpiActive" style={{ fontSize: 13, color: '#334155', cursor: 'pointer' }}>
                  Kích hoạt chỉ tiêu KPI này
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
                <button
                  type="button"
                  onClick={() => setIsKpiModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 4,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: 4,
                    border: 'none',
                    background: '#059669',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {editingKpi ? 'Cập Nhật' : 'Lưu KPI'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE / EDIT DEPARTMENT                                           */}
      {/* ========================================================================= */}
      {isDeptModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 20,
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 6,
            width: 'min(460px, 100%)',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                {editingDept ? 'Chỉnh Sửa Phòng Ban' : 'Thêm Phòng Ban'}
              </h3>
              <button
                type="button"
                onClick={() => setIsDeptModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDept} style={{ padding: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Tên Phòng Ban *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: CONTENT, EDIT..."
                  value={deptFormData.name}
                  onChange={(e) => setDeptFormData({ ...deptFormData, name: e.target.value })}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Mã Phòng Ban (Code) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: CONTENT, EDIT"
                  value={deptFormData.code}
                  onChange={(e) => setDeptFormData({ ...deptFormData, code: e.target.value.toUpperCase() })}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13, textTransform: 'uppercase' }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Mô Tả Nghiệp Vụ
                </label>
                <textarea
                  rows={2}
                  placeholder="Mô tả chức năng nhiệm vụ của phòng ban..."
                  value={deptFormData.description}
                  onChange={(e) => setDeptFormData({ ...deptFormData, description: e.target.value })}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13, resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <input
                  type="checkbox"
                  id="deptActive"
                  checked={deptFormData.active}
                  onChange={(e) => setDeptFormData({ ...deptFormData, active: e.target.checked })}
                />
                <label htmlFor="deptActive" style={{ fontSize: 13, color: '#334155', cursor: 'pointer' }}>
                  Kích hoạt phòng ban này
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 4,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: 4,
                    border: 'none',
                    background: '#059669',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {editingDept ? 'Cập Nhật' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECORD KPI RESULT                                                  */}
      {/* ========================================================================= */}
      {isResultModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 20,
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 6,
            width: 'min(500px, 100%)',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                Ghi Nhận Kết Quả Thực Tế KPI
              </h3>
              <button
                type="button"
                onClick={() => setIsResultModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveResult} style={{ padding: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Nhân Viên *
                </label>
                <select
                  required
                  value={resultFormData.userId}
                  onChange={(e) => {
                    const uId = e.target.value;
                    const u = usersList.find((x) => String(x.id) === String(uId));
                    setResultFormData({
                      ...resultFormData,
                      userId: uId,
                      departmentId: u?.departmentId ? String(u.departmentId) : resultFormData.departmentId,
                    });
                  }}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13 }}
                >
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName || u.username} ({u.jobTitle || 'Nhân viên'})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Phòng Ban *
                  </label>
                  <select
                    required
                    value={resultFormData.departmentId}
                    onChange={(e) => setResultFormData({ ...resultFormData, departmentId: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13 }}
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Kỳ Đánh Giá *
                  </label>
                  <select
                    required
                    value={resultFormData.periodId}
                    onChange={(e) => setResultFormData({ ...resultFormData, periodId: e.target.value })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13 }}
                  >
                    {periods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Chỉ Tiêu KPI *
                </label>
                <select
                  required
                  value={resultFormData.kpiId}
                  onChange={(e) => {
                    const kId = e.target.value;
                    const k = definitions.find((x) => String(x.id) === String(kId));
                    setResultFormData({
                      ...resultFormData,
                      kpiId: kId,
                      targetValue: k?.target !== undefined ? k.target : resultFormData.targetValue,
                    });
                  }}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13 }}
                >
                  {definitions.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} ({k.code} - {k.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Mục Tiêu (Target) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min={0}
                    value={resultFormData.targetValue}
                    onChange={(e) => setResultFormData({ ...resultFormData, targetValue: Number(e.target.value) })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Thực Tế Đạt Được (Actual) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min={0}
                    value={resultFormData.actualValue}
                    onChange={(e) => setResultFormData({ ...resultFormData, actualValue: Number(e.target.value) })}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700, color: '#059669' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Ghi Chú Nghiệp Vụ / Lý Do Cập Nhật
                </label>
                <input
                  type="text"
                  placeholder="Ghi chú xác nhận số liệu thực tế..."
                  value={resultFormData.notes}
                  onChange={(e) => setResultFormData({ ...resultFormData, notes: e.target.value })}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
                <button
                  type="button"
                  onClick={() => setIsResultModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 4,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: 4,
                    border: 'none',
                    background: '#059669',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Lưu Kết Quả
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
