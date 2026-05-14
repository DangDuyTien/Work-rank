import React, { useCallback, useEffect, useState } from 'react';
import { security } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useConfirm, useToast } from '../context/UiContext';
import { EmptyState, PageState, SegmentedControl } from '../components/ui';

const card = { background: '#ffffff', border: '1px solid rgba(15,23,42,0.1)', borderRadius: 10, padding: 18 };
const muted = { color: '#64748b', fontSize: 12, fontWeight: 600 };
const value = { color: '#0f172a', fontSize: 28, fontWeight: 800, marginTop: 8 };
const DAY_FILTERS = [
  { key: 1, label: '1 ngày' },
  { key: 7, label: '7 ngày' },
  { key: 30, label: '30 ngày' },
];

const FLAG_LABELS = {
  untrusted_signature: 'Dữ liệu không có chữ ký hợp lệ',
  missing_signature: 'Thiếu chữ ký bảo mật',
  missing_device_secret: 'Thiếu mã bí mật thiết bị',
  invalid_device_secret: 'Sai mã bí mật thiết bị',
  invalid_signature: 'Chữ ký dữ liệu bị sai',
  missing_sequence: 'Thiếu số thứ tự gói dữ liệu',
  replayed_or_old_sequence: 'Gửi lại dữ liệu cũ',
  high_click_rate: 'Tốc độ click cao bất thường',
  high_key_rate: 'Tốc độ gõ cao bất thường',
  high_mouse_move_rate: 'Tốc độ di chuột cao bất thường',
  clicks_without_mouse_movement: 'Nhiều click nhưng không di chuột',
  click_only_event: 'Chỉ click, không có thao tác khác',
  active_without_input: 'Có thời gian hoạt động nhưng không có input',
  robotic_repeated_click_pattern: 'Mẫu click lặp giống bot',
  repeated_click_pattern_streak: 'Lặp mẫu click nhiều lần liên tiếp',
  click_only_streak: 'Click-only nhiều lần liên tiếp',
  baseline_click_rate_spike: 'Click tăng đột biến so với thói quen',
  baseline_key_rate_spike: 'Gõ phím tăng đột biến so với thói quen',
  clock_skew: 'Thời gian thiết bị bị lệch',
};

function flagLabel(flag) {
  return FLAG_LABELS[flag] || flag;
}

