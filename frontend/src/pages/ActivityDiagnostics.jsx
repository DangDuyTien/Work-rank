import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useActivityStats } from '../hooks/useActivityTracker';
import { computerActivityApi, activityApi, desktopAgentIpc } from '../services/api';
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
  Radio,
  Play,
  Pause,
  Clock,
  Flame,
  ShieldCheck,
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
    clicks,
    keyboard,
    activeSeconds,
    idleSeconds,
    lastEventTime,
    lastFlushTime,
    lastFlushStatus,
    queueLength,
    agentStatus: liveAgentStatus,
    toggleTracking,
    startTracking,
    stopTracking,
  } = activityStats;

  const [dbSummary, setDbSummary] = useState(null);
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
        setDbSummary(summary.data || summary);
        addLog('Đã đồng bộ dữ liệu từ Database (ComputerDailyStat).', 'success');
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
  }, [addLog]);

  useEffect(() => {
    refreshDiagnostics();
    const interval = setInterval(refreshDiagnostics, 8000);
    return () => clearInterval(interval);
  }, [refreshDiagnostics]);

  // Listen to Socket.IO events for live PTS updates
  useEffect(() => {
    if (!socket) return;
    const onPts = (data) => {
      addLog(`Socket.io [activity:pts:updated]: score=${data.activityScore}, rank=${data.rank}`, 'info');
      setDbSummary((prev) => ({
        ...prev,
        activityScore: data.activityScore,
        rank: data.rank,
        activeMinutes: data.activeMinutes,
        topApp: data.topApp || prev?.topApp,
      }));
    };
    const onWaveTick = (snapshot) => {
      if (snapshot?.surfers) {
        const me = snapshot.surfers.find((s) => Number(s.userId) === Number(user?.id || user?.userId));
        if (me) {
          setDbSummary((prev) => ({
            ...prev,
            activityScore: me.score,
            rank: me.rank,
            activeMinutes: Math.round((me.activeSecondsToday || 0) / 60),
            topApp: me.currentApp || prev?.topApp,
          }));
        }
      }
    };

    socket.on('activity:pts:updated', onPts);
    socket.on('activity:wave:tick', onWaveTick);

    return () => {
      socket.off('activity:pts:updated', onPts);
      socket.off('activity:wave:tick', onWaveTick);
    };
  }, [socket, user, addLog]);

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
            activeSeconds: 15,
            idleSeconds: 0,
            mouseClicks: 5,
            keyboardCount: 20,
            occurredAt: new Date().toISOString(),
          },
        ],
      };

      const start = performance.now();
      const res = await computerActivityApi.recordBatch(payload);
      const latency = Math.round(performance.now() - start);

      setTestResult({
        success: true,
        latency,
        data: res,
      });
      addLog(`Self-test thành công: Đã ghi nhận batch trong ${latency}ms (PTS: ${res.score || res.activityScore || 'OK'})`, 'success');
      refreshDiagnostics();
    } catch (err) {
      setTestResult({
        success: false,
        error: err.response?.data?.message || err.message,
      });
      addLog(`Self-test thất bại: ${err.message}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  const ptsPerHour = dbSummary?.activeMinutes > 0
    ? Math.round((Number(dbSummary.activityScore || 0) / dbSummary.activeMinutes) * 60)
    : 0;

  const isAgentActive = companionDetail?.running || liveAgentStatus?.running;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 60px' }}>
      {/* HEADER */}
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
              Activity Telemetry Diagnostics & Health
            </h1>
            <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>
              Kiểm tra toàn diện Pipeline: UI Controller → Listener → Agent → API → Database → Realtime WebSocket
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
            <span>{testing ? 'Đang chạy test...' : 'Bắn Batch Tự Test (Simulate)'}</span>
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

      {/* TOP STATUS BAR */}
      <div style={{ background: '#0f172a', color: '#ffffff', padding: '18px 20px', borderRadius: 8, marginBottom: 24, boxShadow: '0 4px 12px rgba(15,23,42,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 8, background: isTrackingActive ? '#15803d' : '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={24} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 800 }}>Trạng Thái Toàn Cục:</span>
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
                Platform: <strong>{isAgentActive ? `${companionDetail?.platform || 'Desktop'} System-Wide` : 'Browser Fallback (Web/PWA)'}</strong> • User ID: <strong>{user?.id || user?.userId}</strong> ({user?.name})
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

      {/* PIPELINE STAGES GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* STAGE 1: IN-BROWSER LISTENER */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Monitor size={18} color="#0284c7" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>1. Browser Listeners</span>
            </div>
            {isTrackingActive ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={13} /> ATTACHED
              </span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                <XCircle size={13} /> DETACHED
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6, color: '#334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Clicks ghi nhận:</span>
              <strong>{clicks.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Phím ghi nhận:</span>
              <strong>{keyboard.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Sự kiện cuối:</span>
              <strong>{formatTimestamp(lastEventTime)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Hàng đợi đệm (Queue):</span>
              <strong>{queueLength} events</strong>
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
              <strong>{companionDetail?.running ? 'Running' : 'Not running'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>App đang active:</span>
              <strong>{companionDetail?.currentApp || 'Browser / N/A'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Phân loại App:</span>
              <strong>{companionDetail?.currentCategory || 'BROWSER'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Idle Time hiện tại:</span>
              <strong>{companionDetail?.lastIdleSeconds !== undefined ? `${companionDetail.lastIdleSeconds}s` : 'N/A'}</strong>
            </div>
          </div>
        </div>

        {/* STAGE 3: API & BATCH INGESTION */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Server size={18} color="#059669" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>3. API & Batch Flush</span>
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
              <span style={{ color: '#64748b' }}>Lần flush cuối:</span>
              <strong>{formatTimestamp(lastFlushTime)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Chu kỳ batch:</span>
              <strong>5s (Agent) / 15s (Web)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Batch Endpoint:</span>
              <strong>POST /api/activity/computer/batch</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Idempotency / Dedup:</span>
              <strong style={{ color: '#16a34a' }}>Bảo vệ trùng lặp 5000 events</strong>
            </div>
          </div>
        </div>

        {/* STAGE 4: DATABASE & PERSISTED PTS */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={18} color="#b45309" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>4. Persisted Database & PTS</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={13} /> ATOMIC DB
            </span>
          </div>
          <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6, color: '#334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Điểm Năng Động (PTS):</span>
              <strong style={{ color: '#059669', fontSize: 14 }}>
                {(dbSummary?.activityScore || 0).toLocaleString()} pts
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Thao tác đã lưu:</span>
              <strong style={{ color: '#0f172a' }}>
                {(dbSummary?.mouseClicks || 0).toLocaleString()} clicks • {(dbSummary?.keyboardCount || 0).toLocaleString()} phím
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Tốc độ tích lũy:</span>
              <strong style={{ color: '#0284c7' }}>{ptsPerHour.toLocaleString()} pts/h</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Thời gian active hôm nay:</span>
              <strong>{dbSummary?.activeMinutes || 0} phút</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Vị trí BXH (DB):</span>
              <strong>{dbSummary?.rank ? `#${dbSummary.rank}` : 'Chưa xếp hạng'}</strong>
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
          </div>
          <div style={{ fontSize: 12, color: testResult.success ? '#15803d' : '#b91c1c' }}>
            {testResult.success ? (
              <div>
                Đã gửi thành công batch kiểm tra với độ trễ phản hồi: <strong>{testResult.latency}ms</strong>. Server đã commit điểm PTS và broadcast qua Socket.IO.
              </div>
            ) : (
              <div>Lỗi: {testResult.error}</div>
            )}
          </div>
        </div>
      )}

      {/* REAL-TIME DIAGNOSTIC EVENT LOG STREAM */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Radio size={16} color="#0f172a" />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Nhật Ký Dữ Liệu Thời Gian Thực (Live Telemetry Logs)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setLogs([])}
            style={{ fontSize: 11, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
          >
            Xóa nhật ký
          </button>
        </div>

        <div style={{
          background: '#090d16',
          color: '#e2e8f0',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          padding: 14,
          borderRadius: 4,
          height: 240,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {logs.length === 0 ? (
            <div style={{ color: '#64748b' }}>// Đang chờ sự kiện telemetry mới...</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: '#64748b' }}>[{log.time}]</span>
                <span style={{
                  color: log.type === 'success' ? '#4ade80' : log.type === 'error' ? '#f87171' : log.type === 'warn' ? '#fbbf24' : '#38bdf8',
                }}>
                  {log.msg}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
