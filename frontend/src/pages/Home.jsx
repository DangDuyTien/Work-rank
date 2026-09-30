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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { competition } from '../services/api';
import BrandMark from '../components/BrandMark';
import VerifiedBadge from '../components/VerifiedBadge';
import { initialsFromName } from '../utils/avatar';

// ── SVG ARTWORK: CHAMPIONSHIP LAUREL & CUP ──
function ChampionshipArtwork({ size = 140 }) {
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 200 124" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="champGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="35%" stopColor="#eab308" />
          <stop offset="70%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
      </defs>
      {/* Laurel Wreath Left */}
      <path d="M56 90 C42 75 40 50 50 30 C52 40 58 50 66 57 C56 45 58 33 66 20 C70 31 76 41 82 49" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {/* Laurel Wreath Right */}
      <path d="M144 90 C158 75 160 50 150 30 C148 40 142 50 134 57 C144 45 142 33 134 20 C130 31 124 41 118 49" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {/* Trophy Cup */}
      <path d="M76 26 L124 26 L118 64 C118 74 110 82 100 82 C90 82 82 74 82 64 Z" fill="url(#champGoldGrad)" stroke="#1a1a1a" strokeWidth="2.2" />
      {/* Trophy Handles */}
      <path d="M76 32 C62 32 62 54 77 56" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M124 32 C138 32 138 54 123 56" stroke="#1a1a1a" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {/* Trophy Stem & Base */}
      <rect x="96" y="82" width="8" height="16" fill="#1a1a1a" />
      <rect x="78" y="98" width="44" height="12" fill="url(#champGoldGrad)" stroke="#1a1a1a" strokeWidth="2.2" />
      {/* Star on Cup */}
      <polygon points="100,38 102,44 108,44 103,48 105,54 100,50 95,54 97,48 92,44 98,44" fill="#ffffff" stroke="#1a1a1a" strokeWidth="1" />
    </svg>
  );
}

// ── SVG ARTWORK: WINGED STAR / LAUREL MEDAL OF EXCELLENCE (D&AD INSPIRED) ──
function WingedStarArtwork({ size = 150, isGold = true }) {
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 200 124" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mvpGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="35%" stopColor="#eab308" />
          <stop offset="70%" stopColor="#ca8a04" />
          <stop offset="100%" stopColor="#854d0e" />
        </linearGradient>
      </defs>
      {/* Left Wing Feathers (Detailed Engraved Lineart) */}
      <g stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill={isGold ? 'rgba(234, 179, 8, 0.1)' : 'rgba(0,0,0,0.03)'}>
        <path d="M78 64 C58 46 35 34 12 38 C28 50 44 61 68 72 Z" />
        <path d="M80 70 C56 56 28 48 8 56 C26 66 46 76 72 82 Z" />
        <path d="M82 78 C58 70 32 66 14 76 C32 82 52 88 76 90 Z" />
        <path d="M84 86 C64 84 42 84 26 94 C42 97 60 98 80 96 Z" />
        <line x1="70" y1="61" x2="30" y2="44" stroke="#444" strokeWidth="1" />
        <line x1="72" y1="71" x2="25" y2="61" stroke="#444" strokeWidth="1" />
        <line x1="74" y1="80" x2="30" y2="78" stroke="#444" strokeWidth="1" />
      </g>
      {/* Right Wing Feathers (Detailed Engraved Lineart) */}
      <g stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill={isGold ? 'rgba(234, 179, 8, 0.1)' : 'rgba(0,0,0,0.03)'}>
        <path d="M122 64 C142 46 165 34 188 38 C172 50 156 61 132 72 Z" />
        <path d="M120 70 C144 56 172 48 192 56 C174 66 154 76 128 82 Z" />
        <path d="M118 78 C142 70 168 66 186 76 C168 82 148 88 124 90 Z" />
        <path d="M116 86 C136 84 158 84 174 94 C158 97 140 98 120 96 Z" />
        <line x1="130" y1="61" x2="170" y2="44" stroke="#444" strokeWidth="1" />
        <line x1="128" y1="71" x2="175" y2="61" stroke="#444" strokeWidth="1" />
        <line x1="126" y1="80" x2="170" y2="78" stroke="#444" strokeWidth="1" />
      </g>
      {/* Central Star Emblem */}
      <g transform="translate(100, 74)">
        <circle r="28" stroke={isGold ? '#ca8a04' : '#1a1a1a'} strokeWidth="1.8" strokeDasharray="3 3" fill="none" opacity="0.6" />
        <circle r="23" fill={isGold ? '#fef08a' : '#ffffff'} stroke="#1a1a1a" strokeWidth="2.2" />
        <polygon points="0,-14 4,-4 14,-3 7,4 9,14 0,9 -9,14 -7,4 -14,-3 -4,-4" fill={isGold ? 'url(#mvpGoldGrad)' : '#1a1a1a'} stroke="#1a1a1a" strokeWidth="1.4" />
        <circle r="2.5" fill="#ffffff" />
      </g>
    </svg>
  );
}

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
              WORKRANK <span style={{ color: '#b45309', fontWeight: 800 }}>• 3WIN</span>
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
                  borderRadius: 9999,
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
                  borderRadius: 9999,
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
                  ) : (
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 26,
                        fontWeight: 900,
                        color: '#facc15',
                      }}
                    >
                      {championTeam ? initialsFromName(championTeam.teamName) : '🏆'}
                    </span>
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

            {/* Visual Box 2: Stats & Trophy Artwork */}
            <div className="wr-award-visual-box wr-anim-box2-left" style={{ minHeight: 210 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.6px', color: '#666666', textTransform: 'uppercase' }}>
                  SEASON PERFORMANCE
                </span>
                <Award size={15} color="#111111" />
              </div>

              <div style={{ margin: 'auto 0', textAlign: 'center', padding: '10px 0' }}>
                <ChampionshipArtwork size={130} />
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
                  borderRadius: 9999,
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
                  ) : (
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 26,
                        fontWeight: 900,
                        color: '#facc15',
                      }}
                    >
                      {mvp ? initialsFromName(mvp.name) : '⭐'}
                    </span>
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

            {/* Visual Box 2: Winged Star Artwork & Score */}
            <div className="wr-award-visual-box wr-anim-box2-right" style={{ minHeight: 210 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.6px', color: '#666666', textTransform: 'uppercase' }}>
                  WINGED MEDAL OF EXCELLENCE
                </span>
                <Medal size={15} color="#111111" />
              </div>

              <div style={{ margin: 'auto 0', textAlign: 'center', padding: '10px 0' }}>
                <WingedStarArtwork size={140} isGold={Boolean(mvp)} />
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
            © {new Date().getFullYear()} 3WIN MEDIA • WORKRANK ENTERPRISE
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
