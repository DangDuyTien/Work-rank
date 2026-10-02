import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Plus, Play, Pause, CheckCircle, Archive, Shield, Users, RefreshCw, Calendar, Target, AlertTriangle, Clock } from 'lucide-react';
import { competition, groups } from '../services/api';
import { useToast, useConfirm } from '../context/UiContext';
import { parseApiError } from '../utils/errors';
import { Card, EmptyState, PageState, Button, SegmentedControl } from '../components/ui';

export default function AdminSeasons() {
  const toast = useToast();
  const confirm = useConfirm();

  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Create Season Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    seasonType: 'MONTHLY',
    startAt: '',
    endAt: '',
    gracePeriodHours: 2,
  });
  const [submitting, setSubmitting] = useState(false);
  const [statusChangingId, setStatusChangingId] = useState(null);
  const [addingTeam, setAddingTeam] = useState(false);

  // Add Team Modal State
  const [selectedSeasonForTeam, setSelectedSeasonForTeam] = useState(null);
  const [availableTeams, setAvailableTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [teamColor, setTeamColor] = useState('#b45309');

  const fetchSeasons = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await competition.adminListSeasons();
      setSeasons(data || []);
    } catch (err) {
      const errMsg = parseApiError(err, 'Không thể tải danh sách mùa giải');
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
    fetchSeasons();
    fetchAvailableTeams();
  }, [fetchSeasons]);

  const handleStatusChange = async (seasonId, newStatus) => {
    const ok = await confirm({
      title: `Chuyển trạng thái Mùa giải sang ${newStatus}`,
      message: newStatus === 'FINISHED'
        ? 'Bạn có chắc muốn kết thúc và đóng băng điểm số mùa giải này không?'
        : `Bạn có chắc muốn chuyển trạng thái mùa giải sang ${newStatus}?`,
      confirmText: 'Xác nhận chuyển',
      cancelText: 'Hủy',
      type: newStatus === 'FINISHED' ? 'danger' : 'primary',
    });
    if (!ok) return;

    setStatusChangingId(seasonId);
    try {
      await competition.adminUpdateSeasonStatus(seasonId, newStatus, `Cập nhật sang ${newStatus} từ trang quản trị`);
      toast.success(`Đã chuyển trạng thái mùa giải sang ${newStatus}!`);
      await fetchSeasons();
    } catch (err) {
      toast.error(parseApiError(err, `Không thể chuyển trạng thái sang ${newStatus}`));
    } finally {
      setStatusChangingId(null);
    }
  };

  const handleCreateSeason = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await competition.adminCreateSeason(formData);
      toast.success(`Đã tạo mùa giải "${formData.name}" thành công!`);
      setShowCreateModal(false);
      setFormData({
        name: '',
        slug: '',
        description: '',
        seasonType: 'MONTHLY',
        startAt: '',
        endAt: '',
        gracePeriodHours: 2,
      });
      await fetchSeasons();
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể tạo mùa giải'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTeam = async (e) => {
    e.preventDefault();
    if (!selectedTeamId || !selectedSeasonForTeam) {
      toast.warning('Vui lòng chọn đội để thêm vào mùa giải.');
      return;
    }
    setAddingTeam(true);
    try {
      await competition.adminAddTeamToSeason(selectedSeasonForTeam.id, {
        teamId: Number(selectedTeamId),
        color: teamColor,
      });
      toast.success('Đã thêm đội vào mùa giải và snapshot thành công!');
      setSelectedSeasonForTeam(null);
      setSelectedTeamId('');
      await fetchSeasons();
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể thêm đội vào mùa giải'));
    } finally {
      setAddingTeam(false);
    }
  };

  const filteredSeasons = filterStatus === 'ALL'
    ? seasons
    : seasons.filter((s) => s.status === filterStatus);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trophy size={22} color="#f97316" />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>Quản Lý Mùa Giải (Seasons)</h1>
          </div>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>
            Thiết lập lịch trình, đội tham gia, kích hoạt, tạm dừng, và đóng băng kết quả giải đấu.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="primary" size="md" onClick={() => setShowCreateModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Tạo Mùa Giải Mới
          </Button>
          <Button variant="secondary" size="md" onClick={fetchSeasons}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ marginBottom: 16 }}>
        <SegmentedControl
          ariaLabel="Status Filter"
          options={[
            { key: 'ALL', label: `Tất cả (${seasons.length})` },
            { key: 'ACTIVE', label: 'Đang diễn ra' },
            { key: 'SCHEDULED', label: 'Sắp diễn ra' },
            { key: 'PAUSED', label: 'Tạm dừng' },
            { key: 'FINISHED', label: 'Đã hoàn thành' },
            { key: 'DRAFT', label: 'Bản nháp' },
          ]}
          value={filterStatus}
          onChange={setFilterStatus}
        />
      </div>

      {loading ? (
        <PageState type="loading" title="Đang tải danh sách mùa giải..." />
      ) : error ? (
        <PageState type="error" title="Lỗi" description={error} onRetry={fetchSeasons} />
      ) : filteredSeasons.length === 0 ? (
        <Card style={{ padding: 40 }}>
          <EmptyState title="Không có mùa giải nào" description="Nhấn nút Tạo Mùa Giải Mới ở trên để bắt đầu." />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredSeasons.map((s) => (
            <Card key={s.id} style={{ padding: 20, border: '1px solid rgba(15,23,42,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: s.status === 'ACTIVE' ? 'rgba(34,197,94,0.15)' : s.status === 'PAUSED' ? 'rgba(234,179,8,0.15)' : 'rgba(15,23,42,0.08)',
                        color: s.status === 'ACTIVE' ? '#16a34a' : s.status === 'PAUSED' ? '#ca8a04' : '#475569',
                      }}
                    >
                      {s.status}
                    </span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{s.seasonType}</span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>• Slug: <code>{s.slug}</code></span>
                  </div>

                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>{s.name}</h3>
                  <p style={{ fontSize: 13, color: '#475569', margin: '0 0 10px 0' }}>{s.description || 'Chưa có mô tả'}</p>

                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748b', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={13} color="#64748b" /> Bắt đầu: <strong>{new Date(s.startAt).toLocaleString()}</strong>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} color="#64748b" /> Kết thúc: <strong>{new Date(s.endAt).toLocaleString()}</strong>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} color="#64748b" /> Grace: <strong>{s.gracePeriodHours} giờ</strong>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Users size={13} color="#64748b" /> Đội tham gia: <strong>{s.teams?.length || 0} đội</strong>
                    </span>
                  </div>
                </div>

                {/* Status Action Buttons */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Button variant="secondary" size="sm" onClick={() => setSelectedSeasonForTeam(s)}>
                    <Users size={14} /> + Đội
                  </Button>

                  {s.status === 'DRAFT' && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={statusChangingId === s.id}
                        onClick={() => handleStatusChange(s.id, 'ACTIVE')}
                      >
                        <Play size={14} /> {statusChangingId === s.id ? 'Đang kích hoạt...' : 'Kích hoạt'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={statusChangingId === s.id}
                        onClick={() => handleStatusChange(s.id, 'SCHEDULED')}
                      >
                        {statusChangingId === s.id ? 'Đang lên lịch...' : 'Lên lịch'}
                      </Button>
                    </>
                  )}

                  {s.status === 'SCHEDULED' && (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={statusChangingId === s.id}
                      onClick={() => handleStatusChange(s.id, 'ACTIVE')}
                    >
                      <Play size={14} /> {statusChangingId === s.id ? 'Đang kích hoạt...' : 'Kích hoạt ngay'}
                    </Button>
                  )}

                  {s.status === 'ACTIVE' && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={statusChangingId === s.id}
                        onClick={() => handleStatusChange(s.id, 'PAUSED')}
                        style={{ color: '#ca8a04' }}
                      >
                        <Pause size={14} /> {statusChangingId === s.id ? 'Đang tạm dừng...' : 'Tạm dừng'}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={statusChangingId === s.id}
                        onClick={() => handleStatusChange(s.id, 'FINISHED')}
                        style={{ background: '#16a34a' }}
                      >
                        <CheckCircle size={14} /> {statusChangingId === s.id ? 'Đang kết thúc...' : 'Kết thúc & Đóng băng'}
                      </Button>
                    </>
                  )}

                  {s.status === 'PAUSED' && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={statusChangingId === s.id}
                        onClick={() => handleStatusChange(s.id, 'ACTIVE')}
                      >
                        <Play size={14} /> {statusChangingId === s.id ? 'Đang tiếp tục...' : 'Tiếp tục (Resume)'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={statusChangingId === s.id}
                        onClick={() => handleStatusChange(s.id, 'FINISHED')}
                      >
                        {statusChangingId === s.id ? 'Đang kết thúc...' : 'Kết thúc'}
                      </Button>
                    </>
                  )}

                  {s.status === 'FINISHED' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={statusChangingId === s.id}
                      onClick={() => handleStatusChange(s.id, 'ARCHIVED')}
                    >
                      <Archive size={14} /> {statusChangingId === s.id ? 'Đang lưu trữ...' : 'Lưu trữ (Archive)'}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* CREATE SEASON MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop-enter">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden modal-dialog-enter p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Tạo Mùa Giải Mới</h2>
            <form onSubmit={handleCreateSeason} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Tên mùa giải</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: October Championship 2026"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Slug định danh</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Bắt đầu</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.startAt}
                    onChange={(e) => setFormData({ ...formData, startAt: e.target.value })}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Kết thúc</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.endAt}
                    onChange={(e) => setFormData({ ...formData, endAt: e.target.value })}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Mô tả ngắn</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Mô tả mục tiêu giải đấu và thể thức..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 mt-2">
                <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>Hủy</Button>
                <Button variant="primary" type="submit" disabled={submitting}>
                  {submitting ? 'Đang tạo...' : 'Tạo Mùa Giải'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD TEAM MODAL */}
      {selectedSeasonForTeam && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop-enter">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden modal-dialog-enter p-6">
            <h2 className="text-base font-bold text-slate-900 mb-3">
              Thêm Đội vào Season: {selectedSeasonForTeam.name}
            </h2>
            <form onSubmit={handleAddTeam} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Chọn Team</label>
                <select
                  required
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Chọn Team --</option>
                  {availableTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Màu đại diện đội (Hex)</label>
                <input
                  type="color"
                  value={teamColor}
                  onChange={(e) => setTeamColor(e.target.value)}
                  className="w-full h-10 border border-slate-300 rounded-lg cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2.5 mt-2">
                <Button variant="secondary" type="button" onClick={() => setSelectedSeasonForTeam(null)}>Đóng</Button>
                <Button variant="primary" type="submit" disabled={addingTeam}>
                  {addingTeam ? 'Đang thêm...' : 'Thêm và Snapshot'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
