import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  UserRound,
  Wifi,
} from 'lucide-react';
import { security } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UiContext';
import { EmptyState, PageState, SegmentedControl } from '../components/ui';

const DAY_FILTERS = [
  { key: 1, label: '24h' },
  { key: 7, label: '7 ngày' },
  { key: 30, label: '30 ngày' },
];

const EVENT_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'red', label: 'Đỏ' },
  { key: 'yellow', label: 'Vàng' },
];

const FLAG_LABELS = {
  untrusted_signature: 'Không xác thực được app',
  missing_signature: 'Thiếu chữ ký bảo mật',
  missing_device_secret: 'Thiếu mã thiết bị',
  invalid_device_secret: 'Sai mã thiết bị',
  invalid_signature: 'Chữ ký bị sai',
  missing_sequence: 'Thiếu số thứ tự',
  replayed_or_old_sequence: 'Gửi lại dữ liệu cũ',
  large_sequence_gap: 'Sequence nhảy xa',
  missing_session: 'Thiếu phiên làm việc',
  event_time_out_of_order: 'Thời gian bị lệch thứ tự',
  high_click_rate: 'Click quá nhanh',
  high_key_rate: 'Gõ phím quá nhanh',
  high_combined_action_rate: 'Thao tác tổng quá nhanh',
  too_many_actions_in_event: 'Quá nhiều thao tác/gói',
  active_window_too_large: 'Active quá dài',
  idle_window_too_large: 'Idle quá dài',
  input_without_active_time: 'Có input nhưng không active',
  high_mouse_move_rate: 'Chuột di chuyển quá nhanh',
  clicks_without_mouse_movement: 'Click không có di chuột',
  click_only_event: 'Chỉ có click',
  active_without_input: 'Active nhưng không input',
  robotic_repeated_click_pattern: 'Click lặp như bot',
  repeated_click_pattern_streak: 'Mẫu click lặp liên tục',
  click_only_streak: 'Chuỗi click đơn lặp lại',
  baseline_click_rate_spike: 'Click tăng đột biến',
  baseline_key_rate_spike: 'Gõ tăng đột biến',
  clock_skew: 'Giờ máy bị lệch',
};

