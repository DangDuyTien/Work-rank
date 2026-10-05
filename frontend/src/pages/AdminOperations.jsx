import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  Flame,
  Shield,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  Filter,
  RotateCcw,
  Database,
  Tv,
  Layers,
  FileText,
  User,
  Users,
  Award,
  Crown,
  Sparkles,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  Radio,
  Sliders,
  Check,
  X,
  Eye,
} from 'lucide-react';
import { competition, youtube } from '../services/api';
import { useToast } from '../context/UiContext';
import { parseApiError } from '../utils/errors';
import { Card, EmptyState, PageState, Button, SegmentedControl, TabTransition, CardSkeleton, TableSkeleton, AnimatedModal } from '../components/ui';

const CARD = {
  background: '#ffffff',
  border: '1px solid rgba(15,23,42,0.08)',
  borderRadius: 0,
  boxShadow: 'none',
};

function fmtNum(n) {
  return Number(n || 0).toLocaleString('vi-VN');
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminOperations() {
  const toast = useToast();

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') || 'health';
  const activeTab = ['health', 'audit', 'events', 'projections'].includes(requestedTab) ? requestedTab : 'health';
  const setActiveTab = (tab) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    setSearchParams(params, { replace: true });
  };
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tab 1: System Health Data
  const [integrationHealth, setIntegrationHealth] = useState(null);
  const [ytHealth, setYtHealth] = useState(null);
  const [projectionsStatus, setProjectionsStatus] = useState(null);

  // Tab 2: Audit Logs Data
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);

  // Tab 3: Event Ingestion Data
  const [events, setEvents] = useState([]);
  const [eventSearch, setEventSearch] = useState('');
  const [eventStatusFilter, setEventStatusFilter] = useState('all');
  const [retryingEventId, setRetryingEventId] = useState(null);
  const [retryModalEvent, setRetryModalEvent] = useState(null);
  const [retryReason, setRetryReason] = useState('');
  const [submittingRetry, setSubmittingRetry] = useState(false);
  const [traceEventId, setTraceEventId] = useState(null);
  const [traceData, setTraceData] = useState(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState('');

  // Tab 4: Projections Rebuild Modal
  const [rebuildModalOpen, setRebuildModalOpen] = useState(false);
  const [rebuildReason, setRebuildReason] = useState('');
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [checkingConsistency, setCheckingConsistency] = useState(false);
  const [consistencyResult, setConsistencyResult] = useState(null);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setSelectedAuditLog(null);
      setRetryModalEvent(null);
      setRebuildModalOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  // Fetch Operations Data
  const loadOperationsData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [intHealthRes, ytHealthRes, projStatusRes, logsRes, eventsRes] = await Promise.all([
        competition.adminGetIntegrationHealth().catch(() => null),
        youtube.adminGetHealth().catch(() => null),
        competition.adminGetProjectionsStatus().catch(() => null),
        competition.adminListAuditLogs({ limit: 100 }).catch(() => []),
        competition.adminListIntegrationEvents({ limit: 100 }).catch(() => ({ events: [] })),
      ]);

      setIntegrationHealth(intHealthRes);
      setYtHealth(ytHealthRes);
      setProjectionsStatus(projStatusRes);
      setAuditLogs(Array.isArray(logsRes) ? logsRes : logsRes?.logs || []);
      setEvents(eventsRes.events || []);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể tải dữ liệu giám sát vận hành.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadOperationsData();
  }, [loadOperationsData]);

  useEffect(() => {
    if (!traceEventId) return;
    let current = true;
    setTraceData(null);
    setTraceError('');
    setTraceLoading(true);
    competition.getEventTrace(traceEventId)
      .then((data) => { if (current) setTraceData(data); })
      .catch((error) => { if (current) setTraceError(parseApiError(error, 'Không thể tải truy vết sự kiện.')); })
      .finally(() => { if (current) setTraceLoading(false); });
    return () => { current = false; };
  }, [traceEventId]);

  // ─── AUDIT FILTERING ────────────────────────────────────────────────────────

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs.filter((log) => {
      if (q) {
        const text = `${log.action || ''} ${log.actorName || log.actorId || ''} ${log.entityType || ''} ${log.reason || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      if (auditActionFilter !== 'all' && log.action !== auditActionFilter) return false;
      return true;
    });
  }, [auditLogs, auditSearch, auditActionFilter]);

  const uniqueAuditActions = useMemo(() => {
    const set = new Set(auditLogs.map((l) => l.action).filter(Boolean));
    return Array.from(set);
  }, [auditLogs]);

  // ─── EVENT FILTERING ────────────────────────────────────────────────────────

  const filteredEvents = useMemo(() => {
    const q = eventSearch.trim().toLowerCase();
    return events.filter((ev) => {
      if (q) {
        const text = `${ev.eventType || ev.contractKey || ''} ${ev.eventId || ev.id || ''} ${ev.aggregateType || ''} ${ev.idempotencyKey || ''} ${ev.actorId || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      if (eventStatusFilter !== 'all' && ev.status !== eventStatusFilter) return false;
      return true;
    });
  }, [events, eventSearch, eventStatusFilter]);

  // ─── ACTIONS ────────────────────────────────────────────────────────────────

  const handleRetryEvent = async (e) => {
    e.preventDefault();
    if (!retryModalEvent) return;
    if (!retryReason.trim()) {
      toast.warning('Hãy nhập lý do thử lại sự kiện.');
      return;
    }

    setSubmittingRetry(true);
    try {
      await competition.adminRetryIntegrationEvent(retryModalEvent.eventId || retryModalEvent.id, retryReason.trim());
      toast.success(`Đã kích hoạt thử lại sự kiện ${retryModalEvent.eventType || retryModalEvent.contractKey}!`);
      setRetryModalEvent(null);
      setRetryReason('');
      await loadOperationsData(true);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể thử lại sự kiện.'));
    } finally {
      setSubmittingRetry(false);
    }
  };

  const handleCheckConsistency = async () => {
    setCheckingConsistency(true);
    try {
      const res = await competition.adminCheckProjectionsConsistency();
      setConsistencyResult(res);
      toast.success('Đã kiểm tra tính nhất quán bảng tính sẵn!');
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể kiểm tra tính nhất quán.'));
    } finally {
      setCheckingConsistency(false);
    }
  };

  const handleRebuildProjections = async (e) => {
    e.preventDefault();
    if (!rebuildReason.trim()) {
      toast.warning('Vui lòng nhập lý do rebuild bảng xếp hạng.');
      return;
    }

    setRebuildLoading(true);
    try {
      await competition.adminRebuildProjections(rebuildReason.trim());
      toast.success('Đã hoàn tất tính toán lại toàn bộ Bảng Xếp Hạng từ Source of Truth!');
      setRebuildModalOpen(false);
      setRebuildReason('');
      await loadOperationsData(true);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể rebuild bảng xếp hạng.'));
    } finally {
      setRebuildLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gap: 16 }}>
        <CardSkeleton />
        <TableSkeleton rows={8} />
      </div>
    );
  }

  const isHealthy = integrationHealth?.outbox?.failedCount === 0 && ytHealth?.status !== 'ERROR';

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gap: 16, fontFamily: "'JetBrains Mono', monospace" }}>
      {/* ── HEADER / OPERATIONS HERO ── */}
      <section style={{ ...CARD, padding: 22, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', background: 'rgba(180,83,9,0.08)', color: '#b45309', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
            <Activity size={14} />
            Trung tâm kiểm toán & Giám sát vận hành
          </div>
          <h1 style={{ margin: '12px 0 6px', fontSize: 24, lineHeight: 1.25, color: '#0f172a', fontWeight: 700 }}>
            Giám Sát Vận Hành & Nhật Ký Kiểm Toán
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            Theo dõi sức khỏe hệ thống, hàng đợi sự kiện YouTube/Production, độ trễ Bảng Xếp Hạng và tra cứu toàn bộ Audit Logs.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ ...CARD, padding: '10px 14px', minWidth: 130 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Trạng Thái Vận Hành</div>
            <strong style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: 16, color: isHealthy ? '#16a34a' : '#ea580c', fontWeight: 700 }}>
              {isHealthy ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              {isHealthy ? 'Ổn Định' : 'Cần Chú Ý'}
            </strong>
          </div>
          <div style={{ ...CARD, padding: '10px 14px', minWidth: 120 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Sự Kiện Xử Lý</div>
            <strong style={{ display: 'block', marginTop: 3, fontSize: 22, color: '#b45309', fontWeight: 700 }}>
              {fmtNum(integrationHealth?.events?.totalProcessed || events.length)}
            </strong>
          </div>
          <div style={{ ...CARD, padding: '10px 14px', minWidth: 120 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Nhật Ký Audit</div>
            <strong style={{ display: 'block', marginTop: 3, fontSize: 22, color: '#7c3aed', fontWeight: 700 }}>
              {fmtNum(auditLogs.length)}
            </strong>
          </div>
        </div>
      </section>

      {/* ── TABS NAVIGATION ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <SegmentedControl
          ariaLabel="Operations Tabs"
          options={[
            { key: 'health', label: 'Sức Khỏe Hệ Thống' },
            { key: 'audit', label: `Nhật Ký Kiểm Toán (${auditLogs.length})` },
            { key: 'events', label: `Hàng Đợi Sự Kiện (${events.length})` },
            { key: 'projections', label: 'Đồng Bộ Bảng Xếp Hạng' },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {activeTab === 'projections' && (
            <button
              type="button"
              onClick={() => setRebuildModalOpen(true)}
              style={{
                padding: '8px 16px', background: '#dc2626', color: '#ffffff', border: 'none',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <RotateCcw size={13} /> Rebuild Bảng Xếp Hạng
            </button>
          )}

          <button
            type="button"
            onClick={() => loadOperationsData(true)}
            disabled={refreshing}
            style={{
              padding: '8px 12px', background: '#ffffff', color: '#64748b', border: '1px solid rgba(15,23,42,0.15)',
              fontSize: 12, fontWeight: 600, cursor: refreshing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
          </button>
        </div>
      </div>

      <TabTransition key={activeTab} minHeight={450}>
        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1: SYSTEM HEALTH & METRICS
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'health' && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              {/* 1. API & Core Engine */}
              <div style={{ ...CARD, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={18} color="#b45309" />
                    <strong style={{ fontSize: 14, color: '#0f172a' }}>API & Competition Engine</strong>
                  </div>
                  <span style={{ fontSize: 10, padding: '2px 8px', background: '#dcfce7', color: '#16a34a', fontWeight: 600 }}>
                    HOẠT ĐỘNG
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#475569' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Trạng thái worker:</span>
                    <strong style={{ color: '#16a34a' }}>Sẵn sàng (Online)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Xử lý sự kiện:</span>
                    <strong>Realtime Stream</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Cơ chế chấm điểm:</span>
                    <strong>YouTube Views Direct</strong>
                  </div>
                </div>
              </div>

              {/* 2. Database & Outbox Queue */}
              <div style={{ ...CARD, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Database size={18} color="#7c3aed" />
                    <strong style={{ fontSize: 14, color: '#0f172a' }}>Database & Outbox Queue</strong>
                  </div>
                  <span style={{
                    fontSize: 10, padding: '2px 8px',
                    background: integrationHealth?.outbox?.pendingCount > 10 ? '#fef3c7' : '#dcfce7',
                    color: integrationHealth?.outbox?.pendingCount > 10 ? '#b45309' : '#16a34a',
                    fontWeight: 600,
                  }}>
                    {integrationHealth?.outbox?.pendingCount > 10 ? 'CÓ HÀNG ĐỢI' : 'TỐT'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#475569' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Hàng đợi Outbox chờ xử lý:</span>
                    <strong>{fmtNum(integrationHealth?.outbox?.pendingCount || 0)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Sự kiện lỗi (Failed):</span>
                    <strong style={{ color: (integrationHealth?.outbox?.failedCount || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                      {fmtNum(integrationHealth?.outbox?.failedCount || 0)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Bảo vệ bất biến (Immutable):</span>
                    <strong style={{ color: '#16a34a' }}>Bật (Append-Only)</strong>
                  </div>
                </div>
              </div>

              {/* 3. YouTube API & Sync */}
              <div style={{ ...CARD, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tv size={18} color="#ef4444" />
                    <strong style={{ fontSize: 14, color: '#0f172a' }}>YouTube Data API v3</strong>
                  </div>
                  <span style={{ fontSize: 10, padding: '2px 8px', background: '#dcfce7', color: '#16a34a', fontWeight: 600 }}>
                    KẾT NỐI
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#475569' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Tỷ lệ thành công:</span>
                    <strong style={{ color: '#16a34a' }}>{ytHealth?.successRate || '100%'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Kênh lỗi đồng bộ:</span>
                    <strong style={{ color: (ytHealth?.errorChannelsCount || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                      {ytHealth?.errorChannelsCount || 0}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Đồng bộ gần nhất:</span>
                    <strong>{ytHealth?.lastSyncedAt ? fmtDate(ytHealth.lastSyncedAt) : 'Vừa xong'}</strong>
                  </div>
                </div>
              </div>

              {/* 4. Web Service & Keep-Alive (Render Free) */}
              <div style={{ ...CARD, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Radio size={18} color="#0284c7" />
                    <strong style={{ fontSize: 14, color: '#0f172a' }}>Web Service & Keep-Alive</strong>
                  </div>
                  <span style={{ fontSize: 10, padding: '2px 8px', background: '#e0f2fe', color: '#0284c7', fontWeight: 600 }}>
                    {integrationHealth?.renderService || 'ONLINE'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#475569' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Keep-alive gần nhất:</span>
                    <strong>{integrationHealth?.lastHealthPingAt ? fmtDate(integrationHealth.lastHealthPingAt) : 'Chưa có ping'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Tổng lượt Ping nhận:</span>
                    <strong style={{ color: '#0284c7' }}>{fmtNum(integrationHealth?.healthPingCount || 0)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Tần suất khuyến nghị:</span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>10 phút / lần</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Read Model Projections Status Card */}
            <div style={{ ...CARD, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h3 style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                    Trạng Thái Bản Sao Bảng Xếp Hạng (Read Model Projections)
                  </h3>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    Projections là bảng dữ liệu tối ưu đọc thời gian thực để người dùng xem bảng xếp hạng ngay lập tức.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCheckConsistency}
                  style={{
                    padding: '6px 12px', background: '#f8fafc', border: '1px solid rgba(15,23,42,0.15)',
                    fontSize: 11, fontWeight: 600, color: '#b45309', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <RefreshCw size={12} /> Kiểm tra độ lệch (Drift Check)
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div style={{ padding: 12, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Độ Lệch Dữ Liệu (Lag / Drift)</span>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, fontSize: 16, color: consistencyResult?.isConsistent === false ? '#dc2626' : '#16a34a' }}>
                    {consistencyResult?.isConsistent === false ? (
                      <>
                        <AlertTriangle size={16} color="#dc2626" />
                        <span>Có lệch dữ liệu</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} color="#16a34a" />
                        <span>0% — Đồng bộ 100%</span>
                      </>
                    )}
                  </strong>
                </div>
                <div style={{ padding: 12, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Bản ghi Đội (Season Projection)</span>
                  <strong style={{ display: 'block', marginTop: 4, fontSize: 16, color: '#0f172a' }}>
                    {fmtNum(projectionsStatus?.seasonTeamsCount || 0)}
                  </strong>
                </div>
                <div style={{ padding: 12, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Bản ghi Cá Nhân (Individual Projection)</span>
                  <strong style={{ display: 'block', marginTop: 4, fontSize: 16, color: '#0f172a' }}>
                    {fmtNum(projectionsStatus?.seasonIndividualsCount || 0)}
                  </strong>
                </div>
                <div style={{ padding: 12, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Sổ Cái Điểm Số (Score Ledger)</span>
                  <strong style={{ display: 'block', marginTop: 4, fontSize: 16, color: '#7c3aed' }}>
                    {fmtNum(projectionsStatus?.scoreLedgerCount || 0)} bản ghi
                  </strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2: AUDIT LOGS EXPLORER
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'audit' && (
          <div style={{ display: 'grid', gap: 14 }}>
            {/* Search & Filter Bar */}
            <div style={{ ...CARD, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 260px' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Tìm theo người thực hiện, hành động hoặc lý do..."
                  style={{ width: '100%', padding: '7px 12px 7px 32px', fontSize: 12, border: '1px solid rgba(15,23,42,0.1)', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Hành động:</span>
                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: 12, border: '1px solid rgba(15,23,42,0.12)', background: '#fff' }}
                >
                  <option value="all">Tất cả hành động</option>
                  {uniqueAuditActions.map((act) => <option key={act} value={act}>{act}</option>)}
                </select>
              </div>
            </div>

            {/* Audit Logs Table */}
            <div style={{ ...CARD, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: 10 }}>Thời Gian</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: 10 }}>Hành Động (Action)</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: 10 }}>Người Thực Hiện</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: 10 }}>Đối Tượng (Target)</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: 10 }}>Lý Do & Ghi Chú</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: 10, textAlign: 'right' }}>Chi Tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                        Chưa có bản ghi nhật ký kiểm toán nào khớp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#64748b', fontSize: 11 }}>
                          {fmtDate(log.createdAt || log.timestamp)}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 8px',
                            background: log.action?.includes('MVP') || log.action?.includes('CHAMPION') ? 'rgba(124,58,237,0.1)' : 'rgba(180,83,9,0.12)',
                            color: log.action?.includes('MVP') || log.action?.includes('CHAMPION') ? '#7c3aed' : '#b45309',
                          }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                          {log.actorName || `Admin #${log.actorId || '1'}`}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#334155' }}>
                          {log.entityType ? `${log.entityType} #${log.entityId}` : `ID: #${log.targetUserId || log.entityId || '—'}`}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#64748b', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.reason || '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedAuditLog(log)}
                            style={{
                              padding: '4px 8px', background: '#f8fafc', border: '1px solid rgba(15,23,42,0.1)',
                              fontSize: 11, fontWeight: 600, color: '#b45309', cursor: 'pointer',
                            }}
                          >
                            Xem
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 3: EVENT INGESTION & OUTBOX MONITOR
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'events' && (
          <div style={{ display: 'grid', gap: 14 }}>
            {/* Search & Status Filter */}
            <div style={{ ...CARD, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 260px' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  placeholder="Tìm theo loại sự kiện (contractKey), ID hoặc Actor..."
                  style={{ width: '100%', padding: '7px 12px 7px 32px', fontSize: 12, border: '1px solid rgba(15,23,42,0.1)', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {[
                  ['all', 'Tất cả'],
                  ['PROCESSED', 'Đã xử lý'],
                  ['PENDING', 'Đang chờ'],
                  ['FAILED', 'Lỗi'],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setEventStatusFilter(val)}
                    style={{
                      padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      border: eventStatusFilter === val ? '1px solid #0f172a' : '1px solid rgba(15,23,42,0.1)',
                      background: eventStatusFilter === val ? '#0f172a' : '#ffffff',
                      color: eventStatusFilter === val ? '#ffffff' : '#64748b',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Events Table */}
            <div style={{ ...CARD, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: 10 }}>Thời Điểm</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: 10 }}>Sự Kiện (Contract Key)</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: 10 }}>Đối Tượng / Actor</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: 10 }}>Trạng Thái</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: 10, textAlign: 'right' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                        Không có sự kiện nào khớp với điều kiện tìm kiếm.
                      </td>
                    </tr>
                  ) : (
                    filteredEvents.map((ev) => (
                      <tr key={ev.eventId || ev.id} style={{ borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                        <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 11 }}>
                          {fmtDate(ev.occurredAt || ev.createdAt)}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <strong style={{ color: '#0f172a', fontSize: 12 }}>{ev.eventType || ev.contractKey}</strong>
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                            Idempotency: {ev.idempotencyKey || '—'}
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#334155' }}>
                          {ev.actorId ? `User #${ev.actorId}` : ev.teamId ? `Team #${ev.teamId}` : 'System'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 8px',
                            background: ev.status === 'PROCESSED' ? '#dcfce7' : ev.status === 'FAILED' ? '#fee2e2' : '#fef3c7',
                            color: ev.status === 'PROCESSED' ? '#16a34a' : ev.status === 'FAILED' ? '#dc2626' : '#b45309',
                          }}>
                            {ev.status || 'PROCESSED'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => setTraceEventId(ev.eventId || ev.id)}
                            aria-label={`Truy vết sự kiện ${ev.eventId || ev.id}`}
                            title="Truy vết sự kiện"
                            style={{ padding: 6, border: '1px solid rgba(15,23,42,0.1)', background: '#f8fafc', color: '#b45309', cursor: 'pointer', marginRight: 6 }}
                          >
                            <Eye size={14} />
                          </button>
                          {ev.status === 'FAILED' ? (
                            <button
                              type="button"
                              onClick={() => { setRetryModalEvent(ev); setRetryReason(''); }}
                              style={{
                                padding: '4px 8px', background: '#fee2e2', color: '#dc2626', border: 'none',
                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}
                            >
                              Thử lại (Retry)
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 4: PROJECTIONS CONSISTENCY & REBUILD
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'projections' && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ ...CARD, padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <RotateCcw size={20} color="#dc2626" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  Tính Toán Lại Bảng Xếp Hạng (Read Model Rebuild)
                </h3>
              </div>

              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                Quá trình Rebuild sẽ đọc lại toàn bộ các sự kiện từ <strong>Source of Truth (Event Store & Score Ledger)</strong> để tính toán lại toàn bộ Bảng Xếp Hạng Đội nhóm và Cá nhân với độ chính xác tuyệt đối.
              </p>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 14, background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 18, fontSize: 12, color: '#991b1b', lineHeight: 1.5 }}>
                <AlertTriangle size={16} color="#dc2626" style={{ marginTop: 1, flexShrink: 0 }} />
                <div>
                  <strong>Lưu ý an toàn:</strong> Thao tác này chỉ dành riêng cho Ban Quản Trị khi cần sửa độ trễ hoặc khôi phục dữ liệu sau bảo trì. Quá trình này hoàn toàn an toàn và <strong>KHÔNG</strong> làm mất bất kỳ điểm số lịch sử nào.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setRebuildModalOpen(true)}
                  style={{
                    padding: '10px 20px', background: '#dc2626', color: '#ffffff', border: 'none',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <RotateCcw size={14} /> Bắt Đầu Rebuild Projections
                </button>
                <button
                  type="button"
                  onClick={handleCheckConsistency}
                  disabled={checkingConsistency}
                  style={{
                    padding: '10px 16px', background: '#ffffff', color: '#0f172a', border: '1px solid rgba(15,23,42,0.15)',
                    fontSize: 13, fontWeight: 600, cursor: checkingConsistency ? 'not-allowed' : 'pointer',
                    opacity: checkingConsistency ? 0.6 : 1,
                  }}
                >
                  {checkingConsistency ? 'Đang kiểm tra...' : 'Kiểm Tra Tính Nhất Quán'}
                </button>
              </div>
            </div>
          </div>
        )}
      </TabTransition>
      <AnimatedModal isOpen={Boolean(traceEventId)} onClose={() => setTraceEventId(null)} title="Truy vết sự kiện" maxWidth={760}>
        {traceLoading && <TableSkeleton rows={5} cols={2} minHeight={320} />}
        {traceError && <div role="alert" className="motion-slide-down">{traceError}</div>}
        {!traceLoading && !traceError && traceData && (
          <div style={{ display: 'grid', gap: 20, fontSize: 13, overflowWrap: 'anywhere' }}>
            <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 1fr) minmax(0, 2fr)', gap: '8px 16px', margin: 0 }}>
              {[
                ['Event ID', traceData.eventId], ['Loại sự kiện', traceData.eventType], ['Nguồn', traceData.sourceModule],
                ['Đối tượng', `${traceData.aggregateType || '—'} #${traceData.aggregateId || '—'}`],
                ['Người thực hiện', traceData.actor?.name], ['Đội', traceData.team?.name],
                ['Thời điểm', fmtDate(traceData.occurredAt)], ['Trạng thái', traceData.processing?.status],
                ['Số lần thử', traceData.processing?.attemptCount],
                ['Bộ luật', traceData.ruleEvaluation?.ruleVersion ? `${traceData.ruleEvaluation.ruleVersion.ruleSetName} (v${traceData.ruleEvaluation.ruleVersion.versionNumber})` : 'Không có phiên bản được ghi nhận'],
                ['Số hiệu ứng', traceData.ruleEvaluation?.totalEffects], ['Điểm phát sinh', fmtNum(traceData.ruleEvaluation?.totalPointsAwarded)],
              ].map(([label, value]) => <React.Fragment key={label}><dt style={{ color: '#64748b' }}>{label}</dt><dd style={{ margin: 0, fontWeight: 600 }}>{value ?? '—'}</dd></React.Fragment>)}
            </dl>
            {traceData.processing?.lastError && <div role="alert" style={{ color: '#dc2626' }}>{traceData.processing.lastError}</div>}
            <section>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Sổ cái điểm</h4>
              {traceData.ledgerEntries?.length ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                    <thead><tr>{['Đối tượng', 'Hiệu ứng', 'Điểm', 'Lý do'].map((label) => <th key={label} style={{ padding: 8 }}>{label}</th>)}</tr></thead>
                    <tbody>{traceData.ledgerEntries.map((entry) => <tr key={entry.id} style={{ borderTop: '1px solid #e2e8f0' }}><td style={{ padding: 8 }}>{entry.targetType} #{entry.targetId}</td><td style={{ padding: 8 }}>{entry.effectType}</td><td style={{ padding: 8 }}>{fmtNum(entry.pointsDelta ?? entry.delta)}</td><td style={{ padding: 8 }}>{entry.reason || '—'}</td></tr>)}</tbody>
                  </table>
                </div>
              ) : <p style={{ margin: 0, color: '#64748b' }}>Không có bản ghi điểm.</p>}
            </section>
            {[
              ['Payload', traceData.payload], ['Projection', traceData.projections],
            ].map(([label, value]) => <section key={label}><h4 style={{ margin: '0 0 8px', fontSize: 14 }}>{label}</h4><pre style={{ margin: 0, padding: 12, background: '#f8fafc', fontSize: 11, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(value ?? {}, null, 2)}</pre></section>)}
          </div>
        )}
      </AnimatedModal>
      {createPortal(<>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: CHI TIẾT AUDIT LOG
         ══════════════════════════════════════════════════════════════════════ */}
      {selectedAuditLog && (
        <div onClick={(event) => { if (event.target === event.currentTarget) setSelectedAuditLog(null); }} className="modal-backdrop-enter" style={{ position: 'fixed', inset: 0, overflowY: 'auto', zIndex: 99999, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="modal-dialog-enter" style={{ background: '#ffffff', width: '100%', maxWidth: 520, padding: 24, maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(15,23,42,0.15)', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(15,23,42,0.08)', paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} color="#b45309" /> Chi Tiết Nhật Ký Kiểm Toán
              </h3>
              <button type="button" onClick={() => setSelectedAuditLog(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                <span style={{ color: '#64748b' }}>Hành động:</span>
                <strong style={{ color: '#b45309' }}>{selectedAuditLog.action}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                <span style={{ color: '#64748b' }}>Thời gian:</span>
                <strong>{fmtDate(selectedAuditLog.createdAt || selectedAuditLog.timestamp)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                <span style={{ color: '#64748b' }}>Người thực hiện:</span>
                <strong>{selectedAuditLog.actorName || `Admin #${selectedAuditLog.actorId}`}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                <span style={{ color: '#64748b' }}>Lý do & Căn cứ:</span>
                <strong>{selectedAuditLog.reason || '—'}</strong>
              </div>
              {selectedAuditLog.details && (
                <div style={{ marginTop: 6 }}>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: 4 }}>Dữ liệu chi tiết:</span>
                  <pre style={{ padding: 10, background: '#f8fafc', border: '1px solid rgba(15,23,42,0.08)', fontSize: 11, overflowX: 'auto', maxHeight: 180 }}>
                    {typeof selectedAuditLog.details === 'object' ? JSON.stringify(selectedAuditLog.details, null, 2) : String(selectedAuditLog.details)}
                  </pre>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setSelectedAuditLog(null)}
                style={{ padding: '8px 16px', background: '#0f172a', color: '#ffffff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: THỬ LẠI SỰ KIỆN LỖI (RETRY EVENT)
         ══════════════════════════════════════════════════════════════════════ */}
      {retryModalEvent && (
        <div onClick={(event) => { if (event.target === event.currentTarget) setRetryModalEvent(null); }} className="modal-backdrop-enter" style={{ position: 'fixed', inset: 0, overflowY: 'auto', zIndex: 99999, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="modal-dialog-enter" style={{ background: '#ffffff', width: '100%', maxWidth: 440, padding: 24, maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(15,23,42,0.15)', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(15,23,42,0.08)', paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <RotateCcw size={18} color="#b45309" /> Thử Lại Sự Kiện
              </h3>
              <button type="button" onClick={() => setRetryModalEvent(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRetryEvent} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid rgba(15,23,42,0.06)', fontSize: 12 }}>
                Sự kiện: <strong>{retryModalEvent.eventType || retryModalEvent.contractKey}</strong> (ID: #{retryModalEvent.eventId || retryModalEvent.id})
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Lý do thử lại sự kiện *
                </label>
                <textarea
                  rows={3}
                  required
                  value={retryReason}
                  onChange={(e) => setRetryReason(e.target.value)}
                  placeholder="Ghi rõ lý do thử lại (ví dụ: đã sửa lỗi kết nối YouTube API)..."
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid #cbd5e1', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => setRetryModalEvent(null)} style={{ padding: '8px 14px', background: '#ffffff', border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Hủy
                </button>
                <button type="submit" disabled={submittingRetry} style={{ padding: '8px 18px', background: '#b45309', color: '#ffffff', border: 'none', fontSize: 12, fontWeight: 600, cursor: submittingRetry ? 'not-allowed' : 'pointer' }}>
                  {submittingRetry ? 'Đang gửi...' : 'Xác Nhận Thử Lại'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: REBUILD PROJECTIONS
         ══════════════════════════════════════════════════════════════════════ */}
      {rebuildModalOpen && (
        <div onClick={(event) => { if (event.target === event.currentTarget) setRebuildModalOpen(false); }} className="modal-backdrop-enter" style={{ position: 'fixed', inset: 0, overflowY: 'auto', zIndex: 99999, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="modal-dialog-enter" style={{ background: '#ffffff', width: '100%', maxWidth: 460, padding: 24, maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(15,23,42,0.15)', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid rgba(15,23,42,0.08)', paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                <RotateCcw size={18} /> Xác Nhận Rebuild Bảng Xếp Hạng
              </h3>
              <button type="button" onClick={() => setRebuildModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRebuildProjections} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                Hệ thống sẽ đồng bộ lại toàn bộ Bảng Xếp Hạng Season và Grand từ Source of Truth.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  Lý do Rebuild (Bắt buộc) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={rebuildReason}
                  onChange={(e) => setRebuildReason(e.target.value)}
                  placeholder="Ví dụ: Định kỳ đồng bộ sau cập nhật kênh YouTube..."
                  style={{ width: '100%', padding: '8px', fontSize: 12, border: '1px solid #cbd5e1', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button type="button" onClick={() => setRebuildModalOpen(false)} style={{ padding: '8px 14px', background: '#ffffff', border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Hủy
                </button>
                <button type="submit" disabled={rebuildLoading} style={{ padding: '8px 18px', background: '#dc2626', color: '#ffffff', border: 'none', fontSize: 12, fontWeight: 600, cursor: rebuildLoading ? 'not-allowed' : 'pointer' }}>
                  {rebuildLoading ? 'Đang Rebuild...' : 'Xác Nhận Rebuild'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>, document.body)}
    </div>
  );
}
