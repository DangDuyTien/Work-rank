import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Star,
  Award,
  X,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  User as UserIcon,
  Flame,
  Calendar,
  Layers,
  Shield,
  Loader2,
  Trash2,
} from 'lucide-react';
import { competition, users as usersApi } from '../services/api';
import { useToast, useConfirm } from '../context/UiContext';
import { parseApiError } from '../utils/errors';
import { invalidateCache } from '../services/cache';
import VerifiedBadge from './VerifiedBadge';

const CARD = {
  background: 'var(--surface)',
  border: '1px solid rgba(15,23,42,0.12)',
  boxShadow: '0 4px 16px rgba(15,23,42,0.06)',
};

const SEASON_STATUS_LABELS = {
  DRAFT: 'Bản nháp',
  SCHEDULED: 'Đã lên lịch',
  ACTIVE: 'Đang diễn ra',
  PAUSED: 'Tạm dừng',
  CALCULATING: 'Đang chốt',
  FINISHED: 'Đã kết thúc',
  ARCHIVED: 'Lưu trữ',
};

function seasonOptionLabel(season = {}) {
  const source = season.startAt || season.start_at || season.endAt || season.end_at;
  const parsedYear = source ? new Date(source).getFullYear() : NaN;
  const year = Number.isFinite(parsedYear)
    ? parsedYear
    : String(season.name || '').match(/\b(20\d{2})\b/)?.[1];
  const status = SEASON_STATUS_LABELS[season.status] || season.status || 'Chưa xác định';
  return [
    year ? `Năm ${year}` : null,
    season.name || `Mùa #${season.id}`,
    `Mùa #${season.id}`,
    status,
  ].filter(Boolean).join(' · ');
}