const FLAG_GUIDES = {
  untrusted_signature: ['Dữ liệu không chứng minh được là từ Desktop Tracker đã pair.', 'Yêu cầu user mở lại app. Nếu lặp lại, bắt pair/cài lại app chính thức.'],
  missing_signature: ['Gói dữ liệu thiếu chữ ký bảo mật.', 'Yêu cầu cập nhật hoặc cài lại Desktop Tracker bản chính thức.'],
  missing_device_secret: ['Gói gửi lên thiếu mã bí mật thiết bị.', 'Pair lại thiết bị hoặc đăng nhập lại Desktop Tracker.'],
  invalid_device_secret: ['Mã thiết bị không khớp với server.', 'Nếu lặp lại, giữ khóa thiết bị rồi pair lại từ app chính thức.'],
  invalid_signature: ['Nội dung gói dữ liệu không khớp chữ ký.', 'Xem là rủi ro cao; kiểm tra app có bị sửa hoặc gửi giả lập không.'],
  missing_sequence: ['Gói dữ liệu thiếu số thứ tự chống replay.', 'Yêu cầu cập nhật hoặc cài lại Desktop Tracker.'],
  replayed_or_old_sequence: ['Dữ liệu cũ bị gửi lại.', 'Không cộng điểm; nếu lặp lại thì khóa device và pair lại.'],
  large_sequence_gap: ['Sequence nhảy xa bất thường.', 'Hỏi user có reset app, đổi máy hoặc dùng bản app khác không.'],
  missing_session: ['Event không gắn với phiên làm việc đang chạy.', 'Kiểm tra app có Start session đúng không, rồi mở lại Desktop Tracker.'],
  event_time_out_of_order: ['Thời gian event đi lùi.', 'Kiểm tra giờ hệ thống và việc mở nhiều bản app cùng lúc.'],
  clock_skew: ['Giờ trên máy lệch nhiều so với server.', 'Yêu cầu bật đồng bộ giờ tự động trên Windows/macOS.'],
  high_click_rate: ['Số click/giây vượt ngưỡng bình thường.', 'Hỏi có dùng auto click, macro chuột, tool test hoặc script không.'],
  high_key_rate: ['Số phím/giây vượt ngưỡng bình thường.', 'Kiểm tra macro bàn phím, paste/script hoặc tool auto type.'],
  high_combined_action_rate: ['Tổng click và phím/giây quá cao.', 'So với công việc thực tế; nếu không hợp lý thì không mở khóa vội.'],
  too_many_actions_in_event: ['Một gói chứa quá nhiều thao tác.', 'Kiểm tra app bị treo dồn dữ liệu hoặc có automation.'],
  active_window_too_large: ['Khoảng active dài hơn app chuẩn.', 'Yêu cầu cập nhật/cài lại app vì app chuẩn gửi event ngắn đều.'],
  idle_window_too_large: ['Khoảng idle quá dài trong một event.', 'Thường do app treo/mất mạng; kiểm tra kết nối và phiên bản app.'],
  input_without_active_time: ['Có click/phím nhưng không có active time.', 'Nếu lặp lại thì khóa/pair lại device.'],
  active_without_input: ['Có active time nhưng không có click/phím.', 'Có thể là ngồi đọc; nếu ít thì chỉ theo dõi.'],
  robotic_repeated_click_pattern: ['Mẫu click lặp đều giống bot.', 'Hỏi user về auto click/macro và kiểm tra nhiều event cùng kiểu.'],
  repeated_click_pattern_streak: ['Mẫu click giống nhau lặp nhiều lần.', 'Nếu user không giải thích được, giữ khóa thiết bị và pair lại.'],
  click_only_streak: ['Nhiều event chỉ có click nối tiếp.', 'Kiểm tra auto click hoặc thao tác lặp không tự nhiên.'],
  baseline_click_rate_spike: ['Click tăng mạnh so với thói quen trước đó.', 'So với loại việc hôm đó; có thể hợp lệ nếu đổi task đặc thù.'],
  baseline_key_rate_spike: ['Gõ phím tăng mạnh so với thói quen trước đó.', 'Kiểm tra task nhập liệu đặc biệt hoặc automation/paste/script.'],
};

function flagLabel(flag) {
  return FLAG_LABELS[flag] || flag || 'Dấu hiệu chưa rõ';
}

function flagGuide(flag) {
  return FLAG_GUIDES[flag] || ['Rule kỹ thuật phát hiện dữ liệu lệch chuẩn.', 'So sánh user, thiết bị, thời gian và hỏi lại người dùng nếu lặp lại.'];
}

function eventSeverity(event, threshold = 60) {
  return Number(event.suspicionScore || 0) >= threshold ? 'red' : 'yellow';
}

function severityMeta(severity) {
  if (severity === 'red') {
    return {
      label: 'Đỏ',
      tone: 'red',
      icon: ShieldAlert,
      title: 'Không cộng điểm',
      description: 'Cần kiểm tra trước khi mở khóa thiết bị.',
    };
  }
  return {
    label: 'Vàng',
    tone: 'yellow',
    icon: AlertTriangle,
    title: 'Theo dõi',
    description: 'Chưa đủ mạnh để khóa, nhưng nếu lặp lại thì cần xử lý.',
  };
}

