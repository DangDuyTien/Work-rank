import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Medal } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
import usePublicSpotlight from '../hooks/usePublicSpotlight';
import RecognitionPortraitFrame from '../components/RecognitionPortraitFrame';
import { Reveal, RevealText } from '../components/ui';
import {
  RecognitionLink, RecognitionName, RecognitionStatus,
  SpotlightFeedback, displayScore, recognitionState,
  removeVietnameseDiacritics,
} from '../components/PublicRecognition';

function WeeklyLeaderboard({ items, loading }) {
  const leaders = (items || []).slice(0, 3);
  const members = leaders.flatMap((item) => {
    const photos = [...new Set([item.avatarData, ...(item.galleryImages || [])].filter(Boolean))];
    return photos.map((avatarData) => ({ name: item.name, avatarData }));
  });
  return <Reveal as="section" delay={500} className="public-season-section public-archive-section public-weekly-recognition" aria-labelledby="weekly-ranking-title" aria-busy={loading}>
    <div className="public-season-heading is-detail"><h2 id="weekly-ranking-title"><span>Cá nhân · BXH tuần</span></h2></div>
    <div className="public-recognition-grid">
      <figure className="public-featured-person" aria-label="Ảnh vinh danh ba cá nhân dẫn đầu tuần">
        <RecognitionPortraitFrame type="champion" record={{ teamName: 'Top 3 tuần', members }} loading={loading} />
      </figure>
      <div className="public-archive-content">
        <ol className="public-weekly-honorees">
          {leaders.map((item, index) => <li key={item.userId} className={`public-weekly-honoree rank-${index + 1}`}>
            <h3 className="public-weekly-place"><Medal size={22} aria-hidden="true" />Top {index + 1}</h3>
            <div className="public-archive-person">
              <Link className="public-archive-name" to={`/users/${item.userId}`}><RecognitionName name={item.name} verified={item.isVerified} /><ArrowUpRight size={20} aria-hidden="true" /></Link>
              <dl className="public-recognition-facts public-weekly-facts" aria-label={`Thông tin ${item.name}`}>
                <div><dt>Điểm tuần</dt><dd>{displayScore(item.score)}</dd></div>
                <div><dt>Danh hiệu MVP</dt><dd>{item.mvpCount || 0}</dd></div>
                <div><dt>Chức danh</dt><dd className="is-text">{item.jobTitle || 'Chưa cập nhật'}</dd></div>
                <div><dt>Phòng ban</dt><dd className="is-text">{item.department || 'Chưa cập nhật'}</dd></div>
                <div><dt>Đội nhóm</dt><dd className="is-text">{item.teamName || 'Chưa tham gia đội nhóm'}</dd></div>
              </dl>
            </div>
          </li>)}
        </ol>
        {!leaders.length && <p className="public-honoree-empty">{loading ? 'Đang tải bảng xếp hạng…' : 'Chưa có người dùng trong bảng xếp hạng.'}</p>}
      </div>
    </div>
  </Reveal>;
}

function YouTubeLeaderboard({ items, loading, error, retry }) {
  const leaders = items.slice(0, 3);
  const members = leaders.map((channel) => ({ name: channel.title, avatarUrl: channel.thumbnailUrl }));
  return <Reveal as="section" delay={500} className="public-season-section public-archive-section public-weekly-recognition public-youtube-recognition" aria-labelledby="youtube-ranking-title" aria-busy={loading}>
    <div className="public-season-heading is-detail"><h2 id="youtube-ranking-title"><span>YouTube · Kênh dẫn đầu</span></h2></div>
    <div className="public-recognition-grid">
      <figure className="public-featured-person" aria-label="Avatar các kênh YouTube đứng đầu">
        <RecognitionPortraitFrame type="champion" record={{ teamName: 'YouTube', members }} loading={loading} />
      </figure>
      <div className="public-archive-content">
        <ol className="public-weekly-honorees">
          {leaders.map((channel, index) => <li key={channel.channelId} className={`public-weekly-honoree rank-${index + 1}`}>
            <h3 className="public-weekly-place"><Medal size={22} aria-hidden="true" />Top {index + 1}</h3>
            <div className="public-archive-person">
              <a className="public-archive-name" href={`https://www.youtube.com/channel/${encodeURIComponent(channel.channelId)}`} target="_blank" rel="noopener noreferrer"><span className="public-recognition-name">{channel.title}</span><ArrowUpRight size={20} aria-hidden="true" /></a>
              <dl className="public-recognition-facts public-weekly-facts" aria-label={`Thông số ${channel.title}`}>
                <div><dt>Lượt xem</dt><dd>{displayScore(channel.views)}</dd></div>
                <div><dt>Người đăng ký</dt><dd>{displayScore(channel.subscribers)}</dd></div>
              </dl>
            </div>
          </li>)}
        </ol>
        {error ? <div className="public-recognition-feedback" role="alert"><span>Chưa tải được BXH YouTube.</span><button type="button" onClick={retry}>Thử lại <ArrowUpRight size={15} /></button></div> : !leaders.length && <p className="public-honoree-empty">{loading ? 'Đang tải BXH YouTube…' : 'Chưa có kênh YouTube được công bố.'}</p>}
      </div>
    </div>
  </Reveal>;
}