function FlagList({ flags = {} }) {
  const rows = Object.entries(flags).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return <div style={muted}>Chưa có dấu hiệu nghi vấn.</div>;
  return rows.map(([flag, count]) => (
    <div key={flag} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
      <span style={{ color: '#475569', fontSize: 13 }}>{flagLabel(flag)}</span>
      <span style={{ color: '#f87171', fontWeight: 800 }}>{count}</span>
    </div>
  ));
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function actionLabel(action) {
  if (action === 'not_counted') return 'Không cộng điểm';
  if (action === 'flagged_only') return 'Gắn cờ theo dõi';
  return action || 'Theo dõi';
}

export default function Security() {
  const { socket } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [anomalies, setAnomalies] = useState(null);
  const [devices, setDevices] = useState([]);
  const [events, setEvents] = useState([]);
  const [days, setDays] = useState(1);
  const [quarantineAlert, setQuarantineAlert] = useState(null);
  const [pendingDeviceId, setPendingDeviceId] = useState(null);
  const confirm = useConfirm();
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [a, d, e] = await Promise.all([
        security.anomalies(days),
        security.devices(true),
        security.events(days, 50),
      ]);
      setAnomalies(a.data);
      setDevices(d.data.data || []);
      setEvents(e.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không tải được dữ liệu bảo mật');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    const handler = (payload) => {
      setQuarantineAlert(payload);
      void load();
    };
    socket.on('security:device:quarantined', handler);
    return () => socket.off('security:device:quarantined', handler);
  }, [load, socket]);

  const toggleDevice = async (device) => {
    const isRestore = !!device.revokedAt;
    const ok = await confirm({
      title: isRestore ? 'Mở khóa thiết bị?' : 'Khóa thiết bị?',
      message: isRestore
        ? `Thiết bị ${device.deviceName || device.deviceUuid} sẽ được phép gửi dữ liệu lại. Chỉ mở khóa khi đã kiểm tra xong.`
        : `Thiết bị ${device.deviceName || device.deviceUuid} của ${device.User?.email || 'người dùng này'} sẽ không gửi dữ liệu được nữa cho tới khi được mở khóa hoặc pair lại.`,
      confirmText: isRestore ? 'Mở khóa' : 'Khóa thiết bị',
      tone: isRestore ? 'info' : 'danger',
    });
    if (!ok) return;

    setPendingDeviceId(device.id);
    try {
      if (isRestore) await security.restoreDevice(device.id);
      else await security.revokeDevice(device.id);
      toast(isRestore ? 'Đã mở khóa thiết bị' : 'Đã khóa thiết bị', { type: 'success' });
      await load();
    } catch (err) {
      toast(err.response?.data?.message || 'Không xử lý được thiết bị', { type: 'error' });
    } finally {
      setPendingDeviceId(null);
    }
  };

  if (loading && !anomalies) return <PageState title="Đang tải trang bảo mật..." />;
  if (error && !anomalies) return <PageState type="error" title="Không tải được dữ liệu bảo mật" description={error} onRetry={load} />;

  return (
    <div className="security-page" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="security-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, color: '#0f172a' }}>Bảo Mật & Chống Gian Lận</h1>
          <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 14 }}>
            Lỗi nhẹ được ghi nhận để theo dõi. Nghi vấn cao không cộng điểm. Replay bị chặn. Thiết bị có nhiều event xấu sẽ tự động bị khóa.
          </p>
          {anomalies && (
            <p style={{ margin: '8px 0 0', color: '#475569', fontSize: 13, fontWeight: 700 }}>
              Quy tắc tự khóa: {anomalies.quarantineThreshold} event nghi vấn cao trong {anomalies.quarantineWindowMinutes} phút.
            </p>
          )}
        </div>
        <SegmentedControl
          ariaLabel="Khoảng thời gian bảo mật"
          options={DAY_FILTERS}
          value={days}
          onChange={setDays}
        />
      </div>

      {loading && anomalies && <div style={{ color: '#64748b', fontSize: 12 }}>Đang làm mới dữ liệu...</div>}

      {quarantineAlert && (
        <div style={{
          ...card,
          borderColor: 'rgba(220,38,38,0.25)',
          background: 'linear-gradient(90deg, rgba(254,242,242,0.9), #ffffff)',
        }}>
          <div style={{ color: '#991b1b', fontWeight: 900, fontSize: 14, marginBottom: 6 }}>Thiết bị vừa bị khóa tự động</div>
          <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.5 }}>
            Thiết bị <b>{quarantineAlert.deviceName || quarantineAlert.deviceUuid}</b> của <b>{quarantineAlert.email || quarantineAlert.name}</b> đã bị khóa vì có {quarantineAlert.flaggedEventsInWindow} lần gửi dữ liệu nghi vấn cao trong {quarantineAlert.windowMinutes} phút.
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        <div style={card}><div style={muted}>Tổng lượt dữ liệu</div><div style={value}>{anomalies?.totalEvents || 0}</div></div>
        <div style={card}><div style={muted}>Cảnh báo nhẹ</div><div style={{ ...value, color: '#f59e0b' }}>{anomalies?.warningEvents || 0}</div></div>
        <div style={card}><div style={muted}>Nghi vấn cao</div><div style={{ ...value, color: '#dc2626' }}>{anomalies?.flaggedEvents || 0}</div></div>
        <div style={card}><div style={muted}>Điểm nghi vấn TB</div><div style={value}>{anomalies?.averageSuspicionScore || 0}</div></div>
        <div style={card}><div style={muted}>Thiết bị bị khóa</div><div style={{ ...value, color: '#7f1d1d' }}>{anomalies?.quarantinedDevices || 0}</div></div>
      </div>

      <div className="security-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 14 }}>
        <div style={card}>
          <h2 style={{ margin: '0 0 12px', color: '#1e293b', fontSize: 16 }}>Các dấu hiệu nghi vấn</h2>
          <FlagList flags={anomalies?.flagCounts} />
        </div>

        <div style={card}>
          <h2 style={{ margin: '0 0 12px', color: '#1e293b', fontSize: 16 }}>Quản lý thiết bị</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: '#64748b', textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px' }}>Thiết bị</th>
                  <th style={{ padding: '10px 8px' }}>Người dùng</th>
                  <th style={{ padding: '10px 8px' }}>Đồng bộ cuối</th>
                  <th style={{ padding: '10px 8px' }}>Trạng thái</th>
                  <th style={{ padding: '10px 8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.id} style={{ borderTop: '1px solid rgba(15,23,42,0.08)' }}>
                    <td style={{ padding: '10px 8px', color: '#1e293b' }}>{device.deviceName}<div style={{ color: '#64748b', fontSize: 11 }}>{device.deviceUuid}</div></td>
                    <td style={{ padding: '10px 8px', color: '#334155' }}>{device.User?.email || '—'}</td>
                    <td style={{ padding: '10px 8px', color: '#64748b' }}>{device.lastSyncAt ? new Date(device.lastSyncAt).toLocaleString() : '—'}</td>
                    <td style={{ padding: '10px 8px' }}><span style={{ color: device.revokedAt ? '#f87171' : '#22c55e', fontWeight: 800 }}>{device.revokedAt ? 'Đã khóa' : 'Đang hoạt động'}</span></td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                      <button
                        type="button"
                        disabled={pendingDeviceId === device.id}
                        onClick={() => toggleDevice(device)}
                        style={{
                          background: device.revokedAt ? '#16a34a' : '#dc2626',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '8px 10px',
                          cursor: pendingDeviceId === device.id ? 'wait' : 'pointer',
                          fontWeight: 800,
                          opacity: pendingDeviceId === device.id ? 0.72 : 1,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {pendingDeviceId === device.id ? 'Đang xử lý...' : device.revokedAt ? 'Mở khóa' : 'Khóa'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, color: '#1e293b', fontSize: 16 }}>Bằng chứng event nghi vấn gần đây</h2>
            <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: 12 }}>Hiển thị tối đa 50 event có điểm nghi vấn lớn hơn 0 trong khoảng đã chọn.</p>
          </div>
          <button
            type="button"
            onClick={load}
            style={{ border: '1px solid rgba(37,99,235,0.18)', background: 'rgba(37,99,235,0.08)', color: '#2563eb', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}
          >
            Làm mới
          </button>
        </div>
        {events.length === 0 ? (
          <EmptyState title="Chưa có event nghi vấn" description="Khoảng thời gian này chưa phát hiện dữ liệu bất thường cần kiểm tra." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 940 }}>
              <thead>
                <tr style={{ color: '#64748b', textAlign: 'left', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                  <th style={{ padding: '10px 8px' }}>Thời gian</th>
                  <th style={{ padding: '10px 8px' }}>Người dùng</th>
                  <th style={{ padding: '10px 8px' }}>Thiết bị</th>
                  <th style={{ padding: '10px 8px' }}>Điểm</th>
                  <th style={{ padding: '10px 8px' }}>Xử lý</th>
                  <th style={{ padding: '10px 8px' }}>Dấu hiệu</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Gõ/Click</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} style={{ borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
                    <td style={{ padding: '10px 8px', color: '#475569', whiteSpace: 'nowrap' }}>{formatDateTime(event.eventTime)}</td>
                    <td style={{ padding: '10px 8px', color: '#1e293b', fontWeight: 700 }}>
                      {event.user?.name || '—'}
                      <div style={{ color: '#64748b', fontSize: 11, fontWeight: 500 }}>{event.user?.email || '—'}</div>
                    </td>
                    <td style={{ padding: '10px 8px', color: '#1e293b' }}>
                      {event.device?.deviceName || '—'}
                      <div style={{ color: '#64748b', fontSize: 11 }}>{event.device?.platform || '—'} {event.device?.appVersion || ''}</div>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ color: event.suspicionScore >= (anomalies?.highSuspicionThreshold || 70) ? '#dc2626' : '#d97706', fontWeight: 900 }}>
                        {event.suspicionScore}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', color: event.action === 'not_counted' ? '#dc2626' : '#d97706', fontWeight: 800 }}>{actionLabel(event.action)}</td>
                    <td style={{ padding: '10px 8px', color: '#475569' }}>{event.flags?.map(flagLabel).join(', ') || '—'}</td>
                    <td style={{ padding: '10px 8px', color: '#334155', textAlign: 'right', fontFamily: "'JetBrains Mono',monospace" }}>
                      {Number(event.totals?.keystrokeCount || 0).toLocaleString()} / {Number(event.totals?.mouseClickCount || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
