import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { users as usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UiContext';
import { parseApiError } from '../utils/errors';
import {
  avatarHue,
  initialsFromName,
  getUserAvatar,
  compressImage,
} from '../utils/avatar';
import {
  Activity,
  ArrowLeft,
  Award,
  BadgeCheck,
  Calendar,
  ChevronLeft,
  Code,
  Crown,
  Edit3,
  ExternalLink,
  Flame,
  Heart,
  ImagePlus,
  Mail,
  Medal,
  Phone,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Swords,
  Trophy,
  Tv,
  User,
  UserCheck,
  UserPlus,
  Users,
  Video,
  X,
  Zap,
} from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';
import JobTitleBadge from '../components/JobTitleBadge';
import ProfileErrorBoundary from '../components/ProfileErrorBoundary';
import usePageVisibility from '../hooks/usePageVisibility';
import { TabTransition, PageTransitionSkeleton } from '../components/ui';
import { getCached, setCached, fetchWithCache, CACHE_KEYS, CACHE_TTL, isDeepEqual } from '../services/cache';

/* =========================================================================
 * STYLES & THEME CONSTANTS (WorkRank Corporate Design System)
 * ========================================================================= */

const CARD = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-content)',
  boxShadow: 'var(--shadow-card)',
};

const STATUS_CONFIG = {
  active:   { label: 'Đang làm việc', bg: 'var(--success-soft)', border: 'var(--success-border)', color: 'var(--success)', dot: 'var(--success)' },
  online:   { label: 'Trực tuyến',    bg: 'var(--info-soft)', border: 'var(--info-border)', color: 'var(--info)', dot: 'var(--info)' },
  idle:     { label: 'Tạm nghỉ',      bg: 'var(--warning-soft)', border: 'var(--warning-border)', color: 'var(--warning)', dot: 'var(--warning)' },
  offline:  { label: 'Ngoại tuyến',   bg: 'var(--surface-hover)', border: 'var(--border-2)', color: 'var(--text-secondary)', dot: 'var(--text-muted)' },
  inactive: { label: 'Tạm khóa',      bg: 'var(--danger-soft)', border: 'var(--danger-border)', color: 'var(--danger)', dot: 'var(--danger)' },
};

const JOB_TITLE_SUGGESTIONS = [
  'Nhân viên',
  'Editor',
  'Content Creator',
  'Quản lý kênh',
  'Trưởng phòng',
  'Phó phòng',
  'Phó giám đốc',
  'Giám đốc',
  'Kỹ sư hệ thống',
  'Chuyên viên truyền thông',
];

const DEPARTMENT_SUGGESTIONS = [
  'Media & Content',
  'Engineering Core',
  'Community & Growth',
  'Phòng Sản Xuất Video',
  'Phòng Truyền Thông',
  'Phòng Kỹ Thuật',
  'Ban Giám Đốc',
];

// Official Recognition Badges Definition
const OFFICIAL_BADGE_CONFIG = {
  verified: { label: 'Đã xác minh', desc: 'Tài khoản nhân sự đã xác thực chính thức', icon: BadgeCheck, color: 'var(--accent)' },
  dev:      { label: 'Kỹ thuật / Dev', desc: 'Đội ngũ phát triển và kỹ thuật hệ thống', icon: ShieldCheck, color: 'var(--info)' },
  champion: { label: 'Vô địch giải đấu', desc: 'Quán quân mùa giải / Giải vô địch năm', icon: Trophy, color: '#d97706' },
  mvp:      { label: 'Nhân viên xuất sắc', desc: 'Danh hiệu MVP được ban quản trị vinh danh', icon: Sparkles, color: '#7c3aed' },
};

const DEFAULT_GALLERY_IMAGES = [
  null,
  null,
  null,
  null,
  null,
  null,
];

function fmtNum(n) {
  n = Number(n) || 0;
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toLocaleString('vi-VN');
}

