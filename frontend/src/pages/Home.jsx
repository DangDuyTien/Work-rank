import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  Gauge,
  Monitor,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const installTabs = ['web', 'desktop', 'team', 'rank'];

const featureItems = [
  { label: 'Realtime', text: 'Theo dõi phím, click và thời gian hoạt động theo từng phiên.', icon: Gauge },
  { label: 'Leaderboard', text: 'Bảng xếp hạng theo ngày, tuần, tháng cho cá nhân và nhóm.', icon: Trophy },
  { label: 'Desktop', text: 'Tracker chạy trên máy người dùng, dữ liệu rõ nguồn và trạng thái.', icon: Monitor },
  { label: 'Security', text: 'Cảnh báo bất thường, khóa thiết bị và kiểm tra chống gian lận.', icon: ShieldCheck },
];

const statRows = [
  ['active', '08 người đang online'],
  ['score', '4,314 điểm cao nhất hôm nay'],
  ['sync', '2.5s chu kỳ cập nhật'],
];

function firstName(user) {
  const name = String(user?.name || user?.email || '').trim();
  if (!name) return 'bạn';
  return name.split(/\s+/).slice(-1)[0];
}

export default function Home() {
  const { user, loading } = useAuth();
  const isSignedIn = Boolean(user);
  const primaryTo = isSignedIn ? '/dashboard' : '/login';
  const primaryLabel = loading ? 'Đang kiểm tra...' : (isSignedIn ? 'Open dashboard' : 'Login');

  return (
    <main className="home-page">
      <header className="home-nav">
        <Link to="/" className="home-wordmark" aria-label="WorkRank">
          workrank
        </Link>
        <nav className="home-nav-menu" aria-label="WorkRank home navigation">
          <Link to="/leaderboard">Rank</Link>
          <Link to="/tracker">Tracker</Link>
          <Link to="/groups">Groups</Link>
          <Link to={isSignedIn ? '/settings' : '/login'}>Account</Link>
        </nav>
        <Link className="home-download-button" to={primaryTo}>
          {isSignedIn ? firstName(user) : (
            <>
              <Download size={15} strokeWidth={2.6} />
              Start
            </>
          )}
        </Link>
      </header>

      <section className="home-hero">
        <div className="home-hero-content">
          <div className="home-announcement">
            <span>New</span>
            <p>Desktop tracker available for Windows, macOS, and Linux.</p>
            <Link to="/tracker">Mở tracker</Link>
          </div>

          <h1>The realtime productivity ranking workspace</h1>
          <p className="home-lead">
            WorkRank gom dashboard, tracker, bảng xếp hạng và nhóm vào một giao diện gọn.
            Dùng cho team muốn thấy nhịp làm việc mà không cần báo cáo thủ công.
          </p>

          <div className="home-install-card" aria-label="WorkRank quick start">
            <div className="home-install-tabs">
              {installTabs.map((tab, index) => (
                <button key={tab} type="button" className={index === 0 ? 'is-active' : ''}>
                  {tab}
                </button>
              ))}
            </div>
            <div className="home-command-row">
              <code>open workrank.app/dashboard</code>
              <Link to={primaryTo} className={loading ? 'is-disabled' : ''} onClick={(event) => loading && event.preventDefault()}>
                {primaryLabel}
                <ArrowRight size={15} strokeWidth={2.7} />
              </Link>
              <button type="button" aria-label="Copy command">
                <Copy size={15} strokeWidth={2.3} />
              </button>
            </div>
          </div>

          <div className="home-quick-actions">
            <Link className="home-primary-action" to={primaryTo}>
              {isSignedIn ? 'Vào app' : 'Đăng nhập'}
              <ArrowRight size={16} strokeWidth={2.7} />
            </Link>
            <Link className="home-secondary-action" to="/leaderboard">Xem xếp hạng</Link>
          </div>
        </div>
      </section>

      <section className="home-product-strip" aria-label="WorkRank product preview">
        <div className="home-strip-copy">
          <span>Live view</span>
          <h2>Không cần trang trí nặng. Mở ra là biết app làm gì.</h2>
        </div>
        <div className="home-mini-terminal">
          <div className="home-mini-head">
            <strong>rank.today</strong>
            <CheckCircle2 size={17} strokeWidth={2.5} />
          </div>
          <div className="home-mini-bars">
            <span style={{ width: '92%' }} />
            <span style={{ width: '78%' }} />
            <span style={{ width: '64%' }} />
          </div>
          <div className="home-mini-rows">
            {statRows.map(([key, text]) => (
              <div key={key}>
                <span>{key}</span>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-feature-band">
        <div className="home-feature-grid">
          {featureItems.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="home-feature-item">
                <Icon size={18} strokeWidth={2.5} />
                <h3>{item.label}</h3>
                <p>{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
