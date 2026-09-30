import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Trophy,
  Star,
  Crown,
  Medal,
  Award,
  LogIn,
  UserPlus,
  Sparkles,
  Users,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { competition } from '../services/api';
import BrandMark from '../components/BrandMark';
import VerifiedBadge from '../components/VerifiedBadge';
import { initialsFromName } from '../utils/avatar';

export default function Home() {
  const { user } = useAuth();
  const isSignedIn = Boolean(user);

  const [spotlight, setSpotlight] = useState({
    hasSpotlight: false,
    season: null,
    championTeam: null,
    mvp: null,
  });

  useEffect(() => {
    let isMounted = true;
    competition
      .getPublicSpotlight()
      .then((data) => {
        if (isMounted && data) {
          setSpotlight(data);
        }
      })
      .catch((err) => {
        console.warn('Failed to load public spotlight:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const { season, championTeam, mvp } = spotlight;

  return (
    <div className="wr-award-canvas">
      {/* ── 1. STICKY TOP BAR (BRAND & AUTH ACTION BUTTONS) ── */}
      <header className="wr-award-header wr-anim-header">
        <div className="wr-award-header-content">
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <BrandMark size={30} showLabel={false} />
            <span
              style={{
                fontFamily: "'Space Grotesk', -apple-system, sans-serif",
                fontSize: 16,
                fontWeight: 900,
                letterSpacing: '-0.4px',
                color: '#111111',
                textTransform: 'uppercase',
              }}
            >
              WORKRANK <span style={{ color: '#b45309', fontWeight: 800 }}>3WIN MEDIA</span>
            </span>
          </Link>
        </div>

        <div className="wr-award-header-content" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isSignedIn ? (
            <Link
              to="/dashboard"
              className="wr-award-pill-btn"
              style={{ padding: '9px 20px', fontSize: 13 }}
            >
              <span>Vào Workspace ({user?.name || 'Thành viên'})</span>
              <ArrowRight size={14} />
            </Link>
          ) : (
            <>
              <Link
                to="/login?mode=register"
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#111111',
                  textDecoration: 'none',
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1.5px solid rgba(0,0,0,0.2)',
                  background: 'rgba(255,255,255,0.85)',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <UserPlus size={14} />
                <span>Đăng ký</span>
              </Link>
              <Link
                to="/login"
                className="wr-award-pill-btn"
                style={{ padding: '9px 22px', fontSize: 13, background: '#0f172a' }}
              >
                <LogIn size={14} />
                <span>Đăng nhập</span>
              </Link>
            </>
          )}
        </div>
      </header>

      {/* ── 2. LEFT PANEL: CHAMPION TEAM (ĐỘI QUÁN QUÂN) ── */}
      <section className="wr-award-panel wr-award-panel-left">
        {/* Top Zone: Kinetic Headline & Metadata */}
        <div>
          <div className="wr-award-eyebrow wr-anim-meta-left">
            <Trophy size={14} color="#b45309" />
            <span className="wr-award-eyebrow-accent">
              {season?.name ? `${season.name} • CHAMPION TEAM` : 'MÙA GIẢI 2026 • ĐỘI VÔ ĐỊCH'}
            </span>
          </div>

          <h1 className="wr-award-headline">
            <span className="wr-award-headline-block wr-anim-h1-left">QUÁN QUÂN</span>
            <span className="wr-award-headline-block wr-anim-h2-left">MÙA GIẢI</span>
            <span
              className="wr-award-headline-block wr-anim-h3-left"
              style={{ color: championTeam ? '#111111' : '#888888' }}
            >
              {championTeam ? championTeam.teamName : 'CHỜ VINH DANH'}
            </span>
          </h1>

          <p className="wr-award-tagline wr-anim-desc-left">
            {championTeam
              ? `Đội tuyển dẫn đầu bảng xếp hạng tổng sắp với hiệu suất vượt trội và tinh thần đồng đội bứt phá.`
              : `Mùa giải đầu tiên đang diễn ra sôi nổi. Đội tuyển xuất sắc nhất sẽ được tôn vinh trang trọng tại đây.`}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link
              to={isSignedIn ? '/leaderboard' : '/login'}
              className="wr-award-pill-btn wr-anim-cta-left"
            >
              <span>{championTeam ? 'Xem kết quả giải đấu' : 'Khám phá bảng xếp hạng'}</span>
              <ArrowRight size={14} />
            </Link>

            {!isSignedIn && (
              <Link
                to="/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 18px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#111111',
                  background: 'rgba(0,0,0,0.05)',
                  border: '1px solid rgba(0,0,0,0.15)',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                }}
                className="wr-anim-cta-left"
              >
                <LogIn size={13} />
                <span>Đăng nhập</span>
              </Link>
            )}
          </div>
        </div>

        {/* Middle Zone: Editorial Whitespace */}
        <div style={{ flex: 1, minHeight: 48 }} />

        {/* Bottom Zone: Large Visual Artwork Composition (Anchored near bottom) */}
        <div className="wr-award-visual-container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
              alignItems: 'stretch',
            }}
          >
            {/* Visual Box 1: Team Crest & Identity */}
            <div className="wr-award-visual-box wr-anim-box1-left" style={{ minHeight: 210 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.6px', color: '#b45309', textTransform: 'uppercase' }}>
                  CHAMPIONSHIP EMBLEM
                </span>
                <Crown size={15} color="#eab308" />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '18px 0' }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 8,
                    background: '#111111',
                    border: '2px solid #eab308',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(234,179,8,0.25)',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {championTeam?.avatarUrl ? (
                    <img
                      src={championTeam.avatarUrl}
                      alt={championTeam.teamName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : championTeam ? (
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 24,
                        fontWeight: 900,
                        color: '#facc15',
                      }}
                    >
                      {initialsFromName(championTeam.teamName)}
                    </span>
                  ) : (
                    <Users size={32} color="#facc15" strokeWidth={2} />
                  )}
                </div>

                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#111111', lineHeight: 1.2 }}>
                    {championTeam ? championTeam.teamName : 'Đội Tuyển Mùa Mới'}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#777777', textTransform: 'uppercase', marginTop: 4 }}>
                    Hạng #1 Chung Cuộc
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666666' }}>
                <span>Trạng thái</span>
                <span style={{ fontWeight: 800, color: '#111111' }}>
                  {championTeam ? 'Đã khóa kết quả' : 'Đang thi đấu'}
                </span>
              </div>
            </div>

            {/* Visual Box 2: Stats & Trophy Presentation */}
            <div className="wr-award-visual-box wr-anim-box2-left" style={{ minHeight: 210 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.6px', color: '#666666', textTransform: 'uppercase' }}>
                  SEASON PERFORMANCE
                </span>
                <Award size={15} color="#111111" />
              </div>

              <div style={{ margin: 'auto 0', textAlign: 'center', padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trophy size={48} color="#d97706" strokeWidth={1.75} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#92400e', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  {championTeam ? 'QUÁN QUÂN GIẢI ĐẤU' : 'CHỜ VINH DANH'}
                </span>
              </div>

              <div
                style={{
                  borderTop: '1px solid rgba(0,0,0,0.06)',
                  paddingTop: 10,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#888888', textTransform: 'uppercase' }}>Điểm Mùa Giải</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#111111', marginTop: 2 }}>
                    {championTeam ? `${championTeam.seasonScore.toLocaleString()} XP` : '--- XP'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#888888', textTransform: 'uppercase' }}>Grand Points</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#b45309', marginTop: 2 }}>
                    {championTeam ? `+${championTeam.grandPoints} GP` : '--- GP'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. RIGHT PANEL: MVP (NHÂN VIÊN XUẤT SẮC NHẤT) ── */}
      <section className="wr-award-panel wr-award-panel-right">
        {/* Top Zone: Kinetic Headline & Metadata */}
        <div>
          <div className="wr-award-eyebrow wr-anim-meta-right">
            <Star size={14} color="#b45309" />
            <span className="wr-award-eyebrow-accent">
              {season?.name ? `${season.name} • MOST VALUABLE PLAYER` : 'MÙA GIẢI 2026 • DANH HIỆU MVP'}
            </span>
          </div>

          <h2 className="wr-award-headline">
            <span className="wr-award-headline-block wr-anim-h1-right">MVP XUẤT SẮC</span>
            <span className="wr-award-headline-block wr-anim-h2-right">MÙA GIẢI</span>
            <span
              className="wr-award-headline-block wr-anim-h3-right"
              style={{ color: mvp ? '#111111' : '#888888' }}
            >
              {mvp ? mvp.name : 'CHỜ CHỦ NHÂN'}
            </span>
          </h2>

          <p className="wr-award-tagline wr-anim-desc-right">
            {mvp
              ? `Vinh danh cá nhân có hiệu suất đóng góp cao nhất và chỉ số tăng trưởng ấn tượng nhất toàn cơ quan.`
              : `Cá nhân có thành tích bứt phá và đóng góp nổi bật nhất sẽ được xướng tên tại vị trí danh giá này.`}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link
              to={isSignedIn ? '/arena' : '/login'}
              className="wr-award-pill-btn wr-anim-cta-right"
            >
              <span>{mvp ? 'Khám phá đấu trường Arena' : 'Tham gia thi đấu mùa giải'}</span>
              <ArrowRight size={14} />
            </Link>

            {!isSignedIn && (
              <Link
                to="/login?mode=register"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 18px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#b45309',
                  background: 'rgba(234,179,8,0.1)',
                  border: '1px solid rgba(234,179,8,0.35)',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                }}
                className="wr-anim-cta-right"
              >
                <UserPlus size={13} />
                <span>Đăng ký mới</span>
              </Link>
            )}
          </div>
        </div>

        {/* Middle Zone: Editorial Whitespace */}
        <div style={{ flex: 1, minHeight: 48 }} />

        {/* Bottom Zone: Large Visual Artwork Composition (Anchored near bottom) */}
        <div className="wr-award-visual-container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
              alignItems: 'stretch',
            }}
          >
            {/* Visual Box 1: MVP Portrait & Profile */}
            <div className="wr-award-visual-box wr-anim-box1-right" style={{ minHeight: 210 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.6px', color: '#b45309', textTransform: 'uppercase' }}>
                  MVP RECOGNITION
                </span>
                <Sparkles size={15} color="#f59e0b" />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '18px 0' }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    background: '#111111',
                    border: '2px solid #f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(245,158,11,0.25)',
                    overflow: 'hidden',
                    position: 'relative',
                    flexShrink: 0,
                  }}
                >
                  {mvp?.avatarData ? (
                    <img
                      src={mvp.avatarData}
                      alt={mvp.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : mvp ? (
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 24,
                        fontWeight: 900,
                        color: '#facc15',
                      }}
                    >
                      {initialsFromName(mvp.name)}
                    </span>
                  ) : (
                    <UserRound size={32} color="#facc15" strokeWidth={2} />
                  )}
                  {mvp?.isVerified && (
                    <div style={{ position: 'absolute', bottom: 2, right: 2 }}>
                      <VerifiedBadge size={16} />
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 18, fontWeight: 900, color: '#111111', lineHeight: 1.2 }}>
                      {mvp ? mvp.name : 'Nhân Tố Xuất Sắc'}
                    </span>
                    {mvp?.isVerified && <VerifiedBadge size={14} />}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#777777', textTransform: 'uppercase', marginTop: 4 }}>
                    {mvp ? `${mvp.jobTitle || 'Chuyên viên'} • ${mvp.department || 'Media'}` : 'Chờ vinh danh'}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666666' }}>
                <span>Danh hiệu</span>
                <span style={{ fontWeight: 800, color: '#b45309' }}>
                  {mvp ? 'MVP Mùa Giải' : 'Chờ xác định'}
                </span>
              </div>
            </div>

            {/* Visual Box 2: Excellence Award & Score */}
            <div className="wr-award-visual-box wr-anim-box2-right" style={{ minHeight: 210 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.6px', color: '#666666', textTransform: 'uppercase' }}>
                  EXCELLENCE RECOGNITION
                </span>
                <Medal size={15} color="#111111" />
              </div>

              <div style={{ margin: 'auto 0', textAlign: 'center', padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Award size={48} color="#f59e0b" strokeWidth={1.75} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#b45309', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  {mvp ? 'DANH HIỆU MVP' : 'CHỜ XÁC ĐỊNH'}
                </span>
              </div>

              <div
                style={{
                  borderTop: '1px solid rgba(0,0,0,0.06)',
                  paddingTop: 10,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#888888', textTransform: 'uppercase' }}>Điểm Cống Hiến</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#111111', marginTop: 2 }}>
                    {mvp ? `${mvp.score.toLocaleString()} XP` : '--- XP'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#888888', textTransform: 'uppercase' }}>Chứng Nhận</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#0284c7', marginTop: 2 }}>
                    {mvp?.isVerified ? 'Đã Xác Thực' : 'Hệ Thống'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. SUBTLE EDITORIAL FOOTER STRIP ── */}
      <footer className="wr-award-footer wr-anim-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BrandMark size={20} showLabel={false} />
          <span style={{ fontWeight: 800, color: '#333333' }}>
            © {new Date().getFullYear()} 3WIN MEDIA — WORKRANK ENTERPRISE
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <Link to="/leaderboard" style={{ color: '#666666', textDecoration: 'none', fontWeight: 700 }}>
            Bảng xếp hạng
          </Link>
          <Link to="/arena" style={{ color: '#666666', textDecoration: 'none', fontWeight: 700 }}>
            Đấu trường Arena
          </Link>
          <Link to="/youtube" style={{ color: '#666666', textDecoration: 'none', fontWeight: 700 }}>
            Kênh YouTube
          </Link>
          <Link to="/games/capital-board" style={{ color: '#666666', textDecoration: 'none', fontWeight: 700 }}>
            Trò chơi
          </Link>
          <Link to="/login" style={{ color: '#111111', textDecoration: 'none', fontWeight: 900 }}>
            Đăng nhập
          </Link>
          <Link to="/login?mode=register" style={{ color: '#b45309', textDecoration: 'none', fontWeight: 900 }}>
            Đăng ký
          </Link>
        </div>
      </footer>
    </div>
  );
}