export default function MvpCupAwardModal({
  isOpen,
  onClose,
  defaultSeasonId = null,
  onSuccess = () => {},
}) {
  const toast = useToast();
  const confirm = useConfirm();

  const [seasons, setSeasons] = useState([]);
  const [loadingSeasons, setLoadingSeasons] = useState(false);
  const [selectedSeasonId, setSelectedSeasonId] = useState(defaultSeasonId ? String(defaultSeasonId) : '');

  // Preview state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // Form inputs
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [revoking, setRevoking] = useState(false);

  // Load seasons list
  const loadSeasons = useCallback(async () => {
    setLoadingSeasons(true);
    try {
      const list = await competition.adminListMvpSeasons();
      setSeasons(list);
      if (!selectedSeasonId && list.length > 0) {
        // Default to the current season so a new award is not attached to an old archive.
        const bestSeason = list.find((s) => ['ACTIVE', 'PAUSED', 'CALCULATING', 'SCHEDULED'].includes(s.status))
          || list.find((s) => s.status === 'FINISHED')
          || list[0];
        setSelectedSeasonId(String(bestSeason.id));
      }
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể tải danh sách mùa giải'));
    } finally {
      setLoadingSeasons(false);
    }
  }, [selectedSeasonId, toast]);

  useEffect(() => {
    if (isOpen) {
      loadSeasons();
    }
  }, [isOpen, loadSeasons]);

  // Load preview when season changes
  const loadPreview = useCallback(async (seasonId) => {
    if (!seasonId) {
      setPreviewData(null);
      return;
    }
    setPreviewLoading(true);
    try {
      const data = await competition.adminPreviewSeasonMvp(seasonId);
      setPreviewData(data);
      if (data.status === 'READY') {
        setTitle(data.suggestedTitle || '');
        // The preview is evidence for the admin to review. Keep the stored
        // recognition reason explicitly authored instead of silently saving
        // generated narrative.
        setReason('');
      } else {
        setTitle('');
        setReason('');
      }
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể tính toán ứng viên MVP'));
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isOpen && selectedSeasonId) {
      loadPreview(selectedSeasonId);
    }
  }, [isOpen, selectedSeasonId, loadPreview]);

  // Handle Award Submit
  const handleAward = async (e) => {
    e.preventDefault();
    if (!previewData || previewData.status !== 'READY' || !previewData.candidate) {
      toast.warning('Không có ứng viên hợp lệ để trao MVP Cup.');
      return;
    }
    if (!reason.trim()) {
      toast.warning('Vui lòng nhập căn cứ / lý do vinh danh MVP.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await competition.adminAwardMvpCup({
        seasonId: Number(selectedSeasonId),
        userId: Number(previewData.candidate.userId),
        title: title.trim(),
        reason: reason.trim(),
        metadata: {
          score: previewData.candidate.score,
          rank: previewData.candidate.rank,
          eventsCount: previewData.candidate.eventsCount,
          teamId: previewData.candidate.teamId,
          teamName: previewData.candidate.teamName,
        },
      });

      toast.success(
        `🏆 ĐÃ TRAO MVP CUP THÀNH CÔNG cho ${previewData.candidate.name} (Mùa #${selectedSeasonId})!`
      );

      // Invalidate relevant client caches
      invalidateCache('user:profile');
      invalidateCache('rankings');
      invalidateCache('competition');
      invalidateCache('dashboard');
      invalidateCache('public:spotlight');

      onSuccess(res.recognition);
      await loadSeasons();
      await loadPreview(selectedSeasonId);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể trao MVP Cup'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Revoke Award
  const handleRevoke = async () => {
    if (!previewData?.existingAward) return;
    const ok = await confirm({
      title: 'Thu hồi MVP Cup?',
      message: `Bạn có chắc chắn muốn thu hồi MVP Cup của "${previewData.existingAward.userName}" tại Mùa #${selectedSeasonId}? Danh hiệu và số lần MVP sẽ bị trừ tương ứng.`,
      confirmLabel: 'Thu Hồi Ngay',
      confirmVariant: 'danger',
    });
    if (!ok) return;

    setRevoking(true);
    try {
      await usersApi.adminRevokeMVP(previewData.existingAward.id, 'Admin thu hồi MVP Cup qua bảng điều khiển');
      toast.success('Đã thu hồi MVP Cup thành công!');

      invalidateCache('user:profile');
      invalidateCache('rankings');
      invalidateCache('competition');
      invalidateCache('dashboard');

      await loadSeasons();
      await loadPreview(selectedSeasonId);
    } catch (err) {
      toast.error(parseApiError(err, 'Không thể thu hồi MVP Cup'));
    } finally {
      setRevoking(false);
    }
  };

  const [mounted, setMounted] = useState(isOpen);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const timer = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, 240);
      return () => clearTimeout(timer);
    }
  }, [isOpen, mounted]);

  if (!mounted) return null;

  return (
    <div
      className={closing ? 'modal-backdrop-exit' : 'modal-backdrop-enter'}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting && !revoking) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15,23,42,0.72)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <div
        className={closing ? 'modal-dialog-exit' : 'modal-dialog-enter'}
        style={{
          ...CARD,
          width: '100%',
          maxWidth: 620,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 22px',
            background: 'linear-gradient(135deg, var(--text-primary) 0%, #1e293b 100%)',
            color: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid #f59e0b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: 'rgba(245,158,11,0.2)',
                border: '1px solid #f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Trophy size={18} color="#f59e0b" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--surface)', letterSpacing: '-0.02em' }}>
                Hệ Thống Trao MVP Cup Mùa Giải
              </h3>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Xác định quán quân cá nhân xuất sắc & vinh danh bảng vàng
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 22, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Season Selector */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              1. Chọn Mùa Giải Trao MVP:
            </label>
            {loadingSeasons ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                <Loader2 size={14} className="animate-spin" /> Đang tải danh sách mùa giải...
              </div>
            ) : (
              <select
                value={selectedSeasonId}
                onChange={(e) => setSelectedSeasonId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  border: '1px solid var(--border-2)',
                  borderRadius: 4,
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  outline: 'none',
                }}
              >
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {seasonOptionLabel(s)} {s.hasMvpAwarded ? `[ĐÃ TRAO: ${s.mvpAward?.userName}]` : '[CHƯA TRAO]'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Candidate / Award Status Section */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface-soft)', padding: 16 }}>
            {previewLoading ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Loader2 size={16} className="animate-spin" color="#f59e0b" />
                Đang truy xuất bảng điểm & xác định ứng viên Rank #1...
              </div>
            ) : previewData?.status === 'ALREADY_AWARDED' ? (
              /* ALREADY AWARDED STATE */
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, color: 'var(--accent)', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                  <CheckCircle size={15} color="var(--accent)" />
                  Mùa giải này ĐÃ ĐƯỢC TRAO MVP CUP thành công
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 6, padding: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fef3c7', border: '2px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {previewData.existingAward.userAvatar ? (
                      <img src={previewData.existingAward.userAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Trophy size={24} color="#d97706" />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>{previewData.existingAward.userName}</strong>
                      <span style={{ fontSize: 11, background: '#fef3c7', color: 'var(--accent)', padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>
                        MVP #1
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {previewData.existingAward.jobTitle} • {previewData.existingAward.department}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed', marginTop: 4 }}>
                      {previewData.existingAward.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 2 }}>
                      "{previewData.existingAward.reason}"
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                      Trao ngày: {new Date(previewData.existingAward.awardedAt).toLocaleString('vi-VN')}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={handleRevoke}
                    disabled={revoking}
                    style={{
                      background: 'transparent',
                      border: '1px solid #ef4444',
                      color: '#ef4444',
                      padding: '6px 12px',
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 4,
                      cursor: revoking ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Trash2 size={13} /> {revoking ? 'Đang thu hồi...' : 'Thu Hồi MVP Cup Này'}
                  </button>
                </div>
              </div>
            ) : previewData?.status === 'NO_CANDIDATE' ? (
              /* NO CANDIDATE STATE */
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-secondary)' }}>
                <AlertTriangle size={24} color="#f59e0b" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Chưa có ứng viên ghi điểm</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>
                  Mùa giải này chưa phát sinh điểm số từ các hoạt động thi đấu hoặc chưa có thành viên tham gia.
                </div>
              </div>
            ) : previewData?.status === 'READY' ? (
              /* READY TO AWARD STATE */
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={13} color="#f59e0b" /> Ứng viên đoạt giải theo dữ liệu thực tế (Rank #1):
                  </div>
                  {previewData.isTied && (
                    <span style={{ fontSize: 10, background: '#fee2e2', color: 'var(--danger)', padding: '2px 6px', borderRadius: 3, fontWeight: 700 }}>
                      Đồng điểm ({previewData.tiedCount} người)
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid #fde68a', borderRadius: 6, padding: 14, boxShadow: '0 2px 8px rgba(245,158,11,0.08)' }}>
                  <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#fef3c7', border: '2px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {previewData.candidate.avatarData ? (
                      <img src={previewData.candidate.avatarData} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <UserIcon size={24} color="#d97706" />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>{previewData.candidate.name}</strong>
                      {previewData.candidate.isVerified && <VerifiedBadge size={14} />}
                      <span style={{ fontSize: 11, background: '#fef3c7', color: 'var(--accent)', padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>
                        Hạng #1 Toàn Mùa
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {previewData.candidate.jobTitle} • {previewData.candidate.department} • Đội: <strong>{previewData.candidate.teamName}</strong>
                    </div>

                    {/* Stats pills */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 4 }}>
                        🏆 {previewData.candidate.score.toLocaleString()} XP
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--surface-muted)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 4 }}>
                        ⚡ {previewData.candidate.eventsCount} hoạt động
                      </span>
                      {previewData.candidate.lastScoredAt && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', alignSelf: 'center' }}>
                          Ghi điểm cuối: {new Date(previewData.candidate.lastScoredAt).toLocaleTimeString('vi-VN')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {previewData.isTied && (
                  <div style={{ fontSize: 11, color: 'var(--accent)', background: '#fffbeb', border: '1px solid #fde68a', padding: '6px 10px', borderRadius: 4, marginTop: 8 }}>
                    ℹ️ Có {previewData.tiedCount} ứng viên đạt mức điểm bằng nhau. Ứng viên trên được xếp Hạng #1 do đạt điểm sớm hơn theo quy tắc tie-break chính thức.
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Form Fields when READY */}
          {previewData?.status === 'READY' && (
            <form onSubmit={handleAward} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  2. Tiêu Đề Vinh Danh MVP:
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    border: '1px solid var(--border-2)',
                    borderRadius: 4,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  3. Lý Do & Căn Cứ Trao Thưởng:
                </label>
                {previewData.suggestedReason && (
                  <div style={{ marginBottom: 8, padding: '8px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4, color: 'var(--accent-hover)', fontSize: 11, lineHeight: 1.5 }}>
                    <strong>Căn cứ từ dữ liệu:</strong> {previewData.suggestedReason}
                    <button type="button" onClick={() => setReason(previewData.suggestedReason)} style={{ display: 'block', marginTop: 6, padding: 0, border: 0, background: 'transparent', color: 'var(--accent)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      Dùng căn cứ này làm lý do
                    </button>
                  </div>
                )}
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    border: '1px solid var(--border-2)',
                    borderRadius: 4,
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '8px 14px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border-2)',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 20px',
                    background: submitting ? 'var(--text-muted)' : 'linear-gradient(135deg, #d97706 0%, var(--accent) 100%)',
                    color: 'var(--surface)',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    boxShadow: '0 2px 8px rgba(180,83,9,0.3)',
                  }}
                >
                  <Trophy size={14} color="var(--surface)" />
                  {submitting ? 'Đang xác nhận...' : 'Xác Nhận Trao MVP Cup'}
                </button>
              </div>
            </form>
          )}

          {previewData?.status !== 'READY' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 14px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border-2)',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                Đóng
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
