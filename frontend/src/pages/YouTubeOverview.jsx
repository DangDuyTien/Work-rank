import React, { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, Navigate, useSearchParams } from 'react-router-dom';
import {
  Tv, Eye, Users, TrendingUp, RefreshCw, Swords, CheckCircle2,
  AlertTriangle, XCircle, ExternalLink, Layers, ChevronRight, Shield,
  Building2, ArrowLeft, Info,
} from 'lucide-react';
import { youtube, groups as groupsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UiContext';
import { parseApiError } from '../utils/errors';
import { TabTransition, TableSkeleton, AnimatedNumber } from '../components/ui';
import YouTubeTrendChart from '../components/YouTubeTrendChart';
import { getCached, fetchWithCache, CACHE_KEYS, CACHE_TTL, isDeepEqual } from '../services/cache';

const panelStyle = { display: 'flex', flexDirection: 'column', gap: 20 };
const actionStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px',
  fontSize: 13, fontWeight: 600, textDecoration: 'none',
};
const tabStyle = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
  fontSize: 14, fontWeight: 700, background: 'none', border: 'none',
  color: '#64748b', cursor: 'pointer', whiteSpace: 'nowrap',
  transition: 'background-color var(--motion-fast) var(--ease-standard), color var(--motion-fast) var(--ease-standard)',
};

function formatNumber(num) {
  const n = Number(num || 0);
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString('vi-VN');
}

function formatGrowth(value) {
  if (value === null || value === undefined) return 'Chưa đủ dữ liệu';
  return (Number(value) >= 0 ? '+' : '') + Number(value).toFixed(1) + '%';
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return 'Chưa đồng bộ';
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return mins + ' phút trước';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + ' giờ trước';
  return Math.floor(hours / 24) + ' ngày trước';
}

function teamListFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data?.teams)) return data.data.teams;
  return Array.isArray(data?.data) ? data.data : [];
}

