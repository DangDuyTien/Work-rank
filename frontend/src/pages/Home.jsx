import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  Download,
  Flame,
  MousePointerClick,
  ShieldCheck,
  TimerReset,
  Trophy,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const metrics = [
  { value: '2.5s', label: 'chu kỳ đồng bộ' },
  { value: '99.9%', label: 'uptime dashboard' },
  { value: '30d', label: 'raw event retention' },
];

const features = [
  {
    icon: Activity,
    title: 'Realtime tracker',
    text: 'Theo dõi nhịp làm việc theo phiên, trạng thái online và tổng thao tác trong ngày.',
  },
  {
    icon: Trophy,
    title: 'Leaderboard nhanh',
    text: 'Xếp hạng theo ngày, tuần, tháng với phân trang backend và query đã tối ưu.',
  },
  {
    icon: ShieldCheck,
    title: 'Chống gian lận',
    text: 'Chấm điểm nghi vấn, khóa thiết bị bất thường và lưu dấu vết để admin kiểm tra.',
  },
  {
    icon: TimerReset,
    title: 'Pomodoro liền mạch',
    text: 'Đồng hồ tập trung gắn với tracker để giữ nhịp làm việc mà không cần tab phụ.',
  },
];

const leaderboardRows = [
  { rank: 1, name: 'Đặng Duy Tiến', score: '4,314', badge: 'Dev' },
  { rank: 2, name: 'Minh Anh', score: '3,280', badge: 'Top ngày' },
  { rank: 3, name: 'Quang Huy', score: '2,926', badge: 'Nhóm A' },
];

const timeline = [
  { time: '09:00', value: 62 },
  { time: '10:00', value: 84 },
  { time: '11:00', value: 52 },
  { time: '13:00', value: 91 },
  { time: '14:00', value: 74 },
  { time: '15:00', value: 88 },
];

function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-wr-reveal]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function firstName(user) {
  const name = String(user?.name || user?.email || '').trim();
  if (!name) return 'bạn';
  return name.split(/\s+/).slice(-1)[0];
}

