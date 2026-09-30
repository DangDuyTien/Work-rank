import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Activity,
  Search,
  RefreshCw,
  Layers,
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  Database,
  RotateCcw,
  BarChart3,
  Trophy,
  Zap,
  CheckCircle2,
  XCircle,
  Code,
  Play,
  GitCompare,
  Plus,
  Trash2,
  Copy,
  Save,
  FileText,
  Sliders,
  Edit,
  ArrowRight,
  Radio,
  Tv,
  Video,
  Share2,
  HeartHandshake,
  Terminal,
  Filter,
  Crown,
  X,
  Sparkles,
} from 'lucide-react';
import { competition } from '../services/api';
import { useToast } from '../context/UiContext';
import { parseApiError } from '../utils/errors';
import { Card, EmptyState, PageState, Button, SegmentedControl, TabTransition } from '../components/ui';

const CONDITION_OPERATORS = [
  { value: 'EQ', label: 'Bằng (==)' },
  { value: 'NEQ', label: 'Khác (!=)' },
  { value: 'GT', label: 'Lớn hơn (>)' },
  { value: 'GTE', label: 'Lớn hơn hoặc bằng (>=)' },
  { value: 'LT', label: 'Nhỏ hơn (<)' },
  { value: 'LTE', label: 'Nhỏ hơn hoặc bằng (<=)' },
  { value: 'IN', label: 'Nằm trong tập (IN)' },
  { value: 'NOT_IN', label: 'Không nằm trong tập (NOT IN)' },
  { value: 'CONTAINS', label: 'Chứa chuỗi (CONTAINS)' },
  { value: 'IS_WEEKEND', label: 'Là ngày cuối tuần' },
  { value: 'IS_BETWEEN', label: 'Trong khoảng số [A..B]' },
  { value: 'IS_TIME_BETWEEN', label: 'Khung giờ [HH:MM..HH:MM]' },
  { value: 'IS_NULL', label: 'Rỗng (NULL)' },
  { value: 'IS_NOT_NULL', label: 'Có giá trị (NOT NULL)' },
];

const ACTION_TYPES = [
  { value: 'ADD', label: 'Cộng điểm (+)' },
  { value: 'SUBTRACT', label: 'Trừ điểm (-)' },
  { value: 'MULTIPLY', label: 'Nhân hệ số (x)' },
  { value: 'DISTRIBUTE', label: 'Phân phối cho thành viên' },
];

const EFFECT_TYPES = [
  { value: 'INDIVIDUAL_XP', label: 'Điểm Cá Nhân (Individual XP)' },
  { value: 'TEAM_SCORE', label: 'Điểm Đội Nhóm (Team Score)' },
];

const FIELD_SUGGESTIONS = [
  'event.event_type',
  'event.payload.duration',
  'event.payload.quality_score',
  'event.payload.status',
  'event.payload.count',
  'event.occurred_at',
  'event.actor_id',
  'event.team_id',
  'context.season.id',
];

