import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy, Plus, Play, Pause, CheckCircle, Archive, Shield, Users, RefreshCw,
  Calendar, Target, AlertTriangle, Clock, Sparkles, Star, Trash2, Edit3, Save,
  History, RotateCcw,
} from 'lucide-react';
import { competition, groups, users as usersApi } from '../services/api';
import { useToast, useConfirm } from '../context/UiContext';
import { parseApiError } from '../utils/errors';
import { Card, EmptyState, PageState, Button, SegmentedControl, TabTransition, AnimatedModal } from '../components/ui';
import MvpCupAwardModal from '../components/MvpCupAwardModal';


export default function AdminSeasons() {
  const toast = useToast();
  const confirm = useConfirm();

  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Create Season Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMvpModal, setShowMvpModal] = useState(false);
  const [selectedSeasonForMvp, setSelectedSeasonForMvp] = useState(null);
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
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [teamColor, setTeamColor] = useState('var(--accent)');

  // Main Tab State: 'seasons' | 'spotlight'
  const [mainTab, setMainTab] = useState('seasons');

  // Spotlight State
  const [spotlightConfig, setSpotlightConfig] = useState({
    teamId: '',
    userId: '',
    teamTitle: '',
    mvpTitle: '',
    mvpReason: '',
  });
  const [loadingSpotlight, setLoadingSpotlight] = useState(false);
  const [savingSpotlight, setSavingSpotlight] = useState(false);

  // Historical Archives State
  const [archives, setArchives] = useState([]);
  const [loadingArchives, setLoadingArchives] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [editingArchive, setEditingArchive] = useState(null);
  const [savingArchive, setSavingArchive] = useState(false);
  const [archiveForm, setArchiveForm] = useState({
    year: 2025,
    label: '',
    teamName: '',
    teamTitle: '',
    memberIds: [],
    legacyMembers: [],
    mvpUserId: '',
    mvpJobTitle: '',
    mvpAwardTitle: '',
    mvpScore: '',
    mvpReason: '',
    mvpIsVerified: true,
  });

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

  const fetchAvailableUsers = async () => {
    try {
      const first = await usersApi.list({ limit: 100 });
      const remaining = await Promise.all(Array.from(
        { length: Math.max(0, (first.pagination?.totalPages || 1) - 1) },
        (_, index) => usersApi.list({ limit: 100, page: index + 2 }),
      ));
      setAvailableUsers([...(first.data || []), ...remaining.flatMap((res) => res.data || [])]);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể tải danh sách thành viên'));
    }
  };

  const fetchSpotlightAndArchives = useCallback(async () => {
    try {
      setLoadingSpotlight(true);
      setLoadingArchives(true);
      const [spotlightData, archivesData] = await Promise.all([
        competition.adminGetSpotlight().catch(() => null),
        competition.adminGetSpotlightArchives().catch(() => []),
      ]);
      if (spotlightData) {
        setSpotlightConfig({
          teamId: spotlightData.teamId || '',
          userId: spotlightData.userId || '',
          teamTitle: spotlightData.teamTitle || '',
          mvpTitle: spotlightData.mvpTitle || '',
          mvpReason: spotlightData.mvpReason || '',
        });
      }
      setArchives(archivesData || []);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể tải dữ liệu Spotlight'));
    } finally {
      setLoadingSpotlight(false);
      setLoadingArchives(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSeasons();
    fetchAvailableTeams();
    fetchAvailableUsers();
  }, [fetchSeasons]);

  useEffect(() => {
    if (mainTab === 'spotlight') {
      fetchSpotlightAndArchives();
    }
  }, [mainTab, fetchSpotlightAndArchives]);


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

  const handleOpenAddArchive = () => {
    setEditingArchive(null);
    setArchiveForm({
      year: 2025,
      label: 'Mùa Giải Vinh Danh 2025',
      teamName: '',
      teamTitle: 'Nhà Vô Địch Mùa Giải 2025',
      memberIds: [],
      legacyMembers: [],
      mvpUserId: '',
      mvpJobTitle: 'Nhân viên',
      mvpAwardTitle: 'MVP Mùa Giải 2025',
      mvpScore: 0,
      mvpReason: 'Đóng góp xuất sắc trong năm 2025',
      mvpIsVerified: true,
    });
    setShowArchiveModal(true);
  };

  const handleOpenEditArchive = (item) => {
    setEditingArchive(item);
    const members = Array.isArray(item.championTeam?.members) ? item.championTeam.members : [];
    setArchiveForm({
      year: item.year,
      label: item.label || '',
      teamName: item.championTeam?.teamName || '',
      teamTitle: item.championTeam?.title || '',
      memberIds: members.filter((m) => m.userId || m.id).map((m) => String(m.userId || m.id)),
      legacyMembers: members.filter((m) => !m.userId && !m.id),
      mvpUserId: item.mvp?.userId ? String(item.mvp.userId) : '',
      mvpJobTitle: item.mvp?.jobTitle || '',
      mvpAwardTitle: item.mvp?.awardTitle || '',
      mvpScore: item.mvp?.score || 0,
      mvpReason: item.mvp?.reason || '',
      mvpIsVerified: Boolean(item.mvp?.isVerified),
    });
    setShowArchiveModal(true);
  };

  const handleSaveArchive = async (e) => {
    e.preventDefault();
    if (!archiveForm.year) {
      toast.warning('Năm là bắt buộc.');
      return;
    }
    if (!archiveForm.mvpUserId) {
      toast.warning('Vui lòng chọn tài khoản MVP.');
      return;
    }
    setSavingArchive(true);
    try {
      const members = [
        ...archiveForm.memberIds.map((id) => ({ userId: Number(id) })),
        ...archiveForm.legacyMembers,
      ];

      const payload = {
        year: Number(archiveForm.year),
        label: archiveForm.label || `Mùa Giải Vinh Danh ${archiveForm.year}`,
        championTeam: {
          teamName: archiveForm.teamName || `Đội Quán Quân ${archiveForm.year}`,
          title: archiveForm.teamTitle || `Nhà Vô Địch Mùa Giải ${archiveForm.year}`,
          members,
        },
        mvp: {
          userId: Number(archiveForm.mvpUserId),
          jobTitle: archiveForm.mvpJobTitle || 'Nhân viên',
          awardTitle: archiveForm.mvpAwardTitle || `MVP Mùa Giải ${archiveForm.year}`,
          score: Number(archiveForm.mvpScore || 0),
          reason: archiveForm.mvpReason || 'Đóng góp xuất sắc trong mùa giải',
          isVerified: Boolean(archiveForm.mvpIsVerified),
        },
      };

      await competition.adminSaveSpotlightArchive(payload);
      toast.success(`Đã lưu vinh danh năm ${archiveForm.year} thành công!`);
      setShowArchiveModal(false);
      await fetchSpotlightAndArchives();
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể lưu vinh danh lịch sử'));
    } finally {
      setSavingArchive(false);
    }
  };

  const handleDeleteArchive = async (year) => {
    const ok = await confirm({
      title: `Xoá vinh danh năm ${year}`,
      message: `Bạn có chắc muốn xoá toàn bộ thông tin vinh danh lịch sử của năm ${year} khỏi trang chủ không?`,
      confirmText: 'Xoá vinh danh',
      cancelText: 'Huỷ',
      type: 'danger',
    });
    if (!ok) return;

    try {
      await competition.adminDeleteSpotlightArchive(year);
      toast.success(`Đã xoá vinh danh năm ${year}`);
      await fetchSpotlightAndArchives();
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể xoá vinh danh'));
    }
  };

  const handleSaveCustomSpotlight = async (e) => {
    e.preventDefault();
    setSavingSpotlight(true);
    try {
      await competition.adminSetSpotlight({
        teamId: spotlightConfig.teamId ? Number(spotlightConfig.teamId) : null,
        userId: spotlightConfig.userId ? Number(spotlightConfig.userId) : null,
        teamTitle: spotlightConfig.teamTitle || null,
        mvpTitle: spotlightConfig.mvpTitle || null,
        mvpReason: spotlightConfig.mvpReason || null,
      });
      toast.success('Đã lưu cấu hình vinh danh trang chủ!');
      await fetchSpotlightAndArchives();
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể lưu cấu hình'));
    } finally {
      setSavingSpotlight(false);
    }
  };

  const handleResetCustomSpotlight = async () => {
    const ok = await confirm({
      title: 'Khôi phục tự động',
      message: 'Hệ thống sẽ tự động xác định Đội Quán quân và MVP từ mùa giải chốt gần nhất. Tiếp tục?',
      confirmText: 'Khôi phục tự động',
      cancelText: 'Huỷ',
    });
    if (!ok) return;

    setSavingSpotlight(true);
    try {
      await competition.adminSetSpotlight({ clear: true });
      toast.success('Đã chuyển về chế độ tự động từ mùa giải gần nhất!');
      setSpotlightConfig({ teamId: '', userId: '', teamTitle: '', mvpTitle: '', mvpReason: '' });
      await fetchSpotlightAndArchives();
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể khôi phục tự động'));
    } finally {
      setSavingSpotlight(false);
    }
  };


  const filteredSeasons = filterStatus === 'ALL'
    ? seasons
    : seasons.filter((s) => s.status === filterStatus);

  return (
    <div className="admin-data-page" style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trophy size={22} color="#f97316" />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Quản Lý Mùa Giải & Vinh Danh</h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Thiết lập lịch trình, đội tham gia, đóng băng kết quả, và quản lý vinh danh trang chủ các năm.
          </p>
        </div>

        {mainTab === 'seasons' ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setSelectedSeasonForMvp(null);
                setShowMvpModal(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: '#7c3aed',
                borderColor: 'rgba(124,58,237,0.3)',
                background: 'rgba(124,58,237,0.06)',
              }}
            >
              <Trophy size={16} /> Trao Cúp MVP
            </Button>
            <Button variant="primary" size="md" onClick={() => setShowCreateModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={16} /> Tạo Mùa Giải Mới
            </Button>
            <Button variant="secondary" size="md" onClick={fetchSeasons}>
              <RefreshCw size={14} />
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="primary" size="md" onClick={handleOpenAddArchive} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={16} /> Thêm Vinh Danh Năm
            </Button>
            <Button variant="secondary" size="md" onClick={fetchSpotlightAndArchives}>
              <RefreshCw size={14} />
            </Button>
          </div>
        )}
      </div>

      {/* Main Mode Navigation */}
      <div style={{ marginBottom: 20 }}>
        <SegmentedControl
          ariaLabel="Phân hệ Quản trị"
          options={[
            { key: 'seasons', label: `Quản Lý Mùa Giải (${seasons.length})` },
            { key: 'spotlight', label: `Vinh Danh Trang Chủ & Lịch Sử (${archives.length})` },
          ]}
          value={mainTab}
          onChange={setMainTab}
        />
      </div>

      <TabTransition key={mainTab} minHeight={420}>
        {mainTab === 'seasons' ? (
          <div>
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
                        color: s.status === 'ACTIVE' ? '#16a34a' : s.status === 'PAUSED' ? '#ca8a04' : 'var(--text-secondary)',
                      }}
                    >
                      {s.status}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.seasonType}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>• Slug: <code>{s.slug}</code></span>
                  </div>

                  <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>{s.name}</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>{s.description || 'Chưa có mô tả'}</p>

                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={13} color="var(--text-secondary)" /> Bắt đầu: <strong>{new Date(s.startAt).toLocaleString()}</strong>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} color="var(--text-secondary)" /> Kết thúc: <strong>{new Date(s.endAt).toLocaleString()}</strong>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} color="var(--text-secondary)" /> Grace: <strong>{s.gracePeriodHours} giờ</strong>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Users size={13} color="var(--text-secondary)" /> Đội tham gia: <strong>{s.teams?.length || 0} đội</strong>
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
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedSeasonForMvp(s.id);
                          setShowMvpModal(true);
                        }}
                        style={{ color: '#7c3aed', borderColor: 'rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.06)' }}
                      >
                        <Trophy size={14} /> Trao Cúp MVP
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
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedSeasonForMvp(s.id);
                          setShowMvpModal(true);
                        }}
                        style={{ color: '#7c3aed', borderColor: 'rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.06)' }}
                      >
                        <Trophy size={14} /> Trao Cúp MVP
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={statusChangingId === s.id}
                        onClick={() => handleStatusChange(s.id, 'ARCHIVED')}
                      >
                        <Archive size={14} /> {statusChangingId === s.id ? 'Đang lưu trữ...' : 'Lưu trữ (Archive)'}
                      </Button>
                    </>
                  )}

                  {s.status === 'ARCHIVED' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedSeasonForMvp(s.id);
                        setShowMvpModal(true);
                      }}
                      style={{ color: '#7c3aed', borderColor: 'rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.06)' }}
                    >
                      <Trophy size={14} /> Xem Cúp MVP
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* CARD 1: Lịch Sử Vinh Danh Các Năm */}
      <Card style={{ padding: 24, border: '1px solid rgba(15,23,42,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={18} className="text-amber-600" />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Lịch Sử Vinh Danh Các Năm (Historical Archives)
              </h2>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Các mùa giải đã lưu (như 2025, 2024...) sẽ được hiển thị ngay bên dưới mùa hiện tại trên Trang Chủ.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={handleOpenAddArchive} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Thêm Năm Mới
          </Button>
        </div>

        {loadingArchives ? (
          <PageState type="loading" title="Đang tải danh sách lịch sử..." />
        ) : archives.length === 0 ? (
          <EmptyState
            icon={History}
            compact
            title="Chưa có dữ liệu vinh danh lịch sử"
            description="Bấm nút Thêm Năm Mới ở trên để nhập thông tin Đội Quán quân và MVP năm 2025."
            action={
              <Button variant="secondary" size="sm" onClick={handleOpenAddArchive} style={{ marginTop: 8 }}>
                + Thêm Vinh Danh Năm 2025
              </Button>
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {archives.map((item) => (
              <div
                key={item.year}
                style={{
                  border: '1px solid rgba(15,23,42,0.08)',
                  borderRadius: 12,
                  padding: '16px 20px',
                  background: '#fafafa',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 16,
                }}
              >
                <div style={{ minWidth: 260, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', fontFamily: 'monospace' }}>
                      {item.year}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {item.label || `Mùa Giải ${item.year}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <div>
                      <strong style={{ color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Trophy size={13} color="#d97706" /> Quán quân:
                      </strong>{' '}
                      {item.championTeam?.teamName || '—'}{' '}
                      {Array.isArray(item.championTeam?.members) && item.championTeam.members.length > 0 && (
                        <span style={{ color: 'var(--text-secondary)' }}>
                          ({item.championTeam.members.length} thành viên)
                        </span>
                      )}
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Star size={13} color="#eab308" /> MVP:
                      </strong>{' '}
                      {item.mvp?.name || '—'}{' '}
                      {item.mvp?.jobTitle && <span style={{ color: 'var(--text-secondary)' }}>({item.mvp.jobTitle})</span>}{' '}
                      {item.mvp?.score > 0 && <span style={{ color: '#7c3aed', fontWeight: 600 }}>· {item.mvp.score.toLocaleString()} pts</span>}
                    </div>
                  </div>
                  {item.mvp?.reason && (
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '4px 0 0 0', fontStyle: 'italic' }}>
                      “{item.mvp.reason}”
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenEditArchive(item)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <Edit3 size={13} /> Sửa
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDeleteArchive(item.year)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#dc2626', borderColor: 'rgba(220,38,38,0.2)' }}
                  >
                    <Trash2 size={13} /> Xoá
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* CARD 2: Cấu hình Đè Thủ Công Mùa Hiện Tại */}
      <Card style={{ padding: 24, border: '1px solid rgba(15,23,42,0.08)' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} className="text-purple-600" />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Cấu Hình Vinh Danh Mùa Hiện Tại (Tùy Chọn Đè Thủ Công)
            </h2>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Mặc định hệ thống tự động chọn Đội Quán quân và MVP từ mùa giải chốt gần nhất. Nếu muốn chỉ định thủ công đội/cá nhân trên Trang Chủ, điền vào form bên dưới.
          </p>
        </div>

        <form onSubmit={handleSaveCustomSpotlight} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-amber-50/40 rounded-xl border border-amber-200/50 flex flex-col gap-3">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <Trophy size={14} className="text-amber-600" /> Đội Nhóm Quán Quân
              </h4>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Chọn Đội (Team)</label>
                <select
                  value={spotlightConfig.teamId}
                  onChange={(e) => setSpotlightConfig({ ...spotlightConfig, teamId: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Tự động từ mùa giải gần nhất --</option>
                  {availableTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Tiêu đề vinh danh Đội (Tuỳ chỉnh)</label>
                <input
                  type="text"
                  placeholder="Mặc định: Nhà Vô Địch Mùa Giải"
                  value={spotlightConfig.teamTitle}
                  onChange={(e) => setSpotlightConfig({ ...spotlightConfig, teamTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="p-3 bg-purple-50/40 rounded-xl border border-purple-200/50 flex flex-col gap-3">
              <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                <Star size={14} className="text-purple-600" /> Cá Nhân MVP
              </h4>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Chọn Cá nhân (User)</label>
                <select
                  value={spotlightConfig.userId}
                  onChange={(e) => setSpotlightConfig({ ...spotlightConfig, userId: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                >
                  <option value="">-- Tự động từ mùa giải gần nhất --</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.jobTitle || 'Nhân viên'})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Tiêu đề vinh danh MVP (Tuỳ chỉnh)</label>
                <input
                  type="text"
                  placeholder="Mặc định: MVP Mùa Giải"
                  value={spotlightConfig.mvpTitle}
                  onChange={(e) => setSpotlightConfig({ ...spotlightConfig, mvpTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Lý do vinh danh (Tuỳ chỉnh)</label>
                <textarea
                  rows={2}
                  placeholder="Lý do vinh danh xuất hiện trên Trang Chủ"
                  value={spotlightConfig.mvpReason}
                  onChange={(e) => setSpotlightConfig({ ...spotlightConfig, mvpReason: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button
              variant="secondary"
              type="button"
              onClick={handleResetCustomSpotlight}
              disabled={savingSpotlight}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RotateCcw size={14} /> Khôi phục Tự Động
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={savingSpotlight}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Save size={14} /> {savingSpotlight ? 'Đang lưu...' : 'Lưu Cấu Hình'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )}
</TabTransition>


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

      {/* MVP CUP AWARD MODAL */}
      <MvpCupAwardModal
        isOpen={showMvpModal}
        onClose={() => setShowMvpModal(false)}
        defaultSeasonId={selectedSeasonForMvp}
        onSuccess={fetchSeasons}
      />

      {/* HISTORICAL ARCHIVE MODAL */}
      <AnimatedModal
        isOpen={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        title={editingArchive ? `Chỉnh Sửa Vinh Danh Năm ${archiveForm.year}` : 'Thêm Mới Vinh Danh Năm Lịch Sử'}
        maxWidth={640}
      >
        <form onSubmit={handleSaveArchive} className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Năm vinh danh *</label>
              <input
                type="number"
                required
                min={2000}
                max={2100}
                placeholder="2025"
                value={archiveForm.year}
                onChange={(e) => setArchiveForm({ ...archiveForm, year: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Tên mùa giải hiển thị</label>
              <input
                type="text"
                placeholder="Ví dụ: Mùa Giải Vinh Danh 2025"
                value={archiveForm.label}
                onChange={(e) => setArchiveForm({ ...archiveForm, label: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/60 flex flex-col gap-3">
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
              <Trophy size={14} className="text-amber-600" /> Đội Nhóm Quán Quân
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Tên Đội / Squad</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Team Sáng Tạo 2025"
                  value={archiveForm.teamName}
                  onChange={(e) => setArchiveForm({ ...archiveForm, teamName: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Danh hiệu đội</label>
                <input
                  type="text"
                  placeholder="Nhà Vô Địch Mùa Giải 2025"
                  value={archiveForm.teamTitle}
                  onChange={(e) => setArchiveForm({ ...archiveForm, teamTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            <div>
              <span id="archive-members-label" className="text-xs font-semibold text-slate-700 block mb-1">Thành viên đội ({archiveForm.memberIds.length} đã chọn)</span>
              <div role="group" aria-labelledby="archive-members-label" className="max-h-48 overflow-y-auto bg-white border border-slate-300 rounded-lg p-2">
                {availableUsers.map((user) => (
                  <label key={user.id} className="flex items-center gap-2 p-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={archiveForm.memberIds.includes(String(user.id))}
                      onChange={(e) => setArchiveForm((form) => ({
                        ...form,
                        memberIds: e.target.checked
                          ? [...form.memberIds, String(user.id)]
                          : form.memberIds.filter((id) => id !== String(user.id)),
                      }))}
                    />
                    <span className="min-w-0 break-words">{user.name} · #{user.id}{user.teamName ? ` · ${user.teamName}` : ''}</span>
                  </label>
                ))}
                {archiveForm.memberIds.filter((id) => !availableUsers.some((user) => String(user.id) === id)).map((id) => (
                  <label key={id} className="flex items-center gap-2 p-2 text-sm">
                    <input type="checkbox" checked onChange={() => setArchiveForm((form) => ({
                      ...form, memberIds: form.memberIds.filter((memberId) => memberId !== id),
                    }))} />
                    <span className="min-w-0 break-words">
                      {editingArchive?.championTeam?.members?.find((m) => String(m.userId || m.id) === id)?.name || `Thành viên #${id}`} (không có trong danh sách hiện tại)
                    </span>
                  </label>
                ))}
                {availableUsers.length === 0 && <p className="text-xs text-slate-500 p-2">Chưa tải được danh sách thành viên.</p>}
              </div>
              {archiveForm.legacyMembers.length > 0 && (
                <div className="mt-2 text-xs text-amber-800">
                  <p>Thành viên cũ chưa liên kết tài khoản:</p>
                  {archiveForm.legacyMembers.map((member, index) => (
                    <label key={index} className="flex items-center gap-2 py-1">
                      <input type="checkbox" checked onChange={() => setArchiveForm((form) => ({
                        ...form, legacyMembers: form.legacyMembers.filter((_, i) => i !== index),
                      }))} />
                      {typeof member === 'string' ? member : member.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200/60 flex flex-col gap-3">
            <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
              <Star size={14} className="text-purple-600" /> Cá Nhân MVP
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="archive-mvp-user" className="text-xs font-semibold text-slate-700 block mb-1">Cá nhân MVP *</label>
                <select
                  id="archive-mvp-user"
                  required
                  value={archiveForm.mvpUserId}
                  onChange={(e) => {
                    const user = availableUsers.find((u) => String(u.id) === e.target.value);
                    setArchiveForm({ ...archiveForm, mvpUserId: e.target.value,
                      mvpJobTitle: user?.jobTitle || '', mvpIsVerified: Boolean(user?.isVerified) });
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                >
                  <option value="">-- Chọn thành viên --</option>
                  {availableUsers.map((user) => <option key={user.id} value={user.id}>{user.name} · #{user.id}</option>)}
                  {archiveForm.mvpUserId && !availableUsers.some((u) => String(u.id) === archiveForm.mvpUserId) && (
                    <option value={archiveForm.mvpUserId}>{editingArchive?.mvp?.name} · #{archiveForm.mvpUserId}</option>
                  )}
                </select>
                {editingArchive?.mvp?.name && !editingArchive.mvp.userId && (
                  <p className="text-xs text-amber-800 mt-1">MVP cũ: {editingArchive.mvp.name} (chưa liên kết tài khoản)</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Chức danh / Vị trí</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Video Editor & Producer"
                  value={archiveForm.mvpJobTitle}
                  onChange={(e) => setArchiveForm({ ...archiveForm, mvpJobTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Danh hiệu MVP</label>
                <input
                  type="text"
                  placeholder="MVP Mùa Giải 2025"
                  value={archiveForm.mvpAwardTitle}
                  onChange={(e) => setArchiveForm({ ...archiveForm, mvpAwardTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Điểm số mùa giải</label>
                <input
                  type="number"
                  min={0}
                  placeholder="12500"
                  value={archiveForm.mvpScore}
                  onChange={(e) => setArchiveForm({ ...archiveForm, mvpScore: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Lý do vinh danh</label>
              <textarea
                rows={2}
                placeholder="Đóng góp vượt bậc cho sự phát triển của công ty trong năm 2025"
                value={archiveForm.mvpReason}
                onChange={(e) => setArchiveForm({ ...archiveForm, mvpReason: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={archiveForm.mvpIsVerified}
                onChange={(e) => setArchiveForm({ ...archiveForm, mvpIsVerified: e.target.checked })}
                className="rounded text-purple-600 focus:ring-purple-500"
              />
              Hiển thị tích xanh xác minh (Verified Badge)
            </label>
          </div>

          <div className="flex justify-end gap-2.5 mt-2">
            <Button variant="secondary" type="button" onClick={() => setShowArchiveModal(false)}>Huỷ</Button>
            <Button variant="primary" type="submit" disabled={savingArchive}>
              {savingArchive ? 'Đang lưu...' : 'Lưu Vinh Danh'}
            </Button>
          </div>
        </form>
      </AnimatedModal>
    </div>
  );
}
