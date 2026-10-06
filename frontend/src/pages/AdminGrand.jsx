import React, { useState, useEffect, useCallback } from 'react';
import { Award, Plus, Play, Pause, CheckCircle, Archive, Shield, Users, RefreshCw, Calendar, Target, AlertTriangle, ChevronRight, Hash, Layers } from 'lucide-react';
import { competition, groups } from '../services/api';
import { useToast, useConfirm } from '../context/UiContext';
import { parseApiError } from '../utils/errors';
import { Card, EmptyState, PageState, Button, SegmentedControl } from '../components/ui';

export default function AdminGrand() {
  const toast = useToast();
  const confirm = useConfirm();

  const [grands, setGrands] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Create Grand Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    year: new Date().getFullYear(),
    description: '',
    startAt: '',
    endAt: '',
    tieBreakOrder: 'grand_points,season_wins,podium_count,earliest_award',
  });
  const [submitting, setSubmitting] = useState(false);
  const [statusChangingId, setStatusChangingId] = useState(null);
  const [settlingSeasonId, setSettlingSeasonId] = useState(null);
  const [submittingLink, setSubmittingLink] = useState(false);
  const [submittingReconcile, setSubmittingReconcile] = useState(false);

  // Link Season Modal State
  const [selectedGrandForSeason, setSelectedGrandForSeason] = useState(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState('');

  // Reconcile Points Modal State
  const [selectedGrandForReconcile, setSelectedGrandForReconcile] = useState(null);
  const [availableTeams, setAvailableTeams] = useState([]);
  const [reconcileData, setReconcileData] = useState({
    teamId: '',
    points: 0,
    reason: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [grandsData, seasonsData] = await Promise.all([
        competition.adminListGrands(),
        competition.adminListSeasons(),
      ]);
      setGrands(grandsData || []);
      setSeasons(seasonsData || []);
    } catch (err) {
      const errMsg = parseApiError(err, 'Không thể tải danh sách Grand Championship');
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchAvailableTeams = async () => {
    try {
      const res = await groups.list();
      setAvailableTeams(res.data || []);
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    fetchData();
    fetchAvailableTeams();
  }, [fetchData]);

  const handleStatusChange = async (grandId, newStatus) => {
    const ok = await confirm({
      title: `Chuyển trạng thái Grand sang ${newStatus}`,
      message: newStatus === 'FINISHED'
        ? 'Bạn có chắc chắn muốn kết thúc và đóng băng kết quả Grand Championship này không? Nếu có Season chưa hoàn thành, hệ thống sẽ chốt force override.'
        : `Bạn có chắc muốn chuyển trạng thái Grand sang ${newStatus}?`,
      confirmText: 'Xác nhận chuyển',
      cancelText: 'Hủy',
      type: newStatus === 'FINISHED' ? 'danger' : 'primary',
    });
    if (!ok) return;

    setStatusChangingId(grandId);
    try {
      await competition.adminUpdateGrandStatus(
        grandId,
        newStatus,
        `Chuyển sang ${newStatus} từ trang quản trị`,
        newStatus === 'FINISHED'
      );
      toast.success(`Đã chuyển trạng thái Grand sang ${newStatus}!`);
      await fetchData();
    } catch (err) {
      toast.error(parseApiError(err, `Không thể chuyển trạng thái sang ${newStatus}`));
    } finally {
      setStatusChangingId(null);
    }
  };

  const handleCreateGrand = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await competition.adminCreateGrand({
        ...formData,
        year: Number(formData.year),
      });
      toast.success(`Đã tạo Grand Championship "${formData.name}" thành công!`);
      setShowCreateModal(false);
      setFormData({
        name: '',
        slug: '',
        year: new Date().getFullYear(),
        description: '',
        startAt: '',
        endAt: '',
        tieBreakOrder: 'grand_points,season_wins,podium_count,earliest_award',
      });
      await fetchData();
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể tạo Grand Championship'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkSeason = async (e) => {
    e.preventDefault();
    if (!selectedGrandForSeason || !selectedSeasonId) {
      toast.warning('Vui lòng chọn một Mùa giải để liên kết.');
      return;
    }
    setSubmittingLink(true);
    try {
      await competition.adminLinkSeasonToGrand(selectedGrandForSeason.id, Number(selectedSeasonId));
      toast.success('Đã liên kết Season vào Grand Championship thành công!');
      setSelectedGrandForSeason(null);
      setSelectedSeasonId('');
      await fetchData();
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể liên kết Season vào Grand'));
    } finally {
      setSubmittingLink(false);
    }
  };

  const handleManualSettle = async (grandId, seasonId) => {
    const ok = await confirm({
      title: 'Quyết toán Grand Points',
      message: 'Bạn có chắc chắn muốn phát và ghi nhận Grand Points từ Season này vào Ledger?',
      confirmText: 'Quyết toán ngay',
      cancelText: 'Hủy',
      type: 'warning',
    });
    if (!ok) return;

    setSettlingSeasonId(seasonId);
    try {
      const res = await competition.adminSettleGrandPoints(grandId, seasonId);
      toast.success(`Đã hoàn tất quyết toán Grand Points. Số bản ghi đã lưu: ${res?.count || 0}`);
      await fetchData();
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể quyết toán Grand Points'));
    } finally {
      setSettlingSeasonId(null);
    }
  };

  const handleReconcilePoints = async (e) => {
    e.preventDefault();
    if (!selectedGrandForReconcile || !reconcileData.teamId || !reconcileData.points || !reconcileData.reason) {
      toast.warning('Vui lòng điền đầy đủ thông tin điều chỉnh và lý do.');
      return;
    }
    setSubmittingReconcile(true);
    try {
      await competition.adminReconcileGrandPoints(selectedGrandForReconcile.id, {
        teamId: Number(reconcileData.teamId),
        points: Number(reconcileData.points),
        reason: reconcileData.reason,
      });
      toast.success('Đã ghi nhận điều chỉnh Grand Points vào Ledger bất biến thành công!');
      setSelectedGrandForReconcile(null);
      setReconcileData({ teamId: '', points: 0, reason: '' });
      await fetchData();
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể điều chỉnh Grand Points'));
    } finally {
      setSubmittingReconcile(false);
    }
  };

  const filteredGrands = filterStatus === 'ALL'
    ? grands
    : grands.filter((g) => g.status === filterStatus);

  return (
    <div className="admin-data-page" style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Award size={22} color="#eab308" />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Quản Lý Grand Championship</h1>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            Hệ thống giải vô địch toàn năm, phân phối Grand Points từ các Seasons và bảng xếp hạng tổng kết.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={fetchData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 'var(--radius-content)',
              border: '1px solid var(--border-2)',
              background: 'var(--surface)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
          >
            <RefreshCw size={14} /> Làm mới
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 'var(--radius-content)',
              border: 'none',
              background: '#eab308',
              color: '#000',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Plus size={16} /> Tạo Grand Championship
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ marginBottom: 16 }}>
        <SegmentedControl
          ariaLabel="Lọc trạng thái Grand"
          value={filterStatus}
          onChange={setFilterStatus}
          options={[
            { value: 'ALL', label: 'Tất cả' },
            { value: 'DRAFT', label: 'Bản nháp' },
            { value: 'SCHEDULED', label: 'Đã lên lịch' },
            { value: 'ACTIVE', label: 'Đang diễn ra' },
            { value: 'FINISHED', label: 'Đã kết thúc' },
            { value: 'ARCHIVED', label: 'Lưu trữ' },
          ]}
        />
      </div>

      {/* Content */}
      {loading ? (
        <PageState type="loading" title="Đang tải dữ liệu Grand Championship..." />
      ) : error ? (
        <PageState type="error" title="Lỗi tải dữ liệu" description={error} onRetry={fetchData} />
      ) : filteredGrands.length === 0 ? (
        <EmptyState
          icon={Award}
          title="Chưa có Grand Championship nào"
          description="Hãy tạo giải vô địch năm đầu tiên để liên kết các mùa giải."
          action={
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={14} style={{ marginRight: 6 }} /> Tạo Grand Championship
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredGrands.map((g) => {
            const linkedSeasons = (seasons || []).filter((s) => s.grandChampionshipId === g.id);
            return (
              <Card key={g.id} style={{ padding: 20, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        background: '#fef08a',
                        color: '#854d0e',
                        fontWeight: 700,
                        fontSize: 12,
                      }}>
                        NĂM {g.year}
                      </span>
                      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        {g.name}
                      </h2>
                      <span style={{
                        padding: '2px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        background: g.status === 'ACTIVE' ? 'rgba(34,197,94,0.1)' : g.status === 'FINISHED' ? 'var(--surface-muted)' : '#fffbeb',
                        color: g.status === 'ACTIVE' ? '#16a34a' : g.status === 'FINISHED' ? 'var(--text-secondary)' : '#d97706',
                        border: '1px solid currentColor',
                      }}>
                        {g.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <span><strong>Slug:</strong> {g.slug}</span>
                      <span><strong>Thời gian:</strong> {new Date(g.startAt).toLocaleDateString('vi-VN')} — {new Date(g.endAt).toLocaleDateString('vi-VN')}</span>
                      <span><strong>Ưu tiên Tiebreak:</strong> {g.tieBreakOrder}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {g.status === 'DRAFT' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(g.id, 'SCHEDULED')}
                        disabled={statusChangingId === g.id}
                        style={{
                          border: '1px solid var(--border-2)',
                          background: 'var(--surface)',
                          padding: '6px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: statusChangingId === g.id ? 'not-allowed' : 'pointer',
                          opacity: statusChangingId === g.id ? 0.6 : 1,
                        }}
                      >
                        {statusChangingId === g.id ? 'Đang chuyển...' : 'Lên lịch'}
                      </button>
                    )}
                    {['DRAFT', 'SCHEDULED'].includes(g.status) && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(g.id, 'ACTIVE')}
                        disabled={statusChangingId === g.id}
                        style={{
                          border: 'none',
                          background: '#16a34a',
                          color: 'var(--surface)',
                          padding: '6px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: statusChangingId === g.id ? 'not-allowed' : 'pointer',
                          opacity: statusChangingId === g.id ? 0.6 : 1,
                        }}
                      >
                        {statusChangingId === g.id ? 'Đang kích hoạt...' : 'Kích hoạt'}
                      </button>
                    )}
                    {g.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(g.id, 'FINISHED')}
                        disabled={statusChangingId === g.id}
                        style={{
                          border: 'none',
                          background: '#eab308',
                          color: '#000',
                          padding: '6px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: statusChangingId === g.id ? 'not-allowed' : 'pointer',
                          opacity: statusChangingId === g.id ? 0.6 : 1,
                        }}
                      >
                        {statusChangingId === g.id ? 'Đang đóng băng...' : 'Đóng & Đóng Băng Kết Quả'}
                      </button>
                    )}
                    {g.status === 'FINISHED' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(g.id, 'ARCHIVED')}
                        disabled={statusChangingId === g.id}
                        style={{
                          border: '1px solid var(--border-2)',
                          background: 'var(--surface)',
                          padding: '6px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: statusChangingId === g.id ? 'not-allowed' : 'pointer',
                          opacity: statusChangingId === g.id ? 0.6 : 1,
                        }}
                      >
                        {statusChangingId === g.id ? 'Đang lưu trữ...' : 'Lưu trữ'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedGrandForSeason(g)}
                      style={{ border: '1px solid var(--accent)', background: 'rgba(180,83,9,0.06)', color: 'var(--accent)', padding: '6px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >
                      + Ghép Season
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedGrandForReconcile(g)}
                      style={{ border: '1px solid #ea580c', background: 'rgba(234,88,12,0.06)', color: '#ea580c', padding: '6px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Điều chỉnh Điểm
                    </button>
                  </div>
                </div>

                {/* Linked Seasons List */}
                <div style={{ marginTop: 16, borderTop: '1px solid var(--surface-muted)', paddingTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Layers size={14} color="var(--accent)" />
                    Các Mùa Giải Đã Ghép ({linkedSeasons.length}):
                  </div>
                  {linkedSeasons.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      Chưa có Season nào được liên kết vào Grand Championship này.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                      {linkedSeasons.map((s) => (
                        <div key={s.id} style={{ border: '1px solid var(--border)', padding: 10, background: 'var(--surface-soft)', fontSize: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</span>
                            <span style={{ fontWeight: 600, color: s.status === 'FINISHED' ? '#16a34a' : 'var(--text-secondary)' }}>{s.status}</span>
                          </div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 8 }}>
                            {new Date(s.startAt).toLocaleDateString('vi-VN')} - {new Date(s.endAt).toLocaleDateString('vi-VN')}
                          </div>
                          {s.status === 'FINISHED' && (
                            <button
                              type="button"
                              onClick={() => handleManualSettle(g.id, s.id)}
                              disabled={settlingSeasonId === s.id}
                              style={{
                                width: '100%',
                                border: '1px solid var(--border-2)',
                                background: 'var(--surface)',
                                padding: '4px 8px',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: settlingSeasonId === s.id ? 'not-allowed' : 'pointer',
                                color: 'var(--accent)',
                                opacity: settlingSeasonId === s.id ? 0.6 : 1,
                              }}
                            >
                              {settlingSeasonId === s.id ? 'Đang quyết toán...' : 'Phát / Quyết Toán Grand Points'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Grand Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop-enter">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden modal-dialog-enter p-6">
            <h3 className="text-base font-bold text-slate-900 mb-4">
              Tạo Grand Championship Mới
            </h3>
            <form onSubmit={handleCreateGrand} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Tên Giải Vô Địch</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 3winmedia Grand Championship 2026"
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                    setFormData({ ...formData, name, slug });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Slug</label>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Năm Thi Đấu</label>
                  <input
                    type="number"
                    required
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Ngày Bắt Đầu</label>
                  <input
                    type="date"
                    required
                    value={formData.startAt}
                    onChange={(e) => setFormData({ ...formData, startAt: e.target.value })}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Ngày Kết Thúc</label>
                  <input
                    type="date"
                    required
                    value={formData.endAt}
                    onChange={(e) => setFormData({ ...formData, endAt: e.target.value })}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Mô tả</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Thứ Tự Tie-Break</label>
                <input
                  type="text"
                  value={formData.tieBreakOrder}
                  onChange={(e) => setFormData({ ...formData, tieBreakOrder: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-500">Mặc định: grand_points,season_wins,podium_count,earliest_award</span>
              </div>

              <div className="flex justify-end gap-2.5 mt-2">
                <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>
                  Hủy
                </Button>
                <Button variant="primary" type="submit" disabled={submitting}>
                  {submitting ? 'Đang tạo...' : 'Tạo Giải'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Season Modal */}
      {selectedGrandForSeason && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop-enter">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden modal-dialog-enter p-6">
            <h3 className="text-base font-bold text-slate-900 mb-3">
              Ghép Mùa Giải Vào: {selectedGrandForSeason.name}
            </h3>
            <form onSubmit={handleLinkSeason} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Chọn Mùa Giải</label>
                <select
                  required
                  value={selectedSeasonId}
                  onChange={(e) => setSelectedSeasonId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Chọn Mùa Giải --</option>
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.status}) {s.grandChampionshipId ? '• [Đã liên kết]' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2.5 mt-2">
                <Button variant="secondary" type="button" onClick={() => setSelectedGrandForSeason(null)}>
                  Hủy
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={submittingLink}
                >
                  {submittingLink ? 'Đang ghép...' : 'Xác Nhận Ghép'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reconcile Modal */}
      {selectedGrandForReconcile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop-enter">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden modal-dialog-enter p-6">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Điều Chỉnh Điểm Grand Points (Immutable Reconciliation)
            </h3>
            <p className="text-xs text-red-600 mb-3 leading-relaxed">
              Lưu ý: Grand Points Ledger là bảng bất biến (Append-Only). Bản ghi điều chỉnh sẽ được ghi mới (Reversal / Adjustment) và không làm mất lịch sử cũ.
            </p>
            <form onSubmit={handleReconcilePoints} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Chọn Team</label>
                <select
                  required
                  value={reconcileData.teamId}
                  onChange={(e) => setReconcileData({ ...reconcileData, teamId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Chọn Đội --</option>
                  {availableTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Số Điểm Điều Chỉnh (Có thể âm hoặc dương)</label>
                <input
                  type="number"
                  required
                  placeholder="Ví dụ: 100 hoặc -50"
                  value={reconcileData.points}
                  onChange={(e) => setReconcileData({ ...reconcileData, points: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Lý Do Điều Chỉnh (Bắt buộc để kiểm toán)</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Ghi rõ biên bản vi phạm hoặc quyết định phúc khảo..."
                  value={reconcileData.reason}
                  onChange={(e) => setReconcileData({ ...reconcileData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 mt-2">
                <Button variant="secondary" type="button" onClick={() => setSelectedGrandForReconcile(null)}>
                  Hủy
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={submittingReconcile}
                >
                  {submittingReconcile ? 'Đang ghi nhận...' : 'Ghi Nhận Điều Chỉnh'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
