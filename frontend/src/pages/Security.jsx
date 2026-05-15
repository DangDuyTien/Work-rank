import React, { useCallback, useEffect, useState } from 'react';
import { security } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useConfirm, useToast } from '../context/UiContext';
import { EmptyState, PageState, SegmentedControl } from '../components/ui';

const card = { background: '#ffffff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 10, padding: 18, boxShadow: '0 4px 24px rgba(15,23,42,0.08)' };
const muted = { color: '#94a3b8', fontSize: 12, fontWeight: 600 };
const value = { color: '#0f172a', fontSize: 28, fontWeight: 800, marginTop: 8 };
const DAY_FILTERS = [
  { key: 1, label: '1 ngày' },
  { key: 7, label: '7 ngày' },
  { key: 30, label: '30 ngày' },
];
const EVENT_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'red', label: 'Đỏ' },
  { key: 'yellow', label: 'Vàng' },
];

const FLAG_LABELS = {
  untrusted_signature: 'Dữ liệu không có chữ ký hợp lệ',
  missing_signature: 'Thiếu chữ ký bảo mật',
  missing_device_secret: 'Thiếu mã bí mật thiết bị',
  invalid_device_secret: 'Sai mã bí mật thiết bị',
  invalid_signature: 'Chữ ký dữ liệu bị sai',
  missing_sequence: 'Thiếu số thứ tự gói dữ liệu',
  replayed_or_old_sequence: 'Gửi lại dữ liệu cũ',
  large_sequence_gap: 'Sequence nhảy bất thường',
  missing_session: 'Thiếu phiên làm việc',
  event_time_out_of_order: 'Thời gian event không theo thứ tự',
  high_click_rate: 'Tốc độ click cao bất thường',
  high_key_rate: 'Tốc độ gõ cao bất thường',
  high_combined_action_rate: 'Tốc độ thao tác tổng cao bất thường',
  too_many_actions_in_event: 'Quá nhiều thao tác trong một gói',
  active_window_too_large: 'Khoảng active quá dài bất thường',
  idle_window_too_large: 'Khoảng idle quá dài bất thường',
  input_without_active_time: 'Có input nhưng không có thời gian active',
  high_mouse_move_rate: 'Tốc độ thao tác chuột cao bất thường',
  clicks_without_mouse_movement: 'Nhiều click không hợp lệ',
  click_only_event: 'Chỉ có click trong một khoảng ngắn',
  active_without_input: 'Có thời gian hoạt động nhưng không có input',
  robotic_repeated_click_pattern: 'Mẫu click lặp giống bot',
  repeated_click_pattern_streak: 'Lặp mẫu click nhiều lần liên tiếp',
  click_only_streak: 'Click lặp lại nhiều lần liên tiếp',
  baseline_click_rate_spike: 'Click tăng đột biến so với thói quen',
  baseline_key_rate_spike: 'Gõ phím tăng đột biến so với thói quen',
  clock_skew: 'Thời gian thiết bị bị lệch',
};