export default function Home() {
  const { user } = useAuth();
  const isSignedIn = Boolean(user);
  const primaryTo = isSignedIn ? '/dashboard' : '/login';
  const [activeTerminal, setActiveTerminal] = useState('curl');

  useScrollReveal();

  return (
    <main className="wr-home-page">
      <header className="wr-home-nav">
        <Link to="/" className="wr-home-brand" aria-label="WorkRank">
          <span>W</span>
          <strong>WorkRank</strong>
        </Link>
        <nav className="wr-home-links" aria-label="Điều hướng trang chủ">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/leaderboard">Xếp hạng</Link>
          <Link to="/pomodoro">Pomodoro</Link>
          <Link to="/tracker">Tracker</Link>
          <Link to="/groups">Nhóm</Link>
        </nav>
        <Link className="wr-home-nav-action" to={primaryTo}>
          {isSignedIn ? firstName(user) : 'Vào app'}
          <ChevronRight size={16} strokeWidth={2.4} />
        </Link>
      </header>

      <section className="wr-home-hero">
        <div className="wr-hero-visual" aria-hidden="true">
          <div className="wr-preview-shell">
            <div className="wr-preview-topbar">
              <div className="wr-preview-brand">
                <span></span>
                WorkRank Live
              </div>
              <div className="wr-preview-status">
                <span></span>
                realtime
              </div>
            </div>
            <div className="wr-preview-grid">
              <div className="wr-preview-panel wr-preview-panel-main">
                <div className="wr-panel-head">
                  <span>Hoạt động hôm nay</span>
                  <strong>4,314</strong>
                </div>
                <div className="wr-activity-chart">
                  {timeline.map((item) => (
                    <span key={item.time} style={{ height: `${item.value}%` }}></span>
                  ))}
                </div>
                <div className="wr-chart-labels">
                  {timeline.map((item) => <span key={item.time}>{item.time}</span>)}
                </div>
              </div>

              <div className="wr-preview-panel wr-preview-rank">
                <div className="wr-panel-head">
                  <span>Top ngày</span>
                  <Trophy size={17} />
                </div>
                {leaderboardRows.map((row) => (
                  <div className="wr-rank-row" key={row.rank}>
                    <b>{row.rank}</b>
                    <div>
                      <strong>{row.name}</strong>
                      <span>{row.badge}</span>
                    </div>
                    <em>{row.score}</em>
                  </div>
                ))}
              </div>

              <div className="wr-preview-panel wr-preview-tiles">
                <div className="wr-mini-tile">
                  <MousePointerClick size={16} />
                  <strong>926</strong>
                  <span>click</span>
                </div>
                <div className="wr-mini-tile">
                  <Code2 size={16} />
                  <strong>3.2k</strong>
                  <span>phím</span>
                </div>
                <div className="wr-mini-tile">
                  <Clock3 size={16} />
                  <strong>6h 12m</strong>
                  <span>active</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="wr-home-hero-content">
          <div className="wr-home-pill" data-wr-reveal>
            <span>New</span>
            Desktop tracker cho Windows, macOS và Linux
          </div>
          <h1 data-wr-reveal>
            WorkRank
            <span> realtime workspace tracker</span>
          </h1>
          <p data-wr-reveal>
            Dashboard gọn cho team muốn xem nhịp làm việc, xếp hạng, Pomodoro và trạng thái tracker trong một nơi.
            Không cần báo cáo thủ công, không kéo dữ liệu nặng lên trình duyệt.
          </p>
          <div className="wr-home-actions" data-wr-reveal>
            <Link className="wr-home-primary" to={primaryTo}>
              {isSignedIn ? 'Vào Dashboard' : 'Đăng nhập để bắt đầu'}
              <ArrowRight size={17} strokeWidth={2.5} />
            </Link>
            <Link className="wr-home-secondary" to="/leaderboard">
              <Trophy size={16} />
              Xem xếp hạng
            </Link>
            <Link className="wr-home-secondary" to="/tracker">
              <Download size={16} />
              Tải tracker
            </Link>
          </div>
        </div>
      </section>

      <section className="wr-home-metrics" data-wr-reveal>
        {metrics.map((metric) => (
          <div className="wr-metric" key={metric.label}>
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
          </div>
        ))}
      </section>

      <section className="wr-home-section wr-home-product" data-wr-reveal>
        <div className="wr-section-copy">
          <span className="wr-section-kicker">Product</span>
          <h2>Từ tracker đến leaderboard trong một luồng rõ ràng.</h2>
          <p>
            Dữ liệu được gom theo phút/ngày, cache ngắn hạn và phân trang ở backend. Giao diện chỉ lấy phần cần hiển thị nên mở trang nhanh hơn khi user tăng.
          </p>
        </div>
        <div className="wr-command-card">
          <div className="wr-command-tabs">
            {['curl', 'npm', 'desktop'].map((tab) => (
              <button
                type="button"
                key={tab}
                className={activeTerminal === tab ? 'is-active' : ''}
                onClick={() => setActiveTerminal(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="wr-command-line">
            <span>$</span>
            {activeTerminal === 'curl' && 'curl -s https://workrank.local/api/status'}
            {activeTerminal === 'npm' && 'npm run dev --workspace workrank-realtime'}
            {activeTerminal === 'desktop' && 'workrank://open?tracker=desktop'}
          </div>
          <div className="wr-command-output">
            <CheckCircle2 size={16} />
            online users cached · leaderboard paginated · socket batched
          </div>
        </div>
      </section>

      <section className="wr-home-section wr-feature-section" data-wr-reveal>
        <div className="wr-section-head">
          <span className="wr-section-kicker">Workspace</span>
          <h2>Đủ công cụ cho team vận hành hằng ngày.</h2>
        </div>
        <div className="wr-feature-grid">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article className="wr-feature-card" key={feature.title}>
                <div className="wr-feature-icon"><Icon size={20} strokeWidth={2.4} /></div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="wr-home-section wr-workflow-section" data-wr-reveal>
        <div className="wr-workflow-copy">
          <span className="wr-section-kicker">Flow</span>
          <h2>Một màn hình đủ để biết team đang chạy ra sao.</h2>
        </div>
        <div className="wr-workflow-list">
          <div>
            <span><Activity size={17} /></span>
            <strong>Tracker ghi nhận</strong>
            <p>Desktop app gửi batch hoạt động thay vì đẩy từng event rời rạc.</p>
          </div>
          <div>
            <span><BarChart3 size={17} /></span>
            <strong>Backend tổng hợp</strong>
            <p>Summary theo phút/ngày, cache dashboard và rank để giảm tải DB.</p>
          </div>
          <div>
            <span><Users size={17} /></span>
            <strong>Team theo dõi</strong>
            <p>Dashboard, nhóm và leaderboard lấy dữ liệu phân trang đã tối ưu.</p>
          </div>
        </div>
      </section>

      <section className="wr-home-final" data-wr-reveal>
        <div>
          <span><Flame size={18} /></span>
          <h2>Bắt đầu theo dõi năng suất ngay hôm nay.</h2>
          <p>Vào dashboard nếu bạn đã đăng nhập, hoặc mở tracker để đồng bộ phiên làm việc đầu tiên.</p>
        </div>
        <Link className="wr-home-primary" to={primaryTo}>
          {isSignedIn ? 'Mở dashboard' : 'Đăng nhập'}
          <ArrowRight size={17} strokeWidth={2.5} />
        </Link>
      </section>

      <footer className="wr-home-footer">
        <div className="wr-home-brand">
          <span>W</span>
          <strong>WorkRank</strong>
        </div>
        <div>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/leaderboard">Xếp hạng</Link>
          <Link to="/pomodoro">Pomodoro</Link>
          <a href="https://www.facebook.com/ddyn.fz/" target="_blank" rel="noopener noreferrer">Liên hệ</a>
        </div>
        <small>2026 · realtime workspace tracker</small>
      </footer>
    </main>
  );
}