function primaryFlag(event) {
  return event.flags?.[0] || 'unknown';
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function formatNum(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function deviceLabel(device = {}) {
  return device.deviceName || device.deviceUuid || `Thiết bị #${device.id || '—'}`;
}

function userLabel(user = {}) {
  return user?.name || user?.email || 'Không rõ user';
}

function StepCard({ tone = 'neutral', icon: Icon, value, label, detail }) {
  return (
    <div className={`security-step-card is-${tone}`}>
      <div className="security-step-icon">{Icon && <Icon size={18} />}</div>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        {detail && <em>{detail}</em>}
      </div>
    </div>
  );
}

function DeviceCard({ device, busy, onToggle }) {
  const revoked = Boolean(device.revokedAt);
  const statusText = revoked ? 'Đang khóa' : 'Đang mở';
  const actionText = revoked ? 'Mở khóa' : 'Khóa';
  const ActionIcon = revoked ? Unlock : LockKeyhole;
  return (
    <article className={`security-device-card ${revoked ? 'is-locked' : 'is-open'}`}>
      <div className="security-device-main">
        <div className="security-device-icon">
          {revoked ? <LockKeyhole size={18} /> : <Wifi size={18} />}
        </div>
        <div className="security-device-copy">
          <div className="security-device-name">{deviceLabel(device)}</div>
          <div className="security-device-meta">
            <span>{device.User?.email || 'Không có email'}</span>
            <span>{device.platform || 'Không rõ nền tảng'}</span>
            <span>Sync {formatDateTime(device.lastSyncAt)}</span>
          </div>
        </div>
      </div>
      <div className="security-device-actions">
        <span className={`security-device-status ${revoked ? 'is-locked' : 'is-open'}`}>{statusText}</span>
        <button type="button" disabled={busy} onClick={() => onToggle(device)}>
          <ActionIcon size={14} />
          {actionText}
        </button>
      </div>
    </article>
  );
}

function EventCard({ event, threshold, expanded, onToggle }) {
  const severity = eventSeverity(event, threshold);
  const meta = severityMeta(severity);
  const Icon = meta.icon;
  const mainFlag = primaryFlag(event);
  const [reason, nextStep] = flagGuide(mainFlag);
  return (
    <article className={`security-event-card is-${meta.tone}`}>
      <button type="button" className="security-event-summary" onClick={() => onToggle(event.id)}>
        <div className="security-event-score">
          <Icon size={18} />
          <strong>{event.suspicionScore}</strong>
          <span>{meta.label}</span>
        </div>
        <div className="security-event-main">
          <div className="security-event-title">{flagLabel(mainFlag)}</div>
          <div className="security-event-meta">
            <span><UserRound size={12} /> {userLabel(event.user)}</span>
            <span><Cpu size={12} /> {deviceLabel(event.device)}</span>
            <span>{formatDateTime(event.eventTime)}</span>
          </div>
        </div>
        <div className="security-event-action">
          <strong>{meta.title}</strong>
          <span>{expanded ? 'Thu gọn' : 'Xem cách xử lý'}</span>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {expanded && (
        <div className="security-event-detail">
          <div>
            <span className="security-detail-label">Vì sao bị cảnh báo</span>
            <p>{reason}</p>
          </div>
          <div>
            <span className="security-detail-label">Admin nên làm</span>
            <p>{nextStep}</p>
          </div>
          <div className="security-event-metrics">
            <div><strong>{formatNum(event.totals?.keystrokeCount)}</strong><span>Gõ phím</span></div>
            <div><strong>{formatNum(event.totals?.mouseClickCount)}</strong><span>Click</span></div>
            <div><strong>{event.sequence || '—'}</strong><span>Sequence</span></div>
          </div>
          <div className="security-flag-row">
            {(event.flags || []).map((flag) => <span key={flag}>{flagLabel(flag)}</span>)}
          </div>
        </div>
      )}
    </article>
  );
}

function FlagCloud({ flags = {} }) {
  const rows = Object.entries(flags).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!rows.length) return <EmptyState compact title="Chưa có dấu hiệu nổi bật" description="Các rule nghi vấn sẽ hiện ở đây khi có event bất thường." />;
  return (
    <div className="security-flag-cloud">
      {rows.map(([flag, count]) => (
        <div key={flag} className="security-flag-chip">
          <span>{flagLabel(flag)}</span>
          <strong>{formatNum(count)}</strong>
        </div>
      ))}
    </div>
  );
}

export default function Security() {
  const { socket } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [anomalies, setAnomalies] = useState(null);
  const [devices, setDevices] = useState([]);
  const [events, setEvents] = useState([]);
  const [days, setDays] = useState(1);
  const [eventFilter, setEventFilter] = useState('all');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [pendingDeviceId, setPendingDeviceId] = useState(null);
  const [expandedEventId, setExpandedEventId] = useState(null);
  const [quarantineAlert, setQuarantineAlert] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryRes, deviceRes, eventRes] = await Promise.all([
        security.anomalies(days),
        security.devices(true),
        security.events(days, 50),
      ]);
      setAnomalies(summaryRes.data);
      setDevices(deviceRes.data.data || []);
      setEvents(eventRes.data.data || []);
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
    const restoring = Boolean(device.revokedAt);
    setPendingDeviceId(device.id);
    try {
      if (restoring) await security.restoreDevice(device.id);
      else await security.revokeDevice(device.id);
      toast(restoring ? 'Đã mở khóa thiết bị.' : 'Đã khóa thiết bị.', { type: restoring ? 'success' : 'error' });
      await load();
    } catch (err) {
      toast(err.response?.data?.message || 'Không xử lý được thiết bị.', { type: 'error' });
    } finally {
      setPendingDeviceId(null);
    }
  };

  const highThreshold = Number(anomalies?.highSuspicionThreshold || 60);
  const lockedDevices = useMemo(() => devices.filter((device) => device.revokedAt), [devices]);
  const redEvents = useMemo(() => events.filter((event) => eventSeverity(event, highThreshold) === 'red'), [events, highThreshold]);
  const yellowEvents = useMemo(() => events.filter((event) => eventSeverity(event, highThreshold) === 'yellow'), [events, highThreshold]);
  const filteredEvents = useMemo(() => (
    events.filter((event) => eventFilter === 'all' || eventSeverity(event, highThreshold) === eventFilter)
  ), [eventFilter, events, highThreshold]);
  const filteredDevices = useMemo(() => {
    const q = deviceSearch.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter((device) => (
      deviceLabel(device).toLowerCase().includes(q)
      || String(device.deviceUuid || '').toLowerCase().includes(q)
      || String(device.User?.email || '').toLowerCase().includes(q)
      || String(device.platform || '').toLowerCase().includes(q)
    ));
  }, [deviceSearch, devices]);

  if (loading && !anomalies) return <PageState title="Đang tải trang bảo mật..." />;
  if (error && !anomalies) return <PageState type="error" title="Không tải được dữ liệu bảo mật" description={error} onRetry={load} />;

  const isClean = Number(anomalies?.flaggedEvents || 0) === 0 && lockedDevices.length === 0;
  const statusTone = isClean ? 'clean' : lockedDevices.length || redEvents.length ? 'danger' : 'warning';
  const statusTitle = isClean
    ? 'Ổn, chưa có việc khẩn cấp'
    : statusTone === 'danger'
      ? 'Có việc cần xử lý'
      : 'Có cảnh báo cần theo dõi';
  const statusDescription = isClean
    ? 'Không có event đỏ hoặc thiết bị bị khóa trong khoảng thời gian đang chọn.'
    : `${lockedDevices.length} thiết bị đang khóa, ${redEvents.length} event đỏ, ${yellowEvents.length} event vàng.`;

  return (
    <div className="security-page">
      <section className="security-hero">
        <div>
          <div className="security-kicker">
            <ShieldCheck size={15} />
            Bảo mật
          </div>
          <h1>Trung tâm chống gian lận</h1>
          <p>Ưu tiên xem event nghi vấn trước, rồi mới xử lý thiết bị nếu cần.</p>
        </div>
        <div className="security-hero-actions">
          <SegmentedControl ariaLabel="Khoảng thời gian bảo mật" options={DAY_FILTERS} value={days} onChange={setDays} />
          <button type="button" className="security-refresh" disabled={loading} onClick={load}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Làm mới
          </button>
        </div>
      </section>

      {loading && anomalies && <div className="security-loading-note">Đang làm mới dữ liệu...</div>}

      {quarantineAlert && (
        <section className="security-alert-banner">
          <ShieldAlert size={20} />
          <div>
            <strong>Thiết bị vừa bị khóa tự động</strong>
            <span>
              {quarantineAlert.deviceName || quarantineAlert.deviceUuid} của {quarantineAlert.email || quarantineAlert.name || 'người dùng'} có {quarantineAlert.flaggedEventsInWindow} event đỏ trong {quarantineAlert.windowMinutes} phút.
            </span>
          </div>
          <button type="button" onClick={() => setQuarantineAlert(null)}>Đã hiểu</button>
        </section>
      )}

      <section className={`security-status-panel is-${statusTone}`}>
        <div className="security-status-copy">
          <div className="security-status-icon">
            {isClean ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
          </div>
          <div>
            <h2>{statusTitle}</h2>
            <p>{statusDescription}</p>
            <span>Rule tự khóa: {anomalies?.quarantineThreshold || 0} event đỏ trong {anomalies?.quarantineWindowMinutes || 0} phút.</span>
          </div>
        </div>
        <div className="security-status-steps">
          <StepCard tone="neutral" icon={Activity} value={formatNum(anomalies?.totalEvents)} label="lượt dữ liệu" detail={`${days} ngày`} />
          <StepCard tone={redEvents.length ? 'danger' : 'clean'} icon={ShieldAlert} value={formatNum(redEvents.length)} label="event đỏ" detail="Không cộng điểm" />
          <StepCard tone={yellowEvents.length ? 'warning' : 'clean'} icon={AlertTriangle} value={formatNum(yellowEvents.length)} label="event vàng" detail="Theo dõi" />
          <StepCard tone={lockedDevices.length ? 'danger' : 'clean'} icon={LockKeyhole} value={formatNum(lockedDevices.length)} label="thiết bị khóa" detail={`${formatNum(devices.length)} tổng máy`} />
        </div>
      </section>

      <section className="security-panel security-event-panel">
        <div className="security-panel-head">
          <div>
            <h2>Event nghi vấn</h2>
            <p>Đỏ là không cộng điểm. Vàng là theo dõi. Bấm từng dòng để xem cách xử lý.</p>
          </div>
          <SegmentedControl ariaLabel="Lọc event nghi vấn" options={EVENT_FILTERS} value={eventFilter} onChange={setEventFilter} />
        </div>
        <div className="security-event-list">
          {filteredEvents.length === 0 ? (
            <EmptyState title="Chưa có event nghi vấn" description="Khoảng thời gian này chưa phát hiện dữ liệu bất thường cần kiểm tra." />
          ) : filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              threshold={highThreshold}
              expanded={expandedEventId === event.id}
              onToggle={(id) => setExpandedEventId((current) => (current === id ? null : id))}
            />
          ))}
        </div>
      </section>

      <section className="security-main-grid">
        <div className="security-panel">
          <div className="security-panel-head">
            <div>
              <h2>Thiết bị</h2>
              <p>Mở khóa khi đã xác minh hợp lệ. Khóa ngay nếu nghi ngờ app giả lập hoặc auto.</p>
            </div>
            <div className="security-search">
              <Search size={14} />
              <input value={deviceSearch} onChange={(event) => setDeviceSearch(event.target.value)} placeholder="Tìm email, máy..." />
            </div>
          </div>
          <div className="security-device-list">
            {filteredDevices.length === 0 ? (
              <EmptyState compact title={deviceSearch ? 'Không tìm thấy thiết bị' : 'Chưa có thiết bị'} description={deviceSearch ? 'Thử nhập email, tên máy hoặc nền tảng khác.' : 'Thiết bị sẽ hiện khi Desktop Tracker được pair.'} />
            ) : filteredDevices.map((device) => (
              <DeviceCard key={device.id} device={device} busy={pendingDeviceId === device.id} onToggle={toggleDevice} />
            ))}
          </div>
        </div>

        <div className="security-panel">
          <div className="security-panel-head">
            <div>
              <h2>Dấu hiệu nổi bật</h2>
              <p>Các nguyên nhân xuất hiện nhiều nhất trong khoảng thời gian đang chọn.</p>
            </div>
          </div>
          <FlagCloud flags={anomalies?.flagCounts} />
        </div>
      </section>
    </div>
  );
}
