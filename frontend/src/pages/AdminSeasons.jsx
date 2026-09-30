import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Plus, Play, Pause, CheckCircle, Archive, Shield, Users, RefreshCw, Calendar, Target, AlertTriangle, Clock } from 'lucide-react';
import { competition, groups } from '../services/api';
import { Card, EmptyState, PageState, Button, SegmentedControl } from '../components/ui';

export default function AdminSeasons() {
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

  // Add Team Modal State
  const [selectedSeasonForTeam, setSelectedSeasonForTeam] = useState(null);
  const [availableTeams, setAvailableTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [teamColor, setTeamColor] = useState('#0284c7');

  const fetchSeasons = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await competition.adminListSeasons();
      setSeasons(data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tải danh sách mùa giải');
    } finally {
      setLoading(false);
    }
  }, []);

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
    const reason = window.prompt(`Lý do chuyển trạng thái sang ${newStatus}:`, 'Cập nhật từ trang quản trị');
    if (reason === null) return; // user cancelled

    try {
      await competition.adminUpdateSeasonStatus(seasonId, newStatus, reason);
      fetchSeasons();
    } catch (err) {
      alert(err?.response?.data?.message || `Không thể chuyển trạng thái sang ${newStatus}`);
    }
  };

  const handleCreateSeason = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await competition.adminCreateSeason(formData);
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
      fetchSeasons();
    } catch (err) {
      alert(err?.response?.data?.message || 'Không thể tạo mùa giải');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTeam = async (e) => {
    e.preventDefault();
    if (!selectedTeamId || !selectedSeasonForTeam) return;
    try {
      await competition.adminAddTeamToSeason(selectedSeasonForTeam.id, {
        teamId: Number(selectedTeamId),
        color: teamColor,
      });
      setSelectedSeasonForTeam(null);
      setSelectedTeamId('');
      fetchSeasons();
    } catch (err) {
      alert(err?.response?.data?.message || 'Không thể thêm đội vào mùa giải');
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
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', margin: 0 }}>Quản Lý Mùa Giải (Seasons)</h1>
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
                        fontWeight: 800,
                        background: s.status === 'ACTIVE' ? 'rgba(34,197,94,0.15)' : s.status === 'PAUSED' ? 'rgba(234,179,8,0.15)' : 'rgba(15,23,42,0.08)',
                        color: s.status === 'ACTIVE' ? '#16a34a' : s.status === 'PAUSED' ? '#ca8a04' : '#475569',
                      }}
                    >
                      {s.status}
                    </span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{s.seasonType}</span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>• Slug: <code>{s.slug}</code></span>
                  </div>

                  <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0' }}>{s.name}</h3>
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
                      <Button variant="primary" size="sm" onClick={() => handleStatusChange(s.id, 'ACTIVE')}>
                        <Play size={14} /> Kích hoạt
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleStatusChange(s.id, 'SCHEDULED')}>
                        Lên lịch
                      </Button>
                    </>
                  )}

                  {s.status === 'SCHEDULED' && (
                    <Button variant="primary" size="sm" onClick={() => handleStatusChange(s.id, 'ACTIVE')}>
                      <Play size={14} /> Kích hoạt ngay
                    </Button>
                  )}

                  {s.status === 'ACTIVE' && (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => handleStatusChange(s.id, 'PAUSED')} style={{ color: '#ca8a04' }}>
                        <Pause size={14} /> Tạm dừng
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => handleStatusChange(s.id, 'FINISHED')} style={{ background: '#16a34a' }}>
                        <CheckCircle size={14} /> Kết thúc & Đóng băng
                      </Button>
                    </>
                  )}

                  {s.status === 'PAUSED' && (
                    <>
                      <Button variant="primary" size="sm" onClick={() => handleStatusChange(s.id, 'ACTIVE')}>
                        <Play size={14} /> Tiếp tục (Resume)
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleStatusChange(s.id, 'FINISHED')}>
                        Kết thúc
                      </Button>
                    </>
                  )}

                  {s.status === 'FINISHED' && (
                    <Button variant="secondary" size="sm" onClick={() => handleStatusChange(s.id, 'ARCHIVED')}>
                      <Archive size={14} /> Lưu trữ (Archive)
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ width: 'min(520px, 100%)', background: '#ffffff', borderRadius: 10, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 16px 0' }}>Tạo Mùa Giải Mới</h2>
            <form onSubmit={handleCreateSeason} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Tên mùa giải</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: October Championship 2026"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Slug định danh</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Bắt đầu</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.startAt}
                    onChange={(e) => setFormData({ ...formData, startAt: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Kết thúc</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.endAt}
                    onChange={(e) => setFormData({ ...formData, endAt: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Mô tả ngắn</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Mô tả mục tiêu giải đấu và thể thức..."
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ width: 'min(440px, 100%)', background: '#ffffff', borderRadius: 10, padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 12px 0' }}>
              Thêm Đội vào Season: {selectedSeasonForTeam.name}
            </h2>
            <form onSubmit={handleAddTeam} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Chọn Team</label>
                <select
                  required
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6 }}
                >
                  <option value="">-- Chọn Team --</option>
                  {availableTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Màu đại diện đội (Hex)</label>
                <input
                  type="color"
                  value={teamColor}
                  onChange={(e) => setTeamColor(e.target.value)}
                  style={{ width: '100%', height: 40, border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <Button variant="secondary" type="button" onClick={() => setSelectedSeasonForTeam(null)}>Đóng</Button>
                <Button variant="primary" type="submit">Thêm và Snapshot</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
