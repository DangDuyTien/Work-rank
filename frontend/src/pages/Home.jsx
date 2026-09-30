import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  Swords,
  Trophy,
  Tv,
  Gamepad2,
  Sparkles,
  Zap,
  Lock,
  LogIn,
  UserPlus,
  Star,
  Crown,
  Medal,
  Calendar,
  Flame,
  Award,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { competition } from '../services/api';
import BrandMark from '../components/BrandMark';
import VerifiedBadge from '../components/VerifiedBadge';
import { initialsFromName } from '../utils/avatar';

export default function Home() {
  const { user } = useAuth();
  const isSignedIn = Boolean(user);
  const [activeTab, setActiveTab] = useState('ARENA');

  const [spotlight, setSpotlight] = useState({
    hasSpotlight: false,
    season: null,
    championTeam: null,
    mvp: null,
  });
  const [spotlightLoading, setSpotlightLoading] = useState(true);

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
      })
      .finally(() => {
        if (isMounted) setSpotlightLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const previews = {
    ARENA: {
      title: 'Đấu Trường Mùa Giải (Arena)',
      subtitle: 'Thi đấu đối kháng & Nhiệm vụ hiệu suất theo mùa',
      icon: Swords,
      color: '#0284c7',
      bg: 'rgba(2,132,199,0.08)',
      badge: 'Season Live',
      metrics: [
        { label: 'Cơ chế tính điểm', value: 'Event Store bất biến' },
        { label: 'Cập nhật', value: 'Realtime Socket.IO' },
        { label: 'Vinh danh', value: 'Huy hiệu & Cúp Vô Địch' },
      ],
      description: 'Hệ thống thi đấu đối kháng trực tiếp giữa các cá nhân và đội nhóm. Mọi thành tích đều được quy đổi thành điểm số Season Score và tích lũy vào Grand Championship.',
    },
    YOUTUBE: {
      title: 'Tích Hợp YouTube & Sản Xuất',
      subtitle: 'Đồng bộ chỉ số kênh media & video realtime',
      icon: Tv,
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.08)',
      badge: 'Media Hub',
      metrics: [
        { label: 'Dữ liệu phân tích', value: 'Views, Likes, Growth' },
        { label: 'Bảo mật', value: 'Kiểm soát Scope & Anti-IDOR' },
        { label: 'Cơ chế', value: 'Snapshot chu kỳ tự động' },
      ],
      description: 'Theo dõi tổng thể hiệu suất tăng trưởng của mạng lưới kênh YouTube nội bộ. Báo cáo trực quan theo từng đội nhóm sản xuất với phân quyền truy cập chặt chẽ.',
    },
    RANKING: {
      title: 'Bảng Xếp Hạng & Grand Championship',
      subtitle: 'Xếp hạng hợp nhất đa chiều và giải đấu đỉnh cao',
      icon: Trophy,
      color: '#d97706',
      bg: 'rgba(217,119,6,0.08)',
      badge: 'Championship',
      metrics: [
        { label: 'Phân loại', value: 'Cá nhân & Đội nhóm' },
        { label: 'Chức danh', value: 'Tier 1 - Tier 6 chuẩn hóa' },
        { label: 'Xác thực', value: 'Tích xanh Verified Badge' },
      ],
      description: 'Hệ thống vinh danh toàn diện với Leaderboard cập nhật tức thời theo Season Score và Grand Points, ghi nhận cống hiến thực chất của từng thành viên.',
    },
    GAMES: {
      title: 'Trò Chơi Giải Trí Nội Bộ',
      subtitle: 'Cờ Tỷ Phú & Quiz Trắc Nghiệm Tốc Độ trong giờ giải lao',
      icon: Gamepad2,
      color: '#9333ea',
      bg: 'rgba(147,51,234,0.08)',
      badge: 'Break & Play',
      metrics: [
        { label: 'Đoán Hình & Nhạc', value: 'Quiz trắc nghiệm tốc độ' },
        { label: 'Cờ Tỷ Phú', value: 'Sắp ra mắt (Coming Soon)' },
        { label: 'Tính độc lập', value: 'Không ảnh hưởng điểm công việc' },
      ],
      description: 'Không gian giải trí nhanh giúp gắn kết đồng đội sau giờ làm việc căng thẳng. Nhiều người chơi cùng tham gia trong phòng đấu realtime kịch tính.',
    },
  };

  const currentPreview = previews[activeTab];
  const CurrentIcon = currentPreview.icon;

  const { season, championTeam, mvp } = spotlight;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* ── 1. PUBLIC HEADER / NAVIGATION BAR (VUÔNG VẮN) ── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(15, 23, 42, 0.12)',
          padding: '0 24px',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <BrandMark size={32} showLabel label="3WIN MEDIA" />
          </Link>

          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              fontSize: 13,
              fontWeight: 700,
            }}
            className="wr-public-nav-links"
          >
            <a href="#spotlight-hero" style={{ color: '#475569', textDecoration: 'none', transition: 'color 0.15s' }}>Vinh danh</a>
            <a href="#pillars" style={{ color: '#475569', textDecoration: 'none', transition: 'color 0.15s' }}>Năng lực</a>
            <a href="#architecture" style={{ color: '#475569', textDecoration: 'none', transition: 'color 0.15s' }}>Bảo mật</a>
            <a href="#workflow" style={{ color: '#475569', textDecoration: 'none', transition: 'color 0.15s' }}>Quy trình</a>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isSignedIn ? (
            <Link
              to="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 18px',
                background: '#0f172a',
                color: '#ffffff',
                textDecoration: 'none',
                borderRadius: 0,
                fontSize: 13,
                fontWeight: 800,
                boxShadow: '0 2px 8px rgba(15,23,42,0.15)',
              }}
            >
              <span>Chào, {user?.name || 'Thành viên'}</span>
              <ArrowRight size={15} />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1.5px solid rgba(15,23,42,0.2)',
                  textDecoration: 'none',
                  borderRadius: 0,
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                <LogIn size={15} />
                <span>Đăng nhập</span>
              </Link>

              <Link
                to="/login?mode=register"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 18px',
                  background: '#0f172a',
                  color: '#ffffff',
                  textDecoration: 'none',
                  borderRadius: 0,
                  fontSize: 13,
                  fontWeight: 800,
                  boxShadow: '0 2px 8px rgba(15,23,42,0.2)',
                }}
              >
                <UserPlus size={15} />
                <span>Đăng ký</span>
              </Link>
            </>
          )}
        </div>
      </header>

      {/* ── 2. HERO SECTION — TÔN VINH NHÀ VÔ ĐỊCH GẦN NHẤT + MVP (3-COLUMN LAYOUT) ── */}
      <section
        id="spotlight-hero"
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          padding: '40px 20px 48px',
        }}
      >
        <div
          className="wr-spotlight-hero-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 1fr) minmax(360px, 1.35fr) minmax(280px, 1fr)',
            gap: 20,
            alignItems: 'stretch',
          }}
        >
          {/* ── LEFT: 🏆 ĐỘI VÔ ĐỊCH GIẢI GẦN NHẤT ── */}
          <div
            className="wr-spotlight-champion-card"
            style={{
              background: '#ffffff',
              border: '1px solid rgba(15,23,42,0.14)',
              borderTop: '4px solid #eab308',
              borderRadius: 0,
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 8px 24px rgba(15,23,42,0.04)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Top Badge */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 8px',
                    borderRadius: 0,
                    background: 'rgba(234,179,8,0.12)',
                    border: '1px solid rgba(234,179,8,0.35)',
                    color: '#b45309',
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: '0.4px',
                  }}
                >
                  <Trophy size={13} color="#eab308" />
                  <span>ĐỘI VÔ ĐỊCH</span>
                </span>

                <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  {season?.name || 'MÙA GẦN NHẤT'}
                </span>
              </div>

              {/* Team Emblem & Info */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: 12 }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 0,
                    background: '#0f172a',
                    border: '2px solid #eab308',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(234,179,8,0.25)',
                    position: 'relative',
                    overflow: 'hidden',
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
                        fontSize: 24,
                        fontWeight: 900,
                        color: '#facc15',
                        letterSpacing: '-0.5px',
                      }}
                    >
                      {championTeam ? initialsFromName(championTeam.teamName) : '🏆'}
                    </span>
                  )}
                  {/* Floating Crown Icon */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      background: '#eab308',
                      color: '#0f172a',
                      padding: 2,
                      borderRadius: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Crown size={11} strokeWidth={3} />
                  </div>
                </div>

                <h3
                  style={{
                    margin: '14px 0 4px',
                    fontSize: 20,
                    fontWeight: 900,
                    color: '#0f172a',
                    lineHeight: 1.2,
                  }}
                >
                  {championTeam ? championTeam.teamName : 'Chưa có nhà vô địch'}
                </h3>

                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    color: '#eab308',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Award size={12} />
                  <span>{championTeam ? 'CHAMPION TEAM • HẠNG #1' : 'CHỜ KẾT QUẢ MÙA GIẢI'}</span>
                </span>

                <p
                  style={{
                    margin: '10px 0 0',
                    fontSize: 12,
                    color: '#64748b',
                    lineHeight: 1.5,
                  }}
                >
                  {championTeam
                    ? `Đội tuyển xuất sắc nhất mùa giải với thành tích ấn tượng và tinh thần đồng đội bứt phá.`
                    : `Mùa giải đầu tiên đang diễn ra. Đội xuất sắc nhất giải đấu sẽ được tôn vinh trang trọng tại đây.`}
                </p>
              </div>
            </div>

            {/* Bottom Metrics / Standings Info */}
            <div
              style={{
                marginTop: 20,
                paddingTop: 14,
                borderTop: '1px solid rgba(15,23,42,0.08)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                background: '#f8fafc',
                padding: '10px 12px',
                borderRadius: 0,
                border: '1px solid rgba(15,23,42,0.06)',
              }}
            >
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Điểm Mùa Giải
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
                  {championTeam ? `${championTeam.seasonScore.toLocaleString()} XP` : '---'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Grand Points
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#0284c7', marginTop: 2 }}>
                  {championTeam ? `+${championTeam.grandPoints} GP` : '---'}
                </div>
              </div>
            </div>
          </div>

          {/* ── CENTER: 🌟 WORKRANK / 3WIN MEDIA HERO & CTA ── */}
          <div
            className="wr-spotlight-center-card"
            style={{
              background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
              border: '1px solid rgba(15,23,42,0.16)',
              borderRadius: 0,
              padding: '32px 28px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 30px rgba(15,23,42,0.06)',
            }}
          >
            {/* Top Brand Logo */}
            <div style={{ marginBottom: 14 }}>
              <BrandMark size={48} showLabel={false} />
            </div>

            {/* Eyebrow Tag */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 0,
                background: 'rgba(2, 132, 199, 0.08)',
                border: '1px solid rgba(2, 132, 199, 0.3)',
                color: '#0284c7',
                fontSize: 11,
                fontWeight: 900,
                marginBottom: 14,
                letterSpacing: '0.4px',
                textTransform: 'uppercase',
              }}
            >
              <Sparkles size={13} />
              <span>Nền tảng Hiệu suất, Thi đấu & Đội nhóm</span>
            </div>

            {/* Headline */}
            <h1
              style={{
                margin: '0 0 12px',
                fontSize: 'clamp(24px, 3.2vw, 36px)',
                fontWeight: 900,
                color: '#0f172a',
                lineHeight: 1.2,
                letterSpacing: '-0.8px',
              }}
            >
              Làm Việc. Cạnh Tranh. Ghi Dấu.
            </h1>

            {/* Tagline */}
            <p
              style={{
                margin: '0 0 24px',
                fontSize: 14,
                color: '#475569',
                lineHeight: 1.6,
                maxWidth: 420,
              }}
            >
              Tự động đồng bộ số liệu sản xuất Media & YouTube, thi đấu đối kháng mùa giải bất biến và vinh danh thứ hạng minh bạch theo thời gian thực.
            </p>

            {/* Hero CTAs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320 }}>
              {isSignedIn ? (
                <Link
                  to="/dashboard"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '13px 24px',
                    background: '#0f172a',
                    color: '#ffffff',
                    textDecoration: 'none',
                    borderRadius: 0,
                    fontSize: 14,
                    fontWeight: 900,
                    boxShadow: '0 4px 16px rgba(15,23,42,0.25)',
                    transition: 'transform 0.1s ease',
                  }}
                >
                  <span>Mở Dashboard Làm Việc</span>
                  <ArrowRight size={16} />
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '13px 24px',
                      background: '#0f172a',
                      color: '#ffffff',
                      textDecoration: 'none',
                      borderRadius: 0,
                      fontSize: 14,
                      fontWeight: 900,
                      boxShadow: '0 4px 16px rgba(15,23,42,0.25)',
                    }}
                  >
                    <span>Đăng Nhập Workspace</span>
                    <ArrowRight size={16} />
                  </Link>

                  <Link
                    to="/login?mode=register"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '12px 20px',
                      background: '#ffffff',
                      color: '#0f172a',
                      border: '1.5px solid rgba(15,23,42,0.25)',
                      textDecoration: 'none',
                      borderRadius: 0,
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                  >
                    <UserPlus size={16} />
                    <span>Tạo Tài Khoản Thành Viên</span>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* ── RIGHT: ⭐ MVP GIẢI GẦN NHẤT ── */}
          <div
            className="wr-spotlight-mvp-card"
            style={{
              background: '#ffffff',
              border: '1px solid rgba(15,23,42,0.14)',
              borderTop: '4px solid #f59e0b',
              borderRadius: 0,
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 8px 24px rgba(15,23,42,0.04)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Top Badge */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 8px',
                    borderRadius: 0,
                    background: 'rgba(245,158,11,0.12)',
                    border: '1px solid rgba(245,158,11,0.35)',
                    color: '#b45309',
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: '0.4px',
                  }}
                >
                  <Star size={13} color="#f59e0b" />
                  <span>MVP XUẤT SẮC</span>
                </span>

                <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  {season?.name || 'MÙA GẦN NHẤT'}
                </span>
              </div>

              {/* MVP Avatar & Info */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: 12 }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 0,
                    background: '#0f172a',
                    border: '2px solid #f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(245,158,11,0.25)',
                    position: 'relative',
                    overflow: 'hidden',
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
                        fontSize: 24,
                        fontWeight: 900,
                        color: '#facc15',
                        letterSpacing: '-0.5px',
                      }}
                    >
                      {mvp ? initialsFromName(mvp.name) : '⭐'}
                    </span>
                  )}
                  {/* Verified Icon if user is verified */}
                  {mvp?.isVerified && (
                    <div style={{ position: 'absolute', bottom: 2, right: 2 }}>
                      <VerifiedBadge size={16} />
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '14px 0 4px', justifyContent: 'center' }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 20,
                      fontWeight: 900,
                      color: '#0f172a',
                      lineHeight: 1.2,
                    }}
                  >
                    {mvp ? mvp.name : 'Chưa có MVP'}
                  </h3>
                  {mvp?.isVerified && <VerifiedBadge size={15} />}
                </div>

                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    color: '#d97706',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Medal size={12} />
                  <span>{mvp ? (mvp.awardTitle || 'MOST VALUABLE PLAYER') : 'CHỜ VINH DANH'}</span>
                </span>

                <p
                  style={{
                    margin: '10px 0 0',
                    fontSize: 12,
                    color: '#64748b',
                    lineHeight: 1.5,
                  }}
                >
                  {mvp
                    ? `${mvp.jobTitle || 'Nhân viên'} • ${mvp.department || 'Media'}`
                    : `Cá nhân có thành tích bứt phá và đóng góp nổi bật nhất sẽ được xướng tên tại vị trí danh giá này.`}
                </p>
              </div>
            </div>

            {/* Bottom MVP Metric */}
            <div
              style={{
                marginTop: 20,
                paddingTop: 14,
                borderTop: '1px solid rgba(15,23,42,0.08)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                background: '#f8fafc',
                padding: '10px 12px',
                borderRadius: 0,
                border: '1px solid rgba(15,23,42,0.06)',
              }}
            >
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Điểm Cống Hiến
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
                  {mvp ? `${mvp.score.toLocaleString()} XP` : '---'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Danh Hiệu
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#d97706', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {mvp ? 'MVP Mùa Giải' : '---'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. INTERACTIVE PRODUCT PREVIEW SHOWCASE (VUÔNG VẮN) ── */}
      <section style={{ maxWidth: 1240, margin: '0 auto', padding: '0 20px 48px' }}>
        <div
          style={{
            width: '100%',
            background: '#ffffff',
            border: '1px solid rgba(15,23,42,0.16)',
            borderRadius: 0,
            boxShadow: '0 12px 32px rgba(15,23,42,0.06)',
            overflow: 'hidden',
            textAlign: 'left',
          }}
        >
          {/* Top Mockup Tab Switcher (Vuông vắn) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              borderBottom: '1px solid rgba(15,23,42,0.12)',
              background: '#f8fafc',
              overflowX: 'auto',
            }}
          >
            {[
              { key: 'ARENA', label: 'Đấu Trường Mùa Giải', icon: Swords },
              { key: 'YOUTUBE', label: 'Kênh YouTube & Media', icon: Tv },
              { key: 'RANKING', label: 'Bảng Xếp Hạng & Vinh Danh', icon: Trophy },
              { key: 'GAMES', label: 'Trò Chơi Nội Bộ', icon: Gamepad2 },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '14px 20px',
                    background: isActive ? '#ffffff' : 'transparent',
                    border: 'none',
                    borderRight: '1px solid rgba(15,23,42,0.1)',
                    borderBottom: isActive ? '2px solid #0284c7' : '2px solid transparent',
                    color: isActive ? '#0f172a' : '#64748b',
                    fontWeight: isActive ? 900 : 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    borderRadius: 0,
                  }}
                >
                  <Icon size={16} color={isActive ? '#0284c7' : '#64748b'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Preview Card */}
          <div style={{ padding: '28px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ maxWidth: 640 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 0,
                      background: currentPreview.bg,
                      border: `1px solid ${currentPreview.color}40`,
                      color: currentPreview.color,
                      fontSize: 11,
                      fontWeight: 900,
                    }}
                  >
                    <CurrentIcon size={12} />
                    <span>{currentPreview.badge}</span>
                  </span>
                  <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>{currentPreview.subtitle}</span>
                </div>

                <h3 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                  {currentPreview.title}
                </h3>

                <p style={{ margin: 0, fontSize: 14, color: '#475569', lineHeight: 1.6 }}>
                  {currentPreview.description}
                </p>
              </div>

              {isSignedIn && (
                <Link
                  to={activeTab === 'ARENA' ? '/arena' : activeTab === 'YOUTUBE' ? '/youtube' : activeTab === 'RANKING' ? '/leaderboard' : '/games/quiz'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    background: '#0f172a',
                    color: '#ffffff',
                    borderRadius: 0,
                    fontSize: 13,
                    fontWeight: 800,
                    textDecoration: 'none',
                  }}
                >
                  <span>Truy cập nhanh</span>
                  <ChevronRight size={14} />
                </Link>
              )}
            </div>

            {/* Metrics Row (Vuông vắn) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 14,
                marginTop: 24,
                paddingTop: 20,
                borderTop: '1px solid rgba(15,23,42,0.08)',
              }}
            >
              {currentPreview.metrics.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#f8fafc',
                    padding: '12px 16px',
                    borderRadius: 0,
                    border: '1px solid rgba(15,23,42,0.1)',
                  }}
                >
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', marginTop: 3 }}>
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. FOUR CORE PILLARS SECTION (VUÔNG VẮN) ── */}
      <section
        id="pillars"
        style={{
          background: '#f8fafc',
          borderTop: '1px solid rgba(15,23,42,0.1)',
          borderBottom: '1px solid rgba(15,23,42,0.1)',
          padding: '64px 24px',
        }}
      >
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Kiến Trúc Sản Phẩm
            </span>
            <h2 style={{ margin: '6px 0 10px', fontSize: 32, fontWeight: 900, color: '#0f172a' }}>
              4 Trụ Cột Nền Tảng Của WorkRank
            </h2>
            <p style={{ margin: 0, fontSize: 15, color: '#64748b', maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
              Tích hợp liền mạch quy trình làm việc, đo lường năng lực và giải trí vào trong một giao diện duy nhất.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 20,
            }}
          >
            {/* Pillar 1: WORK */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid rgba(15,23,42,0.12)',
                borderRadius: 0,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 16px rgba(15,23,42,0.03)',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 0,
                  background: 'rgba(239,68,68,0.1)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                  border: '1px solid rgba(239,68,68,0.2)',
                }}
              >
                <Tv size={22} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                WORK • SẢN XUẤT
              </span>
              <h3 style={{ margin: '6px 0 10px', fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                Tích Hợp Media & YouTube
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.6, flex: 1 }}>
                Quản trị mạng lưới kênh YouTube, tự động lấy chỉ số views, likes, comments theo chu kỳ và phân bổ theo từng đội nhóm phụ trách.
              </p>
            </div>

            {/* Pillar 2: COMPETE */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid rgba(15,23,42,0.12)',
                borderRadius: 0,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 16px rgba(15,23,42,0.03)',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 0,
                  background: 'rgba(2,132,199,0.1)',
                  color: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                  border: '1px solid rgba(2,132,199,0.2)',
                }}
              >
                <Swords size={22} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                COMPETE • THI ĐẤU
              </span>
              <h3 style={{ margin: '6px 0 10px', fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                Đấu Trường & Mùa Giải
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.6, flex: 1 }}>
                Tham gia thi đấu theo mùa, hoàn thành nhiệm vụ hiệu suất, tích lũy điểm Season Score và Grand Championship minh bạch.
              </p>
            </div>

            {/* Pillar 3: CONNECT */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid rgba(15,23,42,0.12)',
                borderRadius: 0,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 16px rgba(15,23,42,0.03)',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 0,
                  background: 'rgba(217,119,6,0.1)',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                  border: '1px solid rgba(217,119,6,0.2)',
                }}
              >
                <Trophy size={22} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                CONNECT • VINH DANH
              </span>
              <h3 style={{ margin: '6px 0 10px', fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                Xếp Hạng & Chức Danh
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.6, flex: 1 }}>
                Bảng xếp hạng realtime cá nhân và đội nhóm, phân cấp chức danh Tier 1-6 chuẩn hóa, huy hiệu Verified và kênh chat nội bộ.
              </p>
            </div>

            {/* Pillar 4: PLAY */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid rgba(15,23,42,0.12)',
                borderRadius: 0,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 16px rgba(15,23,42,0.03)',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 0,
                  background: 'rgba(147,51,234,0.1)',
                  color: '#9333ea',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                  border: '1px solid rgba(147,51,234,0.2)',
                }}
              >
                <Gamepad2 size={22} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                PLAY • GIẢI TRÍ
              </span>
              <h3 style={{ margin: '6px 0 10px', fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                Trò Chơi Doanh Nghiệp
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.6, flex: 1 }}>
                Mini game Cờ Tỷ Phú và Đoán Hình & Đoán Nhạc theo phong cách Live Quiz Kahoot giúp giải tỏa căng thẳng trong giờ giải lao.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. HOW IT WORKS / WORKFLOW SECTION (VUÔNG VẮN) ── */}
      <section
        id="workflow"
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          padding: '64px 24px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Quy Trình Hoạt Động
          </span>
          <h2 style={{ margin: '6px 0 10px', fontSize: 32, fontWeight: 900, color: '#0f172a' }}>
            Cách WorkRank Vận Hành Trong Tổ Chức
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          {[
            {
              step: '01',
              title: 'Gia Nhập & Phân Bổ',
              desc: 'Tài khoản thành viên được liên kết với phòng ban, chức danh công tác và đội nhóm phụ trách.',
            },
            {
              step: '02',
              title: 'Làm Việc & Đồng Bộ',
              desc: 'Hiệu suất sản xuất, nội dung và chỉ số video được hệ thống tự động đồng bộ theo thời gian thực.',
            },
            {
              step: '03',
              title: 'Thi Đấu & Thăng Hạng',
              desc: 'Tích lũy điểm Season Score, hoàn thành nhiệm vụ và cải thiện vị trí trên Bảng Xếp Hạng.',
            },
            {
              step: '04',
              title: 'Vinh Danh & Gắn Kết',
              desc: 'Trao Cúp Vô Địch, trao danh hiệu MVP và cùng đồng đội tham gia các trận mini game giải lao vui vẻ.',
            },
          ].map((item) => (
            <div
              key={item.step}
              style={{
                padding: '20px 22px',
                background: '#ffffff',
                border: '1px solid rgba(15,23,42,0.12)',
                borderRadius: 0,
                position: 'relative',
              }}
            >
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 26,
                  fontWeight: 900,
                  color: '#0284c7',
                  marginBottom: 10,
                }}
              >
                {item.step}
              </div>
              <h4 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                {item.title}
              </h4>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.55 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 6. DATA INTEGRITY & ARCHITECTURE SECTION (VUÔNG VẮN) ── */}
      <section
        id="architecture"
        style={{
          background: '#0f172a',
          color: '#ffffff',
          padding: '64px 24px',
        }}
      >
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Độ Tin Cậy & Bảo Mật Doanh Nghiệp
            </span>
            <h2 style={{ margin: '6px 0 10px', fontSize: 32, fontWeight: 900, color: '#ffffff' }}>
              Kiến Trúc Dữ Liệu Bất Biến & Minh Bạch
            </h2>
            <p style={{ margin: 0, fontSize: 15, color: '#94a3b8', maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
              Được thiết kế theo kiến trúc hướng sự kiện (Event-Driven) với các tiêu chuẩn an toàn dữ liệu cao cấp.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 20,
            }}
          >
            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 0,
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <ShieldCheck size={20} color="#38bdf8" />
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
                  Source of Truth & Score Ledger
                </h4>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
                Mọi thay đổi điểm số đều ghi vết qua Event Store và Sổ Cái (Score Ledger) bất biến. Quản trị viên có thể đối soát và Rebuild Read Models bất kỳ lúc nào mà không thất thoát dữ liệu.
              </p>
            </div>

            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 0,
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Lock size={20} color="#38bdf8" />
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
                  Phân Quyền RBAC & Chống IDOR
                </h4>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
                Hệ thống kiểm tra phân quyền nghiêm ngặt theo vai trò (Admin, Manager, User), cô lập dữ liệu kênh YouTube theo phạm vi đội nhóm, ngăn chặn triệt để lỗ hổng truy cập chéo (IDOR).
              </p>
            </div>

            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 0,
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Zap size={20} color="#38bdf8" />
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
                  Realtime Engine Phân Tán
                </h4>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
                Đồng bộ hóa tức thời qua Socket.IO cho điểm số, bảng xếp hạng, phòng chơi Cờ Tỷ Phú và các lượt quiz live mà không cần người dùng phải tải lại trang.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. FINAL CTA BANNER (VUÔNG VẮN) ── */}
      <section
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          padding: '64px 20px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            borderRadius: 0,
            padding: '48px 32px',
            color: '#ffffff',
            boxShadow: '0 12px 32px rgba(15,23,42,0.15)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <h2 style={{ margin: '0 0 14px', fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, color: '#ffffff' }}>
            Sẵn Sàng Bứt Phá Cùng Đội Ngũ WorkRank?
          </h2>
          <p style={{ margin: '0 0 28px', fontSize: 16, color: '#94a3b8', maxWidth: 600, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
            Truy cập không gian làm việc của bạn ngay hôm nay để theo dõi hiệu suất, thi đấu thăng hạng và kết nối cùng đồng đội.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {isSignedIn ? (
              <Link
                to="/dashboard"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '14px 32px',
                  background: '#38bdf8',
                  color: '#0f172a',
                  textDecoration: 'none',
                  borderRadius: 0,
                  fontSize: 15,
                  fontWeight: 900,
                  boxShadow: '0 4px 16px rgba(56,189,248,0.3)',
                }}
              >
                <span>Mở Dashboard Cá Nhân</span>
                <ArrowRight size={18} />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '14px 32px',
                    background: '#38bdf8',
                    color: '#0f172a',
                    textDecoration: 'none',
                    borderRadius: 0,
                    fontSize: 15,
                    fontWeight: 900,
                    boxShadow: '0 4px 16px rgba(56,189,248,0.3)',
                  }}
                >
                  <span>Đăng Nhập Ngay</span>
                  <ArrowRight size={18} />
                </Link>

                <Link
                  to="/login?mode=register"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '14px 28px',
                    background: 'rgba(255,255,255,0.1)',
                    color: '#ffffff',
                    border: '1.5px solid rgba(255,255,255,0.25)',
                    textDecoration: 'none',
                    borderRadius: 0,
                    fontSize: 15,
                    fontWeight: 800,
                  }}
                >
                  <UserPlus size={18} />
                  <span>Tạo Tài Khoản Mới</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── 8. PUBLIC FOOTER (VUÔNG VẮN) ── */}
      <footer
        style={{
          borderTop: '1px solid rgba(15,23,42,0.12)',
          background: '#ffffff',
          padding: '32px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 1240,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BrandMark size={28} showLabel label="3WIN MEDIA" />
            <span style={{ fontSize: 12, color: '#64748b' }}>
              • Nền tảng Hiệu suất, Thi đấu & Vinh danh Doanh nghiệp
            </span>
          </div>

          <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#64748b' }}>
            <a href="#spotlight-hero" style={{ color: 'inherit', textDecoration: 'none' }}>Vinh danh</a>
            <a href="#pillars" style={{ color: 'inherit', textDecoration: 'none' }}>Năng lực</a>
            <a href="#architecture" style={{ color: 'inherit', textDecoration: 'none' }}>Bảo mật</a>
            <Link to="/login" style={{ color: 'inherit', textDecoration: 'none' }}>Đăng nhập</Link>
          </div>

          <div style={{ width: '100%', borderTop: '1px solid rgba(15,23,42,0.08)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#94a3b8', flexWrap: 'wrap', gap: 10 }}>
            <span>© {new Date().getFullYear()} 3WIN MEDIA Platform. Bảo lưu mọi quyền.</span>
            <span>Phiên bản Enterprise V3.3 • 100% Realtime Event Sourcing</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