export default function CompetitionAdmin() {
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'rules' | 'projections' | 'states' | 'inspector'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Tab 1: Analytics Data
  const [adminDash, setAdminDash] = useState(null);

  // Tab 2: Rule Builder Data
  const [ruleSets, setRuleSets] = useState([]);
  const [selectedRuleSet, setSelectedRuleSet] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [builderModalOpen, setBuilderModalOpen] = useState(false);
  const [simulatorModalOpen, setSimulatorModalOpen] = useState(false);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [createRuleSetModalOpen, setCreateRuleSetModalOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishReason, setPublishReason] = useState('');

  // Builder Form State
  const [newRsName, setNewRsName] = useState('');
  const [newRsCode, setNewRsCode] = useState('');
  const [newRsDesc, setNewRsDesc] = useState('');
  const [builderRules, setBuilderRules] = useState([]);
  const [builderEffectiveFrom, setBuilderEffectiveFrom] = useState('');
  const [builderEffectiveTo, setBuilderEffectiveTo] = useState('');
  const [builderTab, setBuilderTab] = useState('visual'); // 'visual' | 'json'
  const [validationResult, setValidationResult] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Simulator State
  const [simEventPayload, setSimEventPayload] = useState(
    JSON.stringify({ event_type: 'VIDEO_SUBMITTED', payload: { quality_score: 90, duration: 120 } }, null, 2),
  );
  const [simResult, setSimResult] = useState(null);
  const [simLoading, setSimLoading] = useState(false);

  // Diff State
  const [diffVersionA, setDiffVersionA] = useState('');
  const [diffVersionB, setDiffVersionB] = useState('');
  const [diffResult, setDiffResult] = useState(null);
  const [diffLoading, setDiffLoading] = useState(false);

  // Tab 3: Projections Data
  const [projStatus, setProjStatus] = useState(null);
  const [consistencyReport, setConsistencyReport] = useState(null);
  const [rebuildModalOpen, setRebuildModalOpen] = useState(false);
  const [rebuildReason, setRebuildReason] = useState('');
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [rebuildSuccessMsg, setRebuildSuccessMsg] = useState(null);

  // Tab 4: States Data
  const [states, setStates] = useState([]);
  const [totalStates, setTotalStates] = useState(0);
  const [entityFilter, setEntityFilter] = useState('all');

  // Tab 5: Score Inspector Data
  const [inspectUserId, setInspectUserId] = useState('');
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectResult, setInspectResult] = useState(null);

  // Tab 6: Integration Monitor & Event Tracing (Phase 8)
  const [integrationHealth, setIntegrationHealth] = useState(null);
  const [integrationEvents, setIntegrationEvents] = useState([]);
  const [integrationTotal, setIntegrationTotal] = useState(0);
  const [integrationSourceFilter, setIntegrationSourceFilter] = useState('all');
  const [integrationStatusFilter, setIntegrationStatusFilter] = useState('all');
  const [integrationSearch, setIntegrationSearch] = useState('');
  const [traceModalOpen, setTraceModalOpen] = useState(false);
  const [traceData, setTraceData] = useState(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [retryModalOpen, setRetryModalOpen] = useState(false);
  const [retryEventId, setRetryEventId] = useState(null);
  const [retryReason, setRetryReason] = useState('');
  const [retryLoading, setRetryLoading] = useState(false);
  const [simEventModalOpen, setSimEventModalOpen] = useState(false);
  const [simModuleType, setSimModuleType] = useState('production');
  const [simActionType, setSimActionType] = useState('video_approved');
  const [simVideoId, setSimVideoId] = useState(101);
  const [simTitle, setSimTitle] = useState('Demo Video Production');
  const [simViews, setSimViews] = useState(100000);
  const [simKudosRecipientId, setSimKudosRecipientId] = useState(2);
  const [simKudosReason, setSimKudosReason] = useState('Tuyệt vời trong phối hợp làm việc!');
  const [simActionLoading, setSimActionLoading] = useState(false);
  const [simActionSuccess, setSimActionSuccess] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await competition.adminGetDashboard();
      setAdminDash(res);
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || 'Không thể tải dữ liệu Analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRuleSets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await competition.adminListRuleSets();
      setRuleSets(res);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tải danh sách Rule Sets');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProjections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [statusRes, consistencyRes] = await Promise.all([
        competition.adminGetProjectionsStatus(),
        competition.adminCheckProjectionsConsistency(),
      ]);
      setProjStatus(statusRes);
      setConsistencyReport(consistencyRes);
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.error || 'Không thể tải trạng thái Projections');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (entityFilter !== 'all') params.entity_type = entityFilter;
      const res = await competition.adminListStates(params);
      setStates(res.states || []);
      setTotalStates(res.total || 0);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tải danh sách trạng thái thi đấu');
    } finally {
      setLoading(false);
    }
  }, [entityFilter]);

  const fetchIntegrationData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [healthRes, eventsRes] = await Promise.all([
        competition.adminGetIntegrationHealth(),
        competition.adminListIntegrationEvents({
          sourceModule: integrationSourceFilter !== 'all' ? integrationSourceFilter : undefined,
          status: integrationStatusFilter !== 'all' ? integrationStatusFilter : undefined,
        }),
      ]);
      setIntegrationHealth(healthRes);
      setIntegrationEvents(eventsRes.events || []);
      setIntegrationTotal(eventsRes.totalEvents || 0);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tải dữ liệu Integration Monitor');
    } finally {
      setLoading(false);
    }
  }, [integrationSourceFilter, integrationStatusFilter]);

  useEffect(() => {
    if (activeTab === 'analytics') fetchAnalytics();
    else if (activeTab === 'rules') fetchRuleSets();
    else if (activeTab === 'integration') fetchIntegrationData();
    else if (activeTab === 'projections') fetchProjections();
    else if (activeTab === 'states') fetchStates();
  }, [activeTab, fetchAnalytics, fetchRuleSets, fetchIntegrationData, fetchProjections, fetchStates]);

  const handleOpenTrace = async (eventId) => {
    try {
      setTraceLoading(true);
      setTraceData(null);
      setTraceModalOpen(true);
      const trace = await competition.getEventTrace(eventId);
      setTraceData(trace);
    } catch (err) {
      alert(err?.response?.data?.message || 'Không thể tải Event Trace');
      setTraceModalOpen(false);
    } finally {
      setTraceLoading(false);
    }
  };

  const handleOpenRetry = (eventId) => {
    setRetryEventId(eventId);
    setRetryReason('');
    setRetryModalOpen(true);
  };

  const handleSubmitRetry = async (e) => {
    e?.preventDefault();
    if (!retryReason.trim()) {
      alert('Vui lòng nhập lý do Audit bắt buộc');
      return;
    }
    try {
      setRetryLoading(true);
      await competition.adminRetryIntegrationEvent(retryEventId, retryReason.trim());
      setRetryModalOpen(false);
      fetchIntegrationData();
      alert('Đã thiết lập lại trạng thái PENDING cho sự kiện. Worker sẽ đánh giá lại trong lượt kế tiếp.');
    } catch (err) {
      alert(err?.response?.data?.message || 'Không thể retry sự kiện');
    } finally {
      setRetryLoading(false);
    }
  };

  const handleTriggerSimAction = async () => {
    try {
      setSimActionLoading(true);
      setSimActionSuccess(null);
      let res;
      if (simModuleType === 'production') {
        res = await competition.triggerProductionAction({
          action: simActionType,
          videoId: simVideoId,
          title: simTitle,
          actorId: 1,
          teamId: 1,
          duration: 120,
          qualityScore: 95,
          score: 100,
        });
      } else if (simModuleType === 'youtube') {
        res = await competition.triggerYouTubeMilestone({
          type: simActionType,
          youtubeVideoId: `yt_${simVideoId}`,
          channelId: 'channel_main_01',
          title: simTitle,
          views: simViews,
          subscribers: 50000,
          actorId: 1,
          teamId: 1,
        });
      } else {
        res = await competition.triggerCommunityKudos({
          senderId: 1,
          recipientId: simKudosRecipientId,
          reason: simKudosReason,
          kudosType: 'recognition',
        });
      }
      setSimActionSuccess('Bắn sự kiện thành công! Sự kiện đã được lưu vào Event Store và đưa vào luồng chấm điểm.');
      fetchIntegrationData();
    } catch (err) {
      alert(err?.response?.data?.message || 'Bắn sự kiện thất bại');
    } finally {
      setSimActionLoading(false);
    }
  };

  // Open Visual Builder for a version
  const handleOpenBuilder = async (ruleSetId, version = null) => {
    try {
      setActionLoading(true);
      const rs = await competition.adminGetRuleSet(ruleSetId);
      setSelectedRuleSet(rs);

      let ver = version;
      if (!ver && rs.versions?.length > 0) {
        ver = rs.versions[0];
      }

      if (ver) {
        setSelectedVersion(ver);
        setBuilderRules(ver.astPayload || []);
        setBuilderEffectiveFrom(ver.effectiveFrom ? new Date(ver.effectiveFrom).toISOString().slice(0, 16) : '');
        setBuilderEffectiveTo(ver.effectiveTo ? new Date(ver.effectiveTo).toISOString().slice(0, 16) : '');
      } else {
        setSelectedVersion(null);
        setBuilderRules([]);
        setBuilderEffectiveFrom(new Date().toISOString().slice(0, 16));
        setBuilderEffectiveTo('');
      }

      setValidationResult(null);
      setBuilderModalOpen(true);
    } catch (err) {
      alert(err?.response?.data?.message || 'Không thể mở Rule Builder');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateRuleSet = async (e) => {
    e?.preventDefault();
    if (!newRsName.trim() || !newRsCode.trim()) {
      alert('Vui lòng nhập Tên và Mã Rule Set');
      return;
    }
    try {
      setActionLoading(true);
      await competition.adminCreateRuleSet({
        name: newRsName.trim(),
        code: newRsCode.trim().toLowerCase().replace(/\s+/g, '_'),
        description: newRsDesc.trim(),
      });
      setCreateRuleSetModalOpen(false);
      setNewRsName('');
      setNewRsCode('');
      setNewRsDesc('');
      fetchRuleSets();
    } catch (err) {
      alert(err?.response?.data?.message || 'Tạo Rule Set thất bại');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddRuleBlock = () => {
    setBuilderRules([
      ...builderRules,
      {
        name: `Quy tắc #${builderRules.length + 1}`,
        condition_ast: {
          op: 'AND',
          conditions: [{ op: 'EQ', field: 'event.event_type', value: 'VIDEO_SUBMITTED' }],
        },
        action_ast: { type: 'ADD', value: 100 },
        effect_type: 'INDIVIDUAL_XP',
        multiplier: 1,
      },
    ]);
  };

  const handleRemoveRuleBlock = (index) => {
    setBuilderRules(builderRules.filter((_, idx) => idx !== index));
  };

  const handleValidateAST = async () => {
    try {
      setActionLoading(true);
      const res = await competition.adminValidateVersion(selectedRuleSet.id, selectedVersion?.id || 'temp', builderRules);
      setValidationResult(res);
    } catch (err) {
      setValidationResult({
        valid: false,
        errors: [err?.response?.data?.message || err.message],
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedRuleSet) return;
    try {
      setActionLoading(true);
      if (selectedVersion && selectedVersion.status === 'DRAFT') {
        // Update existing draft
        await competition.adminUpdateDraftVersion(selectedRuleSet.id, selectedVersion.id, {
          effectiveFrom: builderEffectiveFrom || new Date().toISOString(),
          effectiveTo: builderEffectiveTo || null,
          astPayload: builderRules,
        });
        alert('Lưu bản nháp thành công!');
      } else {
        // Create new draft version
        const newVer = await competition.adminCreateRuleSetVersion(selectedRuleSet.id, {
          effectiveFrom: builderEffectiveFrom || new Date().toISOString(),
          effectiveTo: builderEffectiveTo || null,
          astPayload: builderRules,
        });
        setSelectedVersion(newVer);
        alert('Tạo phiên bản nháp mới thành công!');
      }
      handleOpenBuilder(selectedRuleSet.id);
      fetchRuleSets();
    } catch (err) {
      alert(err?.response?.data?.message || 'Không thể lưu bản nháp');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublishVersion = async () => {
    if (!selectedVersion || !selectedRuleSet) return;
    if (!publishReason.trim()) {
      alert('Vui lòng nhập lý do xuất bản bắt buộc');
      return;
    }
    try {
      setActionLoading(true);
      await competition.adminPublishRuleSetVersion(selectedRuleSet.id, selectedVersion.id, publishReason.trim());
      alert(`Đã xuất bản Version #${selectedVersion.versionNumber} thành công!`);
      setPublishModalOpen(false);
      setPublishReason('');
      setBuilderModalOpen(false);
      fetchRuleSets();
    } catch (err) {
      alert(err?.response?.data?.message || 'Xuất bản thất bại');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicateVersion = async (versionId) => {
    if (!selectedRuleSet) return;
    try {
      setActionLoading(true);
      const res = await competition.adminDuplicateVersion(selectedRuleSet.id, versionId);
      alert(`Đã nhân bản thành Version #${res.versionNumber} (Bản nháp)`);
      handleOpenBuilder(selectedRuleSet.id, res);
      fetchRuleSets();
    } catch (err) {
      alert(err?.response?.data?.message || 'Nhân bản thất bại');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunSimulator = async () => {
    let parsedPayload;
    try {
      parsedPayload = JSON.parse(simEventPayload);
    } catch (e) {
      alert('JSON Sự kiện mẫu không hợp lệ');
      return;
    }

    try {
      setSimLoading(true);
      const res = await competition.adminSimulateRule({
        astPayload: builderRules,
        eventPayload: parsedPayload,
      });
      setSimResult(res);
    } catch (err) {
      alert(err?.response?.data?.message || 'Lỗi chạy mô phỏng');
    } finally {
      setSimLoading(false);
    }
  };

  const handleRunDiff = async () => {
    if (!diffVersionA || !diffVersionB) {
      alert('Vui lòng chọn cả 2 phiên bản để so sánh');
      return;
    }
    try {
      setDiffLoading(true);
      const res = await competition.adminDiffVersions(selectedRuleSet.id, diffVersionA, diffVersionB);
      setDiffResult(res);
    } catch (err) {
      alert(err?.response?.data?.message || 'Lỗi so sánh phiên bản');
    } finally {
      setDiffLoading(false);
    }
  };

  const handleRebuildProjections = async () => {
    if (!rebuildReason.trim()) {
      alert('Vui lòng nhập lý do audit bắt buộc trước khi trigger rebuild');
      return;
    }
    try {
      setRebuildLoading(true);
      const res = await competition.adminRebuildProjections(rebuildReason.trim());
      setRebuildSuccessMsg(`Rebuild thành công trong ${res.durationMs}ms: ${res.usersRebuilt} users, ${res.teamsRebuilt} teams, ${res.seasonsRebuilt} seasons, ${res.grandsRebuilt} grands.`);
      setRebuildModalOpen(false);
      setRebuildReason('');
      fetchProjections();
    } catch (err) {
      alert(err?.response?.data?.error || err?.response?.data?.message || 'Rebuild thất bại');
    } finally {
      setRebuildLoading(false);
    }
  };

  const handleInspect = async (e) => {
    e?.preventDefault();
    if (!inspectUserId.trim()) return;
    try {
      setInspectLoading(true);
      const res = await competition.adminScoreInspect(inspectUserId.trim());
      setInspectResult(res);
    } catch (err) {
      alert(err?.response?.data?.message || 'Không tìm thấy dữ liệu điểm cho User ID này');
    } finally {
      setInspectLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px 0', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={22} color="#0284c7" />
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Quản Trị Thi Đấu & Visual Rule Builder
            </h1>
          </div>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>
            Visual Rule Builder, Trình mô phỏng tính điểm, Versioning, Read Models & Score Drill-down.
          </p>
        </div>

        <SegmentedControl
          ariaLabel="Admin Competition Tabs"
          options={[
            { key: 'analytics', label: 'Company Analytics' },
            { key: 'rules', label: `Rule Sets (${ruleSets.length})` },
            { key: 'integration', label: `Tích hợp & Events (${integrationTotal})` },
            { key: 'projections', label: 'Read Models' },
            { key: 'states', label: `State Monitor (${totalStates})` },
            { key: 'inspector', label: 'Score Inspector' },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      <TabTransition key={activeTab} minHeight={420}>
        {/* TAB 1: COMPANY ANALYTICS */}
        {activeTab === 'analytics' && (
        <div>
          {loading && !adminDash ? (
            <PageState type="loading" title="Đang tải dữ liệu tổng quan..." />
          ) : error ? (
            <PageState type="error" title="Lỗi" description={error} onRetry={fetchAnalytics} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                <Card style={{ padding: 18, background: 'linear-gradient(135deg, rgba(2,132,199,0.06), rgba(99,102,241,0.03))', border: '1px solid rgba(2,132,199,0.2)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', marginBottom: 6 }}>
                    Mùa Giải Đang Diễn Ra
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>
                    {adminDash?.seasonStats?.name || 'Không có mùa giải Active'}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span>Trạng thái: <strong>{adminDash?.seasonStats?.status || '—'}</strong></span>
                    <span>Đội tham gia: <strong>{adminDash?.seasonStats?.teamsCount || 0} teams</strong></span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Trophy size={13} color="#0284c7" /> Top 1 Đội: <strong>{adminDash?.seasonStats?.leaderTeam?.teamName || '—'}</strong> ({adminDash?.seasonStats?.leaderTeam?.score || 0} XP)
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Crown size={13} color="#f59e0b" /> Top 1 Cá Nhân: <strong>{adminDash?.seasonStats?.individualLeader?.name || '—'}</strong> ({adminDash?.seasonStats?.individualLeader?.points || 0} XP)
                    </span>
                  </div>
                </Card>

                <Card style={{ padding: 18, background: 'linear-gradient(135deg, rgba(249,115,22,0.06), rgba(234,88,12,0.03))', border: '1px solid rgba(249,115,22,0.2)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', marginBottom: 6 }}>
                    Grand Championship {adminDash?.grandStats?.year || '2026'}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>
                    {adminDash?.grandStats?.name || 'Grand Championship 2026'}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span>Tổng GP đã trao: <strong style={{ color: '#ea580c' }}>{adminDash?.grandStats?.totalGrandPointsAwarded || 0} GP</strong></span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Trophy size={13} color="#ea580c" /> Top 1 Đội Grand: <strong>{adminDash?.grandStats?.leaderTeam?.teamName || '—'}</strong> ({adminDash?.grandStats?.leaderTeam?.grandPoints || 0} GP)
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Crown size={13} color="#ea580c" /> Top 1 Cá Nhân Grand: <strong>{adminDash?.grandStats?.individualLeader?.name || '—'}</strong> ({adminDash?.grandStats?.individualLeader?.grandPoints || 0} GP)
                    </span>
                  </div>
                </Card>

                <Card style={{ padding: 18, background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                    Vận Tốc Sự Kiện (Event Throughput)
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>
                    {adminDash?.eventsToday || 0} <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>events/24h</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>
                    Hàng đợi Outbox: {adminDash?.outboxQueueSize || 0} pending (Hoạt động ổn định)
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RULE SETS & VISUAL RULE BUILDER */}
      {activeTab === 'rules' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Danh Sách Bộ Quy Tắc (Rule Sets)
            </h2>
            <Button variant="primary" onClick={() => setCreateRuleSetModalOpen(true)}>
              <Plus size={16} /> Tạo Rule Set Mới
            </Button>
          </div>

          {loading && ruleSets.length === 0 ? (
            <PageState type="loading" title="Đang tải danh sách Rule Sets..." />
          ) : ruleSets.length === 0 ? (
            <Card style={{ padding: 30 }}>
              <EmptyState title="Chưa có Rule Set nào" description="Hãy tạo một Rule Set đầu tiên để bắt đầu cấu hình quy tắc thi đấu trực quan." />
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {ruleSets.map((rs) => (
                <Card key={rs.id} style={{ padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>{rs.name}</span>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4, background: '#f1f5f9', color: '#475569' }}>
                        {rs.code}
                      </span>
                      {rs.publishedVersion ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(34,197,94,0.12)', color: '#16a34a' }}>
                          v{rs.publishedVersion.versionNumber} (Đang áp dụng)
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(234,179,8,0.15)', color: '#ca8a04' }}>
                          Chưa có bản Publish
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 6px 0' }}>{rs.description || 'Không có mô tả'}</p>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      Tổng số phiên bản: <strong>{rs.totalVersions}</strong> | Đang dùng bởi: <strong>{rs.usedInSeasonsCount} mùa giải</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Button variant="outline" onClick={() => handleOpenBuilder(rs.id)}>
                      <Sliders size={15} /> Mở Visual Builder
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        const detailed = await competition.adminGetRuleSet(rs.id);
                        setSelectedRuleSet(detailed);
                        if (detailed.versions?.length >= 2) {
                          setDiffVersionA(detailed.versions[1].id);
                          setDiffVersionB(detailed.versions[0].id);
                        }
                        setDiffResult(null);
                        setDiffModalOpen(true);
                      }}
                    >
                      <GitCompare size={15} /> Diff
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2.5: INTEGRATION MONITOR & EVENT TRACE (PHASE 8) */}
      {activeTab === 'integration' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header & Quick Action */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Radio size={18} color="#0284c7" />
                <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  Giám Sát Tích Hợp & Truy Vết Sự Kiện (Integration Monitor & Event Trace)
                </h2>
              </div>
              <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0 0' }}>
                Truy vết toàn bộ luồng sự kiện từ Production, YouTube, Community đến Rule Engine và Score Ledger.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" onClick={() => fetchIntegrationData()}>
                <RefreshCw size={15} /> Làm Mới
              </Button>
              <Button variant="primary" onClick={() => { setSimActionSuccess(null); setSimEventModalOpen(true); }}>
                <Zap size={15} /> Bắn Sự Kiện Thử Nghiệm
              </Button>
            </div>
          </div>

          {/* Health Metrics Cards */}
          {integrationHealth && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <Card style={{ padding: 16, border: `1px solid ${integrationHealth.status === 'HEALTHY' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, background: integrationHealth.status === 'HEALTHY' ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: integrationHealth.status === 'HEALTHY' ? '#16a34a' : '#ef4444', textTransform: 'uppercase', marginBottom: 4 }}>
                  TRẠNG THÁI HỆ THỐNG
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>
                  {integrationHealth.status === 'HEALTHY' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#16a34a' }}>
                      <CheckCircle2 size={18} color="#16a34a" /> HEALTHY
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#ea580c' }}>
                      <AlertTriangle size={18} color="#ea580c" /> DEGRADED
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  Tỷ lệ lỗi: <strong>{integrationHealth.summary?.failureRate}</strong>
                </div>
              </Card>

              <Card style={{ padding: 16, background: '#ffffff', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                  TỔNG SỐ SỰ KIỆN
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>
                  {integrationHealth.summary?.totalEvents || 0}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  24h qua: <strong>{integrationHealth.summary?.volume24h || 0}</strong> events
                </div>
              </Card>

              <Card style={{ padding: 16, background: '#ffffff', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                  ĐÃ XỬ LÝ (PROCESSED)
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#16a34a' }}>
                  {integrationHealth.summary?.processedCount || 0}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  Đang chờ: <strong>{integrationHealth.summary?.pendingCount || 0}</strong> pending
                </div>
              </Card>

              <Card style={{ padding: 16, background: '#ffffff', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                  SỰ KIỆN THẤT BẠI (FAILED)
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: integrationHealth.summary?.failedCount > 0 ? '#ef4444' : '#64748b' }}>
                  {integrationHealth.summary?.failedCount || 0}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  Bỏ qua: <strong>{integrationHealth.summary?.ignoredCount || 0}</strong> ignored
                </div>
              </Card>
            </div>
          )}

          {/* Module Breakdown Badges */}
          {integrationHealth?.bySourceModule && (
            <Card style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: '#f8fafc' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>Phân Bổ Nguồn:</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'rgba(2,132,199,0.1)', color: '#0284c7', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Video size={13} /> Production: {integrationHealth.bySourceModule.production || 0}
                </span>
                <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Tv size={13} /> YouTube: {integrationHealth.bySourceModule.youtube || 0}
                </span>
                <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'rgba(168,85,247,0.1)', color: '#a855f7', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Share2 size={13} /> Community: {integrationHealth.bySourceModule.community || 0}
                </span>
              </div>
            </Card>
          )}

          {/* Filter Bar */}
          <Card style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 220 }}>
                <Search size={16} color="#64748b" />
                <input
                  type="text"
                  placeholder="Tìm kiếm Event Type hoặc ID..."
                  value={integrationSearch}
                  onChange={(e) => setIntegrationSearch(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={15} color="#64748b" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Nguồn:</span>
                <select
                  value={integrationSourceFilter}
                  onChange={(e) => setIntegrationSourceFilter(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                >
                  <option value="all">Tất cả nguồn</option>
                  <option value="production">Production</option>
                  <option value="youtube">YouTube</option>
                  <option value="community">Community</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Trạng thái:</span>
                <select
                  value={integrationStatusFilter}
                  onChange={(e) => setIntegrationStatusFilter(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="PROCESSED">PROCESSED (Đã chấm)</option>
                  <option value="PENDING">PENDING (Đang chờ)</option>
                  <option value="FAILED">FAILED (Lỗi)</option>
                  <option value="IGNORED">IGNORED (Bỏ qua)</option>
                </select>
              </div>
            </div>

            {/* Events Table */}
            {loading && integrationEvents.length === 0 ? (
              <PageState type="loading" title="Đang tải danh sách sự kiện..." />
            ) : integrationEvents.length === 0 ? (
              <EmptyState title="Không tìm thấy sự kiện nào" description="Chưa có sự kiện nào phù hợp với bộ lọc được ghi nhận trong Event Store." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontWeight: 800 }}>
                      <th style={{ padding: '10px 8px' }}>Event ID</th>
                      <th style={{ padding: '10px 8px' }}>Loại Sự Kiện</th>
                      <th style={{ padding: '10px 8px' }}>Nguồn</th>
                      <th style={{ padding: '10px 8px' }}>Đối Tượng</th>
                      <th style={{ padding: '10px 8px' }}>Actor / Team</th>
                      <th style={{ padding: '10px 8px' }}>Trạng Thái</th>
                      <th style={{ padding: '10px 8px' }}>Thời Gian</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right' }}>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {integrationEvents
                      .filter((ev) => {
                        if (!integrationSearch.trim()) return true;
                        const s = integrationSearch.toLowerCase();
                        return (
                          ev.eventType?.toLowerCase().includes(s) ||
                          ev.eventId?.toLowerCase().includes(s) ||
                          ev.sourceModule?.toLowerCase().includes(s)
                        );
                      })
                      .map((ev) => (
                        <tr key={ev.eventId} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}>
                          <td style={{ padding: '10px 8px', fontFamily: 'monospace', color: '#64748b' }}>
                            {ev.eventId?.slice(0, 8)}...
                          </td>
                          <td style={{ padding: '10px 8px', fontWeight: 800, color: '#0f172a' }}>
                            {ev.eventType}
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                background:
                                  ev.sourceModule === 'production'
                                    ? 'rgba(2,132,199,0.1)'
                                    : ev.sourceModule === 'youtube'
                                    ? 'rgba(239,68,68,0.1)'
                                    : 'rgba(168,85,247,0.1)',
                                color:
                                  ev.sourceModule === 'production'
                                    ? '#0284c7'
                                    : ev.sourceModule === 'youtube'
                                    ? '#ef4444'
                                    : '#a855f7',
                              }}
                            >
                              {ev.sourceModule}
                            </span>
                          </td>
                          <td style={{ padding: '10px 8px', color: '#475569' }}>
                            {ev.aggregateType ? `${ev.aggregateType} #${ev.aggregateId || '—'}` : '—'}
                          </td>
                          <td style={{ padding: '10px 8px', color: '#475569' }}>
                            {ev.actorId ? `User #${ev.actorId}` : ''} {ev.teamId ? `(Team #${ev.teamId})` : ''}
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 800,
                                background:
                                  ev.status === 'PROCESSED'
                                    ? 'rgba(34,197,94,0.12)'
                                    : ev.status === 'PENDING'
                                    ? 'rgba(234,179,8,0.15)'
                                    : ev.status === 'FAILED'
                                    ? 'rgba(239,68,68,0.15)'
                                    : '#f1f5f9',
                                color:
                                  ev.status === 'PROCESSED'
                                    ? '#16a34a'
                                    : ev.status === 'PENDING'
                                    ? '#ca8a04'
                                    : ev.status === 'FAILED'
                                    ? '#dc2626'
                                    : '#64748b',
                              }}
                            >
                              {ev.status}
                            </span>
                          </td>
                          <td style={{ padding: '10px 8px', color: '#94a3b8', fontSize: 11 }}>
                            {ev.occurredAt ? new Date(ev.occurredAt).toLocaleString('vi-VN') : '—'}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                              <Button variant="outline" size="sm" onClick={() => handleOpenTrace(ev.eventId)}>
                                <Eye size={13} /> Trace
                              </Button>
                              {ev.status === 'FAILED' && (
                                <Button variant="danger" size="sm" onClick={() => handleOpenRetry(ev.eventId)}>
                                  <RotateCcw size={13} /> Retry
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 3: PROJECTIONS */}
      {activeTab === 'projections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rebuildSuccessMsg && (
            <div style={{ padding: 12, borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: '#16a34a', fontSize: 13, fontWeight: 700 }}>
              {rebuildSuccessMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Giám Sát & Rebuild Read Model Projections
              </h2>
              <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0 0' }}>
                Projections là bản sao tối ưu truy vấn derived từ Source of Truth.
              </p>
            </div>
            <Button variant="danger" onClick={() => setRebuildModalOpen(true)}>
              <RotateCcw size={16} /> Rebuild Toàn Bộ Read Models
            </Button>
          </div>

          <Card style={{ padding: 18 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>
              Trạng Thái Drift Detection & Consistency
            </h3>
            {consistencyReport ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div style={{ padding: 12, borderRadius: 8, background: consistencyReport.overallConsistent ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${consistencyReport.overallConsistent ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: consistencyReport.overallConsistent ? '#16a34a' : '#ef4444' }}>TỔNG THỂ</div>
                  <div style={{ fontSize: 16, fontWeight: 900, marginTop: 4 }}>
                    {consistencyReport.overallConsistent ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#16a34a' }}>
                        <CheckCircle2 size={16} color="#16a34a" /> 100% ĐỒNG BỘ
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#ea580c' }}>
                        <AlertTriangle size={16} color="#ea580c" /> PHÁT HIỆN LỆCH DỮ LIỆU
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>SEASON LEADERBOARD</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                    {consistencyReport.seasonLeaderboardDrift ? `Lệch: ${consistencyReport.seasonLeaderboardDrift.driftCount} mục` : 'Khớp 100%'}
                  </div>
                </div>
                <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>GRAND CHAMPIONSHIP</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                    {consistencyReport.grandLeaderboardDrift ? `Lệch: ${consistencyReport.grandLeaderboardDrift.driftCount} mục` : 'Khớp 100%'}
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: '#94a3b8' }}>Chưa có báo cáo drift detection.</p>
            )}
          </Card>
        </div>
      )}

      {/* TAB 4: STATE MONITOR */}
      {activeTab === 'states' && (
        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                Giám Sát Trạng Thái Thi Đấu (State Monitor)
              </h2>
              <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0 0' }}>
                Tổng số bản ghi: <strong>{totalStates}</strong>
              </p>
            </div>
            <SegmentedControl
              ariaLabel="Lọc Entity Type"
              options={[
                { key: 'all', label: 'Tất cả' },
                { key: 'user', label: 'Cá nhân (User)' },
                { key: 'team', label: 'Đội nhóm (Team)' },
              ]}
              value={entityFilter}
              onChange={setEntityFilter}
            />
          </div>

          {states.length === 0 ? (
            <EmptyState title="Không có bản ghi State" description="Chưa có dữ liệu trạng thái thi đấu nào phù hợp bộ lọc." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {states.map((st) => (
                <div key={st.id} style={{ padding: 12, borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{st.stateKey}</span>
                    <span style={{ fontSize: 11, color: '#64748b', marginLeft: 10 }}>
                      Entity: {st.entityType} #{st.entityId}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#0284c7' }}>
                    Count: {st.stateValue?.count ?? 0}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 5: SCORE INSPECTOR */}
      {activeTab === 'inspector' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card style={{ padding: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', margin: '0 0 8px 0' }}>
              Tra Cứu Giao Dịch Điểm (Score Inspector)
            </h2>
            <form onSubmit={handleInspect} style={{ display: 'flex', gap: 10, maxWidth: 400 }}>
              <input
                type="text"
                placeholder="Nhập User ID..."
                value={inspectUserId}
                onChange={(e) => setInspectUserId(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
              <Button type="submit" variant="primary" disabled={inspectLoading}>
                {inspectLoading ? 'Đang tra cứu...' : 'Tra cứu'}
              </Button>
            </form>
          </Card>

          {inspectResult && (
            <Card style={{ padding: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Kết Quả Tra Cứu Cho User #{inspectResult.userId}
                </h3>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Tổng điểm: <strong style={{ color: '#16a34a' }}>{inspectResult.totalScore} XP</strong> | Tổng giao dịch: <strong>{inspectResult.total}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {inspectResult.entries.map((ent) => (
                  <div key={ent.id} style={{ padding: 10, borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{ent.reason || 'Event Scoring'}</span>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{new Date(ent.createdAt).toLocaleString()}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: ent.pointsDelta >= 0 ? '#16a34a' : '#ef4444' }}>
                      {ent.pointsDelta >= 0 ? `+${ent.pointsDelta}` : ent.pointsDelta} XP
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 1: CREATE RULE SET */}
      {createRuleSetModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <Card style={{ width: '100%', maxWidth: 480, padding: 24, background: '#fff' }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: '0 0 14px 0' }}>
              Tạo Rule Set Mới
            </h2>
            <form onSubmit={handleCreateRuleSet} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Tên Rule Set</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Video Production Championship Rules"
                  value={newRsName}
                  onChange={(e) => setNewRsName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Mã Code (Unique)</label>
                <input
                  type="text"
                  required
                  placeholder="ví dụ: rs_video_production"
                  value={newRsCode}
                  onChange={(e) => setNewRsCode(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Mô Tả</label>
                <textarea
                  rows={3}
                  placeholder="Mô tả mục đích và phạm vi của bộ quy tắc..."
                  value={newRsDesc}
                  onChange={(e) => setNewRsDesc(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                <Button type="button" variant="ghost" onClick={() => setCreateRuleSetModalOpen(false)}>Hủy</Button>
                <Button type="submit" variant="primary" disabled={actionLoading}>
                  {actionLoading ? 'Đang tạo...' : 'Tạo Rule Set'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      </TabTransition>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 2: VISUAL RULE BUILDER STUDIO */}
      {builderModalOpen && selectedRuleSet && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 1000, maxHeight: '90vh', background: '#fff', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Sliders size={20} color="#0284c7" />
                  <h2 style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                    Visual Rule Builder — {selectedRuleSet.name}
                  </h2>
                  {selectedVersion ? (
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: selectedVersion.status === 'PUBLISHED' ? '#dcfce7' : '#fef9c3', color: selectedVersion.status === 'PUBLISHED' ? '#15803d' : '#854d0e' }}>
                      Version #{selectedVersion.versionNumber} ({selectedVersion.status})
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: '#f1f5f9', color: '#475569' }}>
                      Bản Nháp Mới
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <SegmentedControl
                  ariaLabel="Builder View"
                  options={[
                    { key: 'visual', label: 'Visual Blocks' },
                    { key: 'json', label: 'JSON AST' },
                  ]}
                  value={builderTab}
                  onChange={setBuilderTab}
                />
                <Button variant="ghost" onClick={() => setBuilderModalOpen(false)}>Đóng</Button>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {/* Version & Window Meta */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 18, padding: 14, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>HIỆU LỰC TỪ (EFFECTIVE FROM)</label>
                  <input
                    type="datetime-local"
                    value={builderEffectiveFrom}
                    disabled={selectedVersion?.status === 'PUBLISHED'}
                    onChange={(e) => setBuilderEffectiveFrom(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>HIỆU LỰC ĐẾN (EFFECTIVE TO - TÙY CHỌN)</label>
                  <input
                    type="datetime-local"
                    value={builderEffectiveTo}
                    disabled={selectedVersion?.status === 'PUBLISHED'}
                    onChange={(e) => setBuilderEffectiveTo(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                  />
                </div>
              </div>

              {/* VISUAL BUILDER BLOCKS */}
              {builderTab === 'visual' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {builderRules.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, border: '2px dashed #cbd5e1', borderRadius: 8 }}>
                      <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 12px 0' }}>Chưa có quy tắc nào trong phiên bản này.</p>
                      <Button variant="primary" onClick={handleAddRuleBlock} disabled={selectedVersion?.status === 'PUBLISHED'}>
                        <Plus size={16} /> Thêm Quy Tắc Đầu Tiên
                      </Button>
                    </div>
                  ) : (
                    builderRules.map((rule, rIdx) => {
                      const conditions = rule.condition_ast?.conditions || (rule.condition_ast ? [rule.condition_ast] : []);

                      return (
                        <div key={rIdx} style={{ padding: 18, borderRadius: 10, border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ width: 24, height: 24, borderRadius: 12, background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                                {rIdx + 1}
                              </span>
                              <input
                                type="text"
                                value={rule.name}
                                disabled={selectedVersion?.status === 'PUBLISHED'}
                                onChange={(e) => {
                                  const updated = [...builderRules];
                                  updated[rIdx].name = e.target.value;
                                  setBuilderRules(updated);
                                }}
                                style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px 8px' }}
                              />
                            </div>

                            {selectedVersion?.status !== 'PUBLISHED' && (
                              <Button variant="ghost" onClick={() => handleRemoveRuleBlock(rIdx)}>
                                <Trash2 size={16} color="#ef4444" />
                              </Button>
                            )}
                          </div>

                          {/* WHEN: Conditions Builder */}
                          <div style={{ padding: 14, borderRadius: 8, background: '#f8fafc', marginBottom: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', marginBottom: 8 }}>
                              1. ĐIỀU KIỆN KÍCH HOẠT (WHEN)
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {conditions.map((c, cIdx) => (
                                <div key={cIdx} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Trường:</span>
                                  <input
                                    type="text"
                                    value={c.field || ''}
                                    list="field-suggestions"
                                    disabled={selectedVersion?.status === 'PUBLISHED'}
                                    onChange={(e) => {
                                      const updated = [...builderRules];
                                      if (updated[rIdx].condition_ast?.conditions) {
                                        updated[rIdx].condition_ast.conditions[cIdx].field = e.target.value;
                                      } else {
                                        updated[rIdx].condition_ast = { op: 'EQ', field: e.target.value, value: c.value };
                                      }
                                      setBuilderRules(updated);
                                    }}
                                    placeholder="event.payload.quality_score"
                                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, minWidth: 200 }}
                                  />

                                  <select
                                    value={c.op || 'EQ'}
                                    disabled={selectedVersion?.status === 'PUBLISHED'}
                                    onChange={(e) => {
                                      const updated = [...builderRules];
                                      if (updated[rIdx].condition_ast?.conditions) {
                                        updated[rIdx].condition_ast.conditions[cIdx].op = e.target.value;
                                      } else {
                                        updated[rIdx].condition_ast = { op: e.target.value, field: c.field, value: c.value };
                                      }
                                      setBuilderRules(updated);
                                    }}
                                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                                  >
                                    {CONDITION_OPERATORS.map((op) => (
                                      <option key={op.value} value={op.value}>{op.label}</option>
                                    ))}
                                  </select>

                                  {!['IS_NULL', 'IS_NOT_NULL', 'IS_WEEKEND'].includes(c.op) && (
                                    <input
                                      type="text"
                                      value={c.value !== undefined ? c.value : ''}
                                      disabled={selectedVersion?.status === 'PUBLISHED'}
                                      onChange={(e) => {
                                        const updated = [...builderRules];
                                        const val = isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value);
                                        if (updated[rIdx].condition_ast?.conditions) {
                                          updated[rIdx].condition_ast.conditions[cIdx].value = val;
                                        } else {
                                          updated[rIdx].condition_ast = { op: c.op, field: c.field, value: val };
                                        }
                                        setBuilderRules(updated);
                                      }}
                                      placeholder="Giá trị so sánh"
                                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, width: 140 }}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* THEN: Actions Builder */}
                          <div style={{ padding: 14, borderRadius: 8, background: '#f8fafc', marginBottom: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', marginBottom: 8 }}>
                              2. HÀNH ĐỘNG CỘNG / TRỪ ĐIỂM (THEN)
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <select
                                value={rule.action_ast?.type || 'ADD'}
                                disabled={selectedVersion?.status === 'PUBLISHED'}
                                onChange={(e) => {
                                  const updated = [...builderRules];
                                  updated[rIdx].action_ast = { ...updated[rIdx].action_ast, type: e.target.value };
                                  setBuilderRules(updated);
                                }}
                                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                              >
                                {ACTION_TYPES.map((a) => (
                                  <option key={a.value} value={a.value}>{a.label}</option>
                                ))}
                              </select>

                              <input
                                type="number"
                                value={rule.action_ast?.value ?? 100}
                                disabled={selectedVersion?.status === 'PUBLISHED'}
                                onChange={(e) => {
                                  const updated = [...builderRules];
                                  updated[rIdx].action_ast = { ...updated[rIdx].action_ast, value: Number(e.target.value) };
                                  setBuilderRules(updated);
                                }}
                                style={{ width: 100, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                              />

                              <select
                                value={rule.effect_type || 'INDIVIDUAL_XP'}
                                disabled={selectedVersion?.status === 'PUBLISHED'}
                                onChange={(e) => {
                                  const updated = [...builderRules];
                                  updated[rIdx].effect_type = e.target.value;
                                  setBuilderRules(updated);
                                }}
                                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                              >
                                {EFFECT_TYPES.map((ef) => (
                                  <option key={ef.value} value={ef.value}>{ef.label}</option>
                                ))}
                              </select>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 11, color: '#64748b' }}>Hệ số (Multiplier):</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={rule.multiplier ?? 1}
                                  disabled={selectedVersion?.status === 'PUBLISHED'}
                                  onChange={(e) => {
                                    const updated = [...builderRules];
                                    updated[rIdx].multiplier = Number(e.target.value);
                                    setBuilderRules(updated);
                                  }}
                                  style={{ width: 70, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Sentence Summary Preview */}
                          <div style={{ fontSize: 12, color: '#334155', fontStyle: 'italic', padding: '6px 10px', background: '#f1f5f9', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Sparkles size={13} color="#0284c7" style={{ flexShrink: 0 }} />
                            <span><strong>{rule.name}:</strong> Khi {conditions.map((c) => `${c.field || 'field'} ${c.op || '=='} ${c.value ?? ''}`).join(' VÀ ')} <ArrowRight size={12} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 2px' }} /> {rule.action_ast?.type || 'ADD'} {rule.action_ast?.value || 0} ({rule.effect_type || 'XP'})</span>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {selectedVersion?.status !== 'PUBLISHED' && builderRules.length > 0 && (
                    <Button variant="outline" onClick={handleAddRuleBlock} style={{ alignSelf: 'flex-start' }}>
                      <Plus size={15} /> Thêm Quy Tắc Khác
                    </Button>
                  )}
                </div>
              )}

              {/* JSON AST PREVIEW */}
              {builderTab === 'json' && (
                <div style={{ background: '#0f172a', color: '#38bdf8', padding: 16, borderRadius: 8, fontFamily: 'monospace', fontSize: 12, overflowX: 'auto' }}>
                  <pre style={{ margin: 0 }}>{JSON.stringify(builderRules, null, 2)}</pre>
                </div>
              )}

              {/* VALIDATION STATUS BANNER */}
              {validationResult && (
                <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: validationResult.valid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: validationResult.valid ? '#16a34a' : '#ef4444', fontSize: 13 }}>
                  {validationResult.valid ? (
                    <div style={{ fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={16} color="#16a34a" /> Cấu trúc Safe AST hợp lệ 100%! Sẵn sàng để Lưu hoặc Xuất Bản.
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 800, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <XCircle size={16} color="#ef4444" /> Phát hiện lỗi trong cấu trúc Rule:
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {validationResult.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="outline" onClick={handleValidateAST} disabled={actionLoading}>
                  <CheckCircle2 size={16} /> Kiểm Tra AST (Validate)
                </Button>
                <Button variant="outline" onClick={() => { setSimResult(null); setSimulatorModalOpen(true); }}>
                  <Play size={16} /> Mô Phỏng (Simulator)
                </Button>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {selectedVersion && (
                  <Button variant="ghost" onClick={() => handleDuplicateVersion(selectedVersion.id)} disabled={actionLoading}>
                    <Copy size={16} /> Nhân Bản Bản Nháp
                  </Button>
                )}

                {selectedVersion?.status !== 'PUBLISHED' && (
                  <Button variant="secondary" onClick={handleSaveDraft} disabled={actionLoading}>
                    <Save size={16} /> Lưu Bản Nháp
                  </Button>
                )}

                {selectedVersion && selectedVersion.status === 'DRAFT' && (
                  <Button variant="primary" onClick={() => setPublishModalOpen(true)} disabled={actionLoading}>
                    <Zap size={16} /> Xuất Bản (Publish)
                  </Button>
                )}
              </div>
            </div>
          </div>

          <datalist id="field-suggestions">
            {FIELD_SUGGESTIONS.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 3: RULE SIMULATOR */}
      {simulatorModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
          <Card style={{ width: '100%', maxWidth: 700, maxHeight: '85vh', padding: 24, background: '#fff', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Play size={20} color="#0284c7" /> Trình Mô Phỏng Điểm (Rule Simulator)
            </h2>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 14px 0' }}>
              Mô phỏng chạy thuần trên Memory Engine. <strong>Đảm bảo 0 ghi đè vào Database production.</strong>
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                Sự Kiện Mẫu (Sample Event JSON)
              </label>
              <textarea
                rows={6}
                value={simEventPayload}
                onChange={(e) => setSimEventPayload(e.target.value)}
                style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>

            <Button variant="primary" onClick={handleRunSimulator} disabled={simLoading}>
              {simLoading ? 'Đang chạy mô phỏng...' : 'Chạy Mô Phỏng'}
            </Button>

            {simResult && (
              <div style={{ marginTop: 16, padding: 14, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
                  Kết Quả Đánh Giá Mô Phỏng
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
                  <div style={{ padding: 10, borderRadius: 6, background: '#fff', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>QUY TẮC KHỚP</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#0284c7' }}>
                      {simResult.matchedRulesCount} / {simResult.rulesEvaluated}
                    </div>
                  </div>
                  <div style={{ padding: 10, borderRadius: 6, background: '#fff', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>ĐIỂM CÁ NHÂN (USER XP)</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#16a34a' }}>
                      +{simResult.totalUserPoints} XP
                    </div>
                  </div>
                  <div style={{ padding: 10, borderRadius: 6, background: '#fff', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>ĐIỂM ĐỘI (TEAM SCORE)</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#ea580c' }}>
                      +{simResult.totalTeamScore} XP
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Trace Thực Thi:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {simResult.executionTrace.map((tr, idx) => (
                    <div key={idx} style={{ padding: 8, borderRadius: 6, background: tr.matched ? 'rgba(34,197,94,0.06)' : '#fff', border: `1px solid ${tr.matched ? '#86efac' : '#e2e8f0'}`, fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{tr.ruleName}</strong>
                        <span style={{ fontWeight: 800, color: tr.matched ? '#16a34a' : '#94a3b8' }}>
                          {tr.matched ? 'KHỚP (MATCHED)' : 'KHÔNG KHỚP'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{tr.ruleSummary}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <Button variant="ghost" onClick={() => setSimulatorModalOpen(false)}>Đóng</Button>
            </div>
          </Card>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 4: VERSION DIFF VIEWER */}
      {diffModalOpen && selectedRuleSet && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}>
          <Card style={{ width: '100%', maxWidth: 750, maxHeight: '85vh', padding: 24, background: '#fff', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <GitCompare size={20} color="#0284c7" /> So Sánh Phiên Bản (Version Diff)
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'center', marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Phiên bản cũ (A)</label>
                <select
                  value={diffVersionA}
                  onChange={(e) => setDiffVersionA(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                >
                  {selectedRuleSet.versions?.map((v) => (
                    <option key={v.id} value={v.id}>Version #{v.versionNumber} ({v.status})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Phiên bản mới (B)</label>
                <select
                  value={diffVersionB}
                  onChange={(e) => setDiffVersionB(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                >
                  {selectedRuleSet.versions?.map((v) => (
                    <option key={v.id} value={v.id}>Version #{v.versionNumber} ({v.status})</option>
                  ))}
                </select>
              </div>

              <Button variant="primary" onClick={handleRunDiff} disabled={diffLoading} style={{ alignSelf: 'flex-end' }}>
                {diffLoading ? 'Đang so sánh...' : 'So sánh'}
              </Button>
            </div>

            {diffResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', gap: 16, fontSize: 12 }}>
                  <span>Thêm mới: <strong style={{ color: '#16a34a' }}>+{diffResult.addedCount}</strong></span>
                  <span>Chỉnh sửa: <strong style={{ color: '#0284c7' }}>{diffResult.modifiedCount}</strong></span>
                  <span>Xóa bỏ: <strong style={{ color: '#ef4444' }}>-{diffResult.removedCount}</strong></span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {diffResult.changes.map((ch, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 12,
                        borderRadius: 6,
                        borderLeft: `4px solid ${ch.type === 'RULE_ADDED' ? '#16a34a' : ch.type === 'RULE_REMOVED' ? '#ef4444' : '#0284c7'}`,
                        background: ch.type === 'RULE_ADDED' ? 'rgba(34,197,94,0.04)' : ch.type === 'RULE_REMOVED' ? 'rgba(239,68,68,0.04)' : 'rgba(2,132,199,0.04)',
                        fontSize: 12,
                      }}
                    >
                      <div style={{ fontWeight: 800, color: '#0f172a' }}>{ch.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <Button variant="ghost" onClick={() => setDiffModalOpen(false)}>Đóng</Button>
            </div>
          </Card>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 5: PUBLISH VERSION CONFIRMATION */}
      {publishModalOpen && selectedVersion && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 }}>
          <Card style={{ width: '100%', maxWidth: 480, padding: 24, background: '#fff' }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: '0 0 10px 0' }}>
              Xác Nhận Xuất Bản Version #{selectedVersion.versionNumber}
            </h2>
            <div style={{ padding: 12, borderRadius: 8, background: 'rgba(234,179,8,0.1)', color: '#854d0e', fontSize: 12, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={15} color="#854d0e" style={{ flexShrink: 0 }} />
              <span><strong>Lưu ý:</strong> Phiên bản sau khi Xuất Bản sẽ trở thành <strong>BẤT BIẾN (Immutable)</strong> và được áp dụng cho các mùa giải tương ứng. Không thể chỉnh sửa lại sau khi đã Publish.</span>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                Lý Do Audit Bắt Buộc (Audit Reason)
              </label>
              <textarea
                rows={3}
                required
                placeholder="Ví dụ: Xuất bản chính thức quy tắc thi đấu mùa Q1 2026..."
                value={publishReason}
                onChange={(e) => setPublishReason(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="ghost" onClick={() => setPublishModalOpen(false)}>Hủy</Button>
              <Button variant="primary" onClick={handlePublishVersion} disabled={actionLoading}>
                {actionLoading ? 'Đang xuất bản...' : 'Xác Nhận Xuất Bản'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 6: REBUILD PROJECTIONS */}
      {rebuildModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <Card style={{ width: '100%', maxWidth: 480, padding: 24, background: '#fff' }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: '0 0 10px 0' }}>
              Rebuild Toàn Bộ Read Models
            </h2>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 14px 0' }}>
              Quá trình này sẽ tính toán lại toàn bộ bảng Projections từ Source of Truth.
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                Lý do Audit bắt buộc (Audit Reason)
              </label>
              <textarea
                rows={3}
                required
                placeholder="Ví dụ: Định kỳ đồng bộ hoặc xử lý sự cố lệch số liệu..."
                value={rebuildReason}
                onChange={(e) => setRebuildReason(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="ghost" onClick={() => setRebuildModalOpen(false)}>Hủy</Button>
              <Button variant="danger" onClick={handleRebuildProjections} disabled={rebuildLoading}>
                {rebuildLoading ? 'Đang Rebuild...' : 'Bắt đầu Rebuild'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 7: EVENT TRACE MODAL (PHASE 8) */}
      {traceModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 }}>
          <Card style={{ width: '100%', maxWidth: 750, maxHeight: '85vh', padding: 24, background: '#fff', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Eye size={20} color="#0284c7" /> Truy Vết Toàn Bộ Sự Kiện (Event Trace)
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setTraceModalOpen(false)} aria-label="Đóng"><X size={15} /></Button>
            </div>

            {traceLoading || !traceData ? (
              <PageState type="loading" title="Đang tải dữ liệu truy vết..." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* 1. Ingestion Overview */}
                <div style={{ padding: 14, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
                    1. THÔNG TIN TIẾP NHẬN (INGESTION)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: 12 }}>
                    <div><strong>Event ID:</strong> <span style={{ fontFamily: 'monospace' }}>{traceData.eventId}</span></div>
                    <div><strong>Loại Sự Kiện:</strong> <span style={{ fontWeight: 800, color: '#0284c7' }}>{traceData.eventType}</span></div>
                    <div><strong>Nguồn:</strong> <span style={{ fontWeight: 700 }}>{traceData.sourceModule}</span></div>
                    <div><strong>Đối Tượng:</strong> {traceData.aggregateType} #{traceData.aggregateId || '—'}</div>
                    <div><strong>Actor:</strong> {traceData.actor ? `${traceData.actor.name} (#${traceData.actor.id})` : '—'}</div>
                    <div><strong>Team:</strong> {traceData.team ? `${traceData.team.name} (#${traceData.team.id})` : '—'}</div>
                    <div><strong>Thời Gian Phát Sinh:</strong> {new Date(traceData.occurredAt).toLocaleString('vi-VN')}</div>
                    <div><strong>Idempotency Key:</strong> <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{traceData.idempotencyKey?.slice(0, 16)}...</span></div>
                  </div>
                </div>

                {/* 2. Payload */}
                <div style={{ padding: 14, borderRadius: 8, background: '#0f172a', color: '#38bdf8', fontFamily: 'monospace', fontSize: 12, overflowX: 'auto' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', marginBottom: 4 }}>2. BUSINESS PAYLOAD (IMMUTABLE)</div>
                  <pre style={{ margin: 0 }}>{JSON.stringify(traceData.payload, null, 2)}</pre>
                </div>

                {/* 3. Rule Evaluation */}
                <div style={{ padding: 14, borderRadius: 8, background: 'rgba(2,132,199,0.05)', border: '1px solid rgba(2,132,199,0.2)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', marginBottom: 6 }}>
                    3. ĐÁNH GIÁ QUY TẮC (RULE EVALUATION)
                  </div>
                  <div style={{ fontSize: 13 }}>
                    <div>Bộ luật áp dụng: <strong>{traceData.ruleEvaluation?.ruleVersion?.ruleSetName || 'Mặc định'} (v{traceData.ruleEvaluation?.ruleVersion?.versionNumber || 1})</strong></div>
                    <div>
                      Kết quả khớp:{' '}
                      <strong style={{ color: traceData.ruleEvaluation?.matched ? '#16a34a' : '#ca8a04' }}>
                        {traceData.ruleEvaluation?.matched ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={13} color="#16a34a" /> KHỚP ĐIỀU KIỆN
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <XCircle size={13} color="#ca8a04" /> KHÔNG KHỚP (0 điểm)
                          </span>
                        )}
                      </strong>
                    </div>
                    <div>Tổng điểm phát sinh: <strong style={{ color: '#16a34a', fontSize: 15 }}>+{traceData.ruleEvaluation?.totalPointsAwarded || 0} XP</strong></div>
                  </div>
                </div>

                {/* 4. Score Ledger Entries */}
                <div style={{ padding: 14, borderRadius: 8, background: '#ffffff', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
                    4. BẢN GHI SỔ CÁI ĐIỂM (SCORE LEDGER ENTRIES)
                  </div>
                  {traceData.ledgerEntries?.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Không có dòng điểm nào được ghi vào sổ cái (0 effect).</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#64748b', textAlign: 'left' }}>
                          <th style={{ padding: '6px 4px' }}>Target</th>
                          <th style={{ padding: '6px 4px' }}>Loại Effect</th>
                          <th style={{ padding: '6px 4px' }}>Điểm (+/-)</th>
                          <th style={{ padding: '6px 4px' }}>Số Dư Sau</th>
                          <th style={{ padding: '6px 4px' }}>Lý Do</th>
                        </tr>
                      </thead>
                      <tbody>
                        {traceData.ledgerEntries.map((l) => (
                          <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '6px 4px' }}>{l.targetType} #{l.targetId}</td>
                            <td style={{ padding: '6px 4px', fontWeight: 700 }}>{l.effectType}</td>
                            <td style={{ padding: '6px 4px', fontWeight: 800, color: '#16a34a' }}>+{l.delta}</td>
                            <td style={{ padding: '6px 4px' }}>{l.balanceAfter}</td>
                            <td style={{ padding: '6px 4px', color: '#64748b' }}>{l.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* 5. Processing Status */}
                <div style={{ padding: 14, borderRadius: 8, background: traceData.processing?.status === 'FAILED' ? 'rgba(239,68,68,0.06)' : '#f8fafc', border: `1px solid ${traceData.processing?.status === 'FAILED' ? 'rgba(239,68,68,0.2)' : '#e2e8f0'}` }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                    5. TRẠNG THÁI XỬ LÝ
                  </div>
                  <div style={{ fontSize: 12 }}>
                    <div>Trạng thái: <strong>{traceData.processing?.status}</strong></div>
                    <div>Số lần thử: <strong>{traceData.processing?.attemptCount}</strong></div>
                    {traceData.processing?.lastError && (
                      <div style={{ color: '#dc2626', marginTop: 4 }}>
                        Lỗi: <strong>{traceData.processing.lastError}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <Button variant="ghost" onClick={() => setTraceModalOpen(false)}>Đóng</Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 8: MANUAL RETRY MODAL (PHASE 8) */}
      {retryModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 }}>
          <Card style={{ width: '100%', maxWidth: 480, padding: 24, background: '#fff' }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <RotateCcw size={20} color="#dc2626" /> Thử Lại Sự Kiện Thất Bại
            </h2>
            <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.06)', color: '#991b1b', fontSize: 12, marginBottom: 14 }}>
              Hành động này sẽ đặt lại trạng thái <strong>PENDING</strong> cho sự kiện <code style={{ fontWeight: 800 }}>{retryEventId?.slice(0, 8)}...</code>. Worker sẽ tự động đánh giá lại trong lượt quét kế tiếp.
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                Lý Do Audit Bắt Buộc (Audit Reason)
              </label>
              <textarea
                rows={3}
                required
                placeholder="Ví dụ: Đã sửa lỗi DSL rule và trigger retry thủ công..."
                value={retryReason}
                onChange={(e) => setRetryReason(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="ghost" onClick={() => setRetryModalOpen(false)}>Hủy</Button>
              <Button variant="danger" onClick={handleSubmitRetry} disabled={retryLoading}>
                {retryLoading ? 'Đang Retry...' : 'Xác Nhận Thử Lại'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* MODAL 9: SIMULATE LIVE EVENT MODAL (PHASE 8) */}
      {simEventModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 20 }}>
          <Card style={{ width: '100%', maxWidth: 520, padding: 24, background: '#fff' }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={20} color="#0284c7" /> Bắn Sự Kiện Thử Nghiệm (Product Simulation)
            </h2>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 14px 0' }}>
              Tạo sự kiện thật từ các Module để kiểm tra luồng tính điểm từ Event Store vào Score Ledger.
            </p>

            {simActionSuccess && (
              <div style={{ padding: 12, borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: '#16a34a', fontSize: 12, fontWeight: 700, marginBottom: 14 }}>
                {simActionSuccess}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Chọn Nguồn Sự Kiện (Source Module)
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    variant={simModuleType === 'production' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => { setSimModuleType('production'); setSimActionType('video_approved'); }}
                  >
                    <Video size={14} /> Production
                  </Button>
                  <Button
                    variant={simModuleType === 'youtube' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => { setSimModuleType('youtube'); setSimActionType('views'); }}
                  >
                    <Tv size={14} /> YouTube
                  </Button>
                  <Button
                    variant={simModuleType === 'community' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => { setSimModuleType('community'); setSimActionType('kudos'); }}
                  >
                    <Share2 size={14} /> Community
                  </Button>
                </div>
              </div>

              {simModuleType === 'production' && (
                <>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Loại Hành Động</label>
                    <select
                      value={simActionType}
                      onChange={(e) => setSimActionType(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                    >
                      <option value="video_approved">VIDEO_APPROVED (Duyệt Video)</option>
                      <option value="video_published">VIDEO_PUBLISHED (Xuất bản Video)</option>
                      <option value="script_approved">SCRIPT_APPROVED (Duyệt Kịch bản)</option>
                      <option value="edit_approved">EDIT_APPROVED (Duyệt Dựng)</option>
                      <option value="qc_passed">VIDEO_QC_PASSED (Đạt chuẩn QC)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Video ID & Tiêu Đề</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="number"
                        value={simVideoId}
                        onChange={(e) => setSimVideoId(e.target.value)}
                        placeholder="Video ID"
                        style={{ width: 100, padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                      />
                      <input
                        type="text"
                        value={simTitle}
                        onChange={(e) => setSimTitle(e.target.value)}
                        placeholder="Tiêu đề video"
                        style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                      />
                    </div>
                  </div>
                </>
              )}

              {simModuleType === 'youtube' && (
                <>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Cột Mốc (Milestone)</label>
                    <select
                      value={simActionType}
                      onChange={(e) => setSimActionType(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                    >
                      <option value="views">VIDEO_VIEW_MILESTONE (Cột mốc lượt xem)</option>
                      <option value="subscriber">SUBSCRIBER_MILESTONE (Cột mốc người đăng ký)</option>
                      <option value="performance">PERFORMANCE_MILESTONE (Hiệu suất video)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Lượt xem (Views)</label>
                    <input
                      type="number"
                      value={simViews}
                      onChange={(e) => setSimViews(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                    />
                  </div>
                </>
              )}

              {simModuleType === 'community' && (
                <>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Người Nhận Kudos (Recipient User ID)</label>
                    <input
                      type="number"
                      value={simKudosRecipientId}
                      onChange={(e) => setSimKudosRecipientId(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Lý Do Tặng Kudos</label>
                    <input
                      type="text"
                      value={simKudosReason}
                      onChange={(e) => setSimKudosReason(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                    />
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <Button variant="ghost" onClick={() => setSimEventModalOpen(false)}>Đóng</Button>
              <Button variant="primary" onClick={handleTriggerSimAction} disabled={simActionLoading}>
                {simActionLoading ? 'Đang bắn sự kiện...' : 'Bắn Sự Kiện Ngay'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
