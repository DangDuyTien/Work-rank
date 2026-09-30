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
  setStoredAvatar,
  removeStoredAvatar,
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
  Save,
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
import JobTitleBadge, { CATEGORIZED_JOB_TITLES, CATEGORIZED_DEPARTMENTS } from '../components/JobTitleBadge';
import ProfileErrorBoundary from '../components/ProfileErrorBoundary';
import usePageVisibility from '../hooks/usePageVisibility';
import { TabTransition, PageTransitionSkeleton } from '../components/ui';

/* =========================================================================
 * STYLES & THEME CONSTANTS (WorkRank Corporate Design System)
 * ========================================================================= */

const CARD = {
  background: '#ffffff',
  border: '1px solid rgba(15,23,42,0.08)',
  borderRadius: 6,
  boxShadow: 'none',
};

const STATUS_CONFIG = {
  active:   { label: 'Đang làm việc', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', color: '#16a34a', dot: '#22c55e' },
  online:   { label: 'Trực tuyến',    bg: 'rgba(8,145,178,0.12)', border: 'rgba(8,145,178,0.35)', color: '#0891b2', dot: '#06b6d4' },
  idle:     { label: 'Tạm nghỉ',      bg: 'rgba(234,179,8,0.14)', border: 'rgba(234,179,8,0.35)', color: '#ca8a04', dot: '#eab308' },
  offline:  { label: 'Ngoại tuyến',   bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)', color: '#64748b', dot: '#94a3b8' },
  inactive: { label: 'Tạm khóa',      bg: 'rgba(220,38,38,0.12)', border: 'rgba(220,38,38,0.35)', color: '#dc2626', dot: '#ef4444' },
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
  verified: { label: 'Đã xác minh', desc: 'Tài khoản nhân sự đã xác thực chính thức', icon: BadgeCheck, color: '#b45309' },
  dev:      { label: 'Kỹ thuật / Dev', desc: 'Đội ngũ phát triển và kỹ thuật hệ thống', icon: ShieldCheck, color: '#0891b2' },
  champion: { label: 'Vô địch giải đấu', desc: 'Quán quân mùa giải / Giải vô địch năm', icon: Trophy, color: '#d97706' },
  mvp:      { label: 'Nhân viên xuất sắc', desc: 'Danh hiệu MVP được ban quản trị vinh danh', icon: Sparkles, color: '#7c3aed' },
};

const DEFAULT_GALLERY_IMAGES = [
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=360&q=80',
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
  const { user: authUser, setUser: setAuthUser, isAdmin } = useAuth();
  const toast = useToast();
  const pageVisible = usePageVisibility();

  const targetUserId = routeUserId ? Number(routeUserId) : authUser?.id;
  const isSelf = authUser?.id && Number(authUser.id) === Number(targetUserId);
  const canEdit = isSelf || isAdmin;

  // Data states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profileData, setProfileData] = useState(null);
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

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    jobTitle: '',
    department: '',
    teamId: '',
    role: '',
    status: '',
    bio: '',
    phone: '',
    isVerified: false,
    isDev: false,
    avatarData: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');

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
    if (!silent) setLoading(true);
    setError(null);

    try {
      const res = await usersApi.get(targetUserId);
      setProfileData(res);
      setAvatarImgError(false);

      // Load Likes
      try {
        const likeRes = await usersApi.profileLikes(targetUserId);
        setLikesCount(Number(likeRes.data?.totalLikes || 0));
        setHasLiked(Boolean(likeRes.data?.viewerHasLiked));
      } catch (e) {
        // Silent fail
      }

      // Load Gallery
      try {
        const galRes = await usersApi.gallery(targetUserId);
        setGalleryImages(galRes.data || []);
      } catch (e) {
        // Silent fail
      }

      // Populate edit form
      const u = res.data || {};
      const userAvatar = getUserAvatar(u, targetUserId) || u.avatarData || '';
      setEditForm({
        name: u.name || '',
        email: u.email || '',
        jobTitle: u.jobTitle || u.job_title || 'Nhân viên',
        department: u.department || 'Media & Content',
        teamId: u.teamId ? String(u.teamId) : '',
        role: u.role || 'user',
        status: u.status || 'active',
        bio: u.bio || '',
        phone: u.phone || '',
        isVerified: Boolean(u.isVerified || u.verified),
        isDev: Boolean(u.isDev),
        avatarData: userAvatar,
      });
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

  // Handle Save Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess('');
    setSaveError('');

    try {
      const payload = {
        name: editForm.name,
        bio: editForm.bio,
        phone: editForm.phone,
      };

      // Nếu là Admin thì gửi thêm các trường nhân sự
      if (isAdmin) {
        payload.jobTitle = editForm.jobTitle;
        payload.department = editForm.department;
        payload.teamId = editForm.teamId ? Number(editForm.teamId) : null;
        payload.role = editForm.role;
        payload.status = editForm.status;
        payload.isVerified = editForm.isVerified;
        payload.isDev = editForm.isDev;
        if (editForm.email) payload.email = editForm.email;
      }

      await usersApi.update(targetUserId, payload);

      // Cập nhật avatar nếu có thay đổi
      if (editForm.avatarData !== undefined) {
        await usersApi.updateProfilePreferences(targetUserId, { avatarData: editForm.avatarData || null });
        if (isSelf) {
          if (editForm.avatarData) setStoredAvatar(targetUserId, editForm.avatarData);
          else removeStoredAvatar(targetUserId);
          if (setAuthUser) {
            setAuthUser((prev) => (prev ? { ...prev, avatarData: editForm.avatarData || null } : prev));
          }
        }
        setAvatarImgError(false);
      }

      toast.success('Cập nhật hồ sơ thành công!');
      setSaveSuccess('Cập nhật hồ sơ thành công!');
      setTimeout(() => {
        setShowEditModal(false);
        setSaveSuccess('');
        loadProfile(true);
      }, 700);
    } catch (err) {
      const errMsg = parseApiError(err, 'Không thể lưu hồ sơ.');
      setSaveError(errMsg);
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  // Avatar file upload handler with automatic client-side compression
  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSaveError('');
      const base64 = await compressImage(file, 400, 400, 0.85);
      setEditForm((prev) => ({ ...prev, avatarData: base64 }));
    } catch (err) {
      alert(err.message || 'Lỗi khi xử lý hình ảnh avatar');
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
          <div style={{ fontSize: 20, fontWeight: 900, color: '#dc2626', marginBottom: 8 }}>
            Không tìm thấy nhân viên
          </div>
          <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 16px' }}>{error || 'Nhân viên không tồn tại hoặc đã bị xóa.'}</p>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '8px 16px', background: '#0f172a', color: '#fff', border: 'none',
              fontSize: 12, fontWeight: 800, cursor: 'pointer',
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
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '16px 16px 48px', fontFamily: "'JetBrains Mono', monospace" }}>
        {/* ── BACK BUTTON ── */}
      <div style={{ marginBottom: 14 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none', color: '#64748b',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0,
          }}
        >
          <ChevronLeft size={16} /> Quay lại
        </button>
      </div>

      {/* ── PROFILE HERO (THIẾT KẾ RỘNG & 6 KHUNG ẢNH HOẠT ĐỘNG GỐC) ── */}
      <section
        className="profile-hero"
        style={{
          background: '#ffffff',
          border: '1px solid rgba(15,23,42,0.08)',
          borderRadius: 6,
          boxShadow: 'none',
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
                border: '3px solid #ffffff',
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
                      background: '#b45309',
                      color: '#ffffff',
                      fontSize: 42,
                      fontWeight: 900,
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
                border: '3px solid #ffffff',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
              title={statusTheme.label}
            />
          </div>

          <div className="profile-identity-copy">
            <div className="profile-name-line" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                {user.name || `User #${targetUserId}`}
              </h1>
              {isVerified && <VerifiedBadge size={22} />}
              {isDev && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: '#ecfeff',
                    color: '#0891b2',
                    border: '1px solid rgba(8,145,178,0.25)',
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
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: '#fef3c7',
                    color: '#b45309',
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
                    fontWeight: 900,
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
              <span style={{ fontWeight: 800, color: '#475569' }}>
                {department}
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ fontWeight: 800, color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Users size={14} color="#64748b" /> {team?.name || 'Chưa vào Team'}
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ color: '#64748b', fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
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
                  fontWeight: 800,
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
                    color: hasLiked ? '#dc2626' : '#64748b',
                    fontSize: 11,
                    fontWeight: 800,
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
                  onClick={() => setShowEditModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 14px',
                    borderRadius: 6,
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  <Edit3 size={12} />
                  Chỉnh Sửa Hồ Sơ
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
                onClick={() => setPreviewImage(imageUrl)}
                title={`Ảnh #${index + 1} - Bấm để xem ảnh phóng to`}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setPreviewImage(imageUrl);
                  }
                }}
              >
                {/* Backdrop ambient blur for full contain without black bars */}
                <img
                  className="profile-gallery-backdrop"
                  src={imageUrl}
                  alt=""
                  aria-hidden="true"
                  onError={() => {
                    setImgErrors((prev) => ({ ...prev, [index]: true }));
                  }}
                />

                {/* Main foreground image (contain = 100% full view, no crop, no stretch) */}
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
                    <button
                      type="button"
                      className="profile-gallery-action-btn"
                      style={{ background: 'rgba(15,23,42,0.85)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImage(imageUrl);
                      }}
                      title="Xem ảnh phóng to"
                    >
                      <ExternalLink size={12} />
                      <span>Xem lớn</span>
                    </button>
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
          background: '#ffffff',
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
                background: isActive ? '#b45309' : 'transparent',
                color: isActive ? '#ffffff' : '#64748b',
                fontSize: 12, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <TabIcon size={14} color={isActive ? '#ffffff' : 'currentColor'} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span style={{
                  fontSize: 9, fontWeight: 900, padding: '1px 5px',
                  borderRadius: 4,
                  background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.06)',
                  color: isActive ? '#ffffff' : '#64748b',
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
                <Shield size={16} color="#b45309" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#0f172a' }}>
                  Thông Tin Nhân Sự & Chức Danh
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(15,23,42,0.04)', paddingBottom: 8 }}>
                  <span style={{ color: '#64748b' }}>Huy hiệu chức danh:</span>
                  <JobTitleBadge jobTitle={jobTitle} size="xs" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(15,23,42,0.04)', paddingBottom: 8 }}>
                  <span style={{ color: '#64748b' }}>Phòng ban:</span>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>{department}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(15,23,42,0.04)', paddingBottom: 8 }}>
                  <span style={{ color: '#64748b' }}>Đội nhóm:</span>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>{team?.name || 'Chưa tham gia'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(15,23,42,0.04)', paddingBottom: 8 }}>
                  <span style={{ color: '#64748b' }}>Quyền hệ thống (RBAC):</span>
                  <span style={{ fontWeight: 800, color: user.role === 'admin' ? '#dc2626' : '#64748b', textTransform: 'uppercase' }}>{user.role}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 4 }}>
                  <span style={{ color: '#64748b' }}>Mã nhân viên (ID):</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800 }}>#{user.id}</span>
                </div>
              </div>
            </div>

            {/* Cột 2: Thông tin liên hệ & Bio */}
            <div style={{ ...CARD, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Mail size={16} color="#16a34a" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#0f172a' }}>
                  Liên Hệ & Tiểu Sử
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(15,23,42,0.04)', paddingBottom: 8 }}>
                  <Mail size={14} color="#64748b" />
                  <span style={{ color: '#64748b' }}>Email:</span>
                  <span style={{ fontWeight: 800, color: '#0f172a', marginLeft: 'auto' }}>{user.email || '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(15,23,42,0.04)', paddingBottom: 8 }}>
                  <Phone size={14} color="#64748b" />
                  <span style={{ color: '#64748b' }}>Điện thoại:</span>
                  <span style={{ fontWeight: 800, color: '#0f172a', marginLeft: 'auto' }}>{user.phone || 'Chưa cập nhật'}</span>
                </div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: 4 }}>Giới thiệu / Trách nhiệm công việc:</span>
                  <div style={{
                    padding: '8px 12px', background: 'rgba(15,23,42,0.03)', border: '1px solid rgba(15,23,42,0.06)',
                    fontSize: 12, color: '#334155', lineHeight: 1.5, minHeight: 48,
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
              <Award size={18} color="#b45309" />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#0f172a' }}>
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
                  <div style={{ fontWeight: 800, fontSize: 12, color: isVerified ? '#b45309' : '#64748b' }}>
                    {isVerified ? 'Tài Khoản Đã Xác Thực' : 'Chưa Cấp Tích Xanh'}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Được Ban Quản Trị cấp tích xanh định danh</div>
                </div>
              </div>

              {/* 2. Dev */}
              <div style={{
                padding: '12px 14px',
                background: isDev ? 'rgba(8,145,178,0.06)' : 'rgba(15,23,42,0.02)',
                border: isDev ? '1px solid rgba(8,145,178,0.25)' : '1px solid rgba(15,23,42,0.06)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Code size={20} color={isDev ? '#0891b2' : '#94a3b8'} strokeWidth={2.5} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 12, color: isDev ? '#0891b2' : '#64748b' }}>
                    {isDev ? 'Kỹ Sư Phát Triển (Dev)' : 'Không Thuộc Dev Team'}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Đội ngũ phát triển và kỹ thuật 3winmedia</div>
                </div>
              </div>

              {/* 3. Champion */}
              <div style={{
                padding: '12px 14px',
                background: isChampion ? 'rgba(245,158,11,0.08)' : 'rgba(15,23,42,0.02)',
                border: isChampion ? '1px solid rgba(245,158,11,0.28)' : '1px solid rgba(15,23,42,0.06)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Trophy size={20} color={isChampion ? '#d97706' : '#94a3b8'} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 12, color: isChampion ? '#d97706' : '#64748b' }}>
                    {isChampion ? `Vô Địch Giải Đấu (${championCount} Cúp)` : 'Chưa Có Cúp Vô Địch'}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Quán quân mùa giải / Grand Championship</div>
                </div>
              </div>

              {/* 4. MVP */}
              <div style={{
                padding: '12px 14px',
                background: isMvp ? 'rgba(180,83,9,0.08)' : 'rgba(0,0,0,0.02)',
                border: isMvp ? '1px solid rgba(180,83,9,0.28)' : '1px solid rgba(0,0,0,0.06)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Sparkles size={20} color={isMvp ? '#b45309' : '#94a3b8'} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 12, color: isMvp ? '#b45309' : '#64748b' }}>
                    {isMvp ? `Nhân Viên Xuất Sắc (${mvpCount} MVP)` : 'Chưa Có Danh Hiệu MVP'}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Vinh danh thành tích đóng góp nổi bật</div>
                </div>
              </div>
            </div>

            {/* Chi tiết danh sách giải thưởng nếu có */}
            {awards.length > 0 && (
              <div style={{ marginTop: 14, borderTop: '1px solid rgba(15,23,42,0.06)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>Danh Sách Các Giải Thưởng Đã Vinh Danh:</div>
                {awards.map((a) => (
                  <div key={a.id} style={{ padding: '8px 12px', background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                    <div>
                      <strong style={{ color: a.awardType === 'champion' ? '#b45309' : '#6d28d9', marginRight: 6 }}>
                        {a.title}
                      </strong>
                      <span style={{ color: '#475569' }}>— {a.reason}</span>
                    </div>
                    <span style={{ color: '#94a3b8', whiteSpace: 'nowrap', marginLeft: 12 }}>
                      {a.awardedAt ? new Date(a.awardedAt).toLocaleDateString('vi-VN') : ''}
                    </span>
                  </div>
                ))}
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
            <div style={{ ...CARD, padding: 18, borderLeft: '4px solid #b45309' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#b45309', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Swords size={13} color="#b45309" /> Đấu Trường Mùa Giải
                </span>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#b45309' }}>
                  {competition?.currentSeasonRank ? `HẠNG #${competition.currentSeasonRank}` : 'Chưa xếp hạng'}
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', fontFamily: "'JetBrains Mono',monospace" }}>
                {fmtNum(competition?.currentSeasonScore || 0)} <span style={{ fontSize: 12, color: '#64748b' }}>pts</span>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Tổng điểm thi đấu trong mùa hiện tại
              </div>
            </div>

            {/* GRAND CHAMPIONSHIP 2026 */}
            <div style={{ ...CARD, padding: 18, borderLeft: '4px solid #d97706' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#d97706', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Crown size={13} color="#d97706" /> Grand Championship
                </span>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#d97706' }}>
                  {competition?.grandRank ? `HẠNG #${competition.grandRank}` : 'Chưa xếp hạng'}
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#d97706', fontFamily: "'JetBrains Mono',monospace" }}>
                {fmtNum(competition?.grandPoints || 0)} <span style={{ fontSize: 12, color: '#64748b' }}>GP</span>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Điểm tích lũy vô địch toàn năm 2026
              </div>
            </div>

            {/* SỐ MÙA VÔ ĐỊCH */}
            <div style={{ ...CARD, padding: 18, borderLeft: '4px solid #16a34a' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Trophy size={13} color="#16a34a" /> Mùa Vô Địch & Top 3
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', fontFamily: "'JetBrains Mono',monospace" }}>
                {competition?.seasonWins || 0} <span style={{ fontSize: 12, color: '#64748b' }}>vô địch / {competition?.podiumCount || 0} top 3</span>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Thành tích ghi nhận trên Bảng Vàng
              </div>
            </div>

            {/* MVP & PHONG ĐỘ */}
            <div style={{ ...CARD, padding: 18, borderLeft: '4px solid #b45309' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#b45309', textTransform: 'uppercase', marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={13} color="#b45309" /> Danh Hiệu MVP Mùa
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#b45309', fontFamily: "'JetBrains Mono',monospace" }}>
                {competition?.mvpCount || 0} <span style={{ fontSize: 12, color: '#64748b' }}>lần MVP</span>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                {competition?.currentStreak > 0 ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Flame size={12} color="#f97316" /> Chuỗi phong độ: {competition.currentStreak}
                  </span>
                ) : (
                  'Duy trì thi đấu ổn định'
                )}
              </div>
            </div>
          </div>

          {/* Nút Chuyển Đến Bảng Xếp Hạng */}
          <div style={{ ...CARD, padding: 18, background: 'rgba(180,83,9,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Xem đối chiếu thứ hạng toàn diện trên Bảng Xếp Hạng</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>So sánh điểm số cùng đồng đội trong Đội và toàn thể công ty</div>
            </div>
            <Link
              to="/leaderboard?scope=individual"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', background: '#0f172a', color: '#fff',
                fontSize: 12, fontWeight: 800, textDecoration: 'none',
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
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
                    Sản Lượng Truyền Thông YouTube ({youtubeSummary.teamName})
                  </h3>
                </div>
                <Link to="/youtube" style={{ fontSize: 12, fontWeight: 800, color: '#dc2626', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  YouTube Studio <ExternalLink size={12} />
                </Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div style={{ padding: 12, background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.1)' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Tổng Lượt Xem Kênh</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#dc2626', marginTop: 2, fontFamily: "'JetBrains Mono',monospace" }}>
                    {fmtNum(youtubeSummary.totalViews)}
                  </div>
                </div>
                <div style={{ padding: 12, background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.06)' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Người Đăng Ký</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginTop: 2, fontFamily: "'JetBrains Mono',monospace" }}>
                    {fmtNum(youtubeSummary.totalSubscribers)}
                  </div>
                </div>
                <div style={{ padding: 12, background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.06)' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Quy Mô Kênh</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
                    {youtubeSummary.channelsCount} kênh · {youtubeSummary.videosCount} video
                  </div>
                </div>
                <div style={{ padding: 12, background: 'rgba(15,23,42,0.02)', border: '1px solid rgba(15,23,42,0.06)' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Tăng Trưởng 30 Ngày</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#16a34a', marginTop: 2 }}>
                    +{youtubeSummary.viewsGrowth30dPct || 0}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PHÂN HỆ SẢN XUẤT NỘI DUNG (PRODUCTION) */}
          {isEditor && (
            <div style={{ ...CARD, padding: 20, borderLeft: '4px solid #b45309' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Video size={18} color="#b45309" />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
                  Nhiệm Vụ Sản Xuất Video & Biên Tập (Editor Workspace)
                </h3>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
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
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
                  Quản Trị Đội Nhóm: {team.name}
                </h3>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
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
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#0f172a' }}>
                Hồ Sơ Thi Đấu Qua Các Mùa Giải (Season Participation History)
              </h3>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                Bảo toàn lịch sử đội nhóm tại thời điểm thi đấu (Bất biến theo thời gian)
              </span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(15,23,42,0.06)', background: 'rgba(15,23,42,0.02)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Mùa Giải</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Đội Thuộc Về (Lúc Thi Đấu)</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Thứ Hạng</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Điểm Tích Lũy</th>
                </tr>
              </thead>
              <tbody>
                {historicalSeasons.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 36, textAlign: 'center', color: '#94a3b8' }}>
                      Chưa ghi nhận dữ liệu thi đấu mùa giải trước đó.
                    </td>
                  </tr>
                ) : (
                  historicalSeasons.map((h, i) => (
                    <tr key={h.seasonId || i} style={{ borderBottom: '1px solid rgba(15,23,42,0.04)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0f172a' }}>
                        Season #{h.seasonId}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#b45309' }}>
                        {h.teamName || 'Đội độc lập'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px', fontSize: 11, fontWeight: 900,
                          background: h.rank === 1 ? '#fef3c7' : 'rgba(15,23,42,0.06)',
                          color: h.rank === 1 ? '#b45309' : '#0f172a',
                        }}>
                          #{h.rank}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, fontFamily: "'JetBrains Mono',monospace", color: '#0f172a' }}>
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

      {/* ── MODAL CHỈNH SỬA HỒ SƠ ── */}
      {showEditModal && (
        <div
          className="modal-backdrop-enter"
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999,
            background: 'rgba(15,23,42,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="modal-dialog-enter"
            style={{
              ...CARD,
              width: '100%', maxWidth: 540,
              maxHeight: '90vh', overflowY: 'auto',
              padding: 24, background: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid rgba(15,23,42,0.08)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit3 size={18} color="#b45309" />
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                  {isAdmin ? 'Quản Trị Hồ Sơ Nhân Sự (Admin)' : 'Cập Nhật Thông Tin Cá Nhân'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {saveSuccess && (
              <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#16a34a', fontSize: 12, fontWeight: 800, marginBottom: 14 }}>
                {saveSuccess}
              </div>
            )}
            {saveError && (
              <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', color: '#dc2626', fontSize: 12, fontWeight: 800, marginBottom: 14 }}>
                {saveError}
              </div>
            )}

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Tên hiển thị */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
                  Họ và Tên Nhân Viên *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid rgba(15,23,42,0.15)', outline: 'none' }}
                />
              </div>

              {/* Vị trí công tác (Job Title) */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
                  Vị Trí Công Tác / Chức Danh {!isAdmin && <span style={{ color: '#94a3b8' }}>(Admin quản lý)</span>}
                </label>
                {isAdmin ? (
                  <select
                    value={editForm.jobTitle}
                    onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid rgba(15,23,42,0.15)', outline: 'none', background: '#fff', cursor: 'pointer' }}
                  >
                    {CATEGORIZED_JOB_TITLES.map((group) => (
                      <optgroup key={group.category} label={group.category}>
                        {group.titles.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    value={editForm.jobTitle}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 12, background: 'rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.1)', color: '#64748b' }}
                  />
                )}
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Huy hiệu:</span>
                  <JobTitleBadge jobTitle={editForm.jobTitle} size="xs" />
                </div>
              </div>

              {/* Phòng ban (Department) */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
                  Phòng Ban {!isAdmin && <span style={{ color: '#94a3b8' }}>(Admin quản lý)</span>}
                </label>
                {isAdmin ? (
                  <select
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid rgba(15,23,42,0.15)', outline: 'none', background: '#fff', cursor: 'pointer' }}
                  >
                    <optgroup label="Phòng ban chính thức">
                      {CATEGORIZED_DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </optgroup>
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    value={editForm.department}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 12, background: 'rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.1)', color: '#64748b' }}
                  />
                )}
              </div>

              {/* Số điện thoại */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
                  Số Điện Thoại Liên Hệ
                </label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="09..."
                  style={{ width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid rgba(15,23,42,0.15)', outline: 'none' }}
                />
              </div>

              {/* Bio */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
                  Tiểu Sử & Trách Nhiệm Công Việc
                </label>
                <textarea
                  rows={3}
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  placeholder="Mô tả tóm tắt kinh nghiệm và trách nhiệm chuyên môn..."
                  style={{ width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid rgba(15,23,42,0.15)', outline: 'none', resize: 'vertical' }}
                />
              </div>

              {/* Ảnh đại diện Avatar */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>
                  Ảnh Đại Diện
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: '2px solid #b45309',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#e0f2fe',
                      flexShrink: 0,
                    }}
                  >
                    {editForm.avatarData ? (
                      <img
                        src={editForm.avatarData}
                        alt="Avatar Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: 18, fontWeight: 900, color: '#b45309' }}>
                        {initialsFromName(editForm.name || user.name)}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFile}
                      style={{ fontSize: 11, color: '#64748b' }}
                    />
                    {editForm.avatarData && (
                      <button
                        type="button"
                        onClick={() => setEditForm((prev) => ({ ...prev, avatarData: '' }))}
                        style={{
                          alignSelf: 'flex-start',
                          padding: '2px 8px',
                          fontSize: 10,
                          fontWeight: 800,
                          color: '#dc2626',
                          background: '#fee2e2',
                          border: '1px solid #fecaca',
                          cursor: 'pointer',
                        }}
                      >
                        Xóa ảnh đại diện (dùng chữ cái đầu)
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Các trường quản trị chỉ Admin mới có */}
              {isAdmin && (
                <div style={{ marginTop: 8, padding: 12, background: 'rgba(15,23,42,0.03)', border: '1px solid rgba(15,23,42,0.1)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#dc2626', textTransform: 'uppercase' }}>
                    Quyền Quản Trị Hệ Thống (Admin Only)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: '#64748b', marginBottom: 2 }}>Phân Quyền (Role)</label>
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        style={{ width: '100%', padding: '6px', fontSize: 11, border: '1px solid #cbd5e1' }}
                      >
                        <option value="user">User</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: '#64748b', marginBottom: 2 }}>Trạng Thái</label>
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                        style={{ width: '100%', padding: '6px', fontSize: 11, border: '1px solid #cbd5e1' }}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        id="isVerifiedCheck"
                        checked={editForm.isVerified}
                        onChange={(e) => setEditForm({ ...editForm, isVerified: e.target.checked })}
                      />
                      <label htmlFor="isVerifiedCheck" style={{ fontSize: 12, fontWeight: 800, color: '#b45309', cursor: 'pointer' }}>
                        Cấp Tích Xanh Chính Thức (Verified Badge)
                      </label>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        id="isDevCheck"
                        checked={editForm.isDev}
                        onChange={(e) => setEditForm({ ...editForm, isDev: e.target.checked })}
                      />
                      <label htmlFor="isDevCheck" style={{ fontSize: 12, fontWeight: 800, color: '#0891b2', cursor: 'pointer' }}>
                        Cấp Huy Hiệu Kỹ Thuật (Developer Badge)
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(15,23,42,0.15)', color: '#64748b', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '8px 20px', background: '#b45309', color: '#fff', border: 'none',
                    fontSize: 12, fontWeight: 900, cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Save size={14} />
                  {saving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              background: '#0f172a',
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
                color: '#ffffff',
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
                background: '#0f172a',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 800,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#b45309' }}>
                <Sparkles size={14} /> Bộ Sưu Tập Ảnh Hoạt Động & Làm Việc
              </span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                style={{
                  background: 'transparent',
                  color: '#94a3b8',
                  border: 'none',
                  fontSize: 11,
                  fontWeight: 700,
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