function RecognitionArchiveSection({ type, data, year, seasonName, loading, error, to, delay, since, showYear = true }) {
  const isMvp = type === 'mvp';
  const record = isMvp ? data?.mvp : data?.championTeam;
  const name = isMvp ? record?.name : record?.teamName;
  const state = recognitionState(data, type);
  const category = isMvp ? 'Cá nhân' : 'Đội nhóm';
  const title = isMvp ? 'MVP' : state === 'official' ? 'Quán quân' : state === 'projected' ? 'Dẫn đầu' : category;
  const displayYear = year || new Date().getFullYear();
  const titleId = `archive-${displayYear}-${type}-title`;

  return (
    <Reveal as="section" delay={delay} since={since} className="public-season-section public-archive-section" aria-labelledby={titleId} aria-busy={loading}>
      <div className={`public-season-heading${showYear ? '' : ' is-detail'}`}>
        <h2 id={titleId}>{showYear && <b className="public-archive-year">{displayYear}</b>}<span>{category}{!year && !loading ? ' · Năm hiện tại' : ''}</span></h2>
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
                  <li key={member.userId ?? member.id ?? index}><h3 className="public-member-name">{removeVietnameseDiacritics(member.name)}</h3></li>
                )) : <li className="public-archive-members-empty">Chưa có danh sách thành viên được công bố.</li>}
              </ul>
            ) : null}
            <div className="public-archive-person">
              {record ? <>
                <div className="public-archive-name-line">
                  <Link className="public-archive-name" to={to}>
                    <RecognitionName name={name} verified={isMvp && record.isVerified} />
                    <ArrowUpRight size={20} aria-hidden="true" />
                  </Link>
                </div>
                <RecognitionStatus state={state} type={type} />
                {isMvp && (
                  <>
                    <dl className="public-recognition-facts" aria-label="Thông số MVP">
                      <div>
                        <dt>Điểm mùa giải</dt>
                        <dd>{displayScore(record.score)}</dd>
                      </div>
                      {record.jobTitle && (
                        <div>
                          <dt>Chức danh</dt>
                          <dd className="is-text">{record.jobTitle}</dd>
                        </div>
                      )}
                      {record.department && (
                        <div>
                          <dt>Phòng ban</dt>
                          <dd className="is-text">{record.department}</dd>
                        </div>
                      )}
                      {record.awardTitle && (
                        <div>
                          <dt>Danh hiệu</dt>
                          <dd className="is-text">{record.awardTitle}</dd>
                        </div>
                      )}
                    </dl>
                    {record.reason && <p className="public-recognition-evidence"><strong>Lý do vinh danh:</strong> {record.reason}</p>}
                  </>
                )}
              </> : <p className="public-honoree-empty">{loading ? 'Đang tải…' : error ? 'Chưa tải được hồ sơ.' : 'Chưa có ghi nhận được công bố.'}</p>}
            </div>
          </div>

        </div>
      </div>
    </Reveal>
  );
}