const FLAG_GUIDES = {
  untrusted_signature: ['Dữ liệu không chứng minh được là từ Desktop Tracker đã pair.', 'Yêu cầu người dùng mở lại app, nếu còn lặp lại thì pair/cài lại app.'],
  missing_signature: ['Gói dữ liệu thiếu chữ ký bảo mật.', 'Kiểm tra phiên bản Desktop Tracker và bắt người dùng cài lại bản chính thức.'],
  missing_device_secret: ['Thiếu mã bí mật thiết bị trong gói gửi lên.', 'Pair lại thiết bị hoặc đăng nhập lại Desktop Tracker.'],
  invalid_device_secret: ['Mã bí mật thiết bị không khớp với server.', 'Khóa thiết bị nếu lặp lại, sau đó pair lại từ app chính thức.'],
  invalid_signature: ['Nội dung gói dữ liệu đã khác với chữ ký.', 'Xem đây là rủi ro cao; kiểm tra app có bị sửa hoặc gửi giả lập không.'],
  missing_sequence: ['Gói dữ liệu thiếu số thứ tự chống replay.', 'Yêu cầu cập nhật/cài lại Desktop Tracker.'],
  replayed_or_old_sequence: ['Dữ liệu cũ bị gửi lại.', 'Không cần cộng điểm; nếu lặp lại thì khóa device và pair lại.'],
  large_sequence_gap: ['Sequence nhảy xa bất thường so với event trước.', 'Hỏi người dùng có reset app, đổi máy, hoặc dùng bản app khác không.'],
  missing_session: ['Event không gắn với phiên làm việc đang chạy.', 'Kiểm tra app có Start session đúng không, rồi yêu cầu mở lại Desktop Tracker.'],
  event_time_out_of_order: ['Thời gian event đi lùi so với event trước.', 'Kiểm tra giờ hệ thống của máy và app có bị mở nhiều bản không.'],
  clock_skew: ['Giờ trên máy lệch nhiều so với server.', 'Yêu cầu bật đồng bộ giờ tự động trên Windows/macOS.'],
  high_click_rate: ['Số click/giây vượt ngưỡng người dùng bình thường.', 'Hỏi có dùng auto click, macro chuột, tool test hoặc game/script không.'],
  high_key_rate: ['Số phím/giây vượt ngưỡng người dùng bình thường.', 'Kiểm tra macro bàn phím, paste/script, tool auto type.'],
  high_combined_action_rate: ['Tổng click + phím/giây quá cao dù từng loại có thể chưa vượt riêng.', 'So với công việc thực tế của user; nếu không hợp lý thì không mở khóa vội.'],
  too_many_actions_in_event: ['Một gói gửi lên chứa quá nhiều thao tác.', 'Kiểm tra app có bị treo rồi dồn dữ liệu, hoặc có automation.'],
  active_window_too_large: ['Khoảng active trong một event dài hơn app chuẩn.', 'Yêu cầu cập nhật/cài lại app vì app chuẩn gửi event ngắn đều.'],
  idle_window_too_large: ['Khoảng idle quá dài trong một event.', 'Thường do app treo/mất mạng lâu; kiểm tra kết nối và phiên bản app.'],
  input_without_active_time: ['Có click/phím nhưng lại không có thời gian active.', 'Dấu hiệu dữ liệu không tự nhiên; nếu lặp lại thì khóa/pair lại device.'],
  active_without_input: ['Có active time nhưng không có click/phím.', 'Có thể là ngồi đọc/tạm dừng thao tác; nếu ít thì chỉ theo dõi.'],
  robotic_repeated_click_pattern: ['Mẫu click lặp đều giống bot.', 'Hỏi user về auto click/macro; kiểm tra nhiều event liên tiếp cùng kiểu.'],
  repeated_click_pattern_streak: ['Mẫu click giống nhau lặp nhiều lần.', 'Nếu user không giải thích được, giữ khóa device và pair lại.'],
  baseline_click_rate_spike: ['Click tăng mạnh so với thói quen trước đó.', 'So sánh với loại việc hôm đó; có thể hợp lệ nếu đổi task đặc thù.'],
  baseline_key_rate_spike: ['Gõ phím tăng mạnh so với thói quen trước đó.', 'Kiểm tra có task nhập liệu đặc biệt hoặc automation/paste/script.'],
};

function flagLabel(flag) {
  return FLAG_LABELS[flag] || flag;
}

function flagGuide(flag) {
  return FLAG_GUIDES[flag] || ['Rule kỹ thuật phát hiện dữ liệu lệch chuẩn.', 'Mở chi tiết event, so sánh user/device/time và hỏi lại người dùng nếu lặp lại.'];
}

function eventSeverity(event, threshold = 60) {
  return Number(event.suspicionScore || 0) >= threshold ? 'red' : 'yellow';
}

function severityMeta(severity) {
  if (severity === 'red') {
    return {
      label: 'Đỏ',
      color: '#dc2626',
      bg: 'rgba(239,68,68,0.1)',
      border: 'rgba(239,68,68,0.22)',
      text: 'Không cộng điểm',
    };
  }
  return {
    label: 'Vàng',
    color: '#b45309',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.24)',
    text: 'Theo dõi',
  };
}

function primaryFlag(event) {
  return event.flags?.[0] || 'unknown';
}

