import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useActivityStats } from '../hooks/useActivityTracker';
import { computerActivityApi, desktopAgentIpc } from '../services/api';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Zap,
  Terminal,
  Server,
  Monitor,
  Database,
  Cpu,
  Play,
  Pause,
  Clock,
  ShieldCheck,
  MousePointer,
  Keyboard,
  Send,
  Layers,
} from 'lucide-react';

function formatTimestamp(ts) {
  if (!ts) return 'Chưa có';
  const d = new Date(ts);
  return d.toLocaleTimeString() + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

export default function ActivityDiagnostics() {
  const { user, socket } = useAuth();
  const navigate = useNavigate();
  const activityStats = useActivityStats();
  const {
    isTrackingActive,
    trackingStatus,
    displayPts,
    displayClicks,
    displayKeys,
    displayActiveMinutes,
    serverPts,
    serverClicks,
    serverKeys,
    serverActiveMinutes,
    serverRank,
    pendingPts,
    pendingClicks,
    pendingKeys,
    queueLength,
    syncStatus,
    ptsPerHour,
    avgApm,
    lastEventTime,
    lastFlushTime,
    lastFlushStatus,
    agentStatus: liveAgentStatus,
    toggleTracking,
    flushQueue,
    updateServerSummary,
  } = activityStats;

  const [companionDetail, setCompanionDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [logs, setLogs] = useState([]);

  const addLog = useCallback((msg, type = 'info') => {
    setLogs((prev) => [
      { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString(), msg, type },
      ...prev.slice(0, 49),
    ]);
  }, []);

  const refreshDiagnostics = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch DB Summary
      const summary = await computerActivityApi.getMySummary().catch((e) => {
        addLog(`DB Summary Error: ${e.message}`, 'error');
        return null;
      });
      if (summary) {
        const data = summary.data || summary;
        updateServerSummary(data);
        addLog(`Đồng bộ DB: serverPts=${data.activityScore ?? data.serverPts}, rank=${data.rank}`, 'success');
      }

      // 2. Fetch Desktop Agent Detail
      const comp = await desktopAgentIpc.checkStatus().catch(() => ({ running: false }));
      setCompanionDetail(comp);
      if (comp.running) {
        addLog(`Desktop Agent đang chạy trên cổng 43124 (${comp.platform || 'OS'}).`, 'success');
      } else {
        addLog('Desktop Agent không chạy trên cổng 43124 (sử dụng fallback Web/PWA).', 'warn');
      }
    } finally {
      setLoading(false);
    }
  }, [addLog, updateServerSummary]);

  useEffect(() => {
    refreshDiagnostics();
    const interval = setInterval(refreshDiagnostics, 8000);
    return () => clearInterval(interval);
  }, [refreshDiagnostics]);

  // Listen to Socket.IO events for live PTS updates
  useEffect(() => {
    if (!socket) return;
    const onPts = (data) => {
      addLog(`Socket.io [activity:pts:updated]: score=${data.activityScore || data.serverPts}, rank=${data.rank}`, 'info');
      updateServerSummary(data);
    };
    const onWaveTick = (snapshot) => {
      if (snapshot?.surfers) {
        const me = snapshot.surfers.find((s) => Number(s.userId) === Number(user?.id || user?.userId));
        if (me) {
          updateServerSummary({
            activityScore: me.score,
            rank: me.rank,
            activeMinutes: Math.round((me.activeSecondsToday || 0) / 60),
            topApp: me.currentApp,
          });
        }
      }
    };

    socket.on('activity:pts:updated', onPts);
    socket.on('activity:wave:tick', onWaveTick);

    return () => {
      socket.off('activity:pts:updated', onPts);
      socket.off('activity:wave:tick', onWaveTick);
    };
  }, [socket, user, addLog, updateServerSummary]);

  // Run a self-test batch through the API
  const runSelfTest = async () => {
    setTesting(true);
    setTestResult(null);
    addLog('Bắt đầu kiểm tra End-to-End Ingestion Pipeline...', 'info');

    try {
      const eventId = 'test_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const payload = {
        sessionId: 'diag_test_' + Date.now(),
        devicePlatform: 'web',
        events: [
          {
            eventId,
            state: 'ACTIVE',
            activeApp: 'Diagnostics Runner',
            appCategory: 'DEVELOPMENT',
            context: 'WEB',
            activeSeconds: 10,
            idleSeconds: 0,
            mouseClicks: 5,
            keyboardCount: 15,
            occurredAt: new Date().toISOString(),
          },
        ],
      };

      const res = await computerActivityApi.recordBatch(payload);
      const data = res.data || res;
      setTestResult({
        success: true,
        eventId,
        received: data.received,
        processed: data.processed,
        score: data.activityScore ?? data.serverPts,
        clicks: data.mouseClicks,
        keys: data.keyboardCount,
        rank: data.rank,
        timestamp: new Date().toLocaleTimeString(),
      });
      addLog(`Self-test thành công: +20 điểm đã ghi nhận vào DB. Server PTS = ${data.activityScore ?? data.serverPts}`, 'success');
      updateServerSummary(data);
    } catch (err) {
      setTestResult({
        success: false,
        error: err?.response?.data?.message || err.message,
        timestamp: new Date().toLocaleTimeString(),
      });
      addLog(`Self-test thất bại: ${err.message}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  const isAgentActive = liveAgentStatus?.running || companionDetail?.running;

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* HEADER BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '6px 12px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: '#334155',
            }}
          >
            <ArrowLeft size={16} />
            <span>Dashboard</span>
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Terminal size={22} color="#0284c7" />
              Activity Telemetry & Optimistic Score Engine
            </h1>
            <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>
              Kiến trúc Optimistic Local + Server Persistence • Điểm hiển thị tức thời (&lt;1ms), Server lưu nền &amp; Reconcile
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={runSelfTest}
            disabled={testing}
            style={{
              padding: '8px 16px',
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <Zap size={15} />
            <span>{testing ? 'Đang chạy...' : 'Bắn Test Ingestion (+20 pts)'}</span>
          </button>

          <button
            type="button"
            onClick={refreshDiagnostics}
            disabled={loading}
            style={{
              padding: '8px 14px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: '#334155',
            }}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Làm Mới</span>
          </button>
        </div>
      </div>

      {/* TOP STATUS & CONTROL BAR */}
      <div style={{ background: '#0f172a', color: '#ffffff', padding: '18px 20px', borderRadius: 8, marginBottom: 24, boxShadow: '0 4px 12px rgba(15,23,42,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 8, background: isTrackingActive ? '#15803d' : '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={24} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 800 }}>Trạng Thái Tracking:</span>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 800,
                  background: isTrackingActive ? '#dcfce7' : '#fee2e2',
                  color: isTrackingActive ? '#15803d' : '#991b1b',
                }}>
                  {isTrackingActive ? 'ĐANG THEO DÕI (ACTIVE)' : 'ĐÃ TẮT (OFF)'}
                </span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>State: {trackingStatus}</span>
              </div>
              <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>
                Platform: <strong>{isAgentActive ? `${companionDetail?.platform || 'Desktop'} System-Wide (CoreGraphics/Win32)` : 'Browser Activity Fallback'}</strong> • User: <strong>{user?.name}</strong> (#{user?.id || user?.userId})
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={async () => {
                await toggleTracking(user);
                setTimeout(refreshDiagnostics, 500);
              }}
              style={{
                padding: '9px 20px',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                fontWeight: 800,
                border: 'none',
                background: isTrackingActive ? '#ef4444' : '#22c55e',
                color: '#ffffff',
                boxShadow: isTrackingActive ? '0 2px 8px rgba(239,68,68,0.4)' : '0 2px 8px rgba(34,197,94,0.4)',
              }}
            >
              {isTrackingActive ? <Pause size={16} /> : <Play size={16} />}
              <span>{isTrackingActive ? 'Tắt Theo Dõi' : 'Bật Theo Dõi'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* OPTIMISTIC RECONCILIATION OVERVIEW */}
      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, padding: '18px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={20} color="#0284c7" />
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Mô Hình Tính Điểm Optimistic Local + Server Persistence
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 700,
              background: syncStatus === 'SYNCED' ? '#dcfce7' : syncStatus === 'SYNCING' ? '#e0f2fe' : '#fef3c7',
              color: syncStatus === 'SYNCED' ? '#15803d' : syncStatus === 'SYNCING' ? '#0369a1' : '#b45309',
            }}>
              {syncStatus === 'SYNCED' ? '✓ Đã đồng bộ với Server' : syncStatus === 'SYNCING' ? '⏳ Đang gửi batch lên Server...' : '⚠️ Chờ đồng bộ (Pending)'}
            </span>
            <button
              type="button"
              onClick={() => flushQueue()}
              disabled={queueLength === 0}
              style={{
                padding: '5px 12px',
                background: queueLength > 0 ? '#0284c7' : '#f1f5f9',
                color: queueLength > 0 ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: 4,
                cursor: queueLength > 0 ? 'pointer' : 'default',
                fontSize: 12,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Send size={12} />
              <span>Đồng Bộ Ngay ({queueLength})</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>1. Server PTS (Canonical DB)</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
              {serverPts.toLocaleString()} <span style={{ fontSize: 12, color: '#64748b' }}>pts</span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              {serverClicks.toLocaleString()} clicks • {serverKeys.toLocaleString()} phím đã lưu DB
            </div>
          </div>

          <div style={{ padding: '12px 14px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#b45309', textTransform: 'uppercase' }}>2. Pending Delta (+Local)</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#d97706', marginTop: 4 }}>
              +{pendingPts.toLocaleString()} <span style={{ fontSize: 12, color: '#b45309' }}>pts</span>
            </div>
            <div style={{ fontSize: 11, color: '#b45309', marginTop: 4 }}>
              {pendingClicks} click • {pendingKeys} phím trong buffer ({queueLength} events)
            </div>
          </div>

          <div style={{ padding: '12px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#047857', textTransform: 'uppercase' }}>3. Instant Display PTS (UI)</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#059669', marginTop: 4 }}>
              {displayPts.toLocaleString()} <span style={{ fontSize: 12, color: '#047857' }}>pts</span>
            </div>
            <div style={{ fontSize: 11, color: '#047857', marginTop: 4 }}>
              = Server ({serverPts}) + Pending (+{pendingPts}) • Tức thời &lt;1ms
            </div>
          </div>

          <div style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Tốc độ &amp; Thời gian</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0284c7', marginTop: 4 }}>
              {ptsPerHour ? `${ptsPerHour.toLocaleString()} pts/h` : 'Đang tính...'}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              Thời gian: {Math.floor(displayActiveMinutes / 60)}h {displayActiveMinutes % 60}m {avgApm ? `(~${avgApm} APM)` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* PIPELINE STAGES GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* STAGE 1: IN-BROWSER LISTENER */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Monitor size={18} color="#0284c7" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>1. Local Capture (<span style={{ color: '#059669' }}>&lt;1ms</span>)</span>
            </div>
            {isTrackingActive ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={13} /> ACTIVE
              </span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                <XCircle size={13} /> OFF
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6, color: '#334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Tổng Clicks:</span>
              <strong>{displayClicks.toLocaleString()} (Pending: +{pendingClicks})</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Tổng Phím:</span>
              <strong>{displayKeys.toLocaleString()} (Pending: +{pendingKeys})</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Tương tác cuối:</span>
              <strong>{formatTimestamp(lastEventTime)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Queue Buffer:</span>
              <strong style={{ color: queueLength > 0 ? '#d97706' : '#16a34a' }}>{queueLength} events</strong>
            </div>
          </div>
        </div>

        {/* STAGE 2: DESKTOP AGENT COMPANION */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Cpu size={18} color="#7c3aed" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>2. Desktop Agent IPC</span>
            </div>
            {isAgentActive ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={13} /> PORT 43124
              </span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={13} /> OFFLINE (WEB ONLY)
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6, color: '#334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Trạng thái Agent:</span>
              <strong>{companionDetail?.running ? 'Running (50Hz Poller)' : 'Not running'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>App active:</span>
              <strong>{companionDetail?.currentApp || 'Browser / N/A'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Phân loại:</span>
              <strong>{companionDetail?.currentCategory || 'OTHER'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Idle Time:</span>
              <strong>{companionDetail?.lastIdleSeconds !== undefined ? `${companionDetail.lastIdleSeconds}s` : '0s'}</strong>
            </div>
          </div>
        </div>

        {/* STAGE 3: API & BATCH INGESTION */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Server size={18} color="#059669" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>3. Batch Flush &amp; ACK</span>
            </div>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: lastFlushStatus === 'SUCCESS' ? '#16a34a' : lastFlushStatus === 'ERROR' ? '#dc2626' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              {lastFlushStatus === 'SUCCESS' && <CheckCircle2 size={13} />}
              {lastFlushStatus}
            </span>
          </div>
          <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6, color: '#334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Flush cuối:</span>
              <strong>{formatTimestamp(lastFlushTime)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Chu kỳ batch:</span>
              <strong>4 giây / hoặc khi queue &gt;= 8</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Endpoint:</span>
              <strong>POST /api/activity/computer/batch</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Idempotency:</span>
              <strong style={{ color: '#16a34a' }}>Unique eventId Safe</strong>
            </div>
          </div>
        </div>

        {/* STAGE 4: DATABASE & PERSISTED PTS */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={18} color="#b45309" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>4. Canonical DB &amp; Rank</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={13} /> ATOMIC DB
            </span>
          </div>
          <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6, color: '#334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Server PTS (DB):</span>
              <strong style={{ color: '#059669', fontSize: 14 }}>
                {serverPts.toLocaleString()} pts
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Thao tác đã lưu:</span>
              <strong style={{ color: '#0f172a' }}>
                {serverClicks.toLocaleString()} clicks • {serverKeys.toLocaleString()} phím
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Vị trí BXH (Hôm nay):</span>
              <strong>{serverRank ? `#${serverRank}` : 'Chưa xếp hạng'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Thời gian active DB:</span>
              <strong>{serverActiveMinutes} phút</strong>
            </div>
          </div>
        </div>
      </div>

      {/* SELF-TEST REPORT IF AVAILABLE */}
      {testResult && (
        <div style={{
          background: testResult.success ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${testResult.success ? '#86efac' : '#fca5a5'}`,
          borderRadius: 6,
          padding: 16,
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {testResult.success ? <CheckCircle2 size={18} color="#16a34a" /> : <XCircle size={18} color="#dc2626" />}
            <span style={{ fontSize: 14, fontWeight: 700, color: testResult.success ? '#166534' : '#991b1b' }}>
              {testResult.success ? 'KẾT QUẢ SELF-TEST: THÀNH CÔNG' : 'KẾT QUẢ SELF-TEST: THẤT BẠI'}
            </span>
            <span style={{ fontSize: 11, color: '#64748b' }}>({testResult.timestamp})</span>
          </div>
          {testResult.success ? (
            <div style={{ fontSize: 13, color: '#166534', display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <span>Event ID: <code>{testResult.eventId}</code></span>
              <span>Events nhận: <strong>{testResult.received}</strong> (Xử lý: <strong>{testResult.processed}</strong>)</span>
              <span>Server PTS mới: <strong>{testResult.score} pts</strong></span>
              <span>Clicks: <strong>{testResult.clicks}</strong> • Phím: <strong>{testResult.keys}</strong></span>
              <span>BXH Rank: <strong>#{testResult.rank}</strong></span>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#991b1b' }}>
              Lỗi: {testResult.error}
            </div>
          )}
        </div>
      )}

      {/* LIVE EVENT LOGS */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={16} color="#334155" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Nhật Ký Sự Kiện Realtime (Live Logs)</span>
          </div>
          <button
            type="button"
            onClick={() => setLogs([])}
            style={{ fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Xóa nhật ký
          </button>
        </div>

        <div style={{
          background: '#0f172a',
          color: '#e2e8f0',
          borderRadius: 4,
          padding: 12,
          fontFamily: 'monospace',
          fontSize: 12,
          maxHeight: 220,
          overflowY: 'auto',
        }}>
          {logs.length === 0 ? (
            <div style={{ color: '#64748b', fontStyle: 'italic' }}>Chưa có sự kiện nào được ghi nhận. Bấm nút Bật Theo Dõi hoặc Bắn Batch Tự Test để xem luồng dữ liệu...</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} style={{
                marginBottom: 4,
                color: log.type === 'error' ? '#f87171' : log.type === 'warn' ? '#fde047' : log.type === 'success' ? '#4ade80' : '#cbd5e1',
              }}>
                <span style={{ color: '#64748b' }}>[{log.time}]</span> {log.msg}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
