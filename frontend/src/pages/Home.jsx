import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const featureItems = [
  { label: 'Realtime', text: 'Theo dõi phím, click và thời gian hoạt động theo từng phiên.' },
  { label: 'Leaderboard', text: 'Bảng xếp hạng theo ngày, tuần, tháng cho cá nhân và nhóm.' },
  { label: 'Pomodoro', text: 'Đồng hồ tập trung tích hợp, tự động bắt đầu tracker khi focus.' },
  { label: 'Desktop', text: 'Tracker chạy trên máy người dùng, dữ liệu rõ nguồn và trạng thái.' },
  { label: 'Security', text: 'Cảnh báo bất thường, khóa thiết bị và kiểm tra chống gian lận.' },
  { label: 'Nhóm', text: 'Tạo team, thi đấu năng suất và theo dõi tiến độ cùng đồng nghiệp.' },
];

const faqData = [
  { q: 'WorkRank hoạt động thế nào?', a: 'WorkRank ghi nhận số phím bấm, click chuột và thời gian hoạt động qua Desktop Tracker. Dữ liệu được đồng bộ realtime lên dashboard để bạn và team theo dõi năng suất.' },
  { q: 'Desktop Tracker có an toàn không?', a: 'Tracker chỉ ghi số lượng phím/click, không ghi nội dung. Dữ liệu được mã hóa và chỉ chủ sở hữu mới xem được chi tiết.' },
  { q: 'Làm sao để bắt đầu?', a: 'Tạo tài khoản, tải Desktop Tracker về máy, chạy ứng dụng và bắt đầu tracking. Không cần cấu hình phức tạp.' },
  { q: 'Có hỗ trợ làm việc nhóm không?', a: 'Có. Bạn có thể tạo nhóm, mời thành viên, thi đấu năng suất qua leaderboard và theo dõi tiến độ theo ngày/tuần/tháng.' },
];