function FlagList({ flags = {} }) {
  const rows = Object.entries(flags).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return <div style={muted}>Chưa có dấu hiệu nghi vấn.</div>;
  return rows.map(([flag, count]) => (
    <div key={flag} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(15,23,42,0.06)' }}>
      <span style={{ color: '#94a3b8', fontSize: 13 }}>{flagLabel(flag)}</span>
      <span style={{ color: '#ef4444', fontWeight: 800 }}>{count}</span>
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

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="security-section-head">
      <div>
        <h2 className="security-section-title">{title}</h2>
        {subtitle && <p className="security-section-subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export default function Security() {
  const { socket } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [anomalies, setAnomalies] = useState(null);
  const [devices, setDevices] = useState([]);
  const [events, setEvents] = useState([]);
  const [days, setDays] = useState(1);
  const [eventFilter, setEventFilter] = useState('all');
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

  const isClean = Number(anomalies?.flaggedEvents || 0) === 0 && Number(anomalies?.quarantinedDevices || 0) === 0;
  const hasWarnings = Number(anomalies?.warningEvents || 0) > 0;
  const highThreshold = Number(anomalies?.highSuspicionThreshold || 60);
  const redEvents = events.filter((event) => eventSeverity(event, highThreshold) === 'red');
  const yellowEvents = events.filter((event) => eventSeverity(event, highThreshold) === 'yellow');
  const filteredEvents = events.filter((event) => eventFilter === 'all' || eventSeverity(event, highThreshold) === eventFilter);

  return (
    <div className="security-page" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="security-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, color: '#0f172a' }}>Bảo Mật & Chống Gian Lận</h1>
          <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: 14 }}>
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

      {loading && anomalies && <div style={{ color: '#94a3b8', fontSize: 12 }}>Đang làm mới dữ liệu...</div>}

      {quarantineAlert && (
        <div style={{
          ...card,
          borderColor: 'rgba(239,68,68,0.3)',
          background: 'linear-gradient(90deg, rgba(254,242,242,0.9), #ffffff)',
        }}>
          <div style={{ color: '#ef4444', fontWeight: 900, fontSize: 14, marginBottom: 6 }}>Thiết bị vừa bị khóa tự động</div>
          <div style={{ color: '#1e293b', fontSize: 13, lineHeight: 1.5 }}>
            Thiết bị <b>{quarantineAlert.deviceName || quarantineAlert.deviceUuid}</b> của <b>{quarantineAlert.email || quarantineAlert.name}</b> đã bị khóa vì có {quarantineAlert.flaggedEventsInWindow} lần gửi dữ liệu nghi vấn cao trong {quarantineAlert.windowMinutes} phút.
          </div>
        </div>
      )}

      {anomalies && (
        <section className="security-section" style={{
          borderColor: isClean ? 'rgba(34,197,94,0.24)' : hasWarnings ? 'rgba(245,158,11,0.24)' : 'rgba(239,68,68,0.24)',
          background: isClean
            ? 'linear-gradient(90deg, rgba(240,253,244,0.95), #ffffff)'
            : hasWarnings
              ? 'linear-gradient(90deg, rgba(255,251,235,0.95), #ffffff)'
              : 'linear-gradient(90deg, rgba(254,242,242,0.95), #ffffff)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: isClean ? '#22c55e' : hasWarnings ? '#f59e0b' : '#ef4444',
              boxShadow: isClean ? '0 0 12px rgba(34,197,94,0.45)' : 'none',
              flexShrink: 0,
            }} />
            <div>
              <div style={{ color: isClean ? '#16a34a' : hasWarnings ? '#b45309' : '#dc2626', fontSize: 14, fontWeight: 900 }}>
                {isClean ? 'Trạng thái xanh' : hasWarnings ? 'Có cảnh báo cần theo dõi' : 'Có rủi ro cần xử lý'}
              </div>
              <div style={{ color: '#475569', fontSize: 13, marginTop: 3, fontWeight: 600 }}>
                {isClean
                  ? 'Chưa ghi nhận nghi vấn cao hoặc thiết bị bị khóa trong khoảng thời gian đang chọn.'
                  : `Đang có ${anomalies.warningEvents || 0} cảnh báo nhẹ, ${anomalies.flaggedEvents || 0} nghi vấn cao.`}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="security-section">
        <SectionHeader title="Tổng quan" subtitle="Các chỉ số chính trong khoảng thời gian đang chọn." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          <div style={card}><div style={muted}>Tổng lượt dữ liệu</div><div style={value}>{anomalies?.totalEvents || 0}</div></div>
          <div style={card}><div style={muted}>Cảnh báo nhẹ</div><div style={{ ...value, color: '#f59e0b' }}>{anomalies?.warningEvents || 0}</div></div>
          <div style={card}><div style={muted}>Nghi vấn cao</div><div style={{ ...value, color: '#ef4444' }}>{anomalies?.flaggedEvents || 0}</div></div>
          <div style={card}><div style={muted}>Điểm nghi vấn TB</div><div style={value}>{anomalies?.averageSuspicionScore || 0}</div></div>
          <div style={card}><div style={muted}>Thiết bị bị khóa</div><div style={{ ...value, color: '#b91c1c' }}>{anomalies?.quarantinedDevices || 0}</div></div>
        </div>
      </section>

      <section className="security-section">
        <SectionHeader
          title="Cách kiểm tra cảnh báo"
          subtitle="Dùng phần này để đọc màu đỏ/vàng trước khi khóa hoặc mở khóa thiết bị."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={{ ...card, borderColor: 'rgba(239,68,68,0.18)', background: 'rgba(254,242,242,0.55)' }}>
            <div style={{ color: '#dc2626', fontWeight: 900, fontSize: 14 }}>Đỏ là gì?</div>
            <p style={{ margin: '8px 0 0', color: '#475569', fontSize: 13, lineHeight: 1.5 }}>
              Điểm nghi vấn từ {highThreshold} trở lên. Event này đã bị loại khỏi điểm, và nhiều event đỏ trong thời gian ngắn sẽ tự khóa thiết bị.
            </p>
          </div>
          <div style={{ ...card, borderColor: 'rgba(245,158,11,0.22)', background: 'rgba(255,251,235,0.65)' }}>
            <div style={{ color: '#b45309', fontWeight: 900, fontSize: 14 }}>Vàng là gì?</div>
            <p style={{ margin: '8px 0 0', color: '#475569', fontSize: 13, lineHeight: 1.5 }}>
              Có dấu hiệu lệch chuẩn nhưng chưa đủ mạnh để loại điểm. Nếu lặp lại nhiều lần trên cùng user/device thì mới cần xử lý.
            </p>
          </div>
          <div style={{ ...card, borderColor: 'rgba(37,99,235,0.16)', background: 'rgba(37,99,235,0.05)' }}>
            <div style={{ color: '#2563eb', fontWeight: 900, fontSize: 14 }}>Admin nên check gì?</div>
            <p style={{ margin: '8px 0 0', color: '#475569', fontSize: 13, lineHeight: 1.5 }}>
              Xem user, thiết bị, thời gian, dấu hiệu chính và số gõ/click. Với lỗi chữ ký/sequence/session thì ưu tiên cài lại hoặc pair lại app.
            </p>
          </div>
        </div>
      </section>

      <div className="security-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 14, alignItems: 'start' }}>
        <div style={card}>
          <SectionHeader title="Dấu hiệu" subtitle="Nhóm lỗi được phát hiện nhiều nhất." />
          <FlagList flags={anomalies?.flagCounts} />
        </div>

        <div style={card}>
          <SectionHeader title="Thiết bị" subtitle="Khóa hoặc mở lại các tracker đã pair." />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px' }}>Thiết bị</th>
                  <th style={{ padding: '10px 8px' }}>Người dùng</th>
                  <th style={{ padding: '10px 8px' }}>Đồng bộ cuối</th>
                  <th style={{ padding: '10px 8px' }}>Trạng thái</th>
                  <th style={{ padding: '10px 8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.id} style={{ borderTop: '1px solid rgba(15,23,42,0.06)' }}>
                    <td style={{ padding: '10px 8px', color: '#1e293b' }}>{device.deviceName}<div style={{ color: '#6b7280', fontSize: 11 }}>{device.deviceUuid}</div></td>
                    <td style={{ padding: '10px 8px', color: '#334155' }}>{device.User?.email || '—'}</td>
                    <td style={{ padding: '10px 8px', color: '#94a3b8' }}>{device.lastSyncAt ? new Date(device.lastSyncAt).toLocaleString() : '—'}</td>
                    <td style={{ padding: '10px 8px' }}><span style={{ color: device.revokedAt ? '#ef4444' : '#22c55e', fontWeight: 800 }}>{device.revokedAt ? 'Đã khóa' : 'Đang hoạt động'}</span></td>
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

      <section className="security-section">
        <SectionHeader
          title="Event nghi vấn"
          subtitle={`Tối đa 50 event có điểm nghi vấn lớn hơn 0. Đỏ: ${redEvents.length}, vàng: ${yellowEvents.length}.`}
          action={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <SegmentedControl
              ariaLabel="Lọc mức độ cảnh báo"
              options={EVENT_FILTERS}
              value={eventFilter}
              onChange={setEventFilter}
            />
            <button
              type="button"
              onClick={load}
              style={{ border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}
            >
              Làm mới
            </button>
          </div>
          )}
        />
        {filteredEvents.length === 0 ? (
          <EmptyState title="Chưa có event nghi vấn" description="Khoảng thời gian này chưa phát hiện dữ liệu bất thường cần kiểm tra." />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {filteredEvents.map((event) => {
              const severity = eventSeverity(event, highThreshold);
              const meta = severityMeta(severity);
              const mainFlag = primaryFlag(event);
              const [reason, nextStep] = flagGuide(mainFlag);
              return (
                <article
                  key={event.id}
                  style={{
                    border: `1px solid ${meta.border}`,
                    background: severity === 'red' ? 'rgba(254,242,242,0.55)' : 'rgba(255,251,235,0.55)',
                    borderRadius: 8,
                    padding: 14,
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(220px, 1.4fr) minmax(210px, 1.2fr)', gap: 14, alignItems: 'start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          height: 24,
                          padding: '0 8px',
                          borderRadius: 999,
                          background: meta.bg,
                          color: meta.color,
                          fontSize: 11,
                          fontWeight: 900,
                        }}>
                          {meta.label} · {event.suspicionScore}
                        </span>
                        <span style={{ color: meta.color, fontSize: 12, fontWeight: 900 }}>{meta.text}</span>
                      </div>
                      <div style={{ color: '#0f172a', fontWeight: 900, fontSize: 13 }}>{event.user?.name || '—'}</div>
                      <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{event.user?.email || '—'}</div>
                      <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>{formatDateTime(event.eventTime)}</div>
                    </div>

                    <div>
                      <div style={{ color: '#0f172a', fontWeight: 900, fontSize: 13 }}>{flagLabel(mainFlag)}</div>
                      <p style={{ margin: '6px 0 0', color: '#475569', fontSize: 12, lineHeight: 1.45, fontWeight: 600 }}>{reason}</p>
                      <div style={{ marginTop: 9, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(event.flags || []).map((flag) => (
                          <span key={flag} title={flag} style={{
                            padding: '4px 7px',
                            borderRadius: 999,
                            background: '#ffffff',
                            border: '1px solid rgba(15,23,42,0.08)',
                            color: '#64748b',
                            fontSize: 11,
                            fontWeight: 750,
                          }}>
                            {flagLabel(flag)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: '#0f172a', fontWeight: 900, fontSize: 13 }}>Admin cần check</div>
                      <p style={{ margin: '6px 0 0', color: '#475569', fontSize: 12, lineHeight: 1.45, fontWeight: 600 }}>{nextStep}</p>
                      <div style={{
                        marginTop: 10,
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: 8,
                        color: '#334155',
                        fontSize: 12,
                      }}>
                        <div><b>{Number(event.totals?.keystrokeCount || 0).toLocaleString()}</b><span style={{ display: 'block', color: '#94a3b8' }}>Gõ</span></div>
                        <div><b>{Number(event.totals?.mouseClickCount || 0).toLocaleString()}</b><span style={{ display: 'block', color: '#94a3b8' }}>Click</span></div>
                        <div><b>#{event.sequence || '—'}</b><span style={{ display: 'block', color: '#94a3b8' }}>Seq</span></div>
                      </div>
                      <div style={{ color: '#64748b', fontSize: 11, marginTop: 9 }}>
                        {event.device?.deviceName || '—'} · {event.device?.platform || '—'} {event.device?.appVersion || ''}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