function RecognitionYearGroup({
  id,
  year,
  data,
  seasonName,
  loading,
  error,
  teamTo,
  mvpTo,
  championDelay,
  mvpDelay,
  since,
}) {
  const displayYear = year || new Date().getFullYear();
  const yearTitleId = `${id || `year-${displayYear}`}-title`;

  return (
    <section id={id} className="public-year-group" aria-labelledby={yearTitleId}>
      <div className="public-year-rail">
        <h2 id={yearTitleId} className="public-year-marker">{displayYear}</h2>
      </div>
      <div className="public-year-content">
        <RecognitionArchiveSection
          type="champion"
          data={data}
          year={year}
          seasonName={seasonName}
          loading={loading}
          error={error}
          to={teamTo}
          delay={championDelay}
          since={since}
          showYear={false}
        />
        <RecognitionArchiveSection
          type="mvp"
          data={data}
          year={year}
          seasonName={seasonName}
          loading={loading}
          error={error}
          to={mvpTo}
          delay={mvpDelay}
          since={since}
          showYear={false}
        />
      </div>
    </section>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { data, archives, weekly, youtube, youtubeLoading, youtubeError, loading, error, retry } = usePublicSpotlight();
  const [mountTime] = useState(() => performance.now());
  const season = data?.season;
  const startYear = season?.startAt ? new Date(season.startAt).getFullYear() : null;
  const year = Number.isFinite(startYear) ? startYear : null;
  const teamResult = `/leaderboard?scope=teams&period=season${season?.id ? `&seasonId=${encodeURIComponent(season.id)}` : ''}`;
  const mvpProfile = data?.mvp?.userId ? `/users/${data.mvp.userId}` : '/arena';
  const seasonName = loading ? 'Đang tải mùa giải…' : error ? 'Chưa tải được mùa giải' : season?.name || 'Chưa có mùa giải công bố';

  const historicalArchives = Array.from(new Map(
    (archives || [])
      .map((archive) => [Number(archive.year), archive])
      .filter(([archiveYear]) => Number.isFinite(archiveYear) && archiveYear !== year),
  ).values());

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

        <div className="public-year-timeline">
          <RecognitionYearGroup
            id="season-recognition"
            year={year}
            data={data}
            seasonName={seasonName}
            loading={loading}
            error={error}
            teamTo={teamResult}
            mvpTo={mvpProfile}
            championDelay={700}
            mvpDelay={900}
            since={mountTime}
          />

          {/* Các mùa giải lịch sử (ví dụ: 2025) */}
          {historicalArchives.map((arch, archIdx) => {
            const archData = {
              season: {
                id: `archive-${arch.year}`,
                name: arch.label || `Mùa Giải ${arch.year}`,
                frozenAt: arch.frozenAt,
              },
              championTeam: arch.championTeam,
              mvp: arch.mvp,
              provenance: {
                resultState: 'official',
                champion: { state: 'official', source: 'HistoricalArchive' },
                mvp: { state: 'official', source: 'HistoricalArchive' },
              },
            };
            const archTeamTo = arch.championTeam?.teamId ? `/leaderboard?scope=teams&period=season&teamId=${arch.championTeam.teamId}${arch.season?.id ? `&seasonId=${arch.season.id}` : ''}` : '/leaderboard?scope=hall-of-fame';
            const archMvpTo = arch.mvp?.userId ? `/users/${arch.mvp.userId}` : '/leaderboard?scope=hall-of-fame';
            const archSeasonName = arch.label || `Vinh Danh Mùa Giải ${arch.year}`;

            return (
              <RecognitionYearGroup
                key={`archive-${arch.year}`}
                id={`archive-${arch.year}`}
                year={arch.year}
                data={archData}
                seasonName={archSeasonName}
                loading={false}
                error={false}
                teamTo={archTeamTo}
                mvpTo={archMvpTo}
                championDelay={200 + archIdx * 150}
                mvpDelay={350 + archIdx * 150}
                since={mountTime}
              />
            );
          })}
        </div>

        <WeeklyLeaderboard items={weekly} loading={loading} />
        <YouTubeLeaderboard items={youtube} loading={youtubeLoading} error={youtubeError} retry={retry} />

        {/* Section cuối — hiện khi cuộn tới */}
        <Reveal as="section" mode="scroll" className="public-explore-section" aria-labelledby="public-explore-title">
          <div><span className="public-editorial-kicker">THÀNH TÍCH CÒN TIẾP NỐI</span><h2 id="public-explore-title">Mỗi mùa giải.<br />Một dấu ấn.</h2></div>
          <div className="public-explore-links">
            <RecognitionLink to="/leaderboard?scope=hall-of-fame">Lịch sử vinh danh</RecognitionLink>
            <RecognitionLink to="/arena">Mùa giải &amp; hoạt động</RecognitionLink>
            <RecognitionLink to="/leaderboard?scope=teams">Khám phá đội nhóm</RecognitionLink>
          </div>
        </Reveal>
      </main>

      {/* Footer — hiện khi cuộn tới */}
      <Reveal as="footer" mode="scroll" className="public-editorial-footer">
        <nav aria-label="Khám phá WorkRank">
          <Link to="/leaderboard?scope=teams">Bảng xếp hạng</Link>
          <Link to="/arena">Mùa giải</Link>
          <Link to="/youtube">YouTube</Link>
          <Link to="/games">Trò chơi</Link>
          <Link to={user ? '/dashboard' : '/login'}>{user ? 'Dashboard' : 'Đăng nhập'}</Link>
        </nav>
        <div className="public-footer-body"><p className="public-footer-wordmark" aria-label="WorkRank">Work<br />Rank</p><div><Link to="/" aria-label="3WIN MEDIA — Trang chủ vinh danh" style={{ display: 'inline-flex', textDecoration: 'none' }}><BrandMark size={40} showLabel={false} /></Link><p>Công sức → Thành tích<br />Tiến bộ → Ghi nhận</p><small>© {new Date().getFullYear()} WorkRank · 3WIN MEDIA</small></div></div>
      </Reveal>
    </div>
  );
}