function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.1 }
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
  const [openFAQ, setOpenFAQ] = useState(null);

  useScrollReveal();

  return (
    <main className="home-page">
      <header className="home-nav">
        <Link to="/" className="home-wordmark" aria-label="WorkRank">
          <span className="home-logo-block">W</span>
          orkRank
        </Link>
        <nav className="home-nav-menu" aria-label="WorkRank home navigation">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/leaderboard">Xếp hạng</Link>
          <Link to="/pomodoro">Pomodoro</Link>
          <Link to="/tracker">Tracker</Link>
          <Link to="/groups">Nhóm</Link>
        </nav>
        <Link className="home-download-button" to={primaryTo}>
          {isSignedIn ? firstName(user) : 'Bắt đầu'}
          <ChevronRight size={14} strokeWidth={2} />
        </Link>
      </header>

      <section className="home-hero">
        <div className="home-hero-content">
          <div className="home-announcement" data-reveal>
            <span>Mới</span>
            <p>Desktop tracker cho Windows, macOS và Linux.</p>
            <Link to="/tracker">Chi tiết <ChevronRight size={12} strokeWidth={2} /></Link>
          </div>

          <h1 className="home-hero-heading" data-reveal>
            <span className="home-hero-prompt">$</span>
            <span className="home-hero-title">WorkRank</span>
            <span className="home-heading-sub">realtime workspace tracker</span>
          </h1>

          <p className="home-lead" data-reveal>
            Dashboard, tracker, bảng xếp hạng và nhóm trong một giao diện gọn.
            Dùng cho team muốn thấy nhịp làm việc mà không cần báo cáo thủ công.
          </p>

          <div className="home-hero-actions" data-reveal>
            <Link className="home-primary-action" to={primaryTo}>
              {isSignedIn ? 'Vào app' : 'Đăng nhập'}
              <ChevronRight size={14} strokeWidth={2.5} />
            </Link>
            <Link className="home-secondary-action" to="/leaderboard">Xem xếp hạng</Link>
            <Link className="home-secondary-action" to="/pomodoro">Pomodoro</Link>
          </div>
        </div>
      </section>

      <section className="home-terminal" data-reveal>
        <div className="home-term-window">
          <div className="home-term-bar">
            <div className="home-term-dots">
              <span className="home-term-dot home-term-red"></span>
              <span className="home-term-dot home-term-yellow"></span>
              <span className="home-term-dot home-term-green"></span>
            </div>
            <span className="home-term-title">workrank@local — api/status</span>
          </div>
          <div className="home-term-body">
            <div className="home-term-line"><span className="home-prompt">$</span> curl -s https://workrank.local/api/status</div>
            <div className="home-term-line home-out"><span className="home-prompt">→</span> 8 users online · 2.5s cycle · 0 alerts</div>
            <div className="home-term-line home-out"><span className="home-prompt">→</span> tracker: active (desktop: 12, web: 4)</div>
            <div className="home-term-line home-out"><span className="home-prompt">→</span> uptime: 127d 14h 32m</div>
            <div className="home-term-line"><span className="home-prompt">$</span> <span className="home-cursor">_</span></div>
          </div>
        </div>
      </section>

      <section className="home-stats" data-reveal>
        <div className="home-stats-inner">
          <div className="home-stat-item">
            <span className="home-stat-value">127</span>
            <span className="home-stat-label">days uptime</span>
          </div>
          <div className="home-stat-item">
            <span className="home-stat-value">8</span>
            <span className="home-stat-label">users online</span>
          </div>
          <div className="home-stat-item">
            <span className="home-stat-value">2.5s</span>
            <span className="home-stat-label">sync cycle</span>
          </div>
          <div className="home-stat-item">
            <span className="home-stat-value">0</span>
            <span className="home-stat-label">active alerts</span>
          </div>
        </div>
      </section>

      <section className="home-feature-band" data-reveal>
        <h2 className="home-section-title">Tính năng</h2>
        <div className="home-feature-grid">
          {featureItems.map((item) => (
            <article key={item.label} className="home-feature-item">
              <h3>{item.label}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-cta-band" data-reveal>
        <div className="home-cta-inner">
          <p className="home-cta-text">
            <span className="home-cta-prompt">&gt;</span> Sẵn sàng theo dõi năng suất?
          </p>
          <Link className="home-cta-button" to={primaryTo}>
            {isSignedIn ? 'Vào Dashboard' : 'Tạo tài khoản miễn phí'}
            <ChevronRight size={14} strokeWidth={2.5} />
          </Link>
        </div>
      </section>

      <section className="home-faq-band" data-reveal>
        <h2 className="home-section-title">FAQ</h2>
        <div className="home-faq-list">
          {faqData.map((item) => (
            <div
              key={item.q}
              className={'home-faq-item' + (openFAQ === item.q ? ' is-open' : '')}
              onClick={() => setOpenFAQ(openFAQ === item.q ? null : item.q)}
            >
              <div className="home-faq-head">
                <span className="home-faq-marker">{openFAQ === item.q ? '–' : '>'}</span>
                <span>{item.q}</span>
              </div>
              {openFAQ === item.q && (
                <p className="home-faq-answer">{item.a}</p>
              )}
            </div>
          ))}
        </div>
        <p className="home-faq-foot">
          WorkRank được duy trì miễn phí. Mọi thắc mắc liên hệ qua Facebook.
        </p>
      </section>

      <footer className="home-footer">
        <div className="home-footer-inner">
          <div className="home-footer-brand">
            <strong>WorkRank</strong>
            <span>realtime workspace tracker</span>
          </div>
          <div className="home-footer-links">
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/leaderboard">Xếp hạng</Link>
            <Link to="/pomodoro">Pomodoro</Link>
            <a href="https://www.facebook.com/ddyn.fz/" target="_blank" rel="noopener noreferrer">Liên hệ</a>
          </div>
          <span className="home-footer-copy">&copy; 2026 WorkRank</span>
        </div>
      </footer>
    </main>
  );
}
