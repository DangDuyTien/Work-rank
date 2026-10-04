import React, { useState } from 'react';
import { ArrowUpRight, Users, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import VerifiedBadge from './VerifiedBadge';
import { initialsFromName } from '../utils/avatar';

export function recognitionState(data, type) {
  // A name or score alone is never evidence of an official award.
  const state = data?.provenance?.[type]?.state;
  return state === 'official' || state === 'projected' ? state : 'none';
}

export function RecognitionStatus({ state, type }) {
  const label = state === 'official'
    ? type === 'mvp' ? 'MVP đã xác nhận' : 'Kết quả đã chốt'
    : state === 'projected'
      ? type === 'mvp' ? 'Ứng viên · chưa xác nhận' : 'Đang dẫn đầu · chưa chốt'
      : 'Chưa có ghi nhận';
  return <span className={`public-recognition-status is-${state}`}><i aria-hidden="true" />{label}</span>;
}

export function RecognitionPortrait({ name, image, type, imageOnly = false }) {
  const [failedImage, setFailedImage] = useState(null);
  const hasImage = Boolean(image && image !== failedImage);
  return (
    <div className={`public-recognition-portrait is-${type} ${hasImage ? 'has-image' : ''}`}>
      {hasImage ? (
        <img src={image} alt={name || (type === 'mvp' ? 'Cá nhân' : 'Đội nhóm')} onError={() => setFailedImage(image)} />
      ) : (
        <>
          <span className="public-recognition-initials" aria-hidden="true">
            {name ? initialsFromName(name) : type === 'mvp' ? <UserRound size={72} /> : <Users size={72} />}
          </span>
          {!imageOnly && <span className="public-recognition-photo-note">{name ? 'Nhận diện bằng tên · chưa có ảnh' : 'Chưa có hồ sơ ghi nhận'}</span>}
        </>
      )}
      {!imageOnly && <span className="public-recognition-photo-label">{type === 'mvp' ? 'Cá nhân' : 'Đội nhóm'}<ArrowUpRight size={17} aria-hidden="true" /></span>}
    </div>
  );
}

export function RecognitionName({ name, verified }) {
  return <span className="public-recognition-name">{name}{verified && <VerifiedBadge size={18} />}</span>;
}

export function RecognitionLink({ to, children, className = '' }) {
  return <Link className={`public-editorial-link ${className}`} to={to}>{children}<ArrowUpRight size={18} aria-hidden="true" /></Link>;
}

export function SpotlightFeedback({ loading, error, retry }) {
  if (loading) return <div className="public-recognition-feedback" role="status"><span className="public-recognition-loader" aria-hidden="true" />Đang tải ghi nhận mùa giải…</div>;
  if (error) return <div className="public-recognition-feedback" role="alert"><span>Chưa tải được ghi nhận mùa giải.</span><button type="button" onClick={retry}>Thử lại <ArrowUpRight size={15} /></button></div>;
  return null;
}

export function recognitionSource(source) {
  if (source === 'UserRecognition') return 'Hồ sơ ghi nhận mùa giải';
  if (source?.startsWith('SeasonFrozenResult')) return 'Kết quả mùa giải đã chốt';
  if (source === 'SeasonLeaderboardProjection') return 'Bảng xếp hạng hiện tại';
  return source ? 'Bản ghi mùa giải' : 'Chưa có nguồn xác nhận';
}

export function displayScore(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value))
    ? Number(value).toLocaleString('vi-VN')
    : '—';
}
