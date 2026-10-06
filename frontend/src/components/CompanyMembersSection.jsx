import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Reveal } from './ui';
import {
  RecognitionName,
  RecognitionPortrait,
  displayScore,
  removeVietnameseDiacritics,
} from './PublicRecognition';

export default function CompanyMembersSection({ items = [], loading = false, error = false, retry }) {
  const frameRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState('pending');
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const count = items.length;
  const currentMember = items[index % (count || 1)] || null;

  // Preload avatars to ensure instantaneous, flicker-free image rendering
  useEffect(() => {
    items.forEach((m) => {
      if (m.avatarData && typeof m.avatarData === 'string') {
        const img = new Image();
        img.src = m.avatarData;
      }
    });
  }, [items]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
      }
    }, {
      threshold: 0.05,
      rootMargin: '120px 0px 120px 0px',
    });
    if (frameRef.current) observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches || document.documentElement.dataset.workrankReduceMotion === 'true');
    const observer = new MutationObserver(update);
    update();
    media.addEventListener('change', update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-workrank-reduce-motion'] });
    return () => { media.removeEventListener('change', update); observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (!loading && visible && phase === 'pending') {
      setPhase(reducedMotion ? 'open' : 'opening');
    }
  }, [loading, visible, reducedMotion, phase]);

  // Guaranteed transition from opening -> open
  useEffect(() => {
    if (phase !== 'opening') return;
    const timer = window.setTimeout(() => setPhase('open'), 700);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // 3.5s display interval between member rotations
  useEffect(() => {
    if (phase !== 'open' || !visible || reducedMotion || count <= 1 || isPaused) return;
    const timer = window.setTimeout(() => setPhase('closing'), 3500);
    return () => window.clearTimeout(timer);
  }, [phase, visible, reducedMotion, count, isPaused, index]);

  // Guaranteed transition from closing -> next member opening
  useEffect(() => {
    if (phase !== 'closing') return;
    const timer = window.setTimeout(() => {
      setIndex((curr) => (curr + 1) % count);
      setPhase('opening');
    }, 480);
    return () => window.clearTimeout(timer);
  }, [phase, count]);

  function handleAnimationEnd(event) {
    if (event.animationName === 'publicPortraitReveal') {
      setPhase('open');
    }
    if (event.animationName === 'publicQuoteCloseRight') {
      setIndex((curr) => (curr + 1) % count);
      setPhase('opening');
    }
  }

  function handleManualNext() {
    if (count <= 1 || phase !== 'open') return;
    setPhase('closing');
  }

  if (!loading && count === 0 && !error) {
    return null;
  }

  const memberName = currentMember ? removeVietnameseDiacritics(currentMember.name) : '';
  const profileUrl = currentMember ? `/users/${currentMember.id || currentMember.userId}` : '/leaderboard';
  const isContentFading = phase === 'closing' && !reducedMotion;

  return (
    <Reveal
      as="section"
      delay={500}
      className="public-season-section public-archive-section public-company-members-section"
      aria-labelledby="company-members-title"
      aria-busy={loading}
    >
      <div className="public-season-heading is-detail">
        <h2 id="company-members-title">
          <span>Tất cả thành viên · 3WIN MEDIA</span>
        </h2>
        <div>
          <p>{count > 0 ? `${count} Nhân sự` : 'Đại gia đình 3Win Media'}</p>
          <span>Gắn kết, cống hiến &amp; cùng phát triển {count > 0 ? `(${index + 1}/${count})` : ''}</span>
        </div>
      </div>

      <div
        className="public-recognition-grid"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <figure
          className="public-featured-person"
          aria-label="Ảnh chân dung xoay vòng thành viên công ty"
        >
          <div
            ref={frameRef}
            className={`public-featured-frame ${phase === 'pending' ? 'is-pending' : phase === 'closing' ? 'is-shutting' : 'is-ready'} ${count > 1 ? 'is-interactive' : ''}`}
            onAnimationEnd={handleAnimationEnd}
            onClick={handleManualNext}
            title={count > 1 ? 'Nhấn để chuyển sang thành viên tiếp theo' : undefined}
          >
            <svg className="public-frame-quote is-opening" viewBox="0 0 100 175" aria-hidden="true" focusable="false">
              <path d="M0 0H100V100L52 175H0L48 100H0Z" />
            </svg>
            <svg className="public-frame-quote is-closing" viewBox="0 0 100 175" aria-hidden="true" focusable="false">
              <path d="M0 0H100V100L52 175H0L48 100H0Z" />
            </svg>
            <RecognitionPortrait
              key={`member-portrait-${currentMember?.id || index}`}
              name={memberName}
              image={currentMember?.avatarData || null}
              type="member"
              imageOnly
            />
          </div>
        </figure>

        <div className="public-archive-content">
          <div className="public-archive-row is-mvp">
            <h3 className="public-member-kicker-title">Thành viên</h3>

            <div className={`public-archive-person public-member-animated-info ${isContentFading ? 'is-fading' : 'is-revealed'}`}>
              {currentMember ? (
                <>
                  <div className="public-archive-name-line">
                    <Link className="public-archive-name" to={profileUrl}>
                      <RecognitionName name={currentMember.name} verified={currentMember.isVerified} />
                      <ArrowUpRight size={20} aria-hidden="true" />
                    </Link>
                  </div>

                  <span className="public-recognition-status is-official">
                    <i aria-hidden="true" />
                    {currentMember.role === 'admin' ? 'Ban Quản Trị' : 'Thành viên chính thức'}
                  </span>

                  <dl className="public-recognition-facts" aria-label={`Thông số ${currentMember.name}`}>
                    <div>
                      <dt>Điểm mùa giải</dt>
                      <dd>{displayScore(currentMember.score)}</dd>
                    </div>
                    <div>
                      <dt>Chức danh</dt>
                      <dd className="is-text">{currentMember.jobTitle || 'Nhân viên'}</dd>
                    </div>
                    <div>
                      <dt>Phòng ban</dt>
                      <dd className="is-text">{currentMember.department || 'Media & Content'}</dd>
                    </div>
                    <div>
                      <dt>Đội nhóm</dt>
                      <dd className="is-text">{currentMember.teamName || '3Win Media'}</dd>
                    </div>
                    {currentMember.mvpCount > 0 && (
                      <div>
                        <dt>Danh hiệu</dt>
                        <dd className="is-text">{currentMember.mvpCount} Lần MVP</dd>
                      </div>
                    )}
                  </dl>

                  <p className="public-recognition-evidence">
                    <strong>Thông tin cá nhân:</strong> {currentMember.role === 'admin' ? 'Ban điều hành & phát triển hệ thống WorkRank' : 'Thành viên tích cực tham gia các hoạt động và thử thách mùa giải.'}
                  </p>
                </>
              ) : (
                <div className="public-honoree-empty">
                  {loading ? 'Đang tải thông tin thành viên…' : error ? (
                    <div className="public-recognition-feedback" role="alert">
                      <span>Chưa tải được danh sách thành viên.</span>
                      {retry && (
                        <button type="button" onClick={retry}>
                          Thử lại <ArrowUpRight size={15} />
                        </button>
                      )}
                    </div>
                  ) : 'Chưa có thông tin thành viên.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