export default function YouTubeOverview() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const userTeamId = user?.teamId || user?.team_id || null;
  const requestedTab = searchParams.get('tab') || 'overview';
  const activeTab = requestedTab === 'team_detail' ? 'team_detail'
    : requestedTab === 'compare' && isAdmin ? 'compare' : 'overview';
  const selectedTeamId = searchParams.get('teamId') || userTeamId || '';
  const canViewSelectedTeam = Boolean(selectedTeamId) && (isAdmin || Boolean(userTeamId) && Number(selectedTeamId) === Number(userTeamId));
  const detailCacheKey = 'youtube:team_details:' + selectedTeamId;
  const detailContext = `${user?.id}:${canViewSelectedTeam}:${selectedTeamId}`;
  const currentDetailContext = useRef(detailContext);
  currentDetailContext.current = detailContext;
  const cachedOverview = getCached(CACHE_KEYS.YOUTUBE_OVERVIEW());

  let legacyDestination = null;
  if (requestedTab === 'channel_leaderboard' || requestedTab === 'team_leaderboard') {
    const params = new URLSearchParams({ scope: 'youtube', view: requestedTab === 'team_leaderboard' ? 'teams' : 'channels' });
    const metric = searchParams.get('metric') || searchParams.get('sortBy');
    params.set('metric', ['views', 'subscribers', 'growth'].includes(metric) ? metric : 'views');
    const channelTeam = searchParams.get('channelTeam') || searchParams.get('teamId');
    if (requestedTab === 'channel_leaderboard' && channelTeam) params.set('channelTeam', channelTeam);
    legacyDestination = '/leaderboard?' + params.toString();
  } else if (requestedTab === 'admin' && isAdmin) {
    legacyDestination = '/admin/teams-youtube';
  }

  const [overview, setOverview] = useState(() => cachedOverview || null);
  const [loading, setLoading] = useState(() => !cachedOverview);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [teamsList, setTeamsList] = useState(() => isAdmin ? teamListFromResponse(getCached('groups:admin:all')) : []);
  const [teamDetails, setTeamDetails] = useState(() => canViewSelectedTeam ? getCached(detailCacheKey) || null : null);
  const [teamDetailsLoading, setTeamDetailsLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [teamAId, setTeamAId] = useState('');
  const [teamBId, setTeamBId] = useState('');
  const [comparison, setComparison] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState('');
  const comparisonContext = `${user?.id}:${isAdmin}:${activeTab}:${teamAId}:${teamBId}`;
  const currentComparisonContext = useRef(comparisonContext);
  currentComparisonContext.current = comparisonContext;

  useEffect(() => {
    if (legacyDestination) return;
    let current = true;
    setLoadError('');
    const cached = getCached(CACHE_KEYS.YOUTUBE_OVERVIEW());
    setLoading(!cached);
    const loadOverview = fetchWithCache(CACHE_KEYS.YOUTUBE_OVERVIEW(), () => youtube.getOverview(), { ttl: CACHE_TTL.MEDIUM })
      .then((data) => {
        if (current) setOverview((prev) => isDeepEqual(prev, data) ? prev : data);
      })
      .catch((error) => {
        if (current) setLoadError(parseApiError(error, 'Không thể tải tổng quan YouTube'));
      });
    const loadTeams = isAdmin
      ? fetchWithCache('groups:admin:all', () => groupsApi.listAll(), { ttl: CACHE_TTL.STATIC })
        .then((data) => {
          if (!current) return;
          const teams = teamListFromResponse(data);
          setTeamsList(teams);
          setTeamAId((prev) => prev || String(teams[0]?.id || ''));
          setTeamBId((prev) => prev || String(teams[1]?.id || ''));
        })
        .catch((error) => {
          if (current) toast.error(parseApiError(error, 'Không thể tải danh sách đội'));
        })
      : Promise.resolve();
    Promise.all([loadOverview, loadTeams]).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, [isAdmin, user?.id, legacyDestination, toast]);

  useEffect(() => {
    if (legacyDestination || activeTab !== 'team_detail') return;
    if (!canViewSelectedTeam) {
      setTeamDetails(null);
      setTeamDetailsLoading(false);
      setDetailError('');
      return;
    }
    let current = true;
    const cached = getCached(detailCacheKey);
    setTeamDetails(cached || null);
    setTeamDetailsLoading(!cached);
    setDetailError('');
    fetchWithCache(detailCacheKey, () => youtube.getTeamDetails(selectedTeamId), { ttl: CACHE_TTL.MEDIUM })
      .then((data) => {
        if (current) setTeamDetails((prev) => isDeepEqual(prev, data) ? prev : data);
      })
      .catch((error) => {
        if (current) setDetailError(parseApiError(error, 'Không thể tải chi tiết đội'));
      })
      .finally(() => {
        if (current) setTeamDetailsLoading(false);
      });
    return () => { current = false; };
  }, [activeTab, selectedTeamId, canViewSelectedTeam, detailCacheKey, detailContext, legacyDestination]);

  useEffect(() => {
    if (legacyDestination || activeTab !== 'compare' || !isAdmin || !teamAId || !teamBId || teamAId === teamBId) return;
    let current = true;
    const cacheKey = 'youtube:compare:' + teamAId + ':' + teamBId;
    const cached = getCached(cacheKey);
    setComparison(cached || null);
    setCompareLoading(!cached);
    setCompareError('');
    fetchWithCache(cacheKey, () => youtube.compareTeams(teamAId, teamBId), { ttl: CACHE_TTL.MEDIUM })
      .then((data) => {
        if (current) setComparison(data);
      })
      .catch((error) => {
        if (current) setCompareError(parseApiError(error, 'Không thể so sánh hai đội'));
      })
      .finally(() => {
        if (current) setCompareLoading(false);
      });
    return () => { current = false; };
  }, [activeTab, isAdmin, teamAId, teamBId, comparisonContext, legacyDestination]);

  const changeTab = (tab, teamId = selectedTeamId) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    if (tab === 'team_detail' && teamId) params.set('teamId', String(teamId));
    else params.delete('teamId');
    setSearchParams(params, { replace: true });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setLoadError('');
    setDetailError('');
    setCompareError('');
    try {
      const requests = [
        fetchWithCache(CACHE_KEYS.YOUTUBE_OVERVIEW(), () => youtube.getOverview(), { ttl: CACHE_TTL.MEDIUM, force: true })
          .then((data) => setOverview((prev) => isDeepEqual(prev, data) ? prev : data)),
      ];
      if (activeTab === 'team_detail' && canViewSelectedTeam) {
        requests.push(fetchWithCache(detailCacheKey, () => youtube.getTeamDetails(selectedTeamId), { ttl: CACHE_TTL.MEDIUM, force: true })
          .then((data) => {
            if (currentDetailContext.current === detailContext) setTeamDetails(data);
          }));
      }
      if (isAdmin && activeTab === 'compare' && teamAId && teamBId && teamAId !== teamBId) {
        requests.push(fetchWithCache('youtube:compare:' + teamAId + ':' + teamBId, () => youtube.compareTeams(teamAId, teamBId), { ttl: CACHE_TTL.MEDIUM, force: true })
          .then((data) => {
            if (currentComparisonContext.current === comparisonContext) setComparison(data);
          }));
      }
      await Promise.all(requests);
      toast.success('Đã làm mới dữ liệu YouTube');
    } catch (error) {
      toast.error(parseApiError(error, 'Không thể làm mới dữ liệu YouTube'));
    } finally {
      setRefreshing(false);
    }
  };

  if (legacyDestination) return <Navigate to={legacyDestination} replace />;

  const freshness = overview?.kpis?.freshnessStatus || 'STALE';
  const unassignedCount = overview?.kpis?.unassignedChannelsCount || overview?.unassignedSummary?.totalChannels || 0;
  const unassignedViews = overview?.kpis?.unassignedViews || overview?.unassignedSummary?.totalViews || 0;
  const currentTeam = canViewSelectedTeam && Number(teamDetails?.team?.id) === Number(selectedTeamId) ? teamDetails : null;
  const teamName = currentTeam?.team?.name || teamsList.find((team) => Number(team.id) === Number(selectedTeamId))?.name
    || (Number(selectedTeamId) === Number(userTeamId) ? 'Đội bạn' : selectedTeamId ? `Đội #${selectedTeamId}` : 'Đội');
  const channels = currentTeam?.channels || [];
  const summary = currentTeam?.summary;
  const visibleComparison = Number(comparison?.teamA?.id) === Number(teamAId)
    && Number(comparison?.teamB?.id) === Number(teamBId) ? comparison : null;

  return (
    <div className="youtube-overview-page" style={{ width: '100%', maxWidth: 1680, margin: '0 auto', padding: '24px 16px' }}>
      <div className="youtube-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <nav aria-label="Đường dẫn YouTube" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b', marginBottom: 6 }}>
            <button type="button" className="youtube-breadcrumb" onClick={() => changeTab('overview')}>
              YouTube
            </button>
            {activeTab !== 'overview' && (
              <><ChevronRight size={14} /><span>{activeTab === 'compare' ? 'So sánh đội' : teamName}</span></>
            )}
          </nav>
          <div className="youtube-page-title-block" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Tv size={24} color="#ef4444" />
            <h1 className="youtube-page-title" style={{ margin: 0, fontSize: 24, fontWeight: 700, lineHeight: 1.3, color: '#0f172a' }}>
              {activeTab === 'team_detail' ? 'YouTube · ' + teamName : activeTab === 'compare' ? 'YouTube · So sánh đội' : 'YouTube'}
            </h1>
          </div>
        </div>
        <div className="youtube-page-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="youtube-freshness-badge" style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600,
            background: freshness === 'FRESH' ? '#ecfdf5' : '#fffbeb',
            color: freshness === 'FRESH' ? '#059669' : '#92400e', border: '1px solid #e2e8f0',
          }}>
            {freshness === 'FRESH' ? <CheckCircle2 size={14} /> : freshness === 'FAILED' ? <XCircle size={14} /> : <AlertTriangle size={14} />}
            {freshness === 'FAILED' ? 'Lỗi đồng bộ gần nhất' : formatRelativeTime(overview?.kpis?.lastSyncedAt)}
          </div>
          <RouterLink to="/leaderboard?scope=youtube&view=channels&metric=views" className="youtube-primary-action" style={{ ...actionStyle, background: '#0f172a', color: '#ffffff' }}>
            BXH YouTube <ChevronRight size={14} />
          </RouterLink>
          {isAdmin && (
            <RouterLink to="/admin/teams-youtube" className="youtube-refresh-action" style={{ ...actionStyle, color: '#334155', border: '1px solid #cbd5e1' }}>
              <Shield size={14} /> Quản lý kênh
            </RouterLink>
          )}
          <button type="button" className="youtube-refresh-action" onClick={handleRefresh} disabled={refreshing} style={{ ...actionStyle, background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', cursor: 'pointer' }}>
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Làm mới
          </button>
        </div>
      </div>

      <div className="youtube-tab-list" role="tablist" aria-label="Các khu vực YouTube" style={{ display: 'flex', gap: 6, marginBottom: 24, overflowX: 'auto' }}>
        <button type="button" className={activeTab === 'overview' ? 'youtube-tab is-active' : 'youtube-tab'} role="tab" aria-selected={activeTab === 'overview'} onClick={() => changeTab('overview')} style={tabStyle}>
          <Building2 size={16} /> Tổng quan
        </button>
        <button type="button" className={activeTab === 'team_detail' ? 'youtube-tab is-active' : 'youtube-tab'} role="tab" aria-selected={activeTab === 'team_detail'} onClick={() => changeTab('team_detail', isAdmin ? selectedTeamId : userTeamId)} style={tabStyle}>
          <Layers size={16} /> {isAdmin ? 'Kênh theo đội' : 'Kênh đội bạn'}
        </button>
        {isAdmin && (
          <button type="button" className={activeTab === 'compare' ? 'youtube-tab is-active' : 'youtube-tab'} role="tab" aria-selected={activeTab === 'compare'} onClick={() => changeTab('compare')} style={tabStyle}>
            <Swords size={16} /> So sánh
          </button>
        )}
      </div>

      <TabTransition key={activeTab} minHeight={420}>
        {activeTab === 'overview' && (
          <div style={panelStyle}>
            {loadError && <div role="alert" className="motion-slide-down" style={{ color: '#dc2626' }}>{loadError}</div>}
            {loading && !overview ? <TableSkeleton rows={5} cols={3} minHeight={420} /> : (
              <>
                <div className="youtube-metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                  <div className="youtube-metric-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 13, fontWeight: 600 }}><span>Lượt xem toàn công ty</span><Eye size={18} color="#3b82f6" /></div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a' }}><AnimatedNumber value={overview?.kpis?.totalViews || 0} formatFn={formatNumber} /></div>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{overview?.kpis?.totalChannels || 0} kênh hoạt động</span>
                  </div>
                  <div className="youtube-metric-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 13, fontWeight: 600 }}><span>Người đăng ký</span><Users size={18} color="#8b5cf6" /></div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a' }}><AnimatedNumber value={overview?.kpis?.totalSubscribers || 0} formatFn={formatNumber} /></div>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Toàn công ty</span>
                  </div>
                  <div className="youtube-metric-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 13, fontWeight: 600 }}><span>Đội có kênh YouTube</span><Layers size={18} color="#10b981" /></div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a' }}><AnimatedNumber value={overview?.kpis?.totalTeams || 0} /></div>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{unassignedCount} kênh chưa gán đội</span>
                  </div>
                </div>
                <YouTubeTrendChart data={overview?.history || []} title="Lịch sử YouTube toàn công ty (30 ngày)" />
                {unassignedCount > 0 && (
                  <div className="youtube-unassigned-alert" style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#92400e' }}>
                      <Info size={18} style={{ flexShrink: 0 }} /><span><strong>{unassignedCount} kênh chưa gán đội</strong> · {formatNumber(unassignedViews)} lượt xem</span>
                    </div>
                    <RouterLink to="/leaderboard?scope=youtube&view=channels&metric=views&channelTeam=unassigned" className="youtube-alert-action" style={{ ...actionStyle, color: '#b45309' }}>
                      Xem các kênh chưa gán <ChevronRight size={14} />
                    </RouterLink>
                  </div>
                )}
                <div className="youtube-overview-panels" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 20 }}>
                  {[
                    { metric: 'views', title: 'Top 5 đội theo lượt xem', icon: Eye, color: '#3b82f6', teams: overview?.topTeamsByViews || [] },
                    { metric: 'growth', title: 'Top 5 đội tăng trưởng 30 ngày', icon: TrendingUp, color: '#10b981', teams: overview?.topTeamsByGrowth || [] },
                  ].map(({ metric, title, icon: Icon, color, teams }) => (
                    <section key={metric} style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><Icon size={18} color={color} />{title}</h2>
                        <RouterLink to={'/leaderboard?scope=youtube&view=teams&metric=' + metric} style={{ ...actionStyle, padding: 0, color }}>
                          Xem BXH đội <ChevronRight size={14} />
                        </RouterLink>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {teams.slice(0, 5).map((team, index) => {
                          const canViewTeam = isAdmin || Number(team.teamId) === Number(userTeamId);
                          return (
                            <RouterLink key={team.teamId}
                              to={canViewTeam ? '/youtube?tab=team_detail&teamId=' + team.teamId : '/leaderboard?scope=youtube&view=teams&metric=' + metric}
                              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#f8fafc', textDecoration: 'none', borderLeft: '4px solid ' + (index === 0 ? color : '#cbd5e1'), color: '#0f172a', minWidth: 0 }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, overflowWrap: 'anywhere' }}>#{index + 1} {team.teamName}</div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>{formatNumber(metric === 'views' ? team.totalSubscribers : team.totalViews)} {metric === 'views' ? 'người đăng ký' : 'lượt xem'}</div>
                              </div>
                              <div style={{ fontWeight: 700, fontSize: 16, color, whiteSpace: 'nowrap' }}>
                                {metric === 'views' ? formatNumber(team.totalViews) : formatGrowth(team.viewsGrowth30dPct)}
                              </div>
                            </RouterLink>
                          );
                        })}
                        {teams.length === 0 && <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Chưa có dữ liệu đội.</p>}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'team_detail' && (
          <div className="youtube-tab-panel youtube-team-detail-panel" style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <button type="button" onClick={() => changeTab('overview')} style={{ ...actionStyle, border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: 'pointer' }}>
                <ArrowLeft size={14} /> Tổng quan YouTube
              </button>
              {isAdmin && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b', maxWidth: '100%' }}>
                  Đội
                  <select value={selectedTeamId} onChange={(event) => changeTab('team_detail', event.target.value)} style={{ maxWidth: '100%', padding: '6px 10px', fontSize: 13, border: '1px solid #cbd5e1', background: '#ffffff' }}>
                    <option value="">Chọn đội</option>
                    {teamsList.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                  </select>
                </label>
              )}
            </div>
            {selectedTeamId && !canViewSelectedTeam && (
              <div role="alert" className="motion-slide-down" style={{ color: '#dc2626' }}>
                Bạn không có quyền xem chi tiết YouTube của đội này.
              </div>
            )}
            {canViewSelectedTeam && detailError && <div role="alert" className="motion-slide-down" style={{ color: '#dc2626' }}>{detailError}</div>}
            {!selectedTeamId && (
              <div style={{ padding: 24, color: '#64748b' }}>
                <AlertTriangle size={24} />
                <p>{isAdmin ? 'Chưa chọn đội.' : 'Bạn chưa được gán vào đội.'}</p>
                {!isAdmin && <RouterLink to="/groups" style={{ ...actionStyle, color: '#3b82f6' }}>Đội nhóm <ChevronRight size={14} /></RouterLink>}
              </div>
            )}
            {canViewSelectedTeam && teamDetailsLoading && !currentTeam && <TableSkeleton rows={4} cols={3} minHeight={420} />}
            {currentTeam && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 14 }}>
                  <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Lượt xem của đội</div>
                    <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}><AnimatedNumber value={summary?.totalViews || 0} formatFn={formatNumber} /></div>
                    <div style={{ fontSize: 12, color: '#10b981' }}>+{formatNumber(summary?.views30d)} trong 30 ngày</div>
                  </div>
                  <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Người đăng ký của đội</div>
                    <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}><AnimatedNumber value={summary?.totalSubscribers || 0} formatFn={formatNumber} /></div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{channels.length} kênh</div>
                  </div>
                  <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Tăng trưởng 30 ngày</div>
                    <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: '#10b981' }}>{formatGrowth(summary?.viewsGrowth30dPct)}</div>
                    <RouterLink to="/leaderboard?scope=youtube&view=teams&metric=growth" style={{ fontSize: 12, color: '#3b82f6' }}>BXH tăng trưởng</RouterLink>
                  </div>
                </div>
                <YouTubeTrendChart data={currentTeam.history || []} title={`Lịch sử YouTube của ${teamName} (30 ngày)`} />
                <section>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Kênh YouTube của {teamName} ({channels.length})</h2>
                    <RouterLink to={'/leaderboard?scope=youtube&view=channels&metric=views&channelTeam=' + selectedTeamId} style={{ ...actionStyle, padding: 0, color: '#3b82f6' }}>BXH kênh của đội <ChevronRight size={14} /></RouterLink>
                  </div>
                  {channels.length === 0 ? <p style={{ color: '#64748b', fontSize: 13 }}>Đội chưa có kênh YouTube.</p> : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 16 }}>
                      {channels.map((channel) => (
                        <article key={channel.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, background: '#ffffff', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {channel.thumbnailUrl ? <img src={channel.thumbnailUrl} alt="" width={44} height={44} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <Tv size={28} color="#ef4444" style={{ flexShrink: 0 }} />}
                            <div style={{ minWidth: 0 }}>
                              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, overflowWrap: 'anywhere' }}>{channel.title}</h3>
                              <div style={{ fontSize: 12, color: '#64748b', overflowWrap: 'anywhere' }}>{channel.customUrl || channel.channelId}</div>
                            </div>
                          </div>
                          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, margin: 0 }}>
                            <div><dt style={{ fontSize: 12, color: '#64748b' }}>Lượt xem</dt><dd style={{ margin: 0, fontWeight: 700 }}>{formatNumber(channel.views)}</dd></div>
                            <div><dt style={{ fontSize: 12, color: '#64748b' }}>Người đăng ký</dt><dd style={{ margin: 0, fontWeight: 700 }}>{formatNumber(channel.subscribers)}</dd></div>
                          </dl>
                          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b' }}>
                            <span>{formatRelativeTime(channel.lastSyncedAt)}</span>
                            <a href={'https://youtube.com/channel/' + channel.channelId} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#ef4444', textDecoration: 'none', fontWeight: 600 }}>
                              Mở YouTube <ExternalLink size={12} />
                            </a>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        )}

        {isAdmin && activeTab === 'compare' && (
          <div className="youtube-tab-panel youtube-compare-panel" style={panelStyle}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ flex: 1, minWidth: 'min(200px, 100%)', fontSize: 13, color: '#475569' }}>
                Đội A
                <select value={teamAId} onChange={(event) => setTeamAId(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 6, padding: '8px 12px', border: '1px solid #cbd5e1', fontSize: 14 }}>
                  <option value="">Chọn đội</option>
                  {teamsList.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </label>
              <Swords size={20} color="#ef4444" />
              <label style={{ flex: 1, minWidth: 'min(200px, 100%)', fontSize: 13, color: '#475569' }}>
                Đội B
                <select value={teamBId} onChange={(event) => setTeamBId(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 6, padding: '8px 12px', border: '1px solid #cbd5e1', fontSize: 14 }}>
                  <option value="">Chọn đội</option>
                  {teamsList.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </label>
            </div>
            {compareError && <div role="alert" className="motion-slide-down" style={{ color: '#dc2626' }}>{compareError}</div>}
            {teamAId && teamAId === teamBId && <p role="status" style={{ color: '#64748b' }}>Chọn hai đội khác nhau để so sánh.</p>}
            {compareLoading && !visibleComparison && <TableSkeleton rows={4} cols={3} minHeight={320} />}
            {visibleComparison && teamAId !== teamBId && (
              <div className="youtube-data-table-wrap" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 420, borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                      <th scope="col" style={{ padding: 14 }}>Chỉ số</th>
                      <th scope="col" style={{ padding: 14 }}>{visibleComparison.teamA.name}</th>
                      <th scope="col" style={{ padding: 14 }}>{visibleComparison.teamB.name}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Tổng lượt xem', 'totalViews', formatNumber],
                      ['Người đăng ký', 'totalSubscribers', formatNumber],
                      ['Tăng trưởng 30 ngày', 'viewsGrowth30dPct', formatGrowth],
                      ['Số kênh', 'channelsCount', formatNumber],
                    ].map(([label, field, formatter]) => (
                      <tr key={field} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <th scope="row" style={{ padding: 14, textAlign: 'left', fontWeight: 500, color: '#64748b' }}>{label}</th>
                        <td style={{ padding: 14, fontWeight: 700 }}>{formatter(visibleComparison.teamA[field])}</td>
                        <td style={{ padding: 14, fontWeight: 700 }}>{formatter(visibleComparison.teamB[field])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </TabTransition>
    </div>
  );
}
