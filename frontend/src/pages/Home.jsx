import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Gauge,
  LockKeyhole,
  Monitor,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { useAuth } from '../context/AuthContext';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=82';

const metrics = [
  { label: 'Chu kỳ cập nhật', value: '2.5s' },
  { label: 'Tín hiệu theo dõi', value: 'Realtime' },
  { label: 'Không gian đội nhóm', value: 'Groups' },
];

const featureItems = [
  {
    title: 'Bảng điều khiển gọn',
    desc: 'Theo dõi thao tác, thời gian hoạt động và điểm hiệu suất trong một màn hình dễ quét.',
    icon: Gauge,
  },
  {
    title: 'Xếp hạng có nhịp',
    desc: 'Leaderboards theo ngày, tuần, tháng giúp đội nhìn thấy tiến độ mà không cần hỏi thủ công.',
    icon: Trophy,
  },
  {
    title: 'Tracker desktop',
    desc: 'Dữ liệu đi từ desktop tracker, kèm trạng thái thiết bị và phiên làm việc rõ ràng.',
    icon: Monitor,
  },
  {
    title: 'Kiểm soát bất thường',
    desc: 'Các cảnh báo bảo mật và anti-cheat giúp điểm số sạch hơn khi dùng trong nhóm đông.',
    icon: ShieldCheck,
  },
];

const previewRows = [
  { name: 'Đặng Duy Tiến', score: '4,314', tone: 'blue' },
  { name: 'Nguyễn Minh Anh', score: '3,820', tone: 'green' },
  { name: 'Trần Quốc Bảo', score: '2,970', tone: 'amber' },
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
  const secondaryTo = isSignedIn ? '/leaderboard' : '/login';
  const primaryLabel = loading ? 'Đang kiểm tra...' : (isSignedIn ? 'Vào bảng điều khiển' : 'Đăng nhập');

  return (
    <main className="home-page">
      <nav className="home-nav" aria-label="Trang chủ WorkRank">
        <Link to="/" className="home-brand-link" aria-label="WorkRank">
          <BrandMark size={36} showLabel label="WorkRank" labelStyle={{ fontSize: 18, color: '#ffffff' }} />
        </Link>
        <div className="home-nav-actions">
          {isSignedIn && <span className="home-user-chip">Xin chào, {firstName(user)}</span>}
          <Link className="home-nav-link" to={isSignedIn ? '/dashboard' : '/login'}>
            {isSignedIn ? 'Dashboard' : 'Đăng nhập'}
          </Link>
        </div>
      </nav>

      <section className="home-hero" style={{ backgroundImage: `url(${HERO_IMAGE})` }}>
        <div className="home-hero-shade" aria-hidden="true" />
        <div className="home-hero-content">
          <span className="home-kicker">
            <Activity size={14} strokeWidth={2.6} />
            Hệ thống hiệu suất thời gian thực
          </span>
          <h1>WorkRank Realtime</h1>
          <p>
            Trang chủ mới để bước vào WorkRank gọn gàng hơn: nhìn được tinh thần sản phẩm trước,
            rồi mới vào dashboard, xếp hạng, nhóm hoặc tracker.
          </p>
          <div className="home-hero-actions">
            <Link
              className={`home-primary-action${loading ? ' is-disabled' : ''}`}
              to={loading ? '/' : primaryTo}
              onClick={(event) => {
                if (loading) event.preventDefault();
              }}
            >
              {primaryLabel}
              <ArrowRight size={17} strokeWidth={2.7} />
            </Link>
            <Link className="home-secondary-action" to={secondaryTo}>
              {isSignedIn ? 'Xem xếp hạng' : 'Tạo tài khoản'}
            </Link>
          </div>
          <div className="home-metrics" aria-label="Thông số WorkRank">
            {metrics.map((item) => (
              <div key={item.label} className="home-metric">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-overview-band">
        <div className="home-overview-inner">
          <div className="home-section-copy">
            <span>Không gian làm việc</span>
            <h2>Vào app có nhịp hơn, không bị ném thẳng vào bảng số liệu.</h2>
            <p>
              Trang chủ đóng vai trò điểm dừng đầu tiên: có nhận diện, có lựa chọn rõ ràng,
              và vẫn đưa người đã đăng nhập vào công việc chỉ bằng một nút.
            </p>
          </div>

          <div className="home-preview" aria-label="Minh họa bảng xếp hạng WorkRank">
            <div className="home-preview-head">
              <div>
                <span>Live rank</span>
                <strong>Đội sản phẩm</strong>
              </div>
              <CheckCircle2 size={18} strokeWidth={2.6} />
            </div>
            <div className="home-preview-chart">
              <span style={{ height: '42%' }} />
              <span style={{ height: '76%' }} />
              <span style={{ height: '58%' }} />
              <span style={{ height: '88%' }} />
              <span style={{ height: '64%' }} />
              <span style={{ height: '92%' }} />
            </div>
            <div className="home-preview-list">
              {previewRows.map((row, index) => (
                <div key={row.name} className="home-preview-row">
                  <span className={`home-preview-rank is-${row.tone}`}>{index + 1}</span>
                  <span>{row.name}</span>
                  <strong>{row.score}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="home-feature-band">
        <div className="home-feature-grid">
          {featureItems.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="home-feature-item">
                <div className="home-feature-icon">
                  <Icon size={19} strokeWidth={2.5} />
                </div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="home-final-band">
        <div className="home-final-inner">
          <div>
            <span className="home-final-kicker">
              <Clock3 size={15} strokeWidth={2.5} />
              Sẵn sàng làm việc
            </span>
            <h2>{isSignedIn ? 'Phiên của bạn vẫn đang sẵn sàng.' : 'Đăng nhập để vào workspace của bạn.'}</h2>
          </div>
          <div className="home-final-actions">
            <Link className="home-final-primary" to={primaryTo}>
              {isSignedIn ? 'Mở dashboard' : 'Đăng nhập ngay'}
              <ArrowRight size={16} strokeWidth={2.7} />
            </Link>
            <span>
              <LockKeyhole size={13} strokeWidth={2.4} />
              Kết nối bảo mật
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
