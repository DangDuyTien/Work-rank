import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  Crown,
  Flame,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const metrics = [
  { value: 'Realtime', label: 'đồng bộ thi đấu' },
  { value: '99.9%', label: 'uptime hệ thống' },
  { value: 'Audit', label: 'ledger tính điểm minh bạch' },
];

const features = [
  {
    icon: Swords,
    title: 'Đấu Trường Arena',
    text: 'Tham gia thi đấu mùa giải, hoàn thành thử thách và thăng hạng XP cùng đồng đội.',
  },
  {
    icon: Crown,
    title: 'Grand Championship',
    text: 'Giải đấu đỉnh cao tích lũy Grand Points xuyên suốt các mùa để tranh ngôi vương.',
  },
  {
    icon: Trophy,
    title: 'Leaderboard Realtime',
    text: 'Xếp hạng cá nhân, nhóm và bạn bè tức thời với hệ thống điểm số cập nhật chuẩn xác.',
  },
  {
    icon: ShieldCheck,
    title: 'Ledger Minh Bạch',
    text: 'Mọi điểm số đều được đối soát qua Event Store và Outbox, đảm bảo công bằng tuyệt đối.',
  },
];

const leaderboardRows = [
  { rank: 1, name: 'Đặng Duy Tiến', score: '4,314', badge: 'Dev' },
  { rank: 2, name: 'Minh Anh', score: '3,280', badge: 'Top 1 Season' },
  { rank: 3, name: 'Quang Huy', score: '2,926', badge: 'Grand Master' },
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
        <Link to="/" className="wr-home-brand" aria-label="3winmedia">
          <span style={{ fontSize: 11, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", letterSpacing: -0.5 }}>3W</span>
          <strong>3winmedia</strong>
        </Link>
        <nav className="wr-home-links" aria-label="Điều hướng trang chủ">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/arena">Arena</Link>
          <Link to="/grand">Grand Hub</Link>
          <Link to="/leaderboard">Xếp hạng</Link>
          <Link to="/friends">Bạn bè</Link>
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
                3winmedia Arena
              </div>
              <div className="wr-preview-status">
                <span></span>
                live season
              </div>
            </div>
            <div className="wr-preview-grid">
              <div className="wr-preview-panel wr-preview-panel-main">
                <div className="wr-panel-head">
                  <span>Mùa giải hiện tại</span>
                  <strong>Championship 2026</strong>
                </div>
                <div style={{ padding: '16px 0', color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>
                  Hệ thống thi đấu đối kháng, tính điểm sự kiện thời gian thực và ghi nhận bảng vàng thành tích.
                </div>
              </div>

              <div className="wr-preview-panel wr-preview-rank">
                <div className="wr-panel-head">
                  <span>Top Điểm Mùa Giải</span>
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
            </div>
          </div>
        </div>

        <div className="wr-home-hero-content">
          <div className="wr-home-pill" data-wr-reveal>
            <span>New</span>
            Hệ thống Đấu Trường Mùa Giải & Grand Championship
          </div>
          <h1 data-wr-reveal>
            3winmedia
            <span> nền tảng thi đấu & vinh danh hiệu suất</span>
          </h1>
          <p data-wr-reveal>
            Đấu trường công bằng, xếp hạng realtime, giải đấu mùa giải và bảng vàng thành tích cho cá nhân và đội nhóm.
          </p>
          <div className="wr-home-actions" data-wr-reveal>
            <Link className="wr-home-primary" to={primaryTo}>
              {isSignedIn ? 'Vào Dashboard' : 'Đăng nhập để bắt đầu'}
              <ArrowRight size={17} strokeWidth={2.5} />
            </Link>
            <Link className="wr-home-secondary" to="/arena">
              <Swords size={16} />
              Vào Arena
            </Link>
            <Link className="wr-home-secondary" to="/leaderboard">
              <Trophy size={16} />
              Xem xếp hạng
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
          <span className="wr-section-kicker">Engine</span>
          <h2>Kiến trúc sự kiện và tính điểm phân tán.</h2>
        </div>
        <div className="wr-command-card">
          <div className="wr-command-tabs">
            {['curl', 'npm'].map((tab) => (
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
            {activeTerminal === 'curl' && 'curl -s https://api.3winmedia.vn/health'}
            {activeTerminal === 'npm' && 'npm run dev'}
          </div>
          <div className="wr-command-output">
            <CheckCircle2 size={16} />
            database connected · competition ledger active · realtime projections live
          </div>
        </div>
      </section>

      <section className="wr-home-section wr-feature-section" data-wr-reveal>
        <div className="wr-section-head">
          <span className="wr-section-kicker">Features</span>
          <h2>Trải nghiệm thi đấu chuyên nghiệp.</h2>
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

      <section className="wr-home-final" data-wr-reveal>
        <div>
          <span><Flame size={18} /></span>
          <h2>Sẵn sàng bước vào đấu trường 3winmedia.</h2>
        </div>
        <Link className="wr-home-primary" to={primaryTo}>
          {isSignedIn ? 'Mở Dashboard' : 'Đăng nhập'}
          <ArrowRight size={17} strokeWidth={2.5} />
        </Link>
      </section>

      <footer className="wr-home-footer">
        <div className="wr-home-brand">
          <span style={{ fontSize: 11, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", letterSpacing: -0.5 }}>3W</span>
          <strong>3winmedia</strong>
        </div>
        <div>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/arena">Arena</Link>
          <Link to="/grand">Grand Hub</Link>
          <Link to="/leaderboard">Xếp hạng</Link>
        </div>
        <small>© {new Date().getFullYear()} 3winmedia Realtime Competition Platform</small>
      </footer>
    </main>
  );
}
