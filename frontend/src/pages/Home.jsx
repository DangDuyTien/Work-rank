import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
import usePublicSpotlight from '../hooks/usePublicSpotlight';
import RecognitionPortraitFrame from '../components/RecognitionPortraitFrame';
import { Reveal, RevealText } from '../components/ui';
import {
  RecognitionLink, RecognitionName, RecognitionStatus,
  SpotlightFeedback, displayScore, recognitionState,
} from '../components/PublicRecognition';

function RecognitionArchiveSection({ type, data, year, seasonName, loading, error, to, delay, since }) {
  const isMvp = type === 'mvp';
  const record = isMvp ? data?.mvp : data?.championTeam;
  const name = isMvp ? record?.name : record?.teamName;
  const state = recognitionState(data, type);
  const category = isMvp ? 'Cá nhân' : 'Đội nhóm';
  const title = isMvp ? 'MVP' : state === 'official' ? 'Quán quân' : state === 'projected' ? 'Dẫn đầu' : category;
  const displayYear = year || new Date().getFullYear();
  return (
    <Reveal as="section" delay={delay} since={since} className="public-season-section public-archive-section" aria-labelledby={`archive-${type}-title`} aria-busy={loading}>
      <div className="public-season-heading">
        <h2 id={`archive-${type}-title`}><b className="public-archive-year">{displayYear}</b><span>{category}{!year && !loading ? ' · Năm hiện tại' : ''}</span></h2>
        <div><p>{seasonName}</p>{data?.season?.frozenAt && <span>Chốt ngày {new Date(data.season.frozenAt).toLocaleDateString('vi-VN')}</span>}</div>
      </div>
      <div className="public-recognition-grid">
        <figure className="public-featured-person" aria-label={`Ảnh vinh danh ${category.toLowerCase()}`}>
          <RecognitionPortraitFrame key={`${type}-${data?.season?.id || 'none'}-${name || 'none'}`} type={type} record={record} loading={loading} />
        </figure>
        <div className="public-archive-content">
          <div className={`public-archive-row ${!isMvp ? 'is-champion' : 'is-mvp'}`}>
            {isMvp ? <h3>{title}</h3> : record ? (
              <ul className="public-archive-members public-archive-member-names" aria-label="Thành viên đội nhóm">
                {Array.isArray(record.members) && record.members.some((member) => member.name) ? record.members.filter((member) => member.name).map((member, index) => (
                  <li key={member.userId ?? member.id ?? index}><h3 className="public-member-name">{member.name}</h3></li>
                )) : <li className="public-archive-members-empty">Chưa có danh sách thành viên được công bố.</li>}
              </ul>
            ) : null}
            <div className="public-archive-person">
              {record ? <div className="public-archive-name-line"><Link className="public-archive-name" to={to}><RecognitionName name={name} verified={isMvp && record.isVerified} /><ArrowUpRight size={20} aria-hidden="true" /></Link>{isMvp && <div className="public-archive-inline-score"><span>Điểm mùa giải</span><strong>{displayScore(record.score)}</strong></div>}</div> : <p className="public-honoree-empty">{loading ? 'Đang tải…' : error ? 'Chưa tải được hồ sơ.' : 'Chưa có ghi nhận được công bố.'}</p>}
              <RecognitionStatus state={state} type={type} />
            </div>
          </div>

        </div>
      </div>
    </Reveal>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { data, loading, error, retry } = usePublicSpotlight();
  const [mountTime] = useState(() => performance.now());
  const season = data?.season;
  const startYear = season?.startAt ? new Date(season.startAt).getFullYear() : null;
  const year = Number.isFinite(startYear) ? startYear : null;
  const teamResult = `/leaderboard?mode=teams&period=season${season?.id ? `&seasonId=${encodeURIComponent(season.id)}` : ''}`;
  const mvpProfile = data?.mvp?.userId ? `/users/${data.mvp.userId}` : '/arena';
  const seasonName = loading ? 'Đang tải mùa giải…' : error ? 'Chưa tải được mùa giải' : season?.name || 'Chưa có mùa giải công bố';

  return (
    <div className="public-editorial-page">
      <a className="public-skip-link" href="#recognition-main">Đến nội dung chính</a>

      {/* Header — nhẹ nhàng trượt lên đầu tiên */}
      <Reveal as="header" delay={0} className="public-editorial-header">
        <Link className="public-editorial-brand" to="/" aria-label="WorkRank — Trang chủ">
          <BrandMark size={28} showLabel={false} /><span>WORKRANK<small>3WIN MEDIA</small></span>
        </Link>
        <div className="public-editorial-entry">
          {user ? <Link className="public-entry-button" to="/dashboard">Vào Dashboard <ArrowRight size={16} /></Link> : <>
            <Link className="public-register-link" to="/login?mode=register">Đăng ký</Link>
            <Link className="public-entry-button" to="/login">Đăng nhập <ArrowUpRight size={16} /></Link>
          </>}
        </div>
      </Reveal>

      <main id="recognition-main" className="public-editorial-main" tabIndex={-1}>
        {/* Hero title — từng ký tự chạy lần lượt */}
        <div className="public-editorial-intro">
          <RevealText as="h1" text="Recipients" delay={180} step={50} className="public-editorial-title" />
        </div>

        <SpotlightFeedback loading={loading} error={error} retry={retry} />

        {/* 2 khối vinh danh — lần lượt hiện sau hero */}
        <div id="season-recognition">
          <RecognitionArchiveSection type="champion" data={data} year={year} seasonName={seasonName} loading={loading} error={error} to={teamResult} delay={700} since={mountTime} />
          <RecognitionArchiveSection type="mvp" data={data} year={year} seasonName={seasonName} loading={loading} error={error} to={mvpProfile} delay={900} since={mountTime} />
        </div>

        {/* Section cuối — hiện khi cuộn tới */}
        <Reveal as="section" mode="scroll" className="public-explore-section" aria-labelledby="public-explore-title">
          <div><span className="public-editorial-kicker">THÀNH TÍCH CÒN TIẾP NỐI</span><h2 id="public-explore-title">Mỗi mùa giải.<br />Một dấu ấn.</h2></div>
          <div className="public-explore-links">
            <RecognitionLink to="/leaderboard?mode=hall-of-fame">Lịch sử vinh danh</RecognitionLink>
            <RecognitionLink to="/arena">Mùa giải &amp; hoạt động</RecognitionLink>
            <RecognitionLink to="/leaderboard?mode=teams">Khám phá đội nhóm</RecognitionLink>
          </div>
        </Reveal>
      </main>

      {/* Footer — hiện khi cuộn tới */}
      <Reveal as="footer" mode="scroll" className="public-editorial-footer">
        <nav aria-label="Khám phá WorkRank">
          <Link to="/leaderboard?mode=teams">Bảng xếp hạng</Link>
          <Link to="/arena">Mùa giải</Link>
          <Link to="/youtube">YouTube</Link>
          <Link to="/games">Trò chơi</Link>
          <Link to={user ? '/dashboard' : '/login'}>{user ? 'Dashboard' : 'Đăng nhập'}</Link>
        </nav>
        <div className="public-footer-body"><p className="public-footer-wordmark" aria-label="WorkRank">Work<br />Rank<span aria-hidden="true">↗</span></p><div><BrandMark size={40} showLabel={false} /><p>Công sức → Thành tích<br />Tiến bộ → Ghi nhận</p><small>© {new Date().getFullYear()} WorkRank · 3WIN MEDIA</small></div></div>
      </Reveal>
    </div>
  );
}