function fmtDate(d) {
  if (!d) return 'Chưa ghi nhận';
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* =========================================================================
 * COMPONENT: USER DETAIL / PROFILE PAGE
 * ========================================================================= */

export default function UserDetail() {
  const { id: routeUserId } = useParams();
  const navigate = useNavigate();
  const { user: authUser, isAdmin } = useAuth();
  const toast = useToast();
  const pageVisible = usePageVisibility();

  const targetUserId = routeUserId ? Number(routeUserId) : authUser?.id;
  const isSelf = authUser?.id && Number(authUser.id) === Number(targetUserId);
  const canEdit = isSelf || isAdmin;

  const cachedProfile = targetUserId ? getCached(CACHE_KEYS.USER_PROFILE(targetUserId)) : null;

  // Data states
  const [loading, setLoading] = useState(!cachedProfile);
  const [error, setError] = useState(null);
  const [profileData, setProfileData] = useState(() => cachedProfile || null);
  const [activeTab, setActiveTab] = useState('overview'); // overview | performance | work | history

  // Social / Preferences states
  const [likesCount, setLikesCount] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [galleryImages, setGalleryImages] = useState([]);
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const [galleryError, setGalleryError] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [avatarImgError, setAvatarImgError] = useState(false);
  const [imgErrors, setImgErrors] = useState({});
  const galleryInputRef = useRef(null);

  // Handle Gallery Upload & Delete
  const handleTriggerUpload = (slotIndex) => {
    setUploadingSlot(slotIndex);
    if (galleryInputRef.current) {
      galleryInputRef.current.value = '';
      galleryInputRef.current.click();
    }
  };

  const handleGalleryFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || uploadingSlot === null) return;
    if (!file.type.startsWith('image/')) {
      const msg = 'Chỉ hỗ trợ file hình ảnh (PNG, JPG, WEBP)';
      setGalleryError(msg);
      toast.warning(msg);
      return;
    }
    try {
      setGalleryError('');
      const base64 = await compressImage(file, 1000, 1000, 0.88);
      await usersApi.updateGalleryImage(targetUserId, uploadingSlot, base64);
      setGalleryImages((prev) => {
        const next = prev.filter((img) => Number(img.slot) !== uploadingSlot);
        return [...next, { slot: uploadingSlot, imageData: base64 }].sort((a, b) => a.slot - b.slot);
      });
      setImgErrors((prev) => ({ ...prev, [uploadingSlot]: false }));
      toast.success('Đã tải ảnh lên phòng trưng bày thành công!');
    } catch (err) {
      const errMsg = parseApiError(err, 'Không thể tải ảnh lên.');
      setGalleryError(errMsg);
      toast.error(errMsg);
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleDeleteSlotImage = async (e, slotIndex) => {
    e.stopPropagation();
    try {
      setGalleryError('');
      await usersApi.removeGalleryImage(targetUserId, slotIndex);
      setGalleryImages((prev) => prev.filter((img) => Number(img.slot) !== slotIndex));
      setImgErrors((prev) => ({ ...prev, [slotIndex]: false }));
      toast.success('Đã gỡ ảnh khỏi phòng trưng bày!');
    } catch (err) {
      const errMsg = parseApiError(err, 'Không thể xóa ảnh.');
      setGalleryError(errMsg);
      toast.error(errMsg);
    }
  };

  // Fetch full profile data
  const loadProfile = async (silent = false) => {
    if (!targetUserId) return;
    if (!silent && !cachedProfile) setLoading(true);
    setError(null);

    try {
      const res = await fetchWithCache(
        CACHE_KEYS.USER_PROFILE(targetUserId),
        () => usersApi.get(targetUserId),
        { ttl: CACHE_TTL.STATIC, force: silent }
      );
      setProfileData((prev) => (isDeepEqual(prev, res) ? prev : res));
      setAvatarImgError(false);

      // Load Likes
      try {
        const likeRes = await fetchWithCache(
          `user:likes:${targetUserId}`,
          () => usersApi.profileLikes(targetUserId),
          { ttl: CACHE_TTL.MEDIUM }
        );
        setLikesCount(Number(likeRes.data?.totalLikes || 0));
        setHasLiked(Boolean(likeRes.data?.viewerHasLiked));
      } catch (e) {
        // Silent fail
      }

      // Load Gallery
      try {
        const galRes = await fetchWithCache(
          `user:gallery:${targetUserId}`,
          () => usersApi.gallery(targetUserId),
          { ttl: CACHE_TTL.MEDIUM }
        );
        const galData = galRes.data || [];
        setGalleryImages((prev) => (isDeepEqual(prev, galData) ? prev : galData));
      } catch (e) {
        // Silent fail
      }

    } catch (err) {
      const errMsg = parseApiError(err, 'Không tải được hồ sơ nhân viên');
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (pageVisible) {
      loadProfile();
    }
  }, [targetUserId, pageVisible]);

  useEffect(() => {
    const handleUserUpdate = (event) => {
      const payload = event.detail;
      const uid = String(payload?.userId || payload?.user?.id || '');
      if (uid && String(targetUserId) === uid) {
        loadProfile(true);
      }
    };
    window.addEventListener('workrank:user-updated', handleUserUpdate);
    return () => window.removeEventListener('workrank:user-updated', handleUserUpdate);
  }, [targetUserId]);

  // Handle Profile Like
  const handleToggleLike = async () => {
    if (liking || !targetUserId) return;
    setLiking(true);
    try {
      const res = await usersApi.likeProfile(targetUserId);
      setLikesCount(Number(res.data?.totalLikes || (hasLiked ? likesCount - 1 : likesCount + 1)));
      setHasLiked(Boolean(res.data?.viewerHasLiked ?? !hasLiked));
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể cập nhật lượt yêu thích'));
    } finally {
      setLiking(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '16px 16px 48px', fontFamily: "'JetBrains Mono', monospace" }}>
        <PageTransitionSkeleton />
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 16px', fontFamily: "'JetBrains Mono', monospace" }}>
        <div style={{ ...CARD, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.25, color: '#dc2626', marginBottom: 8 }}>
            Không tìm thấy nhân viên
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.55, margin: '0 0 16px' }}>{error || 'Nhân viên không tồn tại hoặc đã bị xóa.'}</p>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '8px 16px', background: 'var(--text-primary)', color: 'var(--surface)', border: 'none',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <ArrowLeft size={14} /> Quay lại
          </button>
        </div>
      </div>
    );
  }

  const user = profileData.data || {};
  const team = profileData.team;
  const competition = profileData.competition;
  const historicalSeasons = profileData.historicalSeasons || [];
  const youtubeSummary = profileData.youtubeSummary;
  const recognitions = profileData.recognitions || {};
  const badges = recognitions.badges || {};
  const awards = recognitions.awards || [];

  const isVerified = Boolean(badges.verified?.active || user.isVerified || user.verified);
  const isDev = Boolean(badges.dev?.active || user.isDev);
  const isChampion = Boolean(badges.champion?.active);
  const championCount = badges.champion?.count || 0;
  const isMvp = Boolean(badges.mvp?.active);
  const mvpCount = badges.mvp?.count || 0;

  const jobTitle = user.jobTitle || user.job_title || 'Nhân viên';
  const department = user.department || 'Media & Content';
  const statusKey = user.status === 'inactive' ? 'inactive' : user.presence || user.status || 'offline';
  const statusTheme = STATUS_CONFIG[statusKey] || STATUS_CONFIG.offline;

  const isEditor = jobTitle.toLowerCase().includes('editor') || jobTitle.toLowerCase().includes('sản xuất') || jobTitle.toLowerCase().includes('content');
  const isChannelManager = jobTitle.toLowerCase().includes('kênh') || jobTitle.toLowerCase().includes('youtube') || jobTitle.toLowerCase().includes('media');
  const isManager = jobTitle.toLowerCase().includes('trưởng') || jobTitle.toLowerCase().includes('quản lý') || jobTitle.toLowerCase().includes('lead') || user.role === 'manager';
  const isExecutive = jobTitle.toLowerCase().includes('giám đốc') || jobTitle.toLowerCase().includes('admin') || user.role === 'admin';

  return (
    <div className="profile-page" style={{ maxWidth: 1120, margin: '0 auto', padding: '16px 16px 48px', fontFamily: "'JetBrains Mono', monospace" }}>
        {/* ── BACK BUTTON ── */}
      <div style={{ marginBottom: 14 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none', color: 'var(--text-secondary)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0,
          }}
        >
          <ChevronLeft size={16} /> Quay lại
        </button>
      </div>

      {/* ── PROFILE HERO (THIẾT KẾ RỘNG & 6 KHUNG ẢNH HOẠT ĐỘNG GỐC) ── */}
      <section
        className="profile-hero"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-content)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="profile-hero-profile">
          <div className="profile-photo-shell">
            <div
              className="profile-photo-frame"
              style={{
                width: 150,
                height: 150,
                borderRadius: '50%',
                overflow: 'hidden',
                border: '3px solid var(--surface)',
                boxShadow: '0 0 0 2px rgba(180,83,9,0.2), 0 10px 25px rgba(180,83,9,0.1)',
              }}
            >
              {(() => {
                const avatarSrc = !avatarImgError ? (getUserAvatar(user, targetUserId) || user.avatarData || '') : '';
                if (avatarSrc) {
                  return (
                    <img
                      className="profile-photo"
                      src={avatarSrc}
                      alt={`Ảnh đại diện ${user.name || `User #${targetUserId}`}`}
                      onError={() => setAvatarImgError(true)}
                    />
                  );
                }
                return (
                  <div
                    className="profile-photo-fallback"
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--accent)',
                      color: 'var(--surface)',
                      fontSize: 42,
                      fontWeight: 700,
                    }}
                  >
                    {initialsFromName(user.name)}
                  </div>
                );
              })()}
            </div>
            {/* Status dot */}
            <div
              style={{
                position: 'absolute',
                bottom: 4,
                right: 4,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: statusTheme.dot,
                border: '3px solid var(--surface)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
              title={statusTheme.label}
            />
          </div>

          <div className="profile-identity-copy">
            <div className="profile-name-line" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.25 }}>
                {user.name || `User #${targetUserId}`}
              </h1>
              {isVerified && <VerifiedBadge size={22} />}
              {isDev && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: 'var(--info-soft)',
                    color: 'var(--info)',
                    border: '1px solid var(--info-border)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="Thành viên Đội ngũ Kỹ thuật & Phát triển hệ thống (Dev)"
                >
                  <Code size={11} strokeWidth={2.5} /> DEV
                </span>
              )}
              {isChampion && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: '#fef3c7',
                    color: 'var(--accent)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title={`Quán quân / Vô địch giải đấu (${championCount} lần)`}
                >
                  <Trophy size={11} /> CHAMPION {championCount > 1 ? `x${championCount}` : ''}
                </span>
              )}
              {isMvp && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: '#f5f3ff',
                    color: '#7c3aed',
                    border: '1px solid rgba(124,58,237,0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title={`Nhân viên xuất sắc / MVP (${mvpCount} lần)`}
                >
                  <Star size={11} /> MVP {mvpCount > 1 ? `x${mvpCount}` : ''}
                </span>
              )}
              {/* Chức danh & Huy hiệu vinh danh */}
              <JobTitleBadge
                jobTitle={jobTitle}
                size="md"
              />
            </div>

            {/* Phòng ban & Đội nhóm */}
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                {department}
              </span>
              <span style={{ color: 'var(--border-2)' }}>•</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Users size={14} color="var(--text-secondary)" /> {team?.name || 'Chưa vào Team'}
              </span>
              <span style={{ color: 'var(--border-2)' }}>•</span>
              <span style={{ color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
                ID: #{user.id || targetUserId}
              </span>
            </div>

            {/* Trạng thái công việc & Tương tác */}
            <div className="profile-presence-row" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  borderRadius: 9999,
                  background: statusTheme.bg,
                  border: `1px solid ${statusTheme.border}`,
                  color: statusTheme.color,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusTheme.dot }} />
                {statusTheme.label}
              </span>

              {/* Nút thả tim đồng nghiệp */}
              {!isSelf && (
                <button
                  type="button"
                  onClick={handleToggleLike}
                  disabled={liking}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 12px',
                    borderRadius: 6,
                    background: hasLiked ? 'rgba(239,68,68,0.1)' : 'rgba(15,23,42,0.04)',
                    border: hasLiked ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(15,23,42,0.1)',
                    color: hasLiked ? '#dc2626' : 'var(--text-secondary)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Heart size={13} fill={hasLiked ? 'currentColor' : 'none'} />
                  {likesCount > 0 ? `${likesCount} Yêu thích` : 'Thả tim'}
                </button>
              )}

              {/* Nút Chỉnh sửa hồ sơ */}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => navigate(isSelf ? '/settings?tab=profile' : `/admin/privileges?userId=${targetUserId}`)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 14px',
                    borderRadius: 6,
                    background: 'var(--text-primary)',
                    color: 'var(--surface)',
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Edit3 size={12} />
                  {isSelf ? 'Chỉnh sửa hồ sơ' : 'Quản lý nhân sự'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── GIỚI THIỆU BẢN THÂN (GALLERY 6 KHUNG ẢNH) ── */}
        <div className="profile-gallery-grid" aria-label="Ảnh giới thiệu cá nhân">
          {DEFAULT_GALLERY_IMAGES.map((defaultUrl, index) => {
            const customImg = galleryImages.find((img) => Number(img.slot) === index);
            const hasCustom = Boolean(customImg?.imageData);
            const isCorrupted = Boolean(imgErrors[index]);
            const imageUrl = (!isCorrupted && customImg?.imageData) ? customImg.imageData : defaultUrl;

            return (
              <div
                key={index}
                className="profile-gallery-cell"
                onClick={() => imageUrl && setPreviewImage(imageUrl)}
                title={imageUrl ? `Ảnh #${index + 1} - Bấm để xem ảnh phóng to` : `Ô ảnh #${index + 1} - Chưa có ảnh`}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (imageUrl) setPreviewImage(imageUrl);
                  }
                }}
              >
                {imageUrl ? (
                  <>
                    <img
                      className="profile-gallery-backdrop"
                      src={imageUrl}
                      alt=""
                      aria-hidden="true"
                      onError={() => {
                        setImgErrors((prev) => ({ ...prev, [index]: true }));
                      }}
                    />
                    <img
                      className="gallery-main-img"
                      loading="lazy"
                      decoding="async"
                      src={imageUrl}
                      alt={`Ảnh giới thiệu ${index + 1}`}
                      onError={() => {
                        setImgErrors((prev) => ({ ...prev, [index]: true }));
                      }}
                    />
                  </>
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)', background: 'var(--surface-soft)' }}>
                    <ImagePlus size={22} aria-hidden="true" />
                    <span style={{ fontSize: 11 }}>Chưa có ảnh</span>
                  </div>
                )}

                {/* Hover overlay controls (only visible on hover/focus) */}
                <div className="profile-gallery-overlay">
                  <div className="profile-gallery-overlay-top">
                    <span className="profile-gallery-slot-badge">#{index + 1}</span>
                    {canEdit && hasCustom && (
                      <button
                        type="button"
                        className="profile-gallery-delete-btn"
                        onClick={(e) => handleDeleteSlotImage(e, index)}
                        title="Xóa ảnh này, khôi phục ảnh mặc định"
                      >
                        <X size={11} strokeWidth={3} />
                        <span>Xóa</span>
                      </button>
                    )}
                  </div>

                  <div className="profile-gallery-overlay-center">
                    {canEdit && (
                      <button
                        type="button"
                        className="profile-gallery-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTriggerUpload(index);
                        }}
                        title={hasCustom ? 'Thay đổi ảnh này' : 'Tải ảnh mới lên'}
                      >
                        <ImagePlus size={13} strokeWidth={2.5} />
                        <span>{hasCustom ? 'Đổi ảnh' : '+ Thêm ảnh'}</span>
                      </button>
                    )}
                    {imageUrl && <button
                      type="button"
                      className="profile-gallery-action-btn"
                      style={{ background: 'rgba(15,23,42,0.85)', color: 'var(--surface)', border: '1px solid rgba(255,255,255,0.2)' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImage(imageUrl);
                      }}
                      title="Xem ảnh phóng to"
                    >
                      <ExternalLink size={12} />
                      <span>Xem lớn</span>
                    </button>}
                  </div>

                  <div style={{ height: 12 }} />
                </div>
              </div>
            );
          })}
          {galleryError && <div className="profile-gallery-error">{galleryError}</div>}
        </div>
      </section>

      {/* ── TABS NAVIGATION ── */}
      <div
        style={{
          display: 'flex', gap: 4,
          background: 'var(--surface)',
          border: '1px solid rgba(15,23,42,0.08)',
          borderRadius: 6, padding: 6,
          marginBottom: 18, overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {[
          { id: 'overview',     label: 'Tổng Quan Nhân Sự', icon: User },
          { id: 'performance',  label: 'Thành Tích Thi Đấu', icon: Trophy, badge: competition?.currentSeasonScore ? `${fmtNum(competition.currentSeasonScore)} pts` : null },
          { id: 'work',         label: 'Nghiệp Vụ & Đóng Góp', icon: Zap },
          { id: 'history',      label: 'Lịch Sử Mùa Giải',  icon: Calendar, badge: historicalSeasons.length > 0 ? `${historicalSeasons.length} Mùa` : null },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 4, border: 'none',
                background: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? 'var(--surface)' : 'var(--text-secondary)',
                fontSize: 12, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'background-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard)',
              }}
            >
              <TabIcon size={14} color={isActive ? 'var(--surface)' : 'currentColor'} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: '1px 5px',
                  borderRadius: 4,
                  background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.06)',
                  color: isActive ? 'var(--surface)' : 'var(--text-secondary)',
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <TabTransition key={activeTab} minHeight={380}>
        {/* ── TAB 1: TỔNG QUAN NHÂN SỰ ── */}
        {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Khối Thông Tin Công Việc & Liên Hệ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {/* Cột 1: Thông tin nhân sự */}
            <div style={{ ...CARD, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Shield size={16} color="var(--accent)" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.3, color: 'var(--text-primary)' }}>
                  Thông Tin Nhân Sự & Chức Danh
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(15,23,42,0.04)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Huy hiệu chức danh:</span>
                  <JobTitleBadge jobTitle={jobTitle} size="xs" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(15,23,42,0.04)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Phòng ban:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{department}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(15,23,42,0.04)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Đội nhóm:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{team?.name || 'Chưa tham gia'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(15,23,42,0.04)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Quyền hệ thống (RBAC):</span>
                  <span style={{ fontWeight: 600, color: user.role === 'admin' ? '#dc2626' : 'var(--text-secondary)', textTransform: 'uppercase' }}>{user.role}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 4 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Mã nhân viên (ID):</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>#{user.id}</span>
                </div>
              </div>
            </div>

            {/* Cột 2: Thông tin liên hệ & Bio */}
            <div style={{ ...CARD, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Mail size={16} color="#16a34a" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.3, color: 'var(--text-primary)' }}>
                  Liên Hệ & Tiểu Sử
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(15,23,42,0.04)', paddingBottom: 8 }}>
                  <Mail size={14} color="var(--text-secondary)" />
                  <span style={{ color: 'var(--text-secondary)' }}>Email:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginLeft: 'auto' }}>{user.email || '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(15,23,42,0.04)', paddingBottom: 8 }}>
                  <Phone size={14} color="var(--text-secondary)" />
                  <span style={{ color: 'var(--text-secondary)' }}>Điện thoại:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginLeft: 'auto' }}>{user.phone || 'Chưa cập nhật'}</span>
                </div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Giới thiệu / Trách nhiệm công việc:</span>
                  <div style={{
                    padding: '8px 12px', background: 'rgba(15,23,42,0.03)', border: '1px solid rgba(15,23,42,0.06)',
                    fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, minHeight: 48,
                  }}>
                    {user.bio || 'Chưa có thông tin giới thiệu công việc.'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Khối Huy Hiệu & Vinh Danh Chính Thức */}
          <div style={{ ...CARD, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Award size={18} color="var(--accent)" />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.3, color: 'var(--text-primary)' }}>
                Huy Hiệu & Vinh Danh Chính Thức (Official Recognitions)
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              {/* 1. Verified */}
              <div style={{
                padding: '12px 14px',
                background: isVerified ? 'rgba(180,83,9,0.06)' : 'rgba(15,23,42,0.02)',
                border: isVerified ? '1px solid rgba(180,83,9,0.25)' : '1px solid rgba(15,23,42,0.06)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <VerifiedBadge size={22} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12, color: isVerified ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {isVerified ? 'Tài Khoản Đã Xác Thực' : 'Chưa Cấp Tích Xanh'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Được Ban Quản Trị cấp tích xanh định danh</div>
                </div>
              </div>

              {/* 2. Dev */}
              <div style={{
                padding: '12px 14px',
                background: isDev ? 'var(--info-soft)' : 'var(--surface-hover)',
                border: isDev ? '1px solid var(--info-border)' : '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Code size={20} color={isDev ? 'var(--info)' : 'var(--text-muted)'} strokeWidth={2.5} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12, color: isDev ? 'var(--info)' : 'var(--text-secondary)' }}>
                    {isDev ? 'Kỹ Sư Phát Triển (Dev)' : 'Không Thuộc Dev Team'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Đội ngũ phát triển và kỹ thuật 3winmedia</div>
                </div>
              </div>

              {/* 3. Champion */}
              <div style={{
                padding: '12px 14px',
                background: isChampion ? 'rgba(245,158,11,0.08)' : 'rgba(15,23,42,0.02)',
                border: isChampion ? '1px solid rgba(245,158,11,0.28)' : '1px solid rgba(15,23,42,0.06)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Trophy size={20} color={isChampion ? '#d97706' : 'var(--text-muted)'} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12, color: isChampion ? '#d97706' : 'var(--text-secondary)' }}>
                    {isChampion ? `Vô Địch Giải Đấu (${championCount} Cúp)` : 'Chưa Có Cúp Vô Địch'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Quán quân mùa giải / Grand Championship</div>
                </div>
              </div>

              {/* 4. MVP */}
              <div style={{
                padding: '12px 14px',
                background: isMvp ? 'rgba(180,83,9,0.08)' : 'rgba(0,0,0,0.02)',
                border: isMvp ? '1px solid rgba(180,83,9,0.28)' : '1px solid rgba(0,0,0,0.06)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Sparkles size={20} color={isMvp ? 'var(--accent)' : 'var(--text-muted)'} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12, color: isMvp ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {isMvp ? `Nhân Viên Xuất Sắc (${mvpCount} MVP)` : 'Chưa Có Danh Hiệu MVP'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Vinh danh thành tích đóng góp nổi bật</div>
                </div>
              </div>
            </div>

            {/* Chi tiết danh sách giải thưởng nếu có */}
            {awards.length > 0 ? (
              <div style={{ marginTop: 14, borderTop: '1px solid rgba(15,23,42,0.06)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Danh Sách Các Giải Thưởng Đã Vinh Danh:</div>
                {awards.map((a) => (
                  <div key={a.id} style={{ padding: '8px 12px', background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ color: a.awardType === 'champion' ? 'var(--accent)' : '#6d28d9', marginRight: 6 }}>
                        {a.title}
                      </strong>
                      <span style={{ color: 'var(--text-secondary)' }}>— {a.reason || 'Chưa có căn cứ mô tả trong bản ghi'}</span>
                      <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: 10 }}>
                        {a.seasonName ? `${a.seasonName}${a.seasonStatus ? ` · ${a.seasonStatus}` : ''}` : a.grandName || 'Ghi nhận WorkRank'}
                        {' · '}Bản ghi chính thức
                      </div>
                    </div>
                    <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: 12 }}>
                      {a.awardedAt ? new Date(a.awardedAt).toLocaleDateString('vi-VN') : ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 14, borderTop: '1px solid rgba(15,23,42,0.06)', paddingTop: 12, color: 'var(--text-muted)', fontSize: 12 }}>
                Chưa ghi nhận giải thưởng vinh danh nào trong hồ sơ.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: THÀNH TÍCH THI ĐẤU THỰC TẾ ── */}
      {activeTab === 'performance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* 4 Thẻ KPI Competition Thực Tế */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {/* MÙA GIẢI HIỆN TẠI */}
            <div style={{ ...CARD, padding: 18, borderLeft: '4px solid var(--accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Swords size={13} color="var(--accent)" /> Đấu Trường Mùa Giải
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
                  {competition?.currentSeasonRank ? `HẠNG #${competition.currentSeasonRank}` : 'Chưa xếp hạng'}
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono',monospace" }}>
                {fmtNum(competition?.currentSeasonScore || 0)} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>pts</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                Tổng điểm thi đấu trong mùa hiện tại
              </div>
            </div>

            {/* GRAND CHAMPIONSHIP 2026 */}
            <div style={{ ...CARD, padding: 18, borderLeft: '4px solid #d97706' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#d97706', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Crown size={13} color="#d97706" /> Grand Championship
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706' }}>
                  {competition?.grandRank ? `HẠNG #${competition.grandRank}` : 'Chưa xếp hạng'}
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2, color: '#d97706', fontFamily: "'JetBrains Mono',monospace" }}>
                {fmtNum(competition?.grandPoints || 0)} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>GP</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                Điểm tích lũy vô địch toàn năm 2026
              </div>
            </div>

            {/* SỐ MÙA VÔ ĐỊCH */}
            <div style={{ ...CARD, padding: 18, borderLeft: '4px solid #16a34a' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Trophy size={13} color="#16a34a" /> Mùa Vô Địch & Top 3
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono',monospace" }}>
                {competition?.seasonWins || 0} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>vô địch / {competition?.podiumCount || 0} top 3</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                Thành tích ghi nhận trên Bảng Vàng
              </div>
            </div>

            {/* MVP & PHONG ĐỘ */}
            <div style={{ ...CARD, padding: 18, borderLeft: (mvpCount > 0 || Number(competition?.mvpCount || 0) > 0) ? '4px solid var(--accent)' : '4px solid var(--border-2)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: (mvpCount > 0 || Number(competition?.mvpCount || 0) > 0) ? 'var(--accent)' : 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={13} color={(mvpCount > 0 || Number(competition?.mvpCount || 0) > 0) ? 'var(--accent)' : 'var(--text-muted)'} /> Danh Hiệu MVP Mùa
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2, color: (mvpCount > 0 || Number(competition?.mvpCount || 0) > 0) ? 'var(--accent)' : 'var(--text-secondary)', fontFamily: "'JetBrains Mono',monospace" }}>
                {Math.max(Number(competition?.mvpCount || 0), mvpCount)} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>lần MVP</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                {(mvpCount > 0 || Number(competition?.mvpCount || 0) > 0) ? (
                  competition?.currentStreak > 0 ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Flame size={12} color="#f97316" /> Chuỗi phong độ: {competition.currentStreak}
                    </span>
                  ) : (
                    'Duy trì thi đấu ổn định'
                  )
                ) : (
                  'Chưa có danh hiệu MVP mùa giải'
                )}
              </div>
            </div>
          </div>

          {/* Nút Chuyển Đến Bảng Xếp Hạng */}
          <div style={{ ...CARD, padding: 18, background: 'rgba(180,83,9,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Xem đối chiếu thứ hạng toàn diện trên Bảng Xếp Hạng</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>So sánh điểm số cùng đồng đội trong Đội và toàn thể công ty</div>
            </div>
            <Link
              to="/leaderboard?scope=members&period=season"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', background: 'var(--text-primary)', color: 'var(--surface)',
                fontSize: 12, fontWeight: 600, textDecoration: 'none',
              }}
            >
              Xem Bảng Xếp Hạng <ExternalLink size={13} />
            </Link>
          </div>
        </div>
      )}

      {/* ── TAB 3: NGHIỆP VỤ & ĐÓNG GÓP THEO VAI TRÒ ── */}
      {activeTab === 'work' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* PHÂN HỆ YOUTUBE (Nếu là Quản lý kênh hoặc có context YouTube) */}
          {youtubeSummary && (
            <div style={{ ...CARD, padding: 20, borderLeft: '4px solid #dc2626' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tv size={18} color="#dc2626" />
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.3, color: 'var(--text-primary)' }}>
                    Sản Lượng Truyền Thông YouTube ({youtubeSummary.teamName})
                  </h3>
                </div>
                <Link to="/youtube" style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  YouTube Studio <ExternalLink size={12} />
                </Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div style={{ padding: 12, background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.1)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Tổng Lượt Xem Kênh</div>
                  <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2, color: '#dc2626', marginTop: 2, fontFamily: "'JetBrains Mono',monospace" }}>
                    {fmtNum(youtubeSummary.totalViews)}
                  </div>
                </div>
                <div style={{ padding: 12, background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.06)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Người Đăng Ký</div>
                  <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2, color: 'var(--text-primary)', marginTop: 2, fontFamily: "'JetBrains Mono',monospace" }}>
                    {fmtNum(youtubeSummary.totalSubscribers)}
                  </div>
                </div>
                <div style={{ padding: 12, background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.06)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Kênh Quản Lý</div>
                  <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2, color: 'var(--text-primary)', marginTop: 2 }}>
                    {youtubeSummary.channelsCount} kênh
                  </div>
                </div>
                <div style={{ padding: 12, background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.06)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Tăng Trưởng 30 Ngày</div>
                  <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2, color: youtubeSummary.viewsGrowth30dPct !== null && youtubeSummary.viewsGrowth30dPct !== undefined ? '#16a34a' : 'var(--text-muted)', marginTop: 2 }}>
                    {youtubeSummary.viewsGrowth30dPct !== null && youtubeSummary.viewsGrowth30dPct !== undefined
                      ? `${Number(youtubeSummary.viewsGrowth30dPct) >= 0 ? '+' : ''}${Number(youtubeSummary.viewsGrowth30dPct).toFixed(1)}%`
                      : '—'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PHÂN HỆ SẢN XUẤT NỘI DUNG (PRODUCTION) */}
          {isEditor && (
            <div style={{ ...CARD, padding: 20, borderLeft: '4px solid var(--accent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Video size={18} color="var(--accent)" />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.3, color: 'var(--text-primary)' }}>
                  Nhiệm Vụ Sản Xuất Video & Biên Tập (Editor Workspace)
                </h3>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                Thành viên đảm nhiệm vai trò <strong>{jobTitle}</strong> tại phòng ban <strong>{department}</strong>.
                Thực hiện các quy trình: Duyệt kịch bản (Script Approved) $\rightarrow$ Biên tập video (Edit Approved) $\rightarrow$ Kiểm soát chất lượng (QC Passed) $\rightarrow$ Xuất bản nội dung.
              </div>
            </div>
          )}

          {/* PHÂN HỆ ĐỘI NHÓM (Dành cho Trưởng phòng / Manager) */}
          {isManager && team && (
            <div style={{ ...CARD, padding: 20, borderLeft: '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Users size={18} color="#f59e0b" />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.3, color: 'var(--text-primary)' }}>
                  Quản Trị Đội Nhóm: {team.name}
                </h3>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                Chịu trách nhiệm quản lý trực tiếp đội ngũ và chỉ đạo sản lượng thi đấu của <strong>{team.name}</strong>.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: LỊCH SỬ MÙA GIẢI (HISTORICAL SEASONS & TEAM INTEGRITY) ── */}
      {activeTab === 'history' && (
        <div style={{ ...CARD, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(15,23,42,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.3, color: 'var(--text-primary)' }}>
                Hồ Sơ Thi Đấu Qua Các Mùa Giải (Season Participation History)
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Bảo toàn lịch sử đội nhóm tại thời điểm thi đấu (Bất biến theo thời gian)
              </span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: 'rgba(15,23,42,0.02)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Mùa Giải</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Đội Thuộc Về (Lúc Thi Đấu)</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Thứ Hạng</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Điểm Tích Lũy</th>
                </tr>
              </thead>
              <tbody>
                {historicalSeasons.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
                      Chưa ghi nhận dữ liệu thi đấu mùa giải trước đó.
                    </td>
                  </tr>
                ) : (
                  historicalSeasons.map((h, i) => (
                    <tr key={h.seasonId || i} style={{ borderBottom: '1px solid rgba(15,23,42,0.04)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Season #{h.seasonId}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--accent)' }}>
                        {h.teamName || 'Đội độc lập'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px', fontSize: 11, fontWeight: 600,
                          background: h.rank === 1 ? '#fef3c7' : 'rgba(15,23,42,0.06)',
                          color: h.rank === 1 ? 'var(--accent)' : 'var(--text-primary)',
                        }}>
                          #{h.rank}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: 'var(--text-primary)' }}>
                        {fmtNum(h.points)} pts
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </TabTransition>

      {/* Hidden File Input for 6-Slot Gallery Upload */}
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleGalleryFileChange}
      />

      {/* Lightbox / Fullscreen Image Preview Modal */}
      {previewImage && (
        <div
          className="modal-backdrop-enter"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="modal-dialog-enter"
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: 'var(--text-primary)',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                zIndex: 10,
                background: 'rgba(15,23,42,0.85)',
                color: 'var(--surface)',
                border: '1px solid rgba(255,255,255,0.2)',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Đóng (ESC)"
            >
              <X size={18} />
            </button>
            <img
              src={previewImage}
              alt="Xem ảnh lớn"
              style={{
                maxWidth: '85vw',
                maxHeight: '75vh',
                display: 'block',
                objectFit: 'contain',
              }}
            />
            <div
              style={{
                padding: '10px 16px',
                background: 'var(--text-primary)',
                color: 'var(--surface)',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)' }}>
                <Sparkles size={14} /> Bộ Sưu Tập Ảnh Hoạt Động & Làm Việc
              </span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                style={{
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: 'none',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
